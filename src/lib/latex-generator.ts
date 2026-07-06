/**
 * PDF CV Generator
 * =================
 * Generates tailored CV and cover letter PDFs using jsPDF (pure JS).
 * Layout matches the original QHSE Manager CV sample provided by the candidate.
 *
 * Key layout measurements (from sample PDF):
 *   A4 = 210 x 297 mm
 *   Left margin: 13mm, Right margin: 12mm
 *   Sidebar: 57mm wide, left-aligned at 13mm
 *   Gap: 5mm
 *   Main column: 123mm wide, starts at 75mm
 *   Header: name at y=40, title at y=48, contact at y=55, rule at y=60
 *   Content starts: y=66 (both sidebar and main)
 */

import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { CANDIDATE, type CvData, type SidebarSection, type ExperienceEntry, type EarlierCareerEntry } from "./cv-data";

// ---------------------------------------------------------------------------
// PATHS
// ---------------------------------------------------------------------------
const isVercel = process.env.VERCEL === "1";
const PDF_OUT_DIR = isVercel ? "/tmp/cv_pdfs" : join(homedir(), ".cv-platform", "pdfs");
if (!existsSync(PDF_OUT_DIR)) mkdirSync(PDF_OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// LAYOUT CONSTANTS (all in mm, A4 = 210 x 297)
// Matched to the original CV sample PDF
// ---------------------------------------------------------------------------
const PW = 210;
const PH = 297;
const ML = 13;           // left margin (sample: ~13mm)
const MR = 12;           // right margin (sample: ~12mm)
const CW = PW - ML - MR; // content width = 185

const SB_W = 57;         // sidebar width (sample: ~57mm)
const GAP = 5;           // gap between sidebar and main (sample: ~5mm)
const MAIN_W = CW - SB_W - GAP; // main column width = 123

const SB_X = ML;                  // sidebar left edge = 13
const SB_R = ML + SB_W;           // sidebar right edge = 70
const MAIN_X = ML + SB_W + GAP;   // main column left edge = 75
const MAIN_R = ML + CW;           // right edge of content = 198

// Vertical layout
const HDR_NAME_Y = 40;    // name baseline
const HDR_TITLE_Y = 48;   // title baseline
const HDR_CONTACT_Y = 55; // contact baseline
const HDR_RULE_Y = 60;    // horizontal rule
const CONTENT_TOP = 66;   // where sidebar + main content starts (page 1)

// Colors (matched to sample)
const CLR = {
  accent: [27, 54, 93] as [number, number, number],     // #1b365d
  sechdr: [45, 55, 72] as [number, number, number],     // #2d3748
  bronze: [140, 120, 83] as [number, number, number],   // #8c7853
  dark: [51, 51, 51] as [number, number, number],       // #333333
  mid: [96, 103, 116] as [number, number, number],      // #606774
  light: [152, 156, 165] as [number, number, number],   // #989ca5
  rule: [203, 213, 224] as [number, number, number],    // #cbd5e0
  bg: [248, 249, 250] as [number, number, number],      // #f8f9fa
};

// ---------------------------------------------------------------------------
// LOW-LEVEL HELPERS
// ---------------------------------------------------------------------------
function setColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function hLine(doc: jsPDF, y: number, x1: number, x2: number, color?: [number, number, number], w?: number) {
  doc.setDrawColor(color ? color[0] : CLR.bronze[0], color ? color[1] : CLR.bronze[1], color ? color[2] : CLR.bronze[2]);
  doc.setLineWidth(w || 0.5);
  doc.line(x1, y, x2, y);
}

// ---------------------------------------------------------------------------
// SECTION HEADERS
// ---------------------------------------------------------------------------
function sidebarSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(8.5);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), SB_X, y);
  const ruleY = y + 1.5;
  hLine(doc, ruleY, SB_X, SB_R, CLR.rule, 0.3);
  return ruleY + 3; // 3mm gap after rule (sample: ~4mm)
}

function mainSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(9.5);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), MAIN_X, y);
  const ruleY = y + 1.5;
  hLine(doc, ruleY, MAIN_X, MAIN_R, CLR.bronze, 0.4);
  return ruleY + 3.5; // 3.5mm gap after rule
}

