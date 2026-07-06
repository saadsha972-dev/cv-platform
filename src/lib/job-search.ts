/**
 * Job Search Module
 * =================
 * Searches for job postings using Serper.dev (Google Search API).
 * Free tier: 2,500 queries/month at https://serper.dev
 *
 * Set SERPER_API_KEY in Vercel Environment Variables.
 * Fallback: returns empty array if no API key is set.
 */

export interface JobSearchResult {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
}

export interface SearchProfileConfig {
  keywords: string[];
  countries: string[];
  excludeKeywords: string[];
  cvVariantSlug: string;
  cvVariantRoleShort: string;
}

// ---------------------------------------------------------------------------
// SERPER.DEV GOOGLE SEARCH — with date recency filter
// ---------------------------------------------------------------------------
async function serperSearch(query: string, apiKey: string, gl?: string): Promise<any[]> {
  const body: any = {
    q: query,
    num: 20, // More results per query
    hl: "en",
    // Date recency filter: past MONTH for better coverage
    tbs: "qdr:m",
  };

  // Set geolocation based on country if possible
  if (gl) {
    body.gl = gl;
  }

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
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
// COUNTRY → GEOLOCATION + DOMAIN MAPPING
// ---------------------------------------------------------------------------
const COUNTRY_GEO: Record<string, string> = {
  "usa": "us",
  "united states": "us",
  "germany": "de",
  "united kingdom": "uk",
  "uk": "uk",
  "australia": "au",
  "canada": "ca",
  "qatar": "qa",
  "uae": "ae",
  "saudi arabia": "sa",
  "kuwait": "kw",
  "oman": "om",
  "pakistan": "pk",
  "singapore": "sg",
  "new zealand": "nz",
};

function getGeo(country: string): string {
  return COUNTRY_GEO[country.toLowerCase().trim()] || "us";
}

// ---------------------------------------------------------------------------
// PARSE SEARCH RESULTS INTO JOB POSTINGS
// ---------------------------------------------------------------------------
function parseResults(items: any[], profile: SearchProfileConfig): JobSearchResult[] {
  return items
    .map((item) => {
      const url = item.link || "";
      const title = item.title || "";
      const snippet = item.snippet || "";
      const date = item.date || ""; // Serper may return date with tbs filter

      let source = "google";
      if (url.includes("linkedin.com")) source = "linkedin";
      else if (url.includes("indeed.com")) source = "indeed";
      else if (url.includes("glassdoor.com")) source = "glassdoor";
      else if (url.includes("seek.com.au")) source = "seek";
      else if (url.includes("rozee.pk")) source = "rozee";
      else if (url.includes("bayt.com")) source = "bayt";
      else if (url.includes("gulftalent.com")) source = "gulftalent";
      else if (url.includes("naukrigulf.com")) source = "naukri";
      else if (url.includes("monster.com")) source = "monster";
      else if (url.includes("stepstone.de")) source = "stepstone";
      else if (url.includes("xing.com")) source = "xing";

      const { jobTitle, company } = parseTitleAndCompany(title, snippet, url);

      return {
        title: jobTitle,
        company,
        location: extractLocation(title, snippet, profile.countries),
        url,
        description: snippet.slice(0, 800),
        source,
      };
    })
    .filter((job) => isActualJobPosting(job) && !isExcluded(job, profile.excludeKeywords));
}

// ---------------------------------------------------------------------------
// FILTERS
// ---------------------------------------------------------------------------
const isActualJobPosting = (job: JobSearchResult): boolean => {
  const t = job.title.toLowerCase();
  const u = job.url.toLowerCase();
  const d = job.description.toLowerCase();

  // Skip training/course listings
  const skip = [
    /training course/i, /certification training/i, /lead auditor course/i,
    /iso 9001 training/i, /course schedule/i, /\.pdf$/i, /facebook\.com/i,
    /slideserve\.com/i, /learnerspoint\.org/i, /salary.*guide/i,
    /how to become/i, /what does a/i, /job description template/i,
  ];
  for (const p of skip) {
    if (p.test(t) || p.test(u) || p.test(d)) return false;
  }

  // Skip generic category pages
  if (/^\d+\+?\s/i.test(t)) return false;
  if (/jobs in all/i.test(t)) return false;
  if (/browse jobs/i.test(t) || /search jobs/i.test(t)) return false;

  // LinkedIn: keep individual postings, skip category pages
  if (u.includes("linkedin.com/jobs/") && !u.includes("/jobs/view/")) {
    if (!t.toLowerCase().includes("hiring")) return false;
  }

  // Seek: keep individual postings
  if (u.includes("seek.com") && !u.includes("/job/")) return false;

  // Rozee: skip company profiles
  if (u.includes("rozee.pk/company/")) return false;

  return true;
};

const isExcluded = (job: JobSearchResult, excludeKeywords: string[]): boolean => {
  if (!excludeKeywords.length) return false;
  const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
  return excludeKeywords.some((k) => text.includes(k.toLowerCase()));
};

// ---------------------------------------------------------------------------
// PARSE TITLE → JOB TITLE + COMPANY
// ---------------------------------------------------------------------------
const parseTitleAndCompany = (
  name: string, snippet: string, url: string
): { jobTitle: string; company: string } => {
  // "Company hiring Job Title in Location"
  const hiring = name.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
  if (hiring) return { company: hiring[1].trim(), jobTitle: hiring[2].trim() };

  // "Job Title - Company" or "Job Title | Company"
  const parts = name.split(/\s+[|\-–—]\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    if (last && !["LinkedIn", "SEEK", "Indeed", "Glassdoor", "Google", "StepStone"].includes(last)) {
      return { jobTitle: parts[0].trim(), company: last };
    }
  }

  // Fallback: use full name as title
  const cleanTitle = name.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor|StepStone|Google).*$/i, "").trim();
  let company = "Not specified";
  const cMatch = snippet.match(/(?:Company|at|by):\s*([A-Z][a-zA-Z\s&]+?)(?:\.|,|;|$)/);
  if (cMatch) company = cMatch[1].trim();

  return { jobTitle: cleanTitle, company };
};

