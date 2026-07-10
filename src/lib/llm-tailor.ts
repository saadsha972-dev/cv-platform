/**
 * LLM Tailor Module v3
 * =====================
 * Calls the LLM (via zai-init.ts composite client) to:
 * 1. Analyze a job posting → extract keywords, requirements, seniority, tone
 * 2. Tailor a CV variant's summary + bullets to emphasize relevant keywords
 *    (TWO-PASS: Pass 1 = summary + sidebar + cover letter, Pass 2 = detailed bullet rewrites)
 * 3. Generate a cover letter that addresses the specific job
 * 4. Score how well a job posting matches a CV variant
 *
 * v3 CHANGES (from v2):
 * - REMOVED injectMissingKeywords — it was appending "with expertise in X" to
 *   the same bullet multiple times, creating run-on scribbles. The LLM is
 *   responsible for keyword integration; no post-processing injection.
 * - Pass 2 prompt now EXPLICITLY FORBIDS tacking keyword phrases onto bullet
 *   endings. Each bullet must be a self-contained, natural sentence.
 * - Pass 1 sidebar prompt now MUST select from the CV's existing skill pool
 *   (provided as a whitelist), preventing fabricated skills like "Cisco Systems"
 *   from appearing in a QMS CV.
 * - Added bullet length validation in Pass 2 parser (reject bullets >250 chars).
 */

import { createZai, getLlmDiagnostics } from "./zai-init";
import { CvData } from "./cv-data";

const getZai = createZai;

// ---------------------------------------------------------------------------
// ROBUST LLM CALL WITH JSON RETRY
// ---------------------------------------------------------------------------

async function callLlmAndParseJson<T>(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  parseAndValidate: (raw: string) => T | null,
  label: string,
): Promise<T> {
  const zai = await getZai();

  console.log(`[llm-tailor] ${label} starting. Diagnostics:`, JSON.stringify(getLlmDiagnostics()));

  const MODEL_HINTS = [
    undefined,
    "llama3-70b-8192",
    "llama-3.3-70b-versatile",
  ];
  const maxAttempts = MODEL_HINTS.length;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const body: any = {
        messages,
        temperature,
        max_tokens: maxTokens,
      };
      if (MODEL_HINTS[attempt - 1]) {
        body.model = MODEL_HINTS[attempt - 1];
      }
      console.log(`[llm-tailor] ${label}: attempt ${attempt}/${maxAttempts}, model_hint=${body.model || "auto"}`);

      const response = await zai.chat.completions.create(body);
      const content = response.choices?.[0]?.message?.content?.trim() || "";

      if (!content) {
        lastError = "LLM returned empty content";
        console.warn(`[llm-tailor] ${label}: attempt ${attempt} → empty content`);
        continue;
      }

      console.log(`[llm-tailor] ${label}: attempt ${attempt} → ${content.length} chars received`);
      console.log(`[llm-tailor] ${label}: raw response (first 500 chars): ${content.slice(0, 500)}`);

      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const result = parseAndValidate(cleaned);
      if (result) {
        console.log(`[llm-tailor] ${label}: PARSED OK on attempt ${attempt}/${maxAttempts}`);
        return result;
      }
      lastError = `Invalid JSON. First 300 chars: ${cleaned.slice(0, 300)}`;
      console.warn(`[llm-tailor] ${label}: attempt ${attempt} → invalid JSON, retrying...`);
    } catch (err: any) {
      lastError = err.message || "Unknown error";
      console.error(`[llm-tailor] ${label}: attempt ${attempt} → ERROR: ${lastError.slice(0, 200)}`);
    }
  }

  throw new Error(
    `AI ${label} failed after ${maxAttempts} attempts. ` +
    `Diagnostics: z.ai=${!!process.env.ZAI_TOKEN}, groq=${!!process.env.GROQ_API_KEY}. ` +
    `Last error: ${lastError.slice(0, 300)}`
  );
}

// ---------------------------------------------------------------------------
// JOB POSTING ANALYSIS
// ---------------------------------------------------------------------------
export interface JobAnalysis {
  jobTitle: string;
  company: string;
  location: string;
  keywords: string[];
  requirements: string[];
  responsibilities: string[];
  seniority: string;
  tone: string;
  industry: string;
}

