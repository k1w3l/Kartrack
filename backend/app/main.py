from collections import defaultdict
from datetime import date, datetime, timedelta
from io import StringIO
import csv
import json
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import Body, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_user, get_password_hash, verify_password
from .config import settings
from .database import get_db, init_db
from .models import ExpenseRecord, FuelRecord, LookupItem, User, Vehicle, VehicleFipeHistory
from .schemas import (
    DashboardOut,
    ExpenseIn,
    ExpenseOut,
    FipeHistoryPoint,
    FipeOption,
    FuelIn,
    FuelOut,
    LoginInput,
    ReportOut,
    LookupIn,
    LookupOut,
    AdminResetPasswordIn,
    TimelineItem,
    TokenOut,
    UserCreate,
    UserOut,
    VehicleIn,
    VehicleOut,
    ChangePasswordIn,
    UserPreferencesIn,
)

app = FastAPI(title=settings.app_name)

UPLOAD_ROOT = Path("uploads")
VEHICLE_UPLOAD_DIR = UPLOAD_ROOT / "vehicles"
FIPE_API_BASE = "https://fipe.parallelum.com.br/api/v2"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
VEHICLE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _ensure_upload_dirs() -> None:
    VEHICLE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _vehicle_photo_url(vehicle_id: int) -> str | None:
    for file in VEHICLE_UPLOAD_DIR.glob(f"vehicle_{vehicle_id}.*"):
        return f"/uploads/vehicles/{file.name}"
    return None


def _fipe_get(path: str, params: dict | None = None):
    query = f"?{urlencode(params)}" if params else ""
    url = f"{FIPE_API_BASE}/{path.lstrip('/')}" + query
    with urlopen(url, timeout=15) as resp:  # nosec B310 - trusted public FIPE endpoint
        return json.loads(resp.read().decode("utf-8"))


def _parse_fipe_price_brl(value: str | None) -> float:
    raw = str(value or "").strip()
    if not raw:
        return 0.0
    raw = raw.replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _second_business_day(year: int, month: int) -> date:
    current = date(year, month, 1)
    business_days = 0
    while True:
        if current.weekday() < 5:
            business_days += 1
            if business_days == 2:
                return current
        current += timedelta(days=1)


def _refresh_vehicle_fipe_if_needed(vehicle: Vehicle, db: Session, force: bool = False) -> None:
    if not vehicle.fipe_brand_id or not vehicle.fipe_model_id or not vehicle.fipe_year_code:
        return

    today = date.today()
    second_business_day = _second_business_day(today.year, today.month)
    if not force and today < second_business_day:
        return
    if (
        not force
        and vehicle.fipe_last_sync_at
        and vehicle.fipe_last_sync_at.year == today.year
        and vehicle.fipe_last_sync_at.month == today.month
    ):
        return

    try:
        payload = _fipe_get(
            f"{vehicle.tipo_veiculo}/brands/{vehicle.fipe_brand_id}/models/{vehicle.fipe_model_id}/years/{vehicle.fipe_year_code}"
        )
    except Exception:
        return

    price = _parse_fipe_price_brl(payload.get("price"))
    if price <= 0:
        return

    vehicle.valor_fipe = price
    vehicle.fipe_reference = payload.get("referenceMonth") or vehicle.fipe_reference
    vehicle.fipe_code = payload.get("code") or vehicle.fipe_code
    vehicle.fipe_last_sync_at = datetime.utcnow()
    db.add(vehicle)

    point = (
        db.query(VehicleFipeHistory)
        .filter(
            VehicleFipeHistory.vehicle_id == vehicle.id,
            func.extract("year", VehicleFipeHistory.data_referencia) == today.year,
            func.extract("month", VehicleFipeHistory.data_referencia) == today.month,
        )
        .first()
    )
    if point:
        point.valor = price
        point.referencia_tabela = vehicle.fipe_reference
        db.add(point)
    else:
        db.add(
            VehicleFipeHistory(
                vehicle_id=vehicle.id,
                data_referencia=second_business_day if not force else today,
                valor=price,
                referencia_tabela=vehicle.fipe_reference,
            )
        )
    db.commit()


def _sync_vehicle_odometer(vehicle: Vehicle, db: Session) -> None:
    last_fuel = (
        db.query(FuelRecord)
        .filter(FuelRecord.vehicle_id == vehicle.id)
        .order_by(FuelRecord.data.desc(), FuelRecord.id.desc())
        .first()
    )
    last_expense = (
        db.query(ExpenseRecord)
        .filter(ExpenseRecord.vehicle_id == vehicle.id, ExpenseRecord.quilometragem.is_not(None))
        .order_by(ExpenseRecord.data.desc(), ExpenseRecord.id.desc())
        .first()
    )
    candidates = [r for r in [last_fuel, last_expense] if r]
    if not candidates:
        return
    latest = sorted(candidates, key=lambda r: (r.data, r.id), reverse=True)[0]
    km = float(getattr(latest, "quilometragem", 0) or 0)
    if km != float(vehicle.quilometragem_atual or 0):
        vehicle.quilometragem_atual = km
        db.add(vehicle)
        db.commit()


