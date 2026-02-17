from pydantic import BaseModel
from typing import Optional


class OCRResponse(BaseModel):
    success: bool
    data: dict
    meta: dict
    error: Optional[str] = None


class ContactData(BaseModel):
    name: str
    phone: str
    email: str
    company: str


class TranscriptionResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    meta: Optional[dict] = None
    error: Optional[str] = None


class SummarizeRequest(BaseModel):
    text: str
    model: Optional[str] = "gemma3:4b"


class SummarizeResponse(BaseModel):
    success: bool
    summary: str
    meta: Optional[dict] = None
    error: Optional[str] = None
class ExtractContactRequest(BaseModel):
    text: str
    model: Optional[str] = "gemma3:4b"


class ExtractContactResponse(BaseModel):
    success: bool
    data: Optional[dict] = None  # name, company, email
    error: Optional[str] = None


class GenerateFollowupEmailRequest(BaseModel):
    contact_name: Optional[str] = None
    contact_company: Optional[str] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    """Action items or key points from the conversation for personalization."""
    action_items: Optional[list[str]] = None
    model: Optional[str] = "gemma3:4b"


class GenerateFollowupEmailResponse(BaseModel):
    success: bool
    subject: Optional[str] = None
    body_plain: Optional[str] = None
    body_html: Optional[str] = None
    error: Optional[str] = None


class ClassifyMeetingReplyRequest(BaseModel):
    reply_text: str
    original_subject: Optional[str] = None
    model: Optional[str] = "gemma3:4b"
    """Current date/time in ISO format so the LLM knows 'today', 'tomorrow', etc."""
    current_datetime: Optional[str] = None
    """List of free slots {start, end} (ISO strings) so the LLM knows what is available."""
    free_slots: Optional[list[dict]] = None


class ClassifyMeetingReplyResponse(BaseModel):
    success: bool
    wants_meeting: bool
    suggested_times: Optional[list[str]] = None
    error: Optional[str] = None
