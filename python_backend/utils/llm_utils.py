import requests
import os
import json
import re
import time
from typing import Optional

OLLAMA_HOST = "http://127.0.0.1:11434"
DEFAULT_MODEL = "gemma3:4b"

# Hybrid summarization: use extractive first for long text to reduce LLM latency and improve accuracy
EXTRACTIVE_THRESHOLD_CHARS = 2500
EXTRACTIVE_MAX_SENTENCES = 8
EXTRACTIVE_TARGET_CHARS = 1200


def _sentences_from_text(text: str):
    """Split text into sentences (simple sentence boundary)."""
    text = text.strip()
    if not text:
        return []
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if len(p.strip()) >= 10]


def extractive_summary(text: str, max_sentences: int = EXTRACTIVE_MAX_SENTENCES) -> str:
    """
    Extractive summarization using sentence embeddings and centroid scoring.
    Fast, no LLM; good for long transcripts. Returns top-k most central sentences.
    """
    if not text or len(text.strip()) < 20:
        return text[:500] if text else ""

    sentences = _sentences_from_text(text)
    if not sentences:
        return text[:800]
    if len(sentences) <= max_sentences:
        return text

    try:
        from utils.embedding_utils import generate_embeddings
        import numpy as np

        emb = generate_embeddings(sentences)
        centroid = np.mean(emb, axis=0)
        centroid = centroid / (np.linalg.norm(centroid) + 1e-9)
        scores = np.dot(emb, centroid)
        top_indices = np.argsort(scores)[::-1][:max_sentences]
        top_indices.sort()
        return " ".join(sentences[i] for i in top_indices)
    except Exception as e:
        print(f"[LLM] Extractive summary fallback: {e}")
        return text[:EXTRACTIVE_TARGET_CHARS] if len(text) > EXTRACTIVE_TARGET_CHARS else text


def generate_summary(text: str, model: str = DEFAULT_MODEL) -> str:
    """
    Hybrid summarization: for long text, run extractive first then optional LLM pass
    for best accuracy and minimal latency. Short text goes straight to LLM.
    """
    if not text or len(text.strip()) < 10:
        return "Text too short to summarize."

    use_hybrid = len(text) > EXTRACTIVE_THRESHOLD_CHARS
    if use_hybrid:
        start_ext = time.time()
        reduced = extractive_summary(text, max_sentences=EXTRACTIVE_MAX_SENTENCES)
        ext_ms = int((time.time() - start_ext) * 1000)
        print(f"[LLM] Extractive reduction: {len(text)} -> {len(reduced)} chars in {ext_ms}ms")
        text_to_summarize = reduced
    else:
        text_to_summarize = text

    prompt = f"""Summarize the following transcript in exactly ONE concise paragraph. 
Focus on the main topics discussed and any action items or key decisions mentioned.

Transcript:
{text_to_summarize}

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
        if use_hybrid and len(text_to_summarize) < len(text):
            return text_to_summarize[:1500]
        return "Error: Could not connect to LLM service (Ollama)."
    except Exception as e:
        print(f"[LLM] Unexpected error: {str(e)}")
        if use_hybrid and len(text_to_summarize) < len(text):
            return text_to_summarize[:1500]
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
def extract_contact_info(text: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Extract contact name, company name, and email from the transcript using LLM.
    """
    if not text or len(text.strip()) < 10:
        return {"name": None, "company": None, "email": None}

    prompt = f"""You are a data extraction assistant. Analyze the following transcript to identify the person's name, their company, and their email address.
Focus on identifying potential updates to contact records.

Transcript:
{text}

Return ONLY a valid JSON object with the following keys:
- "name": The full name of the contact (if mentioned)
- "company": Their company name (if mentioned)
- "email": Their email address (if mentioned)

If a field is not found, set its value to null. 
Example JSON: {{"name": "John Smith", "company": "Tech Corp", "email": "john@example.com"}}

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
            # Find JSON block
            match = re.search(r'\{.*\}', raw_response, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    print(f"Failed to parse LLM JSON: {match.group(0)}")
        return {"name": None, "company": None, "email": None}
    except Exception as e:
        print(f"[LLM] Contact extraction failed: {str(e)}")
        return {"name": None, "company": None, "email": None}


def generate_followup_email(
    contact_name: Optional[str] = None,
    contact_company: Optional[str] = None,
    transcript: Optional[str] = None,
    summary: Optional[str] = None,
    action_items: Optional[list] = None,
    model: str = DEFAULT_MODEL,
) -> dict:
    """
    Generate a personalized follow-up email from FinIdeas using Gemma3.
    Uses contact name/company, summary, and optional transcript/action_items so the email references the actual conversation.
    Returns {"subject": str, "body_plain": str}.
    """
    company_name = "FinIdeas"
    name = (contact_name or "").strip() or "there"
    company = (contact_company or "").strip()
    context_parts = []
    if summary and summary.strip():
        context_parts.append(f"Summary of what was discussed:\n{summary.strip()}")
    if action_items and len(action_items) > 0:
        items = [str(i).strip() for i in action_items if str(i).strip()]
        if items:
            context_parts.append("Action items or key points from the conversation:\n" + "\n".join(f"- {i}" for i in items[:10]))
    if transcript and transcript.strip():
        # Add transcript context (use more when we have no summary, else shorter)
        cap = 1200 if not (summary and summary.strip()) else 500
        context_parts.append(f"Relevant excerpt from the conversation:\n{transcript.strip()[:cap]}")
    context = "\n\n".join(context_parts) if context_parts else ""

    prompt = f"""You are writing a personalized, professional follow-up email on behalf of {company_name} (a financial ideas / business company). The email must feel specific to this contact and the conversation you had—not generic.

