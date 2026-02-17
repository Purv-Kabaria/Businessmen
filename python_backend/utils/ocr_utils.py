import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import requests
import base64
from io import BytesIO
from typing import List, Tuple
import re


def extract_text_with_ollama(image: Image.Image) -> Tuple[str, bool]:
    """
    Try to extract text using Ollama vision model (gemma3)
    Returns (text, success)
    """
    try:
        # Convert image to base64
        buffered = BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Ollama configuration
        OLLAMA_MODEL = "gemma3:4b"
        OLLAMA_HOST = "http://127.0.0.1:11434"
        
        prompt = """Extract ALL text from this business card image.
Include:
- Person's name
- Phone number(s)
- Email address(es)
- Company name
- Job title
- Any other visible text

Return ONLY the extracted text without any formatting or interpretation."""
        
        print(f"[OCR] Trying Ollama vision model ({OLLAMA_MODEL})...")
        
        response = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "images": [img_base64],
                "stream": False,
                "options": {
                    "temperature": 0.1
                }
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            text = data.get('response', '').strip()
            if text and len(text) > 5:
                print(f"[OCR] Ollama extraction successful ({len(text)} chars)")
                return text, True
            else:
                print("[OCR] Ollama returned empty/short text")
                return "", False
        else:
            print(f"[OCR] Ollama request failed: {response.status_code}")
            return "", False
            
    except requests.exceptions.ConnectionError:
        print("[OCR] Ollama not available (connection refused)")
        return "", False
    except requests.exceptions.Timeout:
        print("[OCR] Ollama request timed out")
        return "", False
    except Exception as e:
        print(f"[OCR] Ollama error: {str(e)}")
        return "", False


def preprocess_image(image: Image.Image) -> List[Image.Image]:
    """
    Preprocess image with multiple configurations for better OCR
    Returns list of preprocessed images to try
    """
    variations = []
    
    # Convert to RGB if needed
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize if too large
    max_size = 2000
    if image.width > max_size or image.height > max_size:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    
    # Original grayscale
    gray = image.convert('L')
    variations.append(gray)
    
    # High contrast version
    enhancer = ImageEnhance.Contrast(gray)
    high_contrast = enhancer.enhance(2.0)
    variations.append(high_contrast)
    
    # Sharpened version
    sharpened = gray.filter(ImageFilter.SHARPEN)
    variations.append(sharpened)
    
    # Brightness adjusted
    brightness_enhancer = ImageEnhance.Brightness(gray)
    brightened = brightness_enhancer.enhance(1.5)
    variations.append(brightened)
    
    return variations


def extract_text_multi_config(image: Image.Image) -> str:
    """
    Try multiple Tesseract configurations to get best results
    """
    configs = [
        '--psm 6 --oem 3',  # Uniform block of text
        '--psm 4 --oem 3',  # Single column of text
        '--psm 3 --oem 3',  # Fully automatic
        '--psm 11 --oem 3', # Sparse text
    ]
    
    best_text = ""
    max_length = 0
    
    # Try multiple preprocessing variations
    variations = preprocess_image(image)
    
    for img_variant in variations:
        for config in configs:
            try:
                text = pytesseract.image_to_string(img_variant, config=config)
                if len(text) > max_length:
                    max_length = len(text)
                    best_text = text
            except Exception as e:
                print(f"[OCR] Config failed: {config}, error: {e}")
                continue
    
    return best_text


