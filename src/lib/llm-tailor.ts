/**
 * LLM Tailor Module
 * ==================
 * Calls the LLM (via zai-init.ts composite client) to:
 * 1. Analyze a job posting → extract keywords, requirements, seniority, tone
 * 2. Tailor a CV variant's summary + bullets to emphasize relevant keywords
 * 3. Generate a cover letter that addresses the specific job
 * 4. Score how well a job posting matches a CV variant
 *
 * The composite client in zai-init.ts automatically tries z.ai first,
 * then falls back to Groq if z.ai fails. This module retries JSON parse
 * failures with different model hints to maximize success.
 */

import { createZai, getLlmDiagnostics } from "./zai-init";
import { CvData } from "./cv-data";

const getZai = createZai;

// ---------------------------------------------------------------------------
// ROBUST LLM CALL WITH JSON RETRY
// ---------------------------------------------------------------------------

/**
 * Call the LLM and parse the JSON response.
 * Retries with different model hints on JSON parse failure.
 * The underlying composite client (zai-init.ts) already handles
 * z.ai → Groq fallback at the transport level.
 * Throws if ALL attempts fail to produce valid JSON.
 */
async function callLlmAndParseJson<T>(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  parseAndValidate: (raw: string) => T | null,
  label: string,
): Promise<T> {
  const zai = await getZai();

  // Log diagnostics on first call
  console.log(`[llm-tailor] ${label} starting. Diagnostics:`, JSON.stringify(getLlmDiagnostics()));

  // Models to try — start with default (composite client picks best), 
  // then hint specific Groq models on retries for better JSON quality
  const MODEL_HINTS = [
    undefined,                       // attempt 1: let composite client decide
    "llama3-70b-8192",              // attempt 2: force 70B for better JSON
    "llama-3.3-70b-versatile",      // attempt 3: try versatile 70B
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
      // Set model hint for retries (attempt 2+)
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

  // All attempts failed
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
        // Validate: must have jobTitle and keywords array
        if (!parsed.jobTitle || typeof parsed.jobTitle !== "string") return null;
        if (!Array.isArray(parsed.keywords)) return null;
        // Clean up keywords
        if (parsed.keywords) {
          parsed.keywords = [...new Set(parsed.keywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean))];
        }
        // Ensure required fields have defaults
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
// CV TAILORING
// ---------------------------------------------------------------------------
export interface TailoredCvContent {
  tailoredSummary: string;
  tailoredBullets: Record<string, string[]>;
  matchedKeywords: string[];
  missingKeywords: string[];
  tailoredSidebarSection1: { title: string; items: string[] };
  tailoredCoverLetter: string;
}

export const tailorCvForJob = async (
  cv: CvData,
  analysis: JobAnalysis
): Promise<TailoredCvContent> => {
  // Only include entries that are NOT locked
  const tailorableEntries = [...cv.experiencePage1, ...cv.experiencePage2].filter(
    (e) => !e.lockTailoring
  );
  const lockedEntries = [...cv.experiencePage1, ...cv.experiencePage2].filter(
    (e) => e.lockTailoring
  );

  const cvBullets = tailorableEntries
    .map((e) => `- ${e.title} @ ${e.company} (${e.dates}): ${e.bullets.join(" | ")}`)
    .join("\n");

  const lockedNote = lockedEntries.length
    ? `\n\nNOTE: The following entries are LOCKED — do NOT return bullets for them:\n${lockedEntries.map((e) => `- ${e.title} @ ${e.company}`).join("\n")}`
    : "";

  // Gather the current sidebar section 1 for context
  const currentSidebarSection1 = cv.sidebarPage1[0];
  const currentSidebarItems = currentSidebarSection1
    ? currentSidebarSection1.items.map((i) => (Array.isArray(i) ? i[0] : String(i))).join(", ")
    : "(none)";

  const prompt = `You are an expert executive CV writer. Tailor the candidate's CV to maximize relevance to a specific job posting. Be AGGRESSIVE in rephrasing bullets — but NEVER fabricate new experience, achievements, or skills that aren't in the original.

CANDIDATE'S CV SUMMARY (original):
${cv.summary}

CANDIDATE'S EXPERIENCE BULLETS (original — only these can be tailored):
${cvBullets}${lockedNote}

CANDIDATE'S CURRENT SIDEBAR SECTION 1 ("${currentSidebarSection1?.title || "Core Competencies"}"):
${currentSidebarItems}

TARGET JOB:
- Title: ${analysis.jobTitle}
- Company: ${analysis.company}
- Industry: ${analysis.industry}
- Seniority: ${analysis.seniority}
- Tone: ${analysis.tone}
- Top Keywords: ${analysis.keywords.join(", ")}
- Key Requirements: ${analysis.requirements.join("; ")}
- Key Responsibilities: ${analysis.responsibilities.join("; ")}

YOUR TASKS:

1. REWRITE THE SUMMARY (3-4 sentences, ~80 words): Naturally incorporate the top keywords from the job posting. Lead with the candidate's most relevant qualification for THIS role.

2. REPHRASE AND REORDER BULLETS (most important task):
   For EACH tailorable experience entry, rewrite the bullets to lead with the most relevant achievement for this job:
   a) REORDER: Put the most relevant bullet FIRST.
   b) REPHRASE: Rewrite each bullet to emphasize the aspect that aligns with the job. Use EXACT keyword phrases from the job posting naturally.
   c) KEYWORD INTEGRATION: Make sure EVERY important keyword phrase from the job posting appears somewhere in the tailored bullets where the candidate has genuine evidence.
   d) DEMOTE IRRELEVANT CONTENT: If a role has no relevant experience for this job, keep the bullets factual but brief.
   e) RETURN 4-5 BULLETS PER ENTRY. Each bullet should be 1-2 sentences (~120-180 characters).
   f) NEVER FABRICATE: Do not invent new achievements, metrics, or skills.

3. REWRITE SIDEBAR SECTION 1: Select 8-10 skills/competencies most relevant to this specific job posting and genuinely supported by the candidate's experience.

4. WRITE A TAILORED COVER LETTER (3-4 paragraphs, ~300-400 words total):
   - Paragraph 1: Express specific interest in THIS role at THIS company. Reference 1-2 specific requirements.
   - Paragraph 2: Reference 2-3 specific achievements from the candidate's experience most relevant to this role.
   - Paragraph 3: Explain why THIS company/role is appealing and how the candidate would add value.
   - Closing: Professional sign-off.
   Use \\n\\n between paragraphs. Do NOT include date, addressee, subject line, or salutation.

5. MATCHED KEYWORDS: List which keywords from the job posting the candidate has evidence for.
6. MISSING KEYWORDS: List which keywords are NOT evidenced in the CV.

Return ONLY valid JSON (no markdown fences):
{
  "tailoredSummary": "the rewritten 3-4 sentence summary",
  "tailoredBullets": {
    "${tailorableEntries[0]?.title || "Job Title"}": ["rephrased bullet 1", "rephrased bullet 2", "rephrased bullet 3", "rephrased bullet 4"]
  },
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1", "keyword2"],
  "tailoredSidebarSection1": {
    "title": "Core Competencies",
    "items": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8"]
  },
  "tailoredCoverLetter": "Paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3.\\n\\nClosing."
}`;

  const result = await callLlmAndParseJson<TailoredCvContent>(
    [
      { role: "system", content: "You are an expert executive CV writer. You NEVER fabricate experience. You are AGGRESSIVE in making bullets relevant. You return valid JSON only — no markdown fences, no commentary." },
      { role: "user", content: prompt },
    ],
    6000,
    0.5,
    (cleaned) => {
      try {
        const parsed = JSON.parse(cleaned) as TailoredCvContent;
        // Validate: must have a non-empty tailoredSummary and at least some tailoredBullets
        if (!parsed.tailoredSummary || typeof parsed.tailoredSummary !== "string" || parsed.tailoredSummary.length < 20) return null;
        if (!parsed.tailoredBullets || typeof parsed.tailoredBullets !== "object" || Object.keys(parsed.tailoredBullets).length === 0) return null;
        // Validate that at least some bullets are non-empty arrays
        let hasBullets = false;
        for (const key of Object.keys(parsed.tailoredBullets)) {
          if (Array.isArray(parsed.tailoredBullets[key]) && parsed.tailoredBullets[key].length > 0) {
            hasBullets = true;
            break;
          }
        }
        if (!hasBullets) return null;
        // Fill in defaults for optional fields
        parsed.matchedKeywords = Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [];
        parsed.missingKeywords = Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [];
        parsed.tailoredSidebarSection1 = parsed.tailoredSidebarSection1 || { title: "Core Competencies", items: [] };
        parsed.tailoredCoverLetter = parsed.tailoredCoverLetter || "";
        return parsed;
      } catch {
        return null;
      }
    },
    "cv-tailoring",
  );

  return result;
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