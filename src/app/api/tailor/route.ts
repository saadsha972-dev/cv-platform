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
    const { jobPosting, cvVariantSlug, jobTitle, company } = body as { jobPosting: string; cvVariantSlug: string; jobTitle?: string; company?: string };

    if (!jobPosting || !cvVariantSlug) {
      return NextResponse.json({ error: "jobPosting and cvVariantSlug are required" }, { status: 400 });
    }

    const baseCv = getCvBySlug(cvVariantSlug);
    if (!baseCv) {
      return NextResponse.json({ error: `Unknown CV variant: ${cvVariantSlug}` }, { status: 400 });
    }

    // --- STEP 1: Analyze job posting ---
    console.log(`[tailor] Step 1/4: Analyzing job posting for ${cvVariantSlug}...`);
    let analysis;
    let tailored;
    let usedFallback = false;

    try {
      analysis = await analyzeJobPosting(jobPosting);
      console.log(`[tailor] Step 1 done. Job: ${analysis.jobTitle} at ${analysis.company}`);
    } catch (err: any) {
      console.warn(`[tailor] Step 1 failed (LLM rate limit?), using basic extraction: ${err.message}`);
      // Fallback: extract basic info without LLM
      const firstLine = jobPosting.split("\n")[0]?.trim() || "";
      analysis = {
        jobTitle: body.jobTitle || "Unknown Role",
        company: body.company || "Not specified",
        location: "Not specified",
        keywords: [],
        requirements: [],
        responsibilities: [],
        seniority: "senior" as const,
        tone: "formal" as const,
        industry: "Unknown",
      };
      usedFallback = true;
    }

    // --- STEP 2: Tailor CV content with LLM ---
    console.log(`[tailor] Step 2/4: Tailoring CV content with LLM...`);
    try {
      tailored = await tailorCvForJob(baseCv, analysis);
      console.log(`[tailor] Step 2 done. ${Object.keys(tailored.tailoredBullets || {}).length} bullet sets`);
    } catch (err: any) {
      console.warn(`[tailor] Step 2 failed (LLM rate limit?), generating base CV without tailoring: ${err.message}`);
      // Fallback: use base CV as-is
      const currentSb1 = baseCv.sidebarPage1[0];
      tailored = {
        tailoredSummary: baseCv.summary,
        tailoredBullets: {},
        matchedKeywords: [],
        missingKeywords: [],
        tailoredSidebarSection1: {
          title: currentSb1?.title || "Core Competencies",
          items: currentSb1?.items.map((i: any) => (Array.isArray(i) ? i[0] : String(i))) || [],
        },
        tailoredCoverLetter: "",
      };
      usedFallback = true;
    }

    // Build a lookup that matches bullets by job title (handles both
    // "Title" and "Title @ Company" key formats returned by the LLM)
    const splitBullets = (bullets: string[]): string[] => {
      const result: string[] = [];
      for (const b of bullets) {
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
      if (tb[entry.title]) return splitBullets(tb[entry.title]);
      const fullKey = `${entry.title} @ ${entry.company}`;
      if (tb[fullKey]) return splitBullets(tb[fullKey]);
      for (const key of Object.keys(tb)) {
        const cleanKey = key.split(" @ ")[0].trim();
        if (cleanKey === entry.title || key.includes(entry.title) || entry.title.includes(cleanKey)) {
          return splitBullets(tb[key]);
        }
      }
      return null;
    };

    // Build a tailored CV variant: clone the base, override summary + bullets + sidebar section 1
    const tailoredCv: CvData = {
      ...baseCv,
      summary: tailored.tailoredSummary || baseCv.summary,
      experiencePage1: baseCv.experiencePage1.map((e) => {
        if (e.lockTailoring) return e;
        const newBullets = findTailoredBullets(e);
        if (newBullets && newBullets.length > 0) {
          return { ...e, bullets: newBullets.slice(0, 5) };
        }
        return e;
      }),
      experiencePage2: baseCv.experiencePage2.map((e) => {
        if (e.lockTailoring) return e;
        const newBullets = findTailoredBullets(e);
        if (newBullets && newBullets.length > 0) {
          return { ...e, bullets: newBullets.slice(0, 5) };
        }
        return e;
      }),
    };

    // Replace the first sidebar section on page 1 with the LLM-tailored version
    if (tailored.tailoredSidebarSection1 && tailored.tailoredSidebarSection1.items.length > 0) {
      const [firstSection, ...restSections] = tailoredCv.sidebarPage1;
      tailoredCv.sidebarPage1 = [
        {
          ...firstSection,
          title: tailored.tailoredSidebarSection1.title,
          items: tailored.tailoredSidebarSection1.items,
        },
        ...restSections,
      ];
    }

    // --- STEP 3: Generate PDFs ---
    console.log(`[tailor] Step 3/4: Generating PDFs with jsPDF...`);
    let result;
    try {
      result = await generateCvPdfs(tailoredCv, {
        jobTitle: analysis.jobTitle,
        company: analysis.company,
        extraKeywords: tailored.matchedKeywords,
        idPrefix: `tailor_${Date.now()}`,
        coverLetterText: tailored.tailoredCoverLetter || undefined,
      });
      console.log(`[tailor] Step 3 done. CV PDF: ${result.cvPdfPath}, Cover: ${result.coverLetterPdfPath}`);
    } catch (pdfErr: any) {
      console.error(`[tailor] PDF GENERATION FAILED:`, pdfErr.message, pdfErr.stack);
      return NextResponse.json({
        error: `PDF generation failed: ${pdfErr.message}`,
        step: "pdf_generation",
      }, { status: 500 });
    }

    // --- STEP 4: Read PDFs as base64 and return ---
    console.log(`[tailor] Step 4/4: Encoding PDFs as base64...`);
    let cvPdfBase64: string;
    let coverLetterPdfBase64: string;
    try {
      cvPdfBase64 = readPdfAsBase64(result.cvPdfPath);
      coverLetterPdfBase64 = readPdfAsBase64(result.coverLetterPdfPath);
    } catch (readErr: any) {
      console.error(`[tailor] PDF READ FAILED:`, readErr.message);
      return NextResponse.json({
        error: `PDF read failed: ${readErr.message}`,
        step: "pdf_read",
      }, { status: 500 });
    }

    // Save to database (non-blocking — don't fail the request if DB is down)
    let generatedCvId: string | undefined;
    try {
      const cvVariant = await db.cvVariant.findUnique({ where: { slug: cvVariantSlug } });
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
    } catch (dbErr: any) {
      console.error(`[tailor] DB save failed (non-fatal):`, dbErr.message);
      // Continue — the PDFs are already generated, we just couldn't save the record
    }

    console.log(`[tailor] All done. CV PDF: ${cvPdfBase64.length} chars base64, Cover: ${coverLetterPdfBase64.length} chars base64`);
    return NextResponse.json({
      success: true,
      generatedCvId,
      jobAnalysis: analysis,
      tailoredContent: tailored,
      cvPdfBase64,
      coverLetterPdfBase64,
      fallback: usedFallback,
    });
  } catch (err: any) {
    console.error("[tailor] Unhandled error:", err.message, err.stack?.split("\n").slice(0, 5));

    // Detect LLM-not-available error and give user actionable message
    const msg = err.message || "Tailoring failed";
    const isLlmError = msg.includes("No LLM available") || msg.includes("GROQ_API_KEY") || msg.includes("SDK") || msg.includes("invalid or disabled");
    const isRateLimit = msg.includes("rate-limited") || msg.includes("429");

    return NextResponse.json({
      error: isLlmError
        ? "AI tailoring is currently unavailable (API key issue). Your CV was generated using the professional base template. To enable AI tailoring, update GROQ_API_KEY in Vercel Settings → Environment Variables."
        : isRateLimit
          ? "AI is temporarily busy. Your CV has been generated using the professional base template. Try again in a few minutes for AI-tailored content."
          : msg,
      step: isLlmError ? "ai_not_configured" : isRateLimit ? "rate_limited" : "unknown",
    }, { status: 500 });
  }
}