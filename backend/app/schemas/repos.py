from pydantic import BaseModel, field_validator
from typing import Dict, List, Optional, Any
from datetime import datetime

class RepositoryCreate(BaseModel):
    url: str

class RepositoryResponse(BaseModel):
    id: int
    name: str
    url: str
    path: Optional[str] = None   # None until cloning completes
    size: int
    status: str
    error_message: Optional[str] = None
    total_files: int
    indexed_files: int
    total_chunks: int
    languages: Dict[str, float] = {}  # parsed from JSON string
    created_at: datetime
    updated_at: datetime

    @field_validator("languages", mode="before")
    @classmethod
    def parse_languages(cls, v: Any) -> Dict[str, float]:
        """Accept either a JSON string (from DB) or an already-parsed dict."""
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return {}
        if isinstance(v, dict):
            return v
        return {}

    class Config:
        from_attributes = True

class FileResponse(BaseModel):
    id: int
    repository_id: int
    path: str
    language: Optional[str] = None
    size: int
    indexed: bool

    class Config:
        from_attributes = True

class RepoDetailResponse(BaseModel):
    repository: RepositoryResponse
    files: List[FileResponse]
