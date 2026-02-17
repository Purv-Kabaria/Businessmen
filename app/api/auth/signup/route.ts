import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signupSchema, UserJwtPayload } from "@/types/user";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { cookies } from "next/headers";
import {
  parseRequestBody,
  handleValidationError,
  handlePrismaError,
  handleUnexpectedError,
  createSuccessResponse,
  createErrorResponse,
  validateEnvVar,
} from "@/lib/api-utils";

export async function POST(req: Request) {
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

    const bodyResult = await parseRequestBody(req);
    if (!bodyResult.success) {
      return bodyResult.response;
    }

    const validation = signupSchema.safeParse(bodyResult.data);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { email, fullName, password, role } = validation.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return createErrorResponse(
        "USER_EXISTS",
        "An account with this email address already exists. Please use a different email or try logging in.",
        409
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          password: hashedPassword,
          ...(role && { role }),
        },
      });

      const jwtPayload: UserJwtPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      };

      const tokenExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
      const token = jwt.sign(jwtPayload, jwtSecret, {
        expiresIn: tokenExpiresIn,
      } as SignOptions);

      const maxAge = tokenExpiresIn.includes("d")
        ? parseInt(tokenExpiresIn.replace("d", "")) * 24 * 60 * 60
        : 60 * 60 * 24 * 7;

      const cookieStore = await cookies();
      cookieStore.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge,
      });

      const { password: _, ...userWithoutPassword } = user;

      return createSuccessResponse(userWithoutPassword, 201);
    } catch (error) {
      const prismaError = handlePrismaError(error);
      if (prismaError) {
        return prismaError;
      }
      throw error;
    }
  } catch (error) {
    return handleUnexpectedError(error, "SIGNUP");
  }
}