export const analyzeJobPosting = async (postingText: string): Promise<JobAnalysis> => {
  const prompt = `Analyze the following job posting thoroughly and extract ALL structured information. Be EXHAUSTIVE with keywords. Return ONLY valid JSON (no markdown fences, no commentary).

JOB POSTING:
"""
${postingText.slice(0, 8000)}
"""

Return JSON in this exact schema:
{
  "jobTitle": "string — exact job title from the posting",
  "company": "string — company name, or 'Not specified' if unknown",
  "location": "string — city, country or 'Remote' or 'Not specified'",
  "keywords": ["array of up to 30 most important keywords — include EVERY technical skill, tool, platform, methodology, certification, software, framework, standard, regulation, and domain expertise. Also include key soft skills. Lowercase, no duplicates. Be EXHAUSTIVE."],
  "requirements": ["array of ALL key requirements, 8-12 items, concise phrases"],
  "responsibilities": ["array of ALL core responsibilities, 8-12 items, concise phrases"],
  "seniority": "entry | mid | senior | executive",
  "tone": "formal | casual | technical | commercial",
  "industry": "string — primary industry (e.g. Oil & Gas, Telecom, IT, Healthcare)"
}`;

  const result = await callLlmAndParseJson<JobAnalysis>(
    [
      { role: "system", content: "You are an expert recruitment analyst. Extract structured data from job postings. Always return valid JSON only. Do NOT use markdown fences." },
      { role: "user", content: prompt },
    ],
    2500,
    0.3,
    (cleaned) => {
      try {
        const parsed = JSON.parse(cleaned) as JobAnalysis;
        if (!parsed.jobTitle || typeof parsed.jobTitle !== "string") return null;
        if (!Array.isArray(parsed.keywords) || parsed.keywords.length === 0) return null;
        if (parsed.keywords) {
          parsed.keywords = [...new Set(parsed.keywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean))];
        }
        parsed.company = parsed.company || "Not specified";
        parsed.location = parsed.location || "Not specified";
        parsed.requirements = Array.isArray(parsed.requirements) ? parsed.requirements : [];
        parsed.responsibilities = Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [];
        parsed.seniority = parsed.seniority || "senior";
        parsed.tone = parsed.tone || "formal";
        parsed.industry = parsed.industry || "Unknown";
        return parsed;
      } catch {
        return null;
      }
    },
    "job-analysis",
  );

  return result;
};

// ---------------------------------------------------------------------------
// CV TAILORING — TWO-PASS ARCHITECTURE
// ---------------------------------------------------------------------------

export interface TailoredCvContent {
  tailoredSummary: string;
  tailoredBullets: Record<string, string[]>;
  matchedKeywords: string[];
  missingKeywords: string[];
  tailoredSidebarSection1: { title: string; items: string[] };
  tailoredCoverLetter: string;
}

// --- PASS 1: Summary + Sidebar + Cover Letter + Keyword Classification ---
interface Pass1Result {
  tailoredSummary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  tailoredSidebarSection1: { title: string; items: string[] };
  tailoredCoverLetter: string;
}

