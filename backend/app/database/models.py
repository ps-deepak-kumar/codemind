import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.db import Base

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String, unique=True, index=True)
    path = Column(String)
    size = Column(Integer, default=0)  # In bytes
    status = Column(String, default="cloning")  # cloning, parsing, indexing, ready, error
    error_message = Column(Text, nullable=True)
    total_files = Column(Integer, default=0)
    indexed_files = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    languages = Column(Text, default="{}")  # JSON string of language statistics
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    files = relationship("File", back_populates="repository", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="repository", cascade="all, delete-orphan")

class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    path = Column(String, index=True)  # Relative path in repo
    language = Column(String, nullable=True)
    size = Column(Integer, default=0)
    indexed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    repository = relationship("Repository", back_populates="files")
    chunks = relationship("Chunk", back_populates="file", cascade="all, delete-orphan")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, index=True)
    chunk_type = Column(String)  # function, class, module, block
    name = Column(String, nullable=True)  # Class or function name
    content = Column(Text)
    start_line = Column(Integer)
    end_line = Column(Integer)
    vector_id = Column(String, unique=True, index=True)  # Links to database search
    embedding = Column(Text, nullable=True)  # JSON string of float list (embedding vector)

    repository = relationship("Repository", back_populates="chunks")
    file = relationship("File", back_populates="chunks")
