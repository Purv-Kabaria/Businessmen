import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

type InteractionRow = { transcript: string | null; structuredSnapshot: unknown; createdAt: Date };
type ContactWithInteractions = {
    name: string | null;
    company: string | null;
    currentStage: string;
    intentTags: unknown;
    interactions: InteractionRow[];
};
type PrismaWithContact = typeof prisma & {
    contact: {
        findUnique: (args: { where: { id: string }; include: { interactions: { take: number; orderBy: { createdAt: "desc" }; select: { transcript: true; structuredSnapshot: true; createdAt: true } } } }) => Promise<ContactWithInteractions | null>;
    };
};

export async function POST(req: NextRequest) {
    try {
        // 1. Auth Check
        const token = req.cookies.get("token")?.value;
        if (!token) return new NextResponse("Unauthorized", { status: 401 });

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) return new NextResponse("Config Error", { status: 500 });

        const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
        const userRole = (payload as { role?: string }).role;
        if (!userRole || !["MODERATOR", "ADMIN"].includes(userRole)) return new NextResponse("Forbidden", { status: 403 });

        // 2. Parse Body
        const { contactId } = await req.json();
        if (!contactId) return new NextResponse("Missing contactId", { status: 400 });

        const client = prisma as PrismaWithContact;
        const contact = await client.contact.findUnique({
            where: { id: contactId },
            include: {
                interactions: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        transcript: true,
                        structuredSnapshot: true,
                        createdAt: true,
                        // type is not in schema model shown above, checking schema again.
                        // Interaction schema doesn't have 'type'.
                        // It has 'audioObjectKeys', 'transcript', etc.
                        // I used 'type' in my previous code.
                    }
                }
            }
        });

        if (!contact) return new NextResponse("Contact not found", { status: 404 });

        // Create a rich context summary for the LLM
        let contextSummary = `Contact: ${contact.name} (${contact.company || 'Unknown Company'})\nStage: ${contact.currentStage}\nIntent Tags: ${JSON.stringify(contact.intentTags || [])}\n\nRecent History:\n`;

        contact.interactions.forEach((i) => {
            const summary = (i.structuredSnapshot as { summary?: string } | null)?.summary ?? i.transcript?.substring(0, 200) ?? "No content";
            contextSummary += `- [${new Date(i.createdAt).toISOString().split('T')[0]}]: ${summary}\n`;
        });

        // 4. Call Python Simulation Service
        const pythonUrl = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';
        const simResponse = await fetch(`${pythonUrl}/api/simulation/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contact_id: contactId,
                context_summary: contextSummary
            })
        });

        if (!simResponse.ok) {
            const errText = await simResponse.text();
            throw new Error(`Python Simulation Failed: ${errText}`);
        }

        const strategyData = await simResponse.json();

        return NextResponse.json({
            success: true,
            data: strategyData
        });

    } catch (error: unknown) {
        console.error("[API/Simulate] Error:", error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Simulation failed" }, { status: 500 });
    }
}
