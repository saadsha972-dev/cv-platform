/**
 * POST /api/remote-search
 * Body: { country?: string }
 *
 * Searches for REMOTE jobs relevant to the candidate's actual skills
 * (QHSE, ISO auditing, compliance, quality management, safety consulting)
 * in USA, Germany, UK, Australia, Canada.
 *
 * Unlike the main search profiles which search for managerial/sales roles,
 * this endpoint uses smarter queries focused on genuinely remote-compatible roles.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = "89280a05e2a42179789766db50570d66f5d52b1e";

// ---------------------------------------------------------------------------
// REMOTE-RELEVANT ROLE QUERIES
// These are roles that CAN realistically be done remotely
// (not "Sales Director remote" which makes no sense)
// ---------------------------------------------------------------------------
const REMOTE_QUERIES = [
  // QHSE / Compliance roles (most remote-friendly)
  '"remote" "QHSE Manager" OR "HSE Manager" -training -course -intern -junior',
  '"remote" "ISO Auditor" OR "ISO Lead Auditor" OR "Compliance Auditor" -training -course -intern',
  '"remote" "Quality Manager" OR "QMS Manager" -training -course -intern -junior',
  '"remote" "EHS Manager" OR "Environmental Health Safety" -training -course -intern -junior',
  '"remote" "Safety Consultant" OR "Safety Manager" -training -course -intern -junior',
  '"remote" "Compliance Manager" OR "Regulatory Compliance" -training -course -intern -junior',
  // Process improvement / consulting (often remote)
  '"remote" "Process Improvement Specialist" OR "Continuous Improvement Manager" -training -course -intern',
  '"remote" "HSE Consultant" OR "QHSE Consultant" -training -course -intern',
  // Audit / certification (documentation reviews can be remote)
  '"remote" "Internal Auditor" OR "Lead Auditor" ISO -training -course -intern -junior',
  '"remote" "Risk Manager" OR "Risk Assessment" compliance -training -course -intern -junior',
  // Training / education (very remote-friendly)
  '"remote" "HSE Trainer" OR "Safety Trainer" OR "NEBOSH" -training course -intern -junior',
];

// Per-country site-specific queries (LinkedIn, Indeed, etc.)
const COUNTRY_CONFIGS = [
  {
    country: "USA",
    gl: "us",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "QHSE" OR "ISO" OR "HSE" OR "Quality Manager" -training -course -intern',
      'site:linkedin.com/jobs "remote" "Compliance Manager" OR "EHS Manager" -training -course -intern',
    ],
    generalQueries: [
      '"remote" "QHSE Manager" OR "ISO Auditor" jobs USA -training -course -intern -junior',
      '"remote" "Quality Manager" OR "Safety Manager" jobs USA -training -course -intern -junior',
    ],
  },
  {
    country: "Germany",
    gl: "de",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "QHSE" OR "ISO" OR "HSE" Germany -training -course -intern',
      'site:linkedin.com/jobs "remote" "Quality Manager" OR "Compliance" Germany -training -course -intern',
    ],
    generalQueries: [
      '"remote" "QHSE" OR "ISO Auditor" OR "Quality Manager" jobs Germany -training -course -intern',
    ],
  },
  {
    country: "United Kingdom",
    gl: "uk",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "QHSE" OR "ISO" OR "HSE" "United Kingdom" -training -course -intern',
      'site:linkedin.com/jobs "remote" "Quality Manager" OR "Compliance" UK -training -course -intern',
    ],
    generalQueries: [
      '"remote" "QHSE Manager" OR "ISO Auditor" jobs UK -training -course -intern -junior',
    ],
  },
  {
    country: "Australia",
    gl: "au",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "QHSE" OR "ISO" OR "HSE" Australia -training -course -intern',
      'site:seek.com.au "remote" "HSE" OR "Quality" OR "Safety" -training -course',
    ],
    generalQueries: [
      '"remote" "QHSE" OR "HSE Manager" OR "Safety Manager" jobs Australia -training -course -intern -junior',
    ],
  },
  {
    country: "Canada",
    gl: "ca",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "QHSE" OR "ISO" OR "HSE" Canada -training -course -intern',
      'site:linkedin.com/jobs "remote" "Quality Manager" OR "Compliance" Canada -training -course -intern',
    ],
    generalQueries: [
      '"remote" "QHSE Manager" OR "ISO Auditor" jobs Canada -training -course -intern -junior',
    ],
  },
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
async function serperSearch(query: string, gl: string, num = 10): Promise<any[]> {
  const body: any = {
    q: query,
    num,
    hl: "en",
    tbs: "qdr:w", // Past WEEK for maximum freshness
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
      if (!["LinkedIn", "SEEK", "Indeed", "Glassdoor", "Google", "StepStone"].includes(last)) {
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

    // Add a few global remote queries (no country filter, just "remote" + skill)
    queries.push(
      { q: '"remote" "QHSE Manager" OR "ISO Lead Auditor" OR "Quality Manager" -training -course -intern -junior', gl: "us", country: "Global" },
      { q: 'site:linkedin.com/jobs "remote" "QHSE" OR "ISO" OR "HSE" OR "Compliance" -training -course -intern', gl: "us", country: "Global" },
      { q: '"remote" HSE OR safety OR quality OR compliance manager -training -course -intern -junior', gl: "us", country: "Global" },
    );

    console.log(`[remote-search] Running ${queries.length} queries across ${configs.length} countries`);

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