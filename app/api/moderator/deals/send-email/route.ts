import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";

const COMPANY_NAME = "FinIdeas";
const PYTHON_BACKEND_URL = process.env.TRANSCRIBE_API_URL || process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL || "http://localhost:8000";

async function requireModerator(req: NextRequest) {
    const token = req.cookies.get("token")?.value;
    if (!token) return { ok: false as const, status: 401, message: "Unauthorized" };
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return { ok: false as const, status: 500, message: "Server configuration error" };
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as { role?: string }).role;
    if (!["MODERATOR", "ADMIN"].includes(role || "")) return { ok: false as const, status: 403, message: "Forbidden" };
    return { ok: true as const };
}

/** Fallback when Gemma3 is unavailable. */
function buildFallbackEmail(contactName: string | null, contactCompany: string | null): { subject: string; html: string; text: string } {
    const name = contactName?.trim() || "there";
    const company = contactCompany?.trim() ? ` at ${contactCompany}` : "";
    const subject = `${COMPANY_NAME} – Follow-up`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hi ${escapeHtml(name)},</p>
  <p>Thank you for connecting with us. We at <strong>${escapeHtml(COMPANY_NAME)}</strong> appreciate the time you took${company} to speak with us.</p>
  <p>We’d love to stay in touch and share how we can support your goals. If you have any questions or would like to schedule a follow-up, please don’t hesitate to reach out.</p>
  <p>Best regards,<br><strong>The ${escapeHtml(COMPANY_NAME)} Team</strong></p>
</body>
</html>`;
    const text = `Hi ${name},\n\nThank you for connecting with us. We at ${COMPANY_NAME} appreciate the time you took${company} to speak with us.\n\nWe'd love to stay in touch and share how we can support your goals. If you have any questions or would like to schedule a follow-up, please don't hesitate to reach out.\n\nBest regards,\nThe ${COMPANY_NAME} Team`;
    return { subject, html, text };
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
    const auth = await requireModerator(req);
    if (!auth.ok) return NextResponse.json({ success: false, error: { message: auth.message } }, { status: auth.status });

    try {
        const body = await req.json().catch(() => ({}));
        const interactionId = body.interactionId ?? body.id;
        if (!interactionId || typeof interactionId !== "string") {
            return createErrorResponse("VALIDATION_ERROR", "interactionId is required", 400);
        }

        const interaction = await prisma.interaction.findUnique({
            where: { id: interactionId },
            select: {
                id: true,
                transcript: true,
                structuredSnapshot: true,
                contact: { select: { name: true, email: true, company: true } },
            },
        });
        if (!interaction) return createErrorResponse("NOT_FOUND", "Interaction not found", 404);

        const email = interaction.contact?.email?.trim();
        if (!email) {
            return createErrorResponse("VALIDATION_ERROR", "This contact has no email address.", 400);
        }

        const snapshot = interaction.structuredSnapshot as { summary?: string; action_items?: string[] } | null;
        const summary = snapshot?.summary ?? null;
        const actionItems = Array.isArray(snapshot?.action_items) ? snapshot.action_items : null;
        let subject: string;
        let html: string;
        let text: string;

        try {
            const genRes = await fetch(`${PYTHON_BACKEND_URL}/api/generate-followup-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contact_name: interaction.contact?.name ?? null,
                    contact_company: interaction.contact?.company ?? null,
                    transcript: interaction.transcript ?? null,
                    summary: summary ?? null,
                    action_items: actionItems ?? null,
                    model: "gemma3:4b",
                }),
            });
            const genData = await genRes.json().catch(() => ({}));
            if (genRes.ok && genData.success && genData.subject && (genData.body_html || genData.body_plain)) {
                subject = genData.subject;
                const plain = genData.body_plain ?? "";
                html = genData.body_html ?? plain.split(/\n\n+/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("");
                text = plain || (genData.body_html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "");
            } else {
                const fallback = buildFallbackEmail(interaction.contact?.name ?? null, interaction.contact?.company ?? null);
                subject = fallback.subject;
                html = fallback.html;
                text = fallback.text;
            }
        } catch {
            const fallback = buildFallbackEmail(interaction.contact?.name ?? null, interaction.contact?.company ?? null);
            subject = fallback.subject;
            html = fallback.html;
            text = fallback.text;
        }

        await sendMail({ to: email, subject, html, text });

        await prisma.interaction.update({
            where: { id: interactionId },
            data: { followupStatus: "Email_sent" },
        });

        return createSuccessResponse({ sent: true, to: email });
    } catch (error) {
        console.error("[moderator/deals/send-email]", error);
        return NextResponse.json(
            { success: false, error: { message: "Failed to send email. Check SMTP configuration." } },
            { status: 500 }
        );
    }
}
