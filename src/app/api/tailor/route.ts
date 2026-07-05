/**
 * POST /api/tailor
 * Body: { jobPosting: string, cvVariantSlug: string, jobTitle?: string, company?: string }
 * Returns: { cvPdfBase64, coverLetterPdfBase64, jobAnalysis, tailoredContent, generatedCvId }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CV_VARIANTS, getCvBySlug, CvData } from "@/lib/cv-data";
import { analyzeJobPosting, tailorCvForJob } from "@/lib/llm-tailor";
import { generateCvPdfs, readPdfAsBase64 } from "@/lib/latex-generator";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobPosting, cvVariantSlug } = body as { jobPosting: string; cvVariantSlug: string };

    if (!jobPosting || !cvVariantSlug) {
      return NextResponse.json({ error: "jobPosting and cvVariantSlug are required" }, { status: 400 });
    }

    const baseCv = getCvBySlug(cvVariantSlug);
    if (!baseCv) {
      return NextResponse.json({ error: `Unknown CV variant: ${cvVariantSlug}` }, { status: 400 });
    }

    console.log(`[tailor] Analyzing job posting for ${cvVariantSlug}...`);
    const analysis = await analyzeJobPosting(jobPosting);

    console.log(`[tailor] Tailoring CV content with LLM...`);
    const tailored = await tailorCvForJob(baseCv, analysis);

    // Debug: log what the LLM returned
    console.log(`[tailor] LLM returned ${Object.keys(tailored.tailoredBullets || {}).length} tailored bullet sets:`,
      Object.keys(tailored.tailoredBullets || {}));
    console.log(`[tailor] LLM returned ${tailored.sidebarSoftSkills?.length || 0} sidebar soft skills:`,
      tailored.sidebarSoftSkills);

    // Build a lookup that matches bullets by job title (handles both
    // "Title" and "Title @ Company" key formats returned by the LLM)
    // Also splits any bullet that contains " | " into separate bullets
    // (the LLM sometimes merges bullets with " | " mimicking the prompt format)
    const splitBullets = (bullets: string[]): string[] => {
      const result: string[] = [];
      for (const b of bullets) {
        // If the bullet contains " | ", split it into separate bullets
        if (b.includes(" | ")) {
          for (const part of b.split(" | ")) {
            const trimmed = part.trim();
            if (trimmed) result.push(trimmed);
          }
        } else if (b.trim()) {
          result.push(b.trim());
        }
      }
      return result;
    };

    const findTailoredBullets = (entry: { title: string; company: string }): string[] | null => {
      const tb = tailored.tailoredBullets || {};
      // Try exact title match
      if (tb[entry.title]) return splitBullets(tb[entry.title]);
      // Try "Title @ Company" format
      const fullKey = `${entry.title} @ ${entry.company}`;
      if (tb[fullKey]) return splitBullets(tb[fullKey]);
      // Try partial match (title contains the key, or key contains the title)
      for (const key of Object.keys(tb)) {
        const cleanKey = key.split(" @ ")[0].trim();
        if (cleanKey === entry.title || key.includes(entry.title) || entry.title.includes(cleanKey)) {
          return splitBullets(tb[key]);
        }
      }
      return null;
    };

    // Build a tailored CV variant: clone the base, override summary + bullets
    // IMPORTANT: respect lockTailoring flag — locked entries keep original bullets
    const tailoredCv: CvData = {
      ...baseCv,
      summary: tailored.tailoredSummary || baseCv.summary,
      experiencePage1: baseCv.experiencePage1.map((e) => {
        if (e.lockTailoring) {
          console.log(`[tailor] 🔒 LOCKED — keeping original bullets for: ${e.title}`);
          return e;
        }
        const newBullets = findTailoredBullets(e);
        if (newBullets && newBullets.length > 0) {
          // Limit to 2 bullets per entry to fit 2-page layout
          const limited = newBullets.slice(0, 2);
          console.log(`[tailor] ✓ Applied ${limited.length} tailored bullets to: ${e.title}`);
          return { ...e, bullets: limited };
        }
        console.log(`[tailor] ✗ No tailored bullets found for: ${e.title}`);
        return e;
      }),
      experiencePage2: baseCv.experiencePage2.map((e) => {
        if (e.lockTailoring) {
          console.log(`[tailor] 🔒 LOCKED — keeping original bullets for: ${e.title}`);
          return e;
        }
        const newBullets = findTailoredBullets(e);
        if (newBullets && newBullets.length > 0) {
          const limited = newBullets.slice(0, 2);
          console.log(`[tailor] ✓ Applied ${limited.length} tailored bullets to: ${e.title}`);
          return { ...e, bullets: limited };
        }
        console.log(`[tailor] ✗ No tailored bullets found for: ${e.title}`);
        return e;
      }),
    };

    // Add a "KEY COMPETENCIES" sidebar section with soft skills from the job posting
    // Limit to 6 items to avoid pushing the CV beyond 2 pages
    if (tailored.sidebarSoftSkills && tailored.sidebarSoftSkills.length > 0) {
      tailoredCv.sidebarPage2 = [
        ...tailoredCv.sidebarPage2,
        {
          title: "KEY COMPETENCIES",
          items: tailored.sidebarSoftSkills.slice(0, 6),
        },
      ];
      console.log(`[tailor] ✓ Added KEY COMPETENCIES section with ${Math.min(tailored.sidebarSoftSkills.length, 6)} soft skills`);
    }

    console.log(`[tailor] Generating PDFs with Tectonic...`);
    const result = await generateCvPdfs(tailoredCv, {
      jobTitle: analysis.jobTitle,
      company: analysis.company,
      extraKeywords: tailored.matchedKeywords,
      idPrefix: `tailor_${Date.now()}`,
    });

    // Save to database
    const cvVariant = await db.cvVariant.findUnique({ where: { slug: cvVariantSlug } });
    let generatedCvId: string | undefined;
    if (cvVariant) {
      const record = await db.generatedCv.create({
        data: {
          cvVariantId: cvVariant.id,
          jobTitle: analysis.jobTitle,
          company: analysis.company,
          latexContent: result.cvTexContent,
          pdfPath: result.cvPdfPath,
          coverLetterText: result.coverLetterTexContent,
          coverLetterPdfPath: result.coverLetterPdfPath,
          keywords: JSON.stringify({
            matched: tailored.matchedKeywords,
            missing: tailored.missingKeywords,
            jobKeywords: analysis.keywords,
          }),
        },
      });
      generatedCvId = record.id;
    }

    console.log(`[tailor] Done. Returning PDFs.`);
    return NextResponse.json({
      success: true,
      generatedCvId,
      jobAnalysis: analysis,
      tailoredContent: tailored,
      cvPdfBase64: readPdfAsBase64(result.cvPdfPath),
      coverLetterPdfBase64: readPdfAsBase64(result.coverLetterPdfPath),
    });
  } catch (err: any) {
    console.error("[tailor] Error:", err);
    return NextResponse.json({ error: err.message || "Tailoring failed" }, { status: 500 });
  }
}
