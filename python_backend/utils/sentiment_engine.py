from transformers import pipeline
from scipy.special import softmax
import numpy as np

# Singleton model instances
_sentiment_pipeline = None
_emotion_pipeline = None

# Using DistilRoBERTa for speed and RoBERTa for accuracy where needed
# Dataset: Twitter-roberta-base-sentiment-latest (trained on ~58M tweets). Gold standard for social/conversational.
# Dataset: GoEmotions (Reddit comments, 28 labels). Excellent for nuanced emotion.
SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
EMOTION_MODEL = "SamLowe/roberta-base-go_emotions"

def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        print(f"[Sentiment Engine] Loading Sentiment Model: {SENTIMENT_MODEL}...")
        _sentiment_pipeline = pipeline("sentiment-analysis", model=SENTIMENT_MODEL, top_k=None)
        print("[Sentiment Engine] Sentiment Model Loaded.")
    return _sentiment_pipeline

def get_emotion_pipeline():
    global _emotion_pipeline
    if _emotion_pipeline is None:
        print(f"[Sentiment Engine] Loading Emotion Model: {EMOTION_MODEL}...")
        _emotion_pipeline = pipeline("text-classification", model=EMOTION_MODEL, top_k=None)
        print("[Sentiment Engine] Emotion Model Loaded.")
    return _emotion_pipeline

def analyze_sentiment(text: str):
    """
    Analyze the sentiment of the provided text.
    Returns:
    {
        "sentiment": "positive" | "negative" | "neutral",
        "score": 0.95,
        "distribution": {"positive": 0.1, "neutral": 0.8, "negative": 0.1}
    }
    """
    if not text or len(text.strip()) < 5:
        return {"sentiment": "neutral", "score": 0.0, "distribution": {}}

    try:
        classifier = get_sentiment_pipeline()
        # Truncate text to fit model max length (usually 512 tokens)
        MAX_LEN = 512
        # Simple truncation for now. Ideally should window.
        truncated_text = text[:1500] if len(text) > 1500 else text
        
        results = classifier(truncated_text)
        # results is list of list of dicts because top_k=None
        # [[{'label': 'positive', 'score': 0.9}, ...]]
        
        scores = {res['label']: res['score'] for res in results[0]}
        
        # Get dominant label
        dominant_label = max(scores, key=scores.get)
        dominant_score = scores[dominant_label]

        return {
            "sentiment": dominant_label,
            "score": round(dominant_score, 4),
            "distribution": {k: round(v, 4) for k, v in scores.items()}
        }
    except Exception as e:
        print(f"[Sentiment Engine] Error: {e}")
        return {"sentiment": "neutral", "score": 0.0, "distribution": {}, "error": str(e)}

def analyze_emotions(text: str):
    """
    Analyze fine-grained emotions (Joy, Anger, Optimism, etc.)
    Returns top 3 emotions and their scores.
    """
    if not text or len(text.strip()) < 5:
        return []

    try:
        classifier = get_emotion_pipeline()
        # Truncate
        truncated_text = text[:1500] if len(text) > 1500 else text
        
        results = classifier(truncated_text)
        # Sort by score descending
        sorted_emotions = sorted(results[0], key=lambda x: x['score'], reverse=True)
        
        # Return top 5
        return [
            {"label": e['label'], "score": round(e['score'], 4)}
            for e in sorted_emotions[:5]
        ]
    except Exception as e:
        print(f"[Sentiment Engine] Emotion Error: {e}")
        return []

def analyze_conversation_flow(segments: list):
    """
    Analyze sentiment flow across conversation segments.
    Returns a list of sentiment scores (-1 to 1) for visualization.
    """
    if not segments:
        return []
        
    classifier = get_sentiment_pipeline() # Reuse sentiment model
    flow = []
    
    # Batch process? Pipeline can handle list of strings.
    texts = [seg['text'][:512] for seg in segments if seg.get('text')]
    
    if not texts:
        return []

    try:
        # Batch inference is faster
        results = classifier(texts)
        
        for res_list in results:
            # res_list contains scores for pos, neg, neu for one segment
            scores = {r['label']: r['score'] for r in res_list}
            
            # Calculate composite score: Positive - Negative (Neutral is 0)
            composite = scores.get('positive', 0) - scores.get('negative', 0)
            flow.append(round(composite, 4))
            
        return flow
    except Exception as e:
        print(f"[Sentiment Engine] Flow Error: {e}")
        return []

# --- AUDIO EMOTION RECOGNITION (SER) ---

from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor
import torch
import librosa

SER_MODEL = "superb/wav2vec2-base-superb-er"
_ser_model = None
_ser_feature_extractor = None

def get_audio_emotion_pipeline():
    global _ser_model, _ser_feature_extractor
    if _ser_model is None:
        print(f"[Sentiment Engine] Loading Audio SER Model: {SER_MODEL}...")
        _ser_feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(SER_MODEL)
        _ser_model = Wav2Vec2ForSequenceClassification.from_pretrained(SER_MODEL)
        print("[Sentiment Engine] Audio SER Model Loaded.")
    return _ser_model, _ser_feature_extractor

def analyze_audio_emotion(file_path: str):
    """
    Analyze the emotional tone of the audio file (Speech Emotion Recognition).
    Returns: {"emotion": "neutral", "score": 0.95}
    """
    if not file_path:
        return None

    try:
        model, processor = get_audio_emotion_pipeline()
        
        # Load audio (resample to 16kHz for Wav2Vec2)
        # using librosa is robust for various formats
        speech, _ = librosa.load(file_path, sr=16000)
        
        # Chunking strategy? For now, process the first 30 seconds to get the 'vibe'
        # Processing entire call might run OOM on CPU/small GPU.
        # Let's take a representative 10s chunk from middle if long, or just first 20s.
        MAX_SEC = 20
        if len(speech) > 16000 * MAX_SEC:
             speech = speech[:16000 * MAX_SEC]

        inputs = processor(speech, sampling_rate=16000, return_tensors="pt", padding=True)

        with torch.no_grad():
            logits = model(**inputs).logits

        scores = torch.nn.functional.softmax(logits, dim=1)
        pred_score = torch.max(scores).item()
        pred_label = model.config.id2label[torch.argmax(scores).item()]

        return {
            "primary_emotion": pred_label,
            "score": round(pred_score, 4),
            "all_scores": {
                model.config.id2label[i]: round(score.item(), 4) 
                for i, score in enumerate(scores[0])
            }
        }

    except Exception as e:
        print(f"[Sentiment Engine] Audio SER Error: {e}")
        return {"primary_emotion": "unknown", "score": 0.0, "error": str(e)}
