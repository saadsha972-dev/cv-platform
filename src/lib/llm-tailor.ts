/**
 * LLM Tailor Module v2
 * =====================
 * Calls the LLM (via zai-init.ts composite client) to:
 * 1. Analyze a job posting → extract keywords, requirements, seniority, tone
 * 2. Tailor a CV variant's summary + bullets to emphasize relevant keywords
 *    (TWO-PASS: Pass 1 = summary + sidebar + cover letter, Pass 2 = detailed bullet rewrites)
 * 3. Generate a cover letter that addresses the specific job
 * 4. Score how well a job posting matches a CV variant
 *
 * v2 CHANGES:
 * - Split tailoring into two focused LLM calls for higher quality
 * - Pass 1: Summary rewrite + sidebar skills + cover letter + keyword classification
 * - Pass 2: Dedicated bullet-by-bullet rewrite with explicit entry IDs (index-based)
 * - Robust index-based bullet matching (eliminates key name mismatch bugs)
 * - Post-LLM keyword injection check: if bullets lack job keywords, inject them
 * - Stronger, more directive prompts
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
// JOB POSTING ANALYSIS (unchanged — this works well)
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
    ? currentSidebarSection1.items.map((i) => (Array.isArray(i) ? i[0] : String(i))).join(", ")
    : "(none)";

  // Gather all experience for context (summarized — no need for full bullets in pass 1)
  const experienceSummary = [...cv.experiencePage1, ...cv.experiencePage2]
    .map((e) => `• ${e.title} @ ${e.company} (${e.location}, ${e.dates}): ${e.bullets[0] || "(no details)"}`)
    .join("\n");

  const prompt = `You are an expert executive CV writer tailoring a CV for a specific job posting. This is PASS 1 of 2. In this pass, you ONLY rewrite the summary, sidebar skills, cover letter, and classify keywords. DO NOT rewrite experience bullets (that is Pass 2).

RULES: NEVER fabricate experience, achievements, or skills not present in the candidate's background. Only highlight and reframe what EXISTS.

CANDIDATE'S CURRENT SUMMARY:
${cv.summary}

CANDIDATE'S EXPERIENCE (summary — first bullet of each role):
${experienceSummary}

CANDIDATE'S CURRENT SIDEBAR ("${currentSidebarSection1?.title || "Core Competencies"}"):
${currentSidebarItems}

TARGET JOB:
- Title: ${analysis.jobTitle}
- Company: ${analysis.company}
- Industry: ${analysis.industry}
- Seniority: ${analysis.seniority}
- Tone: ${analysis.tone}
- All Keywords: ${analysis.keywords.join(", ")}
- Key Requirements: ${analysis.requirements.join("; ")}
- Key Responsibilities: ${analysis.responsibilities.join("; ")}

YOUR TASKS:

1. TAILORED SUMMARY: Rewrite in 3-4 sentences (~80-100 words). The FIRST sentence must directly address THIS role's core requirement (e.g., "Results-driven [role] with X years of experience in [key domain from job posting]"). Naturally weave in 5-8 of the most important keywords from the job posting that the candidate genuinely possesses. Do NOT just copy the original summary — restructure it to lead with what THIS job cares about most.

2. KEYWORD CLASSIFICATION:
   - MATCHED: Keywords from the job posting that the candidate has EVIDENCE for (from their experience, certifications, or skills).
   - MISSING: Keywords the candidate has NO evidence for.
   Be honest. If a keyword is partially matched, include it in matched but only if there's genuine evidence.

3. SIDEBAR SKILLS: Rewrite the sidebar section to show 8-10 skills MOST RELEVANT to this specific job. Only include skills genuinely evidenced in the candidate's background. Prioritize skills that appear in the job posting.

4. COVER LETTER (3-4 paragraphs, ~300-400 words, use \\n\\n between paragraphs):
   - Para 1: Express interest in THIS role at THIS company. Reference 1-2 SPECIFIC requirements from the posting and how the candidate meets them.
   - Para 2: Reference 2-3 SPECIFIC achievements from the candidate's experience that are directly relevant. Use concrete details.
   - Para 3: Why THIS company/role appeals and how the candidate adds value.
   - No date, no addressee, no subject line, no "Dear Hiring Manager," — just the body paragraphs.

Return ONLY valid JSON:
{
  "tailoredSummary": "3-4 sentence tailored summary...",
  "matchedKeywords": ["keyword1", "keyword2", "..."],
  "missingKeywords": ["keyword1", "..."],
  "tailoredSidebarSection1": {
    "title": "Core Competencies",
    "items": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8"]
  },
  "tailoredCoverLetter": "Paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3."
}`;

  return callLlmAndParseJson<Pass1Result>(
    [
      { role: "system", content: "You are an expert executive CV writer. You NEVER fabricate experience. You produce compelling, keyword-rich summaries. Return valid JSON only — no markdown fences, no commentary." },
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
  // Build entry-by-entry data with EXPLICIT INDEX KEYS to avoid name mismatch
  const tailorableEntries = [...cv.experiencePage1, ...cv.experiencePage2].filter(
    (e) => !e.lockTailoring,
  );

  if (tailorableEntries.length === 0) {
    return { tailoredBullets: {} };
  }

  // Create the experience data block with indexed keys
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

  const prompt = `You are an expert CV bullet rewriter. This is PASS 2 of 2 — your ONLY job is to rewrite experience bullets to maximize relevance to a job posting. The summary, sidebar, and cover letter have already been handled.

CRITICAL RULES:
1. NEVER fabricate achievements, metrics, or skills that aren't in the original bullets.
2. You MUST use the EXACT entry keys provided (numbers: "0", "1", "2", etc.) — do NOT use job titles as keys.
3. REORDER each entry's bullets so the most relevant one for THIS job is FIRST.
4. REPHRASE each bullet to naturally incorporate keywords from the job posting where the candidate has genuine evidence.
5. If a bullet has NO relevance to the job, keep it factual but make it brief and neutral.
6. Return exactly 4-5 bullets per entry. Each bullet: 1-2 sentences, ~120-180 characters.
7. Every rewritten bullet must retain the CORE FACT of the original — just reframe the emphasis.

TARGET JOB KEYWORDS TO INTEGRATE (where genuine evidence exists):
${analysis.keywords.join(", ")}

KEY RESPONSIBILITIES (use these to judge relevance when reordering):
${analysis.responsibilities.join("; ")}

KEY REQUIREMENTS:
${analysis.requirements.join("; ")}

CANDIDATE'S EXPERIENCE ENTRIES (rewrite bullets for each):
${entriesBlock}

ENTRY KEY MAP (use these EXACT keys in your response):
{
    ${entryKeysJson}
}

Return ONLY valid JSON with the EXACT entry index keys. Do NOT include entries that have no changes (but still include entries where you at least reordered):
{
  "tailoredBullets": {
    "0": ["rewritten bullet 1 (most relevant first)", "rewritten bullet 2", "rewritten bullet 3", "rewritten bullet 4"],
    "1": ["rewritten bullet 1", "rewritten bullet 2", "rewritten bullet 3", "rewritten bullet 4"]
  }
}`;

  return callLlmAndParseJson<Pass2Result>(
    [
      { role: "system", content: "You are a CV bullet rewriter. You are AGGRESSIVE in reframing bullets to be relevant. You NEVER fabricate. You use EXACT numeric keys provided. Return valid JSON only — no markdown fences." },
      { role: "user", content: prompt },
    ],
    4000,
    0.4,
    (cleaned) => {
      try {
        const parsed = JSON.parse(cleaned) as Pass2Result;
        if (!parsed.tailoredBullets || typeof parsed.tailoredBullets !== "object") return null;
        // Validate at least one entry has non-empty bullets
        let hasBullets = false;
        for (const key of Object.keys(parsed.tailoredBullets)) {
          if (Array.isArray(parsed.tailoredBullets[key]) && parsed.tailoredBullets[key].length > 0) {
            hasBullets = true;
            break;
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
// POST-PROCESSING: Keyword injection check
// ---------------------------------------------------------------------------

/**
 * After the LLM rewrites bullets, check whether important matched keywords
 * actually appear in the tailored bullets. If a matched keyword is missing
 * from ALL bullets, inject it into the most relevant bullet naturally.
 */
