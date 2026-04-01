import time

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def wait_for_db(max_attempts: int = 30, delay_seconds: float = 2.0) -> None:
    last_error: Exception | None = None
    for _ in range(max_attempts):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError as exc:
            last_error = exc
            time.sleep(delay_seconds)
    if last_error:
        raise last_error


def init_db() -> None:
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        fuel_columns = {col["name"] for col in inspect(conn).get_columns("fuel_records")}
        if "tanque_cheio" not in fuel_columns:
            conn.execute(text("ALTER TABLE fuel_records ADD COLUMN tanque_cheio BOOLEAN NOT NULL DEFAULT FALSE"))

        vehicle_columns = {col["name"] for col in inspect(conn).get_columns("vehicles")}
        alters = [
            ("tipo_veiculo", "VARCHAR(20) NOT NULL DEFAULT 'cars'"),
            ("fipe_brand_id", "INTEGER NULL"),
            ("fipe_model_id", "INTEGER NULL"),
            ("fipe_year_code", "VARCHAR(20) NULL"),
            ("fipe_code", "VARCHAR(20) NULL"),
            ("fipe_reference", "VARCHAR(40) NULL"),
            ("fipe_last_sync_at", "DATETIME NULL"),
        ]
        for col_name, col_type in alters:
            if col_name not in vehicle_columns:
                conn.execute(text(f"ALTER TABLE vehicles ADD COLUMN {col_name} {col_type}"))

        user_columns = {col["name"] for col in inspect(conn).get_columns("users")}
        if "is_admin" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
        if "language" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'pt-BR'"))
        if "unit_system" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN unit_system VARCHAR(20) NOT NULL DEFAULT 'metric'"))
        if "currency" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'BRL'"))

        expense_columns = {col["name"] for col in inspect(conn).get_columns("expense_records")}
        if "lembrete_confirmado" not in expense_columns:
            conn.execute(text("ALTER TABLE expense_records ADD COLUMN lembrete_confirmado BOOLEAN NOT NULL DEFAULT FALSE"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
