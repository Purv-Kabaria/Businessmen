import { calendar_v3, google } from "googleapis";
import { getGoogleAuth } from "./client";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

export function getCalendarClient(): calendar_v3.Calendar {
  const auth = getGoogleAuth();
  return google.calendar({ version: "v3", auth });
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

/**
 * Find free slots in the next N days (business hours 9–17 by default).
 * Uses freebusy to avoid double-booking.
 */
export async function findFreeSlots(options: {
  daysAhead?: number;
  slotMinutes?: number;
  startHour?: number;
  endHour?: number;
}): Promise<TimeSlot[]> {
  const cal = getCalendarClient();
  const now = new Date();
  const daysAhead = options.daysAhead ?? 5;
  const slotMinutes = options.slotMinutes ?? 60;
  const startHour = options.startHour ?? 9;
  const endHour = options.endHour ?? 17;

  const timeMin = new Date(now);
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + daysAhead);

  const freebusy = await cal.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busy = freebusy.data.calendars?.[CALENDAR_ID]?.busy || [];
  const slots: TimeSlot[] = [];

  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(timeMin);
    day.setDate(day.getDate() + d);
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekend

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        const start = new Date(day);
        start.setHours(h, m, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + slotMinutes);
        if (start < now) continue;
        if (end > timeMax) continue;

        const overlaps = busy.some(
          (b) =>
            (b.start && b.end && new Date(b.start) < end && new Date(b.end) > start)
        );
        if (!overlaps) slots.push({ start, end });
      }
    }
  }

  return slots.slice(0, 10);
}

/**
 * Create a calendar event with a Google Meet link.
 */
export async function createEventWithMeet(options: {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmails?: string[];
}): Promise<{ eventId: string; meetLink: string | null; htmlLink: string | null }> {
  const cal = getCalendarClient();
  const requestId = `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const res = await cal.events.insert({
    calendarId: CALENDAR_ID,
    conferenceDataVersion: 1,
    requestBody: {
      summary: options.summary,
      description: options.description ?? "",
      start: {
        dateTime: options.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
      end: {
        dateTime: options.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
      attendees: options.attendeeEmails?.map((email) => ({ email })) ?? [],
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const event = res.data;
  const meetLink =
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
      ?.uri ?? null;
  return {
    eventId: event.id!,
    meetLink,
    htmlLink: event.htmlLink ?? null,
  };
}
