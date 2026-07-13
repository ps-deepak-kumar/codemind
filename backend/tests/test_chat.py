import os
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.db import Base
from app.database import models
from app.config import settings

client = TestClient(app)

def test_chat_and_stream_endpoints():
    # Make sure we use a temporary SQLite DB for testing
    test_db_url = "sqlite:///./test_chat_store.db"
    original_db_url = settings.DATABASE_URL
    settings.DATABASE_URL = test_db_url
    
    # Re-bind engine for testing
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    
    # Create tables
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    # Mock database session in main app
    from app.database.db import get_db
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    
    # Hack VectorService SessionLocal to use the test database
    import app.services.vector_service as vs_mod
    original_vs_session = vs_mod.SessionLocal
    vs_mod.SessionLocal = TestingSessionLocal
    
    db = TestingSessionLocal()
    try:
        # Create mock repository
        repo = models.Repository(
            name="test_repo",
            url="https://github.com/test/chat-repo",
            status="ready",
            languages="{}"
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)
        
        # Create mock file and chunk
        file = models.File(repository_id=repo.id, path="auth.py", language="Python", size=50, indexed=True)
        db.add(file)
        db.commit()
        db.refresh(file)
        
        chunk = models.Chunk(
            repository_id=repo.id,
            file_id=file.id,
            file_path=file.path,
            chunk_type="function",
            name="login",
            content="def login():\n    return 'success'",
            start_line=1,
            end_line=2,
            vector_id="vec_chat_1",
            embedding=json.dumps([0.1] * 768) # mock embedding
        )
        db.add(chunk)
        db.commit()
        
        # Mock LLMService calls so we run offline
        from app.services.llm_service import LLMService
        
        original_static = LLMService.generate_chat_static
        original_stream = LLMService.generate_chat_stream
        
        LLMService.generate_chat_static = lambda messages, model, temperature: "Mock static answer."
        
        def mock_stream(messages, model, temperature):
            yield "Mock token 1. "
            yield "Mock token 2."
            
        LLMService.generate_chat_stream = mock_stream
        
        try:
            # 1. Test Static Chat Endpoint
            payload = {
                "repository_id": repo.id,
                "query": "How is authentication handled?",
                "top_k": 1,
                "temperature": 0.1
            }
            resp = client.post("/api/v1/chat/", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert "answer" in data
            assert data["answer"] == "Mock static answer."
            assert len(data["sources"]) == 1
            assert data["sources"][0]["file_path"] == "auth.py"
            
            # 2. Test Stream Chat Endpoint
            resp_stream = client.post("/api/v1/chat/stream", json=payload)
            assert resp_stream.status_code == 200
            assert "text/event-stream" in resp_stream.headers["content-type"]
            
            # Parse event stream lines (FastAPI TestClient returns strings or bytes depending on httpx)
            lines = []
            for line in resp_stream.iter_lines():
                if line:
                    if isinstance(line, bytes):
                        lines.append(line.decode("utf-8"))
                    else:
                        lines.append(line)
                        
            assert len(lines) > 0
            
            # Check for sources payload, tokens, and done event
            data_types = []
            for line in lines:
                if line.startswith("data: "):
                    event_data = json.loads(line[6:])
                    data_types.append(event_data["type"])
                    
            assert "sources" in data_types
            assert "token" in data_types
            assert "done" in data_types
            
        finally:
            # Restore original functions
            LLMService.generate_chat_static = original_static
            LLMService.generate_chat_stream = original_stream
            
    finally:
        db.close()
        # Restore VectorService session
        vs_mod.SessionLocal = original_vs_session
        app.dependency_overrides.clear()
        
        # Cleanup DB
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()
        if os.path.exists("./test_chat_store.db"):
            os.remove("./test_chat_store.db")
        settings.DATABASE_URL = original_db_url
