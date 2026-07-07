/**
 * POST /api/email-digest
 * Body: { recipient?: string, minScore?: number }
 * Sends an email digest of all new jobs above minScore.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendJobDigestEmail, EmailJobEntry } from "@/lib/email-sender";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const recipient = body.recipient || process.env.EMAIL_RECIPIENT || "thealibhatti@gmail.com";
    const minScore = parseInt(body.minScore || "50");

    const jobs = await db.jobPosting.findMany({
      where: {
        matchScore: { gte: minScore },
        emailedAt: null,
        status: "new",
      },
      orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        searchProfile: {
          select: { cvVariant: { select: { roleShort: true } } },
        },
        matches: {
          include: { cvVariant: { select: { roleShort: true } } },
        },
      },
    });

    if (!jobs.length) {
      return NextResponse.json({ success: false, message: "No new jobs to send. Jobs must have status 'new', not yet emailed, and match score above your filter." });
    }

    // Flatten matches — a job may match multiple CV variants
    const emailJobs: EmailJobEntry[] = [];
    for (const job of jobs) {
      if (job.matches.length > 0) {
        for (const m of job.matches) {
          emailJobs.push({
            title: job.title,
            company: job.company,
            location: job.location || "Not specified",
            url: job.url,
            matchScore: m.matchScore,
            rationale: m.rationale || "",
            cvVariant: m.cvVariant.roleShort,
            source: job.source,
          });
        }
      } else {
        emailJobs.push({
          title: job.title,
          company: job.company,
          location: job.location || "Not specified",
          url: job.url,
          matchScore: job.matchScore,
          rationale: "",
          cvVariant: job.searchProfile.cvVariant.roleShort,
          source: job.source,
        });
      }
    }

    const result = await sendJobDigestEmail({ recipient, jobs: emailJobs });

    if (result.success) {
      // Mark jobs as emailed
      await db.jobPosting.updateMany({
        where: { id: { in: jobs.map((j) => j.id) } },
        data: { emailedAt: new Date() },
      });

      // Log the digest
      await db.emailDigest.create({
        data: {
          recipient,
          subject: `Your Job Match Digest — ${emailJobs.length} opportunities found`,
          jobCount: emailJobs.length,
          jobIds: JSON.stringify(jobs.map((j) => j.id)),
        },
      });

      return NextResponse.json({ success: true, messageId: result.messageId, sent: emailJobs.length });
    } else {
      // Provide actionable setup message
      const needsSetup = result.error?.includes("RESEND_API_KEY") || result.error?.includes("SMTP") || result.error?.includes("environment variable") || result.error?.includes("No email backend");
      return NextResponse.json(
        { success: false, error: result.error, needsSetup },
        { status: needsSetup ? 503 : 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Email digest failed" }, { status: 500 });
  }
}