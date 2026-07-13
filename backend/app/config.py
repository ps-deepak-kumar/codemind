import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CodeMind AI Codebase Assistant"
    API_V1_STR: str = "/api/v1"
    
    # Ollama settings
    OLLAMA_URL: str = "http://localhost:11434"
    DEFAULT_LLM_MODEL: str = "qwen2.5-coder:1.5b"
    DEFAULT_EMBEDDING_MODEL: str = "nomic-embed-text"
    
    # Storage settings
    REPOS_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../cloned_repos"))
    DATABASE_URL: str = "sqlite:///" + os.path.abspath(os.path.join(os.path.dirname(__file__), "../../codemind.db"))
    CHROMA_PERSIST_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../chroma_db"))
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.REPOS_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
