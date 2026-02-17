import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse } from "@/lib/api-utils";
import { normalizePhone, normalizeEmail } from "@/modules/capture/utils";

type PrismaWithContact = typeof prisma & {
  contact: {
    findMany: (args: { select: { phone: true; email: true } }) => Promise<{ phone: string; email: string | null }[]>;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = typeof body?.phone === "string" ? body.phone : "";
    const email = typeof body?.email === "string" ? body.email : undefined;
    if (!phone.trim() && !email?.trim()) {
      return createErrorResponse("VALIDATION_ERROR", "phone or email required", 400);
    }
    const normPhone = normalizePhone(phone);
    const normEmail = email?.trim() ? normalizeEmail(email) : null;
    let contacts: { phone: string; email: string | null }[] = [];
    try {
      const client = prisma as PrismaWithContact;
      contacts = await client.contact.findMany({
        select: { phone: true, email: true },
      });
    } catch {
      return createSuccessResponse({ exists: false });
    }
    const exists = contacts.some((c) => {
      if (normalizePhone(c.phone) === normPhone) return true;
      if (normEmail && c.email && normalizeEmail(c.email) === normEmail) return true;
      return false;
    });
    return createSuccessResponse({ exists });
  } catch (e) {
    return createErrorResponse("INTERNAL_ERROR", "Check failed", 500);
  }
}
