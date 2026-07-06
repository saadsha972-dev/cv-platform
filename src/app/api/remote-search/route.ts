/**
 * POST /api/remote-search
 * Body: { country?: string }
 *
 * Searches for REMOTE jobs across ALL industries using simple, effective queries.
 * Targets USA, Germany, UK, Australia, Canada plus global remote boards.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = "89280a05e2a42179789766db50570d66f5d52b1e";

// ---------------------------------------------------------------------------
// SIMPLE, EFFECTIVE QUERIES — complex boolean kills Google results
// ---------------------------------------------------------------------------

// Per-country: simple queries that actually return results
const COUNTRY_QUERIES: Record<string, { gl: string; queries: string[] }> = {
  USA: {
    gl: "us",
    queries: [
      "remote manager jobs hiring USA",
      "remote director jobs USA",
      "remote senior specialist jobs USA",
      "work from home manager jobs USA",
      "remote team lead positions USA",
    ],
  },
  Germany: {
    gl: "de",
    queries: [
      "remote manager jobs Germany hiring",
      "remote director jobs Germany",
      "remote senior jobs Germany English",
    ],
  },
  "United Kingdom": {
    gl: "uk",
    queries: [
      "remote manager jobs UK hiring",
      "remote director jobs United Kingdom",
      "work from home manager jobs UK",
    ],
  },
  Australia: {
    gl: "au",
    queries: [
      "remote manager jobs Australia hiring",
      "remote director jobs Australia",
      "work from home senior jobs Australia",
    ],
  },
  Canada: {
    gl: "ca",
    queries: [
      "remote manager jobs Canada hiring",
      "remote director jobs Canada",
      "work from home manager jobs Canada",
    ],
  },
};

// Global queries — simple queries (NO site: — blocked on Serper free tier)
const GLOBAL_QUERIES = [
  "remote manager jobs hiring",
  "remote director jobs hiring",
  "work from home manager jobs",
  "remote senior specialist jobs",
  "remote team lead positions hiring",
  "work from home jobs manager director",
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
    // NOTE: Do NOT use tbs date filter — kills results for niche roles
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
    /youtube\.com/i, /reddit\.com/i,
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
      if (!["LinkedIn", "SEEK", "Indeed", "Glassdoor", "StepStone", "Google", "We Work Remotely"].includes(last)) {
        company = last;
        jobTitle = parts[0].trim();
      }
    }
  }

  // Clean title
  jobTitle = jobTitle.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|StepStone|Google|We Work Remotely).*$/i, "").trim();

  if (!jobTitle || jobTitle.length < 5) return null;

  // Determine source
  let source = "google";
  if (url.includes("linkedin.com")) source = "linkedin";
  else if (url.includes("indeed.com")) source = "indeed";
  else if (url.includes("glassdoor.com")) source = "glassdoor";
  else if (url.includes("seek.com.au")) source = "seek";
  else if (url.includes("weworkremotely.com")) source = "weworkremotely";
  else if (url.includes("remoteok.com")) source = "remoteok";
  else if (url.includes("flexjobs.com")) source = "flexjobs";

  // Extract location
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

    // Build query list
    const queries: Array<{ q: string; gl: string; country: string }> = [];

    if (singleCountry) {
      const cfg = COUNTRY_QUERIES[singleCountry];
      if (!cfg) {
        return NextResponse.json({ error: `Unknown country: ${singleCountry}` }, { status: 400 });
      }
      for (const q of cfg.queries) {
        queries.push({ q, gl: cfg.gl, country: singleCountry });
      }
    } else {
      // All countries
      for (const [country, cfg] of Object.entries(COUNTRY_QUERIES)) {
        for (const q of cfg.queries) {
          queries.push({ q, gl: cfg.gl, country });
        }
      }
      // Plus global queries
      for (const q of GLOBAL_QUERIES) {
        queries.push({ q, gl: "us", country: "Global" });
      }
    }

    console.log(`[remote-search] Running ${queries.length} queries`);

    // Execute in batches of 3
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
            console.log(`[remote-search] "${q.slice(0, 50)}..." -> ${jobs.length} jobs`);
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

      if (i + BATCH < queries.length) {
        await new Promise((r) => setTimeout(r, 500));
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