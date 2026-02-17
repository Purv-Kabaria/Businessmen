import { NextResponse } from "next/server";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { UserJwtPayload } from "@/types/user";

/**
 * Verifies the user session from cookies
 */
export async function verifySession(): Promise<UserJwtPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) return null;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return null;

    const decoded = jwt.verify(token, jwtSecret) as UserJwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Standard API error response structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  );
}

/**
 * Creates a standardized success response
 * Default status is 200.
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Handles Zod validation errors and returns detailed error response
 */
export function handleValidationError(error: ZodError): NextResponse<ApiResponse> {
  const issues = error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return createErrorResponse(
    "VALIDATION_ERROR",
    "Invalid input data. Please check your request and try again.",
    400,
    {
      validationErrors: issues,
      fieldCount: issues.length,
    }
  );
}

/**
 * Handles Prisma database errors
 */
export function handlePrismaError(error: unknown): NextResponse<ApiResponse> | null {
  // Check if it's a Prisma error by checking for error code property
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: string }).code === "string"
  ) {
    const prismaError = error as { code: string; meta?: { target?: string[] } };
    switch (prismaError.code) {
      case "P2002":
        // Unique constraint violation
        const target = (prismaError.meta?.target as string[]) || [];
        return createErrorResponse(
          "DUPLICATE_ENTRY",
          `A record with this ${target.join(", ")} already exists.`,
          409
        );
      case "P2025":
        // Record not found
        return createErrorResponse(
          "NOT_FOUND",
          "The requested resource was not found.",
          404
        );
      case "P2003":
        // Foreign key constraint violation
        return createErrorResponse(
          "RELATION_ERROR",
          "The operation violates a database relationship constraint.",
          400
        );
      default:
        return null;
    }
  }
  return null;
}

/**
 * Safely parses JSON request body with error handling
 */
export async function parseRequestBody<T = unknown>(
  req: Request
): Promise<{ success: true; data: T } | { success: false; response: NextResponse<ApiResponse> }> {
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return {
        success: false,
        response: createErrorResponse(
          "INVALID_CONTENT_TYPE",
          "Content-Type must be application/json.",
          415
        ),
      };
    }

    const text = await req.text();
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        response: createErrorResponse(
          "EMPTY_BODY",
          "Request body is required and cannot be empty.",
          400
        ),
      };
    }

    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        response: createErrorResponse(
          "INVALID_JSON",
          "Request body contains invalid JSON. Please check your request format.",
          400
        ),
      };
    }
    if (error instanceof Error) {
      return {
        success: false,
        response: createErrorResponse(
          "PARSE_ERROR",
          `Failed to parse request body: ${error.message}`,
          400
        ),
      };
    }
    return {
      success: false,
      response: createErrorResponse(
        "PARSE_ERROR",
        "Failed to parse request body. Please try again.",
        400
      ),
    };
  }
}

/**
 * Handles unexpected errors with proper logging
 */
export function handleUnexpectedError(
  error: unknown,
  context: string
): NextResponse<ApiResponse> {
  // Log error details for debugging (in production, use proper logging service)
  console.error(`[${context}] Unexpected error:`, error);

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  const errorMessage =
    isDevelopment && error instanceof Error ? error.message : undefined;

  return createErrorResponse(
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred. Please try again later.",
    500,
    isDevelopment && errorMessage ? { details: errorMessage } : undefined
  );
}

/**
 * Validates required environment variables
 */
export function validateEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set.`);
  }
  return value;
}

