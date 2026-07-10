/**
 * Email Sender Module
 * ===================
 * Sends HTML email digests with shortlisted job postings.
 * Tries multiple backends in order:
 *   1. Resend (RESEND_API_KEY) — easiest, free 100 emails/day
 *   2. Nodemailer SMTP (SMTP_USER + SMTP_PASS) — for Gmail/etc
 *
 * RESEND SETUP (recommended):
 *   1. Sign up at https://resend.com (free tier = 100 emails/day)
 *   2. Get API key from https://resend.com/api-keys
 *   3. Set RESEND_API_KEY in Vercel Environment Variables
 *   4. Verify your sender domain or use the free onboarding domain
 *
 * SMTP SETUP (alternative, e.g. Gmail):
 *   1. Create Gmail App Password: https://myaccount.google.com/apppasswords
 *   2. Set SMTP_USER (your Gmail) and SMTP_PASS (the App Password)
 */

import nodemailer from "nodemailer";

export interface EmailJobEntry {
  title: string;
  company: string;
  location: string;
  url: string;
  matchScore: number;
  rationale: string;
  cvVariant: string;
  source: string;
}

export interface SendDigestParams {
  recipient: string;
  jobs: EmailJobEntry[];
  recipientName?: string;
}

// ---------------------------------------------------------------------------
// METHOD 1: Resend API (recommended — no App Password needed)
// ---------------------------------------------------------------------------
async function sendViaResend(params: SendDigestParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not set" };
  }

  const recipientName = params.recipientName || params.recipient.split("@")[0];
  const html = buildEmailHtml(params.jobs, recipientName);
  const subject = `Your Job Match Digest — ${params.jobs.length} opportunities found`;
  const fromEmail = process.env.RESEND_FROM || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `CV Platform <${fromEmail}>`,
      to: [params.recipient],
      subject,
      html,
    }),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    return { success: false, error: `Resend API ${res.status}: ${data.message || data.error?.message || JSON.stringify(data).slice(0, 200)}` };
  }

  return { success: true, messageId: data.id };
}

// ---------------------------------------------------------------------------
// METHOD 2: Nodemailer SMTP (Gmail / custom SMTP)
// ---------------------------------------------------------------------------
async function sendViaSmtp(params: SendDigestParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  if (!pass) {
    return { success: false, error: "SMTP_PASS not set" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: true,
    auth: { user, pass },
  });

  const recipientName = params.recipientName || params.recipient.split("@")[0];
  const html = buildEmailHtml(params.jobs, recipientName);
  const subject = `Your Job Match Digest — ${params.jobs.length} opportunities found`;

  const info = await transporter.sendMail({
    from: `"CV Platform" <${user}>`,
    to: params.recipient,
    subject,
    html,
  });

  return { success: true, messageId: info.messageId };
}

// ---------------------------------------------------------------------------
// HTML TEMPLATE
// ---------------------------------------------------------------------------
const buildEmailHtml = (jobs: EmailJobEntry[], recipientName: string): string => {
  const grouped: Record<string, EmailJobEntry[]> = {};
  for (const job of jobs) {
    if (!grouped[job.cvVariant]) grouped[job.cvVariant] = [];
    grouped[job.cvVariant].push(job);
  }
  for (const variant of Object.keys(grouped)) {
    grouped[variant].sort((a, b) => b.matchScore - a.matchScore);
  }

  const sections = Object.entries(grouped)
    .map(([variant, jobs]) => {
      const jobCards = jobs
        .map(
          (job) => `
        <tr>
          <td style="padding:16px;border-bottom:1px solid #e5e7eb;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <div>
                <div style="font-size:16px;font-weight:600;color:#1b365d;">${escapeHtml(job.title)}</div>
                <div style="font-size:13px;color:#606774;margin-top:2px;">${escapeHtml(job.company)} · ${escapeHtml(job.location)} · <span style="text-transform:uppercase;font-size:11px;color:#8c7853;">${escapeHtml(job.source)}</span></div>
              </div>
              <div style="font-size:18px;font-weight:700;color:${job.matchScore >= 80 ? "#16a34a" : job.matchScore >= 60 ? "#d97706" : "#6b7280"};min-width:50px;text-align:right;">${job.matchScore}%</div>
            </div>
            <div style="font-size:13px;color:#374151;line-height:1.5;margin-top:8px;">${escapeHtml(job.rationale)}</div>
            <a href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;padding:6px 14px;background:#1b365d;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">View Job →</a>
          </td>
        </tr>`
        )
        .join("");

      return `
        <div style="margin-bottom:32px;">
          <h2 style="font-size:14px;font-weight:700;color:#8c7853;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px 0;padding-bottom:8px;border-bottom:2px solid #8c7853;">${escapeHtml(variant)} · ${jobs.length} jobs</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${jobCards}</table>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:#1b365d;padding:24px 32px;">
        <h1 style="margin:0;font-size:22px;color:#fff;font-weight:600;">Your Job Match Digest</h1>
        <p style="margin:4px 0 0 0;font-size:13px;color:#cbd5e0;">${jobs.length} shortlisted opportunities for ${escapeHtml(recipientName)}</p>
      </div>
      <div style="padding:24px 32px;">
        ${sections}
      </div>
      <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#6b7280;">Generated by your CV Tailor & Job Hunter platform · ${new Date().toLocaleString()}</p>
      </div>
    </div>
  </div>
</body></html>`;
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// ---------------------------------------------------------------------------
// COMPOSITE SENDER — tries Resend first, then SMTP
// ---------------------------------------------------------------------------
export const sendJobDigestEmail = async (params: SendDigestParams): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  if (!params.jobs.length) {
    return { success: false, error: "No jobs to send" };
  }

  const errors: string[] = [];

  // Try 1: Resend API
  const resendResult = await sendViaResend(params);
  if (resendResult.success) return resendResult;
  errors.push(`Resend: ${resendResult.error || "failed"}`);

  // Try 2: SMTP
  const smtpResult = await sendViaSmtp(params);
  if (smtpResult.success) return smtpResult;
  errors.push(`SMTP: ${smtpResult.error || "failed"}`);

  // All failed
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasSmtp = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  let hint: string;
  if (!hasResend && !hasSmtp) {
    hint = "No email backend configured. Add RESEND_API_KEY (get one free at https://resend.com/api-keys) or SMTP_USER + SMTP_PASS (Gmail App Password) in Vercel Settings → Environment Variables.";
  } else {
    hint = `All email methods failed:\n${errors.join("\n")}`;
  }

  return { success: false, error: hint };
};