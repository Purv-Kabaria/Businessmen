try:
    from faster_whisper import WhisperModel
    import torch
    
    # Initialize Whisper model once at startup for fast inference
    print("[Whisper] Initializing faster-whisper model...")
    
    # Check for GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    
    print(f"[Whisper] Using device: {device}, compute_type: {compute_type}")
    
    try:
        # Initialize model with optimizations
        whisper_model = WhisperModel(
            "base",  # Model size: tiny, base, small, medium, large-v3
            device=device,
            compute_type=compute_type,
            cpu_threads=4,  # Use multiple CPU threads
            num_workers=1,  # Parallel workers
        )
        # Monkey-patch device attribute since faster-whisper doesn't expose it
        whisper_model.device = device
        print(f"[Whisper] Model loaded successfully! (Device: {device})")
    except Exception as e:
        print("[Whisper] Warning: Failed to load 'base' model, trying 'tiny'...")
        try:
            whisper_model = WhisperModel("tiny", device=device, compute_type=compute_type)
            print("[Whisper] 'tiny' Model loaded successfully!")
        except Exception as e2:
            raise e
    
except ImportError as e:
    print(f"[Whisper] Warning: faster-whisper not installed: {e}")
    print("[Whisper] Install with: pip install faster-whisper")
    whisper_model = None
except Exception as e:
    print(f"[Whisper] Warning: Failed to load model: {e}")
    whisper_model = None
