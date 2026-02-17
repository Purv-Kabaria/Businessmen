import requests
import os
import json
import re
import time
from typing import Optional

OLLAMA_HOST = "http://127.0.0.1:11434"
DEFAULT_MODEL = "gemma3:4b"

def generate_summary(text: str, model: str = DEFAULT_MODEL) -> str:
    """
    Generate a concise one-paragraph summary of the given text using Ollama.
    """
    if not text or len(text.strip()) < 10:
        return "Text too short to summarize."

    prompt = f"""Summarize the following transcript in exactly ONE concise paragraph. 
Focus on the main topics discussed and any action items or key decisions mentioned.

Transcript:
{text}

Summary:"""

    try:
        start_time = time.time()
        print(f"[LLM] Summarizing with {model}...")
        
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 256
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            summary = data.get('response', '').strip()
            duration = int((time.time() - start_time) * 1000)
            print(f"[LLM] Summary generated in {duration}ms")
            return summary
        else:
            print(f"[LLM] Error from Ollama: {response.status_code}")
            return f"Error: LLM service returned {response.status_code}"

    except requests.exceptions.ConnectionError:
        print("[LLM] Connection refused. Is Ollama running?")
        return "Error: Could not connect to LLM service (Ollama)."
    except Exception as e:
        print(f"[LLM] Unexpected error: {str(e)}")
        return f"Error: {str(e)}"

def analyze_hotspots(segments: list, model: str = DEFAULT_MODEL) -> list:
    """
    Analyze transcript segments to find 'hotspots' or important moments.
    Returns a list of important time segments.
    """
    if not segments:
        return []

    # Prepare a condensed version of segments for the prompt
    transcript_with_ids = "\n".join([f"[{i}] {s['text']}" for i, s in enumerate(segments)])
    
    prompt = f"""You are a business intelligence assistant analyzing a conference/expo transcript.
Identify the indices of segments that contain CRITICAL information such as:
- Financial details (prices, budgets, revenue, investment)
- Company/Brand names and specific products
- Personal contact details or high-level executive introductions
- Strategic decisions or partnership mentions

Transcript Segments:
{transcript_with_ids}

Return ONLY a JSON list of indices (integers) for the most important segments. 
Example: [1, 5, 12]
JSON Response:"""

    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            raw_response = data.get('response', '').strip()
            # Try to find JSON array in the response
            match = re.search(r'\[.*\]', raw_response)
            if match:
                indices = json.loads(match.group(0))
                # Map indices back to timestamps
                hotspots = []
                for idx in indices:
                    if 0 <= idx < len(segments):
                        hotspots.append({
                            "start": segments[idx]['start'],
                            "end": segments[idx]['end'],
                            "text": segments[idx]['text']
                        })
                return hotspots
        return []
    except Exception as e:
        print(f"[LLM] Hotspot analysis failed: {str(e)}")
        return []
