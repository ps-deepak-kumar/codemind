import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database.db import get_db
from app.database import models
from app.schemas import repos as schemas
from app.services.git_service import GitService

router = APIRouter()

# We will implement the background indexing task in Phase 3/4. For now, we stub it.
def index_repo_task(repo_id: int):
    # This will be replaced with actual pipeline execution.
    pass

@router.post("/", response_model=schemas.RepositoryResponse)
def add_repository(
    payload: schemas.RepositoryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # Check if already exists
    existing = db.query(models.Repository).filter(models.Repository.url == payload.url).first()
    if existing:
        raise HTTPException(status_code=400, detail="Repository already exists")
        
    repo_name = payload.url.rstrip("/").split("/")[-1]
    if repo_name.endswith(".git"):
        repo_name = repo_name[:-4]
        
    # Create database entry
    repo = models.Repository(
        name=repo_name,
        url=payload.url,
        status="cloning",
        languages="{}"
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    
    # We will trigger the background cloning and indexing task
    background_tasks.add_task(clone_and_index_pipeline, repo.id)
    
    # Schema validator automatically parses the languages JSON string
    return schemas.RepositoryResponse.from_orm(repo)

@router.get("/", response_model=List[schemas.RepositoryResponse])
def list_repositories(db: Session = Depends(get_db)):
    repos = db.query(models.Repository).all()
    # Schema validator automatically parses the languages JSON string for each repo
    return [schemas.RepositoryResponse.from_orm(r) for r in repos]

@router.get("/{repo_id}", response_model=schemas.RepoDetailResponse)
def get_repository(repo_id: int, db: Session = Depends(get_db)):
    repo = db.query(models.Repository).filter(models.Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    files = db.query(models.File).filter(models.File.repository_id == repo_id).all()
    
    return schemas.RepoDetailResponse(
        repository=schemas.RepositoryResponse.from_orm(repo),
        files=[schemas.FileResponse.from_orm(f) for f in files]
    )

@router.get("/{repo_id}/file")
def get_file_content(repo_id: int, path: str, db: Session = Depends(get_db)):
    repo = db.query(models.Repository).filter(models.Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    if not repo.path:
        raise HTTPException(status_code=400, detail="Repository is not cloned")
        
    # Standard security check for path traversal
    normalized_repo_path = os.path.normpath(repo.path)
    safe_path = os.path.normpath(os.path.join(repo.path, path))
    if not safe_path.startswith(normalized_repo_path):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if not os.path.exists(safe_path) or os.path.isdir(safe_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        with open(safe_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{repo_id}")
def delete_repository(repo_id: int, db: Session = Depends(get_db)):
    repo = db.query(models.Repository).filter(models.Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    # Delete from disk
    if repo.path:
        GitService.delete_repository(repo.path)
        
    # Delete vectors from ChromaDB (to be integrated)
    try:
        from app.services.vector_service import VectorService
        VectorService.delete_repository_vectors(repo_id)
    except Exception:
        pass
        
    # Delete from db (cascade will delete files and chunks)
    db.delete(repo)
    db.commit()
    return {"status": "success", "message": "Repository deleted"}

@router.post("/{repo_id}/refresh", response_model=schemas.RepositoryResponse)
def refresh_repository(
    repo_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    repo = db.query(models.Repository).filter(models.Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    repo.status = "cloning"
    repo.error_message = None
    db.commit()
    db.refresh(repo)
    
    background_tasks.add_task(clone_and_index_pipeline, repo.id)
    return schemas.RepositoryResponse.from_orm(repo)


# Pipeline skeleton to be detailed in Phase 3
def clone_and_index_pipeline(repo_id: int):
    # This is a circular import wrapper or lazy import
    from app.services.vector_service import VectorService
    from app.services.parser_service import ParserService
    from app.database.db import SessionLocal
    
    db = SessionLocal()
    repo = db.query(models.Repository).filter(models.Repository.id == repo_id).first()
    if not repo:
        db.close()
        return
        
    try:
        # Step 1: Clone
        repo.status = "cloning"
        db.commit()
        
        local_path = GitService.clone_repository(repo.url)
        repo.path = local_path
        db.commit()
        
        # Step 2: Stats collection
        stats = GitService.get_repository_stats(local_path)
        repo.size = stats["total_size"]
        repo.total_files = stats["total_files"]
        repo.languages = json.dumps(stats["languages"])
        
        # Save files to database (clear old ones if refreshing)
        db.query(models.File).filter(models.File.repository_id == repo_id).delete()
        
        file_models = [
            models.File(
                repository_id=repo_id,
                path=f["path"],
                language=f["language"],
                size=f["size"],
                indexed=False
            )
            for f in stats["files"]
        ]
        db.add_all(file_models)
        db.commit()  # single commit for all file rows
        
        # Step 3: Parse — run all files in parallel threads
        repo.status = "parsing"
        db.commit()
        
        db_files = db.query(models.File).filter(models.File.repository_id == repo_id).all()
        
        # Helper: parse one file and return (db_file, chunks)
        def _parse_file(db_file):
            file_full_path = os.path.join(local_path, db_file.path)
            try:
                chunks = ParserService.parse_file(file_full_path, db_file.path, db_file.language)
                return db_file, chunks
            except Exception as e:
                print(f"Error parsing file {db_file.path}: {e}")
                return db_file, []

        all_chunk_models = []
        total_chunks = 0
        indexed_files_count = 0

        max_workers = min(8, len(db_files) or 1)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(_parse_file, f): f for f in db_files}
            for future in as_completed(futures):
                db_file, chunks = future.result()
                if chunks:
                    for idx, c in enumerate(chunks):
                        vector_id = f"repo_{repo_id}_file_{db_file.id}_chunk_{idx}"
                        all_chunk_models.append(models.Chunk(
                            repository_id=repo_id,
                            file_id=db_file.id,
                            file_path=db_file.path,
                            chunk_type=c["type"],
                            name=c["name"],
                            content=c["content"],
                            start_line=c["start_line"],
                            end_line=c["end_line"],
                            vector_id=vector_id
                        ))
                    db_file.indexed = True
                    total_chunks += len(chunks)
                    indexed_files_count += 1

        # Batch insert all chunks in one shot
        db.add_all(all_chunk_models)
        repo.total_chunks = total_chunks
        repo.indexed_files = indexed_files_count
        db.commit()  # single commit for all chunks
        
        # Step 4: Embed — generate vectors in parallel then store
        repo.status = "indexing"
        db.commit()
        
        chunks_to_index = db.query(models.Chunk).filter(models.Chunk.repository_id == repo_id).all()
        if chunks_to_index:
            VectorService.index_chunks(repo_id, chunks_to_index)
            db.commit()  # persist embeddings
            
        repo.status = "ready"
        db.commit()
        
    except Exception as e:
        repo.status = "error"
        repo.error_message = str(e)
        db.commit()
    finally:
        db.close()
