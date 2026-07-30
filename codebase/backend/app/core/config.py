from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "VLearn RAG Agent API"
    QDRANT_URL: str = "http://qdrant:6333"
    COLLECTION_NAME: str = "vlearn_slides"
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
