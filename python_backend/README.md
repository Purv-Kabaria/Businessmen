# FastAPI OCR Backend for FinBridge

This is a Python FastAPI backend that handles OCR (Optical Character Recognition) for business card scanning.

## Features

- **Fast OCR Processing** using Tesseract
- **Image Preprocessing** for better accuracy
- **Regex Pattern Matching** for contact extraction
- **Data Validation** with confidence scoring
- **CORS Support** for Next.js frontend integration

## Prerequisites

### 1. Install Python
```bash
# Windows
winget install Python.Python.3.12

# Or download from: https://www.python.org/downloads/
```

### 2. Install Tesseract OCR
```bash
# Windows
winget install UB-Mannheim.TesseractOCR

# Or download from: https://github.com/UB-Mannheim/tesseract/wiki
```

After installation, add Tesseract to PATH or configure pytesseract:
```python
# If not in PATH, configure in main.py
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

## Installation

### 1. Create Virtual Environment
```bash
cd d:\Projects\htt_Businessmen\python_backend

# Create venv
python -m venv venv

# Activate venv
# Windows CMD:
venv\Scripts\activate

# Windows PowerShell:
venv\Scripts\Activate.ps1

# Git Bash:
source venv/Scripts/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

## Running the Server

### Development Mode (with auto-reload)
```bash
uvicorn main:app --reload --port 8000
```

### Production Mode
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

The server will start at: **http://localhost:8000**

## API Endpoints

### 1. Root
```
GET /
```
Returns service information and available endpoints.

### 2. Health Check
```
GET /health
```
Checks if Tesseract is installed and available.

**Response:**
```json
{
  "status": "healthy",
  "tesseract": "available"
}
```

### 3. OCR Processing
```
POST /api/ocr
```

**Request:**
- `image`: Multipart form file (JPEG, PNG, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@company.com",
    "company": "Tech Corp"
  },
  "meta": {
    "confidence": 75,
    "warnings": [],
    "processingTime": 234,
    "engine": "tesseract"
  }
}
```

## Testing the API

### Using cURL
```bash
curl -X POST http://localhost:8000/api/ocr \
  -F "image=@business_card.jpg"
```

### Using Python
```python
import requests

with open('business_card.jpg', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/api/ocr',
        files={'image': f}
    )
    print(response.json())
```

### Using the Next.js Frontend
The frontend will automatically use this endpoint once you update the API URL.

## Configuration

### Environment Variables (Optional)

Create `.env` file in `python_backend/`:
```env
# Server
HOST=0.0.0.0
PORT=8000

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Tesseract (if not in PATH)
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

### Tesseract Configuration

For better accuracy, you can customize Tesseract settings in `main.py`:

```python
# Page Segmentation Modes (PSM):
# 3 = Fully automatic page segmentation (default)
# 6 = Assume a single uniform block of text
# 11 = Sparse text. Find as much text as possible
config = '--psm 6 --oem 3'

raw_text = pytesseract.image_to_string(processed_image, config=config)
```

## Integration with Next.js

Update your Next.js frontend to use the FastAPI backend:

```typescript
// In your Next.js component
const API_URL = process.env.NEXT_PUBLIC_OCR_API_URL || 'http://localhost:8000';

async function processImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch(`${API_URL}/api/ocr`, {
    method: 'POST',
    body: formData,
  });
  
  return await response.json();
}
```

Add to `.env.local`:
```env
NEXT_PUBLIC_OCR_API_URL=http://localhost:8000
```

## Deployment

### Option 1: Docker
```dockerfile
FROM python:3.12-slim

# Install Tesseract
RUN apt-get update && apt-get install -y tesseract-ocr

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t finbridge-ocr .
docker run -p 8000:8000 finbridge-ocr
```

### Option 2: Railway/Render
1. Create `Procfile`:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

2. Create `runtime.txt`:
   ```
   python-3.12.0
   ```

3. Deploy via Git push

## Performance

- **Average Processing Time**: 200-500ms per image
- **Accuracy**: 70-85% depending on image quality
- **Max Image Size**: 2000x2000px (auto-resized)
- **Supported Formats**: JPEG, PNG, BMP, TIFF

## Troubleshooting

### Tesseract not found
```
pytesseract.pytesseract.TesseractNotFoundError
```

**Solution:** Add Tesseract to PATH or set `tesseract_cmd`:
```python
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### CORS Errors
If frontend can't connect, check CORS origins in `main.py`:
```python
allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"]
```

### Low Accuracy
- Ensure image is high quality and well-lit
- Try different PSM modes
- Consider using EasyOCR or PaddleOCR for better accuracy

## Upgrading to Better OCR

For production, consider upgrading to:

### EasyOCR (Better Accuracy)
```bash
pip install easyocr
```

```python
import easyocr
reader = easyocr.Reader(['en'])
result = reader.readtext(image)
```

### Google Cloud Vision API (Best Accuracy)
```bash
pip install google-cloud-vision
```

## License

Part of the FinBridge project.
