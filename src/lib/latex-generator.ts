/**
 * PDF CV Generator v8.0 — Clean, Professional, No-Overflow
 * ============================================================
 * Generates tailored CV and cover letter PDFs using jsPDF.
 *
 * Layout:
 *   - 35% left sidebar / 65% right main column
 *   - Dark navy (#002147) headers, gold (#B8860B) accents
 *   - Smart content fitting: auto-truncates summary, limits bullets
 *   - NO career timeline (redundant, wastes space)
 *   - Proper overflow protection at every step
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
// LAYOUT (A4 = 210 x 297mm)
// ---------------------------------------------------------------------------
const PW = 210;
const PH = 297;
const ML = 18;
const MR = 18;
const CW = PW - ML - MR; // 174mm

// Column split: 35% sidebar, 65% main
const SB_W = 60;
const GAP = 4;
const MAIN_W = CW - SB_W - GAP; // 110mm

const SB_X = ML;
const SB_R = ML + SB_W;          // 78mm
const MAIN_X = ML + SB_W + GAP;  // 82mm
const MAIN_R = ML + CW;          // 192mm

// Vertical positions
const HDR_NAME_Y = 30;
const HDR_TITLE_Y = 39;
const HDR_CONTACT_Y = 46;
const HDR_RULE_Y = 51;
const CONTENT_Y = 58;

// Page margins (top/bottom content bounds)
const PAGE1_BOTTOM = PH - 10;
const PAGE2_TOP = 20;
const PAGE2_BOTTOM = PH - 10;

// ---------------------------------------------------------------------------
// COLORS
// ---------------------------------------------------------------------------
const C = {
  navy:   [0, 33, 71],
  gold:   [184, 134, 11],
  body:   [51, 51, 51],
  mid:    [85, 85, 85],
  gray:   [102, 102, 102],
  lgray:  [170, 170, 170],
  div:    [210, 210, 210],
  white:  [255, 255, 255],
};

// ---------------------------------------------------------------------------
// FONT SIZES (pt)
// ---------------------------------------------------------------------------
const F = {
  name:     24,
  title:    12,
  contact:  9,
  secHdr:   10.5,
  body:     9.5,
  bullet:   9,
  small:    8,
  tiny:     7.5,
  certName: 9,
  skill:    8.5,
};

const BULLET = "\u2022";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function setClr(doc: jsPDF, rgb: number[]) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }

function hRule(doc: jsPDF, y: number, x1: number, x2: number, rgb?: number[], w?: number) {
  const c = rgb || C.gold;
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w || 0.3);
  doc.line(x1, y, x2, y);
}

function vRule(doc: jsPDF, x: number, y1: number, y2: number) {
  doc.setDrawColor(C.div[0], C.div[1], C.div[2]);
  doc.setLineWidth(0.15);
  doc.line(x, y1, x, y2);
}

/** Truncate text to fit approximately maxLines lines at given width. */
function fitText(doc: jsPDF, text: string, maxWidth: number, maxLines: number): string {
  const lines = doc.splitTextToSize(text, maxWidth);
  if (lines.length <= maxLines) return text;
  // Find the cut point
  let truncated = text;
  while (doc.splitTextToSize(truncated + "...", maxWidth).length > maxLines) {
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace <= 0) break;
    truncated = truncated.substring(0, lastSpace);
  }
  return truncated + "...";
}

// ---------------------------------------------------------------------------
// SECTION HEADER
// ---------------------------------------------------------------------------
function sectionHdr(doc: jsPDF, title: string, x: number, xR: number, y: number): number {
  doc.setFontSize(F.secHdr);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), x, y);
  const ruleY = y + 1.5;
  hRule(doc, ruleY, x, xR, C.gold, 0.35);
  return ruleY + 4.5;
}

