import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CV_VARIANTS, getCvBySlug } from "@/lib/cv-data";
import type { CvData } from "@/lib/cv-data";
export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";
const MAX_AGE_DAYS = 21;

// ---------------------------------------------------------------------------
// FAST LOCAL KEYWORD SCORING (no LLM dependency for bulk search)
// ---------------------------------------------------------------------------
function quickScore(cv: CvData, jobTitle: string, snippet: string, profileKeywords: string[]): number {
  const cvText = [
    cv.roleTitle,
    cv.summary,
    ...cv.sidebarPage1.flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : String(i)))),
    ...cv.sidebarPage2.flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : String(i)))),
  ]
    .join(" ")
    .toLowerCase();

  const allCvWords = new Set(cvText.split(/[\s,;|/()\-–—]+/).filter((w) => w.length > 2));
  profileKeywords.forEach((k) => {
    const lower = k.toLowerCase().trim();
    if (lower.length > 1) allCvWords.add(lower);
  });

  const jobText = `${jobTitle} ${snippet}`.toLowerCase();

  let matches = 0;
  for (const word of allCvWords) {
    if (jobText.includes(word)) {
      matches++;
    }
  }

  const checked = allCvWords.size || 1;
  const overlapPct = (matches / checked) * 100;

  // Title match bonus
  const titleWords = jobTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  let titleMatches = 0;
  for (const tw of titleWords) {
    if (cvText.includes(tw)) titleMatches++;
  }

  const titleBonus = titleMatches * 5;
  return Math.min(95, Math.round(overlapPct * 0.7 + titleBonus + 25));
}

// ---------------------------------------------------------------------------
// SERPER SEARCH
// ---------------------------------------------------------------------------
async function serperSearch(query: string, gl: string, num = 15): Promise<any[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": SERPER_KEY },
    body: JSON.stringify({ q: query, num, hl: "en", gl, tbs: "qdr:w" }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  return (await res.json()).organic || [];
}

// ---------------------------------------------------------------------------
// FRESHNESS CHECK
// ---------------------------------------------------------------------------
function isFresh(item: any): boolean {
  // Serper returns relative dates like "1 day ago", "10 hours ago", "3 days ago"
  // NOT parseable date strings. new Date("1 day ago") = Invalid Date (no throw!).
  const dateStr = (item.date || "").toString().trim();

  // Parse relative patterns: "X hours/minutes/days/weeks ago"
  const relMatch = dateStr.match(/(\d+)\s+(hour|minute|day|week)s?\s+ago/i);
  if (relMatch) {
    const num = parseInt(relMatch[1]);
    const unit = relMatch[2].toLowerCase();
    if (unit === "minute") return true;                         // always fresh
    if (unit === "hour") return num <= MAX_AGE_DAYS * 24;      // within days
    if (unit === "day") return num <= MAX_AGE_DAYS;
    if (unit === "week") return num <= Math.ceil(MAX_AGE_DAYS / 7);
    return true;
  }

  // If it's an absolute date string (e.g. "Jul 10, 2026"), validate it properly
  if (dateStr && !relMatch) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const ageMs = Date.now() - d.getTime();
      return ageMs >= 0 && ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    }
  }

  // Also check snippet for "X days ago" as fallback
  const snippet = item.snippet || "";
  const snippetDays = snippet.match(/(\d+)\s+days?\s+ago/i);
  if (snippetDays) {
    return parseInt(snippetDays[1]) <= MAX_AGE_DAYS;
  }

  // No date info — since we use tbs: "qdr:w" (past week), assume fresh
  return true;
}

