import { NextRequest, NextResponse } from "next/server";

// Regex patterns for common business card data
const PHONE_PATTERNS = [
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // US/International format
    /\d{10}/g, // Plain 10 digits
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g, // 123-456-7890 or 123.456.7890
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const URL_PATTERN = /(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/g;

/**
 * Extract structured data using regex patterns
 */
function extractWithRegex(text: string) {
    const phones: string[] = [];
    const emails: string[] = [];
    const urls: string[] = [];

    // Extract emails
    const emailMatches = text.match(EMAIL_PATTERN);
    if (emailMatches) {
        emails.push(...emailMatches);
    }

    // Extract phones
    for (const pattern of PHONE_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
            phones.push(...matches.map(p => p.replace(/\D/g, ''))); // Remove non-digits
        }
    }

    // Extract URLs/domains
    const urlMatches = text.match(URL_PATTERN);
    if (urlMatches) {
        urls.push(...urlMatches);
    }

    return {
        phones: [...new Set(phones)], // Remove duplicates
        emails: [...new Set(emails)],
        urls: [...new Set(urls)],
    };
}

/**
 * Clean and normalize phone number to 10 digits
 */
function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    // If it's 11 digits starting with 1, remove the 1 (US country code)
    if (digits.length === 11 && digits.startsWith('1')) {
        return digits.slice(1);
    }
    // If it's exactly 10 digits, return as is
    if (digits.length === 10) {
        return digits;
    }
    return phone; // Return original if can't normalize
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("image") as File;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No image provided" },
                { status: 400 }
            );
        }

        // Convert File to Base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");

        // Configurable model name
        const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
        const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

        console.log(`[OCR] Processing with ${OLLAMA_MODEL} at ${OLLAMA_HOST}...`);

        // Step 1: First pass - extract raw text from the image
        const textExtractionPrompt = `Extract ALL visible text from this business card image. 
Return the text exactly as it appears, line by line. Do not format or interpret it, just extract the raw text.`;

        const textResponse = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: textExtractionPrompt,
                images: [base64Image],
                stream: false,
            }),
        });

        if (!textResponse.ok) {
            const errorText = await textResponse.text();
            console.error("[OCR] Text extraction failed:", errorText);
            return NextResponse.json(
                { success: false, error: `OCR Error: ${textResponse.statusText}` },
                { status: 500 }
            );
        }

        const textData = await textResponse.json();
        const rawText = textData.response || "";

        console.log("[OCR] Extracted raw text:", rawText.substring(0, 200));

        // Step 2: Use regex to extract structured data
        const regexMatches = extractWithRegex(rawText);

        console.log("[OCR] Regex matches:", {
            phones: regexMatches.phones,
            emails: regexMatches.emails,
            urls: regexMatches.urls,
        });

        // Step 3: Use LLM to validate and enhance the data
        const enhancementPrompt = `You are analyzing a business card. Here is the extracted text and some pattern matches:

RAW TEXT:
${rawText}

REGEX MATCHES:
- Potential Phone Numbers: ${regexMatches.phones.join(', ') || 'none found'}
- Potential Emails: ${regexMatches.emails.join(', ') || 'none found'}
- Potential URLs/Domains: ${regexMatches.urls.join(', ') || 'none found'}

Based on this information, extract and validate:
1. "name": The person's full name (first and last name)
2. "phone": The most likely phone number (10 digits only, no formatting)
3. "email": The most likely email address
4. "company": The company/organization name

IMPORTANT RULES:
- For phone: Choose the most likely MOBILE or BUSINESS number, return exactly 10 digits
- For email: Prefer professional/work emails over personal domains
- For company: Extract the business name, not personal names
- If you can't find a field with confidence, set it to an empty string ""

Return ONLY a valid JSON object with these exact keys: "name", "phone", "email", "company"
Do not include any markdown, explanation, or additional text.`;

        const enhancementResponse = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: enhancementPrompt,
                stream: false,
                format: "json",
            }),
        });

        if (!enhancementResponse.ok) {
            const errorText = await enhancementResponse.text();
            console.error("[OCR] Enhancement failed:", errorText);
            return NextResponse.json(
                { success: false, error: `Enhancement Error: ${enhancementResponse.statusText}` },
                { status: 500 }
            );
        }

        const enhancementData = await enhancementResponse.json();
        let rawResponse = enhancementData.response;

        // Clean up response if it contains markdown code blocks
        rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        let extractedData;
        try {
            extractedData = JSON.parse(rawResponse);

            // Post-process: Normalize phone number
            if (extractedData.phone) {
                extractedData.phone = normalizePhone(extractedData.phone);
            }

            console.log("[OCR] Final extracted data:", extractedData);

        } catch (e) {
            console.error("[OCR] Failed to parse LLM response:", rawResponse);

            // Fallback: Try to construct from regex matches
            extractedData = {
                name: "",
                phone: regexMatches.phones[0] ? normalizePhone(regexMatches.phones[0]) : "",
                email: regexMatches.emails[0] || "",
                company: "",
            };

            console.log("[OCR] Using fallback regex data:", extractedData);
        }

        return NextResponse.json({ success: true, data: extractedData });
    } catch (error: any) {
        console.error("[OCR] Route Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
