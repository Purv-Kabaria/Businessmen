"""
Export Cardiff NLP Twitter-RoBERTa sentiment model to ONNX and INT8.
Produces models/sentiment-int8.onnx for SentimentEngine (CPU, low latency).

Requires: pip install torch transformers optimum[onnxruntime] onnxruntime

Run from python_backend:  python scripts/export_sentiment_onnx.py
"""
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
MODELS_DIR = BACKEND_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"
INT8_PATH = MODELS_DIR / "sentiment-int8.onnx"


def main():
    print("Exporting sentiment model to ONNX INT8...")
    print(f"  Model: {MODEL_NAME}")
    print(f"  Output: {INT8_PATH}\n")

    # 1) Export to ONNX (FP32) with Optimum
    try:
        from optimum.onnxruntime import ORTModelForSequenceClassification
        from transformers import AutoTokenizer
    except ImportError as e:
        print("Install: pip install torch transformers optimum[onnxruntime] onnxruntime")
        sys.exit(1)

    print("[1/2] Exporting to ONNX (FP32)...")
    ort_model = ORTModelForSequenceClassification.from_pretrained(MODEL_NAME, export=True)
    ort_model.save_pretrained(MODELS_DIR)
    AutoTokenizer.from_pretrained(MODEL_NAME).save_pretrained(MODELS_DIR)

    onnx_fp32 = MODELS_DIR / "model.onnx"
    if not onnx_fp32.exists():
        candidates = list(MODELS_DIR.glob("*.onnx"))
        onnx_fp32 = candidates[0] if candidates else None
    if not onnx_fp32 or not onnx_fp32.exists():
        print("No .onnx file found in", MODELS_DIR)
        sys.exit(1)

    # 2) Dynamic INT8 quantization
    print("[2/2] Quantizing to INT8...")
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except ImportError:
        print("Falling back: keeping FP32 as model.onnx. For INT8 install onnxruntime and re-run.")
        print("SentimentEngine looks for sentiment-int8.onnx; you can symlink or rename model.onnx for testing.")
        sys.exit(0)

    quantize_dynamic(
        model_input=str(onnx_fp32),
        model_output=str(INT8_PATH),
        weight_type=QuantType.QInt8,
        op_types_to_quantize=["MatMul", "Gemm", "Attention"],
        extra_options={"WeightSymmetric": True, "ActivationSymmetric": True},
    )
    print(f"\nDone. Use {INT8_PATH} with SentimentEngine.")
    print("Tokenizer: cardiffnlp/twitter-roberta-base-sentiment-latest (HuggingFace).")


if __name__ == "__main__":
    main()
