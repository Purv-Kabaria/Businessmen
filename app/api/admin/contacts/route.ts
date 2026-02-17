import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { UserJwtPayload } from "@/types/user";
import {
    createSuccessResponse,
    createErrorResponse,
    handleUnexpectedError,
    validateEnvVar,
} from "@/lib/api-utils";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
    try {
        const jwtSecret = validateEnvVar("JWT_SECRET");
        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;
        if (!token) {
            return createErrorResponse("UNAUTHORIZED", "Authentication required.", 401);
        }
        let decoded: UserJwtPayload;
        try {
            decoded = jwt.verify(token, jwtSecret) as UserJwtPayload;
        } catch {
            return createErrorResponse("UNAUTHORIZED", "Invalid or expired session.", 401);
        }
        if (decoded.role !== "ADMIN") {
            return createErrorResponse("FORBIDDEN", "Admin access required.", 403);
        }
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, role: true },
        });
        if (!user || user.role !== "ADMIN") {
            return createErrorResponse("FORBIDDEN", "Admin access required.", 403);
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
        const limit = Math.min(
            MAX_LIMIT,
            Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
        );
        const search = searchParams.get("search")?.trim() || undefined;

        const where = search
            ? {
                  OR: [
                      { phone: { contains: search, mode: "insensitive" as const } },
                      { name: { contains: search, mode: "insensitive" as const } },
                      { email: { contains: search, mode: "insensitive" as const } },
                      { company: { contains: search, mode: "insensitive" as const } },
                  ],
              }
            : undefined;

        const [contacts, total] = await Promise.all([
            prisma.contact.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: { _count: { select: { interactions: true } } },
            }),
            prisma.contact.count({ where }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / limit));

        return createSuccessResponse({
            contacts,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        });
    } catch (error) {
        return handleUnexpectedError(error, "GET_ADMIN_CONTACTS");
    }
}