def _serialize_vehicle(vehicle: Vehicle) -> dict:
    return {
        "id": vehicle.id,
        "nome": vehicle.nome,
        "marca": vehicle.marca,
        "modelo": vehicle.modelo,
        "ano": vehicle.ano,
        "placa": vehicle.placa,
        "combustivel_principal": vehicle.combustivel_principal,
        "quilometragem_atual": vehicle.quilometragem_atual,
        "valor_fipe": vehicle.valor_fipe,
        "tipo_veiculo": vehicle.tipo_veiculo,
        "fipe_brand_id": vehicle.fipe_brand_id,
        "fipe_model_id": vehicle.fipe_model_id,
        "fipe_year_code": vehicle.fipe_year_code,
        "fipe_code": vehicle.fipe_code,
        "fipe_reference": vehicle.fipe_reference,
        "fipe_last_sync_at": vehicle.fipe_last_sync_at.isoformat() if vehicle.fipe_last_sync_at else None,
        "foto_url": _vehicle_photo_url(vehicle.id),
    }


@app.on_event("startup")
def on_startup() -> None:
    _ensure_upload_dirs()
    init_db()


app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


LOOKUP_DEFAULTS: dict[str, list[str]] = {
    "fuel_type": ["Gasolina Comum", "Gasolina Aditivada", "Gasolina Podium", "Diesel", "Etanol"],
    "fuel_brand": ["Ipiranga", "SIM", "BR", "Shell", "Outros"],
    "expense_oficina": ["Oficina Central", "Auto Center Bairro"],
    "expense_peca": ["Óleo do motor", "Filtro de óleo"],
    "expense_servico": ["Troca de óleo", "Alinhamento e balanceamento"],
    "expense_estacionamento_local": ["Centro", "Shopping"],
    "expense_estetica_local": ["Estética Automotiva Premium"],
    "expense_multa_tipo": ["Velocidade", "Estacionamento irregular", "Avanço de sinal"],
    "expense_imposto_tipo": ["IPVA", "Licenciamento", "Outros"],
    "expense_seguradora": ["Porto Seguro", "Azul Seguros"],
    "expense_financeira": ["Banco A", "Banco B"],
    "expense_financeira_local": ["Matriz", "Agência local"],
}


def _ensure_admin(current_user: User):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para administradores")


def _ensure_lookup_defaults(db: Session, user_id: int, category: str) -> None:
    defaults = LOOKUP_DEFAULTS.get(category) or []
    if not defaults:
        return
    existing = db.query(LookupItem.id).filter(LookupItem.user_id == user_id, LookupItem.category == category).first()
    if existing:
        return
    for value in defaults:
        db.add(LookupItem(user_id=user_id, category=category, value=value.strip(), parent_value=""))
    db.commit()


