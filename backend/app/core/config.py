from pydantic import AliasChoices, Field
from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import Annotated, List, Optional
import json
from pydantic_settings import NoDecode


class Settings(BaseSettings):
    # ── API ──────────────────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    secret_key: str = Field(
        default="trafficx-dev-secret-key-change-in-production",
        validation_alias=AliasChoices("JWT_SECRET", "SECRET_KEY"),
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5184",
        "http://localhost:3000",
    ]

    # ── Apache Kafka ─────────────────────────────────────────────────────────
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_raw: str = "traffic.raw"
    kafka_topic_processed: str = "traffic.processed"
    kafka_topic_predictions: str = "traffic.predictions"
    kafka_topic_incidents: str = "traffic.incidents"
    kafka_topic_node_status: str = "traffic.node_status"
    kafka_consumer_group: str = "trafficx-backend"

    # ── Apache Cassandra ─────────────────────────────────────────────────────
    cassandra_contact_points: str = "localhost"
    cassandra_port: int = 9042
    cassandra_keyspace: str = "trafficx"
    cassandra_username: Optional[str] = None
    cassandra_password: Optional[str] = None

    # ── ML ───────────────────────────────────────────────────────────────────
    ml_model_path: str = "./app/ml/models/congestion_model.joblib"
    lstm_model_path: str = "./app/ml/models/lstm_model.keras"
    lstm_scaler_path: str = "./app/ml/models/lstm_scaler.pkl"
    demo_mode: bool = True

    # ── External APIs (all optional) ─────────────────────────────────────────
    tomtom_api_key: Optional[str] = None
    here_api_key: Optional[str] = None
    openweather_api_key: Optional[str] = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("["):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
