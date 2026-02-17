"""
High-performance Sentiment Analysis & Summarization Microservice.
FastAPI REST API; sentiment (ONNX) and summarization (FlashRank + Gemma) run in parallel.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Paths: sentiment = ONNX (export script provided); summary = Ollama (Gemma 3 in Docker)
MODELS_DIR = Path(__file__).resolve().parent / "models"
SENTIMENT_ONNX = Path(__file__).resolve().parent / "models" / "sentiment-int8.onnx"

_sentiment_engine = None
_summary_engine = None
_executor = ThreadPoolExecutor(max_workers=4)


def get_sentiment_engine():
    global _sentiment_engine
    if _sentiment_engine is None:
        from services.sentiment_engine import SentimentEngine
        path = SENTIMENT_ONNX
        if not path.is_file():
            raise FileNotFoundError(f"Sentiment ONNX model not found at {path}")
        _sentiment_engine = SentimentEngine(
            model_path=str(path),
            tokenizer_name="cardiffnlp/twitter-roberta-base-sentiment-latest",
        )
    return _sentiment_engine


def get_summary_engine():
    global _summary_engine
    if _summary_engine is None:
        from services.summary_engine import SummaryEngine
        _summary_engine = SummaryEngine()  # uses OLLAMA_HOST / gemma3:4b
    return _summary_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Optional: preload on startup to fail fast
    try:
        get_sentiment_engine()
    except Exception as e:
        print(f"[Startup] Sentiment engine not loaded: {e}")
    try:
        get_summary_engine()
    except Exception as e:
        print(f"[Startup] Summary engine (Ollama) not loaded: {e}")
    yield
    _executor.shutdown(wait=True)


app = FastAPI(
    title="Sentiment & Summary Microservice",
    description="ONNX sentiment + FlashRank + Gemma 3 4B (GBNF) summarization",
    lifespan=lifespan,
)


class AnalyzeBody(BaseModel):
    transcript: Optional[str] = Field(None, description="Full transcript text")
    segments: Optional[List[str]] = Field(None, description="List of text segments (alternative to transcript)")

    class Config:
        extra = "forbid"


class AnalyzeResponse(BaseModel):
    sentiment: Optional[Dict[str, Any]] = None
    sentiments: Optional[List[Dict[str, Any]]] = None
    summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def _run_sentiment_segments(segments: List[str]) -> List[Dict[str, Any]]:
    engine = get_sentiment_engine()
    return engine.analyze(segments)


def _run_sentiment_transcript(transcript: str) -> List[Dict[str, Any]]:
    from utils.text_tools import chunk_text
    chunks = chunk_text(transcript, max_tokens=256)
    if not chunks:
        return []
    return _run_sentiment_segments(chunks)


def _run_summary(transcript: str) -> Dict[str, Any]:
    engine = get_summary_engine()
    return engine.generate_summary(transcript)


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeBody):
    """
    Run sentiment and summarization in parallel.
    - If "transcript" is provided: chunk it, run batched sentiment on chunks, and run summarization on full transcript.
    - If "segments" is provided: run batched sentiment on segments; summarization uses joined segments as transcript.
    """
    loop = asyncio.get_event_loop()
    errors: List[str] = []
    sentiment_result: Optional[List[Dict[str, Any]]] = None
    summary_result: Optional[Dict[str, Any]] = None

    if body.transcript:
        transcript = body.transcript.strip()
        segments_for_sentiment = None
    elif body.segments:
        segments_for_sentiment = [s.strip() for s in body.segments if s.strip()]
        transcript = " ".join(segments_for_sentiment) if segments_for_sentiment else ""
    else:
        raise HTTPException(status_code=400, detail="Provide either 'transcript' or 'segments'")

    if not transcript and not segments_for_sentiment:
        return AnalyzeResponse(
            sentiment=None,
            sentiments=[],
            summary={"summary": "", "action_items": []},
        )

    async def run_sentiment():
        nonlocal sentiment_result, errors
        try:
            if segments_for_sentiment is not None:
                sentiment_result = await loop.run_in_executor(
                    _executor,
                    _run_sentiment_segments,
                    segments_for_sentiment,
                )
            else:
                sentiment_result = await loop.run_in_executor(
                    _executor,
                    _run_sentiment_transcript,
                    transcript,
                )
        except Exception as e:
            errors.append(f"sentiment: {e!s}")

    async def run_summary():
        nonlocal summary_result, errors
        if not transcript:
            summary_result = {"summary": "", "action_items": []}
            return
        try:
            summary_result = await loop.run_in_executor(
                _executor,
                _run_summary,
                transcript,
            )
        except Exception as e:
            errors.append(f"summary: {e!s}")
            summary_result = {"summary": "", "action_items": [], "error": str(e)}

    await asyncio.gather(run_sentiment(), run_summary())

    return AnalyzeResponse(
        sentiment=None,
        sentiments=sentiment_result,
        summary=summary_result,
        error="; ".join(errors) if errors else None,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
