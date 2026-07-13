import httpx
from fastapi import APIRouter
from app.config import settings

router = APIRouter()

@router.get("/")
async def get_settings():
    ollama_models = []
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                ollama_models = [model["name"] for model in data.get("models", [])]
    except Exception as e:
        print(f"Failed to fetch models from Ollama: {e}")
        
    return {
        "current": {
            "llm_model": settings.DEFAULT_LLM_MODEL,
            "embedding_model": settings.DEFAULT_EMBEDDING_MODEL,
            "ollama_url": settings.OLLAMA_URL
        },
        "available_models": ollama_models
    }
