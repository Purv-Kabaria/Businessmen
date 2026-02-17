import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/types/user";
import crypto from "crypto";
import { sendMail } from "@/lib/mailer";
import {
  parseRequestBody,
  handleValidationError,
  handlePrismaError,
  handleUnexpectedError,
  createSuccessResponse,
} from "@/lib/api-utils";

export async function POST(req: Request) {
  try {
    const bodyResult = await parseRequestBody(req);
    if (!bodyResult.success) {
      return bodyResult.response;
    }

    const validation = forgotPasswordSchema.safeParse(bodyResult.data);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { email } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      try {
        await prisma.passwordResetToken.deleteMany({
          where: { userId: user.id },
        });
        // Generate 6-digit numeric OTP
        const token = (Math.floor(100000 + Math.random() * 900000)).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.passwordResetToken.create({
          data: {
            token,
            expiresAt,
            userId: user.id,
          },
        });

        // Send OTP email (best-effort; do not reveal account existence)
        try {
          const appName = process.env.APP_NAME || "Odoo";
          await sendMail({
            to: user.email,
            subject: `${appName} Password Reset Code`,
            html: `
              <p>Hello ${user.fullName || "there"},</p>
              <p>Your ${appName} password reset code is:</p>
              <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${token}</p>
              <p>This code will expire in 10 minutes. If you didn't request this, you can ignore this email.</p>
            `,
            text: `Your ${appName} password reset code is ${token}. It expires in 10 minutes.`,
          });
        } catch (e) {
          // Intentionally ignore mail errors to avoid leaking info
          console.error("Failed to send reset email", e);
        }
      } catch (error) {
        const prismaError = handlePrismaError(error);
        if (prismaError) {
          console.error("Failed to create reset token:", error);
        } else {
          throw error;
        }
      }
    }

    return createSuccessResponse({
      message:
        "If an account with this email exists, a password reset link has been sent. Please check your inbox.",
    });
  } catch (error) {
    return handleUnexpectedError(error, "FORGOT_PASSWORD");
  }
}
