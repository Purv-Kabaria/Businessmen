# AI System Deep Dive: FinBridge Architecture

This document provides a technical overview of the AI systems used in FinBridge, covering OCR, Transcription, Summarization, and Strategic Simulation.

## 1. Ensemble OCR Pipeline (`python_backend/api/ocr.py`)
The OCR system uses a multi-stage "Ensemble" strategy to handle complex, blurry, or low-contrast business cards.

*   **Stage 1: Vision Pass (Gemma 3 via Ollama)**:
    *   Uses visual reasoning to infer blurry text from context (e.g., inferring `@gmail.com`).
    *   Inputs are resized to 1280px for optimal VRAM usage.
*   **Stage 2: Character Pass (Tesseract)**:
    *   Runs 4 different Page Segmentation Modes (PSMs) and 5 image preprocessing variations (Grayscale, High Contrast, Sharpened, Brightened, Inverted).
    *   Best extraction is selected by length/entropy.
*   **Stage 3: The Judge (LLM)**:
    *   Consolidates findings from Vision AI and Tesseract.
    *   Prefer Tesseract for exact character strings (Emails) and Vision for layout/hierarchy (Names/Titles).
*   **Validation & Normalization**:
    *   Custom regex for India-specific formats (+91, 10-digit).
    *   Email scoring system to filter OCR artifacts (e.g., `@` misread as `8` or `O`).

## 2. Advanced Transcription (`python_backend/api/transcribe.py`)
Powered by `faster-whisper` and manual signal processing.

*   **Signal Preprocessing**: Implements spectral gating (denoising) and RMS normalization before transcription.
*   **Smart Segmentation**: Instead of fixed-time chunks, audio is split at natural silences (min 500ms) with a 25s target. This prevents cutting words in half and improves LLM context.
*   **Multilingual Support**: Auto-detects language and transcribes with Beam Search (size 5) for accuracy.

## 3. Actionable Intelligence
*   **Hybrid Summarizer (`python_backend/utils/llm_utils.py`)**:
    *   For long transcripts (>2500 chars), an **Extractive Pass** (centroid-based clustering of sentence embeddings) reduces text to 8 central sentences.
    *   The reduced text is then fed to the LLM for high-accuracy, low-latency summarization.
*   **Sentiment Engine (`python_backend/services/sentiment_engine.py`)**:
    *   **Text**: Uses a quantized INT8 RoBERTa model (`twitter-roberta-base-sentiment-latest`) via **ONNX Runtime** for high speed (no PyTorch overhead).
    *   **Audio**: Wav2Vec2-based emotion recognition (SER) extracts vocal tone (e.g., excited, anxious).
*   **Hotspot Identification**: LLM scan of the transcript timeline to flag "Business Intelligence" moments: financial figures, brand names, and commitment promises.

## 4. Sales Simulation & RAG (`python_backend/api/simulation.py`)
Provides strategic call advice based on interaction history.

*   **Vector Database**: Uses **FAISS (FlatL2)** for local similarity search.
*   **Embeddings**: `all-MiniLM-L6-v2` (384-dimensional) via `sentence-transformers`.
*   **Strategy Generation**: A RAG pipeline that retrieves top-k previous interactions for a contact to predict likely objections, repetition risks, and suggested tactical sequences.

## 5. Automated Scheduling (`lib/google/*`)
*   **Sentiment/Intent Trap**: Classifies email replies to distinguish between general replies and "Meeting Intent".
*   **Calendar Sync**: Automatic generation of Google Meet links and calendar invitations once intent is confirmed by the LLM.

## Environment Summary
| Variable | Purpose | Default |
|----------|---------|---------|
| `WHISPER_MODEL` | Transcription size/quality | `medium` |
| `OLLAMA_HOST` | Connectivity to local LLM | `http://127.0.0.1:11434` |
| `PYTHON_BACKEND_URL` | Next.js -> Python link | `http://127.0.0.1:8000` |
| `MINIO_BUCKET` | Audio storage bucket | `interactions-audio` |
