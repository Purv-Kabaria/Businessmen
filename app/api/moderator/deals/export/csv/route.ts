import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

type PrismaWithInteraction = typeof prisma & {
    interaction: {
        findMany: (args: { where: { audioObjectKeys: { isEmpty: false } }; include: { contact: { select: { id: true; name: true; phone: true; email: true; company: true } }; createdByUser: { select: { id: true; fullName: true; email: true } } }; orderBy: { createdAt: "desc" } }) => Promise<DealExportRow[]>;
    };
};
type DealExportRow = {
    id: string;
    createdAt: Date;
    dealProfitable: boolean | null;
    dealEngaging: boolean | null;
    dealWorthy: boolean | null;
    dealRemarks?: string | null;
    contact: { id: string; name: string | null; phone: string; email: string | null; company: string | null };
    createdByUser: { id: string; fullName: string | null; email: string } | null;
};

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) return new NextResponse("Unauthorized", { status: 401 });
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) return new NextResponse("Server configuration error", { status: 500 });
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(token, secret);
        const role = (payload as { role?: string }).role;
        if (!["MODERATOR", "ADMIN"].includes(role || "")) return new NextResponse("Forbidden", { status: 403 });

        const client = prisma as PrismaWithInteraction;
        const interactions = await client.interaction.findMany({
            where: { audioObjectKeys: { isEmpty: false } },
            include: {
                contact: { select: { id: true, name: true, phone: true, email: true, company: true } },
                createdByUser: { select: { id: true, fullName: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const escapeCSV = (val: unknown): string => {
            if (val === null || val === undefined) return "";
            const s = typeof val === "object" ? JSON.stringify(val) : String(val);
            if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };

        const formatVerdict = (v: boolean | null | undefined): string => {
            if (v === true) return "Yes";
            if (v === false) return "No";
            return "";
        };

        const headers = [
            "Interaction Id",
            "Contact Name",
            "Company",
            "Phone",
            "Email",
            "Created At",
            "Profitable",
            "Engaging",
            "Worthy",
            "Remarks",
            "Captured By",
        ];

        const rows = interactions.map((item: DealExportRow) => {
            const contact = item.contact;
            const createdBy = item.createdByUser;
            return [
                escapeCSV(item.id),
                escapeCSV(contact.name),
                escapeCSV(contact.company),
                escapeCSV(contact.phone),
                escapeCSV(contact.email),
                escapeCSV(item.createdAt.toISOString()),
                escapeCSV(formatVerdict(item.dealProfitable ?? undefined)),
                escapeCSV(formatVerdict(item.dealEngaging ?? undefined)),
                escapeCSV(formatVerdict(item.dealWorthy ?? undefined)),
                escapeCSV(item.dealRemarks ?? ""),
                escapeCSV(createdBy?.fullName ?? ""),
            ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");

        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename=deal_reviews_${new Date().toISOString().split("T")[0]}.csv`,
            },
        });
    } catch (error) {
        console.error("[Deals CSV Export] Error:", error);
        return new NextResponse("Failed to export CSV", { status: 500 });
    }
}
