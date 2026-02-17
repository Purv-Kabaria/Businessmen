import { NextRequest, NextResponse } from "next/server";
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
import {
    subHours,
    subDays,
    subMonths,
    startOfHour,
    startOfDay,
    startOfMonth,
    format,
    eachHourOfInterval,
    eachDayOfInterval,
    eachMonthOfInterval,
} from "date-fns";

export async function GET(request: NextRequest) {
    try {
        let jwtSecret: string;
        try {
            jwtSecret = validateEnvVar("JWT_SECRET");
        } catch (error) {
            return createErrorResponse(
                "CONFIGURATION_ERROR",
                "Authentication service is not properly configured.",
                500
            );
        }

        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;

        if (!token) {
            return createErrorResponse(
                "UNAUTHORIZED",
                "Authentication required.",
                401
            );
        }

        let decoded: UserJwtPayload;
        try {
            decoded = jwt.verify(token, jwtSecret) as UserJwtPayload;
        } catch (err) {
            return createErrorResponse("UNAUTHORIZED", "Invalid session.", 401);
        }

        // Allow both ADMIN and MODERATOR
        if (decoded.role !== "ADMIN" && decoded.role !== "MODERATOR") {
            return createErrorResponse("FORBIDDEN", "Access denied.", 403);
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period") || "30d";

        let startDate: Date;
        let endDate: Date = new Date();
        let interval: "hour" | "day" | "month";
        let dateFormat: string;

        switch (period) {
            case "24h":
                startDate = subHours(endDate, 24);
                interval = "hour";
                dateFormat = "HH:mm";
                break;
            case "7d":
                startDate = subDays(endDate, 7);
                interval = "day";
                dateFormat = "MMM dd";
                break;
            case "30d":
                startDate = subDays(endDate, 30);
                interval = "day";
                dateFormat = "MMM dd";
                break;
            case "1y":
                startDate = subMonths(endDate, 12);
                interval = "month";
                dateFormat = "MMM yyyy";
                break;
            default:
                startDate = subDays(endDate, 30);
                interval = "day";
                dateFormat = "MMM dd";
        }

        // Generate all intervals to ensure zero-filling
        let allIntervals: Date[];
        if (interval === "hour") {
            allIntervals = eachHourOfInterval({ start: startDate, end: endDate });
        } else if (interval === "month") {
            allIntervals = eachMonthOfInterval({ start: startDate, end: endDate });
        } else {
            allIntervals = eachDayOfInterval({ start: startDate, end: endDate });
        }

        // Initialize map with 0
        const dataMap = new Map<string, number>();
        allIntervals.forEach((date) => {
            dataMap.set(format(date, dateFormat), 0);
        });

        // Fetch users created after startDate
        const users = await prisma.user.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                },
            },
            select: {
                createdAt: true,
            },
        });

        // Aggregate counts
        users.forEach((user) => {
            let key;
            if (interval === "hour") {
                key = format(startOfHour(user.createdAt), dateFormat);
            } else if (interval === "month") {
                key = format(startOfMonth(user.createdAt), dateFormat);
            } else {
                key = format(startOfDay(user.createdAt), dateFormat);
            }

            if (dataMap.has(key)) {
                dataMap.set(key, (dataMap.get(key) || 0) + 1);
            } else {
                // Fallback for edge cases or just ignore if out of strict range (though query says gte)
                // Sometimes timezone diffs might shift it slightly, but map key format should align.
            }
        });

        const chartData = Array.from(dataMap.entries()).map(([date, count]) => ({
            date,
            count,
        }));

        return createSuccessResponse(chartData);
    } catch (error) {
        return handleUnexpectedError(error, "GET_USER_GROWTH");
    }
}