// ---------------------------------------------------------------------------
// SIDEBAR SECTION BUILDER
// ---------------------------------------------------------------------------
function buildSidebarSection(doc: jsPDF, section: SidebarSection, startY: number): number {
  let y = sidebarSectionHeader(doc, section.title, startY);

  for (const item of section.items) {
    if (Array.isArray(item) && typeof item[1] === "number") {
      // Skill proficiency: [skillName, rating]
      const [skill, rating] = item as [string, number];
      doc.setFontSize(7.5);
      setColor(doc, CLR.sechdr);
      doc.setFont("helvetica", "normal");
      doc.text(skill, SB_X, y, { maxWidth: SB_W - 18 });
      // Draw dots
      const dotX = SB_R - 14;
      for (let i = 0; i < 5; i++) {
        setColor(doc, i < rating ? CLR.bronze : CLR.rule);
        doc.setFontSize(9);
        doc.text(i < rating ? "\u2022" : "\u25CB", dotX + i * 2.8, y);
      }
      y += 4.5; // 4.5mm per skill bar (sample: ~4.8mm)
    } else if (Array.isArray(item) && typeof item[1] === "string") {
      // [title, subtitle]
      const [main, sub] = item as [string, string];
      doc.setFontSize(7.5);
      setColor(doc, CLR.sechdr);
      doc.setFont("helvetica", "bold");
      doc.text(main, SB_X, y, { maxWidth: SB_W - 4 });
      if (sub) {
        doc.setFontSize(6.5);
        setColor(doc, CLR.mid);
        doc.setFont("helvetica", "normal");
        doc.text(sub, SB_X + 2, y + 3.5, { maxWidth: SB_W - 6 });
        y += 3.5;
      }
      y += 4;
    } else {
      // Plain string bullet
      doc.setFontSize(7.5);
      setColor(doc, CLR.sechdr);
      doc.setFont("helvetica", "normal");
      const text = `\u2022  ${String(item)}`;
      doc.text(text, SB_X, y, { maxWidth: SB_W - 4 });
      y += 4.2; // 4.2mm per bullet (sample: ~4.5mm)
    }
  }
  return y + 4; // 4mm gap between sections (sample: ~4mm)
}

// ---------------------------------------------------------------------------
// EXPERIENCE ENTRY BUILDER
// ---------------------------------------------------------------------------
function buildExperienceEntry(
  doc: jsPDF, e: ExperienceEntry, y: number,
  x: number, xR: number, w: number
): number {
  // Title + dates on same line
  doc.setFontSize(8.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "bold");
  doc.text(e.title, x, y, { maxWidth: w - 30 });
  doc.setFontSize(7);
  setColor(doc, CLR.mid);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, xR, y, { align: "right" });
  y += 4;

  // Company + location
  doc.setFontSize(7.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "italic");
  doc.text(e.company, x, y, { maxWidth: w - 30 });
  doc.setFontSize(7);
  doc.text(e.location, xR, y, { align: "right" });
  y += 4.5;

  // Bullets
  doc.setFontSize(7.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "normal");
  for (const b of e.bullets) {
    const bulletLines = doc.splitTextToSize(`\u2022  ${b}`, w - 4);
    for (const line of bulletLines) {
      doc.text(line, x + 2, y);
      y += 3.5; // 3.5mm per line (sample: ~3.5-4mm)
    }
    y += 0.8; // small gap between bullets
  }
  return y;
}

// ---------------------------------------------------------------------------
// CV PAGE 1
// ---------------------------------------------------------------------------
function buildCvPage1(doc: jsPDF, cv: CvData): void {
  // === HEADER (centered, matching sample) ===
  doc.setFontSize(20);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, HDR_NAME_Y, { align: "center" });

  doc.setFontSize(10);
  setColor(doc, CLR.dark);
  doc.setFont("helvetica", "normal");
  doc.text(cv.roleTitle, PW / 2, HDR_TITLE_Y, { align: "center" });

  doc.setFontSize(7.5);
  setColor(doc, CLR.mid);
  doc.text(CANDIDATE.contact, PW / 2, HDR_CONTACT_Y, { align: "center" });

  // Full-width bronze rule below header
  hLine(doc, HDR_RULE_Y, ML, ML + CW, CLR.bronze, 0.6);

  // === SIDEBAR BACKGROUND ===
  doc.setFillColor(CLR.bg[0], CLR.bg[1], CLR.bg[2]);
  doc.rect(SB_X - 2, CONTENT_TOP - 2, SB_W + 4, PH - CONTENT_TOP - 8, "F");

  // === SIDEBAR CONTENT (page 1) ===
  let sbY = CONTENT_TOP + 2;
  for (const section of cv.sidebarPage1) {
    sbY = buildSidebarSection(doc, section, sbY);
  }

  // === MAIN CONTENT (page 1) ===
  let mainY = CONTENT_TOP + 2;

  // Professional Summary
  mainY = mainSectionHeader(doc, "Professional Summary", mainY);
  doc.setFontSize(8);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(cv.summary, MAIN_W);
  for (const line of summaryLines) {
    doc.text(line, MAIN_X, mainY);
    mainY += 3.8; // 3.8mm per summary line (sample: ~4mm)
  }
  mainY += 3;

  // Career Timeline (compact — from sample)
  mainY = mainSectionHeader(doc, "Career Timeline", mainY);
  const years = ["2008", "2014", "2015", "2017", "2018", "2020", "2024"];
  const companies = ["Etisalat/PTCL", "Independent", "Guardian ICS", "DQS-Pak", "Mace", "Power Intl.", "Michael Kors"];
  const colW = MAIN_W / 7;
  doc.setFontSize(7.5);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  for (let i = 0; i < 7; i++) {
    doc.text(years[i], MAIN_X + colW * i + colW / 2, mainY, { align: "center" });
  }
  mainY += 3;
  hLine(doc, mainY, MAIN_X, MAIN_R, CLR.bronze, 0.3);
  mainY += 3.5;
  doc.setFontSize(6.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 7; i++) {
    doc.text(companies[i], MAIN_X + colW * i + colW / 2, mainY, { align: "center" });
  }
  mainY += 6;

  // Professional Experience (page 1 entries)
  mainY = mainSectionHeader(doc, "Professional Experience", mainY);
  for (const entry of cv.experiencePage1) {
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W);
    mainY += 2.5;
  }
}

