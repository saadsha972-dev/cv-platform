/**
 * POST /api/search-run
 * Body: { profileId?: string } — if profileId omitted, runs all active profiles
 * Triggers a job search run, scores matches, and saves results.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchJobs } from "@/lib/job-search";
import { scoreJobMatch } from "@/lib/llm-tailor";
import { CV_VARIANTS } from "@/lib/cv-data";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // Check if required API keys are set
    const missing: string[] = [];
    if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY");
    if (!process.env.SERPER_API_KEY) missing.push("SERPER_API_KEY");

    if (missing.length) {
      return NextResponse.json({
        success: false,
        needsSetup: true,
        error: `Missing API keys: ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables.`,
        setup: {
          GROQ_API_KEY: "Free at https://console.groq.com/keys — used for AI job scoring",
          SERPER_API_KEY: "Free at https://serper.dev — used for Google job search (2,500 free queries/month)",
        },
      }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { profileId } = body as { profileId?: string };

    const where = profileId ? { id: profileId, isActive: true } : { isActive: true };
    const profiles = await db.searchProfile.findMany({
      where,
      include: { cvVariant: true },
    });

    if (!profiles.length) {
      return NextResponse.json({ error: "No search profiles found" }, { status: 404 });
    }

    const results: Array<{ profile: string; found: number; saved: number }> = [];

    for (const profile of profiles) {
      console.log(`[search-run] Running profile: ${profile.name}`);

      const config = {
        keywords: profile.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        countries: profile.countries.split(",").map((s) => s.trim()).filter(Boolean),
        excludeKeywords: profile.excludeKeywords ? profile.excludeKeywords.split(",").map((s) => s.trim()).filter(Boolean) : [],
        cvVariantSlug: profile.cvVariant.slug,
        cvVariantRoleShort: profile.cvVariant.roleShort,
      };

      // Search for jobs
      const jobs = await searchJobs(config);
      console.log(`[search-run] Found ${jobs.length} raw results for ${profile.name}`);

      if (jobs.length === 0) {
        results.push({ profile: profile.name, found: 0, saved: 0 });
        await db.searchProfile.update({
          where: { id: profile.id },
          data: { lastRunAt: new Date() },
        });
        continue;
      }

      // Score each job and save
      let saved = 0;
      for (const job of jobs.slice(0, 15)) {
        const existing = await db.jobPosting.findFirst({
          where: { url: job.url, searchProfileId: profile.id },
        });
        if (existing) continue;

        const match = await scoreJobMatch(
          CV_VARIANTS.find((c) => c.slug === profile.cvVariant.slug)!,
          job.title,
          job.description,
          config.keywords
        );

        const created = await db.jobPosting.create({
          data: {
            searchProfileId: profile.id,
            title: job.title,
            company: job.company,
            location: job.location || "Not specified",
            url: job.url,
            description: job.description,
            source: job.source,
            matchScore: match.matchScore,
            keywords: JSON.stringify(match.topKeywords),
            status: "new",
          },
        });

        await db.jobMatch.create({
          data: {
            jobPostingId: created.id,
            cvVariantId: profile.cvVariant.id,
            matchScore: match.matchScore,
            rationale: match.rationale,
          },
        }).catch(() => {});

        saved++;
      }

      await db.searchProfile.update({
        where: { id: profile.id },
        data: { lastRunAt: new Date() },
      });

      results.push({ profile: profile.name, found: jobs.length, saved });
    }

    const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);

    if (totalSaved === 0) {
      return NextResponse.json({
        success: false,
        error: "No new jobs found. Try again later or adjust your search profile keywords.",
        results,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[search-run] Error:", err);
    const msg = err.message || "Search failed";
    const isKeyError = msg.includes("GROQ_API_KEY") || msg.includes("SERPER_API_KEY");
    return NextResponse.json({
      error: isKeyError
        ? "API key not configured. Add GROQ_API_KEY and SERPER_API_KEY in Vercel → Settings → Environment Variables."
        : msg,
    }, { status: 500 });
  }
}