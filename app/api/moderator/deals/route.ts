import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";

type PrismaWithInteraction = typeof prisma & {
    interaction: {
        findMany: (args: { where: { audioObjectKeys: { isEmpty: false } }; include: { contact: { select: { id: true; name: true; phone: true; email: true; company: true } }; createdByUser: { select: { id: true; fullName: true; email: true } } }; orderBy: { createdAt: "desc" }; skip: number; take: number }) => Promise<DealRow[]>;
        count: (args: { where: { audioObjectKeys: { isEmpty: false } } }) => Promise<number>;
        update: (args: { where: { id: string }; data: { dealProfitable?: boolean | null; dealEngaging?: boolean | null; dealWorthy?: boolean | null; dealRemarks?: string | null }; select: { id: true; dealProfitable: true; dealEngaging: true; dealWorthy: true; dealRemarks: true } }) => Promise<{ id: string; dealProfitable: boolean | null; dealEngaging: boolean | null; dealWorthy: boolean | null; dealRemarks: string | null }>;
    };
};
type DealRow = {
    id: string;
    createdAt: Date;
    dealProfitable: boolean | null;
    dealEngaging: boolean | null;
    dealWorthy: boolean | null;
    dealRemarks: string | null;
    contact: { id: string; name: string | null; phone: string; email: string | null; company: string | null };
    createdByUser: { id: string; fullName: string | null; email: string };
};

async function requireModerator(req: NextRequest) {
    const token = req.cookies.get("token")?.value;
    if (!token) return { ok: false, status: 401, message: "Unauthorized" };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return { ok: false, status: 500, message: "Server configuration error" };
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as { role?: string }).role ?? "";
    if (!["MODERATOR", "ADMIN"].includes(role)) return { ok: false, status: 403, message: "Forbidden" };
    return { ok: true, role };
}

async function requireAdmin(req: NextRequest): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const auth = await requireModerator(req);
    if (!auth.ok) return auth;
    if (auth.role !== "ADMIN") return { ok: false, status: 403, message: "Admin only" };
    return { ok: true };
}

