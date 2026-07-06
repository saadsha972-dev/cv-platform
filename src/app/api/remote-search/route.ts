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
// REMOTE-RELEVANT ROLE QUERIES (~20 broad queries across 7 categories)
// Each includes "remote" and excludes noise (training, course, intern, junior)
// ---------------------------------------------------------------------------
const REMOTE_QUERIES = [
  // 1. Quality & Compliance (4 queries)
  '"remote" "Quality Manager" OR "QA Manager" OR "QC Manager" -training -course -intern -junior',
  '"remote" "Compliance Manager" OR "Regulatory Affairs Manager" -training -course -intern -junior',
  '"remote" "QMS Manager" OR "Quality Systems Manager" OR "Quality Assurance Manager" -training -course -intern -junior',
  '"remote" "ISO Auditor" OR "Compliance Auditor" OR "Internal Auditor" OR "Lead Auditor" -training -course -intern -junior',

  // 2. HSE & Safety (3 queries)
  '"remote" "HSE Manager" OR "EHS Manager" OR "Health Safety Environment" -training -course -intern -junior',
  '"remote" "Safety Manager" OR "Safety Director" OR "Environmental Health Safety" -training -course -intern -junior',
  '"remote" "Environmental Manager" OR "Sustainability Manager" OR "ISO 14001" -training -course -intern -junior',

  // 3. Operations & Process (3 queries)
  '"remote" "Operations Manager" OR "Operations Director" -training -course -intern -junior',
  '"remote" "Process Improvement Manager" OR "Lean Manager" OR "Six Sigma" -training -course -intern -junior',
  '"remote" "Continuous Improvement Manager" OR "Operational Excellence" -training -course -intern -junior',

  // 4. Management & Leadership (3 queries)
  '"remote" "Regional Manager" OR "Area Manager" OR "Territory Manager" -training -course -intern -junior',
  '"remote" "Project Manager" OR "Senior Project Manager" -training -course -intern -junior',
  '"remote" "Program Manager" OR "Portfolio Manager" -training -course -intern -junior',

  // 5. Sales & Business Dev (2 queries)
  '"remote" "Account Manager" OR "Senior Account Manager" OR "Strategic Account Manager" -training -course -intern -junior',
  '"remote" "Business Development Manager" OR "BD Manager" OR "Sales Manager" -training -course -intern -junior',

  // 6. Training & Consulting (2 queries)
  '"remote" "Training Manager" OR "L&D Manager" OR "Learning and Development" -training -course -intern -junior',
  '"remote" "Management Consultant" OR "Senior Consultant" OR "Business Consultant" -training -course -intern -junior',

  // 7. Supply Chain & Procurement (2 queries)
  '"remote" "Supply Chain Manager" OR "Supply Chain Director" -training -course -intern -junior',
  '"remote" "Vendor Manager" OR "Procurement Manager" OR "Supplier Quality Manager" -training -course -intern -junior',
];