// ---------------------------------------------------------------------------
// SIDEBAR SECTION
// ---------------------------------------------------------------------------
function sidebarSection(doc: jsPDF, sec: SidebarSection, y: number, maxY: number): number {
  // Check if we have room for at least a header + 1 item
  if (y > maxY - 15) return y;

  y = sectionHdr(doc, sec.title, SB_X, SB_R, y);

  for (const item of sec.items) {
    if (y > maxY - 6) break;

    if (Array.isArray(item) && typeof item[1] === "number") {
      // Skill proficiency: [name, rating/5]
      const [name, rating] = item as [string, number];
      doc.setFontSize(F.skill);
      setClr(doc, C.body);
      doc.setFont("helvetica", "normal");
      // Truncate skill name if it would wrap
      const truncated = fitText(doc, name, SB_W - 22, 1);
      doc.text(truncated, SB_X + 2, y, { maxWidth: SB_W - 22 });
      // Draw filled/empty circles
      const dotX = SB_R - 14;
      const dotY = y - 1;
      const dotR = 0.55;
      for (let i = 0; i < 5; i++) {
        const cx = dotX + i * 2.5;
        if (i < rating) {
          doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
          doc.circle(cx, dotY, dotR, "F");
        } else {
          doc.setDrawColor(C.div[0], C.div[1], C.div[2]);
          doc.circle(cx, dotY, dotR, "S");
        }
      }
      y += 4.5;
    } else if (Array.isArray(item) && typeof item[1] === "string") {
      // Credential: [name, description]
      const [name, desc] = item as [string, string];
      if (y > maxY - 6) break;
      doc.setFontSize(7);
      setClr(doc, C.gold);
      doc.text(BULLET, SB_X + 1, y);
      doc.setFontSize(F.certName);
      setClr(doc, C.body);
      doc.setFont("helvetica", "bold");
      const truncName = fitText(doc, name, SB_W - 8, 1);
      doc.text(truncName, SB_X + 4, y, { maxWidth: SB_W - 8 });
      y += 4;
      if (desc && y < maxY - 5) {
        doc.setFontSize(F.small);
        setClr(doc, C.gray);
        doc.setFont("helvetica", "normal");
        const truncDesc = fitText(doc, desc, SB_W - 10, 1);
        doc.text(truncDesc, SB_X + 5, y, { maxWidth: SB_W - 10 });
        y += 4;
      }
    } else {
      // Plain bullet
      const text = String(item);
      if (y > maxY - 5) break;
      doc.setFontSize(7);
      setClr(doc, C.gold);
      doc.text(BULLET, SB_X + 1, y);
      doc.setFontSize(8.5);
      setClr(doc, C.body);
      doc.setFont("helvetica", "normal");
      const truncText = fitText(doc, text, SB_W - 8, 1);
      doc.text(truncText, SB_X + 4, y, { maxWidth: SB_W - 8 });
      y += 4;
    }
  }
  return y + 3;
}

// ---------------------------------------------------------------------------
// EXPERIENCE ENTRY — with strict overflow protection
// ---------------------------------------------------------------------------
function experienceEntry(doc: jsPDF, e: ExperienceEntry, y: number, maxY: number, maxBullets: number = 4): number {
  // Need at least 20mm for title + company + 1 bullet
  if (y > maxY - 20) return y;

  // Job title (bold navy) + date (gray right-aligned)
  doc.setFontSize(10);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  const truncTitle = fitText(doc, e.title, MAIN_W - 40, 1);
  doc.text(truncTitle, MAIN_X, y, { maxWidth: MAIN_W - 40 });
  doc.setFontSize(F.small);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, MAIN_R, y, { align: "right" });
  y += 4;

  // Company (italic)
  doc.setFontSize(9);
  setClr(doc, C.mid);
  doc.setFont("helvetica", "italic");
  doc.text(e.company, MAIN_X, y, { maxWidth: MAIN_W - 5 });
  y += 3.5;

  // Location
  doc.setFontSize(F.small);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text(e.location, MAIN_X, y);
  y += 4;

  // Bullets — max maxBullets, each max 2 lines
  const bulletCount = Math.min(e.bullets.length, maxBullets);
  for (let i = 0; i < bulletCount; i++) {
    if (y > maxY - 6) break;
    doc.setFontSize(7);
    setClr(doc, C.gold);
    doc.text(BULLET, MAIN_X + 2, y);
    setClr(doc, C.body);
    doc.setFontSize(F.bullet);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(e.bullets[i], MAIN_W - 10);
    const maxLines = Math.min(lines.length, 2); // max 2 lines per bullet
    for (let li = 0; li < maxLines; li++) {
      if (y > maxY - 4) break;
      doc.text(lines[li], MAIN_X + 6, y);
      y += 3.8;
    }
    y += 1.5; // gap between bullets
  }
  return y;
}

