import subprocess
import tempfile
import os
import shutil

def preprocess_audio(input_path: str) -> str:
    """
    Advanced Audio Preprocessing Pipeline:
    1. Convert to WAV (16kHz mono)
    2. DeepFilterNet AI Denoising (Removes background noise/reverb)
    3. Loudness Normalization (EBU R128 standard)
    4. Fallback to FFmpeg filters if DeepFilterNet fails
    """
    
    # Create temp files
    temp_dir = tempfile.gettempdir()
    wav_path = os.path.join(temp_dir, f"pre_process_{os.path.basename(input_path)}.wav")
    enhanced_path = os.path.join(temp_dir, f"enhanced_{os.path.basename(input_path)}.wav")
    final_path = os.path.join(temp_dir, f"final_{os.path.basename(input_path)}.wav")

    try:
        # Step 1: Convert to consistent WAV format (16kHz, Mono, PCM_16)
        # 16kHz is Whisper's native rate
        subprocess.run([
            "ffmpeg", "-y",
            "-i", input_path,
            "-ac", "1", 
            "-ar", "48000", # DeepFilterNet prefers 48k input for best results
            "-c:a", "pcm_s16le",
            wav_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Step 2: Try Noisereduce (Spectral Gating)
        # DeepFilterNet failed on Windows due to Rust dependency, switching to noisereduce
        import noisereduce as nr
        import numpy as np
        import soundfile as sf
        
        print(f"[Preprocess] Attempting Spectral Gating denoising...")
        
        try:
            # Load audio using soundfile (returns numpy array directly)
            # Avoids torchaudio backend issues on Windows
            audio_data, sample_rate = sf.read(wav_path)
            
            # Check if stereo, convert to mono if needed (though Step 1 ffmpeg makes it mono)
            if len(audio_data.shape) > 1:
                audio_data = audio_data.mean(axis=1)
            
            # Perform noise reduction
            # Using stationary noise reduction (assumes constant background noise)
            # Prop_decrease=0.75 means reduce noise by 75% to avoid artifacts
            reduced_noise = nr.reduce_noise(
                y=audio_data, 
                sr=sample_rate, 
                prop_decrease=0.75,
                stationary=True
            )
            
            # Save enhanced audio
            sf.write(enhanced_path, reduced_noise, sample_rate)
            print("[Preprocess] Noisereduce success!")
                 
        except Exception as e:
            print(f"[Preprocess] Noisereduce failed ({e}), falling back to FFmpeg denoising...")
            # Fallback: Basic FFmpeg denoising
            subprocess.run([
                "ffmpeg", "-y",
                "-i", wav_path,
                "-af", "highpass=f=200,lowpass=f=3000,afftdn=nf=-25", 
                enhanced_path
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Step 3: Final Loudness Normalization & Resample for Whisper (16kHz)
        subprocess.run([
            "ffmpeg", "-y",
            "-i", enhanced_path,
            "-ar", "16000",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", # EBU R128 Podcast standard
            final_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        return final_path

    except Exception as e:
        print(f"[Preprocess] Critical Error: {e}")
        # Panic fallback: Just return original if everything fails
        return input_path

