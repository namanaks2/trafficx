from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    secret_key: str = "trafficx-dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # Database
    database_url: str = "sqlite+aiosqlite:///./trafficx.db"

    # CORS
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5184",
        "http://localhost:3000",
    ]

    # ML
    ml_model_path: str = "./app/ml/models/congestion_model.joblib"
    demo_mode: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