// ---------------------------------------------------------------------------
// EXTRACT LOCATION — now aware of profile countries
// ---------------------------------------------------------------------------
function extractLocation(title: string, snippet: string, profileCountries: string[]): string {
  const text = `${title} ${snippet}`;

  // Build a comprehensive location regex from profile countries + common cities
  const locations = [
    // Profile countries
    ...profileCountries.map(c => c.trim()),
    // Common city matches
    "Lahore", "Karachi", "Islamabad", "Doha", "Dubai", "Abu Dhabi",
    "London", "Berlin", "Munich", "Frankfurt", "Sydney", "Melbourne",
    "Auckland", "Riyadh", "Jeddah", "Kuwait", "Muscat", "Manama",
    "Remote", "Hybrid", "New York", "Texas", "California", "Toronto",
    "Vancouver", "Edmonton", "Houston", "Chicago",
  ];

  // Sort by length descending so longer matches take priority (e.g., "United Kingdom" before "UK")
  const sorted = [...new Set(locations)].sort((a, b) => b.length - a.length);
  const pattern = sorted.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|");

  const locMatch = text.match(new RegExp(`\\b(${pattern})\\b`, "i"));
  return locMatch ? locMatch[0].trim() : profileCountries[0] || "Not specified";
}

// ---------------------------------------------------------------------------
// MAIN SEARCH FUNCTION
// Generates queries per country for better coverage + recency
// ---------------------------------------------------------------------------
export const searchJobs = async (profile: SearchProfileConfig): Promise<JobSearchResult[]> => {
  const apiKey = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";

  const allResults: JobSearchResult[] = [];
  const seenUrls = new Set<string>();

  const primaryKeyword = profile.keywords[0];
  const secondKeyword = profile.keywords[1] || primaryKeyword;

  // Build queries: one set per country for LinkedIn, one general set
  const queries: Array<{ q: string; gl?: string }> = [];

  // For each country, generate targeted queries
  const uniqueCountries = [...new Set(profile.countries.map(c => c.trim()))];

  for (const country of uniqueCountries.slice(0, 5)) {
    const geo = getGeo(country);

    // LinkedIn query per country
    queries.push({
      q: `site:linkedin.com/jobs "${primaryKeyword}" ${country} hiring`,
      gl: geo,
    });

    // Indeed or general query per country (alternate between them)
    if (["usa", "united states", "uk", "united kingdom", "australia", "canada", "germany"].includes(country.toLowerCase())) {
      queries.push({
        q: `"${primaryKeyword}" jobs ${country} -training -course -intern -junior`,
        gl: geo,
      });
    }
  }

  // One broad query with multiple keywords
  if (secondKeyword !== primaryKeyword) {
    queries.push({
      q: `"${primaryKeyword}" OR "${secondKeyword}" jobs hiring -training -course`,
      gl: "us",
    });
  }

  console.log(`[job-search] Running ${queries.length} queries for ${profile.cvVariantRoleShort}`);

  // Execute queries in parallel batches of 3 for speed
  const BATCH = 3;
  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async ({ q, gl }) => {
        try {
          const items = await serperSearch(q, apiKey, gl);
          const jobs = parseResults(items, profile);
          console.log(`[job-search] Query "${q.slice(0, 60)}..." -> ${jobs.length} jobs`);
          return jobs;
        } catch (err: any) {
          console.error(`[job-search] Query failed:`, err.message);
          return [] as ReturnType<typeof parseResults>;
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const job of r.value) {
          if (job.url && !seenUrls.has(job.url)) {
            seenUrls.add(job.url);
            allResults.push(job);
          }
        }
      }
    }

    // Delay between batches
    if (i + BATCH < queries.length) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  console.log(`[job-search] Total: ${allResults.length} unique job postings`);
  return allResults;
};