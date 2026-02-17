import { prisma } from "@/lib/prisma";
import {
    handleUnexpectedError,
    createErrorResponse,
    createSuccessResponse,
    verifySession,
    handlePrismaError,
} from "@/lib/api-utils";
import { z } from "zod";

const contactSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    // New fields
    company: z.string().optional(),
    intentTags: z.any().optional(), // Flexible JSON
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
        const { id } = body; // Might be provided by offline client

        // Deterministic identity: Upsert by phone number
        const contact = await prisma.contact.upsert({
            where: { phone },
            update: {
                name: name || undefined, // Only update if provided
                email: email || undefined,
                company: company || undefined,
                intentTags: intentTags || undefined,
                // Don't update source info on existing contacts typically, or maybe update if provided?
                // For now, let's keep sourceMode/eventId/deviceId immutable or update if needed.
            },
            create: {
                id: id || undefined, // Use client ID if provided, otherwise auto-generate
                name: name || "Unknown",
                email: email || null,
                phone,
                company,
                intentTags: intentTags || undefined,
                sourceMode,
                eventId,
                deviceId,
                pendingSync: false, // Server side creates are synced by definition
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
        const { searchParams } = new URL(req.url);
        const phone = searchParams.get("phone");

        if (phone) {
            const contact = await prisma.contact.findUnique({
                where: { phone },
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

        // Default: List contacts
        const contacts = await prisma.contact.findMany({
            orderBy: { updatedAt: "desc" }, // Prisma uses property name
            take: 50,
        });

        return createSuccessResponse(contacts);
    } catch (error) {
        return handleUnexpectedError(error, "GET_CONTACTS");
    }
}
