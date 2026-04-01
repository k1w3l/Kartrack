from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )


settings = Settings()
