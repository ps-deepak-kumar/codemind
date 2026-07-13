import os
import pytest
from app.database.db import engine, Base, SessionLocal
from app.database import models
from app.services.vector_service import VectorService
from app.config import settings

def test_sqlite_vector_indexing_and_search():
    # Make sure we use a temporary SQLite DB for testing
    test_db_url = "sqlite:///./test_vector_store.db"
    original_db_url = settings.DATABASE_URL
    settings.DATABASE_URL = test_db_url
    
    # Re-bind engine for testing
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    
    # Create tables
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    db = TestingSessionLocal()
    try:
        # Create a repo
        repo = models.Repository(name="test_repo", url="https://github.com/test/repo", status="indexing")
        db.add(repo)
        db.commit()
        db.refresh(repo)
        
        # Create a file
        file = models.File(repository_id=repo.id, path="auth.py", language="Python", size=100)
        db.add(file)
        db.commit()
        db.refresh(file)
        
        # Create chunks
        chunk1 = models.Chunk(
            repository_id=repo.id,
            file_id=file.id,
            file_path=file.path,
            chunk_type="function",
            name="verify_jwt",
            content="def verify_jwt(token):\n    return token",
            start_line=1,
            end_line=2,
            vector_id="vec_1"
        )
        
        chunk2 = models.Chunk(
            repository_id=repo.id,
            file_id=file.id,
            file_path=file.path,
            chunk_type="function",
            name="connect_db",
            content="def connect_db():\n    return engine.connect()",
            start_line=5,
            end_line=6,
            vector_id="vec_2"
        )
        
        db.add_all([chunk1, chunk2])
        db.commit()
        
        # Index chunks (generates embeddings, updates Chunk models)
        VectorService.index_chunks(repo_id=repo.id, chunks=[chunk1, chunk2])
        db.commit()
        
        # Override VectorService database search to use our test DB by hacking SessionLocal
        import app.services.vector_service as vs_mod
        original_session = vs_mod.SessionLocal
        vs_mod.SessionLocal = TestingSessionLocal
        
        try:
            # Search relevant chunks
            results = VectorService.search_relevant_chunks(repo_id=repo.id, query="how to decode jwt token?", top_k=2)
            
            assert len(results) == 2
            names = [r["name"] for r in results]
            assert "verify_jwt" in names
            assert "connect_db" in names
        finally:
            vs_mod.SessionLocal = original_session
            
    finally:
        db.close()
        # Cleanup test DB file
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()
        if os.path.exists("./test_vector_store.db"):
            os.remove("./test_vector_store.db")
        settings.DATABASE_URL = original_db_url
