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
// SERPER.DEV GOOGLE SEARCH
// ---------------------------------------------------------------------------
async function serperSearch(query: string, apiKey: string): Promise<any[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: query,
      num: 10,
      gl: "us",
      hl: "en",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.organic || [];
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

      let source = "google";
      if (url.includes("linkedin.com")) source = "linkedin";
      else if (url.includes("indeed.com")) source = "indeed";
      else if (url.includes("glassdoor.com")) source = "glassdoor";
      else if (url.includes("seek.com")) source = "seek";
      else if (url.includes("rozee.pk")) source = "rozee";
      else if (url.includes("bayt.com")) source = "bayt";
      else if (url.includes("gulftalent.com")) source = "gulftalent";
      else if (url.includes("naukrigulf.com")) source = "naukri";

      const { jobTitle, company } = parseTitleAndCompany(title, snippet, url);

      return {
        title: jobTitle,
        company,
        location: extractLocation(title, snippet),
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
    /slideserve\.com/i, /learnerspoint\.org/i,
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
    if (last && !["LinkedIn", "SEEK", "Indeed", "Glassdoor", "Google"].includes(last)) {
      return { jobTitle: parts[0].trim(), company: last };
    }
  }

  // Fallback: use full name as title
  const cleanTitle = name.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor).*$/i, "").trim();
  let company = "Not specified";
  const cMatch = snippet.match(/(?:Company|at|by):\s*([A-Z][a-zA-Z\s&]+?)(?:\.|,|;|$)/);
  if (cMatch) company = cMatch[1].trim();

  return { jobTitle: cleanTitle, company };
};

// ---------------------------------------------------------------------------
// EXTRACT LOCATION
// ---------------------------------------------------------------------------
const extractLocation = (title: string, snippet: string): string => {
  const text = `${title} ${snippet}`;
  const locMatch = text.match(
    /\b(Lahore|Karachi|Islamabad|Doha|Dubai|Abu Dhabi|London|Berlin|Munich|Sydney|Melbourne|Auckland|Riyadh|Jeddah|Kuwait|Muscat|Manama|Remote|Hybrid)\b/i
  );
  return locMatch ? locMatch[0] : "Not specified";
};

// ---------------------------------------------------------------------------
// MAIN SEARCH FUNCTION
// ---------------------------------------------------------------------------
export const searchJobs = async (profile: SearchProfileConfig): Promise<JobSearchResult[]> => {
  const apiKey = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";

  const allResults: JobSearchResult[] = [];
  const seenUrls = new Set<string>();

  const primaryKeyword = profile.keywords[0];
  const primaryCountry = profile.countries[0];
  const secondKeyword = profile.keywords[1] || primaryKeyword;

  const queries = [
    `site:linkedin.com/jobs "${primaryKeyword}" ${primaryCountry} hiring`,
    `${primaryKeyword} jobs ${primaryCountry} -training -course`,
    `site:indeed.com "${primaryKeyword}" ${primaryCountry}`,
  ];

  console.log(`[job-search] Running ${queries.length} queries for ${profile.cvVariantRoleShort}`);

  for (const query of queries) {
    try {
      const items = await serperSearch(query, apiKey);
      const jobs = parseResults(items, profile);
      for (const r of jobs) {
        if (r.url && !seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          allResults.push(r);
        }
      }
      console.log(`[job-search] Query "${query.slice(0, 50)}..." → ${jobs.length} jobs`);
    } catch (err: any) {
      console.error(`[job-search] Query failed:`, err.message);
    }
    // Delay between queries to respect rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`[job-search] Total: ${allResults.length} unique job postings`);
  return allResults;
};