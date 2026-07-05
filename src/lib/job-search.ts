/**
 * Job Search Module
 * =================
 * Uses z-ai-web-dev-sdk web search to find job postings across
 * LinkedIn, Indeed, Seek, Rozee, Glassdoor, Google Jobs.
 *
 * Strategy: use site-specific search queries via the web-search API,
 * then extract structured job data from the results.
 */

import ZAI from "z-ai-web-dev-sdk";

let _zai: any = null;
const getZai = async () => {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
};

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface JobSearchResult {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string; // linkedin, indeed, seek, rozee, glassdoor, google
}

export interface SearchProfileConfig {
  keywords: string[];
  countries: string[];
  excludeKeywords: string[];
  cvVariantSlug: string;
  cvVariantRoleShort: string;
}

// ---------------------------------------------------------------------------
// JOB PORTAL SITE TARGETS
// ---------------------------------------------------------------------------
const JOB_SITES = [
  { source: "linkedin", domain: "linkedin.com/jobs" },
  { source: "indeed", domain: "indeed.com" },
  { source: "seek", domain: "seek.com" },
  { source: "rozee", domain: "rozee.pk" },
  { source: "glassdoor", domain: "glassdoor.com" },
  { source: "google", domain: "google.com/search" }, // fallback for Google Jobs
];

// ---------------------------------------------------------------------------
// RUN A SINGLE SEARCH QUERY
// ---------------------------------------------------------------------------
const runSearchQuery = async (query: string): Promise<JobSearchResult[]> => {
  try {
    const zai = await getZai();
    const results = await zai.functions.invoke("web_search", {
      query,
      num: 10,
    });

    // web_search returns an array of SearchFunctionResultItem directly
    const items: any[] = Array.isArray(results) ? results : (results as any)?.data || [];

    return items
      .slice(0, 10)
      .map((item: any) => {
        const url = item.url || item.link || "";
        const name = item.name || item.title || "";
        const snippet = item.snippet || "";

        let source = "google";
        for (const site of JOB_SITES) {
          if (url.includes(site.domain.split("/")[0])) {
            source = site.source;
            break;
          }
        }

        // Parse the title to extract job title and company
        const { jobTitle, company } = parseJobTitle(name, snippet, url);

        return {
          title: jobTitle,
          company,
          location: extractLocation(name, snippet),
          url,
          description: snippet.slice(0, 500),
          source,
        };
      })
      .filter((job) => {
        // Filter out generic search/category pages — only keep actual job postings
        return isActualJobPosting(job);
      });
  } catch (err: any) {
    // If rate-limited, return empty array (don't crash the whole search)
    if (err?.message?.includes("429") || err?.message?.includes("Too many requests")) {
      console.error("[job-search] Rate limited, waiting before retry...");
      // Wait 10 seconds before continuing
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return [];
    }
    console.error("[job-search] query failed:", query, err);
    return [];
  }
};

/**
 * Determine if a search result is an actual job posting vs a generic category page
 * or training/course listing.
 */
const isActualJobPosting = (job: JobSearchResult): boolean => {
  const titleLower = job.title.toLowerCase();
  const urlLower = job.url.toLowerCase();
  const descLower = job.description.toLowerCase();

  // Exclude training courses and certification programs
  const trainingPatterns = [
    /training course/i,
    /certification training/i,
    /lead auditor course/i,
    /iso 9001 training/i,
    /lead auditor training/i,
    /qms training/i,
    /course schedule/i,
    /ppt presentation/i,
    /powerpoint/i,
    /\.pdf$/i,
    /slideserve\.com/i,
    /facebook\.com/i,
    /lrqa\.com\/training/i,
    /vinsys\.com\/training/i,
    /excelledia\.com\/training/i,
    /tuvsud\.com.*training/i,
    /learnerspoint\.org/i,
    /greenintlupdaexamtraining/i,
  ];
  for (const pattern of trainingPatterns) {
    if (pattern.test(titleLower) || pattern.test(urlLower) || pattern.test(descLower)) {
      return false;
    }
  }

  // Exclude generic search/category pages
  const genericPatterns = [
    /^\d+\+?\s/i,              // "1,000+ HSE jobs..."
    /jobs in/i,                 // "...jobs in Qatar"
    /jobs? in all/i,            // "...jobs in All Sydney"
    /browse jobs/i,
    /search jobs/i,
    /find jobs/i,
    /what .* jobs are near me/i,
    /jobs near me/i,
  ];

  // LinkedIn /view/ URLs are individual job postings — always keep
  if (urlLower.includes("/jobs/view/")) return true;

  // LinkedIn category pages (e.g., /jobs/hse-manager-jobs-qatar) — skip
  if (urlLower.includes("linkedin.com/jobs/") && !urlLower.includes("/view/")) {
    // But keep if the title looks like a specific job (has "hiring" or specific company)
    if (job.title.toLowerCase().includes("hiring")) return true;
    return false;
  }

  // Seek category pages (e.g., /oil-and-gas-jobs) — skip
  if (urlLower.includes("seek.com") && !urlLower.includes("/job/")) {
    return false;
  }

  // Rozee company profile pages — skip (they're not job postings)
  if (urlLower.includes("rozee.pk/company/")) {
    return false;
  }

  // Rigzone job category pages — skip unless it's a specific job
  if (urlLower.includes("rigzone.com") && !urlLower.includes("/o-jobs/")) {
    return false;
  }

  // WhatJobs generic pages — skip
  if (urlLower.includes("whatjobs.com")) {
    return false;
  }

  // Check title for generic patterns
  for (const pattern of genericPatterns) {
    if (pattern.test(job.title)) return false;
  }

  return true;
};

