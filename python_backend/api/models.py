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
