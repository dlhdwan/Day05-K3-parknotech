from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "VLearn RAG Agent API"
    QDRANT_URL: str = "http://qdrant:6333"
    COLLECTION_NAME: str = "vlearn_slides"
    DEFAULT_LLM_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_API_KEY: str = ""
    SLIDES_DIR: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
