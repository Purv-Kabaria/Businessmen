# Sentiment Analysis & Summarization Strategy

This document describes how we achieve **best accuracy with minimal latency** for sentiment and summarization so the product stands out.

---

## 1. Sentiment & Emotion Pipeline

### Design goals

- **Accuracy**: Use proven models (Twitter-RoBERTa for conversational sentiment, GoEmotions for fine-grained emotions).
- **Latency**: Run all analyses in parallel so wall-clock time is dominated by the slowest single task, not the sum.

### Implementation

- **Text analyses run in parallel** (same process, thread pool):
  - **Overall sentiment** (positive/neutral/negative): `cardiffnlp/twitter-roberta-base-sentiment-latest` — strong for social/conversational text.
  - **Fine-grained emotions** (joy, anger, optimism, etc.): `SamLowe/roberta-base-go_emotions` (28 labels).
  - **Sentiment flow**: Same sentiment model, **batch inference** over all transcript segments for trajectory visualization.
- **Audio SER and text run in parallel**: Speech Emotion Recognition (Wav2Vec2-based) runs in a separate thread from the three text analyses. Total sentiment phase latency ≈ `max(text_analyses, SER)` instead of sum.
- **SER multi-window for long audio**: For calls longer than ~15s we sample three chunks (start, middle, end), run SER on each, and aggregate scores (average per emotion, then primary = argmax). This avoids “first 20s only” bias and improves accuracy for long conversations.

### Where it runs

- `utils/sentiment_engine.py`: `run_sentiment_and_ser_parallel(full_text, segments, audio_path)` is the single entry point used by the transcribe pipeline.
- Transcribe calls it after Whisper and hotspots; results are attached to the transcript response.

### Possible future improvements

- **ONNX**: Use `optimum-onnx` with `ORTModelForSequenceClassification` for sentiment/emotion to get 1.5–3× faster CPU inference with minimal accuracy loss.
- **Lighter SER**: If SER latency is still high, consider a distilled model (e.g. Wav2Small-style) for an optional “fast SER” mode.

---

## 2. Summarization

### Design goals

- **Accuracy**: Long documents are hard for LLMs (“lost-in-the-middle”); we avoid feeding the whole transcript when it’s long.
- **Latency**: Reduce tokens sent to the LLM so summary returns faster and cost stays low.

### Implementation: hybrid extractive + abstractive

- **Short text** (≤ ~2500 chars): Sent directly to Ollama (e.g. Gemma) for one-paragraph abstractive summary.
- **Long text** (> 2500 chars):
  1. **Extractive step**: Split into sentences, embed with the same model used for simulation (`all-MiniLM-L6-v2`), compute centroid of sentence embeddings, rank sentences by similarity to centroid, take top-k (e.g. 8) sentences in document order. This yields a ~800–1200 char “key sentences” summary.
  2. **Abstractive step**: Send only this reduced text to Ollama. The LLM sees the most central content, so the summary is more faithful and inference is faster.

If Ollama is down or errors, long-text path falls back to returning the extractive summary (no LLM).

### Where it runs

- `utils/llm_utils.py`: `extractive_summary()`, `generate_summary()` (hybrid).
- `/api/summarize` and any caller that asks for a transcript summary.

### Tuning

- `EXTRACTIVE_THRESHOLD_CHARS`: above this length we use hybrid (default 2500).
- `EXTRACTIVE_MAX_SENTENCES`: number of sentences to keep in extractive step (default 8).
- `EXTRACTIVE_TARGET_CHARS`: fallback truncation length if extractive fails (default 1200).

---

## 3. End-to-end transcribe latency

Rough order of operations:

1. Preprocess + segment audio  
2. Whisper per segment  
3. Hotspots (LLM)  
4. **Sentiment phase**: `run_sentiment_and_ser_parallel` (text sentiment + emotions + flow in parallel with SER)  
5. Return transcript + sentiment + flow + SER

Summary is **not** in the transcribe pipeline; it’s on demand via `/api/summarize`. When the user requests a summary, hybrid summarization keeps latency and quality acceptable even for long transcripts.

---

## 4. References

- Hugging Face Optimum ONNX: [text-classification pipeline](https://huggingface.co/docs/optimum/en/onnxruntime/usage_guides/pipelines).
- Extractive summarization with Sentence-BERT: centroid / similarity ranking.
- SER: multi-window aggregation for long audio; Wav2Vec2-based SER (e.g. SUPERB) for accuracy.