// ---------------------------------------------------------------------------
// CV PAGE 2
// ---------------------------------------------------------------------------
function buildCvPage2(doc: jsPDF, cv: CvData): void {
  // === PAGE 2 HEADER (matching sample) ===
  // Sample page 2 header: "Page 2 | QHSE Manager | marketbrain@gmail.com | +92 332 4862219"
  doc.setFontSize(7.5);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(`Page 2  |  ${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`, PW / 2, 10, { align: "center" });

  hLine(doc, 14, ML, ML + CW, CLR.bronze, 0.4);

  const p2Top = 20;

  // Sidebar background
  doc.setFillColor(CLR.bg[0], CLR.bg[1], CLR.bg[2]);
  doc.rect(SB_X - 2, p2Top - 2, SB_W + 4, PH - p2Top - 8, "F");

  // Sidebar content (page 2)
  let sbY = p2Top + 2;
  for (const section of cv.sidebarPage2) {
    sbY = buildSidebarSection(doc, section, sbY);
  }

  // Main content (page 2): experience entries continued
  let mainY = p2Top + 2;
  for (const entry of cv.experiencePage2) {
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W);
    mainY += 2.5;
  }

  // Earlier Career Summary
  if (cv.earlierCareer.length > 0) {
    mainY = mainSectionHeader(doc, "Earlier Career Summary", mainY);
    for (const e of cv.earlierCareer) {
      doc.setFontSize(8);
      setColor(doc, CLR.sechdr);
      doc.setFont("helvetica", "bold");
      doc.text(`\u2022  ${e.company}, `, MAIN_X, mainY, { maxWidth: MAIN_W });
      const headerW = doc.getTextWidth(`\u2022  ${e.company}, `);
      doc.setFont("helvetica", "italic");
      doc.text(e.place, MAIN_X + headerW, mainY);
      doc.setFontSize(7);
      setColor(doc, CLR.mid);
      doc.setFont("helvetica", "normal");
      const placeW = doc.getTextWidth(e.place);
      doc.text(`  |  ${e.dates}`, MAIN_X + headerW + placeW, mainY);
      mainY += 4.5;
      doc.setFontSize(7.5);
      setColor(doc, CLR.mid);
      doc.text(e.oneLiner, MAIN_X + 3, mainY, { maxWidth: MAIN_W - 6 });
      mainY += 5;
    }
  }
}

// ---------------------------------------------------------------------------
// BUILD FULL CV PDF
// ---------------------------------------------------------------------------
function buildCvPdf(cv: CvData): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });

  buildCvPage1(doc, cv);
  doc.addPage();
  buildCvPage2(doc, cv);

  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// BUILD COVER LETTER PDF
