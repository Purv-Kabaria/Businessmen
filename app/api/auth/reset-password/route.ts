import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/types/user";
import bcrypt from "bcryptjs";
import {
  parseRequestBody,
  handleValidationError,
  handlePrismaError,
  handleUnexpectedError,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-utils";

export async function POST(req: Request) {
  try {
    const bodyResult = await parseRequestBody(req);
    if (!bodyResult.success) {
      return bodyResult.response;
    }

    const validation = resetPasswordSchema.safeParse(bodyResult.data);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { email, token, password } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return createErrorResponse(
        "USER_NOT_FOUND",
        "No user found with the provided email.",
        404
      );
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { token, userId: user.id },
    });

    if (!resetToken) {
      return createErrorResponse(
        "INVALID_TOKEN",
        "The password reset token is invalid. Please request a new password reset link.",
        400
      );
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken
        .delete({
          where: { id: resetToken.id },
        })
        .catch(() => {});

      return createErrorResponse(
        "EXPIRED_TOKEN",
        "The password reset token has expired. Please request a new password reset link.",
        400
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      return createSuccessResponse({
        message:
          "Your password has been reset successfully. You can now log in with your new password.",
      });
    } catch (error) {
      const prismaError = handlePrismaError(error);
      if (prismaError) {
        return prismaError;
      }
      throw error;
    }
  } catch (error) {
    return handleUnexpectedError(error, "RESET_PASSWORD");
  }
}