function injectMissingKeywords(
  tailoredBullets: Record<string, string[]>,
  matchedKeywords: string[],
  originalBullets: Record<string, string[]>,
): void {
  const allTailoredText = Object.values(tailoredBullets).flat().join(" ").toLowerCase();

  for (const kw of matchedKeywords) {
    const kwLower = kw.toLowerCase();
    // Skip very generic keywords that aren't specific enough to inject
    if (kwLower.length < 4) continue;
    // Check if keyword already appears naturally
    if (allTailoredText.includes(kwLower)) continue;

    // Find the best bullet to inject into — prefer one that already shares
    // some context with the keyword
    let bestKey = "";
    let bestScore = -1;

    for (const [key, bullets] of Object.entries(tailoredBullets)) {
      const origBullets = originalBullets[key] || [];
      const origText = origBullets.join(" ").toLowerCase();
      // Simple word overlap scoring
      const kwWords = kwLower.split(/\s+/);
      const overlapCount = kwWords.filter(w => w.length > 3 && origText.includes(w)).length;
      if (overlapCount > bestScore) {
        bestScore = overlapCount;
        bestKey = key;
      }
    }

    if (bestKey && tailoredBullets[bestKey]?.length > 0) {
      // Inject into the FIRST bullet of the best entry (most prominent position)
      const firstBullet = tailoredBullets[bestKey][0];
      // Try to append the keyword contextually
      if (!firstBullet.endsWith(".")) {
        tailoredBullets[bestKey][0] = `${firstBullet}, with expertise in ${kw}`;
      } else {
        tailoredBullets[bestKey][0] = `${firstBullet.slice(0, -1)}, leveraging ${kw} capabilities`;
      }
      console.log(`[llm-tailor] keyword-inject: "${kw}" → entry "${bestKey}" first bullet`);
    }
  }
}

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

  // --- POST-PROCESS: Map index-based keys to "Title @ Company" keys ---
  // (for backward compatibility with route.ts findTailoredBullets)
  const tailorableEntries = [...cv.experiencePage1, ...cv.experiencePage2].filter(
    (e) => !e.lockTailoring,
  );

  const mappedBullets: Record<string, string[]> = {};
  // Keep both index keys AND title-based keys for robust matching
  for (const [idxStr, bullets] of Object.entries(pass2.tailoredBullets)) {
    const idx = parseInt(idxStr);
    if (isNaN(idx) || idx < 0 || idx >= tailorableEntries.length) {
      console.warn(`[llm-tailor] Pass 2 returned unknown index key: "${idxStr}"`);
      continue;
    }
    const entry = tailorableEntries[idx];
    const titleKey = entry.title;
    const fullKey = `${entry.title} @ ${entry.company}`;

    // Store under BOTH keys for maximum matching compatibility
    mappedBullets[idxStr] = bullets;
    mappedBullets[titleKey] = bullets;
    mappedBullets[fullKey] = bullets;
  }

  // --- POST-PROCESS: Keyword injection check ---
  // Build original bullets map by index for injection check
  const originalBulletsByIndex: Record<string, string[]> = {};
  tailorableEntries.forEach((e, idx) => {
    originalBulletsByIndex[String(idx)] = e.bullets;
  });

  if (pass1.matchedKeywords.length > 0 && Object.keys(mappedBullets).length > 0) {
    injectMissingKeywords(mappedBullets, pass1.matchedKeywords, originalBulletsByIndex);
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
// JOB MATCH SCORING (unchanged)
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