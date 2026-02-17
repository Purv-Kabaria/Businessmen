import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { Prisma } from "@prisma/client";
import { runMeetingScheduler } from "@/lib/google/meeting-scheduler";
import { isGoogleConfigured } from "@/lib/google/client";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

async function requireModerator(req: NextRequest): Promise<{ ok: true; role: string } | { ok: false; status: number; message: string }> {
  const token = req.cookies.get("token")?.value;
  if (!token) return { ok: false, status: 401, message: "Unauthorized" };
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return { ok: false, status: 500, message: "Server configuration error" };
  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jwtVerify(token, secret);
  const role = (payload as { role?: string }).role ?? "";
  if (!["MODERATOR", "ADMIN"].includes(role)) return { ok: false, status: 403, message: "Forbidden" };
  return { ok: true, role };
}

/**
 * POST /api/integrations/meeting-schedule/run
 * Runs one pass of the automatic meeting scheduler:
 * - Reads Gmail inbox (unread threads)
 * - For each thread with replies, uses Gemma to classify if the reply is positive for meeting
 * - If yes, finds the next convenient free slot and creates a Google Calendar event with Meet link
 * - Optionally invites the replier
 */
export async function POST(req: NextRequest) {
  const auth = await requireModerator(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: { message: auth.message } }, { status: auth.status });
  }

  if (!isGoogleConfigured()) {
    return createErrorResponse(
      "CONFIG_ERROR",
      "Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.",
      503
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const contacts = await prisma.contact.findMany({
      where: { email: { not: null } },
      select: { email: true },
    });
    const contactEmails = new Set(
      contacts.map((c) => c.email?.trim().toLowerCase()).filter((e): e is string => !!e)
    );
    const result = await runMeetingScheduler({
      maxThreads: body.maxThreads ?? 10,
      inboxQuery: body.inboxQuery ?? "in:inbox is:unread",
      contactEmails,
    });

    // Update follow-up status on the deal/interaction for each scheduled meeting (match by contact email)
    for (const scheduled of result.scheduled) {
      const attendeeEmail = scheduled.attendeeEmail?.trim().toLowerCase();
      if (!attendeeEmail) continue;
      try {
        const contact = await prisma.contact.findFirst({
          where: { email: { equals: attendeeEmail, mode: "insensitive" } },
          select: { id: true },
        });
        if (!contact) continue;
        const interaction = await prisma.interaction.findFirst({
          where: {
            contactId: contact.id,
            audioObjectKeys: { isEmpty: false },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (interaction) {
          await prisma.interaction.update({
            where: { id: interaction.id },
            data: { followupStatus: "Email_sent" } as Prisma.InteractionUpdateInput,
          });
        }
      } catch (err) {
        console.warn("[meeting-schedule/run] Failed to update followup for", attendeeEmail, err);
      }
    }

    return createSuccessResponse(result);
  } catch (error) {
    console.error("[meeting-schedule/run]", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Meeting scheduler failed",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET - same as POST, for cron (e.g. Vercel cron or external cron hitting with auth).
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
