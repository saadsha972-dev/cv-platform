/**
 * PDF CV Generator
 * =================
 * Generates tailored CV and cover letter PDFs using jsPDF (pure JS).
 * No external binaries needed — works on Vercel's Alpine runtime.
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
// ---------------------------------------------------------------------------
const PW = 210;  // page width
const PH = 297;  // page height
const ML = 10;   // left margin
const MR = 10;   // right margin
const CW = PW - ML - MR; // content width = 190

const SB_W = 58;     // sidebar width
const GAP = 5;       // gap between sidebar and main
const MAIN_W = CW - SB_W - GAP; // main column width = 127

const SB_X = ML;          // sidebar left edge = 10
const MAIN_X = ML + SB_W + GAP; // main column left edge = 73
const MAIN_R = ML + CW;   // right edge of content = 200

// Colors
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

function setDraw(doc: jsPDF, rgb: [number, number, number], width: number) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(width);
}

function hLine(doc: jsPDF, y: number, x1: number, x2: number, color?: [number, number, number], w?: number) {
  setDraw(doc, color || CLR.bronze, w || 0.5);
  doc.line(x1, y, x2, y);
}

function checkPage(doc: jsPDF, y: number, needed: number, footerH: number = 10): number {
  if (y + needed > PH - 15) {
    doc.addPage();
    // Page footer
    doc.setFontSize(7);
    setColor(doc, CLR.light);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${CANDIDATE.name}  |  Page ${doc.getNumberOfPages()}`,
      PW / 2, PH - 8, { align: "center" }
    );
    return 18;
  }
  return y;
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
  hLine(doc, ruleY, SB_X, SB_X + SB_W, CLR.rule, 0.3);
  return ruleY + 2.5;
}

function mainSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(9.5);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), MAIN_X, y);
  const ruleY = y + 1.5;
  hLine(doc, ruleY, MAIN_X, MAIN_R, CLR.bronze, 0.4);
  return ruleY + 3;
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
      doc.text(skill, SB_X, y, { maxWidth: SB_W - 16 });
      // Draw dots
      const dotX = SB_X + SB_W - 14;
      for (let i = 0; i < 5; i++) {
        setColor(doc, i < rating ? CLR.bronze : CLR.rule);
        doc.setFontSize(9);
        doc.text(i < rating ? "\u2022" : "\u25CB", dotX + i * 2.8, y);
      }
      y += 4;
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
        doc.text(sub, SB_X + 2, y + 3, { maxWidth: SB_W - 6 });
        y += 3;
      }
      y += 3.5;
    } else {
      // Plain string bullet
      doc.setFontSize(7.5);
      setColor(doc, CLR.sechdr);
      doc.setFont("helvetica", "normal");
      const text = `\u2022  ${String(item)}`;
      doc.text(text, SB_X, y, { maxWidth: SB_W - 4 });
      y += 3.5;
    }
  }
  return y + 1;
}

// ---------------------------------------------------------------------------
// CV PAGE 1
// ---------------------------------------------------------------------------
function buildCvPage1(doc: jsPDF, cv: CvData): void {
  // === HEADER ===
  doc.setFontSize(20);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, 22, { align: "center" });

  doc.setFontSize(10);
  setColor(doc, CLR.dark);
  doc.setFont("helvetica", "normal");
  doc.text(cv.roleTitle, PW / 2, 29, { align: "center" });

  doc.setFontSize(7.5);
  setColor(doc, CLR.mid);
  doc.text(CANDIDATE.contact, PW / 2, 34, { align: "center" });

  hLine(doc, 37, ML, ML + CW, CLR.bronze, 0.6);

  // === SIDEBAR BACKGROUND (will draw from 40 to bottom) ===
  const sbTop = 40;
  doc.setFillColor(CLR.bg[0], CLR.bg[1], CLR.bg[2]);
  doc.rect(SB_X - 2, sbTop, SB_W + 2, PH - sbTop - 10, "F");

  // === SIDEBAR CONTENT ===
  let sbY = sbTop + 3;
  for (const section of cv.sidebarPage1) {
    sbY = buildSidebarSection(doc, section, sbY);
  }

  // === MAIN CONTENT ===
  let mainY = sbTop + 3;

  // Professional Summary
  mainY = mainSectionHeader(doc, "Professional Summary", mainY);
  doc.setFontSize(8);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(cv.summary, MAIN_W);
  for (const line of summaryLines) {
    doc.text(line, MAIN_X, mainY);
    mainY += 3.5;
  }
  mainY += 2;

  // Career Timeline
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
  mainY += 3;
  doc.setFontSize(6.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 7; i++) {
    doc.text(companies[i], MAIN_X + colW * i + colW / 2, mainY, { align: "center" });
  }
  mainY += 5;

  // Experience entries on page 1
  mainY = mainSectionHeader(doc, "Professional Experience", mainY);
  for (const entry of cv.experiencePage1) {
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W);
    mainY += 2;
  }
}

// ---------------------------------------------------------------------------
// CV PAGE 2
// ---------------------------------------------------------------------------
function buildCvPage2(doc: jsPDF, cv: CvData): void {
  // Page 2 header
  doc.setFontSize(8);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, 12, { align: "center" });
  doc.setFontSize(7);
  setColor(doc, CLR.mid);
  doc.setFont("helvetica", "normal");
  doc.text(`${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`, PW / 2, 17, { align: "center" });

  hLine(doc, 20, ML, ML + CW, CLR.bronze, 0.4);

  const contentTop = 24;

  // Sidebar background
  doc.setFillColor(CLR.bg[0], CLR.bg[1], CLR.bg[2]);
  doc.rect(SB_X - 2, contentTop, SB_W + 2, PH - contentTop - 10, "F");

  // Sidebar
  let sbY = contentTop + 2;
  for (const section of cv.sidebarPage2) {
    sbY = buildSidebarSection(doc, section, sbY);
  }

  // Main: experience entries continued
  let mainY = contentTop + 2;
  for (const entry of cv.experiencePage2) {
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W);
    mainY += 2;
  }

  // Earlier Career
  if (cv.earlierCareer.length > 0) {
    mainY = mainSectionHeader(doc, "Earlier Career Summary", mainY);
    for (const e of cv.earlierCareer) {
      doc.setFontSize(8);
      setColor(doc, CLR.sechdr);
      doc.setFont("helvetica", "bold");
      doc.text(`\u2022  ${e.company}, `, MAIN_X, mainY, { maxWidth: MAIN_W });
      // Get text width of the header to position place inline
      const headerW = doc.getTextWidth(`\u2022  ${e.company}, `);
      doc.setFont("helvetica", "italic");
      doc.text(e.place, MAIN_X + headerW, mainY);
      doc.setFontSize(7);
      setColor(doc, CLR.mid);
      doc.setFont("helvetica", "normal");
      const placeW = doc.getTextWidth(e.place);
      doc.text(`  |  ${e.dates}`, MAIN_X + headerW + placeW, mainY);
      mainY += 4;
      doc.setFontSize(7.5);
      setColor(doc, CLR.mid);
      doc.text(e.oneLiner, MAIN_X + 3, mainY, { maxWidth: MAIN_W - 6 });
      mainY += 4.5;
    }
  }
}

// ---------------------------------------------------------------------------
// EXPERIENCE ENTRY BUILDER
// ---------------------------------------------------------------------------
function buildExperienceEntry(
  doc: jsPDF, e: ExperienceEntry, y: number,
  x: number, xR: number, w: number
): number {
  // Title (right-aligned dates)
  doc.setFontSize(8.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "bold");
  doc.text(e.title, x, y, { maxWidth: w - 20 });
  doc.setFontSize(7);
  setColor(doc, CLR.mid);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, xR, y, { align: "right" });
  y += 3.5;

  // Company + location
  doc.setFontSize(7.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "italic");
  doc.text(e.company, x, y, { maxWidth: w - 20 });
  doc.setFontSize(7);
  doc.text(e.location, xR, y, { align: "right" });
  y += 4;

  // Bullets
  doc.setFontSize(7.5);
  setColor(doc, CLR.sechdr);
  doc.setFont("helvetica", "normal");
  for (const b of e.bullets) {
    const bulletLines = doc.splitTextToSize(`\u2022  ${b}`, w - 4);
    for (const line of bulletLines) {
      doc.text(line, x + 2, y);
      y += 3.2;
    }
    y += 0.5;
  }
  return y;
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
// ---------------------------------------------------------------------------
function buildCoverLetterPdf(
  cv: CvData,
  jobTitle: string,
  company?: string,
  extraKeywords?: string[]
): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });

  const left = 30;
  const right = PW - 30;
  const textW = right - left;

  // Header
  doc.setFontSize(16);
  setColor(doc, CLR.accent);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, 35, { align: "center" });

  doc.setFontSize(8.5);
  setColor(doc, CLR.mid);
  doc.setFont("helvetica", "normal");
  doc.text(CANDIDATE.contact, PW / 2, 41, { align: "center" });

  hLine(doc, 45, left, right, CLR.bronze, 0.6);

  let y = 55;

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
  doc.text(company ? `To the Hiring Manager\n${company}` : "To the Hiring Committee", left, y);
  y += 10;

  // Subject
  doc.setFont("helvetica", "bold");
  doc.text(
    `Re: Application for ${jobTitle}${company ? ` at ${company}` : ""}`,
    left, y
  );
  y += 7;

  // Salutation
  doc.setFont("helvetica", "normal");
  doc.text("Dear Hiring Manager,", left, y);
  y += 7;

  // Paragraphs
  const para1 = `I am writing to express my strong interest in the ${jobTitle} position${company ? ` at ${company}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial instinct, I am confident that my background aligns closely with the requirements of this opportunity.`;

  const summarySentences = cv.summary.split(". ").slice(1, 3).join(". ").trim();
  const para2 = `As a ${cv.roleShort}, I have built a career on the kind of outcomes your role demands: ${summarySentences}. My work has consistently paired technical rigor with the ability to win trust across industries, cultures, and senior stakeholders \u2014 translating complex requirements into practical systems that hold up to scrutiny while genuinely improving business performance.`;

  const keywordsStr = extraKeywords && extraKeywords.length > 0
    ? `my expertise in ${extraKeywords.slice(0, 3).join(", ")}${extraKeywords.length > 3 ? ", and related areas" : ""}`
    : "my cross-border experience and audit-grade rigor";
  const companyRef = company ? `${company}'s` : "your organization's";
  const para3 = `What draws me specifically to this opportunity is the chance to bring ${keywordsStr} to your team, and to contribute to ${companyRef} continued growth. I am comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;

  const para4 = `I would welcome the opportunity to discuss how my experience can contribute to your team's continued success. Thank you for considering my application; I look forward to the possibility of speaking with you further.`;

  const paragraphs = [para1, para2, para3, para4];
  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p, textW);
    for (const line of lines) {
      doc.text(line, left, y);
      y += 4.5;
    }
    y += 3;
  }

  // Closing
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.text("Yours sincerely,", left, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text("Muhammad Ali Bhatti", left, y);

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