export async function GET(req: NextRequest) {
    const auth = await requireModerator(req);
    if (!auth.ok) return NextResponse.json({ success: false, error: { message: auth.message } }, { status: auth.status });

    try {
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
        const skip = (page - 1) * limit;

        const client = prisma as PrismaWithInteraction;
        const [rows, total] = await Promise.all([
            client.interaction.findMany({
                where: { audioObjectKeys: { isEmpty: false } },
                include: {
                    contact: { select: { id: true, name: true, phone: true, email: true, company: true } },
                    createdByUser: { select: { id: true, fullName: true, email: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            client.interaction.count({ where: { audioObjectKeys: { isEmpty: false } } }),
        ]);

        const interactions = rows.map((r) => ({
            id: r.id,
            createdAt: r.createdAt.toISOString(),
            dealProfitable: r.dealProfitable,
            dealEngaging: r.dealEngaging,
            dealWorthy: r.dealWorthy,
            dealRemarks: r.dealRemarks,
            followupStatus: (r as { followupStatus?: string | null }).followupStatus ?? null,
            contact: r.contact,
            createdBy: r.createdByUser,
        }));

        return createSuccessResponse({
            interactions,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("[moderator/deals GET]", error);
        return NextResponse.json({ success: false, error: { message: "Failed to fetch deals" } }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const auth = await requireModerator(req);
    if (!auth.ok) return NextResponse.json({ success: false, error: { message: auth.message } }, { status: auth.status });
    const isAdmin = auth.role === "ADMIN";

    try {
        const body = await req.json().catch(() => ({}));
        const interactionId = body.interactionId ?? body.id;
        if (!interactionId || typeof interactionId !== "string") {
            return createErrorResponse("VALIDATION_ERROR", "interactionId is required", 400);
        }

        const update: {
            dealProfitable?: boolean | null;
            dealEngaging?: boolean | null;
            dealWorthy?: boolean | null;
            dealRemarks?: string | null;
            followupStatus?: string | null;
        } = {};
        if (body.dealProfitable !== undefined) update.dealProfitable = body.dealProfitable === null ? null : !!body.dealProfitable;
        if (body.dealEngaging !== undefined) update.dealEngaging = body.dealEngaging === null ? null : !!body.dealEngaging;
        if (body.dealWorthy !== undefined) update.dealWorthy = body.dealWorthy === null ? null : !!body.dealWorthy;
        if (body.dealRemarks !== undefined) update.dealRemarks = body.dealRemarks === null || body.dealRemarks === "" ? null : String(body.dealRemarks);
        if (body.followupStatus !== undefined) {
            const v = body.followupStatus === null || body.followupStatus === "" ? null : String(body.followupStatus);
            if (v != null && !["Met", "Email_sent", "Closed", "Rejected"].includes(v)) {
                return createErrorResponse("VALIDATION_ERROR", "followupStatus must be Met, Email_sent, Closed, or Rejected", 400);
            }
            update.followupStatus = v;
        }

        if (Object.keys(update).length === 0 && !(isAdmin && body.contact)) {
            return createErrorResponse("VALIDATION_ERROR", "At least one deal or contact field is required", 400);
        }

        if (isAdmin && body.contact && typeof body.contact === "object") {
            const interaction = await prisma.interaction.findUnique({ where: { id: interactionId }, select: { contactId: true } });
            if (!interaction) return createErrorResponse("NOT_FOUND", "Interaction not found", 404);
            const contactUpdate: { name?: string | null; email?: string | null; company?: string | null; phone?: string } = {};
            if (body.contact.name !== undefined) contactUpdate.name = body.contact.name === null || body.contact.name === "" ? null : String(body.contact.name);
            if (body.contact.email !== undefined) contactUpdate.email = body.contact.email === null || body.contact.email === "" ? null : String(body.contact.email);
            if (body.contact.company !== undefined) contactUpdate.company = body.contact.company === null || body.contact.company === "" ? null : String(body.contact.company);
            if (body.contact.phone !== undefined) contactUpdate.phone = String(body.contact.phone).trim();
            if (Object.keys(contactUpdate).length > 0) {
                await prisma.contact.update({ where: { id: interaction.contactId }, data: contactUpdate });
            }
        }

        const followupStatusValue = update.followupStatus;
        const { followupStatus: _fs, ...dealUpdate } = update;

        if (followupStatusValue !== undefined) {
            await prisma.$executeRaw`UPDATE interactions SET followup_status = ${followupStatusValue} WHERE id = ${interactionId}`;
        }

        const client = prisma as PrismaWithInteraction;
        const interaction = await client.interaction.update({
            where: { id: interactionId },
            data: dealUpdate,
            select: { id: true, dealProfitable: true, dealEngaging: true, dealWorthy: true, dealRemarks: true },
        });
        const result = { ...interaction, followupStatus: followupStatusValue ?? null };

        return createSuccessResponse(result);
    } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2025") {
            return createErrorResponse("NOT_FOUND", "Interaction not found", 404);
        }
        console.error("[moderator/deals PATCH]", error);
        return NextResponse.json({ success: false, error: { message: "Failed to update deal" } }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ success: false, error: { message: auth.message } }, { status: auth.status });

    try {
        const { searchParams } = new URL(req.url);
        const interactionId = searchParams.get("interactionId");
        if (!interactionId || typeof interactionId !== "string") {
            return createErrorResponse("VALIDATION_ERROR", "interactionId is required", 400);
        }
        await prisma.aiJob.deleteMany({ where: { interactionId } });
        await prisma.interaction.delete({ where: { id: interactionId } });
        return createSuccessResponse({ deleted: true, id: interactionId });
    } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2025") {
            return createErrorResponse("NOT_FOUND", "Interaction not found", 404);
        }
        console.error("[moderator/deals DELETE]", error);
        return NextResponse.json({ success: false, error: { message: "Failed to delete" } }, { status: 500 });
    }
}