Contact: {name}{f" at {company}" if company else ""}
{f"Context from the conversation (use this to personalize the email):\n{context}\n" if context else "No conversation context was provided—keep the email warm but general."}

Instructions:
- Address the contact by name and reference their company if relevant.
- Reference specific topics, decisions, or next steps from the summary/conversation above so they feel the email is written for them.
- If action items or key points are listed, acknowledge or follow up on 1–2 of them naturally.
- Thank them for their time, suggest a clear next step (e.g. schedule a call, send materials), and offer to answer questions.
- Sign off as "The {company_name} Team". Keep tone warm and professional. Plain text only.

Write exactly two parts, no other text:
1) SUBJECT: (one short, specific subject line—avoid generic "Follow-up"; reference the conversation or their name/company if it fits)
2) BODY: (2–4 short paragraphs as above)

Format your response exactly like this:
SUBJECT:
<subject line here>
BODY:
<email body here>"""

    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "num_predict": 512,
                },
            },
            timeout=90,
        )
        if response.status_code != 200:
            return {
                "subject": f"{company_name} – Follow-up",
                "body_plain": f"Hi {name},\n\nThank you for connecting with us. We at {company_name} would like to follow up on our conversation. Please let us know when would be a good time to continue the discussion.\n\nBest regards,\nThe {company_name} Team",
                "error": f"LLM returned {response.status_code}",
            }
        data = response.json()
        raw = (data.get("response") or "").strip()
        subject = f"{company_name} – Follow-up"
        body_plain = ""
        in_body = False
        for line in raw.split("\n"):
            line_stripped = line.strip()
            if line_stripped.upper().startswith("SUBJECT:"):
                subj = line_stripped[8:].strip()
                if subj:
                    subject = subj
                continue
            if line_stripped.upper().startswith("BODY:"):
                in_body = True
                rest = line_stripped[5:].strip()
                if rest:
                    body_plain += rest + "\n"
                continue
            if in_body:
                body_plain += line + "\n"
        body_plain = body_plain.strip() or f"Hi {name},\n\nThank you for connecting with us. We at {company_name} would like to follow up. Please reach out if you have any questions.\n\nBest regards,\nThe {company_name} Team"
        return {"subject": subject, "body_plain": body_plain}
    except Exception as e:
        print(f"[LLM] Follow-up email generation failed: {str(e)}")
        return {
            "subject": f"{company_name} – Follow-up",
            "body_plain": f"Hi {name},\n\nThank you for connecting with us. We at {company_name} would like to follow up on our conversation. Please let us know when would be a good time to continue.\n\nBest regards,\nThe {company_name} Team",
            "error": str(e),
        }


def classify_meeting_reply(
    reply_text: str,
    original_subject: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    current_datetime: Optional[str] = None,
    free_slots: Optional[list] = None,
) -> dict:
    """
    Classify if an email reply indicates the person wants to schedule a meeting.
    Returns {"wants_meeting": bool, "suggested_times": list or None}.
    Optional current_datetime and free_slots give the LLM context for "today" and available times.
    """
    if not reply_text or len(reply_text.strip()) < 5:
        return {"wants_meeting": False, "suggested_times": None}
    subject_ctx = f"\nOriginal email subject: {original_subject}" if original_subject else ""
    # Context: current date/time so the LLM can interpret "tomorrow", "next Tuesday", etc.
    from datetime import datetime
    now_ctx = ""
    if current_datetime:
        try:
            dt = datetime.fromisoformat(current_datetime.replace("Z", "+00:00"))
            now_ctx = f"\nCurrent date and time: {dt.strftime('%A, %B %d, %Y at %I:%M %p')} (use this for relative references like 'tomorrow', 'next week')."
        except Exception:
            now_ctx = f"\nCurrent date and time: {current_datetime}."
    # Context: which slots are free so the LLM knows what can be offered
    slots_ctx = ""
    if free_slots and len(free_slots) > 0:
        lines = []
        for i, s in enumerate(free_slots[:15], 1):
            start_s = s.get("start") if isinstance(s, dict) else None
            end_s = s.get("end") if isinstance(s, dict) else None
            if start_s and end_s:
                try:
                    start_dt = datetime.fromisoformat(start_s.replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(end_s.replace("Z", "+00:00"))
                    lines.append(f"  {i}. {start_dt.strftime('%A %b %d, %I:%M %p')} – {end_dt.strftime('%I:%M %p')}")
                except Exception:
                    lines.append(f"  {i}. {start_s} – {end_s}")
        if lines:
            slots_ctx = "\n\nAvailable time slots (calendar is free at these times; you can reference these when the reply suggests meeting):\n" + "\n".join(lines)
    prompt = f"""You are classifying an email reply to determine if the person is agreeing to schedule a meeting or call.{now_ctx}{slots_ctx}

