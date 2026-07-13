import json
import httpx
from typing import Generator
from app.config import settings

class LLMService:

    @classmethod
    def generate_chat_stream(
        cls,
        messages: list,
        model: str = settings.DEFAULT_LLM_MODEL,
        temperature: float = 0.2
    ) -> Generator[str, None, None]:
        """
        Sends a chat request to Ollama and streams the response tokens back.
        """
        url = f"{settings.OLLAMA_URL}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "options": {
                "temperature": temperature
            },
            "stream": True
        }
        
        try:
            # We call the Ollama API using a streaming request
            with httpx.stream("POST", url, json=payload, timeout=60.0) as response:
                if response.status_code != 200:
                    yield f"Error calling Ollama LLM: HTTP {response.status_code}\n"
                    return
                    
                for line in response.iter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            yield token
                    except Exception as e:
                        print(f"Error parsing token line: {line} | {e}")
                        continue
        except Exception as e:
            yield f"\n[Error connecting to local Ollama server: {e}].\n"
            yield "Please ensure Ollama is running (`ollama serve`) and you have pulled the model (`ollama pull qwen3:8b`)."

    @classmethod
    def generate_chat_static(
        cls,
        messages: list,
        model: str = settings.DEFAULT_LLM_MODEL,
        temperature: float = 0.2
    ) -> str:
        """
        Sends a static request to Ollama and returns the complete text response.
        """
        url = f"{settings.OLLAMA_URL}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "options": {
                "temperature": temperature
            },
            "stream": False
        }
        
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json().get("message", {}).get("content", "")
                else:
                    return f"Error: LLM request failed with HTTP {resp.status_code}"
        except Exception as e:
            return f"Error connecting to Ollama: {e}. Make sure Ollama is running."
