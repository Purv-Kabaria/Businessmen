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

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

type SortableField = "createdAt" | "updatedAt" | "email" | "fullName" | "role";
type SortOrder = "asc" | "desc";

interface PaginationParams {
  page: number;
  limit: number;
}

interface FilterParams {
  role?: "USER" | "MODERATOR" | "ADMIN";
  email?: string;
  fullName?: string;
  search?: string;
}

interface SortParams {
  sortBy: SortableField;
  sortOrder: SortOrder;
}

function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const page = Math.max(
    1,
    parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10) ||
      DEFAULT_PAGE
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT
    )
  );

  return { page, limit };
}

function parseFilterParams(searchParams: URLSearchParams): FilterParams {
  const role = searchParams.get("role") as
    | "USER"
    | "MODERATOR"
    | "ADMIN"
    | null;
  const email = searchParams.get("email")?.trim() || undefined;
  const fullName = searchParams.get("fullName")?.trim() || undefined;
  const search = searchParams.get("search")?.trim() || undefined;

  const filters: FilterParams = {};

  if (role && ["USER", "MODERATOR", "ADMIN"].includes(role)) {
    filters.role = role;
  }

  if (email) {
    filters.email = email;
  }

  if (fullName) {
    filters.fullName = fullName;
  }

  if (search) {
    filters.search = search;
  }

  return filters;
}

function parseSortParams(searchParams: URLSearchParams): SortParams {
  const sortableFields: SortableField[] = [
    "createdAt",
    "updatedAt",
    "email",
    "fullName",
    "role",
  ];
  const sortBy = (searchParams.get("sortBy") || "createdAt") as SortableField;
  const sortOrder = (searchParams.get("sortOrder") || "desc") as SortOrder;

  return {
    sortBy: sortableFields.includes(sortBy) ? sortBy : "createdAt",
    sortOrder: sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc",
  };
}

function buildWhereClause(
  filters: FilterParams,
  requesterRole: "ADMIN" | "MODERATOR"
) {
  const where: Record<string, unknown> = {};
  const conditions: Record<string, unknown>[] = [];

  if (requesterRole === "MODERATOR") {
    conditions.push({ role: "USER" });
  }

  if (filters.role && requesterRole === "ADMIN") {
    conditions.push({ role: filters.role });
  }

  if (filters.search) {
    conditions.push({
      OR: [
        { email: { contains: filters.search, mode: "insensitive" } },
        { fullName: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  } else {
    if (filters.email) {
      conditions.push({
        email: { contains: filters.email, mode: "insensitive" },
      });
    }

    if (filters.fullName) {
      conditions.push({
        fullName: { contains: filters.fullName, mode: "insensitive" },
      });
    }
  }

  if (conditions.length === 0) {
    return where;
  } else if (conditions.length === 1) {
    return conditions[0] as Record<string, unknown>;
  } else {
    where.AND = conditions;
    return where;
  }
}

function buildOrderByClause(sortParams: SortParams) {
  return {
    [sortParams.sortBy]: sortParams.sortOrder,
  };
}

export async function GET(request: Request) {
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

    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return createErrorResponse(
        "FORBIDDEN",
        "You do not have permission to access this resource. Admin or Moderator role required.",
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePaginationParams(searchParams);
    const filters = parseFilterParams(searchParams);
    const sortParams = parseSortParams(searchParams);
    const skip = (page - 1) * limit;

    const where = buildWhereClause(filters, user.role);
    const orderBy = buildOrderByClause(sortParams);

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const paginationData = {
      users,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      filters: {
        role: filters.role || null,
        email: filters.email || null,
        fullName: filters.fullName || null,
        search: filters.search || null,
      },
      sort: {
        sortBy: sortParams.sortBy,
        sortOrder: sortParams.sortOrder,
      },
    };

    return createSuccessResponse(paginationData);
  } catch (error) {
    return handleUnexpectedError(error, "GET_USER_ALL");
  }
}