@app.post(f"{settings.api_prefix}/auth/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    has_any_user = db.query(User.id).first() is not None
    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_admin=not has_any_user,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post(f"{settings.api_prefix}/auth/login", response_model=TokenOut)
def login(payload: LoginInput, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    return TokenOut(access_token=create_access_token(str(user.id)))




@app.post(f"{settings.api_prefix}/auth/change-password")
def change_password(
    payload: ChangePasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual inválida")

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"ok": True}

@app.get(f"{settings.api_prefix}/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get(f"{settings.api_prefix}/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    return db.query(User).order_by(User.created_at.asc()).all()


@app.post(f"{settings.api_prefix}/users", response_model=UserOut)
def create_user_by_admin(user_in: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_admin=False,
        language=current_user.language,
        unit_system=current_user.unit_system,
        currency=current_user.currency,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.delete(f"{settings.api_prefix}/users/{'{'}user_id{'}'}")
def delete_user_by_admin(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Não é permitido excluir o próprio usuário admin logado")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.query(LookupItem).filter(LookupItem.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return {"ok": True}


@app.post(f"{settings.api_prefix}/users/{'{'}user_id{'}'}/reset-password")
def reset_password_by_admin(
    user_id: int,
    payload: AdminResetPasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.hashed_password = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"ok": True}


@app.put(f"{settings.api_prefix}/me/preferences", response_model=UserOut)
def update_preferences(
    payload: UserPreferencesIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.language = payload.language
    current_user.unit_system = payload.unit_system
    current_user.currency = payload.currency
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get(f"{settings.api_prefix}/lookup", response_model=list[LookupOut])
def list_lookup(
    category: str,
    parent_value: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_lookup_defaults(db, current_user.id, category)
    query = db.query(LookupItem).filter(LookupItem.user_id == current_user.id, LookupItem.category == category)
    if parent_value is not None:
        query = query.filter(LookupItem.parent_value == str(parent_value or "").strip())
    return [
        LookupOut(id=item.id, category=item.category, value=item.value, parent_value=item.parent_value or "")
        for item in query.order_by(LookupItem.value.asc(), LookupItem.id.asc()).all()
    ]


@app.post(f"{settings.api_prefix}/lookup", response_model=LookupOut)
def create_lookup(
    payload: LookupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    value = str(payload.value or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Valor inválido")
    category = str(payload.category or "").strip()
    parent = str(payload.parent_value or "").strip()
    exists = (
        db.query(LookupItem)
        .filter(
            LookupItem.user_id == current_user.id,
            LookupItem.category == category,
            func.lower(LookupItem.value) == value.lower(),
            LookupItem.parent_value == parent,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Item já cadastrado")
    item = LookupItem(user_id=current_user.id, category=category, value=value, parent_value=parent)
    db.add(item)
    db.commit()
    db.refresh(item)
    return LookupOut(id=item.id, category=item.category, value=item.value, parent_value=item.parent_value or "")


@app.delete(f"{settings.api_prefix}/lookup/{'{'}item_id{'}'}")
def delete_lookup(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(LookupItem).filter(LookupItem.id == item_id, LookupItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    db.delete(item)
    db.commit()
    return {"ok": True}


@app.post(f"{settings.api_prefix}/vehicles", response_model=VehicleOut)
def create_vehicle(vehicle_in: VehicleIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = Vehicle(**vehicle_in.model_dump(), user_id=current_user.id)
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    _refresh_vehicle_fipe_if_needed(vehicle, db, force=True)
    db.refresh(vehicle)
    return _serialize_vehicle(vehicle)


@app.get(f"{settings.api_prefix}/vehicles", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicles = db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()
    for vehicle in vehicles:
        _sync_vehicle_odometer(vehicle, db)
        _refresh_vehicle_fipe_if_needed(vehicle, db)
    vehicles = db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()
    return [_serialize_vehicle(v) for v in vehicles]


@app.put(f"{settings.api_prefix}/vehicles/{'{'}vehicle_id{'}'}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: int,
    vehicle_in: VehicleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.user_id == current_user.id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    for key, value in vehicle_in.model_dump().items():
        setattr(vehicle, key, value)

    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    _sync_vehicle_odometer(vehicle, db)
    _refresh_vehicle_fipe_if_needed(vehicle, db, force=True)
    db.refresh(vehicle)
    return _serialize_vehicle(vehicle)


@app.post(f"{settings.api_prefix}/vehicles/{'{'}vehicle_id{'}'}/photo", response_model=VehicleOut)
def upload_vehicle_photo(
    vehicle_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = _ensure_vehicle(vehicle_id, current_user, db)
    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")

    for old in VEHICLE_UPLOAD_DIR.glob(f"vehicle_{vehicle_id}.*"):
        old.unlink(missing_ok=True)

    filename = f"vehicle_{vehicle_id}{ext}"
    target = VEHICLE_UPLOAD_DIR / filename
    with target.open("wb") as f:
        f.write(file.file.read())

    return _serialize_vehicle(vehicle)


@app.delete(f"{settings.api_prefix}/vehicles/{'{'}vehicle_id{'}'}")
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = _ensure_vehicle(vehicle_id, current_user, db)
    for old in VEHICLE_UPLOAD_DIR.glob(f"vehicle_{vehicle_id}.*"):
        old.unlink(missing_ok=True)
    db.delete(vehicle)
    db.commit()
    return {"ok": True}


@app.get(f"{settings.api_prefix}/fipe/brands", response_model=list[FipeOption])
def fipe_brands(vehicle_type: str = "cars"):
    data = _fipe_get(f"{vehicle_type}/brands")
    return [FipeOption(codigo=str(item.get("code")), nome=item.get("name") or "") for item in data]


@app.get(f"{settings.api_prefix}/fipe/models", response_model=list[FipeOption])
def fipe_models(vehicle_type: str = "cars", brand_id: int = 0):
    if not brand_id:
        return []
    data = _fipe_get(f"{vehicle_type}/brands/{brand_id}/models")
    return [FipeOption(codigo=str(item.get("code")), nome=item.get("name") or "") for item in data]


@app.get(f"{settings.api_prefix}/fipe/years", response_model=list[FipeOption])
def fipe_years(vehicle_type: str = "cars", brand_id: int = 0, model_id: int = 0):
    if not brand_id or not model_id:
        return []
    data = _fipe_get(f"{vehicle_type}/brands/{brand_id}/models/{model_id}/years")
    return [FipeOption(codigo=str(item.get("code")), nome=item.get("name") or "") for item in data]


@app.get(f"{settings.api_prefix}/fipe/price")
def fipe_price(vehicle_type: str = "cars", brand_id: int = 0, model_id: int = 0, year_code: str = ""):
    if not brand_id or not model_id or not year_code:
        raise HTTPException(status_code=400, detail="Parâmetros FIPE incompletos")
    details = _fipe_get(f"{vehicle_type}/brands/{brand_id}/models/{model_id}/years/{year_code}")
    return {
        "valor_fipe": _parse_fipe_price_brl(details.get("price")),
        "fipe_reference": details.get("referenceMonth"),
        "fipe_code": details.get("code"),
        "marca": details.get("brand"),
        "modelo": details.get("model"),
        "ano_modelo": details.get("modelYear"),
        "combustivel": details.get("fuel"),
    }


@app.post(f"{settings.api_prefix}/vehicles/{'{'}vehicle_id{'}'}/fipe-sync", response_model=VehicleOut)
def sync_vehicle_fipe(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = _ensure_vehicle(vehicle_id, current_user, db)
    _refresh_vehicle_fipe_if_needed(vehicle, db, force=True)
    db.refresh(vehicle)
    return _serialize_vehicle(vehicle)


def _ensure_vehicle(vehicle_id: int, current_user: User, db: Session) -> Vehicle:
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.user_id == current_user.id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    return vehicle


def _ensure_fuel_record(fuel_id: int, current_user: User, db: Session) -> FuelRecord:
    fuel = (
        db.query(FuelRecord)
        .join(Vehicle, Vehicle.id == FuelRecord.vehicle_id)
        .filter(FuelRecord.id == fuel_id, Vehicle.user_id == current_user.id)
        .first()
    )
    if not fuel:
        raise HTTPException(status_code=404, detail="Abastecimento não encontrado")
    return fuel


def _ensure_expense_record(expense_id: int, current_user: User, db: Session) -> ExpenseRecord:
    expense = (
        db.query(ExpenseRecord)
        .join(Vehicle, Vehicle.id == ExpenseRecord.vehicle_id)
        .filter(ExpenseRecord.id == expense_id, Vehicle.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    return expense


def _compute_full_tank_consumption(fuels: list[FuelRecord]) -> dict[int, float | None]:
    fuels_sorted = sorted(
        fuels,
        key=lambda f: (
            f.data,
            float(f.quilometragem or 0),
            f.id,
        ),
    )
    consumo_por_fuel: dict[int, float | None] = {fuel.id: None for fuel in fuels_sorted}
    ultimo_tanque_cheio_idx: int | None = None

    for idx, fuel in enumerate(fuels_sorted):
        if not fuel.tanque_cheio:
            continue

        if ultimo_tanque_cheio_idx is None:
            ultimo_tanque_cheio_idx = idx
            continue

        anterior = fuels_sorted[ultimo_tanque_cheio_idx]
        km_rodados = fuel.quilometragem - anterior.quilometragem
        litros_consumidos = sum(item.litros for item in fuels_sorted[ultimo_tanque_cheio_idx + 1: idx + 1])

        if litros_consumidos > 0 and km_rodados >= 0:
            consumo_por_fuel[fuel.id] = round(km_rodados / litros_consumidos, 2)

        ultimo_tanque_cheio_idx = idx

    return consumo_por_fuel


def _extract_maintenance_service_label(description: str) -> str:
    text = str(description or "")
    parts = [part.strip() for part in text.split(" • ") if part.strip()]
    service_part = next((part for part in parts if part.startswith("Serviços: ")), "")
    if service_part:
        services = service_part.removeprefix("Serviços: ").strip()
        services = ", ".join(part.strip() for part in services.split(",") if part.strip())
        services = services if services and services != "-" else "Manutenção"
        services = re.sub(r"\s*\(R\$\s*[\d.,]+\)", "", services).strip()
        return services or "Manutenção"
    return "Manutenção"


@app.get(f"{settings.api_prefix}/fuel/last")
def last_fuel(vehicle_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_vehicle(vehicle_id, current_user, db)
    fuel = db.query(FuelRecord).filter(FuelRecord.vehicle_id == vehicle_id).order_by(FuelRecord.data.desc(), FuelRecord.id.desc()).first()
    if not fuel:
        return None
    return {
        "tipo_combustivel": fuel.tipo_combustivel,
        "posto": fuel.posto,
        "quilometragem": fuel.quilometragem,
        "tanque_cheio": fuel.tanque_cheio,
    }


@app.post(f"{settings.api_prefix}/fuel")
def add_fuel(record: FuelIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = _ensure_vehicle(record.vehicle_id, current_user, db)
    fuel = FuelRecord(
        **record.model_dump(exclude={"valor_total"}),
        valor_total=record.valor_total,
        valor_litro=(record.valor_total / record.litros if record.litros else 0),
    )
    vehicle.quilometragem_atual = max(vehicle.quilometragem_atual, record.quilometragem)
    db.add(fuel)
    db.commit()
    return {"ok": True}


@app.get(f"{settings.api_prefix}/fuel/{'{'}fuel_id{'}'}", response_model=FuelOut)
def get_fuel(fuel_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _ensure_fuel_record(fuel_id, current_user, db)


@app.put(f"{settings.api_prefix}/fuel/{'{'}fuel_id{'}'}", response_model=FuelOut)
def update_fuel(
    fuel_id: int,
    record: FuelIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_vehicle(record.vehicle_id, current_user, db)
    fuel = _ensure_fuel_record(fuel_id, current_user, db)

    for key, value in record.model_dump().items():
        setattr(fuel, key, value)

    fuel.valor_litro = record.valor_total / record.litros if record.litros else 0
    db.add(fuel)
    db.commit()
    db.refresh(fuel)
    return fuel


@app.delete(f"{settings.api_prefix}/fuel/{'{'}fuel_id{'}'}")
def delete_fuel(fuel_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fuel = _ensure_fuel_record(fuel_id, current_user, db)
    db.delete(fuel)
    db.commit()
    return {"ok": True}


@app.post(f"{settings.api_prefix}/expenses")
def add_expense(record: ExpenseIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = _ensure_vehicle(record.vehicle_id, current_user, db)
    expense = ExpenseRecord(**record.model_dump())
    if record.quilometragem:
        vehicle.quilometragem_atual = max(vehicle.quilometragem_atual, record.quilometragem)
    db.add(expense)
    db.commit()
    return {"ok": True}


@app.get(f"{settings.api_prefix}/expenses/{'{'}expense_id{'}'}", response_model=ExpenseOut)
def get_expense(expense_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _ensure_expense_record(expense_id, current_user, db)


@app.put(f"{settings.api_prefix}/expenses/{'{'}expense_id{'}'}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    record: ExpenseIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_vehicle(record.vehicle_id, current_user, db)
    expense = _ensure_expense_record(expense_id, current_user, db)

    for key, value in record.model_dump().items():
        setattr(expense, key, value)

    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@app.delete(f"{settings.api_prefix}/expenses/{'{'}expense_id{'}'}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expense = _ensure_expense_record(expense_id, current_user, db)
    db.delete(expense)
    db.commit()
    return {"ok": True}


@app.post(f"{settings.api_prefix}/expenses/{'{'}expense_id{'}'}/confirm-reminder")
def confirm_reminder(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = _ensure_expense_record(expense_id, current_user, db)
    expense.lembrete_confirmado = True
    db.add(expense)
    db.commit()
    return {"ok": True}


@app.get(f"{settings.api_prefix}/timeline", response_model=list[TimelineItem])
def timeline(vehicle_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = _ensure_vehicle(vehicle_id, current_user, db)
    _sync_vehicle_odometer(vehicle, db)
    _refresh_vehicle_fipe_if_needed(vehicle, db)
    fuels = db.query(FuelRecord).filter(FuelRecord.vehicle_id == vehicle_id).all()
    expenses = db.query(ExpenseRecord).filter(ExpenseRecord.vehicle_id == vehicle_id).all()
    fipe_history = db.query(VehicleFipeHistory).filter(VehicleFipeHistory.vehicle_id == vehicle_id).all()
    consumo_por_fuel = _compute_full_tank_consumption(fuels)

    data = [
        TimelineItem(
            id=f.id,
            tipo_registro="abastecimento",
            data=f.data,
            quilometragem=f.quilometragem,
            valor=f.valor_total,
            descricao=f.tipo_combustivel,
            local=f.posto,
            observacao=f.descricao or None,
            bandeira=(f.posto.split(" - ", 1)[0] if " - " in (f.posto or "") else ""),
            tipo_combustivel=f.tipo_combustivel,
            litros=f.litros,
            valor_litro=f.valor_litro,
            consumo_km_l=consumo_por_fuel.get(f.id),
        )
        for f in fuels
    ] + [
        TimelineItem(
            id=e.id,
            tipo_registro=e.tipo,
            data=e.data,
            quilometragem=e.quilometragem,
            valor=e.valor,
            descricao=e.descricao or "",
            local=e.local,
            observacao=e.descricao or None,
        )
        for e in expenses
    ] + [
        TimelineItem(
            id=9000000 + h.id,
            tipo_registro="fipe",
            data=h.data_referencia,
            quilometragem=None,
            valor=h.valor,
            descricao="Atualização FIPE",
            local=vehicle.modelo,
            observacao=f"Código FIPE: {vehicle.fipe_code}" if vehicle.fipe_code else None,
            fipe_referencia=h.referencia_tabela,
        )
        for h in fipe_history
    ]
    return sorted(data, key=lambda x: (x.data, x.quilometragem if x.quilometragem is not None else -1, x.id), reverse=True)


@app.get(f"{settings.api_prefix}/dashboard", response_model=DashboardOut)
def dashboard(vehicle_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = _ensure_vehicle(vehicle_id, current_user, db)
    _sync_vehicle_odometer(vehicle, db)
    _refresh_vehicle_fipe_if_needed(vehicle, db)
    db.refresh(vehicle)
    total_fuel = db.query(func.coalesce(func.sum(FuelRecord.valor_total), 0)).filter(FuelRecord.vehicle_id == vehicle_id).scalar()
    total_exp = db.query(func.coalesce(func.sum(ExpenseRecord.valor), 0)).filter(ExpenseRecord.vehicle_id == vehicle_id).scalar()

    fuels = db.query(FuelRecord).filter(FuelRecord.vehicle_id == vehicle_id).order_by(FuelRecord.data.asc()).all()
    consumos = [valor for valor in _compute_full_tank_consumption(fuels).values() if valor is not None]
    media = sum(consumos) / len(consumos) if consumos else 0

    today = date.today()
    maintenance = (
        db.query(ExpenseRecord)
        .filter(
            ExpenseRecord.vehicle_id == vehicle_id,
            ExpenseRecord.tipo == "manutenção",
            ExpenseRecord.lembrete_confirmado.is_(False),
        )
        .all()
    )
    reminders = []
    for m in maintenance:
        service_label = _extract_maintenance_service_label(m.descricao or "")
        days_left = None
        km_left = None
        if m.validade_dias:
            days_left = m.validade_dias - (today - m.data).days
        if m.validade_km and m.quilometragem:
            km_left = int(m.validade_km - max(0, vehicle.quilometragem_atual - m.quilometragem))

        if days_left is not None and km_left is not None:
            reminders.append((m.id, f"{service_label} • faltam {days_left} dias ou {km_left} km para a próxima manutenção.", days_left, km_left))
        elif days_left is not None:
            reminders.append((m.id, f"{service_label} • faltam {days_left} dias para a próxima manutenção.", days_left, None))
        elif km_left is not None:
            reminders.append((m.id, f"{service_label} • faltam {km_left} km para a próxima manutenção.", None, km_left))

    reminders.sort(
        key=lambda item: (
            item[3] if item[3] is not None else 10**9,
            item[2] if item[2] is not None else 10**9,
        ),
    )

    return DashboardOut(
        total_despesas=round(float(total_exp), 2),
        total_abastecimentos=round(float(total_fuel), 2),
        media_consumo_km_l=round(float(media), 2),
        quilometragem_atual=vehicle.quilometragem_atual,
        lembretes=[f"{item[0]}::{item[1]}" for item in reminders],
    )


@app.get(f"{settings.api_prefix}/reports", response_model=ReportOut)
def reports(vehicle_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = _ensure_vehicle(vehicle_id, current_user, db)
    _refresh_vehicle_fipe_if_needed(vehicle, db)
    expenses = db.query(ExpenseRecord).filter(ExpenseRecord.vehicle_id == vehicle_id).all()
    fuels = db.query(FuelRecord).filter(FuelRecord.vehicle_id == vehicle_id).all()

    by_type: dict[str, float] = defaultdict(float)
    for e in expenses:
        by_type[e.tipo] += e.valor

    avg_fuel = (sum(f.valor_total for f in fuels) / len(fuels)) if fuels else 0
    intervals = [valor for valor in _compute_full_tank_consumption(fuels).values() if valor is not None]
    consumo = sum(intervals) / len(intervals) if intervals else 0

    return ReportOut(
        despesas_por_tipo={k: round(v, 2) for k, v in by_type.items()},
        abastecimento_medio=round(avg_fuel, 2),
        consumo_medio=round(consumo, 2),
    )


@app.get(f"{settings.api_prefix}/fipe/history", response_model=list[FipeHistoryPoint])
def fipe_history(vehicle_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = _ensure_vehicle(vehicle_id, current_user, db)
    _refresh_vehicle_fipe_if_needed(vehicle, db)
    points = (
        db.query(VehicleFipeHistory)
        .filter(VehicleFipeHistory.vehicle_id == vehicle_id)
        .order_by(VehicleFipeHistory.data_referencia.asc())
        .all()
    )
    return [
        FipeHistoryPoint(
            data=p.data_referencia,
            valor=round(float(p.valor), 2),
            referencia_tabela=p.referencia_tabela,
        )
        for p in points
    ]


@app.post(f"{settings.api_prefix}/records/import")
def import_csv(
    vehicle_id: int,
    file: UploadFile = File(...),
    mode: str = "todos",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_vehicle(vehicle_id, current_user, db)
    raw_bytes = file.file.read()
    content = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            content = raw_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if content is None:
        raise HTTPException(
            status_code=400,
            detail="Não foi possível ler o CSV. Salve o arquivo como UTF-8 ou ANSI/Windows-1252 e tente novamente.",
        )
    reader = csv.DictReader(StringIO(content))
    imported = {"abastecimentos": 0, "despesas": 0}

    only_fuel = mode == "abastecimentos"
    only_expenses = mode == "despesas"

    for row in reader:
        categoria = (row.get("categoria") or "").strip().lower()
        is_fuel = categoria == "abastecimento"

        if only_fuel and not is_fuel:
            continue
        if only_expenses and is_fuel:
            continue

        if is_fuel:
            litros = float(row.get("litros") or 0)
            valor_total = float(row.get("valor") or 0)
            bandeira = (row.get("bandeira") or "").strip()
            local = (row.get("local") or "").strip()
            posto = f"{bandeira} - {local}" if bandeira and local else (local or row.get("posto") or "Não informado")
            db.add(
                FuelRecord(
                    vehicle_id=vehicle_id,
                    data=datetime.strptime(row.get("data"), "%Y-%m-%d").date(),
                    quilometragem=float(row.get("quilometragem") or 0),
                    tipo_combustivel=row.get("tipo_combustivel") or "Gasolina Comum",
                    litros=litros,
                    valor_total=valor_total,
                    valor_litro=(valor_total / litros if litros else 0),
                    tanque_cheio=str(row.get("tanque_cheio") or "").strip().lower() in {"1", "true", "sim", "yes", "y"},
                    posto=posto,
                    descricao=row.get("descricao") or "",
                )
            )
            imported["abastecimentos"] += 1
        else:
            descricao_parts = []
            for key in ("pecas", "descricao_servico", "valor_pecas", "valor_servico", "parcelas", "valor_parcela", "classe_bonus"):
                val = row.get(key)
                if val not in (None, ""):
                    descricao_parts.append(f"{key}: {val}")

            descricao_extra = " • ".join(descricao_parts)
            descricao_base = row.get("descricao") or ""
            descricao_final = f"{descricao_base} • {descricao_extra}".strip(" •") if descricao_extra else descricao_base
            db.add(
                ExpenseRecord(
                    vehicle_id=vehicle_id,
                    tipo=categoria or "outros",
                    data=datetime.strptime(row.get("data"), "%Y-%m-%d").date(),
                    quilometragem=float(row.get("quilometragem") or 0) or None,
                    local=row.get("local") or "",
                    descricao=descricao_final,
                    valor=float(row.get("valor") or 0),
                    status=row.get("status") or "registrado",
                )
            )
            imported["despesas"] += 1
    db.commit()
    return imported


@app.get(f"{settings.api_prefix}/records/export")
def export_csv(
    vehicle_id: int,
    mode: str = "todos",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_vehicle(vehicle_id, current_user, db)
    out = StringIO()
    writer = csv.writer(out)
    writer.writerow([
        "categoria", "data", "quilometragem", "tipo_combustivel", "litros", "valor", "tanque_cheio", "bandeira", "local", "status", "descricao",
        "oficina", "pecas", "descricao_servico", "valor_pecas", "valor_servico", "parcelas", "valor_parcela", "classe_bonus",
    ])

    if mode in ("todos", "abastecimentos"):
        for f in db.query(FuelRecord).filter(FuelRecord.vehicle_id == vehicle_id):
            parts = (f.posto or "").split(" - ", 1)
            bandeira = parts[0] if len(parts) > 1 else ""
            local = parts[1] if len(parts) > 1 else (f.posto or "")
            writer.writerow(["abastecimento", f.data, f.quilometragem, f.tipo_combustivel, f.litros, f.valor_total, "sim" if f.tanque_cheio else "não", bandeira, local, "", f.descricao, "", "", "", "", "", "", "", ""])

    if mode in ("todos", "despesas"):
        for e in db.query(ExpenseRecord).filter(ExpenseRecord.vehicle_id == vehicle_id):
            writer.writerow([e.tipo, e.data, e.quilometragem or "", "", "", e.valor, "", "", e.local, e.status or "", e.descricao, e.local, "", "", "", "", "", "", ""])

    out.seek(0)
    suffix = "tudo" if mode == "todos" else mode
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=registros_{suffix}.csv"})


@app.get(f"{settings.api_prefix}/records/template")
def csv_template(mode: str = "todos"):
    header = "categoria,data,quilometragem,tipo_combustivel,litros,valor,tanque_cheio,bandeira,local,status,descricao,oficina,pecas,descricao_servico,valor_pecas,valor_servico,parcelas,valor_parcela,classe_bonus\n"
    if mode == "abastecimentos":
        sample = "abastecimento,2026-01-31,52340,Gasolina Comum,42.1,289.00,sim,Ipiranga,Avenida Brasil 1000,,Abastecimento completo,,,,,,,,\n"
    elif mode == "despesas":
        sample = "manutenção,2026-01-31,52340,,,450.00,,,Oficina Centro,registrado,Troca de óleo e filtros,Oficina Centro,Filtro de óleo,Troca completa,180.00,270.00,,,,\n"
    else:
        sample = (
            "abastecimento,2026-01-31,52340,Gasolina Comum,42.1,289.00,sim,Ipiranga,Avenida Brasil 1000,,Abastecimento completo,,,,,,,,\n"
            "manutenção,2026-01-31,52340,,,450.00,,,Oficina Centro,registrado,Troca de óleo e filtros,Oficina Centro,Filtro de óleo,Troca completa,180.00,270.00,,,,\n"
        )

    content = header + sample
    return StreamingResponse(iter([content]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=modelo_registros.csv"})


@app.delete(f"{settings.api_prefix}/records/all")
def clear_all_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle_ids = [v.id for v in db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()]
    if not vehicle_ids:
        return {"ok": True}

    db.query(FuelRecord).filter(FuelRecord.vehicle_id.in_(vehicle_ids)).delete(synchronize_session=False)
    db.query(ExpenseRecord).filter(ExpenseRecord.vehicle_id.in_(vehicle_ids)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}


@app.get(f"{settings.api_prefix}/system/backup")
def system_backup(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicles = db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()
    vehicle_ids = [v.id for v in vehicles]
    fuels = db.query(FuelRecord).filter(FuelRecord.vehicle_id.in_(vehicle_ids)).all() if vehicle_ids else []
    expenses = db.query(ExpenseRecord).filter(ExpenseRecord.vehicle_id.in_(vehicle_ids)).all() if vehicle_ids else []

    return {
        "vehicles": [
            {
                "id": v.id,
                "nome": v.nome,
                "marca": v.marca,
                "modelo": v.modelo,
                "ano": v.ano,
                "placa": v.placa,
                "combustivel_principal": v.combustivel_principal,
                "quilometragem_atual": v.quilometragem_atual,
                "valor_fipe": v.valor_fipe,
                "tipo_veiculo": v.tipo_veiculo,
                "fipe_brand_id": v.fipe_brand_id,
                "fipe_model_id": v.fipe_model_id,
                "fipe_year_code": v.fipe_year_code,
                "fipe_code": v.fipe_code,
                "fipe_reference": v.fipe_reference,
            }
            for v in vehicles
        ],
        "fuels": [
            {
                "vehicle_id": f.vehicle_id,
                "data": f.data.isoformat(),
                "quilometragem": f.quilometragem,
                "tipo_combustivel": f.tipo_combustivel,
                "litros": f.litros,
                "valor_total": f.valor_total,
                "tanque_cheio": f.tanque_cheio,
                "posto": f.posto,
                "descricao": f.descricao or "",
            }
            for f in fuels
        ],
        "expenses": [
            {
                "vehicle_id": e.vehicle_id,
                "tipo": e.tipo,
                "data": e.data.isoformat(),
                "quilometragem": e.quilometragem,
                "local": e.local or "",
                "descricao": e.descricao or "",
                "valor": e.valor,
                "vencimento": e.vencimento.isoformat() if e.vencimento else None,
                "status": e.status or "registrado",
                "validade_km": e.validade_km,
                "validade_dias": e.validade_dias,
            }
            for e in expenses
        ],
    }


@app.post(f"{settings.api_prefix}/system/restore")
def system_restore(payload: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicles_payload = payload.get("vehicles") or []
    fuels_payload = payload.get("fuels") or []
    expenses_payload = payload.get("expenses") or []

    existing = db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()
    for v in existing:
        db.delete(v)
    db.commit()

    id_map = {}
    for v in vehicles_payload:
        new_v = Vehicle(
            user_id=current_user.id,
            nome=v.get("nome") or "Veículo",
            marca=v.get("marca") or "",
            modelo=v.get("modelo") or "",
            ano=int(v.get("ano") or 2000),
            placa=v.get("placa") or "",
            combustivel_principal=v.get("combustivel_principal") or "Gasolina",
            quilometragem_atual=float(v.get("quilometragem_atual") or 0),
            valor_fipe=float(v.get("valor_fipe") or 0),
            tipo_veiculo=v.get("tipo_veiculo") or "cars",
            fipe_brand_id=int(v.get("fipe_brand_id")) if str(v.get("fipe_brand_id") or "").strip() else None,
            fipe_model_id=int(v.get("fipe_model_id")) if str(v.get("fipe_model_id") or "").strip() else None,
            fipe_year_code=v.get("fipe_year_code"),
            fipe_code=v.get("fipe_code"),
            fipe_reference=v.get("fipe_reference"),
        )
        db.add(new_v)
        db.flush()
        id_map[v.get("id")] = new_v.id

    for f in fuels_payload:
        vehicle_id = id_map.get(f.get("vehicle_id"))
        if not vehicle_id:
            continue
        db.add(FuelRecord(
            vehicle_id=vehicle_id,
            data=datetime.strptime(f.get("data"), "%Y-%m-%d").date(),
            quilometragem=float(f.get("quilometragem") or 0),
            tipo_combustivel=f.get("tipo_combustivel") or "Gasolina Comum",
            litros=float(f.get("litros") or 0),
            valor_total=float(f.get("valor_total") or 0),
            valor_litro=(float(f.get("valor_total") or 0) / float(f.get("litros") or 1)) if float(f.get("litros") or 0) else 0,
            tanque_cheio=bool(f.get("tanque_cheio", False)),
            posto=f.get("posto") or "Não informado",
            descricao=f.get("descricao") or "",
        ))

    for e in expenses_payload:
        vehicle_id = id_map.get(e.get("vehicle_id"))
        if not vehicle_id:
            continue
        venc = e.get("vencimento")
        db.add(ExpenseRecord(
            vehicle_id=vehicle_id,
            tipo=e.get("tipo") or "outros",
            data=datetime.strptime(e.get("data"), "%Y-%m-%d").date(),
            quilometragem=float(e.get("quilometragem")) if e.get("quilometragem") is not None else None,
            local=e.get("local") or "",
            descricao=e.get("descricao") or "",
            valor=float(e.get("valor") or 0),
            vencimento=datetime.strptime(venc, "%Y-%m-%d").date() if venc else None,
            status=e.get("status") or "registrado",
            validade_km=float(e.get("validade_km")) if e.get("validade_km") is not None else None,
            validade_dias=int(e.get("validade_dias")) if e.get("validade_dias") is not None else None,
        ))

    db.commit()
    return {"ok": True}
