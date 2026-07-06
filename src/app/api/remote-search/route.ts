/**
 * POST /api/remote-search  — V2 Authentic Remote Job Search
 * Body: { country?: string }
 *
 * V2 improvements:
 *  • TRUSTED_DOMAINS whitelist (20+ real job boards)
 *  • BLOCKED_DOMAINS blacklist (social media, courses, salary sites)
 *  • site: operator queries for trusted boards per country
 *  • tbs:"qdr:m" for past-month results
 *  • Batched requests (3 concurrent, 600ms between batches)
 *  • Source-priority sorting (LinkedIn → Indeed → Glassdoor → …)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";

// ---------------------------------------------------------------------------
// TRUSTED DOMAINS — 20+ real job boards
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
];

// ---------------------------------------------------------------------------
// COUNTRY QUERIES — site: operators per country
// ---------------------------------------------------------------------------
const COUNTRY_QUERIES: Record<string, { gl: string; queries: string[] }> = {
  USA: {
    gl: "us",
    queries: [
      'site:linkedin.com/jobs/view/ remote manager jobs hiring',
      'site:indeed.com/job/ remote director jobs USA',
      'site:glassdoor.com/Job/ remote senior specialist jobs',
      'site:ziprecruiter.com remote manager jobs hiring',
      'site:flexjobs.com remote director jobs',
    ],
  },
  Germany: {
    gl: "de",
    queries: [
      'site:linkedin.com/jobs/view/ remote manager jobs Germany',
      'site:stepstone.de remote jobs English',
      'site:xing.com/jobs/ remote manager jobs',
    ],
  },
  "United Kingdom": {
    gl: "uk",
    queries: [
      'site:linkedin.com/jobs/view/ remote manager jobs UK',
      'site:reed.co.uk/jobs/ remote manager jobs',
      'site:indeed.com/job/ remote director jobs UK',
    ],
  },
  Australia: {
    gl: "au",
    queries: [
      'site:seek.com.au/job/ remote manager jobs',
      'site:linkedin.com/jobs/view/ remote jobs Australia',
      'site:indeed.com/job/ remote senior jobs Australia',
    ],
  },
  Canada: {
    gl: "ca",
    queries: [
      'site:linkedin.com/jobs/view/ remote manager jobs Canada',
      'site:indeed.com/job/ remote director jobs Canada',
      'site:glassdoor.com/Job/ remote jobs Canada',
    ],
  },
};

// ---------------------------------------------------------------------------
// GLOBAL QUERIES — dedicated remote job boards
// ---------------------------------------------------------------------------
const GLOBAL_QUERIES = [
  'site:weworkremotely.com remote manager jobs',
  'site:remoteok.com remote senior jobs',
  'site:flexjobs.com remote director jobs',
  'site:justremote.co remote manager jobs',
  'site:remoteco.com remote jobs hiring',
  'site:builtin.com remote jobs',
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
// SERPER SEARCH
// ---------------------------------------------------------------------------
async function serperSearch(query: string, gl: string, num = 15): Promise<any[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_KEY,
    },
    body: JSON.stringify({ q: query, num, gl, hl: "en", tbs: "qdr:m" }),
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
    /slideserve\.com/i, /job description template/i, /wikipedia\.org/i,
  ];
  for (const p of skipPatterns) {
    if (p.test(checkText)) return null;
  }

  // Skip category / browse pages
  if (/^\d+\+?\s/i.test(title)) return null;
  if (/jobs in all/i.test(title)) return null;
  if (/browse jobs/i.test(title) || /search jobs/i.test(title)) return null;

  // Require job-related keywords (relaxed for trusted sources)
  const jobWords = /manager|director|senior|lead|engineer|developer|designer|analyst|specialist|consultant|architect|coordinator|head|vp|chief|president/i;
  if (!trusted && !jobWords.test(checkText)) return null;

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
      if (!["LinkedIn", "SEEK", "Indeed", "Glassdoor", "StepStone", "Google", "We Work Remotely", "ZipRecruiter"].includes(last)) {
        company = last;
        jobTitle = parts[0].trim();
      }
    }
  }
  jobTitle = jobTitle.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|StepStone|Google|We Work Remotely|ZipRecruiter).*$/i, "").trim();
  if (!jobTitle || jobTitle.length < 5) return null;

  const locMatch = checkText.match(/\b(USA|United States|Germany|UK|United Kingdom|Australia|Canada|Remote|Hybrid)\b/i);
  const location = locMatch ? locMatch[0] : country;

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
      if (!cfg) return NextResponse.json({ error: `Unknown country: ${singleCountry}` }, { status: 400 });
      for (const q of cfg.queries) queries.push({ q, gl: cfg.gl, country: singleCountry });
    } else {
      for (const [country, cfg] of Object.entries(COUNTRY_QUERIES)) {
        for (const q of cfg.queries) queries.push({ q, gl: cfg.gl, country });
      }
      for (const q of GLOBAL_QUERIES) queries.push({ q, gl: "us", country: "Global" });
    }

    console.log(`[remote-search-v2] Running ${queries.length} queries`);

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
            console.log(`[remote-search-v2] "${q.slice(0, 50)}..." -> ${jobs.length} jobs`);
            return jobs;
          } catch (err: any) {
            console.error(`[remote-search-v2] Query failed:`, err.message);
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

    console.log(`[remote-search-v2] Total: ${allJobs.length} unique remote jobs`);
    return NextResponse.json({ success: true, jobs: allJobs, total: allJobs.length });
  } catch (err: any) {
    console.error("[remote-search-v2] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}