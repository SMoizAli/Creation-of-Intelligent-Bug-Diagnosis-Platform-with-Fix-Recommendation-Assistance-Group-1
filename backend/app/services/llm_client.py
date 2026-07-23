"""LLM connection client with retry logic and heuristic fallback integration."""

import time
import httpx
from typing import Any, Dict, List, Optional
from app.config.settings import get_settings
from app.utils.logger import get_logger

logger = get_logger("services.llm_client")


class LLMClient:
    """Client for executing LLM queries with automated retries and timeout management."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def query(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 1500,
        retries: int = 2,
        backoff_factor: float = 2.0,
    ) -> str:
        """Query LLM (OpenAI, Ollama, etc.) with retries."""
        provider = self.settings.llm_provider.lower()
        api_key = self.settings.llm_api_key
        model = self.settings.llm_model

        is_dummy_key = api_key.strip().startswith("your-") or not api_key.strip().startswith("sk-")
        if provider == "openai" and (not api_key or is_dummy_key):
            logger.warning("No valid API key configured for OpenAI. Falling back to heuristic mode.")
            raise ValueError("No valid LLM API key configured.")

        # Retry loop
        for attempt in range(retries + 1):
            try:
                if provider == "openai":
                    return self._query_openai(system_prompt, user_prompt, model, api_key, temperature, max_tokens)
                elif provider == "ollama":
                    return self._query_ollama(system_prompt, user_prompt, model, temperature)
                else:
                    raise ValueError(f"Unsupported LLM provider: {provider}")
            except Exception as exc:
                # Do not retry on auth failures
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (401, 403):
                    logger.error("Authentication failed (HTTP %d). Skipping retries.", exc.response.status_code)
                    raise
                
                if attempt == retries:
                    logger.error("LLM request failed after %d retries: %s", retries, exc)
                    raise
                wait_time = backoff_factor * (attempt + 1)
                logger.warning("LLM request failed (attempt %d/%d). Retrying in %.1fs. Error: %s", attempt + 1, retries + 1, wait_time, exc)
                time.sleep(wait_time)
                
        raise RuntimeError("LLM request failed unexpectedly.")

    def _query_openai(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        api_key: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        with httpx.Client(timeout=self.settings.llm_timeout_seconds) as client:
            response = client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            if response.status_code != 200:
                logger.error("OpenAI API returned status %d: %s", response.status_code, response.text)
                response.raise_for_status()
            
            data = response.json()
            return data["choices"][0]["message"]["content"]

    def _query_ollama(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        temperature: float,
    ) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                "temperature": temperature,
            },
            "stream": False
        }
        
        # Ollama local endpoint
        url = "http://localhost:11434/api/chat"
        with httpx.Client(timeout=self.settings.llm_timeout_seconds) as client:
            response = client.post(url, json=payload)
            if response.status_code != 200:
                logger.error("Ollama API returned status %d: %s", response.status_code, response.text)
                response.raise_for_status()
            
            data = response.json()
            return data["message"]["content"]


llm_client = LLMClient()
