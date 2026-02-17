from sentence_transformers import SentenceTransformer
import numpy as np

# Singleton to load model once
_model = None

def get_model():
    global _model
    if _model is None:
        print("[Embeddings] Loading SentenceTransformer model...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        print("[Embeddings] Model loaded.")
    return _model

def generate_embeddings(texts: list) -> np.ndarray:
    """
    Generate embeddings for a list of texts.
    Returns a numpy array of shape (len(texts), 384).
    """
    model = get_model()
    embeddings = model.encode(texts)
    return embeddings

def get_dimension() -> int:
    return 384  # Dimension for all-MiniLM-L6-v2
