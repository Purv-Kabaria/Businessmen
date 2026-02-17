/**
 * Fetch Gmail replies for contacts that exist in the DB only.
 * Lists inbox threads, then keeps only threads where the latest reply is from
 * an email address in the contacts table.
 *
 * Run: pnpm fetch-gmail-replies
 * Optional: pnpm fetch-gmail-replies -- --query "in:inbox is:unread" --max 20
 *
 * Requires .env: GOOGLE_*, DATABASE_URL (for contacts)
 */

import "dotenv/config";
import { listInboxThreads, getThread, type GmailMessageSummary } from "../lib/google/gmail";
import { isGoogleConfigured } from "../lib/google/client";
import { prisma } from "../lib/prisma";

function extractEmail(from: string | undefined): string {
  if (!from || !from.trim()) return "";
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return from.trim().toLowerCase();
}

/** Load all contact emails from DB (lowercase, for matching). */
async function getContactEmailsFromDb(): Promise<Set<string>> {
  const contacts = await prisma.contact.findMany({
    where: { email: { not: null } },
    select: { email: true },
  });
  const set = new Set<string>();
  for (const c of contacts) {
    const e = c.email?.trim().toLowerCase();
    if (e) set.add(e);
  }
  return set;
}

function formatMessage(msg: GmailMessageSummary, isLatestReply: boolean): string {
  const label = isLatestReply ? " [LATEST REPLY]" : "";
  const from = msg.from ?? "(unknown)";
  const date = msg.date ?? "";
  const subject = msg.subject ?? "(no subject)";
  const body = (msg.bodyPlain || msg.snippet || "").trim();
  const bodyPreview = body.length > 400 ? body.slice(0, 400) + "…" : body;
  return [
    `--- Message ${msg.id}${label} ---`,
    `From: ${from}`,
    `To: ${msg.to ?? "(unknown)"}`,
    `Date: ${date}`,
    `Subject: ${subject}`,
    ``,
    bodyPreview,
    ``,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  let query = "in:inbox";
  let maxThreads = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--query" && args[i + 1]) {
      query = args[i + 1];
      i++;
    } else if (args[i] === "--max" && args[i + 1]) {
      maxThreads = parseInt(args[i + 1], 10) || 10;
      i++;
    }
  }

  if (!isGoogleConfigured()) {
    console.error("Missing Google OAuth env. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env");
    process.exit(1);
  }

  const contactEmails = await getContactEmailsFromDb();
  console.log("Loaded %d contact email(s) from DB.\n", contactEmails.size);

  console.log("Fetching Gmail threads (query: %s, max: %d)...\n", query, maxThreads);
  const threads = await listInboxThreads({ maxResults: maxThreads, query });
  console.log("Found %d thread(s). Filtering to replies from DB contacts only...\n", threads.length);

  let shown = 0;
  for (const { threadId } of threads) {
    const messages = await getThread(threadId);
    if (messages.length === 0) continue;

    const last = messages[messages.length - 1];
    const replyFromEmail = extractEmail(last?.from);
    if (!replyFromEmail || !contactEmails.has(replyFromEmail)) continue;

    shown++;
    const subject = messages[0]?.subject ?? "(no subject)";
    console.log("========== THREAD %s ==========", threadId);
    console.log("Subject: %s (%d message(s)) | Reply from (in DB): %s\n", subject, messages.length, replyFromEmail);

    for (let i = 0; i < messages.length; i++) {
      const isLatestReply = i === messages.length - 1;
      console.log(formatMessage(messages[i], isLatestReply));
    }

    console.log("Reply from: %s", last?.from ?? "");
    console.log("Reply snippet: %s", (last?.bodyPlain || last?.snippet || "").slice(0, 200));
    console.log("\n");
  }

  console.log("Done. Showed %d thread(s) from DB contacts.", shown);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
