/**
 * POST /api/remote-search
 * Body: { country?: string }
 *
 * Searches for REMOTE jobs across a broad range of roles the candidate
 * can realistically qualify for given 20+ years of experience in:
 * Quality Management, HSE, Auditing, Sales & Business Development,
 * Operations, Process Improvement, Training & Consulting, Supply Chain,
 * Project Management, and Compliance.
 *
 * Searches USA, Germany, UK, Australia, Canada plus global remote boards.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = "89280a05e2a42179789766db50570d66f5d52b1e";

// ---------------------------------------------------------------------------
// GENERIC REMOTE QUERIES — no role filters, just "remote jobs"
// ---------------------------------------------------------------------------
const REMOTE_QUERIES = [
  // Broad senior/managerial remote jobs
  '"remote" "manager" OR "director" OR "senior" OR "lead" jobs -training -course -intern -junior -graduate',
  '"remote" "specialist" OR "coordinator" OR "consultant" jobs -training -course -intern -junior -graduate',
  // Generic by seniority level
  '"remote" jobs hiring ("manager" OR "director" OR "head of" OR "vp" OR "lead") -training -course -intern -junior',
  // Broad function-agnostic
  '"remote jobs" ("manager" OR "director" OR "senior manager" OR "team lead") -training -course -intern -junior',
];

// ---------------------------------------------------------------------------
// PER-COUNTRY CONFIGS — generic "remote" + managerial, no role-specific filters
// ---------------------------------------------------------------------------
const COUNTRY_CONFIGS = [
  {
    country: "USA",
    gl: "us",
    siteQueries: [
      'site:linkedin.com/jobs "remote" ("manager" OR "director" OR "senior manager" OR "head of" OR "lead") USA -training -course -intern -junior -graduate',
      'site:linkedin.com/jobs "remote" ("specialist" OR "consultant" OR "coordinator") ("senior" OR "lead" OR "manager") USA -training -course -intern -junior',
    ],
    generalQueries: [
      '"remote" jobs ("manager" OR "director" OR "senior") USA -training -course -intern -junior -graduate',
      '"remote" ("senior manager" OR "team lead" OR "head of") jobs USA -training -course -intern -junior',
    ],
  },
  {
    country: "Germany",
    gl: "de",
    siteQueries: [
      'site:linkedin.com/jobs "remote" ("manager" OR "director" OR "senior manager" OR "head of" OR "lead") Germany -training -course -intern -junior -graduate',
      'site:stepstone.de "remote" ("manager" OR "director" OR "senior") -training -course -intern -junior',
    ],
    generalQueries: [
      '"remote" jobs ("manager" OR "director" OR "senior") Germany -training -course -intern -junior -graduate',
    ],
  },
  {
    country: "United Kingdom",
    gl: "uk",
    siteQueries: [
      'site:linkedin.com/jobs "remote" ("manager" OR "director" OR "senior manager" OR "head of" OR "lead") UK -training -course -intern -junior -graduate',
      'site:indeed.co.uk "remote" ("manager" OR "director" OR "senior") -training -course -intern -junior',
    ],
    generalQueries: [
      '"remote" jobs ("manager" OR "director" OR "senior") UK -training -course -intern -junior -graduate',
    ],
  },
  {
    country: "Australia",
    gl: "au",
    siteQueries: [
      'site:linkedin.com/jobs "remote" ("manager" OR "director" OR "senior manager" OR "head of" OR "lead") Australia -training -course -intern -junior -graduate',
      'site:seek.com.au "remote" ("manager" OR "director" OR "senior") -training -course -intern',
    ],
    generalQueries: [
      '"remote" jobs ("manager" OR "director" OR "senior") Australia -training -course -intern -junior -graduate',
    ],
  },
  {
    country: "Canada",
    gl: "ca",
    siteQueries: [
      'site:linkedin.com/jobs "remote" ("manager" OR "director" OR "senior manager" OR "head of" OR "lead") Canada -training -course -intern -junior -graduate',
      'site:indeed.ca "remote" ("manager" OR "director" OR "senior") -training -course -intern -junior',
    ],
    generalQueries: [
      '"remote" jobs ("manager" OR "director" OR "senior") Canada -training -course -intern -junior -graduate',
    ],
  },
];

// ---------------------------------------------------------------------------
// GLOBAL REMOTE QUERIES (no country filter — targets major remote job boards)
// ---------------------------------------------------------------------------
const GLOBAL_QUERIES = [
  // Major remote job boards — all management/leadership roles
  'site:weworkremotely.com OR site:remoteok.com OR site:flexjobs.com ("manager" OR "director" OR "head of" OR "senior" OR "lead") -training -course -intern -junior',
  // LinkedIn global — broad managerial remote
  'site:linkedin.com/jobs "remote" ("manager" OR "director" OR "senior manager" OR "team lead" OR "head of") -training -course -intern -junior',
  // Indeed global — broad managerial remote
  'site:indeed.com "remote" ("manager" OR "director" OR "senior" OR "lead" OR "specialist") -training -course -intern -junior',
  // Generic broad remote search
  '"remote jobs" ("manager" OR "director" OR "senior" OR "lead" OR "consultant") hiring -training -course -intern -junior -graduate',
];

interface RemoteJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  country: string;
}

// ---------------------------------------------------------------------------
// SERPER SEARCH
// ---------------------------------------------------------------------------
async function serperSearch(query: string, gl: string, num = 15): Promise<any[]> {
  const body: any = {
    q: query,
    num,
    hl: "en",
    tbs: "qdr:m", // Past MONTH for better results
    gl,
  };

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.organic || [];
}

// ---------------------------------------------------------------------------
// PARSING
// ---------------------------------------------------------------------------
function parseJob(item: any, fallbackCountry: string): RemoteJob | null {
  const url = item.link || "";
  const title = item.title || "";
  const snippet = item.snippet || "";

  // Skip non-job results
  const skipPatterns = [
    /training course/i, /certification training/i, /how to become/i,
    /what does a/i, /salary.*guide/i, /course schedule/i, /\.pdf$/i,
    /facebook\.com/i, /slideserve\.com/i, /learnerspoint\.org/i,
    /job description template/i, /wikipedia\.org/i,
  ];

  const checkText = `${title} ${snippet} ${url}`;
  for (const p of skipPatterns) {
    if (p.test(checkText)) return null;
  }

  // Skip category/browse pages
  if (/^\d+\+?\s/i.test(title)) return null;
  if (/jobs in all/i.test(title)) return null;
  if (/browse jobs/i.test(title) || /search jobs/i.test(title)) return null;

  // LinkedIn: keep individual postings
  if (url.includes("linkedin.com/jobs/") && !url.includes("/jobs/view/")) {
    if (!title.toLowerCase().includes("hiring")) return null;
  }

  // Seek: keep individual postings
  if (url.includes("seek.com") && !url.includes("/job/")) return null;

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
      if (!["LinkedIn", "SEEK", "Indeed", "Glassdoor", "StepStone"].includes(last)) {
        company = last;
        jobTitle = parts[0].trim();
      }
    }
  }

  // Clean title
  jobTitle = jobTitle.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|StepStone|Google).*$/i, "").trim();

  // Determine source
  let source = "google";
  if (url.includes("linkedin.com")) source = "linkedin";
  else if (url.includes("indeed.com")) source = "indeed";
  else if (url.includes("glassdoor.com")) source = "glassdoor";
  else if (url.includes("seek.com.au")) source = "seek";
  else if (url.includes("weworkremotely.com")) source = "weworkremotely";
  else if (url.includes("remoteok.com")) source = "remoteok";
  else if (url.includes("flexjobs.com")) source = "flexjobs";

  // Extract location from title/snippet
  const locMatch = checkText.match(
    /\b(USA|United States|Germany|UK|United Kingdom|Australia|Canada|Remote|Hybrid)\b/i
  );
  const location = locMatch ? locMatch[0] : fallbackCountry;

  return {
    title: jobTitle,
    company,
    location,
    url,
    description: snippet.slice(0, 800),
    source,
    country: fallbackCountry,
  };
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

    // Determine which countries to search
    const configs = singleCountry
      ? COUNTRY_CONFIGS.filter((c) => c.country.toLowerCase() === singleCountry.toLowerCase())
      : COUNTRY_CONFIGS;

    if (configs.length === 0) {
      return NextResponse.json({ error: `Unknown country: ${singleCountry}` }, { status: 400 });
    }

    // Build all queries
    const queries: Array<{ q: string; gl: string; country: string }> = [];

    for (const cfg of configs) {
      // Country-specific site queries
      for (const sq of cfg.siteQueries) {
        queries.push({ q: sq, gl: cfg.gl, country: cfg.country });
      }
      // Country-specific general queries
      for (const gq of cfg.generalQueries) {
        queries.push({ q: gq, gl: cfg.gl, country: cfg.country });
      }
    }

    // Add global remote queries (no country filter — major remote job boards)
    for (const gq of GLOBAL_QUERIES) {
      queries.push({ q: gq, gl: "us", country: "Global" });
    }

    console.log(`[remote-search] Running ${queries.length} queries across ${configs.length} countries + global`);

    // Execute queries in parallel batches of 3 (respect rate limits)
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
            console.log(`[remote-search] "${q.slice(0, 60)}..." -> ${jobs.length} jobs`);
            return jobs;
          } catch (err: any) {
            console.error(`[remote-search] Query failed:`, err.message);
            return [];
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          allJobs.push(...r.value);
        }
      }

      // Delay between batches
      if (i + BATCH < queries.length) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    console.log(`[remote-search] Total: ${allJobs.length} unique remote jobs`);
    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
    });
  } catch (err: any) {
    console.error("[remote-search] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}