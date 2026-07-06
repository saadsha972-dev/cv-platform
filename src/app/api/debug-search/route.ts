/**
 * GET /api/debug-search
 * Returns raw Serper results + filter analysis for debugging.
 * Temporary — remove once search is confirmed working.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const SERPER_KEY = "89280a05e2a42179789766db50570d66f5d52b1e";

export async function GET() {
  try {
    const testQueries = [
      { q: '"HSE Manager" jobs Qatar hiring', gl: "qa" },
      { q: '"QMS Lead Auditor" jobs UAE hiring', gl: "ae" },
      { q: 'site:linkedin.com/jobs "HSE Manager" Qatar hiring', gl: "qa" },
    ];

    const results: any[] = [];

    for (const { q, gl } of testQueries) {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": SERPER_KEY,
        },
        body: JSON.stringify({ q, num: 10, hl: "en", gl }),
      });

      const data = await res.json();
      const organic = data.organic || [];

      const parsed = organic.map((item: any) => {
        const t = (item.title || "").toLowerCase();
        const u = (item.link || "").toLowerCase();
        const d = (item.snippet || "").toLowerCase();
        const check = `${t} ${u} ${d}`;

        const failReasons: string[] = [];
        if (/training course|certification training|lead auditor course|iso 9001 training|course schedule/i.test(check)) failReasons.push("training");
        if (/\.pdf$/i.test(u) || /facebook\.com|slideserve\.com|learnerspoint\.org/i.test(check)) failReasons.push("spam");
        if (/salary.*guide|how to become|what does a|job description template/i.test(check)) failReasons.push("info-page");
        if (/^\d+\+?\s/i.test(item.title || "")) failReasons.push("starts-with-number");
        if (/jobs in all|browse jobs|search jobs/i.test(t)) failReasons.push("category-page");
        if (u.includes("linkedin.com/jobs/") && !u.includes("/jobs/view/") && !t.includes("hiring")) failReasons.push("linkedin-category");

        return {
          title: item.title?.slice(0, 80),
          url: item.link?.slice(0, 80),
          pass: failReasons.length === 0,
          failReasons: failReasons.length > 0 ? failReasons : undefined,
        };
      });

      results.push({
        query: q,
        rawCount: organic.length,
        passCount: parsed.filter((p: any) => p.pass).length,
        items: parsed,
      });

      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}