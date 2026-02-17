import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse } from "@/lib/api-utils";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    return digits.slice(0, 12);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

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
      contacts = await prisma.contact.findMany({
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
