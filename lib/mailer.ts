import nodemailer from "nodemailer";

export function createTransport(): ReturnType<typeof nodemailer.createTransport> | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if ((!host || !port || !user || !pass) && process.env.NODE_ENV === "development") {
    console.warn("SMTP configuration missing in development. Email will not be sent.");
    return null;
  }

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMail(options: { to: string; subject: string; html: string; text?: string }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com";
  const transport = createTransport();
  if (!transport) return;
  await transport.sendMail({ from, ...options });
}