/**
 * Parse a search result title to extract the job title and company.
 * Handles common patterns like:
 * - "Company hiring Job Title in Location"
 * - "Job Title - Company"
 * - "Job Title at Company"
 */
const parseJobTitle = (name: string, snippet: string, url: string): { jobTitle: string; company: string } => {
  // Pattern 1: "Company hiring Job Title in Location" (LinkedIn format)
  const hiringMatch = name.match(/^(.+?)\s+hiring\s+(.+?)\s+(?:in|at)\s+/i);
  if (hiringMatch) {
    return { company: hiringMatch[1].trim(), jobTitle: hiringMatch[2].trim() };
  }

  // Pattern 2: "Job Title - Company" or "Job Title | Company"
  const dashMatch = name.split(/\s+[|\-–—]\s+/);
  if (dashMatch.length >= 2) {
    // If the last part looks like a company (not "LinkedIn", "SEEK", etc.)
    const lastPart = dashMatch[dashMatch.length - 1].trim();
    if (lastPart && !["LinkedIn", "SEEK", "Indeed", "Jobs"].includes(lastPart)) {
      return { jobTitle: dashMatch[0].trim(), company: lastPart };
    }
  }

  // Pattern 3: Check snippet for "hiring" pattern
  const snippetHiring = snippet.match(/(.+?)\s+is hiring\s+(.+?)\s+in\s+/i);
  if (snippetHiring) {
    return { company: snippetHiring[1].trim(), jobTitle: snippetHiring[2].trim() };
  }

  // Fallback: use the full name as title, try to extract company from snippet
  let company = "Not specified";
  // Look for "Company: X" or "at X" patterns in snippet
  const companyMatch = snippet.match(/(?:Company|at|by):\s*([A-Z][a-zA-Z\s&]+?)(?:\.|,|;|$)/);
  if (companyMatch) {
    company = companyMatch[1].trim();
  }

  return { jobTitle: name.replace(/\s*[|\-–—]\s*(LinkedIn|SEEK|Indeed|Glassdoor).*$/i, "").trim(), company };
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const extractCompany = (url: string, title: string): string => {
  // Try to extract from title patterns like "Job Title - Company"
  const parts = title.split(/\s+[|\-–—]\s+/);
  if (parts.length >= 2) return parts[parts.length - 1].trim();
  return "Not specified";
};

const extractLocation = (title: string, snippet: string): string => {
  // Look for common location patterns
  const text = `${title} ${snippet}`;
  const locationMatch = text.match(/\b(Lahore|Karachi|Islamabad|Doha|Dubai|Abu Dhabi|London|Essex|Brentwood|Berlin|Munich|Frankfurt|Sydney|Melbourne|Auckland|Remote|Hybrid)\b/i);
  return locationMatch ? locationMatch[0] : "Not specified";
};

// ---------------------------------------------------------------------------
// MAIN SEARCH FUNCTION
// ---------------------------------------------------------------------------
export const searchJobs = async (profile: SearchProfileConfig): Promise<JobSearchResult[]> => {
  const allResults: JobSearchResult[] = [];
  const seenUrls = new Set<string>();

  // Build queries — keep it focused to avoid rate limits
  // Use 1 keyword × 1 country × 1 site = fewer, higher-quality queries
  const queries: string[] = [];
  const primaryKeyword = profile.keywords[0];
  const primaryCountry = profile.countries[0];

  // 2 targeted LinkedIn queries (best for job postings)
  queries.push(`site:linkedin.com/jobs ${primaryKeyword} ${primaryCountry}`);
  if (profile.keywords[1]) {
    queries.push(`site:linkedin.com/jobs ${profile.keywords[1]} ${primaryCountry}`);
  }

  // 1 general query for broader coverage
  queries.push(`${primaryKeyword} jobs ${primaryCountry} hiring`);

  console.log(`[job-search] Running ${queries.length} queries for ${profile.cvVariantRoleShort}`);

  // Run queries SEQUENTIALLY with delay to avoid rate limits
  for (const query of queries) {
    const results = await runSearchQuery(query);
    for (const r of results) {
      if (r.url && !seenUrls.has(r.url) && !isExcluded(r, profile.excludeKeywords)) {
        seenUrls.add(r.url);
        allResults.push(r);
      }
    }
    // Wait 2 seconds between queries to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`[job-search] Found ${allResults.length} unique job postings`);
  return allResults;
};

const isExcluded = (result: JobSearchResult, excludeKeywords: string[]): boolean => {
  if (!excludeKeywords.length) return false;
  const text = `${result.title} ${result.company} ${result.description}`.toLowerCase();
  return excludeKeywords.some((k) => text.includes(k.toLowerCase()));
};
