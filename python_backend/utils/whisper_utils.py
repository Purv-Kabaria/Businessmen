try:
    from faster_whisper import WhisperModel
    import torch
    
    # Initialize Whisper model once at startup for fast inference
    print("[Whisper] Initializing faster-whisper model...")
    
    # Check for GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    
    print(f"[Whisper] Using device: {device}, compute_type: {compute_type}")
    
    print(f"[Whisper] Using device: {device}, compute_type: {compute_type}")

    # Get model size from env, default to 'medium' for good balance
    import os
    model_size = os.getenv("WHISPER_MODEL", "medium")
    print(f"[Whisper] Selected model size: {model_size}")
    
    try:
        # Prio 1: Try requested model (default: medium)
        print(f"[Whisper] Loading '{model_size}' model...")
        whisper_model = WhisperModel(
            model_size, 
            device=device,
            compute_type=compute_type,
            cpu_threads=4,
            num_workers=1,
            download_root=os.getenv("WHISPER_CACHE_DIR", None)
        )
        whisper_model.device = device
        whisper_model.model_size = model_size
        print(f"[Whisper] '{model_size}' model loaded successfully! (Device: {device})")
        
    except Exception as e:
        print(f"[Whisper] Warning: Failed to load '{model_size}' model ({e}). Falling back to 'small'...")
        try:
            # Prio 2: Fallback to 'small' (Lightweight, ~500MB)
            whisper_model = WhisperModel(
                "small", 
                device=device, 
                compute_type=compute_type,
                cpu_threads=4,
                download_root=os.getenv("WHISPER_CACHE_DIR", None)
            )
            whisper_model.device = device
            whisper_model.model_size = "small"
            print(f"[Whisper] 'small' model loaded successfully! (Device: {device})")
            
        except Exception as e2:
            # Prio 3: Total fallback to 'base'
            print(f"[Whisper] Warning: Failed to load 'small' model ({e2}). Falling back to 'base'...")
            whisper_model = WhisperModel("base", device=device, compute_type=compute_type)
            whisper_model.device = device
            whisper_model.model_size = "base"
            print(f"[Whisper] 'base' model loaded successfully! (Device: {device})")
    
except ImportError as e:
    print(f"[Whisper] Warning: faster-whisper not installed: {e}")
    print("[Whisper] Install with: pip install faster-whisper")
    whisper_model = None
except Exception as e:
    print(f"[Whisper] Warning: Failed to load model: {e}")
    whisper_model = None
