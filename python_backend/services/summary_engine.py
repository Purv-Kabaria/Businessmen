"""
Rerank-then-Generate summarization: FlashRank + Gemma 3 via Ollama (Docker).
All models run locally; no GGUF file required.
"""
import json
import os
import re
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional

from utils.text_tools import chunk_text


class SummaryEngine:
    """
    Rerank-then-Generate pipeline:
    1. Chunk transcript (sentence-aware).
    2. Rerank chunks with FlashRank (query: key issues and action items).
    3. Feed top 15 chunks to Gemma 3 via Ollama.
    4. Request JSON output and parse (no GBNF; prompt-based).
    """

    RERANK_QUERY = "key issues, decisions, and action items discussed"
    TOP_K_CHUNKS = 15
    CHUNK_MAX_TOKENS = 256

    def __init__(
        self,
        ollama_base_url: str = "http://127.0.0.1:11434",
        model_name: str = "gemma3:4b",
        flashrank_model: str = "ms-marco-MiniLM-L-6-v2",
        timeout: int = 120,
    ) -> None:
        """
        Load FlashRank reranker; Gemma 3 runs via Ollama (e.g. in Docker).

        Args:
            ollama_base_url: Ollama API base URL (e.g. http://host.docker.internal:11434 from another container).
            model_name: Ollama model name (e.g. gemma3:4b).
            flashrank_model: FlashRank model name.
            timeout: Seconds for Ollama /api/generate.
        """
        self.ollama_base_url = (os.environ.get("OLLAMA_HOST") or ollama_base_url).rstrip("/")
        self.model_name = os.environ.get("OLLAMA_SUMMARY_MODEL") or model_name
        self.timeout = timeout

        try:
            from flashrank import Ranker, RerankRequest
            self._RerankRequest = RerankRequest
            self._ranker = Ranker(model_name=flashrank_model)
        except ImportError as e:
            raise ImportError("flashrank is required. Install with: pip install flashrank") from e

    def _rerank_chunks(self, chunks: List[str]) -> List[str]:
        """Rank chunks by relevance to key issues and action items. Returns ordered list (best first)."""
        if not chunks:
            return []
        if len(chunks) <= self.TOP_K_CHUNKS:
            return chunks

        passages = [{"id": i, "text": c, "meta": {}} for i, c in enumerate(chunks)]
        try:
            req = self._RerankRequest(query=self.RERANK_QUERY, passages=passages)
            results = self._ranker.rerank(req)
        except Exception:
            return chunks[: self.TOP_K_CHUNKS]

        order = []
        for r in (results or [])[: self.TOP_K_CHUNKS]:
            # FlashRank may return {"id", "text", "score", "meta"} or similar
            text = r.get("text") if isinstance(r.get("text"), str) and r.get("text") else None
            if text:
                order.append(text)
                continue
            idx = 0
            raw_id = r.get("id")
            if raw_id is not None:
                try:
                    idx = int(raw_id)
                except (TypeError, ValueError):
                    idx = 0
            if 0 <= idx < len(chunks):
                order.append(chunks[idx])
        return order if order else chunks[: self.TOP_K_CHUNKS]

    def _call_ollama(self, prompt: str, max_tokens: int = 512, temperature: float = 0.2) -> str:
        """Call Ollama /api/generate; return the generated text."""
        url = f"{self.ollama_base_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        resp = requests.post(url, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        data = resp.json()
        return (data.get("response") or "").strip()

    def generate_summary(self, full_transcript: str) -> Dict[str, Any]:
        """
        Rerank-then-Generate summary; Ollama returns JSON (prompt-constrained).

        Returns:
            {"summary": "...", "action_items": ["...", ...]} (parsed from LLM output).
        """
        default_out = {"summary": "", "action_items": []}

        if not full_transcript or not full_transcript.strip():
            return default_out

        chunks = chunk_text(full_transcript.strip(), max_tokens=self.CHUNK_MAX_TOKENS)
        if not chunks:
            return default_out

        top_chunks = self._rerank_chunks(chunks)
        context = "\n\n".join(top_chunks)

        prompt = f"""Based on the following transcript excerpts (already ranked by relevance), produce a short summary and a list of action items. Output ONLY valid JSON, no other text.

Transcript excerpts:
{context}

JSON with exactly two keys: "summary" (one paragraph string) and "action_items" (array of strings). Example: {{"summary": "...", "action_items": ["Item 1", "Item 2"]}}
"""
        try:
            text = self._call_ollama(prompt, max_tokens=512, temperature=0.2)
        except requests.RequestException as e:
            return {"summary": "", "action_items": [], "error": str(e)}

        if not text:
            return default_out

        # Strip markdown code blocks (Ollama often wraps JSON in ```json ... ```)
        cleaned = text.strip()
        for marker in ("```json", "```"):
            if marker in cleaned:
                parts = cleaned.split(marker, 1)
                if len(parts) > 1:
                    cleaned = parts[1].split("```")[0].strip()
                    break

        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, dict):
                    summary_str = parsed.get("summary") or parsed.get("Summary") or ""
                    action_items = parsed.get("action_items") or parsed.get("actionItems") or parsed.get("action items") or []
                    if not isinstance(summary_str, str):
                        summary_str = str(summary_str) if summary_str is not None else ""
                    if not isinstance(action_items, list):
                        action_items = []
                    action_items = [str(x).strip() for x in action_items if x is not None and str(x).strip()]
                    return {"summary": summary_str.strip(), "action_items": action_items}
            except json.JSONDecodeError:
                pass

        # Fallback: use LLM output as summary when JSON parse failed (cap length)
        default_out["summary"] = text[:2000].strip()
        return default_out
