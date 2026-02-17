import { prisma } from "@/lib/prisma";
import {
    handleUnexpectedError,
    createErrorResponse,
    createSuccessResponse,
    verifySession,
    handlePrismaError,
} from "@/lib/api-utils";
import { normalizePhone } from "@/modules/capture/utils";
import { z } from "zod";

type PrismaWithContact = typeof prisma & {
    contact: {
        upsert: (args: { where: { phone: string }; update: Record<string, unknown>; create: Record<string, unknown> }) => Promise<unknown>;
        findUnique: (args: { where: { phone: string }; include?: { interactions: { orderBy: { createdAt: "desc" }; take: number } } }) => Promise<unknown>;
        findMany: (args: { orderBy: { updatedAt: "desc" }; take: number; include?: { _count: { select: { interactions: true } } } }) => Promise<unknown>;
    };
};

const contactSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    company: z.string().optional(),
    intentTags: z.unknown().optional(),
    sourceMode: z.string().default("manual"),
    eventId: z.string().optional(),
    deviceId: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const session = await verifySession();
        if (!session) {
            return createErrorResponse("UNAUTHORIZED", "You must be logged in to manage contacts", 401);
        }

        const body = await req.json();
        const validation = contactSchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse("VALIDATION_ERROR", validation.error.issues[0].message, 400);
        }

        const { name, email, phone, company, intentTags, sourceMode, eventId, deviceId } = validation.data;
        const { id } = body;
        const normalizedPhone = normalizePhone(phone);

        const client = prisma as PrismaWithContact;
        const contact = await client.contact.upsert({
            where: { phone: normalizedPhone },
            update: {
                name: name ?? undefined,
                email: email ?? undefined,
                company: company ?? undefined,
                intentTags: intentTags ?? undefined,
            },
            create: {
                id: id || undefined,
                name: name || "Unknown",
                email: email || null,
                phone: normalizedPhone,
                company,
                intentTags: intentTags ?? undefined,
                sourceMode,
                eventId,
                deviceId,
                pendingSync: false,
            },
        });

        return createSuccessResponse(contact);
    } catch (error) {
        const prismaError = handlePrismaError(error);
        if (prismaError) return prismaError;
        return handleUnexpectedError(error, "UPSERT_CONTACT");
    }
}

export async function GET(req: Request) {
    try {
        const client = prisma as PrismaWithContact;
        const { searchParams } = new URL(req.url);
        const phone = searchParams.get("phone");

        if (phone) {
            const normalizedPhone = normalizePhone(phone);
            const contact = await client.contact.findUnique({
                where: { phone: normalizedPhone },
                include: {
                    interactions: {
                        orderBy: { createdAt: "desc" }, // Prisma uses property name, not DB map name
                        take: 10,
                    },
                },
            });

            if (!contact) {
                return createErrorResponse("NOT_FOUND", "Contact not found", 404);
            }

            return createSuccessResponse(contact);
        }

        const contacts = await client.contact.findMany({
            orderBy: { updatedAt: "desc" },
            take: 50,
            include: {
                _count: { select: { interactions: true } },
            },
        });

        return createSuccessResponse(contacts);
    } catch (error) {
        return handleUnexpectedError(error, "GET_CONTACTS");
    }
}
