import { listInboxThreads, getThread, sendReplyInThread, type GmailMessageSummary } from "./gmail";
import { findFreeSlots, createEventWithMeet } from "./calendar";

const PYTHON_BACKEND_URL = process.env.TRANSCRIBE_API_URL || process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL || "http://localhost:8000";
const OUR_EMAIL = process.env.GOOGLE_MEETING_SCHEDULER_OUR_EMAIL || process.env.SMTP_USER || "";

export interface ScheduledMeetingResult {
  threadId: string;
  subject: string;
  attendeeEmail: string | null;
  eventId: string;
  meetLink: string | null;
  start: Date;
  end: Date;
}

export interface MeetingSchedulerRunResult {
  processed: number;
  scheduled: ScheduledMeetingResult[];
  errors: string[];
}

/**
 * Extract email from "Name <email>" or plain email string.
 */
function extractEmail(from: string | undefined): string | null {
  if (!from || !from.trim()) return null;
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  if (from.includes("@")) return from.trim().toLowerCase();
  return null;
}

/**
 * Check if this message is from us (so we skip it when looking for "reply from contact").
 */
function isFromUs(msg: GmailMessageSummary): boolean {
  const from = extractEmail(msg.from);
  if (!from || !OUR_EMAIL) return false;
  return from === OUR_EMAIL.toLowerCase();
}

/**
 * Call Python backend to classify if the reply text indicates they want to meet.
 * Passes current date/time and free slots so the LLM has calendar context.
 */
async function classifyReply(
  replyText: string,
  subject?: string,
  context?: { currentDateTime: string; freeSlots: { start: Date; end: Date }[] }
): Promise<{ wantsMeeting: boolean }> {
  try {
    const body: Record<string, unknown> = {
      reply_text: replyText,
      original_subject: subject ?? undefined,
      model: "gemma3:4b",
    };
    if (context?.currentDateTime) {
      body.current_datetime = context.currentDateTime;
    }
    if (context?.freeSlots?.length) {
      body.free_slots = context.freeSlots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      }));
    }
    const res = await fetch(`${PYTHON_BACKEND_URL}/api/classify-meeting-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { wantsMeeting: !!data.wants_meeting };
    }
  } catch {
    // Fallback: simple heuristic
    const lower = replyText.toLowerCase();
    if (
      /\b(yes|sure|sounds good|let'?s meet|schedule|available|works for me|that works)\b/.test(lower) ||
      (lower.includes("meet") && !lower.includes("can't") && !lower.includes("cannot"))
    ) {
      return { wantsMeeting: true };
    }
  }
  return { wantsMeeting: false };
}

/**
 * Run one pass of the meeting scheduler: check inbox for replies from DB contacts only, classify, schedule meetings.
 * Pass contactEmails (from DB) to only process threads where the reply is from a known contact.
 */
export async function runMeetingScheduler(options: {
  maxThreads?: number;
  inboxQuery?: string;
  /** Only process threads where the reply is from one of these emails (e.g. from contacts table). */
  contactEmails?: Set<string>;
}): Promise<MeetingSchedulerRunResult> {
  const result: MeetingSchedulerRunResult = { processed: 0, scheduled: [], errors: [] };
  const contactEmails = options.contactEmails;

  const threads = await listInboxThreads({
    maxResults: options.maxThreads ?? 10,
    query: options.inboxQuery ?? "in:inbox is:unread",
  });

  // Fetch current time and free slots once so the LLM has calendar context for every classification
  const now = new Date();
  const freeSlotsForContext = await findFreeSlots({ daysAhead: 7, slotMinutes: 60 });

  for (const { threadId } of threads) {
    try {
      const messages = await getThread(threadId);
      if (messages.length < 2) continue;
      const lastMessage = messages[messages.length - 1];
      if (isFromUs(lastMessage)) continue;

      const replyFromEmail = extractEmail(lastMessage.from);
      if (contactEmails && contactEmails.size > 0) {
        if (!replyFromEmail || !contactEmails.has(replyFromEmail)) continue;
      }

      result.processed++;
      // Use only the opposing party's reply text for classification
      const replyText = (lastMessage.bodyPlain || lastMessage.snippet || "").trim();
      if (replyText.length < 10) continue;

      const subject = lastMessage.subject || messages[0]?.subject || "Follow-up";
      const { wantsMeeting } = await classifyReply(replyText, subject, {
        currentDateTime: now.toISOString(),
        freeSlots: freeSlotsForContext,
      });
      if (!wantsMeeting) continue;

      const slots = await findFreeSlots({ daysAhead: 7, slotMinutes: 60 });
      if (slots.length === 0) {
        result.errors.push(`No free slot for thread ${threadId}`);
        continue;
      }
      const slot = slots[0];
      const attendeeEmail = extractEmail(lastMessage.from);
      const event = await createEventWithMeet({
        summary: subject,
        description: `Scheduled from email reply (thread ${threadId})`,
        start: slot.start,
        end: slot.end,
        attendeeEmails: attendeeEmail ? [attendeeEmail] : undefined,
      });

      // Reply in the same thread with Meet link and date/time (to the opposing party)
      const replyTo = lastMessage.from ?? ((attendeeEmail ?? "").trim() || "");
      const dateStr = slot.start.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const timeStr = `${slot.start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} – ${slot.end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
      const meetBody = [
        "Hi,",
        "",
        "Your meeting has been scheduled:",
        "",
        `Date: ${dateStr}`,
        `Time: ${timeStr}`,
        ...(event.meetLink ? ["", `Join: ${event.meetLink}`] : []),
        "",
        "Best regards",
      ].join("\r\n");
      try {
        await sendReplyInThread({
          threadId,
          to: replyTo,
          subject,
          bodyPlain: meetBody,
          inReplyToMessageId: lastMessage.messageId,
        });
      } catch (sendErr) {
        result.errors.push(`Thread ${threadId}: failed to send reply email: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`);
      }

      result.scheduled.push({
        threadId,
        subject,
        attendeeEmail,
        eventId: event.eventId,
        meetLink: event.meetLink,
        start: slot.start,
        end: slot.end,
      });
    } catch (err) {
      result.errors.push(`${threadId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