def extract_phone_numbers(text: str) -> List[str]:
    """Extract all possible phone numbers with multiple patterns"""
    phones = []
    
    patterns = [
        # Indian formats
        r'\+91[-\s]?[6-9]\d{9}',
        r'\+91[-\s]?\d{5}[-\s]?\d{5}',
        r'[6-9]\d{9}',
        r'\d{5}[-\s]\d{5}',
        r'\(\+91\)[-\s]?\d{10}',
        
        # International formats
        r'\+\d{1,3}[-\s]?\d{3,4}[-\s]?\d{3,4}[-\s]?\d{3,4}',
        r'\d{3}[-.\s]\d{3}[-.\s]\d{4}',
        r'\(\d{3}\)[-\s]?\d{3}[-.\s]\d{4}',
        
        # Other formats
        r'\d{10}',
        r'\d{3}[-\s]\d{7}',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        phones.extend(matches)
    
    # Deduplicate and clean
    cleaned_phones = []
    for phone in phones:
        digits = re.sub(r'\D', '', phone)
        if 10 <= len(digits) <= 13 and digits not in [re.sub(r'\D', '', p) for p in cleaned_phones]:
            cleaned_phones.append(phone)
    
    return cleaned_phones


def extract_emails(text: str) -> List[str]:
    """Extract all possible email addresses"""
    patterns = [
        r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        r'[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}',
    ]
    
    emails = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        emails.extend(matches)
    
    # Deduplicate and validate
    valid_emails = []
    for email in emails:
        email = email.lower().strip()
        if email not in valid_emails and '@' in email and '.' in email:
            if not any(bad in email for bad in ['.jpg', '.png', '.pdf', '..', '@@']):
                valid_emails.append(email)
    
    return valid_emails


def extract_name(text: str, lines: List[str]) -> str:
    """Intelligently extract person's name from business card"""
    # Strategy 1: First 3 lines
    for i, line in enumerate(lines[:3]):
        line = line.strip()
        
        if len(line) < 3 or len(line) > 50:
            continue
            
        if '@' in line or re.search(r'\d{3,}', line):
            continue
        
        if any(keyword in line.lower() for keyword in ['pvt', 'ltd', 'inc', 'llc', 'corp', 'company', 'www', 'http']):
            continue
        
        words = line.split()
        capitalized_words = [w for w in words if w and w[0].isupper() and len(w) > 1]
        
        if len(capitalized_words) >= 1:
            return ' '.join(capitalized_words[:4])
    
    # Strategy 2: Pattern matching
    name_patterns = [
        r'name\s*:?\s*([A-Z][a-zA-Z\s\.]+)',
        r'contact\s*:?\s*([A-Z][a-zA-Z\s\.]+)',
        r'mr\.?\s+([A-Z][a-zA-Z\s\.]+)',
        r'mrs\.?\s+([A-Z][a-zA-Z\s\.]+)',
        r'ms\.?\s+([A-Z][a-zA-Z\s\.]+)',
        r'dr\.?\s+([A-Z][a-zA-Z\s\.]+)',
    ]
    
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # Strategy 3: Longest capitalized sequence
    words = text.split()
    sequences = []
    current_seq = []
    
    for word in words:
        if word and len(word) > 1 and word[0].isupper() and word.isalpha():
            current_seq.append(word)
        else:
            if current_seq:
                sequences.append(' '.join(current_seq))
                current_seq = []
    
    if current_seq:
        sequences.append(' '.join(current_seq))
    
    for seq in sorted(sequences, key=len, reverse=True):
        if 3 <= len(seq) <= 50 and not any(bad in seq.lower() for bad in ['pvt', 'ltd', 'inc', 'company', 'corporation']):
            return seq
    
    return ""


def extract_company(text: str, lines: List[str]) -> str:
    """Extract company name"""
    company_keywords = ['pvt', 'ltd', 'limited', 'inc', 'llc', 'corp', 'corporation', 'company', 'technologies', 'solutions', 'services', 'group', 'enterprises']
    
    for line in lines:
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in company_keywords):
            cleaned = line.strip()
            if len(cleaned) > 2 and len(cleaned) < 100:
                return cleaned
    
    # Look for ALL CAPS
    for line in lines[:5]:
        if line.isupper() and len(line) > 3 and len(line) < 60:
            return line.strip()
    
    return ""


def normalize_phone(phone: str) -> str:
    """
    Normalize phone number to 10-digit format
    Returns only the 10-digit number without country code
    """
    digits = re.sub(r'\D', '', phone)
    
    if len(digits) == 10:
        return digits
    elif len(digits) == 11 and digits.startswith('0'):
        return digits[1:]
    elif len(digits) == 12 and digits.startswith('91'):
        return digits[2:]
    elif len(digits) == 13 and digits.startswith('91'):
        return digits[2:12]
    elif len(digits) > 10:
        last_10 = digits[-10:]
        if last_10[0] in '6789':
            return last_10
        for i in range(len(digits) - 9):
            potential = digits[i:i+10]
            if potential[0] in '6789':
                return potential
        return digits[-10:] if len(digits) >= 10 else digits
    
    return digits


def score_email(email: str) -> int:
    """Score email quality - prefer professional over personal"""
    score = 100
    email_lower = email.lower()
    
    personal_domains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'rediff', 'proton']
    if any(domain in email_lower for domain in personal_domains):
        score -= 30
    
    score -= len(email) // 5
    
    if re.match(r'^[a-z]+\.[a-z]+@', email_lower):
        score += 20
    
    if re.search(r'\d', email.split('@')[0]):
        score -= 10
    
    return score


def validate_data(data: dict) -> dict:
    """Validate and score extracted data"""
    warnings = []
    confidence = 100
    
    if not data.get('name'):
        warnings.append("No name found")
        confidence -= 35
    elif len(data['name']) < 3:
        warnings.append("Name seems too short")
        confidence -= 15
    elif not re.search(r'[A-Z]', data['name']):
        warnings.append("Name may not be properly capitalized")
        confidence -= 10
    
    if not data.get('phone'):
        warnings.append("No phone number found")
        confidence -= 35
    else:
        digits = re.sub(r'\D', '', data['phone'])
        if len(digits) < 10:
            warnings.append("Phone number seems incomplete")
            confidence -= 20
        elif len(digits) > 13:
            warnings.append("Phone number seems too long")
            confidence -= 10
    
    if not data.get('email'):
        warnings.append("No email found")
        confidence -= 30
    elif not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', data['email']):
        warnings.append("Email format may be incorrect")
        confidence -= 15
    
    return {
        'confidence': max(0, min(100, confidence)),
        'warnings': warnings
    }
