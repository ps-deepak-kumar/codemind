import os
import tempfile
import pytest
from app.services.parser_service import ParserService

def test_parse_python_file():
    code = """
class DatabaseManager:
    def __init__(self, url):
        self.url = url
        
    def connect(self):
        return True

def create_app():
    return "app"
"""
    with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w", encoding="utf-8") as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name
        
    try:
        chunks = ParserService.parse_file(temp_file_path, "db_manager.py", "Python")
        
        # We expect:
        # 1. Class "DatabaseManager"
        # 2. Method "DatabaseManager.__init__" or similar
        # 3. Method "DatabaseManager.connect" or similar
        # 4. Function "create_app"
        
        assert len(chunks) >= 3
        
        types = [c["type"] for c in chunks]
        names = [c["name"] for c in chunks]
        
        assert "class" in types
        assert "method" in types
        assert "function" in types
        
        assert "DatabaseManager" in names
        assert "DatabaseManager.connect" in names
        assert "create_app" in names
        
    finally:
        os.remove(temp_file_path)
