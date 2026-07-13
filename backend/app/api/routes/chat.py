import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.database import models
from app.schemas import chat as schemas
from app.services.vector_service import VectorService
from app.services.llm_service import LLMService
from app.config import settings

router = APIRouter()

def build_messages(query: str, chunks: list, mode: str = "default") -> list:
    """
    Constructs the system and user messages incorporating retrieved code snippets.
    """
    context_str = ""
    for idx, c in enumerate(chunks):
        context_str += f"\n--- CODE SNIPPET {idx+1} ---\n"
        context_str += f"File: {c['file_path']} | Lines: {c['start_line']}-{c['end_line']}"
        if c['name']:
            context_str += f" | Symbol: {c['name']}"
        context_str += f"\n{c['content']}\n"
        context_str += "---------------------\n"

    if mode == "teacher":
        system_prompt = (
            "You are CodeMind Tutor, an expert AI Codebase Teacher & Mentor. "
            "Your task is to teach the student about the provided source code repository in depth.\n\n"
            "TEACHER GUIDELINES:\n"
            "1. Explain the concepts, logic, and patterns in the code step-by-step, as if teaching a student from scratch.\n"
            "2. Make your explanation engaging, thorough, and easy to understand. Break down complex classes/functions.\n"
            "3. Provide illustrative examples, explain 'why' the code was written this way, and discuss design patterns.\n"
            "4. If the student is preparing for an interview or studying this codebase, highlight key questions an interviewer might ask about this specific code (e.g. performance, edge cases, thread safety) and provide model answers.\n"
            "5. Point out specific files, class names, functions, and lines of code.\n"
            "6. Answer using the provided code snippets (context) as your source of truth. If the context does not contain enough info, clearly state it.\n\n"
            "RELEVANT CODE SNIPPETS:\n"
            f"{context_str}"
        )
    else:
        system_prompt = (
            "You are CodeMind, an expert AI Codebase Assistant. "
            "Your task is to answer questions about the provided source code repository.\n\n"
            "GUIDELINES:\n"
            "1. Answer the question using ONLY the provided code snippets (context) as your source of truth.\n"
            "2. If the context does not contain enough information to answer the question, state that clearly.\n"
            "3. Explain the code clearly. Point out specific files, class names, functions, and lines of code.\n"
            "4. Output code blocks using markdown formatting with correct syntax highlighting.\n\n"
            "RELEVANT CODE SNIPPETS:\n"
            f"{context_str}"
        )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": query}
    ]

@router.post("/", response_model=schemas.ChatResponse)
def ask_question(
    payload: schemas.ChatQuery,
    db: Session = Depends(get_db)
):
    # Verify repository exists
    repo = db.query(models.Repository).filter(models.Repository.id == payload.repository_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    # 1. Retrieve relevant chunks from local database / search
    top_k = payload.top_k or 5
    chunks = VectorService.search_relevant_chunks(
        repo_id=payload.repository_id,
        query=payload.query,
        top_k=top_k
    )
    
    # 2. Build prompt messages
    messages = build_messages(payload.query, chunks, payload.mode or "default")
    
    # 3. Call LLM
    answer = LLMService.generate_chat_static(
        messages=messages,
        model=payload.llm_model or settings.DEFAULT_LLM_MODEL,
        temperature=payload.temperature or 0.2
    )
    
    # 4. Format sources
    sources = []
    for c in chunks:
        sources.append(schemas.SourceNode(
            file_path=c["file_path"],
            chunk_type=c["chunk_type"],
            name=c["name"],
            start_line=c["start_line"],
            end_line=c["end_line"],
            content=c["content"]
        ))
        
    return schemas.ChatResponse(answer=answer, sources=sources)

@router.post("/stream")
def ask_question_stream(
    payload: schemas.ChatQuery,
    db: Session = Depends(get_db)
):
    # Verify repository exists
    repo = db.query(models.Repository).filter(models.Repository.id == payload.repository_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    # 1. Retrieve relevant chunks from local database / search
    top_k = payload.top_k or 5
    chunks = VectorService.search_relevant_chunks(
        repo_id=payload.repository_id,
        query=payload.query,
        top_k=top_k
    )
    
    # 2. Build prompt messages
    messages = build_messages(payload.query, chunks, payload.mode or "default")
    
    # 3. Server Sent Events (SSE) generator
    def event_generator():
        # First send sources list to the frontend immediately so the UI can highlight them
        sources_payload = []
        for c in chunks:
            sources_payload.append({
                "file_path": c["file_path"],
                "chunk_type": c["chunk_type"],
                "name": c["name"],
                "start_line": c["start_line"],
                "end_line": c["end_line"],
                "content": c["content"]
            })
            
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources_payload})}\n\n"
        
        # Now stream the LLM tokens
        llm_stream = LLMService.generate_chat_stream(
            messages=messages,
            model=payload.llm_model or settings.DEFAULT_LLM_MODEL,
            temperature=payload.temperature or 0.2
        )
        
        for token in llm_stream:
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            
        # Send closing event
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        
    return StreamingResponse(event_generator(), media_type="text/event-stream")
