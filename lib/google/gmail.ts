import { gmail_v1, google } from "googleapis";
import { getGoogleAuth } from "./client";

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  bodyPlain?: string;
  /** RFC Message-ID header (for In-Reply-To / References when replying). */
  messageId?: string;
}

export function getGmailClient(): gmail_v1.Gmail {
  const auth = getGoogleAuth();
  return google.gmail({ version: "v1", auth });
}

function decodeBody(data: string | undefined): string {
  if (!data) return "";
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function getPlainTextFromPayload(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.body?.data) {
    const mimeType = (payload.mimeType || "").toLowerCase();
    if (mimeType === "text/plain") return decodeBody(payload.body.data);
    if (mimeType === "text/html") return decodeBody(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const mimeType = (part.mimeType || "").toLowerCase();
      if (mimeType === "text/plain" && part.body?.data) return decodeBody(part.body.data);
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBody(part.body.data).replace(/<[^>]+>/g, " ");
      }
    }
  }
  return "";
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const h = headers.find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return h?.value;
}

export async function listMessages(options: {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
}): Promise<{ id: string; threadId: string }[]> {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: options.maxResults ?? 20,
    q: options.query,
    labelIds: options.labelIds,
  });
  const list = res.data.messages || [];
  return list.map((m) => ({ id: m.id!, threadId: m.threadId! }));
}

export async function getMessage(messageId: string): Promise<GmailMessageSummary | null> {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  const msg = res.data;
  if (!msg.id) return null;
  const payload = msg.payload;
  const bodyPlain = getPlainTextFromPayload(payload);
  const headers = payload?.headers;
  return {
    id: msg.id,
    threadId: msg.threadId!,
    labelIds: msg.labelIds as string[] | undefined,
    snippet: msg.snippet ?? undefined,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    bodyPlain: (bodyPlain || msg.snippet) ?? undefined,
    messageId: getHeader(headers, "Message-ID"),
  };
}

export async function getThread(threadId: string): Promise<GmailMessageSummary[]> {
  const gmail = getGmailClient();
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });
  const thread = res.data;
  const messages: GmailMessageSummary[] = [];
  for (const m of thread.messages || []) {
    if (!m.id) continue;
    const payload = m.payload;
    const bodyPlain = getPlainTextFromPayload(payload);
    const headers = payload?.headers;
    messages.push({
      id: m.id,
      threadId,
      labelIds: m.labelIds as string[] | undefined,
      snippet: m.snippet ?? undefined,
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      subject: getHeader(headers, "Subject"),
      date: getHeader(headers, "Date"),
      bodyPlain: (bodyPlain || m.snippet) ?? undefined,
      messageId: getHeader(headers, "Message-ID"),
    });
  }
  return messages.sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );
}

/** List inbox thread IDs (e.g. unread). Use getThread(threadId) to get messages. */
export async function listInboxThreads(options: {
  maxResults?: number;
  query?: string;
}): Promise<{ threadId: string }[]> {
  const gmail = getGmailClient();
  const res = await gmail.users.threads.list({
    userId: "me",
    maxResults: options.maxResults ?? 15,
    q: options.query ?? "in:inbox is:unread",
  });
  const threads = res.data.threads || [];
  return threads.filter((t): t is { id: string } => !!t.id).map((t) => ({ threadId: t.id }));
}

const OUR_EMAIL = process.env.GOOGLE_MEETING_SCHEDULER_OUR_EMAIL || process.env.SMTP_USER || "";

/**
 * Build RFC 2822 message and base64url-encode for Gmail API.
 */
function buildRawMessage(options: {
  from: string;
  to: string;
  subject: string;
  bodyPlain: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines: string[] = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject.replace(/\r?\n/g, " ")}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
  ];
  if (options.inReplyTo) lines.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references) lines.push(`References: ${options.references}`);
  lines.push("", options.bodyPlain);
  const raw = lines.join("\r\n");
  return Buffer.from(raw, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Send a reply in an existing Gmail thread. Uses the opposing message's Message-ID for In-Reply-To/References when provided.
 */
export async function sendReplyInThread(options: {
  threadId: string;
  to: string;
  subject: string;
  bodyPlain: string;
  /** RFC Message-ID of the message we're replying to (for proper threading). */
  inReplyToMessageId?: string;
}): Promise<{ id: string }> {
  const gmail = getGmailClient();
  const from = OUR_EMAIL || "me";
  const raw = buildRawMessage({
    from,
    to: options.to,
    subject: options.subject,
    bodyPlain: options.bodyPlain,
    inReplyTo: options.inReplyToMessageId,
    references: options.inReplyToMessageId,
  });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: options.threadId,
    },
  });
  return { id: res.data.id! };
}
