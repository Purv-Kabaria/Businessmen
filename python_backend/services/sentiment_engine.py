"""
High-performance Sentiment Engine using ONNX Runtime (INT8) with batched inference.
No PyTorch at inference time; numpy for softmax.
"""
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np

try:
    import onnxruntime as ort
except ImportError as e:
    raise ImportError("onnxruntime is required for SentimentEngine. Install with: pip install onnxruntime") from e


# Tokenizer: use tokenizers/transformers only for tokenization (no torch model load)
def _get_tokenizer(tokenizer_name: str):
    try:
        from transformers import AutoTokenizer
        return AutoTokenizer.from_pretrained(tokenizer_name)
    except Exception as e:
        raise RuntimeError(f"Failed to load tokenizer '{tokenizer_name}': {e}") from e


class SentimentEngine:
    """
    ONNX-based sentiment analysis with batched inference.
    Expects a quantized RoBERTa-style classifier (logits shape [batch, num_labels]).
    """

    LABELS = ("negative", "neutral", "positive")

    def __init__(
        self,
        model_path: str = "models/sentiment-int8.onnx",
        tokenizer_name: str = "cardiffnlp/twitter-roberta-base-sentiment-latest",
        max_length: int = 512,
    ) -> None:
        """
        Load ONNX model and tokenizer.

        Args:
            model_path: Path to the .onnx file (e.g. INT8 quantized RoBERTa).
            tokenizer_name: HuggingFace tokenizer name (must match model vocab).
            max_length: Max token length per segment.
        """
        self.model_path = Path(model_path)
        self.max_length = max_length
        if not self.model_path.is_file():
            raise FileNotFoundError(f"ONNX model not found: {self.model_path}")

        self._session = ort.InferenceSession(
            str(self.model_path),
            sess_options=ort.SessionOptions(),
            providers=["CPUExecutionProvider"],
        )
        self._tokenizer = _get_tokenizer(tokenizer_name)

        # Infer output name (usually "logits" or last output)
        out = self._session.get_outputs()
        self._output_name = out[0].name if out else "logits"

    def _tokenize_batch(self, segments: List[str]) -> Dict[str, np.ndarray]:
        """Tokenize segments and return numpy inputs for ONNX."""
        enc = self._tokenizer(
            segments,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="np",
        )
        return {
            "input_ids": enc["input_ids"].astype(np.int64),
            "attention_mask": enc["attention_mask"].astype(np.int64),
        }

    @staticmethod
    def _softmax(logits: np.ndarray, axis: int = -1) -> np.ndarray:
        """Numerically stable softmax using numpy only."""
        x = logits - np.max(logits, axis=axis, keepdims=True)
        exp = np.exp(x)
        return exp / (np.sum(exp, axis=axis, keepdims=True) + 1e-9)

    def analyze(self, segments: List[str]) -> List[Dict[str, Any]]:
        """
        Run batched sentiment on a list of text segments.

        Args:
            segments: List of strings (sentences or chunks).

        Returns:
            List of dicts: [{"label": "positive"|"neutral"|"negative", "score": float, "distribution": {...}}, ...]
        """
        if not segments:
            return []

        inputs = self._tokenize_batch(segments)
        input_names = [inp.name for inp in self._session.get_inputs()]

        feed = {name: inputs.get(name) for name in input_names if name in inputs}
        if not feed:
            feed = {"input_ids": inputs["input_ids"], "attention_mask": inputs["attention_mask"]}

        try:
            logits = self._session.run([self._output_name], feed)[0]
        except Exception as e:
            raise RuntimeError(f"ONNX inference failed: {e}") from e

        # logits shape: (batch, num_labels)
        probs = self._softmax(logits.astype(np.float64), axis=-1)
        num_labels = probs.shape[-1]
        labels = self.LABELS if num_labels == 3 else [str(i) for i in range(num_labels)]

        results: List[Dict[str, Any]] = []
        for i in range(probs.shape[0]):
            row = probs[i]
            idx = int(np.argmax(row))
            label = labels[idx] if idx < len(labels) else "neutral"
            score = float(row[idx])
            distribution = {labels[j]: round(float(row[j]), 4) for j in range(min(len(labels), len(row)))}
            # Include both "label" and "sentiment" for API compatibility (transcriber expects "sentiment")
            results.append({
                "label": label,
                "sentiment": label,
                "score": round(score, 4),
                "distribution": distribution,
            })

        return results
