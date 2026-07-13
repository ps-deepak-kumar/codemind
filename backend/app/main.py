import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.db import engine, Base
from app.api.routes import repos, chat, settings as settings_route

# Initialize Database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development we allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Routers
app.include_router(repos.router, prefix=f"{settings.API_V1_STR}/repos", tags=["Repositories"])
app.include_router(chat.router, prefix=f"{settings.API_V1_STR}/chat", tags=["Chat"])
app.include_router(settings_route.router, prefix=f"{settings.API_V1_STR}/settings", tags=["Settings"])

@app.get("/health")
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
