from fastapi import APIRouter, File, UploadFile, HTTPException
import time
import tempfile
import os

from api.models import TranscriptionResponse
from utils.whisper_utils import whisper_model

router = APIRouter()


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio file using Whisper
    Optimized for speed with offline support
    Supports: wav, webm, mp3, m4a, ogg, flac
    """
    start_time = time.time()
    
    try:
        if not whisper_model:
            raise HTTPException(
                status_code=503,
                detail="Whisper model not loaded. Please check server logs."
            )
        
        # Validate file is audio
        if not audio.content_type or not audio.content_type.startswith('audio/'):
            # Also accept video/webm (common for MediaRecorder)
            if not audio.content_type.startswith('video/'):
                raise HTTPException(
                    status_code=400,
                    detail="File must be an audio file"
                )
        
        contents = await audio.read()
        file_size_mb = len(contents) / (1024 * 1024)
        
        print(f"[Transcribe] Processing {audio.filename} ({file_size_mb:.2f}MB)")
        print(f"[Transcribe] Content-Type: {audio.content_type}")
        
        # Save to temporary file (Whisper needs file path)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(contents)
            temp_path = temp_audio.name
        
        try:
            print("[Transcribe] Running Whisper transcription...")
            
            # Transcribe with optimizations
            segments, info = whisper_model.transcribe(
                temp_path,
                beam_size=1,  # Faster: 1, More accurate: 5
                best_of=1,     # Faster: 1, More accurate: 5
                temperature=0.0,  # Deterministic output
                vad_filter=True,  # Voice Activity Detection (removes silence)
                vad_parameters=dict(
                    min_silence_duration_ms=500,  # Skip silences > 500ms
                ),
                word_timestamps=False,  # Faster without word-level timestamps
                language="en",  # Specify language for speed (auto-detect if None)
            )
            
            # Combine all segments
            full_text = " ".join([segment.text.strip() for segment in segments])
            
            processing_time = int((time.time() - start_time) * 1000)
            
            print(f"[Transcribe] Success! ({processing_time}ms)")
            print(f"[Transcribe] Detected language: {info.language} (confidence: {info.language_probability:.2%})")
            print(f"[Transcribe] Duration: {info.duration:.2f}s")
            print(f"[Transcribe] Transcript: {full_text[:100]}...")
            
            return TranscriptionResponse(
                success=True,
                data={
                    'transcript': full_text,
                    'language': info.language,
                },
                meta={
                    'processingTime': processing_time,
                    'audioDuration': round(info.duration, 2),
                    'languageConfidence': round(info.language_probability, 4),
                    'fileSizeMB': round(file_size_mb, 2),
                    'model': 'faster-whisper-base',
                    'device': getattr(whisper_model, 'device', 'unknown'),
                }
            )
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Transcribe] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
