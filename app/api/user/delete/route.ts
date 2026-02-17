import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { UserJwtPayload } from "@/types/user";
import {
  handleUnexpectedError,
  handlePrismaError,
  createSuccessResponse,
  createErrorResponse,
  validateEnvVar,
} from "@/lib/api-utils";

type DeleteUserRequest = {
  userId?: string;
};

export async function DELETE(req: Request) {
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

    const actor = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!actor) {
      const response = createErrorResponse(
        "NOT_FOUND",
        "The user account associated with this session no longer exists.",
        404
      );
      response.cookies.delete("token");
      return response;
    }

    let targetUserId: string | undefined;

    try {
      const bodyText = await req.text();
      if (bodyText && bodyText.trim().length > 0) {
        const body = JSON.parse(bodyText) as DeleteUserRequest;
        if (body.userId && typeof body.userId === "string") {
          targetUserId = body.userId;
        } else if (body.userId !== undefined) {
          return createErrorResponse(
            "INVALID_PAYLOAD",
            "The provided userId must be a string.",
            400
          );
        }
      }
    } catch (error) {
      return createErrorResponse(
        "INVALID_JSON",
        "Request body contains invalid JSON. Please check your request format.",
        400
      );
    }

    const targetId = targetUserId ?? decoded.id;
    const isSelfDeletion = targetId === decoded.id;

    if (!isSelfDeletion && actor.role !== "ADMIN") {
      return createErrorResponse(
        "FORBIDDEN",
        "Only administrators can delete other user accounts.",
        403
      );
    }

    const targetUser = isSelfDeletion
      ? actor
      : await prisma.user.findUnique({ where: { id: targetId } });

    if (!targetUser) {
      return createErrorResponse(
        "NOT_FOUND",
        "The user account you are trying to delete does not exist.",
        404
      );
    }

    try {
      await prisma.user.delete({
        where: { id: targetId },
      });

      const response = createSuccessResponse({
        message: isSelfDeletion
          ? "Your account has been deleted successfully."
          : "The user account has been deleted successfully.",
        userId: targetId,
      });

      if (isSelfDeletion) {
        response.cookies.delete("token");
      }

      return response;
    } catch (error) {
      const prismaError = handlePrismaError(error);
      if (prismaError) {
        return prismaError;
      }
      throw error;
    }
  } catch (error) {
    return handleUnexpectedError(error, "DELETE_USER");
  }
}
