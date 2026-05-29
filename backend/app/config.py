from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_SECRET_KEYS = {"change-me", "troque-esta-chave", ""}


class Settings(BaseSettings):
    app_name: str = "Kartrack"
    api_prefix: str = "/api"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60 * 24
    db_user: str = "cartrack"
    db_password: str = "cartrack"
    db_host: str = "db"
    db_port: int = 3306
    db_name: str = "cartrack"
    # Origens permitidas para CORS (separadas por vírgula). Use o domínio real em produção.
    cors_origins: str = "http://localhost:5173"
    max_upload_bytes: int = 5 * 1024 * 1024  # 5 MB

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def secret_key_is_default(self) -> bool:
        return self.secret_key.strip() in DEFAULT_SECRET_KEYS


settings = Settings()
