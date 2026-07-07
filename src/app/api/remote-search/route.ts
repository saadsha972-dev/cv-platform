/**
 * POST /api/remote-search  — V3 Natural Query Remote Job Search
 * Body: { country?: string }
 *
 * V3: Removed ALL site: operators (blocked on Serper free tier).
 * Uses natural language queries that actually return results.
 * Includes TRUSTED_DOMAINS whitelist for source quality.
 * Batched requests (3 concurrent, 600ms between batches).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";

// ---------------------------------------------------------------------------
// TRUSTED DOMAINS — real job boards (used for source tagging, NOT in queries)
// ---------------------------------------------------------------------------
const TRUSTED_DOMAINS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /linkedin\.com\/jobs\/view\//, source: "linkedin" },
  { pattern: /indeed\.com\/(job|rc|company)\//, source: "indeed" },
  { pattern: /glassdoor\.com\/Job\//, source: "glassdoor" },
  { pattern: /seek\.com\.au\/job\//, source: "seek" },
  { pattern: /weworkremotely\.com/, source: "weworkremotely" },
  { pattern: /remoteok\.com/, source: "remoteok" },
  { pattern: /flexjobs\.com/, source: "flexjobs" },
  { pattern: /ziprecruiter\.com/, source: "ziprecruiter" },
  { pattern: /monster\.com/, source: "monster" },
  { pattern: /stepstone\.de/, source: "stepstone" },
  { pattern: /xing\.com\/jobs\//, source: "xing" },
  { pattern: /reed\.co\.uk\/jobs\//, source: "reed" },
  { pattern: /builtin\.com/, source: "builtin" },
  { pattern: /justremote\.co/, source: "justremote" },
  { pattern: /remoteco\.com/, source: "remoteco" },
  { pattern: /lever\.co/, source: "lever" },
  { pattern: /greenhouse\.io/, source: "greenhouse" },
  { pattern: /myworkdayjobs\.com/, source: "workday" },
  { pattern: /careers-at\./, source: "careers-at" },
  { pattern: /\/careers\?/, source: "careers-page" },
  { pattern: /naukri\.com/, source: "naukri" },
  { pattern: /gulftalent\.com/, source: "gulftalent" },
  { pattern: /bayt\.com/, source: "bayt" },
  { pattern: /rozee\.pk/, source: "rozee" },
];

// ---------------------------------------------------------------------------
// BLOCKED DOMAINS — social media, courses, salary sites
// ---------------------------------------------------------------------------
const BLOCKED_DOMAINS: RegExp[] = [
  /instagram\.com/, /tiktok\.com/, /pinterest\.com/,
  /twitter\.com/, /x\.com/, /facebook\.com/, /reddit\.com/, /youtube\.com/,
  /udemy\.com/, /coursera\.org/, /linkedin\.com\/learning/, /skillshare\.com/,
  /payscale\.com/, /salary\.com/, /glassdoor\.com\/Salary\//,
  /indeed\.com\/career\//, /ziprecruiter\.com\/salary/,
  /wikipedia\.org/, /slideserve\.com/,
];

// ---------------------------------------------------------------------------
// COUNTRY QUERIES — natural language (NO site: operators)
// ---------------------------------------------------------------------------
const COUNTRY_QUERIES: Record<string, { gl: string; queries: string[] }> = {
  USA: {
    gl: "us",
    queries: [
      "remote manager jobs hiring USA 2025",
      "remote director jobs United States",
      "remote senior specialist jobs hiring",
      "work from home manager roles USA",
    ],
  },
  Germany: {
    gl: "de",
    queries: [
      "remote manager jobs Germany English",
      "remote director jobs Deutschland hiring",
      "remote work senior roles Germany",
    ],
  },
  "United Kingdom": {
    gl: "uk",
    queries: [
      "remote manager jobs UK hiring 2025",
      "remote director jobs United Kingdom",
      "work from home senior roles UK",
    ],
  },
  Australia: {
    gl: "au",
    queries: [
      "remote manager jobs Australia hiring",
      "remote senior roles Australia 2025",
      "work from home director jobs Australia",
    ],
  },
  Canada: {
    gl: "ca",
    queries: [
      "remote manager jobs Canada hiring",
      "remote director jobs Canada 2025",
      "work from home senior roles Canada",
    ],
  },
};

// ---------------------------------------------------------------------------
// GLOBAL QUERIES — dedicated remote job boards (natural language)
// ---------------------------------------------------------------------------
const GLOBAL_QUERIES = [
  "remote manager jobs hiring 2025",
  "remote senior specialist jobs work from home",
  "remote director jobs hiring now",
  "remote engineering manager jobs",
  "remote project manager jobs global",
  "remote operations manager jobs hiring",
];

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface RemoteJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  country: string;
}

const SOURCE_PRIORITY: Record<string, number> = {
  linkedin: 0, indeed: 1, glassdoor: 2, seek: 3,
  weworkremotely: 4, remoteok: 5, flexjobs: 6, ziprecruiter: 7,
  monster: 8, lever: 9, greenhouse: 10, workday: 11,
  stepstone: 12, xing: 13, reed: 14, builtin: 15,
  justremote: 16, remoteco: 17, "careers-at": 18, "careers-page": 19,
  naukri: 20, gulftalent: 21, bayt: 22, rozee: 23, other: 99,
};

// ---------------------------------------------------------------------------
// SOURCE IDENTIFICATION
// ---------------------------------------------------------------------------
function identifySource(url: string): { source: string; trusted: boolean } {
  for (const blocked of BLOCKED_DOMAINS) {
    if (blocked.test(url)) return { source: "blocked", trusted: false };
  }
  for (const entry of TRUSTED_DOMAINS) {
    if (entry.pattern.test(url)) return { source: entry.source, trusted: true };
  }
  return { source: "other", trusted: false };
}

// ---------------------------------------------------------------------------
// SERPER SEARCH (no site: operators, no tbs)
// ---------------------------------------------------------------------------
async function serperSearch(query: string, gl: string, num = 15): Promise<any[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_KEY,
    },
    // NO site: operators, NO tbs — these are blocked/ignored on Serper free tier
    body: JSON.stringify({ q: query, num, gl, hl: "en" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.organic || [];
}

// ---------------------------------------------------------------------------
// JOB PARSING
// ---------------------------------------------------------------------------
function parseJob(item: any, country: string): RemoteJob | null {
  const url = item.link || "";
  const title = item.title || "";
  const snippet = item.snippet || "";

  const { source, trusted } = identifySource(url);
  if (source === "blocked") return null;

  const checkText = `${title} ${snippet} ${url}`;

  // Skip non-job content
  const skipPatterns = [
    /training course/i, /certification training/i, /how to become/i,
    /what does a/i, /salary.*guide/i, /course schedule/i, /\.pdf$/i,
    /job description template/i, /wikipedia\.org/i, /slideserve\.com/i,
    /jobs in all/i, /browse jobs/i, /search jobs/i,
  ];
  for (const p of skipPatterns) {
    if (p.test(checkText)) return null;
  }

  // Skip numeric-only titles (category pages)
  if (/^\d+\+?\s/i.test(title)) return null;

  // For untrusted sources, require job-related keywords
  const jobWords = /manager|director|senior|lead|engineer|developer|designer|analyst|specialist|consultant|architect|coordinator|head|vp|chief|president|officer|superintendent|supervisor|technician|administrator|executive/i;
  if (!trusted && !jobWords.test(checkText)) return null;

  // Require "remote" or "work from home" or "wfh" in the text for remote search
  const remoteWords = /remote|work.?from.?home|wfh|distributed|telecommut/i;
  if (!remoteWords.test(checkText)) return null;

  // Parse title + company
  let jobTitle = title;
  let company = "Not specified";

  const hiring = title.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
  if (hiring) {
    company = hiring[1].trim();
    jobTitle = hiring[2].trim();
  } else {
    const parts = title.split(/\s+[|\-–—]\s+/);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].trim();
      const knownSources = ["LinkedIn", "SEEK", "Indeed", "Glassdoor", "StepStone", "Google", "We Work Remotely", "ZipRecruiter", "Monster", "Naukri", "GulfTalent", "Bayt", "Jooble"];
      if (!knownSources.includes(last)) {
        company = last;
        jobTitle = parts[0].trim();
      }
    }
  }

  // Clean source tag from title
  jobTitle = jobTitle.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|StepStone|Google|We Work Remotely|ZipRecruiter|Monster|Naukri|GulfTalent|Bayt|Jooble).*$/i, "").trim();
  if (!jobTitle || jobTitle.length < 5) return null;

  // Detect location from snippet
  const locMatch = checkText.match(/\b(USA|United States|Germany|UK|United Kingdom|Australia|Canada|Remote|Hybrid|Worldwide|Anywhere|Global)\b/i);
  const location = locMatch ? locMatch[0] : "Remote";

  return { title: jobTitle, company, location, url, description: snippet.slice(0, 800), source, country };
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { country: singleCountry } = body as { country?: string };

    const allJobs: RemoteJob[] = [];
    const seenUrls = new Set<string>();

    const queries: Array<{ q: string; gl: string; country: string }> = [];
    if (singleCountry) {
      const cfg = COUNTRY_QUERIES[singleCountry];
      if (!cfg) return NextResponse.json({ error: `Unknown country: ${singleCountry}. Available: ${Object.keys(COUNTRY_QUERIES).join(", ")}` }, { status: 400 });
      for (const q of cfg.queries) queries.push({ q, gl: cfg.gl, country: singleCountry });
    } else {
      for (const [country, cfg] of Object.entries(COUNTRY_QUERIES)) {
        for (const q of cfg.queries) queries.push({ q, gl: cfg.gl, country });
      }
      for (const q of GLOBAL_QUERIES) queries.push({ q, gl: "us", country: "Global" });
    }

    console.log(`[remote-search-v3] Running ${queries.length} natural queries`);

    const BATCH = 3;
    for (let i = 0; i < queries.length; i += BATCH) {
      const batch = queries.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async ({ q, gl, country }) => {
          try {
            const items = await serperSearch(q, gl);
            const jobs: RemoteJob[] = [];
            for (const item of items) {
              const parsed = parseJob(item, country);
              if (parsed && parsed.url && !seenUrls.has(parsed.url)) {
                seenUrls.add(parsed.url);
                jobs.push(parsed);
              }
            }
            console.log(`[remote-search-v3] "${q.slice(0, 50)}..." -> ${jobs.length} jobs`);
            return jobs;
          } catch (err: any) {
            console.error(`[remote-search-v3] Query failed:`, err.message);
            return [];
          }
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled") allJobs.push(...r.value);
      }
      if (i + BATCH < queries.length) await new Promise((r) => setTimeout(r, 600));
    }

    // Sort by source priority
    allJobs.sort((a, b) => (SOURCE_PRIORITY[a.source] ?? 99) - (SOURCE_PRIORITY[b.source] ?? 99));

    console.log(`[remote-search-v3] Total: ${allJobs.length} unique remote jobs`);
    return NextResponse.json({ success: true, jobs: allJobs, total: allJobs.length });
  } catch (err: any) {
    console.error("[remote-search-v3] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}