const runPass1 = async (cv: CvData, analysis: JobAnalysis): Promise<Pass1Result> => {
  const currentSidebarSection1 = cv.sidebarPage1[0];
  const currentSidebarItems = currentSidebarSection1
    ? currentSidebarSection1.items.map((i) => (Array.isArray(i) ? i[0] : String(i)))
    : [];

  // Gather ALL existing skills from the CV's sidebars for the whitelist
  const allCvSkills = [
    ...cv.sidebarPage1,
    ...cv.sidebarPage2,
  ].flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : String(i))));

  // Gather all experience for context (first bullet of each role)
  const experienceSummary = [...cv.experiencePage1, ...cv.experiencePage2]
    .map((e) => `- ${e.title} @ ${e.company}: ${e.bullets[0] || "(no details)"}`)
    .join("\n");

  const prompt = `You are an expert executive CV writer. This is PASS 1 of 2. You ONLY rewrite the summary, sidebar, cover letter, and classify keywords. DO NOT rewrite experience bullets.

RULES: NEVER fabricate skills not in the candidate's existing skill pool. NEVER invent achievements.

CANDIDATE'S CURRENT SUMMARY:
${cv.summary}

CANDIDATE'S EXPERIENCE (first bullet per role):
${experienceSummary}

CANDIDATE'S EXISTING SKILL POOL (you MUST select from this list for sidebar):
${allCvSkills.join(", ")}

CURRENT SIDEBAR ("${currentSidebarSection1?.title || "Core Competencies"}"):
${currentSidebarItems.join(", ")}

TARGET JOB:
- Title: ${analysis.jobTitle}
- Company: ${analysis.company}
- Industry: ${analysis.industry}
- Seniority: ${analysis.seniority}
- Tone: ${analysis.tone}
- Keywords: ${analysis.keywords.join(", ")}
- Requirements: ${analysis.requirements.join("; ")}
- Responsibilities: ${analysis.responsibilities.join("; ")}

YOUR TASKS:

1. TAILORED SUMMARY (3-4 sentences, 80-100 words):
   - First sentence: lead with the candidate's most relevant qualification for THIS exact role
   - Weave in 5-8 keywords from the job posting that the candidate genuinely possesses
   - Restructure around what THIS job values most — do NOT just rephrase the original

2. KEYWORD CLASSIFICATION:
   - MATCHED: keywords from the job posting the candidate has EVIDENCE for
   - MISSING: keywords the candidate has NO evidence for
   Be honest and conservative.

3. SIDEBAR SKILLS (8-10 items):
   - You MUST ONLY use skills from the CANDIDATE'S EXISTING SKILL POOL listed above
   - Select the 8-10 MOST RELEVANT to this specific job posting
   - Reorder them so the most job-relevant ones come first
   - DO NOT invent new skills. DO NOT add skills like "Cisco Systems" unless they appear in the skill pool above.

4. COVER LETTER (3-4 paragraphs, 300-400 words, use \\n\\n between paragraphs):
   - Para 1: Interest in THIS role at THIS company. Reference 1-2 specific requirements.
   - Para 2: 2-3 specific achievements from the candidate's experience most relevant to this role.
   - Para 3: Why this company/role appeals and how the candidate adds value.
   - No date, no addressee, no subject line, no salutation — just body paragraphs.

Return ONLY valid JSON:
{
  "tailoredSummary": "...",
  "matchedKeywords": ["kw1", "kw2"],
  "missingKeywords": ["kw1"],
  "tailoredSidebarSection1": {
    "title": "Core Competencies",
    "items": ["Skill A", "Skill B", "Skill C", "Skill D", "Skill E", "Skill F", "Skill G", "Skill H"]
  },
  "tailoredCoverLetter": "Para 1.\\n\\nPara 2.\\n\\nPara 3."
}`;

  return callLlmAndParseJson<Pass1Result>(
    [
      { role: "system", content: "You are an expert executive CV writer. You NEVER fabricate skills or experience. You ONLY use skills from the candidate's existing pool. Return valid JSON only — no markdown fences." },
      { role: "user", content: prompt },
    ],
    3000,
    0.5,
    (cleaned) => {
      try {
        const parsed = JSON.parse(cleaned) as Pass1Result;
        if (!parsed.tailoredSummary || parsed.tailoredSummary.length < 30) return null;
        parsed.matchedKeywords = Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [];
        parsed.missingKeywords = Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [];
        parsed.tailoredSidebarSection1 = parsed.tailoredSidebarSection1 || { title: "Core Competencies", items: [] };
        parsed.tailoredCoverLetter = parsed.tailoredCoverLetter || "";
        return parsed;
      } catch {
        return null;
      }
    },
    "cv-tailoring-pass1",
  );
};

// --- PASS 2: Dedicated Bullet Rewrites ---
interface Pass2Result {
  tailoredBullets: Record<string, string[]>;
}

