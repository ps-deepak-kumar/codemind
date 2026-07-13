import json
import math
import httpx
from app.config import settings
from app.database import models
from app.database.db import SessionLocal

class VectorService:

    _client = None

    @classmethod
    def get_client(cls) -> httpx.Client:
        """
        Retrieves or initializes a thread-safe persistent httpx.Client with configured connection pooling limits.
        """
        if cls._client is None:
            limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
            cls._client = httpx.Client(timeout=30.0, limits=limits)
        return cls._client

    @classmethod
    def get_embedding(cls, text: str, model: str = settings.DEFAULT_EMBEDDING_MODEL) -> list:
        """
        Generates a vector embedding using Ollama's local embeddings API.
        If Ollama is not running, returns a fallback zero vector (length 768) to prevent crashes.
        """
        try:
            client = cls.get_client()
            resp = client.post(
                f"{settings.OLLAMA_URL}/api/embeddings",
                json={"model": model, "prompt": text}
            )
            if resp.status_code == 200:
                return resp.json()["embedding"]
            else:
                print(f"Ollama embedding request failed: {resp.text}")
                return [0.0] * 768
        except Exception as e:
            # Fallback mock embedding if Ollama is not running
            print(f"Ollama embedding failed ({e}). Returning zero vector for offline mode.")
            return [0.0] * 768

    @classmethod
    def index_chunks(cls, repo_id: int, chunks: list):
        """
        Generates embeddings for code chunks in parallel and saves them directly to the SQLite database.
        This pure-Python solution avoids native binary (Rust/C++) issues with Python 3.14.
        """
        from concurrent.futures import ThreadPoolExecutor

        def _embed_single_chunk(c):
            # Construct context-rich text for embedding
            context_header = f"File: {c.file_path} | Type: {c.chunk_type}"
            if c.name:
                context_header += f" | Name: {c.name}"
            
            rich_content = f"{context_header}\n\n{c.content}"
            
            # Embed
            vector = cls.get_embedding(rich_content)
            
            # Store serialized embedding vector in SQLite Chunk model
            c.embedding = json.dumps(vector)

        # Generate embeddings in parallel using up to 16 threads
        max_workers = min(16, len(chunks) or 1)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # list() forces execution of the map generator, blocking until all threads complete
            list(executor.map(_embed_single_chunk, chunks))

    @classmethod
    def delete_repository_vectors(cls, repo_id: int):
        """
        Deletes vector records. Cascade delete in SQLAlchemy handles this 
        by deleting chunks automatically when Repository is deleted from DB.
        """
        pass

    @classmethod
    def search_relevant_chunks(cls, repo_id: int, query: str, top_k: int = 5) -> list:
        """
        Performs vector similarity search (cosine similarity) in Python.
        Queries chunks from SQLite database and calculates scores.
        """
        db = SessionLocal()
        try:
            # 1. Fetch all chunks for this repo that have embeddings
            db_chunks = db.query(models.Chunk).filter(
                models.Chunk.repository_id == repo_id,
                models.Chunk.embedding.isnot(None)
            ).all()
            
            if not db_chunks:
                return []
                
            # 2. Get embedding vector for query
            query_vector = cls.get_embedding(query)
            
            # 3. Calculate cosine similarity in Python
            results = []
            for chunk in db_chunks:
                try:
                    chunk_vector = json.loads(chunk.embedding)
                    score = cls.cosine_similarity(query_vector, chunk_vector)
                    results.append((score, chunk))
                except Exception as e:
                    print(f"Error loading embedding for chunk {chunk.id}: {e}")
                    continue
                    
            # 4. Sort results descending by score and pick top K
            results.sort(key=lambda x: x[0], reverse=True)
            top_results = results[:top_k]
            
            # 5. Format results to standard return node structures
            nodes = []
            for score, chunk in top_results:
                nodes.append({
                    "file_path": chunk.file_path,
                    "chunk_type": chunk.chunk_type,
                    "name": chunk.name,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "content": chunk.content,
                    "score": round(score, 4)
                })
            return nodes
        finally:
            db.close()

    @staticmethod
    def cosine_similarity(v1: list, v2: list) -> float:
        """
        Computes cosine similarity between two numeric vectors.
        """
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
            
        dot_product = 0.0
        norm_a = 0.0
        norm_b = 0.0
        
        for a, b in zip(v1, v2):
            dot_product += a * b
            norm_a += a * a
            norm_b += b * b
            
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
            
        return dot_product / (math.sqrt(norm_a) * math.sqrt(norm_b))
