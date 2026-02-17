from fastapi import APIRouter, File, UploadFile, HTTPException, Body
import time
import tempfile
import os
import requests
from pydantic import BaseModel

from api.models import TranscriptionResponse, SummarizeRequest, SummarizeResponse, ExtractContactRequest, ExtractContactResponse
from utils.whisper_utils import whisper_model
from utils.audio_preprocess import preprocess_audio

router = APIRouter()


def _transcribe_from_path(temp_path: str, file_size_mb: float, start_time: float):
    """Shared pipeline: preprocess, segment, transcribe, sentiment. Caller owns temp_path cleanup."""
    clean_path = None

    try:
            print("[Transcribe] Preprocessing audio (Denoise + Normalize)...")
            clean_path = preprocess_audio(temp_path)

            print("[Transcribe] Segmenting audio smartly (Silence + 25s Target)...")
            from utils.audio_segmentation import segment_audio_smartly
            
            # Split smartly: Aim for 25s chunks, but cut ONLY at natural pauses
            # This is "much smarter" because it preserves sentence context
            audio_segments = segment_audio_smartly(
                clean_path, 
                target_chunk_ms=25000,
                min_silence_len=500,
                silence_thresh=-40
            )
            
            full_transcript_parts = []
            all_segments = []
            combined_language = "en" 
            total_duration = 0.0
            
            print(f"[Transcribe] Processing {len(audio_segments)} segments one by one...")
            
            for i, seg in enumerate(audio_segments):
                seg_path = seg['path']
                seg_start_sec = seg.get('start_ms', 0) / 1000.0
                seg_duration = seg.get('duration_ms', 0) / 1000.0
                total_duration += seg_duration
                
                print(f"  > Segment {i+1}/{len(audio_segments)} (Offset: {seg_start_sec:.2f}s, Duration: {seg_duration:.2f}s)...")
                
                try:
                    # Transcribe independent segment
                    # word_timestamps=False is fine, we want sentence/phrase segments
                    segments, info = whisper_model.transcribe(
                        seg_path,
                        beam_size=5,
                        language="en",
                        temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
                        vad_filter=True, 
                        word_timestamps=False,
                    )
                    
                    for s in segments:
                        text = s.text.strip()
                        if text:
                            # Adjust timestamps based on the chunk's offset in the original file
                            all_segments.append({
                                "text": text,
                                "start": round(s.start + seg_start_sec, 2),
                                "end": round(s.end + seg_start_sec, 2),
                            })
                            full_transcript_parts.append(text)
                    
                    if i == 0: combined_language = info.language
                
                except Exception as e_seg:
                    print(f"  [!] Failed to transcribe segment {i}: {e_seg}")
                    continue

                finally:
                    # Cleanup segment temp file immediately
                    if seg_path != clean_path and os.path.exists(seg_path):
                        try:
                            os.unlink(seg_path)
                        except:
                            pass

            full_text = " ".join(full_transcript_parts)
            
            # Identify hotspots (business intelligence: financial, brand, contact details)
            print("[Transcribe] Analyzing business intelligence hotspots with gemma3...")
            from utils.llm_utils import analyze_hotspots
            hotspots = analyze_hotspots(all_segments)
            print(f"[Transcribe] Found {len(hotspots)} important business hotspots.")

            # --- ML Sentiment Analysis Integration ---
            print("[Transcribe] Running Advanced ML Sentiment Engine...")
            from utils.sentiment_engine import analyze_sentiment, analyze_emotions, analyze_conversation_flow, analyze_audio_emotion

            # 1. Overall Text Sentiment (Positive/Neutral/Negative)
            sentiment_data = analyze_sentiment(full_text)
            
            # 2. Granular Text Emotions (Joy, Anger, etc.)
            emotions = analyze_emotions(full_text)
            
            # 3. Sentiment Flow (Trajectory)
            sentiment_flow = analyze_conversation_flow(all_segments)
            
            # 4. Voice/Audio Emotion (SER) - The "Vibe Check"
            print("[Transcribe] Running Voice Emotion Analysis (Wav2Vec2)...")
            voice_emotion = analyze_audio_emotion(clean_path)

            print(f"[Transcribe] Text Sentiment: {sentiment_data.get('sentiment')} (Score: {sentiment_data.get('score')})")
            print(f"[Transcribe] Voice Emotion: {voice_emotion.get('primary_emotion')} (Score: {voice_emotion.get('score')})")

            processing_time = int((time.time() - start_time) * 1000)

            print(f"[Transcribe] Success ({processing_time}ms)")
            print(f"[Transcribe] Transcript: {full_text[:100]}...")

            data = {
                "transcript": full_text,
                "segments": all_segments,
                "hotspots": hotspots,
                "language": combined_language,
                "sentiment": sentiment_data,
                "emotions": emotions,
                "sentimentFlow": sentiment_flow,
                "voiceEmotion": voice_emotion,
            }
            meta = {
                "processingTime": round((time.time() - start_time) * 1000, 2),
                "audioDuration": round(total_duration, 2),
                "languageConfidence": 0.99,
                "fileSizeMB": round(file_size_mb, 2),
                "model": getattr(whisper_model, "model_size", "unknown"),
                "device": getattr(whisper_model, "device", "unknown"),
                "enhancement": "Smart Segmentation (25s) + Spectral Gating",
                "sentimentEngine": "RoBERTa (Text) + Wav2Vec2 (Audio)",
            }
            return (data, meta, clean_path)
    finally:
        if clean_path and os.path.exists(clean_path):
            try:
                os.unlink(clean_path)
            except Exception:
                pass


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    start_time = time.time()
    temp_path = None
    try:
        if not whisper_model:
            raise HTTPException(
                status_code=503,
                detail="Whisper model not loaded."
            )
        if not audio.content_type or not (
            audio.content_type.startswith("audio/")
            or audio.content_type.startswith("video/")
        ):
            raise HTTPException(
                status_code=400,
                detail="File must be an audio file"
            )
        contents = await audio.read()
        file_size_mb = len(contents) / (1024 * 1024)
        print(f"[Transcribe] Processing {audio.filename} ({file_size_mb:.2f}MB)")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(contents)
            temp_path = temp_audio.name
        data, meta, _ = _transcribe_from_path(temp_path, file_size_mb, start_time)
        return TranscriptionResponse(success=True, data=data, meta=meta)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        return TranscriptionResponse(success=False, error=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass


class TranscribeByUrlRequest(BaseModel):
    audio_url: str


@router.post("/transcribe-by-url", response_model=TranscriptionResponse)
async def transcribe_by_url(req: TranscribeByUrlRequest = Body(...)):
    start_time = time.time()
    temp_path = None
    try:
        if not whisper_model:
            raise HTTPException(
                status_code=503,
                detail="Whisper model not loaded."
            )
        audio_url = (req.audio_url or "").strip()
        if not audio_url:
            raise HTTPException(status_code=400, detail="audio_url is required")
        print(f"[Transcribe] Fetching audio from URL ({len(audio_url)} chars)...")
        resp = requests.get(audio_url, timeout=120)
        resp.raise_for_status()
        contents = resp.content
        file_size_mb = len(contents) / (1024 * 1024)
        print(f"[Transcribe] Downloaded {file_size_mb:.2f}MB, processing...")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(contents)
            temp_path = temp_audio.name
        data, meta, _ = _transcribe_from_path(temp_path, file_size_mb, start_time)
        return TranscriptionResponse(success=True, data=data, meta=meta)
    except HTTPException:
        raise
    except requests.RequestException as e:
        print(f"[Transcribe-by-URL] Fetch error: {str(e)}")
        return TranscriptionResponse(success=False, error=f"Failed to fetch audio: {e}")
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        return TranscriptionResponse(success=False, error=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_transcript(req: SummarizeRequest):
    """
    Summarize a transcript using Ollama
    """
    start_time = time.time()
    try:
        from utils.llm_utils import generate_summary
        
        summary = generate_summary(req.text, model=req.model)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        if summary.startswith("Error:"):
            return SummarizeResponse(
                success=False,
                summary="",
                error=summary
            )
            
        return SummarizeResponse(
            success=True,
            summary=summary,
            meta={"processingTime": processing_time, "model": req.model}
        )
    except Exception as e:
        print(f"[Summarize] Error: {str(e)}")
        return SummarizeResponse(success=False, summary="", error=str(e))
@router.post("/extract-contact", response_model=ExtractContactResponse)
async def extract_contact_from_text(req: ExtractContactRequest):
    """
    Extract contact details from transcript using AI
    """
    try:
        from utils.llm_utils import extract_contact_info
        
        data = extract_contact_info(req.text, model=req.model)
        
        return ExtractContactResponse(
            success=True,
            data=data
        )
    except Exception as e:
        print(f"[ExtractContact] Error: {str(e)}")
        return ExtractContactResponse(success=False, data=None, error=str(e))
