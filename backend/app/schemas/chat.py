from pydantic import BaseModel, Field
from typing import List, Optional

class ChatQuery(BaseModel):
    repository_id: int
    query: str
    llm_model: Optional[str] = None
    embedding_model: Optional[str] = None
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    temperature: Optional[float] = Field(default=0.2, ge=0.0, le=2.0)
    mode: Optional[str] = "default"

class SourceNode(BaseModel):
    file_path: str
    language: Optional[str] = None
    chunk_type: str
    name: Optional[str] = None
    start_line: int
    end_line: int
    content: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceNode]