// Professional, concise, tailored to the specific job
// ---------------------------------------------------------------------------
function buildCoverLetterPdf(
  cv: CvData,
  jobTitle: string,
  company?: string,
  extraKeywords?: string[]
): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });

  const left = 25;
  const right = PW - 25;
  const textW = right - left;

  const companyName = (company && company !== "Unknown" && company !== "Not specified") ? company : "";

  // === HEADER (matching CV style) ===
  doc.setFontSize(18);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", PW / 2, 28, { align: "center" });

  doc.setFontSize(8.5);
  setColor(doc, CLR.mid);
  doc.setFont("helvetica", "normal");
  doc.text("Lahore, Pakistan  |  +92 332 4862219  |  marketbrain@gmail.com  |  Open to International Relocation", PW / 2, 35, { align: "center" });

  hLine(doc, 40, left, right, CLR.accent, 0.8);

  let y = 52;

  // Date
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });
  doc.setFontSize(10);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "normal");
  doc.text(date, left, y);
  y += 8;

  // Addressee
  if (companyName) {
    doc.text("Hiring Manager", left, y);
    y += 5;
    doc.text(companyName, left, y);
    y += 12;
  } else {
    doc.text("Hiring Manager", left, y);
    y += 12;
  }

  // Subject
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const subject = companyName
    ? `Re: Application for ${jobTitle} at ${companyName}`
    : `Re: Application for ${jobTitle}`;
  doc.text(subject, left, y);
  y += 8;

  // Salutation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Dear Hiring Manager,", left, y);
  y += 8;

  // --- PARAGRAPH 1: Introduction (concise) ---
  const para1 = `I am writing to express my interest in the ${jobTitle} position${companyName ? ` at ${companyName}` : ""}. With over 20 years of international experience across Germany, the GCC, the UK, and Pakistan in ${cv.roleShort} roles, I bring a proven track record of delivering measurable compliance, safety, and quality outcomes for complex multi-site operations.`;

  const lines1 = doc.splitTextToSize(para1, textW);
  for (const line of lines1) { doc.text(line, left, y); y += 4.8; }
  y += 4;

  // --- PARAGRAPH 2: Core value proposition ---
  const summaryFirst = cv.summary.split(". ").slice(0, 2).join(". ").trim();
  const para2 = `As a ${cv.roleShort}, my core strengths include ${summaryFirst}. I have successfully led cross-functional teams, managed regulatory compliance across multiple jurisdictions, and delivered zero-incident safety records on high-value projects. My certifications in ISO standards and NEBOSH further underpin my technical credibility.`;

  const lines2 = doc.splitTextToSize(para2, textW);
  for (const line of lines2) { doc.text(line, left, y); y += 4.8; }
  y += 4;

  // --- PARAGRAPH 3: Role-specific alignment + keywords ---
  const kw = extraKeywords && extraKeywords.length > 0 ? extraKeywords.slice(0, 4).join(", ") : "";
  const para3 = kw
    ? `I am particularly drawn to this role because of the strong alignment between my expertise in ${kw} and the position requirements${companyName ? ` at ${companyName}` : ""}. I am available for immediate start, open to international relocation, and would welcome the opportunity to contribute to your team's continued success.`
    : `I am particularly drawn to this role because of the strong alignment between my career achievements and the position requirements${companyName ? ` at ${companyName}` : ""}. I am available for immediate start, open to international relocation, and would welcome the opportunity to contribute to your team's continued success.`;

  const lines3 = doc.splitTextToSize(para3, textW);
  for (const line of lines3) { doc.text(line, left, y); y += 4.8; }
  y += 4;

  // --- CLOSING ---
  doc.text("I would welcome the opportunity to discuss how my experience can add value to your organisation. I am available for an interview at your earliest convenience.", left, y);
  y += 14;

  doc.text("Yours sincerely,", left, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Muhammad Ali Bhatti", left, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.mid);
  doc.text("+92 332 4862219  |  marketbrain@gmail.com", left, y);

  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------
export interface GenerateCvResult {
  cvPdfPath: string;
  coverLetterPdfPath: string;
  cvTexContent: string;
  coverLetterTexContent: string;
}

export const generateCvPdfs = async (
  cv: CvData,
  options?: { jobTitle?: string; company?: string; extraKeywords?: string[]; idPrefix?: string }
): Promise<GenerateCvResult> => {
  const id = options?.idPrefix || `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cvPdfPath = join(PDF_OUT_DIR, `${id}_cv.pdf`);
  const clPdfPath = join(PDF_OUT_DIR, `${id}_cover.pdf`);

  console.log("[pdf] Generating CV PDF...");
  const cvBuffer = buildCvPdf(cv);
  writeFileSync(cvPdfPath, cvBuffer);
  console.log(`[pdf] CV PDF saved: ${cvPdfPath} (${cvBuffer.length} bytes)`);

  console.log("[pdf] Generating cover letter PDF...");
  const clBuffer = buildCoverLetterPdf(
    cv,
    options?.jobTitle || cv.roleTitle,
    options?.company,
    options?.extraKeywords
  );
  writeFileSync(clPdfPath, clBuffer);
  console.log(`[pdf] Cover letter PDF saved: ${clPdfPath} (${clBuffer.length} bytes)`);

  const cvDoc = { variant: cv.roleShort, timestamp: new Date().toISOString() };
  const clDoc = { jobTitle: options?.jobTitle, company: options?.company, variant: cv.roleShort, timestamp: new Date().toISOString() };

  return {
    cvPdfPath,
    coverLetterPdfPath: clPdfPath,
    cvTexContent: JSON.stringify(cvDoc, null, 2),
    coverLetterTexContent: JSON.stringify(clDoc, null, 2),
  };
};

export const readPdfAsBase64 = (pdfPath: string): string => {
  const buf = readFileSync(pdfPath);
  return buf.toString("base64");
};