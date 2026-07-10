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
  // Build a set of all CV skills/keywords (lowercased)
  const cvText = [
    cv.roleTitle,
    cv.summary,
    ...cv.sidebarPage1.flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : String(i)))),
    ...cv.sidebarPage2.flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : String(i)))),
  ]
    .join(" ")
    .toLowerCase();

  // Also include profile search keywords
  const allCvWords = new Set(cvText.split(/[\s,;|/()\-–—]+/).filter((w) => w.length > 2));
  profileKeywords.forEach((k) => allCvWords.add(k.toLowerCase().trim()));

  const jobText = `${jobTitle} ${snippet}`.toLowerCase();
  const jobWords = new Set(jobText.split(/[\s,;|/()\-–—]+/).filter((w) => w.length > 2));

  // Count overlapping significant words
  let matches = 0;
  let checked = 0;
  for (const word of allCvWords) {
    if (jobText.includes(word)) {
      matches++;
    }
    checked++;
  }

  if (checked === 0) return 45;

  // Also check if job title words match CV skills (title match is worth more)
  const titleWords = jobTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  let titleMatches = 0;
  for (const tw of titleWords) {
    if (cvText.includes(tw)) titleMatches++;
  }

  // Score: base overlap + title bonus, capped at 95
  const overlapPct = (matches / checked) * 100;
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
  if (item.date) {
    try {
      const d = new Date(item.date);
      const ageMs = Date.now() - d.getTime();
      return ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    } catch { /* ignore */ }
  }
  // If no date, check snippet for age hints
  const snippet = item.snippet || "";
  const daysAgoMatch = snippet.match(/(\d+)\s+days?\s+ago/i);
  if (daysAgoMatch) {
    return parseInt(daysAgoMatch[1]) <= MAX_AGE_DAYS;
  }
  // No date info at all — keep it (Serper qdr:w already filtered to past week)
  return true;
}

// ---------------------------------------------------------------------------
// SKIP PATTERNS (non-job listings)
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
      if (purged.count > 0) console.log(`[search-run] Purged ${purged.count} existing jobs for fresh search`);
    } catch {}

    const results: Array<{ profile: string; found: number; saved: number }> = [];

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

      for (const country of countries.slice(0, 3)) {
        const gl = glMap[country] || "us";

        // Build diverse queries for better coverage
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

                // Freshness check
                if (!isFresh(item)) continue;

                // Skip non-job pages
                if (SKIP_PATTERNS.some((p) => p.test(`${title} ${snippet} ${url}`))) continue;

                // Parse title/company
                const company = title.split(/\s+[|\-–—]\s+/).pop()?.trim() || "Not specified";
                const jobTitle = title.replace(/\s*[|\-–—]\s+.*$/, "").trim();
                if (jobTitle.length < 5) continue;

                // Skip exact URL duplicates within this run
                const existing = await db.jobPosting.findFirst({ where: { url } });
                if (existing) continue;

                // Fast local keyword scoring (NO LLM call — instant)
                const matchScore = quickScore(cv, jobTitle, snippet, keywords);

                // Save to DB
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
                console.error(`[search-run] Skip "${item?.title?.slice(0, 50)}": ${itemErr.message?.slice(0, 120)}`);
              }
            }
          } catch (err: any) {
            console.error(`[search-run] ${profile.name}/${country}: ${err.message?.slice(0, 120)}`);
          }
        }
      }

      await db.searchProfile.update({ where: { id: profile.id }, data: { lastRunAt: new Date() } });
      results.push({ profile: profile.name, found, saved });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}