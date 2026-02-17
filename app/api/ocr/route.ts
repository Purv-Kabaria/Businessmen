import { NextRequest, NextResponse } from "next/server";

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

        console.log(`Sending image to Ollama (${OLLAMA_MODEL}) at ${OLLAMA_HOST}...`);

        const prompt = `
      Analyze this business card image and extract the following information:
      - Name
      - Phone Number
      - Email Address
      - Company Name

      The phone number should only have 10 digits, for example: 1234567890.
      Return ONLY a JSON object with the following keys: "name", "phone", "email", "company". 
      Do not add any markdown blocks or explanations. Just the raw JSON string. There should only be one number, email address, and company name.
    `;

        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                images: [base64Image],
                stream: false,
                format: "json", // Enforce JSON mode if supported by model version
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Ollama API Error:", errorText);
            return NextResponse.json(
                { success: false, error: `Ollama Error: ${response.statusText}` },
                { status: 500 }
            );
        }

        const data = await response.json();
        let rawResponse = data.response;

        // Clean up response if it contains markdown code blocks
        rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        let extractedData;
        try {
            extractedData = JSON.parse(rawResponse);
        } catch (e) {
            console.error("Failed to parse Ollama response:", rawResponse);
            return NextResponse.json(
                { success: false, error: "Failed to parse OCR result" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data: extractedData });
    } catch (error: any) {
        console.error("OCR Route Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
