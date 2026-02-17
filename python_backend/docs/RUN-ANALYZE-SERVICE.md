# Run the Sentiment & Summary Microservice (venv)

Steps to run the analyze service (`POST /analyze`) using a Python venv.  
Assumes **Ollama with Gemma 3** is already running (e.g. in Docker).

---

## 1. Create and activate venv

From the **project root** (e.g. `d:\Projects\htt_Businessmen`):

```bash
# Create venv (once)
python -m venv venv

# Activate (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Activate (Windows CMD)
.\venv\Scripts\activate.bat

# Activate (Linux / macOS)
source venv/bin/activate
```

You should see `(venv)` in the prompt.

---

## 2. Install dependencies

From the **project root** (with venv active):

```bash
# Microservice deps (no PyTorch at inference)
pip install -r python_backend/requirements-analyze.txt
```

If you hit missing deps (e.g. `transformers` needs something), install and retry.

---

## 3. Export the ONNX sentiment model (one-time)

The service expects **`python_backend/models/sentiment-int8.onnx`**. Generate it once:

```bash
# From project root, venv active
pip install torch "optimum[onnxruntime]"
cd python_backend
python scripts/export_sentiment_onnx.py
cd ..
```

This downloads the RoBERTa sentiment model, exports to ONNX, quantizes to INT8, and writes **`python_backend/models/sentiment-int8.onnx`** (and saves the tokenizer in **`python_backend/models/`**).

---

## 4. Ollama (Gemma 3)

Have Ollama running and Gemma 3 available:

```bash
# If using Docker
docker run -d -p 11434:11434 ollama/ollama
docker exec -it <container> ollama run gemma3:4b
# Or pull and run once so the model is cached
ollama run gemma3:4b
```

From the host, Ollama is usually at **`http://127.0.0.1:11434`**.  
If the analyze app runs in another container, set **`OLLAMA_HOST=http://host.docker.internal:11434`** (or the correct host/port).

---

## 5. Run the analyze service

From the **project root** (venv active):

```bash
cd python_backend
uvicorn main_analyze:app --host 0.0.0.0 --port 8000
```

Or from project root without `cd`:

```bash
python -m uvicorn python_backend.main_analyze:app --host 0.0.0.0 --port 8000 --app-dir python_backend
```

Service base URL: **http://localhost:8000**

- **Health:** `GET http://localhost:8000/health`
- **Analyze:** `POST http://localhost:8000/analyze` with body `{"transcript": "Your text here..."}` or `{"segments": ["s1", "s2"]}`

---

## 6. Optional env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama API base URL |
| `OLLAMA_SUMMARY_MODEL` | `gemma3:4b` | Model name for summarization |

Set in the shell before starting uvicorn, or in a `.env` in `python_backend` if you load it (e.g. with `python-dotenv`).

---

## Quick checklist

1. **venv** created and activated  
2. **pip install -r python_backend/requirements-analyze.txt**  
3. **python_backend/scripts/export_sentiment_onnx.py** run once → **models/sentiment-int8.onnx**  
4. **Ollama** running with **gemma3:4b**  
5. **uvicorn main_analyze:app --host 0.0.0.0 --port 8000** from **python_backend**
