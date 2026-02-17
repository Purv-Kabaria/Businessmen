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

        const { name, email, phone } = validation.data;

        // Deterministic identity: Upsert by phone number
        const contact = await prisma.contact.upsert({
            where: { phone },
            update: {
                name: name || undefined,
                email: email || undefined,
            },
            create: {
                name,
                email: email || null,
                phone,
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
