/**
 * PDF CV Generator
 * ==================
 * Generates a tailored CV and cover letter PDF using jspdf + jspdf-autotable.
 * Pure JavaScript — no external binaries needed. Works on Vercel.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { CANDIDATE, CvData, SidebarSection, ExperienceEntry, EarlierCareerEntry } from "./cv-data";

// ---------------------------------------------------------------------------
// PATHS
// ---------------------------------------------------------------------------
const isVercel = process.env.VERCEL === "1";
const PDF_OUT_DIR = isVercel ? "/tmp/cv_pdfs" : join(homedir(), ".cv-platform", "pdfs");
if (!existsSync(PDF_OUT_DIR)) mkdirSync(PDF_OUT_DIR, { { recursive: true });

// ---------------------------------------------------------------------------
// COLORS (matching LaTeX template)
// ---------------------------------------------------------------------------
const C = {
  accent: "#1b365d",
  sechdr: "#2d3748",
  bronze: "#8c7853",
  darkgray: "#333333",
  midgray: "#606774",
  lightgray: "#989ca5",
  lightrule: "#cbd5e0",
  white: "#ffffff",
};

// Register autotable
autoTable(jsPDF);

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const addPage = (doc: jsPDF, text: string, size = 10, color = C.sechdr, bold = false, italic = false, align: "left") => {
  doc.setFontSize(size);
  doc.setTextColor(color);
  doc.setFont("helvetica", bold ? "bold" : "normal", italic ? "italic" : "normal");
  doc.text(text, { align });
};

const bronzeLine = (doc: jsPDF, y: number) => {
  doc.setDrawColor(C.bronze);
  doc.setLineWidth(0.6);
  doc.line(37, y, 515, y);
};

const thinLine = (doc: jsPDF, y: number) => {
  doc.setDrawColor(C.bronze);
  doc.setLineWidth(1);
  doc.line(37, y, 515, y);
};

const textColored = (doc: jsPDF, text: string, x: number, y: number, opts: { size?: number; color?: string; bold?: boolean; italic?: boolean; align?: Canvas["align"]; maxWidth?: number } = {}) => {
  doc.setFontSize(opts.size || 9);
  if (opts.color) doc.setTextColor(opts.color);
  doc.setFont("helvetica", opts.bold ? "bold" : "normal", opts.italic ? "italic" : "normal");
  doc.text(text, x, y, { align: opts.align || "left", maxWidth: opts.maxWidth });
  return doc.y;
};

// ---------------------------------------------------------------------------
// SECTION BUILDERS
// ---------------------------------------------------------------------------
const sidebarHeader = (doc: jsPDF, title: string, y: number) => {
  doc.setFontSize(10.5);
  doc.setTextColor(C.accent);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 37, y, { align: "center" });
  const ruleY = y + 3.5;
  doc.setDrawColor(C.lightrule);
  doc.setLineWidth(0.6);
  doc.line(37, ruleY, 515, ruleY);
  return ruleY + 3;
};

const mainHeader = (doc: jsPDF, title: string, y: number) => {
  doc.setFontSize(11);
  doc.setTextColor(C.accent);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 37, y, { align: "center" });
  const ruleY = y + 4;
  doc.setDrawColor(C.bronze);
  doc.setLineWidth(0.6);
  doc.line(37, ruleY, 515, ruleY);
  return ruleY + 3;
};

const buildSidebarSection = (doc: jsPDF, section: SidebarSection, startY: number): number => {
  let y = sidebarHeader(doc, section.title, startY);

  if (section.title === "SKILL PROFICIENCY") {
    for (const item of section.items) {
      const [skill, rating] = item as [string, number];
      doc.setFontSize(9);
      doc.setTextColor(C.sechdr);
      doc.setFont("helvetica", "normal");
      doc.text(skill, 37, y, { maxWidth: 110 });
      const dotX = 370;
      const filled = "\u2022";
      const empty = "\u25CB";
      for (let i = 0; i < 5; i++) {
        doc.setTextColor(i < rating ? C.bronze : C.lightrule);
        doc.setFontSize(12);
        doc.text(i < rating ? filled : empty, dotX + i * 14, y);
      }
      y += 8;
    }
  } else {
    for (const item of section.items) {
      if (Array.isArray(item)) {
        const [main, sub] = item as [string, string];
        doc.setFontSize(9);
        doc.setTextColor(C.sechdr);
        doc.setFont("helvetica", "bold");
        doc.text(main, 37, y, { maxWidth: 155 });
        if (sub) {
          doc.setFontSize(8);
          doc.setTextColor(C.midgray);
          doc.text(sub, 45, y + 1.5, { maxWidth: 150 });
          y += 5;
        }
        y += 3;
      } else {
        doc.setFontSize(9);
        doc.setTextColor(C.sechdr);
        doc.setFont("helvetica", "normal");
        doc.text(`\u2022  ${String(item)}`, 37, y, { maxWidth: 155 });
        y += 3.5;
      }
    }
  }
  return y;
};

const buildSummary = (doc: jsPDF, text: string, startY: number): number => {
  let y = mainHeader(doc, "Professional Summary", startY);
  doc.setFontSize(10);
  doc.setTextColor(C.sechdr);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(text, 330, { lineHeight: 1.25 });
  for (const line of lines) {
    doc.text(line, 37, y);
    y += 4.5;
  }
  return y;
};

const buildTimeline = (doc: jsPDF, startY: number): number => {
  let y = mainHeader(doc, "Career Timeline", startY);
  const timeline = [
    ["2008", "Etisalat/PTCL"], ["2014", "Independent"], ["2015", "Guardian ICS"],
    ["2017", "DQS-Pakistan"], ["2018", "Mace"], ["2020", "Power Intl."], ["2024", "Michael Kors"],
  ];
  const colW = (515 - 7 * 2) / 7;

  // Header row
  doc.setFontSize(10.5);
  doc.setTextColor(C.accent);
  doc.setFont("helvetica", "bold");
  for (let i = 0; i < 7; i++) {
    doc.text(timeline[i][0], 37 + colW * i + colW / 2, y, { align: "center", width: colW });
  }
  y += 3;

  // Rule
  doc.setDrawColor(C.bronze);
  doc.setLineWidth(0.5);
  doc.line(37, y, 515, y);
  y += 3;

  // Company row
  doc.setFontSize(8.5);
  doc.setTextColor(C.sechdr);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < 7; i++) {
    doc.text(timeline[i][1], 37 + colW * i + colW / 2, y, { align: "center", width: colW });
  }
  return y;
};

const buildExperienceEntry = (doc: jsPDF, e: ExperienceEntry, isPage2: boolean, startY: number): number => {
  let y = isPage2 ? startY : startY;
  if (!isPage2) {
    y = mainHeader(doc, "Professional Experience", startY);
  }

  // Title + dates
  doc.setFontSize(9);
  doc.setTextColor(C.sechdr);
  doc.setFont("helvetica", "bold");
  doc.text(e.title, 37, y, { maxWidth: 330 });
  doc.setFontSize(8);
  doc.setTextColor(C.midgray);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, 515, y, { align: "right" });
  y += 2;

  // Company + location
  doc.setFontSize(8.5);
  doc.setTextColor(C.sechdr);
  doc.setFont("helvetica", "italic");
  doc.text(e.company, 37, y, { maxWidth: 330 });
  doc.text(e.location, 515, y, { align: "right" });
  y += 3;

  // Bullets
  doc.setFontSize(9);
  doc.setTextColor(C.sechdr);
  doc.setFont("helvetica", "normal");
  for (const b of e.bullets) {
    doc.text(`\u2022  ${b}`, 45, y, { maxWidth: 330, lineHeight: 1.2 });
    y += 3.5;
  }
  return y;
};

const buildEarlierCareer = (doc: jsPDF, entries: EarlierCareerEntry[], startY: number): number => {
  let y = mainHeader(doc, "Earlier Career Summary", startY);
  doc.setFontSize(9);
  doc.setTextColor(C.sechdr);
  for (const e of entries) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`\u2022  ${e.company}, `, 37, y, { continued: true, maxWidth: 480 });
    doc.setFont("helvetica", "italic");
    doc.text(e.place, { continued: true });
    doc.setFontSize(8.5);
    doc.setTextColor(C.midgray);
    doc.text(`  | ${e.dates}`, { continued: true });
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(C.midgray);
    doc.text(e.oneLiner, 45, y, { maxWidth: 330 });
    y += 6;
  }
  return y;
};

// ---------------------------------------------------------------------------
// BUILD CV PDF
// ---------------------------------------------------------------------------
const buildCvPdf = (cv: CvData): Buffer => {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4", putOnlyUsedFonts: ["Helvetica"] });

  const pageW = 210;
  const pageH = 297;
  const ml = 10; // left margin in mm
  const mr = 37; // right margin in mm
  const contentW = pageW - ml - mr;
  const sidebarW = contentW * 0.31;
  const gap = contentW * 0.03;

  // === PAGE 1 ===
  // Header
  doc.setFontSize(24);
  doc.setTextColor(C.accent);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, pageW / 2, 25, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(C.darkgray);
  doc.setFont("helvetica", "normal");
  doc.text(cv.roleTitle, pageW / 2, 33, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(C.midgray);
  doc.text(CANDIDATE.contact, pageW / 2, 38, { align: "center" });
  thinLine(doc, 42);

  // Two-column: sidebar + main
  const sbY = 50;
  let mainY = sbY;

  // Build sidebar height first (estimate)
  const sbContentY = cv.sidebarPage1.map(s => buildSidebarSection(doc, s, sbY));
  const sbHeight = sbContentY > sbY ? sbContentY - sbY : 100;

  // Main content
  mainY = buildSummary(doc, cv.summary, mainY);
  mainY = buildTimeline(doc, mainY);
  mainY = buildExperienceEntry(doc, cv.experiencePage1, false, mainY);

  // Draw sidebar
  const sidebarBottom = Math.max(sbY + sbHeight, mainY);

  // Draw sidebar column background
  doc.setFillColor("#f8f9fa");
  doc.rect(ml, sbY - 5, sidebarW, sidebarBottom - sbY + 5, "F");

  // Draw sidebar content
  for (const sy of sbContentY) {
    // We need to re-draw because we drew over it
    // Instead, save positions and draw after
  }
  // Re-approach: draw sidebar first with placeholder, then overlay
  // Actually jspdf doesn't support overlays easily. Let me just draw inline.

  // Reset and draw both columns properly
  const sbX1 = ml;
  const mainX1 = ml + sidebarW + gap;

  // Sidebar
  let y1 = sbY;
  for (const section of cv.sidebarPage1) {
    y1 = buildSidebarSection(doc, section, y1);
  }

  // Fill remaining sidebar with white
  if (y1 < sidebarBottom) {
    doc.setFillColor("#f8f9fa");
    doc.rect(ml, y1, sidebarW, sidebarBottom - y1 + 1, "F");
  }

  // Main column
  let y2 = sbY;
  y2 = buildSummary(doc, cv.summary, y2);
  y2 = buildTimeline(doc, y2);
  y2 = buildExperienceEntry(doc, cv.experiencePage1, false, y2);

  // Main column bottom line
  thinLine(doc, y2 + 3);

  // Page 2
  doc.addPage();
  // Page 2 header
  doc.setFontSize(9);
  doc.setTextColor(C.accent);
  doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", pageW / 2, 15, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(Ccent.midgray);
  doc.text(`Page 2  |  ${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`, pageW / 2, 20, { align: "center" });

  // Page 2 two-column
  let y3 = 40;
  // Sidebar page 2
  for (const section of cv.sidebarPage2) {
    y3 = buildSidebarSection(doc, section, y3);
  }
  // Fill remaining
  if (y3 < sidebarBottom) {
    doc.setFillColor("#f8f9fa");
    doc.rect(ml, y3, sidebarW, sidebarBottom - y3 + 1, "F");
  }
  // Main column page 2
  let y4 = 40;
  y4 = buildExperienceEntry(doc, cv.experiencePage2, true, y4);
  y4 = buildEarlierCareer(doc, cv.earlierCareer, y4);

  return Buffer.from(doc.output("arraybuffer"));
};

// ---------------------------------------------------------------------------
// BUILD COVER LETTER PDF
// ---------------------------------------------------------------------------
const buildCoverLetterPdf = (cv: CvData, jobTitle: string, company?: string, extraKeywords?: string[]): Buffer => {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4", putOnlyUsedFonts: ["Helvetica"] });

  // Header
  doc.setFontSize(16);
  doc.setTextColor(C.accent);
  doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", pageW / 2, 50, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(C.midgray);
  doc.text(CANDIDATE.contact, pageW / 2, 56, { align: "center" });
  doc.setDrawColor(C.bronze);
  doc.setLineWidth(0.8);
  doc.line(56, 61, pageW - 56, 61);

  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const left = 56;
  let y = 76;

  doc.setFontSize(11);
  doc.setTextColor(C.sechdr);
  doc.setFont("helvetica", "normal");
  doc.text(date, left, y);
  y += 8;

  doc.text(company ? `To the Hiring Manager\n${company}` : "To the Hiring Committee", left, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text(`Re: Application for ${jobTitle}${company ? ` at ${company}` : ""}`, left, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text("Dear Hiring Manager,", left, y);
  y += 6;

  const para1 = `I am writing to express my strong interest in the ${jobTitle} position${company ? ` at ${company}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial instinct, I am confident that my background aligns closely with the requirements of this opportunity.`;
  const para2 = `As a ${cv.roleShort}, I have built a career on the kind of outcomes your role demands: ${cv.summary.split(".").slice(1, 3).join(". ").trim()}. My work has consistently paired technical rigor with the ability to win trust across industries, cultures, and senior stakeholders \u2014 translating complex requirements into practical systems that hold up to scrutiny while genuinely improving business performance.`;
  const para3 = `What draws me specifically to this opportunity is the chance to bring ${extraKeywords && extraKeywords.length > 0 ? `my expertise in ${extraKeywords.slice(0, 3).join(", ")}${extraKeywords.length > 3 ? ", and related areas" : ""}` : "my cross-border experience and audit-grade rigor"} to your team, and to contribute to ${company ? `${company}'s` : "your organization's"} continued growth. I am comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;
  const para4 = `I would welcome the opportunity to discuss how my experience can contribute to your team's continued success. Thank you for considering my application; I look forward to the possibility of speaking with you further.`;

  const paras = [para1, para2, para3, para4];
  doc.setFontSize(11);
  doc.setTextColor(C.sechdr);
  for (const p of paras) {
    doc.text(p, left, y, { maxWidth: pageW - 2 * left, lineHeight: 1.5, align: "justify" });
    y += 8;
  }

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Yours sincerely,", left, y);
  y += 20;
  doc.text("Muhammad Ali Bhatti", left, y);

  return Buffer.from(doc.output("arraybuffer"));
};

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

  // Store document structure as JSON for reference (instead of LaTeX)
  const cvDoc = { variant: cv.roleShort, timestamp: new Date().toISOString() };
  const clDoc = { jobTitle, company, variant: cv.roleShort, timestamp: new Date().toISOString() };

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