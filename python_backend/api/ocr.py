from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image
import io
import time

from api.models import OCRResponse
from utils.ocr_utils import (
    extract_text_with_ollama,
    extract_text_multi_config,
    extract_phone_numbers,
    extract_emails,
    extract_name,
    extract_company,
    normalize_phone,
    score_email,
    validate_data,
)

router = APIRouter()


@router.post("/ocr", response_model=OCRResponse)
async def process_ocr(image: UploadFile = File(...)):
    """
    Process business card image and extract contact information
    Primary: Ollama vision model (gemma3)
    Fallback: Tesseract OCR
    """
    start_time = time.time()
    
    try:
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
        
        print(f"[OCR] Processing {image.filename} ({len(contents) / 1024:.2f}KB)")
        print(f"[OCR] Image size: {pil_image.width}x{pil_image.height}")
        
        # Try Ollama vision model first
        raw_text, ollama_success = extract_text_with_ollama(pil_image)
        ocr_engine = "gemma3-vision"
        
        # Fall back to Tesseract if Ollama failed
        if not ollama_success or len(raw_text.strip()) < 5:
            if ollama_success:
                print("[OCR] Ollama returned insufficient text, falling back to Tesseract...")
            else:
                print("[OCR] Ollama unavailable, falling back to Tesseract...")
            
            print("[OCR] Running multi-config Tesseract OCR...")
            raw_text = extract_text_multi_config(pil_image)
            ocr_engine = "tesseract-multi-config"
        
        if not raw_text or len(raw_text.strip()) < 5:
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from image. Please ensure the image is clear and well-lit."
            )
        
        print(f"[OCR] Extracted text ({len(raw_text)} chars)")
        print(f"[OCR] Text preview: {raw_text[:200]}")
        
        # Process extracted text
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        phones = extract_phone_numbers(raw_text)
        emails = extract_emails(raw_text)
        name = extract_name(raw_text, lines)
        company = extract_company(raw_text, lines)
        
        print(f"[OCR] Found: {len(phones)} phones, {len(emails)} emails")
        print(f"[OCR] Phones: {phones}")
        print(f"[OCR] Emails: {emails}")
        print(f"[OCR] Name: {name}")
        print(f"[OCR] Company: {company}")
        
        # Select best email
        best_email = ''
        if emails:
            scored_emails = [(email, score_email(email)) for email in emails]
            scored_emails.sort(key=lambda x: x[1], reverse=True)
            best_email = scored_emails[0][0]
            print(f"[OCR] Best email: {best_email} (score: {scored_emails[0][1]})")
        
        # Select best phone
        best_phone = ''
        if phones:
            mobile_phones = [p for p in phones if p and len(p) >= 10]
            if mobile_phones:
                best_phone = normalize_phone(mobile_phones[0])
            else:
                best_phone = normalize_phone(phones[0]) if phones else ''
        
        contact_data = {
            'name': name,
            'phone': best_phone,
            'email': best_email,
            'company': company
        }
        
        validation = validate_data(contact_data)
        processing_time = int((time.time() - start_time) * 1000)
        
        print(f"[OCR] Complete! Confidence: {validation['confidence']}% in {processing_time}ms")
        if validation['warnings']:
            print(f"[OCR] Warnings: {validation['warnings']}")
        
        return OCRResponse(
            success=True,
            data=contact_data,
            meta={
                'confidence': validation['confidence'],
                'warnings': validation['warnings'],
                'processingTime': processing_time,
                'engine': ocr_engine,
                'alternatives': {
                    'phones': phones[:3],
                    'emails': emails[:3]
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[OCR] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
