from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pytesseract
import requests

from api.ocr import router as ocr_router
from api.transcribe import router as transcribe_router
from api.simulation import router as simulation_router
from utils.whisper_utils import whisper_model

app = FastAPI(title="FinBridge OCR & Transcription Service")

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ocr_router, prefix="/api", tags=["OCR"])
app.include_router(transcribe_router, prefix="/api", tags=["Transcription"])
app.include_router(simulation_router, prefix="/api/simulation", tags=["Simulation"])


@app.get("/")
async def root():
    return {
        "service": "FinBridge OCR & Transcription Service",
        "version": "3.1",
        "status": "running",
        "features": [
            "Ollama vision model (gemma3) as primary OCR",
            "Multi-config Tesseract as OCR fallback",
            "Whisper audio transcription (offline)",
            "Edge case handling",
            "Smart name extraction",
            "10-digit phone normalization",
            "Email validation",
            "Sales Intelligence Simulation (RAG + Gemma 3)"
        ],
        "endpoints": {
            "ocr": "/api/ocr",
            "transcribe": "/api/transcribe",
            "simulate": "/api/simulation/simulate",
            "embed": "/api/simulation/embed",
            "health": "/health"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        tesseract_version = pytesseract.get_tesseract_version()
        
        # Check Ollama
        ollama_available = False
        try:
            resp = requests.get("http://127.0.0.1:11434/api/tags", timeout=2)
            ollama_available = resp.status_code == 200
        except:
            pass
        
        return {
            "status": "healthy",
            "tesseract": {
                "available": True,
                "version": str(tesseract_version)
            },
            "ollama": {
                "available": ollama_available,
                "model": "gemma3:4b" if ollama_available else "not checked"
            },
            "whisper": {
                "available": whisper_model is not None,
                "model": "faster-whisper-base" if whisper_model else "not loaded",
                "device": whisper_model.device if whisper_model else "N/A"
            }
        }
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