Reply text:
{reply_text.strip()[:1500]}
{subject_ctx}

Answer with ONLY a JSON object (no other text):
{{"wants_meeting": true or false, "suggested_times": ["optional list of mentioned times e.g. next Tuesday 2pm"] or null}}

If they clearly agree to meet, say yes to a meeting, suggest a time, or say they're available, set wants_meeting to true. If they decline, are unclear, or just say thanks without agreeing, set wants_meeting to false. suggested_times: extract any specific times/days they mention, or null if none.
JSON:"""
    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.2, "num_predict": 150},
            },
            timeout=45,
        )
        if response.status_code != 200:
            return {"wants_meeting": False, "suggested_times": None, "error": f"LLM {response.status_code}"}
        data = response.json()
        raw = (data.get("response") or "").strip()
        match = re.search(r"\{[^{}]*\"wants_meeting\"[^{}]*\}", raw)
        if match:
            out = json.loads(match.group(0))
            return {
                "wants_meeting": bool(out.get("wants_meeting")),
                "suggested_times": out.get("suggested_times") if isinstance(out.get("suggested_times"), list) else None,
            }
        if "yes" in raw.lower() or "agree" in raw.lower() or "meet" in raw.lower() or "schedule" in raw.lower():
            return {"wants_meeting": True, "suggested_times": None}
        return {"wants_meeting": False, "suggested_times": None}
    except Exception as e:
        print(f"[LLM] Classify meeting reply failed: {str(e)}")
        return {"wants_meeting": False, "suggested_times": None, "error": str(e)}
