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

type PrismaWithModels = typeof prisma & {
  user: { count: () => Promise<number> };
  contact: { count: () => Promise<number> };
  interaction: { count: () => Promise<number> };
};

export async function GET() {
  try {
    let jwtSecret: string;
    try {
      jwtSecret = validateEnvVar("JWT_SECRET");
    } catch (error) {
      return createErrorResponse(
        "CONFIGURATION_ERROR",
        "Authentication service is not properly configured. Please contact support.",
        500
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return createErrorResponse(
        "UNAUTHORIZED",
        "Authentication required. Please log in to access this resource.",
        401
      );
    }

    let decoded: UserJwtPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as UserJwtPayload;
    } catch (err) {
      const response = createErrorResponse(
        "UNAUTHORIZED",
        "Your session has expired or is invalid. Please log in again.",
        401
      );

      response.cookies.delete("token");
      return response;
    }

    if (decoded.role !== "ADMIN" && decoded.role !== "MODERATOR") {
      return createErrorResponse(
        "FORBIDDEN",
        "You do not have permission to access this resource. Admin or Moderator role required.",
        403
      );
    }

    const client = prisma as PrismaWithModels;
    const user = await client.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true },
    });

    if (!user) {
      const response = createErrorResponse(
        "NOT_FOUND",
        "The user account associated with this session no longer exists.",
        404
      );

      response.cookies.delete("token");
      return response;
    }

    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return createErrorResponse(
        "FORBIDDEN",
        "You do not have permission to access this resource. Admin or Moderator role required.",
        403
      );
    }

    const [totalUsers, totalModerators, totalAdmins, totalContacts, totalInteractions] = await Promise.all([
      client.user.count(),
      prisma.user.count({ where: { role: "MODERATOR" } }),
      client.user.count({ where: { role: "ADMIN" } }),
      client.contact.count(),
      client.interaction.count(),
    ]);

    const analytics = {
      totalUsers,
      totalModerators,
      totalAdmins,
      totalContacts,
      totalInteractions,
    };

    return createSuccessResponse(analytics);
  } catch (error) {
    return handleUnexpectedError(error, "GET_ANALYTICS");
  }
}
