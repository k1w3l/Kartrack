from datetime import date
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class LoginInput(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_admin: bool = False
    language: str = "pt-BR"
    unit_system: str = "metric"
    currency: str = "BRL"

    class Config:
        from_attributes = True


class VehicleIn(BaseModel):
    nome: str
    marca: str
    modelo: str
    ano: int
    placa: str
    combustivel_principal: str
    quilometragem_atual: float = 0
    valor_fipe: float = 0
    tipo_veiculo: str = "cars"
    fipe_brand_id: int | None = None
    fipe_model_id: int | None = None
    fipe_year_code: str | None = None
    fipe_code: str | None = None
    fipe_reference: str | None = None


class VehicleOut(VehicleIn):
    id: int
    foto_url: str | None = None
    fipe_last_sync_at: str | None = None

    class Config:
        from_attributes = True


class FuelIn(BaseModel):
    vehicle_id: int
    data: date
    quilometragem: float
    tipo_combustivel: str
    litros: float
    valor_total: float
    tanque_cheio: bool = False
    posto: str
    descricao: str = ""


class ExpenseIn(BaseModel):
    vehicle_id: int
    tipo: str
    data: date
    quilometragem: float | None = None
    local: str = ""
    descricao: str = ""
    valor: float
    vencimento: date | None = None
    status: str = "registrado"
    validade_km: float | None = None
    validade_dias: int | None = None
    lembrete_confirmado: bool = False




class FuelOut(FuelIn):
    id: int

    class Config:
        from_attributes = True


class ExpenseOut(ExpenseIn):
    id: int

    class Config:
        from_attributes = True

class TimelineItem(BaseModel):
    id: int
    tipo_registro: str
    data: date
    quilometragem: float | None
    valor: float
    descricao: str
    local: str | None = None
    observacao: str | None = None
    bandeira: str | None = None
    tipo_combustivel: str | None = None
    litros: float | None = None
    valor_litro: float | None = None
    consumo_km_l: float | None = None
    fipe_referencia: str | None = None


class DashboardOut(BaseModel):
    total_despesas: float
    total_abastecimentos: float
    media_consumo_km_l: float
    quilometragem_atual: float
    lembretes: list[str]


class ReportOut(BaseModel):
    despesas_por_tipo: dict[str, float]
    abastecimento_medio: float
    consumo_medio: float


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class AdminResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=6)


class UserPreferencesIn(BaseModel):
    language: str = "pt-BR"
    unit_system: str = "metric"
    currency: str = "BRL"


class FipeOption(BaseModel):
    codigo: str
    nome: str


class FipeHistoryPoint(BaseModel):
    data: date
    valor: float
    referencia_tabela: str | None = None


class LookupIn(BaseModel):
    category: str
    value: str
    parent_value: str | None = None


class LookupOut(BaseModel):
    id: int
    category: str
    value: str
    parent_value: str = ""