// ---------------------------------------------------------------------------
// PAGE 1
// ---------------------------------------------------------------------------
function page1(doc: jsPDF, cv: CvData): void {
  // === HEADER ===
  doc.setFontSize(F.name);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, HDR_NAME_Y, { align: "center" });

  doc.setFontSize(F.title);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  doc.text(cv.roleTitle, PW / 2, HDR_TITLE_Y, { align: "center" });

  doc.setFontSize(F.contact);
  setClr(doc, C.gray);
  doc.text(CANDIDATE.contact, PW / 2, HDR_CONTACT_Y, { align: "center" });

  // Gold rule
  hRule(doc, HDR_RULE_Y, ML, ML + CW, C.gold, 0.5);

  // Vertical divider
  vRule(doc, SB_R + GAP / 2, CONTENT_Y, PAGE1_BOTTOM);

  // === SIDEBAR ===
  let sbY = CONTENT_Y + 2;
  for (const sec of cv.sidebarPage1) {
    sbY = sidebarSection(doc, sec, sbY, PAGE1_BOTTOM);
  }

  // === MAIN COLUMN ===
  let y = CONTENT_Y + 2;

  // Professional Summary — auto-truncate to fit ~5 lines
  y = sectionHdr(doc, "Professional Summary", MAIN_X, MAIN_R - 5, y);
  const summaryMaxLines = 5;
  const fittedSummary = fitText(doc, cv.summary, MAIN_W - 5, summaryMaxLines);
  doc.setFontSize(F.body);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  const sumLines = doc.splitTextToSize(fittedSummary, MAIN_W - 5);
  for (const line of sumLines) {
    if (y > PAGE1_BOTTOM - 5) break;
    doc.text(line, MAIN_X, y);
    y += 4.2;
  }
  y += 4;

  // Professional Experience — NO timeline, straight to experience
  y = sectionHdr(doc, "Professional Experience", MAIN_X, MAIN_R - 5, y);
  for (const entry of cv.experiencePage1) {
    if (y > PAGE1_BOTTOM - 22) break;
    y = experienceEntry(doc, entry, y, PAGE1_BOTTOM, 4);
    y += 4;
  }
}

// ---------------------------------------------------------------------------
// PAGE 2
// ---------------------------------------------------------------------------
function page2(doc: jsPDF, cv: CvData): void {
  // Page 2 header
  doc.setFontSize(F.tiny);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  const hdr = `${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`;
  doc.text(hdr, PW / 2, 12, { align: "center" });

  hRule(doc, 15, ML, ML + CW, C.div, 0.2);

  // Vertical divider
  vRule(doc, SB_R + GAP / 2, PAGE2_TOP, PAGE2_BOTTOM);

  // === SIDEBAR (Page 2) ===
  let sbY = PAGE2_TOP + 2;
  for (const sec of cv.sidebarPage2) {
    sbY = sidebarSection(doc, sec, sbY, PAGE2_BOTTOM);
  }

  // === MAIN COLUMN (Page 2) ===
  let y = PAGE2_TOP + 2;
  for (const entry of cv.experiencePage2) {
    if (y > PAGE2_BOTTOM - 22) break;
    y = experienceEntry(doc, entry, y, PAGE2_BOTTOM, 4);
    y += 4;
  }

  // Earlier Career Summary
  if (cv.earlierCareer.length > 0 && y < PAGE2_BOTTOM - 20) {
    y = sectionHdr(doc, "Earlier Career", MAIN_X, MAIN_R - 5, y);
    for (const e of cv.earlierCareer) {
      if (y > PAGE2_BOTTOM - 10) break;
      doc.setFontSize(7);
      setClr(doc, C.gold);
      doc.text(BULLET, MAIN_X + 1, y);
      doc.setFontSize(F.bullet);
      setClr(doc, C.body);
      doc.setFont("helvetica", "bold");
      const hdrText = `${e.company}, `;
      doc.text(hdrText, MAIN_X + 4, y);
      const hdrW = doc.getTextWidth(hdrText);
      doc.setFont("helvetica", "italic");
      doc.text(e.place, MAIN_X + 4 + hdrW, y);
      const placeW = doc.getTextWidth(e.place);
      doc.setFontSize(F.small);
      setClr(doc, C.gray);
      doc.setFont("helvetica", "normal");
      doc.text(`  |  ${e.dates}`, MAIN_X + 4 + hdrW + placeW, y);
      y += 4;
      doc.setFontSize(F.bullet);
      setClr(doc, C.mid);
      const truncOne = fitText(doc, e.oneLiner, MAIN_W - 10, 2);
      const oneLines = doc.splitTextToSize(truncOne, MAIN_W - 10);
      for (const line of oneLines) {
        if (y > PAGE2_BOTTOM - 5) break;
        doc.text(line, MAIN_X + 6, y);
        y += 3.8;
      }
      y += 3;
    }
  }
}