const runPass2 = async (
  cv: CvData,
  analysis: JobAnalysis,
  pass1: Pass1Result,
): Promise<Pass2Result> => {
  const tailorableEntries = [...cv.experiencePage1, ...cv.experiencePage2].filter(
    (e) => !e.lockTailoring,
  );

  if (tailorableEntries.length === 0) {
    return { tailoredBullets: {} };
  }

  const entriesBlock = tailorableEntries.map((e, idx) => {
    const bulletsText = e.bullets.map((b, bIdx) => `    [${bIdx}] ${b}`).join("\n");
    return `[ENTRY ${idx}]
  TITLE: ${e.title}
  COMPANY: ${e.company}
  LOCATION: ${e.location}
  DATES: ${e.dates}
  BULLETS:
${bulletsText}`;
  }).join("\n\n");

  const entryKeysJson = tailorableEntries.map((e, idx) => `"${idx}": "${e.title} @ ${e.company}"`).join(",\n    ");

  const prompt = `You are an expert CV bullet rewriter. PASS 2 of 2 — rewrite experience bullets ONLY.

ABSOLUTE RULES (violating any = failure):
1. NEVER fabricate achievements, metrics, or skills not in the original bullets.
2. Use EXACT numeric keys ("0", "1", "2") — never job titles as keys.
3. Each bullet MUST be a single, self-contained, natural sentence that ends with a period.
4. MAX 200 characters per bullet. If you can't fit it, split into two bullets or shorten.
5. Do NOT tack keyword phrases onto the end of bullets (FORBIDDEN: "..., with expertise in X", "..., leveraging Y capabilities", "..., with a focus on Z"). Instead, REWRITE the bullet to incorporate the keyword naturally into the main clause.
6. REORDER bullets: most relevant to the target job FIRST.
7. Keep 4-5 bullets per entry. Each must retain the CORE FACT of the original.
8. If a bullet has NO relevance, keep it factual and brief — do NOT force keywords into it.

GOOD EXAMPLE:
Original: "Governed multi-site retail inventory control using SAP ERP, achieving 100% stock accuracy."
Rewrite: "Directed multi-region inventory operations across 15+ retail locations, achieving 100% stock accuracy through SAP ERP-driven controls."

BAD EXAMPLE (DO NOT DO THIS):
Original: "Governed multi-site retail inventory control using SAP ERP."
Rewrite: "Governed multi-site retail inventory control using SAP ERP, with expertise in distributor management, leveraging channel management capabilities, with a focus on stakeholder management."

TARGET JOB CONTEXT:
- Title: ${analysis.jobTitle}
- Company: ${analysis.company}
- Industry: ${analysis.industry}
- Keywords: ${analysis.keywords.join(", ")}
- Responsibilities: ${analysis.responsibilities.join("; ")}
- Requirements: ${analysis.requirements.join("; ")}

CANDIDATE'S EXPERIENCE:
${entriesBlock}

KEY MAP (use EXACTLY these keys):
{
    ${entryKeysJson}
}

Return ONLY valid JSON:
{
  "tailoredBullets": {
    "0": ["bullet1.", "bullet2.", "bullet3.", "bullet4."],
    "1": ["bullet1.", "bullet2.", "bullet3.", "bullet4."]
  }
}`;

  return callLlmAndParseJson<Pass2Result>(
    [
      { role: "system", content: "You are a CV bullet rewriter. You NEVER fabricate. You NEVER tack keyword phrases onto bullet endings. Each bullet is a single natural sentence under 200 chars. Use EXACT numeric keys. Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    4500,
    0.4,
    (cleaned) => {
      try {
        const parsed = JSON.parse(cleaned) as Pass2Result;
        if (!parsed.tailoredBullets || typeof parsed.tailoredBullets !== "object") return null;
        let hasBullets = false;
        for (const key of Object.keys(parsed.tailoredBullets)) {
          if (Array.isArray(parsed.tailoredBullets[key]) && parsed.tailoredBullets[key].length > 0) {
            hasBullets = true;
            // Validate bullet lengths — reject any bullet over 250 chars
            parsed.tailoredBullets[key] = parsed.tailoredBullets[key]
              .filter((b: string) => b.trim().length > 0 && b.trim().length <= 250);
            if (parsed.tailoredBullets[key].length === 0) delete parsed.tailoredBullets[key];
          }
        }
        if (!hasBullets) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    "cv-tailoring-pass2",
  );
};

// ---------------------------------------------------------------------------
// MAIN TAILOR FUNCTION (orchestrates both passes)
// ---------------------------------------------------------------------------

export const tailorCvForJob = async (
  cv: CvData,
  analysis: JobAnalysis
): Promise<TailoredCvContent> => {
  // --- PASS 1: Summary + Sidebar + Cover Letter + Keyword Classification ---
  console.log(`[llm-tailor] Starting Pass 1: Summary + Sidebar + Cover Letter...`);
  const pass1 = await runPass1(cv, analysis);
  console.log(`[llm-tailor] Pass 1 done. Matched: ${pass1.matchedKeywords.length}, Missing: ${pass1.missingKeywords.length}, Summary: ${pass1.tailoredSummary.length} chars`);

  // Validate sidebar items — only keep items that exist in the CV's original skill pool
  const allCvSkills = [
    ...cv.sidebarPage1,
    ...cv.sidebarPage2,
  ].flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : String(i)))).map(s => s.toLowerCase());

  if (pass1.tailoredSidebarSection1?.items?.length > 0) {
    const validatedItems = pass1.tailoredSidebarSection1.items.filter(item => {
      const itemLower = item.toLowerCase().trim();
      // Check if this skill exists in the CV's pool (fuzzy: check if the first 4+ chars match)
      return allCvSkills.some(cvSkill => {
        const cvLower = cvSkill.toLowerCase();
        return cvLower === itemLower ||
          cvLower.includes(itemLower) ||
          itemLower.includes(cvLower) ||
          (itemLower.length >= 4 && cvLower.includes(itemLower.slice(0, Math.min(itemLower.length, 8))));
      });
    });
    // If filtering removed too many items, fall back to original sidebar
    if (validatedItems.length >= 4) {
      pass1.tailoredSidebarSection1.items = validatedItems;
    } else {
      console.warn(`[llm-tailor] Sidebar validation: only ${validatedItems.length} items matched CV pool, keeping original sidebar`);
      const originalSection = cv.sidebarPage1[0];
      pass1.tailoredSidebarSection1 = {
        title: originalSection?.title || "Core Competencies",
        items: originalSection?.items.map((i) => Array.isArray(i) ? i[0] : String(i)) || [],
      };
    }
  }

  // --- PASS 2: Dedicated Bullet Rewrites ---
  console.log(`[llm-tailor] Starting Pass 2: Bullet rewrites...`);
  let pass2: Pass2Result;
  try {
    pass2 = await runPass2(cv, analysis, pass1);
    console.log(`[llm-tailor] Pass 2 done. ${Object.keys(pass2.tailoredBullets).length} entries rewritten`);
  } catch (err: any) {
    console.warn(`[llm-tailor] Pass 2 failed, falling back to original bullets: ${err.message}`);
    pass2 = { tailoredBullets: {} };
  }

  // --- Map index-based keys to "Title @ Company" keys ---
  const tailorableEntries = [...cv.experiencePage1, ...cv.experiencePage2].filter(
    (e) => !e.lockTailoring,
  );

  const mappedBullets: Record<string, string[]> = {};
  for (const [idxStr, bullets] of Object.entries(pass2.tailoredBullets)) {
    const idx = parseInt(idxStr);
    if (isNaN(idx) || idx < 0 || idx >= tailorableEntries.length) {
      console.warn(`[llm-tailor] Pass 2 returned unknown index key: "${idxStr}"`);
      continue;
    }
    const entry = tailorableEntries[idx];
    const titleKey = entry.title;
    const fullKey = `${entry.title} @ ${entry.company}`;
    mappedBullets[idxStr] = bullets;
    mappedBullets[titleKey] = bullets;
    mappedBullets[fullKey] = bullets;
  }

  console.log(`[llm-tailor] Tailoring complete. Mapped bullet keys: ${Object.keys(mappedBullets).filter(k => !/^\d+$/.test(k)).join(", ")}`);

  return {
    tailoredSummary: pass1.tailoredSummary,
    tailoredBullets: mappedBullets,
    matchedKeywords: pass1.matchedKeywords,
    missingKeywords: pass1.missingKeywords,
    tailoredSidebarSection1: pass1.tailoredSidebarSection1,
    tailoredCoverLetter: pass1.tailoredCoverLetter,
  };
};

// ---------------------------------------------------------------------------
// JOB MATCH SCORING
// ---------------------------------------------------------------------------
export interface JobMatchResult {
  matchScore: number;
  rationale: string;
  topKeywords: string[];
}

export const scoreJobMatch = async (
  cv: CvData,
  jobTitle: string,
  jobDescription: string,
  jobKeywords: string[]
): Promise<JobMatchResult> => {
  const cvSkills = [
    ...cv.sidebarPage1.flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : i))),
    ...cv.sidebarPage2.flatMap((s) => s.items.map((i) => (Array.isArray(i) ? i[0] : i))),
  ].join(", ");

  const prompt = `Score how well this candidate's CV matches a job posting. Return ONLY valid JSON.

CANDIDATE PROFILE:
- Role Focus: ${cv.roleTitle}
- Summary: ${cv.summary}
- Skills: ${cvSkills}

JOB:
- Title: ${jobTitle}
- Keywords: ${jobKeywords.join(", ")}
- Description (truncated): ${jobDescription.slice(0, 2000)}

Return JSON:
{
  "matchScore": <0-100 integer>,
  "rationale": "<2-3 sentence explanation>",
  "topKeywords": ["<5 most overlapping skills/keywords>"]
}`;

  try {
    const result = await callLlmAndParseJson<JobMatchResult>(
      [
        { role: "system", content: "You are a recruitment matching AI. Be honest and conservative. Return valid JSON only." },
        { role: "user", content: prompt },
      ],
      500,
      0.2,
      (cleaned) => {
        try {
          const parsed = JSON.parse(cleaned) as JobMatchResult;
          if (typeof parsed.matchScore !== "number") return null;
          return parsed;
        } catch {
          return null;
        }
      },
      "match-scoring",
    );
    return result;
  } catch {
    return { matchScore: 50, rationale: "Unable to parse match analysis.", topKeywords: [] };
  }
};