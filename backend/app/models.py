from datetime import datetime, date
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(default=False)
    language: Mapped[str] = mapped_column(String(10), default="pt-BR")
    unit_system: Mapped[str] = mapped_column(String(20), default="metric")
    currency: Mapped[str] = mapped_column(String(10), default="BRL")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicles = relationship("Vehicle", back_populates="user", cascade="all, delete-orphan")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    marca: Mapped[str] = mapped_column(String(120), nullable=False)
    modelo: Mapped[str] = mapped_column(String(120), nullable=False)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    placa: Mapped[str] = mapped_column(String(12), nullable=False)
    combustivel_principal: Mapped[str] = mapped_column(String(40), nullable=False)
    quilometragem_atual: Mapped[float] = mapped_column(Float, default=0)
    valor_fipe: Mapped[float] = mapped_column(Float, default=0)
    tipo_veiculo: Mapped[str] = mapped_column(String(20), default="cars")
    fipe_brand_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fipe_model_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fipe_year_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fipe_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fipe_reference: Mapped[str | None] = mapped_column(String(40), nullable=True)
    fipe_last_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="vehicles")
    abastecimentos = relationship("FuelRecord", back_populates="vehicle", cascade="all, delete-orphan")
    despesas = relationship("ExpenseRecord", back_populates="vehicle", cascade="all, delete-orphan")
    fipe_history = relationship("VehicleFipeHistory", back_populates="vehicle", cascade="all, delete-orphan")


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    quilometragem: Mapped[float] = mapped_column(Float, nullable=False)
    tipo_combustivel: Mapped[str] = mapped_column(String(40), nullable=False)
    litros: Mapped[float] = mapped_column(Float, nullable=False)
    valor_total: Mapped[float] = mapped_column(Float, nullable=False)
    valor_litro: Mapped[float] = mapped_column(Float, nullable=False)
    tanque_cheio: Mapped[bool] = mapped_column(default=False)
    posto: Mapped[str] = mapped_column(String(120), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="abastecimentos")


class ExpenseRecord(Base):
    __tablename__ = "expense_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    quilometragem: Mapped[float | None] = mapped_column(Float, nullable=True)
    local: Mapped[str] = mapped_column(String(120), default="")
    descricao: Mapped[str] = mapped_column(Text, default="")
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="registrado")
    validade_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    validade_dias: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lembrete_confirmado: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="despesas")


class VehicleFipeHistory(Base):
    __tablename__ = "vehicle_fipe_history"
    __table_args__ = (UniqueConstraint("vehicle_id", "data_referencia", name="uq_vehicle_fipe_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    data_referencia: Mapped[date] = mapped_column(Date, nullable=False)
    referencia_tabela: Mapped[str | None] = mapped_column(String(40), nullable=True)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="fipe_history")


class LookupItem(Base):
    __tablename__ = "lookup_items"
    __table_args__ = (
        UniqueConstraint("user_id", "category", "value", "parent_value", name="uq_lookup_item"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(160), nullable=False)
    parent_value: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
