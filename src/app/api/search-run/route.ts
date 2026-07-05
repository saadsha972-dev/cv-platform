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

      // Score each job and save
      let saved = 0;
      for (const job of jobs.slice(0, 15)) {
        // Skip if URL already exists for this profile
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

        // Create a JobMatch record linking to this CV variant
        await db.jobMatch.create({
          data: {
            jobPostingId: created.id,
            cvVariantId: profile.cvVariant.id,
            matchScore: match.matchScore,
            rationale: match.rationale,
          },
        }).catch(() => {}); // ignore unique constraint errors

        saved++;
      }

      // Update lastRunAt
      await db.searchProfile.update({
        where: { id: profile.id },
        data: { lastRunAt: new Date() },
      });

      results.push({ profile: profile.name, found: jobs.length, saved });

      // If we found 0 jobs, it's likely due to rate limiting
      if (jobs.length === 0) {
        results[results.length - 1].rateLimited = true;
      }
    }

    const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
    const anyRateLimited = results.some((r: any) => r.rateLimited);

    // If all profiles returned 0 jobs, return a helpful error message
    if (totalSaved === 0 && anyRateLimited) {
      return NextResponse.json({
        success: false,
        error: "The web search API is rate-limited right now. Please wait 5-10 minutes and try again. The search runs 3 queries per profile, and the API needs time to reset between searches.",
        results,
      }, { status: 429 });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[search-run] Error:", err);
    const errorMsg = err?.message?.includes("429") || err?.message?.includes("Too many requests")
      ? "The web search API is rate-limited. Please wait 5-10 minutes and try again."
      : err.message || "Search failed";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