// ---------------------------------------------------------------------------
// PER-COUNTRY CONFIGS
// 2 LinkedIn site-specific queries + 2 general queries per country
// ---------------------------------------------------------------------------
const COUNTRY_CONFIGS = [
  {
    country: "USA",
    gl: "us",
    siteQueries: [
      // Broad management/leadership
      'site:linkedin.com/jobs "remote" "manager" OR "director" ("quality" OR "operations" OR "compliance" OR "HSE" OR "project" OR "sales" OR "business development") USA -training -course -intern -junior',
      // Broad auditor/compliance/quality
      'site:linkedin.com/jobs "remote" ("auditor" OR "compliance" OR "quality" OR "process improvement" OR "Lean" OR "Six Sigma") ("manager" OR "lead" OR "senior" OR "specialist") USA -training -course -intern -junior',
    ],
    generalQueries: [
      '"remote" "Quality Manager" OR "Operations Manager" OR "Compliance Manager" OR "Project Manager" jobs USA -training -course -intern -junior',
      '"remote" "HSE Manager" OR "Business Development Manager" OR "Process Improvement" OR "Supply Chain Manager" jobs USA -training -course -intern -junior',
    ],
  },
  {
    country: "Germany",
    gl: "de",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "manager" OR "director" ("quality" OR "operations" OR "compliance" OR "HSE" OR "project" OR "sales" OR "business development") Germany -training -course -intern -junior',
      'site:linkedin.com/jobs "remote" ("auditor" OR "compliance" OR "quality" OR "process improvement" OR "Lean" OR "Six Sigma") ("manager" OR "lead" OR "senior" OR "specialist") Germany -training -course -intern -junior',
    ],
    generalQueries: [
      '"remote" "Quality Manager" OR "Operations Manager" OR "Compliance Manager" OR "Project Manager" jobs Germany -training -course -intern -junior',
      '"remote" "HSE Manager" OR "Business Development Manager" OR "Process Improvement" OR "Supply Chain Manager" jobs Germany -training -course -intern -junior',
    ],
  },
  {
    country: "United Kingdom",
    gl: "uk",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "manager" OR "director" ("quality" OR "operations" OR "compliance" OR "HSE" OR "project" OR "sales" OR "business development") UK -training -course -intern -junior',
      'site:linkedin.com/jobs "remote" ("auditor" OR "compliance" OR "quality" OR "process improvement" OR "Lean" OR "Six Sigma") ("manager" OR "lead" OR "senior" OR "specialist") UK -training -course -intern -junior',
    ],
    generalQueries: [
      'site:indeed.co.uk "remote" "Quality Manager" OR "Operations Manager" OR "Compliance Manager" OR "Project Manager" -training -course -intern -junior',
      '"remote" "HSE Manager" OR "Business Development Manager" OR "Process Improvement" OR "Supply Chain Manager" jobs UK -training -course -intern -junior',
    ],
  },
  {
    country: "Australia",
    gl: "au",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "manager" OR "director" ("quality" OR "operations" OR "compliance" OR "HSE" OR "project" OR "sales" OR "business development") Australia -training -course -intern -junior',
      'site:linkedin.com/jobs "remote" ("auditor" OR "compliance" OR "quality" OR "process improvement" OR "Lean" OR "Six Sigma") ("manager" OR "lead" OR "senior" OR "specialist") Australia -training -course -intern -junior',
    ],
    generalQueries: [
      'site:seek.com.au "remote" "Quality Manager" OR "Operations Manager" OR "Compliance Manager" OR "Project Manager" -training -course -intern -junior',
      '"remote" "HSE Manager" OR "Business Development Manager" OR "Process Improvement" OR "Supply Chain Manager" jobs Australia -training -course -intern -junior',
    ],
  },
  {
    country: "Canada",
    gl: "ca",
    siteQueries: [
      'site:linkedin.com/jobs "remote" "manager" OR "director" ("quality" OR "operations" OR "compliance" OR "HSE" OR "project" OR "sales" OR "business development") Canada -training -course -intern -junior',
      'site:linkedin.com/jobs "remote" ("auditor" OR "compliance" OR "quality" OR "process improvement" OR "Lean" OR "Six Sigma") ("manager" OR "lead" OR "senior" OR "specialist") Canada -training -course -intern -junior',
    ],
    generalQueries: [
      'site:indeed.ca "remote" "Quality Manager" OR "Operations Manager" OR "Compliance Manager" OR "Project Manager" -training -course -intern -junior',
      '"remote" "HSE Manager" OR "Business Development Manager" OR "Process Improvement" OR "Supply Chain Manager" jobs Canada -training -course -intern -junior',
    ],
  },
];

// ---------------------------------------------------------------------------
// GLOBAL REMOTE QUERIES (no country filter — targets major remote job boards)
// ---------------------------------------------------------------------------
const GLOBAL_QUERIES = [
  // Major remote job boards — management & leadership
  'site:weworkremotely.com OR site:remoteok.com OR site:flexjobs.com ("Quality Manager" OR "Operations Manager" OR "Compliance Manager" OR "Project Manager" OR "Program Manager") -training -course -intern -junior',
  // Major remote job boards — sales, consulting, supply chain
  'site:weworkremotely.com OR site:remoteok.com OR site:flexjobs.com ("Account Manager" OR "Business Development" OR "Management Consultant" OR "Supply Chain Manager" OR "Process Improvement") -training -course -intern -junior',
  // LinkedIn global — broad catch-all
  'site:linkedin.com/jobs "remote" ("Quality Manager" OR "HSE Manager" OR "Compliance Manager" OR "Operations Manager" OR "Project Manager" OR "Business Development Manager") -training -course -intern -junior',
  // Indeed global — broad catch-all
  'site:indeed.com "remote" ("Quality Manager" OR "HSE Manager" OR "Compliance Manager" OR "Operations Manager" OR "Project Manager" OR "Business Development Manager") -training -course -intern -junior',
  // Generic broad search across all skill areas
  '"remote" ("Quality Manager" OR "QMS Manager" OR "HSE Manager" OR "Operations Manager" OR "Compliance Manager" OR "Project Manager" OR "Business Development Manager" OR "Process Improvement" OR "Management Consultant" OR "Supply Chain Manager") -training -course -intern -junior',
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