/**
 * LLM Tailor Module
 * ==================
 * Uses z-ai-web-dev-sdk to:
 * 1. Analyze a job posting → extract keywords, requirements, seniority, tone
 * 2. Tailor a CV variant's summary + bullets to emphasize relevant keywords
 * 3. Generate a cover letter that addresses the specific job
 * 4. Score how well a job posting matches a CV variant
 */

import { createZai } from "./zai-init";
import { CvData } from "./cv-data";

const getZai = createZai;

// ---------------------------------------------------------------------------
// JOB POSTING ANALYSIS
// ---------------------------------------------------------------------------
export interface JobAnalysis {
  jobTitle: string;
  company: string;
  location: string;
  keywords: string[]; // Top 15 technical/soft skills from the posting
  requirements: string[];
  responsibilities: string[];
  seniority: string; // entry / mid / senior / executive
  tone: string; // formal / casual / technical / commercial
  industry: string;
}

export const analyzeJobPosting = async (postingText: string): Promise<JobAnalysis> => {
  const prompt = `Analyze the following job posting thoroughly and extract ALL structured information. Be EXHAUSTIVE with keywords — extract every single technical skill, tool, methodology, certification, qualification, soft skill, industry term, and domain expertise mentioned anywhere in the posting. Return ONLY valid JSON (no markdown fences, no commentary).

JOB POSTING:
"""
${postingText.slice(0, 8000)}
"""

Return JSON in this exact schema:
{
  "jobTitle": "string — exact job title from the posting",
  "company": "string — company name, or 'Not specified' if unknown",
  "location": "string — city, country or 'Remote' or 'Not specified'",
  "keywords": ["array of up to 30 most important keywords extracted from the posting — include EVERY technical skill, tool, platform, methodology, certification, software, framework, standard, regulation, and domain expertise mentioned. Also include key soft skills and competencies. Lowercase, no duplicates. Be EXHAUSTIVE — scan every sentence for skills and terms."],
  "requirements": ["array of ALL key requirements mentioned, 8-12 items, concise phrases — include qualifications, experience years, certifications, technical skills, tools, methodologies"],
  "responsibilities": ["array of ALL core responsibilities, 8-12 items, concise phrases"],
  "seniority": "entry | mid | senior | executive",
  "tone": "formal | casual | technical | commercial",
  "industry": "string — primary industry (e.g., 'Oil & Gas', 'Telecom', 'Construction', 'Retail', 'Consulting')"
}`;

  const response = await (await getZai()).chat.completions.create({
    messages: [
      { role: "system", content: "You are an expert recruitment analyst. Extract structured data from job postings. Always return valid JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 2500,
  });

  const content = response.choices?.[0]?.message?.content?.trim() || "{}";
  // Strip any markdown fences if present
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    const parsed = JSON.parse(cleaned) as JobAnalysis;
    // Ensure keywords array is deduplicated and cleaned
    if (parsed.keywords) {
      parsed.keywords = [...new Set(parsed.keywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean))];
    }
    return parsed;
  } catch {
    return {
      jobTitle: "Unknown Role",
      company: "Unknown",
      location: "Not specified",
      keywords: [],
      requirements: [],
      responsibilities: [],
      seniority: "senior",
      tone: "formal",
      industry: "Unknown",
    };
  }
};

// ---------------------------------------------------------------------------
// CV TAILORING
// ---------------------------------------------------------------------------
export interface TailoredCvContent {
  tailoredSummary: string;
  tailoredBullets: Record<string, string[]>; // keyed by job title from timeline
  matchedKeywords: string[]; // keywords from posting that match the CV
  missingKeywords: string[]; // keywords from posting NOT in the CV
  tailoredSidebarSection1: { title: string; items: string[] };
  tailoredCoverLetter: string;
}

