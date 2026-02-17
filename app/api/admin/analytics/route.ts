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

export async function GET() {
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

        const [
            totalUsers,
            totalModerators,
            totalAdmins,
            totalContacts,
            totalInteractions,
            totalFollowUps,
            interactionsWithAudio,
            dealReviewsSettled,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: "MODERATOR" } }),
            prisma.user.count({ where: { role: "ADMIN" } }),
            prisma.contact.count(),
            prisma.interaction.count(),
            prisma.followUp.count(),
            prisma.interaction.count({
                where: { audioObjectKeys: { isEmpty: false } },
            }),
            prisma.interaction.count({
                where: {
                    OR: [
                        { dealProfitable: { not: null } },
                        { dealEngaging: { not: null } },
                        { dealWorthy: { not: null } },
                        { dealRemarks: { not: null } },
                    ],
                },
            }),
        ]);

        return createSuccessResponse({
            totalUsers,
            totalModerators,
            totalAdmins,
            totalContacts,
            totalInteractions,
            totalFollowUps,
            interactionsWithAudio,
            dealReviewsSettled,
        });
    } catch (error) {
        return handleUnexpectedError(error, "GET_ADMIN_ANALYTICS");
    }
}
