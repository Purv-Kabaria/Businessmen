import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { UserJwtPayload, UserRole } from "@/types/user";
import {
  parseRequestBody,
  handleValidationError,
  handlePrismaError,
  handleUnexpectedError,
  createSuccessResponse,
  createErrorResponse,
  validateEnvVar,
} from "@/lib/api-utils";
import { z } from "zod";
import bcrypt from "bcryptjs";

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const updateUserSchema = z.object({
  userId: z.string().optional(),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters.")
    .optional(),
  email: z.string().email("Please enter a valid email address.").optional(),
  role: UserRole.optional(),
  currentPassword: z
    .string()
    .min(1, "Current password is required.")
    .optional(),
  newPassword: z
    .string()
    .regex(
      passwordRegex,
      "Password must be 8+ chars, with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol."
    )
    .optional(),
  confirmNewPassword: z.string().optional(),
});

export async function PUT(req: Request) {
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

    const bodyResult = await parseRequestBody(req);
    if (!bodyResult.success) {
      return bodyResult.response;
    }

    const validation = updateUserSchema.safeParse(bodyResult.data);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const updateData = validation.data;
    const {
      userId: requestedUserId,
      currentPassword,
      confirmNewPassword,
      ...fields
    } = updateData;

    const hasUpdatableField = [
      fields.fullName,
      fields.email,
      fields.role,
      fields.newPassword,
    ].some((value) => value !== undefined);

    if (!hasUpdatableField) {
      return createErrorResponse(
        "NO_UPDATES",
        "At least one field must be provided for update.",
        400
      );
    }

    const targetUserId = requestedUserId ?? decoded.id;
    const isSelfUpdate = targetUserId === decoded.id;

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });
    if (!currentUser) {
      const response = createErrorResponse(
        "NOT_FOUND",
        "The user account associated with this session no longer exists.",
        404
      );
      response.cookies.delete("token");
      return response;
    }

    if (!isSelfUpdate && decoded.role !== "ADMIN") {
      return createErrorResponse(
        "FORBIDDEN",
        "You do not have permission to modify other user accounts.",
        403
      );
    }

    const targetUser = isSelfUpdate
      ? currentUser
      : await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      return createErrorResponse(
        "NOT_FOUND",
        "The user account you are trying to update does not exist.",
        404
      );
    }

    const updatePayload: Record<string, unknown> = {};

    if (fields.email) {
      const normalizedEmail = fields.email.toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser && existingUser.id !== targetUserId) {
        return createErrorResponse(
          "USER_EXISTS",
          "An account with this email address already exists. Please use a different email.",
          409
        );
      }
      updatePayload.email = normalizedEmail;
    }

    if (fields.role) {
      if (decoded.role !== "ADMIN") {
        return createErrorResponse(
          "FORBIDDEN",
          "You do not have permission to change user roles.",
          403
        );
      }
      updatePayload.role = fields.role;
    }

    let hashedPassword: string | undefined = undefined;
    if (fields.newPassword) {
      if (isSelfUpdate) {
        if (!currentPassword || !confirmNewPassword) {
          return createErrorResponse(
            "INVALID_PAYLOAD",
            "To change your password you must provide currentPassword, newPassword, and confirmNewPassword.",
            400
          );
        }

        if (fields.newPassword !== confirmNewPassword) {
          return createErrorResponse(
            "PASSWORD_MISMATCH",
            "Passwords don't match.",
            400
          );
        }

        // We know currentUser exists because of previous check
        const isCurrentPasswordValid = await bcrypt.compare(
          currentPassword,
          currentUser!.password
        );

        if (!isCurrentPasswordValid) {
          return createErrorResponse(
            "INVALID_CREDENTIALS",
            "Current password is incorrect.",
            401
          );
        }
        hashedPassword = await bcrypt.hash(fields.newPassword, 12);
      } else {
        // Not self update - check administrative privileges
        if (decoded.role !== "ADMIN") {
          return createErrorResponse(
            "FORBIDDEN",
            "You do not have permission to change other users' passwords.",
            403
          );
        }
        // Admin can set password directly without current password
        hashedPassword = await bcrypt.hash(fields.newPassword, 12);
      }
    }


    if (fields.fullName) {
      updatePayload.fullName = fields.fullName.trim();
    }

    if (hashedPassword) {
      updatePayload.password = hashedPassword;
    }

    if (Object.keys(updatePayload).length === 0) {
      return createErrorResponse(
        "NO_UPDATES",
        "No valid updates were provided.",
        400
      );
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: updatePayload,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return createSuccessResponse(updatedUser);
    } catch (error) {
      const prismaError = handlePrismaError(error);
      if (prismaError) {
        return prismaError;
      }
      throw error;
    }
  } catch (error) {
    return handleUnexpectedError(error, "UPDATE_USER");
  }
}
