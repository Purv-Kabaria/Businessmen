import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { signupSchema, UserJwtPayload } from "@/types/user";
import bcrypt from "bcryptjs";
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

    if (decoded.role !== "ADMIN") {
      return createErrorResponse(
        "FORBIDDEN",
        "You do not have permission to create users. Admin role required.",
        403
      );
    }

    const user = await prisma.user.findUnique({
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

    if (user.role !== "ADMIN") {
      return createErrorResponse(
        "FORBIDDEN",
        "You do not have permission to create users. Admin role required.",
        403
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
        "An account with this email address already exists. Please use a different email.",
        409
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          password: hashedPassword,
          ...(role && { role }),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return createSuccessResponse(newUser, 201);
    } catch (error) {
      const prismaError = handlePrismaError(error);
      if (prismaError) {
        return prismaError;
      }
      throw error;
    }
  } catch (error) {
    return handleUnexpectedError(error, "CREATE_USER");
  }
}

