import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        // 1. Verify authentication and role
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return new NextResponse("Server configuration error", { status: 500 });
        }

        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(token, secret);
        const userRole = (payload as any).role;

        // Only MODERATOR and ADMIN can access
        if (!["MODERATOR", "ADMIN"].includes(userRole)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // 2. Fetch all lead data with interactions
        const interactions = await prisma.interaction.findMany({
            include: {
                contact: true,
                createdByUser: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // 3. Helper for CSV escaping
        const escapeCSV = (val: any): string => {
            if (val === null || val === undefined) return "";
            let s = typeof val === 'object' ? JSON.stringify(val) : String(val);
            if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        // 4. Define CSV headers
        const headers = [
            "Lead Name",
            "Phone",
            "Email",
            "Company",
            "Interests/Tags",
            "Current Stage",
            "Transcription",
            "Summary",
            "Captured By",
            "Capture Date",
            "Source Mode"
        ];

        // 5. Generate CSV rows
        const rows = interactions.map(item => {
            const contact = item.contact;
            const summary = (item.structuredSnapshot as any)?.summary || "";

            // Format intent tags
            let tagsStr = "";
            if (contact.intentTags) {
                if (Array.isArray(contact.intentTags)) {
                    tagsStr = contact.intentTags.join(", ");
                } else if (typeof contact.intentTags === 'object') {
                    tagsStr = JSON.stringify(contact.intentTags);
                }
            }

            return [
                escapeCSV(contact.name),
                escapeCSV(contact.phone),
                escapeCSV(contact.email),
                escapeCSV(contact.company),
                escapeCSV(tagsStr),
                escapeCSV(contact.currentStage),
                escapeCSV(item.transcript),
                escapeCSV(summary),
                escapeCSV(item.createdByUser?.fullName),
                escapeCSV(item.createdAt.toISOString()),
                escapeCSV(contact.sourceMode)
            ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");

        // 6. Return as downloadable file
        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename=leads_export_${new Date().toISOString().split('T')[0]}.csv`,
            },
        });

    } catch (error: any) {
        console.error("[CSV Export] Error:", error);
        return new NextResponse("Failed to export CSV", { status: 500 });
    }
}
