from pydub import AudioSegment
from pydub.silence import detect_silence
import os
import tempfile
import math

def segment_audio_smartly(file_path: str, target_chunk_ms: int = 25000, min_silence_len: int = 500, silence_thresh: int = -40) -> list:
    """
    Smartly splits audio into chunks of roughly `target_chunk_ms` length, 
    but ONLY cutting at detected silence to preserve sentence integrity.
    
    Args:
        file_path: Path to audio file.
        target_chunk_ms: Desired max length of chunks (default 25s, Whisper likes ~30s).
        min_silence_len: Minimum silence to count as a pause (ms).
        silence_thresh: Silence threshold in dBFS.
        
    Returns:
        List of dicts: {'path': str, 'start_ms': int, 'duration_ms': int}
    """
    print(f"[Segmentation] Smart splitting (Target: {target_chunk_ms}ms, Min Silence: {min_silence_len}ms)...")
    
    try:
        sound = AudioSegment.from_file(file_path)
    except Exception as e:
        print(f"[Segmentation] Error loading file: {e}")
        return []

    # Normalize roughly to help silence detection
    change_in_dBFS = -20.0 - sound.dBFS
    sound = sound.apply_gain(change_in_dBFS)
    
    total_len = len(sound)
    
    # If audio is shorter than target, just return it
    if total_len <= target_chunk_ms:
        temp_dir = tempfile.gettempdir()
        chunk_filename = f"smart_full_{os.path.basename(file_path)}.wav"
        chunk_path = os.path.join(temp_dir, chunk_filename)
        sound.export(chunk_path, format="wav")
        return [{'path': chunk_path, 'start_ms': 0, 'duration_ms': total_len}]

    # 1. Detect all valid silence gaps
    # Returns list of [start, end] for silences
    print("[Segmentation] Scanning for silence gaps...")
    silences = detect_silence(sound, min_silence_len=min_silence_len, silence_thresh=silence_thresh)
    
    # Calculate potential cut points (middle of each silence)
    cut_points = []
    for s_start, s_end in silences:
        mid_point = s_start + (s_end - s_start) // 2
        cut_points.append(mid_point)
    
    # Add the end of file as a final cut point
    cut_points.append(total_len)
    
    # 2. Select best cut points to fit target length
    final_cuts = [0] # Start at 0
    current_start = 0
    
    # Iterate through potential cut points
    for cut in cut_points:
        segment_len = cut - current_start
        
        # If adding this potential cut exceeds target, we MUST cut at the previous valid point
        if segment_len > target_chunk_ms:
            # Check if we have processed/skipped previous cuts
            # If current_start is the previous cut, we are forced to take a long segment 
            # (because no silence was found in > target_ms)
            
            # Simple greedy strategy:
            # - If segment becomes too long, look for the LAST cut point that fits
            pass 
            
    # Simpler Greedy Logic:
    # Walk through cut points. Keep extending current segment. 
    # If extending to `cut` makes it > target_ms:
    #   - If we have intermediate cut points since `current_start`, pick the latest one.
    #   - If we have NO intermediate cut points (speech is simply too continuous), forced to cut at `cut` (better than mid-word).
    
    processed_cuts = []
    last_valid_cut = 0
    start_search_idx = 0
    
    current_pos = 0
    
    while current_pos < total_len:
        target_end = current_pos + target_chunk_ms
        if target_end >= total_len:
            processed_cuts.append(total_len)
            break
            
        # Find the best cut point near target_end (preferably before it, or slightly after)
        
        # Look for cut points between current_pos and target_end
        candidates_before = [c for c in cut_points if c > current_pos and c <= target_end]
        candidates_after = [c for c in cut_points if c > target_end]
        
        selected_cut = None
        
        # Strategy: Prefer cutting as close to target_end as possible (maximal context)
        # 1. Try to find cut in the last 20% of the target window (so 20s-25s)
        # 2. If none, take any cut in the window.
        # 3. If none, take the first cut AFTER the window (better to extend than split word).
        
        if candidates_before:
            # Pick the latest candidate in the window
            selected_cut = candidates_before[-1]
        elif candidates_after:
            # No silence in window, must extend to next silence
            selected_cut = candidates_after[0]
        else:
            # No silence found anywhere after? Just take end
            selected_cut = total_len
            
        processed_cuts.append(selected_cut)
        current_pos = selected_cut
        
    # 3. Export segments based on processed_cuts
    final_segments = []
    temp_dir = tempfile.gettempdir()
    
    last_cut = 0
    for i, cut in enumerate(processed_cuts):
        if cut <= last_cut: continue # Prevent zero len
        
        chunk = sound[last_cut:cut]
        
        chunk_filename = f"smart_chunk_{i}_{os.path.basename(file_path)}.wav"
        chunk_path = os.path.join(temp_dir, chunk_filename)
        
        chunk.export(chunk_path, format="wav")
        
        final_segments.append({
            'path': chunk_path,
            'start_ms': last_cut,
            'duration_ms': cut - last_cut
        })
        
        last_cut = cut
        
    print(f"[Segmentation] Created {len(final_segments)} smart segments.")
    return final_segments
