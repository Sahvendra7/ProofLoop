from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    YOUCAM_API_KEY: str = "demo_key"
    YOUCAM_API_URL: str = "https://yce-api.perfectcorp.com"
    DEMO_MODE: bool = True
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()
