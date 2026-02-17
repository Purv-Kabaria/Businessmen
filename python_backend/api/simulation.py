from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import json
import time
import traceback
from typing import List, Optional, Any
from utils.vector_store import vector_db

router = APIRouter()

OLLAMA_HOST = "http://127.0.0.1:11434"
SIMULATION_MODEL = "gemma3:4b"


def _extract_json_object(text: str) -> Optional[dict]:
    """Extract first JSON object from text (handles leading/trailing text from LLM)."""
    if not text or not text.strip():
        return None
    text = text.strip()
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _coerce_simulation_response(raw: dict) -> dict:
    """Coerce LLM output to types expected by SimulationResponse; filter empty strings from LLM."""
    def to_list(v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            out = [str(x).strip() for x in v if x is not None and str(x).strip()]
            return out
        s = str(v).strip()
        return [s] if s else []

    def to_str(v: Any, default: str = "") -> str:
        if v is None:
            return default
        s = str(v).strip()
        return s if s else default

    def to_int(v: Any) -> int:
        if v is None:
            return 0
        if isinstance(v, int):
            return max(0, min(100, v))
        if isinstance(v, float):
            return max(0, min(100, int(round(v * 100 if v <= 1.0 else v))))
        try:
            return max(0, min(100, int(float(v))))
        except (ValueError, TypeError):
            return 0

    return {
        "likely_objections": to_list(raw.get("likely_objections")),
        "repetition_risks": to_list(raw.get("repetition_risks")),
        "strategic_sequence": to_list(raw.get("strategic_sequence")),
        "tone_recommendation": to_str(raw.get("tone_recommendation"), "Consultative"),
        "alignment_warning": to_str(raw.get("alignment_warning")),
        "commitment_gaps": to_list(raw.get("commitment_gaps")),
        "confidence_score": to_int(raw.get("confidence_score")),
    }


class EmbedRequest(BaseModel):
    id: str
    text: str
    metadata: dict


class SimulationRequest(BaseModel):
    contact_id: str
    context_summary: str


class SimulationResponse(BaseModel):
    likely_objections: List[str]
    repetition_risks: List[str]
    strategic_sequence: List[str]
    tone_recommendation: str
    alignment_warning: str
    commitment_gaps: List[str]
    confidence_score: int


def _meta(used_rag: bool, latency_ms: int) -> dict:
    return {
        "model": SIMULATION_MODEL,
        "retrieval": "RAG (FAISS)" if used_rag else "Context only",
        "latency_ms": latency_ms,
    }


def _fallback_simulation_response() -> SimulationResponse:
    return SimulationResponse(
        likely_objections=["Standard price resistance", "Competitor comparison"],
        repetition_risks=["Detailed technical specs"],
        strategic_sequence=[
            "Acknowledge previous discussions",
            "Address outstanding concerns",
            "Propose concrete next steps",
        ],
        tone_recommendation="Consultative and Reassuring",
        alignment_warning="",
        commitment_gaps=[],
        confidence_score=25,
    )


@router.post("/embed")
async def embed_interaction(req: EmbedRequest):
    """
    Store an interaction summary in the vector database.
    Called by Next.js backend when a new interaction is created/updated.
    """
    try:
        doc = {
            "id": req.id,
            "text": req.text,
            "metadata": req.metadata
        }
        vector_db.add_documents([doc])
        return {"success": True, "count": 1}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulate")
async def simulate_strategy(req: SimulationRequest):
    """
    Generate strategic call simulation for a contact using RAG.
    Returns strategy data plus meta: { model, retrieval, latency_ms }.
    """
    start_time = time.time()
    used_rag = False
    try:
        # 1. Retrieve relevant context from vector DB (optional: use request context on failure)
        context_text = f"No detailed history found. Current Context: {req.context_summary}"
        try:
            search_query = f"risks objections concerns for contact {req.contact_id}"
            raw_results = vector_db.search(search_query, k=20)
            relevant_docs = []
            for res in raw_results:
                doc = res.get("document") or {}
                meta = doc.get("metadata")
                if not isinstance(meta, dict):
                    meta = {}
                contact_id_in_meta = meta.get("contactId") or meta.get("contact_id")
                if contact_id_in_meta == req.contact_id:
                    relevant_docs.append(doc)
            if relevant_docs:
                used_rag = True
                parts = []
                for d in relevant_docs[:5]:
                    meta = d.get("metadata") or {}
                    date_str = meta.get("date", "Unknown")
                    text = d.get("text", "")
                    parts.append(f"Processing Date: {date_str}\nSummary: {text}")
                context_text = "\n\n".join(parts)
        except Exception as vec_err:
            print(f"[Simulation] Vector search skipped (using request context): {vec_err}")

        # 2. Build Prompt
        prompt = f"""You are a Strategic Sales Intelligence Simulator.
Analyze the provided interaction history for this contact and simulate the next call strategy.

CONTEXT:
{context_text}

CURRENT STAGE:
{req.context_summary}

TASK:
1. Predict likely objections based on past patterns.
2. Identify topics that have been discussed too much (repetition risks).
3. Outline a 3-step strategic sequence for the call.
4. Detect any alignment warnings (contradictions in history).
5. Spot missing commitments (promises made by us or them).

Reply with ONLY a single JSON object, no other text or markdown. Use this exact structure:
{{
  "likely_objections": ["obj1", "obj2"],
  "repetition_risks": ["topic1"],
  "strategic_sequence": ["step1", "step2", "step3"],
  "tone_recommendation": "assertive/empathetic/consultative etc",
  "alignment_warning": "warning text or empty string",
  "commitment_gaps": ["gap1"],
  "confidence_score": 50
}}
"""

        # 3. Call LLM
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": SIMULATION_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.2,
                    "num_ctx": 4096
                }
            },
            timeout=30
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"LLM Error: {response.text}")
            
        result_json = response.json()
        raw_response = (result_json.get("response") or "").strip()
        original_response = raw_response

        # Clean up markdown code blocks if present (common with Gemma/LLama)
        if "```json" in raw_response:
            raw_response = raw_response.split("```json", 1)[1].split("```")[0].strip()
        elif "```" in raw_response:
            raw_response = raw_response.split("```", 1)[1].split("```")[0].strip()

        structured = None
        if raw_response:
            try:
                parsed = json.loads(raw_response)
                if isinstance(parsed, dict):
                    structured = parsed
            except json.JSONDecodeError:
                pass
        if structured is None:
            structured = _extract_json_object(raw_response)
        if structured is None and original_response != raw_response:
            structured = _extract_json_object(original_response)

        if not structured or not isinstance(structured, dict):
            print(f"[Simulation] Empty or invalid JSON from LLM. Raw (first 500 chars): {repr((original_response or raw_response)[:500])}")
            fallback = _fallback_simulation_response()
            latency_ms = int((time.time() - start_time) * 1000)
            return {**fallback.model_dump(), "meta": _meta(used_rag, latency_ms)}

        coerced = _coerce_simulation_response(structured)
        latency_ms = int((time.time() - start_time) * 1000)
        return {**coerced, "meta": _meta(used_rag, latency_ms)}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Simulation] Returning Fallback Strategy due to error: {e}")
        traceback.print_exc()
        fallback = _fallback_simulation_response()
        latency_ms = int((time.time() - start_time) * 1000)
        return {**fallback.model_dump(), "meta": _meta(used_rag, latency_ms)}
