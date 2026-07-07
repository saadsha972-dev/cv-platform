/**
 * POST /api/remote-search  — V4 Improved Remote Job Search
 * Body: { country?: string }
 *
 * V4 Improvements:
 * - Role-specific queries (QHSE, Quality, Compliance, Safety, HSE)
 * - Stricter source filtering — only real job listing URLs
 * - Better duplicate detection via title normalization
 * - Requires job application indicators in snippet/URL
 * - More trusted remote-first job boards
 * - Salary/keyword spam filter
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";

// ---------------------------------------------------------------------------
// TRUSTED DOMAINS — real job boards / company career pages
// ---------------------------------------------------------------------------
const TRUSTED_DOMAINS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /linkedin\.com\/jobs\/view/, source: "linkedin" },
  { pattern: /indeed\.com\/(rc\/|viewjob|company\/[^/]+\/jobs)/, source: "indeed" },
  { pattern: /glassdoor\.com\/Job\/Listing/, source: "glassdoor" },
  { pattern: /seek\.com\.au\/job\//, source: "seek" },
  { pattern: /ziprecruiter\.com\/jobs\//, source: "ziprecruiter" },
  { pattern: /weworkremotely\.com\//, source: "weworkremotely" },
  { pattern: /remoteok\.com\/remote\//, source: "remoteok" },
  { pattern: /flexjobs\.com\//, source: "flexjobs" },
  { pattern: /justremote\.co\/remote-jobs\//, source: "justremote" },
  { pattern: /remoteco\.com\/remote-jobs\//, source: "remoteco" },
  { pattern: /lever\.co\/jobs\//, source: "lever" },
  { pattern: /greenhouse\.io\/jobs\//, source: "greenhouse" },
  { pattern: /myworkdayjobs\.com\//, source: "workday" },
  { pattern: /builtin\.com\/jobs\//, source: "builtin" },
  { pattern: /workingnomads\.com\/jobs\//, source: "workingnomads" },
  { pattern: /remoterocketship\.com\/remote\//, source: "remoterocketship" },
  { pattern: /naukri\.com\/job\//, source: "naukri" },
  { pattern: /gulftalent\.com\/jobs\//, source: "gulftalent" },
  { pattern: /bayt\.com\/job\//, source: "bayt" },
  { pattern: /rozee\.pk\/job\//, source: "rozee" },
  { pattern: /monster\.com\/jobs\//, source: "monster" },
  { pattern: /stepstone\.de\/jobs\//, source: "stepstone" },
  { pattern: /xing\.com\/jobs\//, source: "xing" },
  { pattern: /reed\.co\.uk\/jobs\//, source: "reed" },
  // Company career pages (ATS)
  { pattern: /careers\.at\//, source: "careers-at" },
  { pattern: /\/careers\/(jobs|positions|openings)/, source: "careers-page" },
  { pattern: /jobs\.lever\.co/, source: "lever" },
  { pattern: /boards\.greenhouse\.io/, source: "greenhouse" },
];

// ---------------------------------------------------------------------------
// BROAD TRUSTED — domains that host jobs but also other content
// Need job-specific URL patterns
// ---------------------------------------------------------------------------
const BROAD_JOB_DOMAINS: RegExp[] = [
  /linkedin\.com/, /indeed\.com/, /glassdoor\.com/, /monster\.com/,
  /ziprecruiter\.com/, /seek\.com\.au/, /naukri\.com/, /bayt\.com/,
];

// ---------------------------------------------------------------------------
// BLOCKED DOMAINS — social media, courses, salary sites, news
// ---------------------------------------------------------------------------
const BLOCKED_DOMAINS: RegExp[] = [
  /instagram\.com/, /tiktok\.com/, /pinterest\.com/,
  /twitter\.com/, /x\.com/, /facebook\.com/, /reddit\.com/, /youtube\.com/,
  /udemy\.com/, /coursera\.org/, /linkedin\.com\/learning/, /skillshare\.com/,
  /payscale\.com/, /salary\.com/, /glassdoor\.com\/Salary\//,
  /indeed\.com\/career\//, /ziprecruiter\.com\/salary/,
  /wikipedia\.org/, /slideserve\.com/, /news\./, /blog\./,
  /medium\.com/, /substack\.com/, /forbes\.com/, /cnbc\.com/,
  /theguardian\.com/, /nytimes\.com/, /bbc\.com/,
];

// ---------------------------------------------------------------------------
// COUNTRY QUERIES — role-specific, natural language
// ---------------------------------------------------------------------------
const COUNTRY_QUERIES: Record<string, { gl: string; queries: string[] }> = {
  USA: {
    gl: "us",
    queries: [
      "QHSE manager remote jobs hiring USA",
      "quality assurance manager remote work from home",
      "HSE director remote position USA",
      "ISO lead auditor remote job opening",
      "compliance manager remote jobs USA 2025",
      "safety manager remote position hiring",
    ],
  },
  Germany: {
    gl: "de",
    queries: [
      "QHSE manager remote jobs Germany English",
      "quality manager remote work Deutschland hiring",
      "HSE remote roles Germany English speaking",
      "compliance auditor remote jobs Germany",
    ],
  },
  "United Kingdom": {
    gl: "uk",
    queries: [
      "QHSE manager remote jobs UK hiring 2025",
      "quality assurance manager remote work UK",
      "HSE director remote position United Kingdom",
      "compliance manager remote jobs UK",
    ],
  },
  Australia: {
    gl: "au",
    queries: [
      "QHSE manager remote jobs Australia hiring",
      "quality manager remote work Australia",
      "HSE remote roles Australia 2025",
      "safety manager remote position Australia",
    ],
  },
  Canada: {
    gl: "ca",
    queries: [
      "QHSE manager remote jobs Canada hiring",
      "quality assurance manager remote work Canada",
      "HSE director remote position Canada",
      "compliance manager remote jobs Canada",
    ],
  },
};

// ---------------------------------------------------------------------------
// GLOBAL QUERIES — dedicated remote job boards + role-specific
// ---------------------------------------------------------------------------
const GLOBAL_QUERIES = [
  "QHSE manager remote jobs hiring now",
  "quality assurance manager work from home",
  "HSE director remote jobs global",
  "ISO auditor remote position hiring",
  "safety compliance manager remote work",
  "remote quality manager jobs 2025",
  "site:linkedin.com/jobs QHSE manager remote",
  "site:indeed.com remote quality manager",
  "site:weworkremotely.com manager",
  "site:remoteok.com remote manager",
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
  linkedin: 0, indeed: 1, glassdoor: 2, weworkremotely: 3,
  remoteok: 4, flexjobs: 5, lever: 6, greenhouse: 7, workday: 8,
  builtin: 9, ziprecruiter: 10, justremote: 11, workingnomads: 12,
  remoteco: 13, remoterocketship: 14, monster: 15, seek: 16,
  stepstone: 17, xing: 18, reed: 19, naukri: 20,
  gulftalent: 21, bayt: 22, rozee: 23, other: 99,
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
  // Check if it's a broad job domain (trusted but URL might not be a specific job)
  for (const broad of BROAD_JOB_DOMAINS) {
    if (broad.test(url)) return { source: "other", trusted: false };
  }
  return { source: "other", trusted: false };
}

// ---------------------------------------------------------------------------
// TITLE NORMALIZATION — for dedup
// ---------------------------------------------------------------------------
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
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
// JOB PARSING — strict filtering for authenticity
// ---------------------------------------------------------------------------
function parseJob(item: any, country: string): RemoteJob | null {
  const url = item.link || "";
  const title = item.title || "";
  const snippet = item.snippet || "";

  const { source, trusted } = identifySource(url);
  if (source === "blocked") return null;

  const checkText = `${title} ${snippet} ${url}`;

  // Skip non-job content — training, courses, news, blogs
  const skipPatterns = [
    /training course/i, /certification training/i, /how to become/i,
    /what does a/i, /salary.*guide/i, /course schedule/i, /\.pdf$/i,
    /job description template/i, /wikipedia\.org/i, /slideserve\.com/i,
    /jobs in all/i, /browse jobs/i, /search jobs/i,
    /news article/i, /breaking news/i, /opinion:/i,
    /best.*jobs/i, /top.*jobs.*\d{4}/i, /highest paying/i,
    /job market/i, /employment outlook/i, /career advice/i,
    /interview questions/i, /resume tips/i, /cover letter tips/i,
  ];
  for (const p of skipPatterns) {
    if (p.test(checkText)) return null;
  }

  // Skip pure numeric titles (e.g. "5 jobs")
  if (/^\d{1,3}\s*$/i.test(title.trim())) return null;

  // Skip very short titles
  if (title.trim().length < 8) return null;

  // Require job-related keywords in title
  const jobTitleWords = /manager|management|director|senior|lead|engineer|developer|designer|analyst|specialist|consultant|architect|coordinator|head|vp|chief|president|officer|superintendent|supervisor|technician|administrator|executive|accountant|recruiter|planner|controller|advisor|auditor|inspector|officer/i;
  if (!jobTitleWords.test(title)) return null;

  // Require "remote" or WFH in the text for this remote search
  const remoteWords = /remote|work.?from.?home|wfh|distributed|telecommut|virtual.*location|location.?independent/i;
  if (!remoteWords.test(checkText)) return null;

  // Skip if URL looks like a category/listing page, not a specific job
  if (url.includes("linkedin.com/jobs/") && !url.includes("/jobs/view/")) return null;
  if (url.includes("indeed.com") && !url.includes("/rc/") && !url.includes("/viewjob") && !url.includes("/company/")) return null;
  if (url.includes("glassdoor.com") && !url.includes("/Job/Listing/")) return null;

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
      const knownSources = ["LinkedIn", "SEEK", "Indeed", "Glassdoor", "StepStone", "Google", "We Work Remotely", "ZipRecruiter", "Monster", "Naukri", "GulfTalent", "Bayt", "Jooble", "RemoteOK"];
      if (!knownSources.includes(last)) {
        company = last;
        jobTitle = parts[0].trim();
      }
    }
  }

  // Clean source tag from title
  jobTitle = jobTitle.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|StepStone|Google|We Work Remotely|ZipRecruiter|Monster|Naukri|GulfTalent|Bayt|Jooble|RemoteOK).*$/i, "").trim();
  if (!jobTitle || jobTitle.length < 8) return null;

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
    const seenTitles = new Set<string>();

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

    console.log(`[remote-search-v4] Running ${queries.length} queries (role-specific)`);

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
                // Dedup by normalized title
                const normTitle = normalizeTitle(parsed.title);
                if (seenTitles.has(normTitle)) continue;
                seenUrls.add(parsed.url);
                seenTitles.add(normTitle);
                jobs.push(parsed);
              }
            }
            console.log(`[remote-search-v4] "${q.slice(0, 50)}..." -> ${jobs.length} jobs`);
            return jobs;
          } catch (err: any) {
            console.error(`[remote-search-v4] Query failed:`, err.message);
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

    console.log(`[remote-search-v4] Total: ${allJobs.length} unique remote jobs after dedup`);
    return NextResponse.json({ success: true, jobs: allJobs, total: allJobs.length });
  } catch (err: any) {
    console.error("[remote-search-v4] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}