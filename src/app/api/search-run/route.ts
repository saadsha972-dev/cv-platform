/**
 * POST /api/search-run
 * Body: { profileId?: string } — if profileId omitted, runs all active profiles
 * Triggers a job search run, scores matches, and saves results.
 * 
 * v2: Inline Serper calls (no tbs filter!) for reliability.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CV_VARIANTS } from "@/lib/cv-data";

export const runtime = "nodejs";
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// COUNTRY → GEO CODE
// ---------------------------------------------------------------------------
const COUNTRY_GEO: Record<string, string> = {
  "usa": "us", "united states": "us", "germany": "de",
  "united kingdom": "uk", "uk": "uk", "australia": "au",
  "canada": "ca", "qatar": "qa", "uae": "ae",
  "saudi arabia": "sa", "kuwait": "kw", "oman": "om",
  "pakistan": "pk", "singapore": "sg", "new zealand": "nz",
};

// ---------------------------------------------------------------------------
// INLINE SERPER SEARCH — no tbs, no complex module dependency
// ---------------------------------------------------------------------------
interface RawJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
}

async function serperFetch(query: string, apiKey: string, gl: string): Promise<any[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ q: query, num: 15, hl: "en", gl }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper ${res.status}: ${text.slice(0, 150)}`);
  }
  const data = await res.json();
  return data.organic || [];
}

function parseJob(item: any, fallbackLocation: string): RawJob | null {
  const url = item.link || "";
  const rawTitle = item.title || "";
  const snippet = item.snippet || "";

  // Quick spam filter
  const check = `${rawTitle} ${url} ${snippet}`.toLowerCase();
  if (/training course|certification training|lead auditor course|iso 9001 training|course schedule/i.test(check)) return null;
  if (/\.pdf$/i.test(url) || /facebook\.com|slideserve\.com|learnerspoint\.org/i.test(check)) return null;
  if (/salary.*guide|how to become|what does a|job description template/i.test(check)) return null;
  if (/^\d+\+?\s/i.test(rawTitle)) return null;
  if (/jobs in all|browse jobs|search jobs/i.test(rawTitle)) return null;

  // LinkedIn category pages
  if (url.includes("linkedin.com/jobs/") && !url.includes("/jobs/view/") && !rawTitle.toLowerCase().includes("hiring")) return null;

  // Parse title + company
  let jobTitle = rawTitle;
  let company = "Not specified";

  const hiring = rawTitle.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
  if (hiring) {
    company = hiring[1].trim();
    jobTitle = hiring[2].trim();
  } else {
    const parts = rawTitle.split(/\s+[|\-–—]\s+/);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].trim();
      if (last && !["LinkedIn", "SEEK", "Indeed", "Glassdoor", "Google", "StepStone", "Naukrigulf", "GulfTalent", "Jooble"].includes(last)) {
        company = last;
        jobTitle = parts[0].trim();
      }
    }
  }

  // Clean source tag from title
  jobTitle = jobTitle.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|StepStone|Google).*$/i, "").trim();
  if (!jobTitle || jobTitle.length < 4) return null;

  // Detect source
  let source = "google";
  if (url.includes("linkedin.com")) source = "linkedin";
  else if (url.includes("indeed.com")) source = "indeed";
  else if (url.includes("glassdoor.com")) source = "glassdoor";
  else if (url.includes("naukrigulf.com") || url.includes("naukri.com")) source = "naukri";
  else if (url.includes("gulftalent.com")) source = "gulftalent";
  else if (url.includes("bayt.com")) source = "bayt";
  else if (url.includes("rozee.pk")) source = "rozee";

  return {
    title: jobTitle,
    company,
    location: fallbackLocation,
    url,
    description: snippet.slice(0, 800),
    source,
  };
}

// ---------------------------------------------------------------------------
// INLINE JOB SEARCH — 2-3 queries per profile, no tbs, fast
// ---------------------------------------------------------------------------
async function searchJobsForProfile(keywords: string[], countries: string[], excludeKeywords: string[]): Promise<RawJob[]> {
  const apiKey = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";
  const primaryKw = keywords[0];
  const secondKw = keywords[1];

  const queries: Array<{ q: string; gl: string }> = [];

  // 2 countries max for speed
  const countriesToSearch = countries.slice(0, 2);

  for (const country of countriesToSearch) {
    const gl = COUNTRY_GEO[country.toLowerCase().trim()] || "us";
    // Query 1: primary keyword + country (no site restriction, no tbs)
    queries.push({ q: `"${primaryKw}" jobs ${country} hiring`, gl });
    // Query 2: LinkedIn individual postings
    queries.push({ q: `site:linkedin.com/jobs/view "${primaryKw}" ${country}`, gl });
  }

  // Optional: second keyword for first country
  if (secondKw && secondKw !== primaryKw) {
    const gl = COUNTRY_GEO[countriesToSearch[0].toLowerCase().trim()] || "us";
    queries.push({ q: `"${secondKw}" jobs ${countriesToSearch[0]} hiring`, gl });
  }

  const allJobs: RawJob[] = [];
  const seenUrls = new Set<string>();
  const exclude = excludeKeywords.map(k => k.toLowerCase());

  // Execute all queries in parallel (max 6 queries = well within rate limit)
  const results = await Promise.allSettled(
    queries.map(async ({ q, gl }) => {
      try {
        const items = await serperFetch(q, apiKey, gl);
        const jobs: RawJob[] = [];
        for (const item of items) {
          const job = parseJob(item, countriesToSearch[0]);
          if (job && job.url && !seenUrls.has(job.url)) {
            // Apply exclude keywords
            const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
            if (!exclude.some(k => text.includes(k))) {
              seenUrls.add(job.url);
              jobs.push(job);
            }
          }
        }
        console.log(`[search] "${q.slice(0, 50)}..." -> ${jobs.length} jobs`);
        return jobs;
      } catch (err: any) {
        console.error(`[search] Query failed: ${err.message}`);
        return [] as RawJob[];
      }
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") allJobs.push(...r.value);
  }

  console.log(`[search] Total: ${allJobs.length} jobs for ${primaryKw}`);
  return allJobs;
}

// ---------------------------------------------------------------------------
// KEYWORD-BASED SCORING (no LLM dependency)
// ---------------------------------------------------------------------------
function scoreByKeywords(cvSkills: string[], jobTitle: string, jobDesc: string, profileKeywords: string[]): { matchScore: number; rationale: string; topKeywords: string[] } {
  const text = `${jobTitle} ${jobDesc}`.toLowerCase();
  const allSkills = [...cvSkills, ...profileKeywords].map(s => s.toLowerCase());
  const matched = allSkills.filter(s => text.includes(s) && s.length > 2);
  const unique = [...new Set(matched)];
  const score = Math.min(95, 25 + unique.length * 10);
  return {
    matchScore: score,
    rationale: `Keyword match: ${unique.slice(0, 5).join(", ") || "partial match"}.`,
    topKeywords: unique.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------
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
      console.log(`[search-run] Profile: ${profile.name}`);

      const keywords = profile.keywords.split(",").map((s) => s.trim()).filter(Boolean);
      const countries = profile.countries.split(",").map((s) => s.trim()).filter(Boolean);
      const excludeKw = profile.excludeKeywords ? profile.excludeKeywords.split(",").map((s) => s.trim()).filter(Boolean) : [];

      // Get CV skills for scoring
      const cv = CV_VARIANTS.find((c) => c.slug === profile.cvVariant.slug);
      const cvSkills = cv
        ? [...cv.sidebarPage1, ...cv.sidebarPage2].flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : i)))
        : [];

      const jobs = await searchJobsForProfile(keywords, countries, excludeKw);
      console.log(`[search-run] ${profile.name}: ${jobs.length} raw jobs`);

      if (jobs.length === 0) {
        results.push({ profile: profile.name, found: 0, saved: 0 });
        await db.searchProfile.update({ where: { id: profile.id }, data: { lastRunAt: new Date() } });
        continue;
      }

      let saved = 0;
      for (const job of jobs.slice(0, 30)) {
        // Skip duplicates
        const existing = await db.jobPosting.findFirst({
          where: { url: job.url, searchProfileId: profile.id },
        });
        if (existing) continue;

        // Score by keyword matching (fast, no LLM needed)
        const match = scoreByKeywords(cvSkills, job.title, job.description, keywords);

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

      await db.searchProfile.update({ where: { id: profile.id }, data: { lastRunAt: new Date() } });
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
        ? "API key not configured. Add SERPER_API_KEY in Vercel → Settings → Environment Variables."
        : msg,
    }, { status: 500 });
  }
}