import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";

async function requireModerator(req: NextRequest) {
    const token = req.cookies.get("token")?.value;
    if (!token) return { ok: false as const, status: 401, message: "Unauthorized" };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return { ok: false as const, status: 500, message: "Server configuration error" };
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as { role?: string }).role;
    if (!["MODERATOR", "ADMIN"].includes(role || "")) return { ok: false as const, status: 403, message: "Forbidden" };
    return { ok: true as const };
}

export async function GET(req: NextRequest) {
    const auth = await requireModerator(req);
    if (!auth.ok) return NextResponse.json({ success: false, error: { message: auth.message } }, { status: auth.status });

    try {
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
        const skip = (page - 1) * limit;

        const [rows, total] = await Promise.all([
            prisma.interaction.findMany({
                where: { audioObjectKeys: { isEmpty: false } },
                include: {
                    contact: { select: { id: true, name: true, phone: true, email: true, company: true } },
                    createdByUser: { select: { id: true, fullName: true, email: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.interaction.count({ where: { audioObjectKeys: { isEmpty: false } } }),
        ]);

        const interactions = rows.map((r) => ({
            id: r.id,
            createdAt: r.createdAt.toISOString(),
            dealProfitable: r.dealProfitable,
            dealEngaging: r.dealEngaging,
            dealWorthy: r.dealWorthy,
            dealRemarks: r.dealRemarks,
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

    try {
        const body = await req.json().catch(() => ({}));
        const interactionId = body.interactionId ?? body.id;
        if (!interactionId || typeof interactionId !== "string") {
            return createErrorResponse("VALIDATION_ERROR", "interactionId is required", 400);
        }

        const update: { dealProfitable?: boolean | null; dealEngaging?: boolean | null; dealWorthy?: boolean | null; dealRemarks?: string | null } = {};
        if (body.dealProfitable !== undefined) update.dealProfitable = body.dealProfitable === null ? null : !!body.dealProfitable;
        if (body.dealEngaging !== undefined) update.dealEngaging = body.dealEngaging === null ? null : !!body.dealEngaging;
        if (body.dealWorthy !== undefined) update.dealWorthy = body.dealWorthy === null ? null : !!body.dealWorthy;
        if (body.dealRemarks !== undefined) update.dealRemarks = body.dealRemarks === null || body.dealRemarks === "" ? null : String(body.dealRemarks);

        if (Object.keys(update).length === 0) {
            return createErrorResponse("VALIDATION_ERROR", "At least one deal field is required", 400);
        }

        const interaction = await prisma.interaction.update({
            where: { id: interactionId },
            data: update,
            select: { id: true, dealProfitable: true, dealEngaging: true, dealWorthy: true, dealRemarks: true },
        });

        return createSuccessResponse(interaction);
    } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2025") {
            return createErrorResponse("NOT_FOUND", "Interaction not found", 404);
        }
        console.error("[moderator/deals PATCH]", error);
        return NextResponse.json({ success: false, error: { message: "Failed to update deal" } }, { status: 500 });
    }
}
