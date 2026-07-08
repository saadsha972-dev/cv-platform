import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CV_VARIANTS, getCvBySlug } from "@/lib/cv-data";
import { scoreJobMatch } from "@/lib/llm-tailor";
export const runtime = "nodejs";
export const maxDuration = 120;

const SERPER_KEY = process.env.SERPER_API_KEY || "89280a05e2a42179789766db50570d66f5d52b1e";
const MAX_AGE_DAYS = 21; // Hard max: 3 weeks

async function serperSearch(query: string, gl: string, num = 12): Promise<any[]> {
  // Use qdr:w (past week) — much more reliable than qdr:m for freshness
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": SERPER_KEY },
    body: JSON.stringify({ q: query, num, hl: "en", gl, tbs: "qdr:w" }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  return (await res.json()).organic || [];
}

/** Post-fetch: reject results older than MAX_AGE_DAYS using Serper's date field or snippet date hints */
function isFresh(item: any): boolean {
  if (item.date) {
    try {
      const d = new Date(item.date);
      const ageMs = Date.now() - d.getTime();
      return ageMs <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    } catch { /* ignore parse errors */ }
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
    const days = parseInt(daysAgoMatch[1]);
    return days <= MAX_AGE_DAYS;
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { profileId } = body as { profileId?: string };

    const profiles = profileId
      ? await db.searchProfile.findMany({ where: { id: profileId } })
      : await db.searchProfile.findMany({});

    if (!profiles.length) return NextResponse.json({ needsSetup: true, error: "No search profiles. Run /api/seed first." });

    const results: Array<{ profile: string; found: number; saved: number }> = [];

    for (const profile of profiles) {
      const cv = getCvBySlug(profile.cvVariantId) || CV_VARIANTS[0];
      const countries = profile.countries.split(",").map((c: string) => c.trim()).filter(Boolean);
      const keywords = profile.keywords.split(",").map((k: string) => k.trim()).filter(Boolean);
      const baseKw = keywords.slice(0, 3).join(" ");

      const glMap: Record<string, string> = { USA: "us", Germany: "de", UK: "uk", "United Kingdom": "uk", Australia: "au", Canada: "ca", Qatar: "qa", UAE: "ae", Pakistan: "pk" };

      let found = 0;
      for (const country of countries.slice(0, 3)) {
        const gl = glMap[country] || "us";

        // Two complementary queries per country — freshness-focused
        const queries = [
          `${baseKw} "just posted" OR "hiring now" OR "new" ${country}`,
          `${baseKw} manager OR director OR senior jobs ${country} 2025`,
        ];

        for (const query of queries) {
          try {
            const items = await serperSearch(query, gl);
            found += items.length;

            for (const item of items) {
              if (!isFresh(item)) continue;

              const url = item.link || "";
              const title = item.title || "";
              const snippet = item.snippet || "";
              const skipPatterns = [
                /training course/i, /certification/i, /how to become/i, /salary/i,
                /youtube\.com/i, /linkedin\.com\/learning/i, /browse jobs/i, /page \d/i,
                /indeed\.com\/career/i, /glassdoor\.com\/Salary/i, /payscale\.com/i,
                /wikipedia\.org/i, /reddit\.com/i, /quora\.com/i,
              ];
              if (skipPatterns.some((p) => p.test(`${title} ${snippet} ${url}`))) continue;

              const company = title.split(/\s+[|\-–—]\s+/).pop()?.trim() || "Not specified";
              const jobTitle = title.replace(/\s*[|\-–—]\s+.*$/, "").trim();
              if (jobTitle.length < 5) continue;

              const existing = await db.jobPosting.findFirst({ where: { url } });
              if (existing) continue;

              const score = await scoreJobMatch(snippet, cv);

              await db.jobPosting.create({
                data: {
                  title: jobTitle,
                  company: company.replace(/^(LinkedIn|Indeed|Glassdoor|SEEK|Google)$/i, "Not specified"),
                  location: country, url,
                  description: snippet.slice(0, 1000),
                  source: "serper", matchScore: score.score, status: "new",
                  searchProfileId: profile.id,
                },
              });
            }
          } catch (err: any) {
            console.error(`[search-run] ${profile.name}/${country}: ${err.message}`);
          }
        }
      }

      await db.searchProfile.update({ where: { id: profile.id }, data: { lastRunAt: new Date() } });
      const saved = await db.jobPosting.count({ where: { searchProfileId: profile.id, status: "new" } });
      results.push({ profile: profile.name, found, saved });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    if (err.message?.includes("GROQ_API_KEY") || err.message?.includes("No LLM"))
      return NextResponse.json({ needsSetup: true, error: "Add GROQ_API_KEY in Environment Variables." });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}