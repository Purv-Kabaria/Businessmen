"""
Smart text chunking for context-preserving processing.
Splits by sentence boundaries to avoid breaking mid-sentence.
"""
import re
from typing import List


def _estimate_tokens(text: str) -> int:
    """Rough token count: ~4 chars per token for English."""
    return max(1, len(text.strip()) // 4)


def _sentence_boundaries(text: str) -> List[tuple]:
    """Return (start, end) indices of sentences (inclusive of trailing space)."""
    if not text or not text.strip():
        return []
    pattern = re.compile(r'(?<=[.!?])\s+')
    starts = [0]
    for m in pattern.finditer(text):
        starts.append(m.end())
    starts.append(len(text))
    return [(starts[i], starts[i + 1]) for i in range(len(starts) - 1)]


def chunk_text(text: str, max_tokens: int = 256) -> List[str]:
    """
    Split text into chunks that respect sentence boundaries.
    No chunk exceeds max_tokens (estimated). Sentences are not split mid-way.

    Args:
        text: Input transcript or document.
        max_tokens: Maximum estimated tokens per chunk (default 256).

    Returns:
        List of chunk strings, each <= ~max_tokens and ending at sentence boundary.
    """
    if not text or not text.strip():
        return []

    text = text.strip()
    boundaries = _sentence_boundaries(text)
    if not boundaries:
        # No sentence boundaries: split by length
        chunk_chars = max(100, max_tokens * 4)
        return [
            text[i : i + chunk_chars].strip()
            for i in range(0, len(text), chunk_chars)
            if text[i : i + chunk_chars].strip()
        ]

    sentences: List[str] = []
    for start, end in boundaries:
        sent = text[start:end].strip()
        if sent:
            sentences.append(sent)

    if not sentences:
        return [text[: max_tokens * 4].strip()] if text else []

    chunks: List[str] = []
    current: List[str] = []
    current_tokens = 0

    for sent in sentences:
        sent_tokens = _estimate_tokens(sent)
        if current_tokens + sent_tokens > max_tokens and current:
            chunks.append(" ".join(current))
            current = []
            current_tokens = 0
        current.append(sent)
        current_tokens += sent_tokens

    if current:
        chunks.append(" ".join(current))

    return chunks