export const tailorCvForJob = async (
  cv: CvData,
  analysis: JobAnalysis
): Promise<TailoredCvContent> => {
  // Only include entries that are NOT locked (lockTailoring !== true)
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
    ? `\n\nNOTE: The following entries are LOCKED and must NOT be tailored — keep their original bullets unchanged:\n${lockedEntries.map((e) => `- ${e.title} @ ${e.company}`).join("\n")}`
    : "";

  // Gather the current sidebar section 1 for context
  const currentSidebarSection1 = cv.sidebarPage1[0];
  const currentSidebarItems = currentSidebarSection1
    ? currentSidebarSection1.items.map((i) => (Array.isArray(i) ? i[0] : String(i))).join(", ")
    : "(none)";

  const prompt = `You are an expert executive CV writer. Tailor the candidate's CV to maximize relevance to a specific job posting. You must be AGGRESSIVE in reordering and rephrasing bullets — but NEVER fabricate new experience, achievements, or skills that aren't in the original.

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

1. REWRITE THE SUMMARY (3-4 sentences, ~80 words): Naturally incorporate the top keywords from the job posting. Lead with the candidate's most relevant qualification for THIS role. Be specific — mention the exact ISO standards, audit types, or skills the job demands. Use EXACT keyword phrases from the job posting where possible.

2. REPHRASE AND REORDER BULLETS (most important task):
   For EACH tailorable experience entry, rewrite the bullets to lead with the most relevant achievement for this job. Be aggressive:
   
   a) REORDER: Put the most relevant bullet FIRST.
   
   b) REPHRASE: Rewrite each bullet to emphasize the aspect that aligns with the job. Use EXACT keyword phrases from the job posting's requirements and responsibilities sections naturally. Weave the posting's own terminology into the candidate's genuine experience.
   
   c) KEYWORD INTEGRATION (CRITICAL): Extract ALL 15-20 most important exact keyword phrases from the job posting's requirements and responsibilities sections. These include technical terms, methodologies, tools, certifications, industry jargon, action verbs, and competency phrases. Make sure EVERY single one of these keywords appears somewhere in the tailored bullets where the candidate has genuine evidence. Weave the posting's own terminology naturally into the candidate's experience. Prioritize phrases that the posting uses repeatedly, emphasizes, or lists as requirements.
   
   d) DEMOTE IRRELEVANT CONTENT: If a role has no relevant experience for this job, keep the bullets factual but brief.
   
   e) RETURN 4-5 BULLETS PER ENTRY: Each entry must have at least 4 rephrased bullets (up to 5 maximum). Use ALL the original bullets as source material — rephrase, split, or combine them. Each bullet should be 1-2 sentences (~120-180 characters). Do NOT leave any entry with fewer than 4 bullets.
   
   f) NEVER FABRICATE: Do not invent new achievements, metrics, or skills. Only rephrase, reorder, and emphasize what's already there.

3. REWRITE SIDEBAR SECTION 1: Completely rewrite the first sidebar section (currently titled "${currentSidebarSection1?.title || "Core Competencies"}"). Select 8-10 skills/competencies that are:
   - The MOST relevant to this specific job posting (drawn from the posting's requirements and responsibilities)
   - Genuinely supported by the candidate's experience (do NOT list skills the candidate has no evidence for)
   - Written as concise, professional terms (e.g., "Internal Audits", "ISO 9001", "Risk Assessment", "Stakeholder Management")
   - Ordered by relevance to the job posting (most relevant first)
   Choose a title that best fits the job context (e.g., "Core Competencies", "Key Skills", "Technical Competencies", "Professional Expertise").

4. WRITE A TAILORED COVER LETTER (3-4 paragraphs, ~300-400 words total):
   - Paragraph 1: Express specific interest in THIS role at THIS company. Mention the job title and company name. Show you understand what the role involves by referencing 1-2 specific requirements from the posting.
   - Paragraph 2: Reference 2-3 specific, concrete achievements from the candidate's experience that are MOST relevant to this particular role. Be specific — mention actual results, scope, or impact. Do NOT simply copy the CV summary. Write original prose that connects the candidate's track record to the job's needs.
   - Paragraph 3: Explain why THIS company/role is appealing and how the candidate's approach would add value. Reference specific aspects of the job posting (methods, tools, scale, industry context).
   - Closing: Professional sign-off. The letter should fill roughly 75-80% of a standard letter page.
   Write the cover letter as plain text with paragraph breaks (use \n\n between paragraphs). Do NOT include the date, addressee block, subject line, salutation, or signature — those are added by the template.

5. IDENTIFY MATCHED KEYWORDS: List which keywords from the job posting the candidate ALREADY has strong evidence for in the CV (after tailoring).

6. IDENTIFY MISSING KEYWORDS: List which keywords from the job posting are NOT evidenced in the CV — be honest.

Return ONLY valid JSON in this schema:
{
  "tailoredSummary": "the rewritten 3-4 sentence summary",
  "tailoredBullets": {
    "<exact job title from the timeline>": ["rephrased bullet 1 (most relevant first)", "rephrased bullet 2"]
  },
  "matchedKeywords": ["keyword1", "keyword2", ...],
  "missingKeywords": ["keyword1", "keyword2", ...],
  "tailoredSidebarSection1": {
    "title": "Core Competencies",
    "items": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8"]
  },
  "tailoredCoverLetter": "Paragraph 1 text.\n\nParagraph 2 text referencing specific achievements.\n\nParagraph 3 text specific to the role and company.\n\nClosing paragraph."
}`;

  const response = await (await getZai()).chat.completions.create({
    messages: [
      { role: "system", content: "You are an expert executive CV writer and cover letter specialist. You NEVER fabricate experience — you only rephrase, reorder, and emphasize existing content. You are AGGRESSIVE in making bullets relevant to the target job. You write compelling, specific cover letters that reference concrete achievements. You return valid JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 6000,
  });

  const content = response.choices?.[0]?.message?.content?.trim() || "{}";
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    const parsed = JSON.parse(cleaned) as TailoredCvContent;
    return {
      tailoredSummary: parsed.tailoredSummary || cv.summary,
      tailoredBullets: parsed.tailoredBullets || {},
      matchedKeywords: parsed.matchedKeywords || [],
      missingKeywords: parsed.missingKeywords || [],
      tailoredSidebarSection1: parsed.tailoredSidebarSection1 || { title: currentSidebarSection1?.title || "Core Competencies", items: currentSidebarSection1?.items.map((i) => (Array.isArray(i) ? i[0] : String(i))) || [] },
      tailoredCoverLetter: parsed.tailoredCoverLetter || "",
    };
  } catch {
    return {
      tailoredSummary: cv.summary,
      tailoredBullets: {},
      matchedKeywords: analysis.keywords.slice(0, 5),
      missingKeywords: [],
      tailoredSidebarSection1: { title: currentSidebarSection1?.title || "Core Competencies", items: currentSidebarSection1?.items.map((i) => (Array.isArray(i) ? i[0] : String(i))) || [] },
      tailoredCoverLetter: "",
    };
  }
};

// ---------------------------------------------------------------------------
// JOB MATCH SCORING
// ---------------------------------------------------------------------------
export interface JobMatchResult {
  matchScore: number; // 0-100
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
  "rationale": "<2-3 sentence explanation of why this CV fits or doesn't fit>",
  "topKeywords": ["<5 most overlapping skills/keywords>"]
}`;

  const response = await (await getZai()).chat.completions.create({
    messages: [
      { role: "system", content: "You are a recruitment matching AI. Be honest and conservative — only score 80+ if the CV is a strong fit. Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  const content = response.choices?.[0]?.message?.content?.trim() || "{}";
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned) as JobMatchResult;
  } catch {
    return { matchScore: 50, rationale: "Unable to parse match analysis.", topKeywords: [] };
  }
};
