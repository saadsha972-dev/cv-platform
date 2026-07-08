/**
 * POST /api/remote-search — Authentic remote job results only
 * V2: Tighter date filtering, better query construction, freshness validation
 */
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 120;
const SERPER_KEY = "89280a05e2a42179789766db50570d66f5d52b1e";
const MAX_AGE_DAYS = 21;

const TRUSTED_DOMAINS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /linkedin\.com\/jobs\/view\//, source: "LinkedIn" },
  { pattern: /indeed\.com\/(job|rc|company)\//, source: "Indeed" },
  { pattern: /glassdoor\.com\/Job\//i, source: "Glassdoor" },
  { pattern: /seek\.com\.au\/job\//, source: "SEEK" },
  { pattern: /weworkremotely\.com\//i, source: "We Work Remotely" },
  { pattern: /remoteok\.com\//i, source: "RemoteOK" },
  { pattern: /flexjobs\.com\//i, source: "FlexJobs" },
  { pattern: /ziprecruiter\.com\//i, source: "ZipRecruiter" },
  { pattern: /monster\.com\//i, source: "Monster" },
  { pattern: /stepstone\.de\//i, source: "StepStone" },
  { pattern: /xing\.com\/jobs\//i, source: "XING" },
  { pattern: /reed\.co\.uk\/jobs\//i, source: "Reed" },
  { pattern: /builtin\.com\//i, source: "Built In" },
  { pattern: /justremote\.co\//i, source: "JustRemote" },
  { pattern: /remoteco\.com\//i, source: "Remote.co" },
  { pattern: /lever\.co\//i, source: "Lever" },
  { pattern: /greenhouse\.io\//i, source: "Greenhouse" },
  { pattern: /myworkdayjobs\.com\//i, source: "Workday" },
  { pattern: /careers-at\./i, source: "Company Career Page" },
  { pattern: /\/careers?\//i, source: "Company Career Page" },
];

const BLOCKED_DOMAINS = [
  /instagram\.com/i, /tiktok\.com/i, /pinterest\.com/i, /twitter\.com/i,
  /x\.com/i, /facebook\.com/i, /reddit\.com/i, /youtube\.com/i,
  /slideserve\.com/i, /wikipedia\.org/i, /learnerspoint\.org/i,
  /coursehero\.com/i, /udemy\.com/i, /coursera\.org/i, /medium\.com/i,
  /payscale\.com/i, /salary\.com/i, /indeed\.com\/career\//i,
  /glassdoor\.com\/Salary\//i, /linkedin\.com\/learning/i,
  /quora\.com/i, /ziprecruiter\.com\/(salary|career)/i,
];

const COUNTRY_QUERIES: Record<string, { gl: string; queries: string[] }> = {
  USA: { gl: "us", queries: [
    'remote manager jobs "just posted" OR "hiring now" USA site:linkedin.com/jobs/view/ OR site:indeed.com',
    "remote director senior specialist jobs USA site:linkedin.com/jobs/view/ OR site:glassdoor.com OR site:ziprecruiter.com",
    '"work from home" manager OR director jobs USA site:indeed.com OR site:linkedin.com/jobs/view/',
  ]},
  Germany: { gl: "de", queries: [
    "remote manager jobs Germany hiring site:linkedin.com/jobs/view/ OR site:stepstone.de",
    "remote director jobs Germany site:linkedin.com/jobs/view/ OR site:indeed.de",
  ]},
  "United Kingdom": { gl: "uk", queries: [
    "remote manager jobs UK hiring site:linkedin.com/jobs/view/ OR site:reed.co.uk/jobs/ OR site:indeed.co.uk",
    '"work from home" manager jobs UK site:linkedin.com/jobs/view/',
  ]},
  Australia: { gl: "au", queries: [
    "remote manager jobs Australia hiring site:seek.com.au/job/ OR site:linkedin.com/jobs/view/",
    "remote director jobs Australia site:linkedin.com/jobs/view/ OR site:seek.com.au/job/",
  ]},
  Canada: { gl: "ca", queries: [
    "remote manager jobs Canada hiring site:linkedin.com/jobs/view/ OR site:ca.indeed.com",
    '"work from home" manager jobs Canada site:linkedin.com/jobs/view/',
  ]},
};

const GLOBAL_QUERIES = [
  'site:weworkremotely.com "manager" OR "director" OR "senior"',
  'site:remoteok.com "remote" "manager" OR "senior" OR "lead"',
  'site:justremote.co "remote manager" OR "remote director" jobs',
  'site:remoteco.com "remote" "manager" OR "director"',
  'site:flexjobs.com "remote" "manager" OR "director" OR "senior"',
];

interface RemoteJob { title: string; company: string; location: string; url: string; description: string; source: string; country: string; postedDate?: string; }

async function serperSearch(query: string, gl: string, num = 15): Promise<any[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": SERPER_KEY },
    body: JSON.stringify({ q: query, num, hl: "en", gl, tbs: "qdr:w" }),
  });
  if (!res.ok) { const text = await res.text().catch(() => ""); throw new Error(`Serper ${res.status}: ${text.slice(0, 200)}`); }
  return (await res.json()).organic || [];
}

function isFresh(item: any): boolean {
  if (item.date) {
    try {
      const d = new Date(item.date);
      const ageMs = Date.now() - d.getTime();
      return ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    } catch { /* ignore */ }
  }
  const snippet = item.snippet || "";
  const text = `${item.title || ""} ${snippet}`;
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 1 || year > currentYear) return false;
  }
  const daysAgoMatch = snippet.match(/(\d+)\s+days?\s+ago/i);
  if (daysAgoMatch) {
    return parseInt(daysAgoMatch[1]) <= MAX_AGE_DAYS;
  }
  return true;
}

function identifySource(url: string): { source: string; trusted: boolean } {
  for (const blocked of BLOCKED_DOMAINS) { if (blocked.test(url)) return { source: "blocked", trusted: false }; }
  for (const { pattern, source } of TRUSTED_DOMAINS) { if (pattern.test(url)) return { source, trusted: true }; }
  if (/\/careers?/i.test(url) || /\/jobs?\//i.test(url)) { const dm = url.match(/https?:\/\/(?:www\.)?([^/]+)/); return { source: dm ? dm[1].charAt(0).toUpperCase() + dm[1].slice(1) : "Company", trusted: true }; }
  return { source: "unknown", trusted: false };
}

function parseJob(item: any, fallbackCountry: string): RemoteJob | null {
  const url = item.link || ""; const title = item.title || ""; const snippet = item.snippet || "";
  const { source, trusted } = identifySource(url);
  if (!trusted) return null;
  const checkText = `${title} ${snippet} ${url}`;
  const skipPatterns = [/training course/i, /certification training/i, /how to become/i, /salary.*guide/i, /\.pdf$/i, /job description template/i, /page \d/i, /results for/i, /browse jobs/i];
  for (const p of skipPatterns) { if (p.test(checkText)) return null; }
  if (/^\d+\+?\s/i.test(title) || /jobs in all/i.test(title)) return null;

  let jobTitle = title; let company = "Not specified";
  const hiring = title.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
  if (hiring) { company = hiring[1].trim(); jobTitle = hiring[2].trim(); }
  else { const parts = title.split(/\s+[|\-–—]\s+/); if (parts.length >= 2) { const last = parts[parts.length - 1].trim(); if (!["LinkedIn", "SEEK", "Indeed", "Glassdoor", "Google"].includes(last)) { company = last; jobTitle = parts[0].trim(); } } }
  jobTitle = jobTitle.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|Google).*$/i, "").trim();
  if (!jobTitle || jobTitle.length < 5) return null;

  const jobWords = /manager|director|senior|lead|head|chief|vp|specialist|engineer|analyst|coordinator|consultant|officer|executive/i;
  if (!jobWords.test(jobTitle) && !/remote/i.test(jobTitle)) return null;

  const locMatch = checkText.match(/\b(USA|United States|Germany|UK|United Kingdom|Australia|Canada|Remote|Hybrid)\b/i);
  const postedDate = item.date || null;

  return { title: jobTitle, company, location: locMatch ? locMatch[0] : fallbackCountry, url, description: snippet.slice(0, 600), source, country: fallbackCountry, postedDate };
}

export async function POST(req: NextRequest) {
  try {
    const { country: singleCountry } = (await req.json().catch(() => ({}))) as { country?: string };
    const allJobs: RemoteJob[] = []; const seenUrls = new Set<string>();
    const queries: Array<{ q: string; gl: string; country: string }> = [];

    if (singleCountry) {
      const cfg = COUNTRY_QUERIES[singleCountry];
      if (!cfg) return NextResponse.json({ error: `Unknown country: ${singleCountry}` }, { status: 400 });
      for (const q of cfg.queries) queries.push({ q, gl: cfg.gl, country: singleCountry });
    } else {
      for (const [country, cfg] of Object.entries(COUNTRY_QUERIES)) { for (const q of cfg.queries) queries.push({ q, gl: cfg.gl, country }); }
      for (const q of GLOBAL_QUERIES) queries.push({ q, gl: "us", country: "Global" });
    }

    const BATCH = 3;
    for (let i = 0; i < queries.length; i += BATCH) {
      const batch = queries.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(async ({ q, gl, country }) => {
        try {
          const items = await serperSearch(q, gl);
          const jobs: RemoteJob[] = [];
          for (const item of items) {
            if (!isFresh(item)) continue;
            const parsed = parseJob(item, country);
            if (parsed && parsed.url && !seenUrls.has(parsed.url)) { seenUrls.add(parsed.url); jobs.push(parsed); }
          }
          return jobs;
        } catch { return []; }
      }));
      for (const r of results) { if (r.status === "fulfilled") allJobs.push(...r.value); }
      if (i + BATCH < queries.length) await new Promise((r) => setTimeout(r, 600));
    }

    const sourcePriority: Record<string, number> = {
      "LinkedIn": 1, "Indeed": 2, "Glassdoor": 3, "ZipRecruiter": 4,
      "We Work Remotely": 5, "RemoteOK": 6, "JustRemote": 7, "Remote.co": 8, "FlexJobs": 9,
      "Lever": 10, "Greenhouse": 11, "Workday": 12, "Company Career Page": 13,
    };
    allJobs.sort((a, b) => (sourcePriority[a.source] || 99) - (sourcePriority[b.source] || 99));

    return NextResponse.json({ success: true, jobs: allJobs, total: allJobs.length });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}