from transformers import pipeline
from scipy.special import softmax
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed

# Singleton model instances
_sentiment_pipeline = None
_emotion_pipeline = None

# Max workers for parallel text analyses (sentiment, emotion, flow share CPU)
_SENTIMENT_EXECUTOR = ThreadPoolExecutor(max_workers=3)

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


def analyze_text_sentiment_all(full_text: str, segments: list):
    """
    Run sentiment, emotions, and conversation flow in parallel for minimal latency.
    Returns (sentiment_data, emotions, sentiment_flow).
    """
    def _sentiment():
        return analyze_sentiment(full_text)

    def _emotions():
        return analyze_emotions(full_text)

    def _flow():
        return analyze_conversation_flow(segments)

    sentiment_data = {"sentiment": "neutral", "score": 0.0, "distribution": {}}
    emotions = []
    sentiment_flow = []

    futures = {
        _SENTIMENT_EXECUTOR.submit(_sentiment): "sentiment",
        _SENTIMENT_EXECUTOR.submit(_emotions): "emotions",
        _SENTIMENT_EXECUTOR.submit(_flow): "flow",
    }
    for fut in as_completed(futures):
        key = futures[fut]
        try:
            result = fut.result()
            if key == "sentiment":
                sentiment_data = result or sentiment_data
            elif key == "emotions":
                emotions = result if isinstance(result, list) else []
            else:
                sentiment_flow = result if isinstance(result, list) else []
        except Exception as e:
            print(f"[Sentiment Engine] Parallel {key} error: {e}")

    return sentiment_data, emotions, sentiment_flow


def run_sentiment_and_ser_parallel(full_text: str, segments: list, audio_path: str):
    """
    Run all text sentiment (sentiment + emotions + flow) and audio SER in parallel
    for minimal end-to-end latency. Returns (sentiment_data, emotions, sentiment_flow, voice_emotion).
    """
    voice_emotion = None
    sentiment_data = {"sentiment": "neutral", "score": 0.0, "distribution": {}}
    emotions = []
    sentiment_flow = []

    def _text():
        return analyze_text_sentiment_all(full_text, segments)

    def _ser():
        return analyze_audio_emotion(audio_path)

    with ThreadPoolExecutor(max_workers=2) as ex:
        fut_text = ex.submit(_text)
        fut_ser = ex.submit(_ser)
        try:
            sentiment_data, emotions, sentiment_flow = fut_text.result()
        except Exception as e:
            print(f"[Sentiment Engine] Text analyses error: {e}")
        try:
            voice_emotion = fut_ser.result()
        except Exception as e:
            print(f"[Sentiment Engine] SER error: {e}")

    return sentiment_data, emotions, sentiment_flow, voice_emotion


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

def _ser_single_chunk(model, processor, speech_chunk: np.ndarray):
    """Run SER on a single audio chunk. Returns (label, score, all_scores_dict)."""
    inputs = processor(speech_chunk, sampling_rate=16000, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(**inputs).logits
    scores = torch.nn.functional.softmax(logits, dim=1)
    pred_score = torch.max(scores).item()
    pred_label = model.config.id2label[torch.argmax(scores).item()]
    all_scores = {model.config.id2label[i]: score.item() for i, score in enumerate(scores[0])}
    return pred_label, pred_score, all_scores


def analyze_audio_emotion(file_path: str):
    """
    Analyze the emotional tone of the audio file (Speech Emotion Recognition).
    For long audio, samples multiple windows (start, middle, end) and aggregates
    for better accuracy. Returns: {"primary_emotion": "...", "score": 0.95, "all_scores": {...}}
    """
    if not file_path:
        return None

    try:
        model, processor = get_audio_emotion_pipeline()
        speech, _ = librosa.load(file_path, sr=16000)
        sr = 16000
        chunk_sec = 15
        chunk_len = sr * chunk_sec

        if len(speech) <= chunk_len:
            pred_label, pred_score, all_scores = _ser_single_chunk(model, processor, speech)
            return {
                "primary_emotion": pred_label,
                "score": round(pred_score, 4),
                "all_scores": {k: round(v, 4) for k, v in all_scores.items()},
            }

        # Multi-window: start, middle, end (max 3 chunks for latency)
        mid_start = max(0, (len(speech) - chunk_len) // 2)
        mid_end = mid_start + chunk_len
        chunks = [
            speech[:chunk_len],
            speech[mid_start:mid_end],
            speech[-chunk_len:],
        ]
        chunks = [c for c in chunks if len(c) >= sr * 2]

        if not chunks:
            pred_label, pred_score, all_scores = _ser_single_chunk(model, processor, speech[:chunk_len])
            return {
                "primary_emotion": pred_label,
                "score": round(pred_score, 4),
                "all_scores": {k: round(v, 4) for k, v in all_scores.items()},
            }

        all_scores_agg = None
        for i, ch in enumerate(chunks):
            _, _, all_scores = _ser_single_chunk(model, processor, ch)
            if all_scores_agg is None:
                all_scores_agg = dict(all_scores)
            else:
                for k in all_scores_agg:
                    all_scores_agg[k] = all_scores_agg[k] + all_scores.get(k, 0.0)
        if all_scores_agg:
            n = len(chunks)
            for k in all_scores_agg:
                all_scores_agg[k] = round(all_scores_agg[k] / n, 4)
            primary_emotion = max(all_scores_agg, key=all_scores_agg.get)
            score = all_scores_agg[primary_emotion]
            return {
                "primary_emotion": primary_emotion,
                "score": score,
                "all_scores": all_scores_agg,
            }

        pred_label, pred_score, all_scores = _ser_single_chunk(model, processor, speech[:chunk_len])
        return {
            "primary_emotion": pred_label,
            "score": round(pred_score, 4),
            "all_scores": {k: round(v, 4) for k, v in all_scores.items()},
        }

    except Exception as e:
        print(f"[Sentiment Engine] Audio SER Error: {e}")
        return {"primary_emotion": "unknown", "score": 0.0, "error": str(e)}
