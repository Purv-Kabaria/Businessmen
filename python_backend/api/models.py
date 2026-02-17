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
    data: dict
    meta: dict
    error: Optional[str] = None