// ---------------------------------------------------------------------------
// SKIP PATTERNS
// ---------------------------------------------------------------------------
const SKIP_PATTERNS = [
  /training course/i, /certification/i, /how to become/i, /salary guide/i,
  /youtube\.com/i, /linkedin\.com\/learning/i, /browse jobs/i, /page \d/i,
  /indeed\.com\/career/i, /glassdoor\.com\/Salary/i, /payscale\.com/i,
  /wikipedia\.org/i, /reddit\.com/i, /quora\.com/i,
  /\d+\s+\w+\s+jobs?\s+available/i, /jobs?\s+employment/i,
  /hiring\s+now\s+on\s+indeed/i, /search\s+results/i,
  /zeeMaps/i, /yelp\.com/i, /tripadvisor/i, /amazon\.com/i,
  /glassdoor\.com\/Explore/i, /indeed\.com\/cmp/i,
];

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const _version = "v3-local-scoring";
  try {
    const body = await req.json().catch(() => ({}));
    const { profileId } = body as { profileId?: string };

    const profiles = profileId
      ? await db.searchProfile.findMany({ where: { id: profileId } })
      : await db.searchProfile.findMany({});

    if (!profiles.length) return NextResponse.json({ needsSetup: true, error: "No search profiles. Run /api/seed first." });

    // Purge ALL existing jobs for these profiles before fresh search
    try {
      const profileIds = profiles.map((p: any) => p.id);
      const purged = await db.jobPosting.deleteMany({
        where: { searchProfileId: { in: profileIds } },
      });
      if (purged.count > 0) console.log(`[search-run] Purged ${purged.count} existing jobs`);
    } catch {}

    const results: Array<{ profile: string; found: number; saved: number; skipped?: { stale: number; filtered: number; shortTitle: number; dup: number; error: number } }> = [];

    for (const profile of profiles) {
      const cv = getCvBySlug(profile.cvVariantId) || CV_VARIANTS[0];
      const countries = profile.countries.split(",").map((c: string) => c.trim()).filter(Boolean);
      const keywords = profile.keywords.split(",").map((k: string) => k.trim()).filter(Boolean);
      const baseKw = keywords.slice(0, 3).join(" ");

      const glMap: Record<string, string> = {
        USA: "us", Germany: "de", UK: "uk", "United Kingdom": "uk",
        Australia: "au", Canada: "ca", Qatar: "qa", UAE: "ae", Pakistan: "pk",
        Singapore: "sg", Saudi: "sa", "Saudi Arabia": "sa",
      };

      let found = 0;
      let saved = 0;
      const skipped = { stale: 0, filtered: 0, shortTitle: 0, dup: 0, error: 0 };

      for (const country of countries.slice(0, 3)) {
        const gl = glMap[country] || "us";

        const kw1 = keywords[0] || baseKw;
        const kw2 = keywords[1] || "";
        const queries = [
          `${kw1} ${kw2} jobs ${country} -salary -course -certification`,
          `${kw1} "hiring" OR "just posted" ${country} -indeed.com/career -glassdoor.com/Salary`,
          `${baseKw} manager OR director OR senior OR lead ${country} 2025`,
        ];

        for (const query of queries) {
          try {
            const items = await serperSearch(query, gl);
            found += items.length;

            for (const item of items) {
              try {
                const url = item.link || "";
                const title = item.title || "";
                const snippet = item.snippet || "";

                if (!isFresh(item)) { skipped.stale++; continue; }
                if (SKIP_PATTERNS.some((p) => p.test(`${title} ${snippet} ${url}`))) { skipped.filtered++; continue; }

                const company = title.split(/\s+[|\-–—]\s+/).pop()?.trim() || "Not specified";
                const jobTitle = title.replace(/\s*[|\-–—]\s+.*$/, "").trim();
                if (jobTitle.length < 5) { skipped.shortTitle++; continue; }

                const existing = await db.jobPosting.findFirst({ where: { url } });
                if (existing) { skipped.dup++; continue; }

                const matchScore = quickScore(cv, jobTitle, snippet, keywords);

                await db.jobPosting.create({
                  data: {
                    title: jobTitle,
                    company: company.replace(/^(LinkedIn|Indeed|Glassdoor|SEEK|Google)$/i, "Not specified"),
                    location: country,
                    url,
                    description: snippet.slice(0, 1000),
                    source: "serper",
                    matchScore,
                    status: "new",
                    searchProfileId: profile.id,
                  },
                });
                saved++;
              } catch (itemErr: any) {
                skipped.error++;
                console.error(`[search-run] Skip: ${itemErr.message?.slice(0, 120)}`);
              }
            }
          } catch (err: any) {
            console.error(`[search-run] ${profile.name}/${country}: ${err.message?.slice(0, 120)}`);
          }
        }
      }

      await db.searchProfile.update({ where: { id: profile.id }, data: { lastRunAt: new Date() } });
      results.push({ profile: profile.name, found, saved, skipped });
    }

    return NextResponse.json({ success: true, _version, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}