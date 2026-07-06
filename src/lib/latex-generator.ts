/**
 * PDF CV Generator v7.0 — Clean, Professional, Sample-Matched
 * ============================================================
 * Generates tailored CV and cover letter PDFs using jsPDF.
 * Layout matches the professional sample CV:
 *   - 35% left sidebar / 65% right main column
 *   - Dark navy (#002147) headers, gold (#B8860B) accents
 *   - Proper 10-11pt body text with 1.5x line height
 *   - Generous white space between sections
 *   - Clean timeline, consistent bullet styling
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
const SB_W = 60;       // sidebar width
const GAP = 4;         // gutter
const MAIN_W = CW - SB_W - GAP; // 110mm

const SB_X = ML;
const SB_R = ML + SB_W;          // 78mm
const MAIN_X = ML + SB_W + GAP;  // 82mm
const MAIN_R = ML + CW;          // 192mm

// Vertical
const HDR_NAME_Y = 32;
const HDR_TITLE_Y = 42;
const HDR_CONTACT_Y = 49;
const HDR_RULE_Y = 54;
const CONTENT_Y = 62;

// ---------------------------------------------------------------------------
// COLORS — matched to sample
// ---------------------------------------------------------------------------
const C = {
  navy:   [0, 33, 71],    // #002147
  gold:   [184, 134, 11], // #B8860B
  body:   [51, 51, 51],   // #333333
  mid:    [85, 85, 85],   // #555555
  gray:   [102, 102, 102], // #666666
  lgray:  [170, 170, 170], // #AAAAAA
  div:    [210, 210, 210], // #D2D2D2
  white:  [255, 255, 255],
};

// ---------------------------------------------------------------------------
// FONT SIZES (pt) — matched to sample
// ---------------------------------------------------------------------------
const F = {
  name:     26,
  title:    13,
  contact:  9.5,
  secHdr:   11,    // section headers (both columns)
  body:     10,    // main body text
  bullet:   9.5,   // bullet text
  small:    8.5,   // dates, sub-text
  tiny:     7.5,   // timeline companies, P2 header
  timeline: 9,     // timeline years
  certName: 9.5,
  skill:    9,
};

const BULLET = "\u2022";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function setClr(doc: jsPDF, rgb: number[]) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }

function hRule(doc: jsPDF, y: number, x1: number, x2: number, rgb?: number[], w?: number) {
  const c = rgb || C.gold;
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w || 0.35);
  doc.line(x1, y, x2, y);
}

function vRule(doc: jsPDF, x: number, y1: number, y2: number) {
  doc.setDrawColor(C.div[0], C.div[1], C.div[2]);
  doc.setLineWidth(0.2);
  doc.line(x, y1, x, y2);
}

// ---------------------------------------------------------------------------
// SECTION HEADER — works for both columns
// ---------------------------------------------------------------------------
function sectionHdr(doc: jsPDF, title: string, x: number, xR: number, y: number): number {
  doc.setFontSize(F.secHdr);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), x, y);
  // Gold underline spanning column width
  const ruleY = y + 2;
  hRule(doc, ruleY, x, xR, C.gold, 0.4);
  return ruleY + 6; // 6pt gap after header
}

// ---------------------------------------------------------------------------
// SIDEBAR SECTION
// ---------------------------------------------------------------------------
function sidebarSection(doc: jsPDF, sec: SidebarSection, y: number, maxY: number): number {
  y = sectionHdr(doc, sec.title, SB_X, SB_R, y);

  for (const item of sec.items) {
    if (y > maxY - 8) break;

    if (Array.isArray(item) && typeof item[1] === "number") {
      // Skill proficiency: [name, rating/5]
      const [name, rating] = item as [string, number];
      doc.setFontSize(F.skill);
      setClr(doc, C.body);
      doc.setFont("helvetica", "normal");
      doc.text(name, SB_X + 2, y, { maxWidth: SB_W - 20 });
      // Dots
      const dotX = SB_R - 13;
      doc.setFontSize(6.5);
      for (let i = 0; i < 5; i++) {
        setClr(doc, i < rating ? C.gold : C.div);
        doc.text(i < rating ? "\u25CF" : "\u25CB", dotX + i * 2.5, y);
      }
      y += 5;
    } else if (Array.isArray(item) && typeof item[1] === "string") {
      // Credential: [name, description]
      const [name, desc] = item as [string, string];
      doc.setFontSize(7);
      setClr(doc, C.gold);
      doc.text(BULLET, SB_X + 1, y);
      doc.setFontSize(F.certName);
      setClr(doc, C.body);
      doc.setFont("helvetica", "bold");
      doc.text(name, SB_X + 4, y, { maxWidth: SB_W - 8 });
      y += 5;
      if (desc) {
        doc.setFontSize(F.small);
        setClr(doc, C.gray);
        doc.setFont("helvetica", "normal");
        doc.text(desc, SB_X + 6, y, { maxWidth: SB_W - 10 });
        y += 5;
      }
    } else {
      // Plain bullet
      const text = String(item);
      doc.setFontSize(7);
      setClr(doc, C.gold);
      doc.text(BULLET, SB_X + 1, y);
      doc.setFontSize(F.body);
      setClr(doc, C.body);
      doc.setFont("helvetica", "normal");
      doc.text(text, SB_X + 4, y, { maxWidth: SB_W - 8 });
      y += 5;
    }
  }
  return y + 4; // extra gap after section
}

// ---------------------------------------------------------------------------
// EXPERIENCE ENTRY
// ---------------------------------------------------------------------------
function experienceEntry(doc: jsPDF, e: ExperienceEntry, y: number, maxY: number): number {
  // Job title (bold navy) + date (gray right-aligned)
  doc.setFontSize(10.5);
  setClr(doc, C.navy);
  doc.setFont("helvetica", "bold");
  doc.text(e.title, MAIN_X, y, { maxWidth: MAIN_W - 38 });
  doc.setFontSize(F.small);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, MAIN_R, y, { align: "right" });
  y += 5;

  // Company (italic)
  doc.setFontSize(F.body);
  setClr(doc, C.mid);
  doc.setFont("helvetica", "italic");
  doc.text(e.company, MAIN_X, y, { maxWidth: MAIN_W - 5 });
  y += 4.5;

  // Location
  doc.setFontSize(F.small);
  setClr(doc, C.gray);
  doc.setFont("helvetica", "normal");
  doc.text(e.location, MAIN_X, y);
  y += 5;

  // Bullets
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  const maxBullets = maxY ? Math.min(e.bullets.length, Math.floor((maxY - y) / 6)) : e.bullets.length;
  for (let i = 0; i < maxBullets; i++) {
    if (maxY && y > maxY - 5) break;
    // Gold bullet
    doc.setFontSize(7);
    setClr(doc, C.gold);
    doc.text(BULLET, MAIN_X + 2, y);
    // Text
    setClr(doc, C.body);
    doc.setFontSize(F.bullet);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(e.bullets[i], MAIN_W - 10);
    for (const line of lines) {
      if (maxY && y > maxY - 4) break;
      doc.text(line, MAIN_X + 6, y);
      y += 4.5;
    }
    y += 2; // gap between bullets
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
  hRule(doc, HDR_RULE_Y, ML, ML + CW, C.gold, 0.6);

  // Vertical divider
  const divX = SB_R + GAP / 2;
  vRule(doc, divX, CONTENT_Y, PH - 12);

  const bottom = PH - 12;

  // === SIDEBAR ===
  let sbY = CONTENT_Y + 2;
  for (const sec of cv.sidebarPage1) {
    sbY = sidebarSection(doc, sec, sbY, bottom);
  }

  // === MAIN COLUMN ===
  let y = CONTENT_Y + 2;

  // Professional Summary
  y = sectionHdr(doc, "Professional Summary", MAIN_X, MAIN_R - 5, y);
  doc.setFontSize(F.body);
  setClr(doc, C.body);
  doc.setFont("helvetica", "normal");
  const sumLines = doc.splitTextToSize(cv.summary, MAIN_W - 5);
  for (const line of sumLines) {
    if (y > bottom - 5) break;
    doc.text(line, MAIN_X, y);
    y += 5;
  }
  y += 5;

  // Career Timeline
  y = sectionHdr(doc, "Career Timeline", MAIN_X, MAIN_R - 5, y);
  const years = ["2008", "2014", "2015", "2017", "2018", "2020", "2024"];
  const companies = ["Etisalat", "Independent", "Guardian", "DQS", "Mace", "Power Intl.", "Michael Kors"];
  const colW = (MAIN_W - 10) / 7;

  // Years centered in each column
  doc.setFontSize(F.timeline);
  setClr(doc, C.gold);
  doc.setFont("helvetica", "bold");
  for (let i = 0; i < years.length; i++) {
    doc.text(years[i], MAIN_X + 5 + colW * i + colW / 2, y, { align: "center" });
  }
  y += 3;

  // Horizontal gold line
  hRule(doc, y, MAIN_X, MAIN_R - 5, C.gold, 0.3);
  y += 4;

  // Company names
  doc.setFontSize(F.tiny);
  setClr(doc, C.mid);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < companies.length; i++) {
    doc.text(companies[i], MAIN_X + 5 + colW * i + colW / 2, y, { align: "center" });
  }
  y += 7;

  // Professional Experience (page 1)
  y = sectionHdr(doc, "Professional Experience", MAIN_X, MAIN_R - 5, y);
  for (const entry of cv.experiencePage1) {
    if (y > bottom - 20) break;
    y = experienceEntry(doc, entry, y, bottom);
    y += 5;
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
  const hdr = `Page 2  |  ${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`;
  doc.text(hdr, PW / 2, 12, { align: "center" });

  hRule(doc, 16, ML, ML + CW, C.div, 0.2);

  const top = 22;
  const bottom = PH - 12;

  // Vertical divider
  const divX = SB_R + GAP / 2;
  vRule(doc, divX, top, PH - 12);

  // === SIDEBAR (Page 2) ===
  let sbY = top + 2;
  for (const sec of cv.sidebarPage2) {
    sbY = sidebarSection(doc, sec, sbY, bottom);
  }

  // === MAIN COLUMN (Page 2) ===
  let y = top + 2;
  for (const entry of cv.experiencePage2) {
    if (y > bottom - 20) break;
    y = experienceEntry(doc, entry, y, bottom);
    y += 5;
  }

  // Earlier Career Summary
  if (cv.earlierCareer.length > 0 && y < bottom - 25) {
    y = sectionHdr(doc, "Earlier Career Summary", MAIN_X, MAIN_R - 5, y);
    for (const e of cv.earlierCareer) {
      if (y > bottom - 12) break;
      // Bullet + Company, Place | Dates
      doc.setFontSize(7);
      setClr(doc, C.gold);
      doc.text(BULLET, MAIN_X + 1, y);
      doc.setFontSize(F.bullet);
      setClr(doc, C.body);
      doc.setFont("helvetica", "bold");
      const hdr = `${e.company}, `;
      doc.text(hdr, MAIN_X + 4, y);
      const hdrW = doc.getTextWidth(hdr);
      doc.setFont("helvetica", "italic");
      doc.text(e.place, MAIN_X + 4 + hdrW, y);
      const placeW = doc.getTextWidth(e.place);
      doc.setFontSize(F.small);
      setClr(doc, C.gray);
      doc.setFont("helvetica", "normal");
      doc.text(`  |  ${e.dates}`, MAIN_X + 4 + hdrW + placeW, y);
      y += 5;
      doc.setFontSize(F.bullet);
      setClr(doc, C.mid);
      doc.text(e.oneLiner, MAIN_X + 6, y, { maxWidth: MAIN_W - 10 });
      y += 6;
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

  // Date
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