// ---------------------------------------------------------------------------
// BUILD CV PDF
// ---------------------------------------------------------------------------
function buildCv(cv: CvData): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });
  page1(doc, cv);
  doc.addPage();
  page2(doc, cv);
  return Buffer.from(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// BUILD COVER LETTER PDF
// ---------------------------------------------------------------------------
function buildCoverLetter(
  cv: CvData,
  jobTitle: string,
  company?: string,
  extraKeywords?: string[],
  coverLetterText?: string
): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });

  const left = 25;
  const right = PW - 25;
  const textW = right - left;
  const companyName = (company && company !== "Unknown" && company !== "Not specified") ? company : "";

  // Header
  doc.setFontSize(18);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", PW / 2, 30, { align: "center" });

  doc.setFontSize(9);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text("Lahore, Pakistan  |  +92 332 4862219  |  marketbrain@gmail.com  |  Open to International Relocation", PW / 2, 37, { align: "center" });

  hRule(doc, 42, left, right, C.navy, 0.5);

  let y = 54;

  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(10.5);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  doc.text(date, left, y);
  y += 10;

  if (companyName) {
    doc.text("Hiring Manager", left, y); y += 6;
    doc.text(companyName, left, y); y += 10;
  } else {
    doc.text("Hiring Manager", left, y); y += 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const subject = companyName ? `Re: Application for ${jobTitle} at ${companyName}` : `Re: Application for ${jobTitle}`;
  doc.text(subject, left, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.text("Dear Hiring Manager,", left, y);
  y += 8;

  const writePara = (text: string, spacing = 5) => {
    const lines = doc.splitTextToSize(text, textW);
    for (const line of lines) { doc.text(line, left, y); y += spacing; }
    y += 4;
  };

  setClr(doc, C.body);
  doc.setFontSize(10.5);

  if (coverLetterText) {
    const paras = coverLetterText.split(/\n\n+/).filter(p => p.trim());
    for (const para of paras) writePara(para.trim());
  } else {
    writePara(`I am writing to express my strong interest in the ${jobTitle} position${companyName ? ` at ${companyName}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial acumen, I am confident that my background aligns closely with the requirements of this opportunity.`);
    writePara(`Throughout my career, I have successfully led cross-functional teams, managed regulatory compliance across multiple jurisdictions, and delivered measurable outcomes for complex multi-site operations. My certifications and hands-on expertise provide a strong technical foundation for this role, while my international experience enables me to navigate diverse cultural and business environments effectively.`);
    const kw = extraKeywords && extraKeywords.length > 0 ? extraKeywords.slice(0, 4).join(", ") : "";
    const p3 = kw
      ? `What draws me specifically to this opportunity is the chance to bring my expertise in ${kw} to your team${companyName ? `, and to contribute to ${companyName}'s continued growth and success` : ""}. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`
      : `What draws me to this opportunity is the strong alignment between my career achievements and the demands of this role. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;
    writePara(p3);
    writePara(`I would welcome the opportunity to discuss how my experience and qualifications can add value to your team. I am available for an interview at your earliest convenience and can be reached at +92 332 4862219 or marketbrain@gmail.com. Thank you for considering my application.`);
  }

  y += 4;
  doc.text("Yours sincerely,", left, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setClr(doc, C.navy);
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
  options?: { jobTitle?: string; company?: string; extraKeywords?: string[]; idPrefix?: string; coverLetterText?: string }
): Promise<GenerateCvResult> => {
  const id = options?.idPrefix || `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cvPdfPath = join(PDF_OUT_DIR, `${id}_cv.pdf`);
  const clPdfPath = join(PDF_OUT_DIR, `${id}_cover.pdf`);

  console.log("[pdf] Generating CV PDF...");
  const cvBuffer = buildCv(cv);
  writeFileSync(cvPdfPath, cvBuffer);
  console.log(`[pdf] CV saved: ${cvPdfPath} (${cvBuffer.length} bytes)`);

  console.log("[pdf] Generating cover letter...");
  const clBuffer = buildCoverLetter(cv, options?.jobTitle || cv.roleTitle, options?.company, options?.extraKeywords, options?.coverLetterText);
  writeFileSync(clPdfPath, clBuffer);
  console.log(`[pdf] Cover letter saved: ${clPdfPath} (${clBuffer.length} bytes)`);

  return {
    cvPdfPath,
    coverLetterPdfPath: clPdfPath,
    cvTexContent: JSON.stringify({ variant: cv.roleShort, timestamp: new Date().toISOString() }, null, 2),
    coverLetterTexContent: JSON.stringify({ jobTitle: options?.jobTitle, company: options?.company, variant: cv.roleShort, timestamp: new Date().toISOString() }, null, 2),
  };
};

export const readPdfAsBase64 = (pdfPath: string): string => {
  return readFileSync(pdfPath).toString("base64");
};