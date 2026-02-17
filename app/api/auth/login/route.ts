import { prisma } from "@/lib/prisma";
import { loginSchema, UserJwtPayload } from "@/types/user";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { cookies } from "next/headers";
import {
  parseRequestBody,
  handleValidationError,
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

    const validation = loginSchema.safeParse(bodyResult.data);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      await bcrypt.compare(
        password,
        "$2a$12$dummy.hash.to.prevent.timing.attacks"
      );
      return createErrorResponse(
        "INVALID_CREDENTIALS",
        "The email or password you entered is incorrect. Please check your credentials and try again.",
        401
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return createErrorResponse(
        "INVALID_CREDENTIALS",
        "The email or password you entered is incorrect. Please check your credentials and try again.",
        401
      );
    }

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

    return createSuccessResponse(userWithoutPassword);
  } catch (error) {
    return handleUnexpectedError(error, "LOGIN");
  }
}
