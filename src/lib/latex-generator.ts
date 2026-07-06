/**
 * PDF CV Generator
 * =================
 * Generates tailored CV and cover letter PDFs using jsPDF (pure JS).
 * No external binaries needed — works on Vercel's Alpine runtime.
 *
 * v6.0 — Professional designer-quality layout:
 *   - Proper font sizes matching sample (11-14pt body, not 7-9pt)
 *   - Generous spacing (1.5x line height)
 *   - Vertical divider line between sidebar and main column
 *   - Tan/light-gray underlines (not loud bronze)
 *   - Clean two-column layout, both white
 *   - Standard bullet character (•) at readable 8pt
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
const PW = 210;
const PH = 297;
const ML = 20;    // 20mm left margin
const MR = 20;    // 20mm right margin
const CW = PW - ML - MR; // 170mm content width

const SB_W = 55;     // sidebar width (~32% of content)
const GAP = 8;       // gap between columns
const MAIN_W = CW - SB_W - GAP; // 107mm main column

const SB_X = ML;                    // 20mm
const SB_R = ML + SB_W;            // 75mm
const DIVIDER_X = SB_R + GAP / 2;  // 79mm — vertical divider position
const MAIN_X = ML + SB_W + GAP;    // 83mm
const MAIN_R = ML + CW;            // 190mm

// Vertical layout
const HDR_NAME_Y = 35;
const HDR_TITLE_Y = 44;
const HDR_CONTACT_Y = 52;
const HDR_RULE_Y = 56;
const CONTENT_TOP = 62;

// Colors — professional, matched to sample
const CLR = {
  navy: [0, 43, 92] as [number, number, number],         // #002B5C — deep navy for name, headers, titles
  tan: [180, 150, 100] as [number, number, number],       // #B49664 — subtle tan for underlines, bullets, rules
  body: [51, 51, 51] as [number, number, number],         // #333333 — body text
  midGray: [102, 102, 102] as [number, number, number],   // #666666 — contact, company names
  lightGray: [136, 136, 136] as [number, number, number],  // #888888 — dates, locations
  divider: [220, 220, 220] as [number, number, number],    // #DCDCDC — vertical column divider
  emptyDot: [220, 220, 220] as [number, number, number],   // #DCDCDC — empty skill dots
  p2Rule: [200, 200, 200] as [number, number, number],    // #C8C8C8 — P2 underlines (lighter)
};

// Font sizes (pt) — PROPER readable sizes matching the sample
const FS = {
  name: 26,          // bold navy centered
  title: 13,         // regular navy centered
  contact: 10,       // gray centered
  sectionHdr: 13,    // bold uppercase navy (main column)
  sbSectionHdr: 11,  // bold uppercase navy (sidebar)
  body: 10.5,        // regular dark gray body text
  bullet: 10,        // bullet point text
  small: 9,          // dates, locations, sub-items
  tiny: 8,           // P2 header, timeline companies
  timelineYear: 10,  // navy for timeline years
  certBold: 10,      // bold for credential names
  skillName: 10,     // for skill proficiency names
};

// Bullet
const BULLET = "\u2022"; // • (U+2022)

// ---------------------------------------------------------------------------
// LOW-LEVEL HELPERS
// ---------------------------------------------------------------------------
function setColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function hLine(doc: jsPDF, y: number, x1: number, x2: number, color?: [number, number, number], w?: number) {
  const c = color || CLR.tan;
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w || 0.35);
  doc.line(x1, y, x2, y);
}

function vLine(doc: jsPDF, x: number, y1: number, y2: number, color?: [number, number, number], w?: number) {
  const c = color || CLR.divider;
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w || 0.25);
  doc.line(x, y1, x, y2);
}

// ---------------------------------------------------------------------------
// SECTION HEADERS
// ---------------------------------------------------------------------------
function sidebarSectionHeader(doc: jsPDF, title: string, y: number, isPage2: boolean): number {
  doc.setFontSize(FS.sbSectionHdr);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), SB_X, y);
  const ruleY = y + 2;
  hLine(doc, ruleY, SB_X, SB_R, isPage2 ? CLR.p2Rule : CLR.divider, 0.25);
  return ruleY + 4;
}

function mainSectionHeader(doc: jsPDF, title: string, y: number, isPage2: boolean): number {
  doc.setFontSize(FS.sectionHdr);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), MAIN_X, y);
  const ruleY = y + 2;
  const ruleEnd = MAIN_X + MAIN_W * 0.95;
  hLine(doc, ruleY, MAIN_X, ruleEnd, isPage2 ? CLR.p2Rule : CLR.tan, 0.4);
  return ruleY + 5;
}

// ---------------------------------------------------------------------------
// SIDEBAR SECTION BUILDER
// ---------------------------------------------------------------------------
function buildSidebarSection(doc: jsPDF, section: SidebarSection, startY: number, isPage2: boolean, maxY?: number): number {
  let y = sidebarSectionHeader(doc, section.title, startY, isPage2);

  for (const item of section.items) {
    if (maxY && y > maxY - 6) break;

    if (Array.isArray(item) && typeof item[1] === "number") {
      // Skill proficiency: [skillName, rating]
      const [skill, rating] = item as [string, number];
      doc.setFontSize(FS.skillName);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "normal");
      doc.text(skill, SB_X, y, { maxWidth: SB_W - 22 });
      const dotX = SB_R - 14;
      for (let i = 0; i < 5; i++) {
        setColor(doc, i < rating ? CLR.tan : CLR.emptyDot);
        doc.setFontSize(8);
        doc.text(i < rating ? BULLET : "\u25CB", dotX + i * 2.8, y);
      }
      y += 5.5;
    } else if (Array.isArray(item) && typeof item[1] === "string") {
      // Credential: [certName, description]
      const [name, desc] = item as [string, string];
      // Line 1: Tan bullet + bold cert name
      setColor(doc, CLR.tan);
      doc.setFontSize(8);
      doc.text(BULLET, SB_X + 1, y);
      doc.setFontSize(FS.certBold);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "bold");
      doc.text(name, SB_X + 4, y, { maxWidth: SB_W - 8 });
      y += 4.5;
      // Line 2: Indented description
      if (desc) {
        setColor(doc, CLR.midGray);
        doc.setFontSize(FS.small);
        doc.setFont("helvetica", "normal");
        doc.text(desc, SB_X + 6, y, { maxWidth: SB_W - 10 });
        y += 4.5;
      }
    } else {
      // Plain string bullet
      const text = String(item);
      setColor(doc, CLR.tan);
      doc.setFontSize(8);
      doc.text(BULLET, SB_X + 1, y);
      doc.setFontSize(FS.body);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "normal");
      doc.text(text, SB_X + 4, y, { maxWidth: SB_W - 8 });
      y += 5;
    }
  }
  return y + 3;
}

// ---------------------------------------------------------------------------
// EXPERIENCE ENTRY BUILDER
// ---------------------------------------------------------------------------
function buildExperienceEntry(
  doc: jsPDF, e: ExperienceEntry, y: number,
  x: number, xR: number, w: number, maxY?: number
): number {
  // Line 1: Job title (bold navy LEFT) + Date (gray RIGHT)
  doc.setFontSize(11);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text(e.title, x, y, { maxWidth: w - 35 });
  doc.setFontSize(FS.small);
  setColor(doc, CLR.lightGray);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, xR, y, { align: "right" });
  y += 5;

  // Line 2: Company (italic, gray)
  doc.setFontSize(FS.body);
  setColor(doc, CLR.midGray);
  doc.setFont("helvetica", "italic");
  doc.text(e.company, x, y, { maxWidth: w - 5 });
  y += 4.5;

  // Line 3: Location (light gray)
  doc.setFontSize(FS.small);
  setColor(doc, CLR.lightGray);
  doc.setFont("helvetica", "normal");
  doc.text(e.location, x, y);
  y += 5;

  // Bullet points
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.body);
  doc.setFontSize(FS.bullet);
  const maxBullets = maxY ? Math.min(e.bullets.length, Math.floor((maxY - y) / 5.5)) : e.bullets.length;
  for (let i = 0; i < maxBullets; i++) {
    if (maxY && y > maxY - 5) break;
    // Tan bullet
    setColor(doc, CLR.tan);
    doc.setFontSize(8);
    doc.text(BULLET, x + 1.5, y);
    // Bullet text
    setColor(doc, CLR.body);
    doc.setFontSize(FS.bullet);
    const bulletLines = doc.splitTextToSize(e.bullets[i], w - 8);
    for (const line of bulletLines) {
      if (maxY && y > maxY - 4) break;
      doc.text(line, x + 5, y);
      y += 4.5;
    }
    y += 1.5;
  }
  return y;
}

// ---------------------------------------------------------------------------
// CV PAGE 1
// ---------------------------------------------------------------------------
function buildCvPage1(doc: jsPDF, cv: CvData): void {
  // === HEADER ===
  doc.setFontSize(FS.name);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text(CANDIDATE.name, PW / 2, HDR_NAME_Y, { align: "center" });

  doc.setFontSize(FS.title);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "normal");
  doc.text(cv.roleTitle, PW / 2, HDR_TITLE_Y, { align: "center" });

  doc.setFontSize(FS.contact);
  setColor(doc, CLR.midGray);
  doc.setFont("helvetica", "normal");
  doc.text(CANDIDATE.contact, PW / 2, HDR_CONTACT_Y, { align: "center" });

  // Tan rule below header
  hLine(doc, HDR_RULE_Y, ML, ML + CW, CLR.tan, 0.5);

  // === VERTICAL DIVIDER LINE ===
  vLine(doc, DIVIDER_X, CONTENT_TOP, PH - 10, CLR.divider, 0.25);

  const pageBottom = PH - 10;

  // === SIDEBAR CONTENT (Page 1) ===
  let sbY = CONTENT_TOP + 3;
  for (const section of cv.sidebarPage1) {
    sbY = buildSidebarSection(doc, section, sbY, false, pageBottom);
  }

  // === MAIN CONTENT ===
  let mainY = CONTENT_TOP + 3;

  // Professional Summary
  mainY = mainSectionHeader(doc, "Professional Summary", mainY, false);
  doc.setFontSize(FS.body);
  setColor(doc, CLR.body);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(cv.summary, MAIN_W);
  for (const line of summaryLines) {
    if (mainY > pageBottom - 5) break;
    doc.text(line, MAIN_X, mainY);
    mainY += 4.8;
  }
  mainY += 4;

  // Career Timeline
  mainY = mainSectionHeader(doc, "Career Timeline", mainY, false);
  const years = ["2008", "2014", "2015", "2017", "2018", "2020", "2024"];
  const companies = ["Etisalat", "Independent", "Guardian", "DQS", "Mace", "Power Intl.", "Michael Kors"];
  const colW = (MAIN_W - 8) / 7;
  // Years above the line
  doc.setFontSize(FS.timelineYear);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  for (let i = 0; i < years.length; i++) {
    doc.text(years[i], MAIN_X + 4 + colW * i + colW / 2, mainY, { align: "center" });
  }
  mainY += 4;
  // Tan horizontal line
  hLine(doc, mainY, MAIN_X, MAIN_X + MAIN_W * 0.95, CLR.tan, 0.3);
  mainY += 4;
  // Company names below
  doc.setFontSize(FS.tiny);
  setColor(doc, CLR.body);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < companies.length; i++) {
    doc.text(companies[i], MAIN_X + 4 + colW * i + colW / 2, mainY, { align: "center" });
  }
  mainY += 6;

  // Professional Experience (page 1)
  mainY = mainSectionHeader(doc, "Professional Experience", mainY, false);
  for (const entry of cv.experiencePage1) {
    if (mainY > pageBottom - 16) break;
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W, pageBottom);
    mainY += 4;
  }
}

// ---------------------------------------------------------------------------
// CV PAGE 2
// ---------------------------------------------------------------------------
function buildCvPage2(doc: jsPDF, cv: CvData): void {
  // Page 2 header
  doc.setFontSize(9);
  setColor(doc, CLR.lightGray);
  doc.setFont("helvetica", "normal");
  const p2Header = `Page 2  |  ${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`;
  doc.text(p2Header, PW / 2, 14, { align: "center" });

  hLine(doc, 18, ML, ML + CW, CLR.p2Rule, 0.25);

  const p2Top = 24;
  const pageBottom = PH - 10;

  // === VERTICAL DIVIDER LINE ===
  vLine(doc, DIVIDER_X, p2Top, PH - 10, CLR.divider, 0.25);

  // Sidebar content (Page 2)
  let sbY = p2Top + 3;
  for (const section of cv.sidebarPage2) {
    sbY = buildSidebarSection(doc, section, sbY, true, pageBottom);
  }

  // Main content (Page 2)
  let mainY = p2Top + 3;
  for (const entry of cv.experiencePage2) {
    if (mainY > pageBottom - 16) break;
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W, pageBottom);
    mainY += 4;
  }

  // Earlier Career Summary
  if (cv.earlierCareer.length > 0 && mainY < pageBottom - 20) {
    mainY = mainSectionHeader(doc, "Earlier Career Summary", mainY, true);
    for (const e of cv.earlierCareer) {
      if (mainY > pageBottom - 12) break;
      setColor(doc, CLR.tan);
      doc.setFontSize(8);
      doc.text(BULLET, MAIN_X + 1, mainY);
      doc.setFontSize(FS.bullet);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "bold");
      const hdr = `${e.company}, `;
      doc.text(hdr, MAIN_X + 4, mainY);
      const hdrW = doc.getTextWidth(hdr);
      doc.setFont("helvetica", "italic");
      doc.text(e.place, MAIN_X + 4 + hdrW, mainY);
      const placeW = doc.getTextWidth(e.place);
      doc.setFontSize(FS.small);
      setColor(doc, CLR.lightGray);
      doc.setFont("helvetica", "normal");
      doc.text(`  |  ${e.dates}`, MAIN_X + 4 + hdrW + placeW, mainY);
      mainY += 5;
      doc.setFontSize(FS.bullet);
      setColor(doc, CLR.midGray);
      doc.setFont("helvetica", "normal");
      doc.text(e.oneLiner, MAIN_X + 6, mainY, { maxWidth: MAIN_W - 10 });
      mainY += 6;
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
// ---------------------------------------------------------------------------
function buildCoverLetterPdf(
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
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", PW / 2, 30, { align: "center" });

  doc.setFontSize(9);
  setColor(doc, CLR.midGray);
  doc.setFont("helvetica", "normal");
  doc.text("Lahore, Pakistan  |  +92 332 4862219  |  marketbrain@gmail.com  |  Open to International Relocation", PW / 2, 37, { align: "center" });

  hLine(doc, 42, left, right, CLR.navy, 0.5);

  let y = 54;

  // Date
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });
  doc.setFontSize(10.5);
  setColor(doc, CLR.body);
  doc.setFont("helvetica", "normal");
  doc.text(date, left, y);
  y += 10;

  // Addressee
  if (companyName) {
    doc.text("Hiring Manager", left, y);
    y += 6;
    doc.text(companyName, left, y);
    y += 10;
  } else {
    doc.text("Hiring Manager", left, y);
    y += 10;
  }

  // Subject line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const subject = companyName
    ? `Re: Application for ${jobTitle} at ${companyName}`
    : `Re: Application for ${jobTitle}`;
  doc.text(subject, left, y);
  y += 10;

  // Salutation
  doc.setFont("helvetica", "normal");
  doc.text("Dear Hiring Manager,", left, y);
  y += 8;

  // Helper for writing paragraphs
  const writePara = (text: string, spacing = 5) => {
    const lines = doc.splitTextToSize(text, textW);
    for (const line of lines) {
      doc.text(line, left, y);
      y += spacing;
    }
    y += 4;
  };

  setColor(doc, CLR.body);
  doc.setFontSize(10.5);

  if (coverLetterText) {
    // Use LLM-written cover letter
    const paras = coverLetterText.split(/\n\n+/).filter(p => p.trim());
    for (const para of paras) {
      writePara(para.trim());
    }
  } else {
    // Auto-generated fallback
    const p1 = `I am writing to express my strong interest in the ${jobTitle} position${companyName ? ` at ${companyName}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial acumen, I am confident that my background aligns closely with the requirements of this opportunity.`;
    writePara(p1);

    const p2 = `Throughout my career, I have successfully led cross-functional teams, managed regulatory compliance across multiple jurisdictions, and delivered measurable outcomes for complex multi-site operations. My certifications and hands-on expertise provide a strong technical foundation for this role, while my international experience enables me to navigate diverse cultural and business environments effectively.`;
    writePara(p2);

    const kw = extraKeywords && extraKeywords.length > 0 ? extraKeywords.slice(0, 4).join(", ") : "";
    const p3 = kw
      ? `What draws me specifically to this opportunity is the chance to bring my expertise in ${kw} to your team${companyName ? `, and to contribute to ${companyName}'s continued growth and success` : ""}. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`
      : `What draws me to this opportunity is the strong alignment between my career achievements and the demands of this role. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;
    writePara(p3);

    const p4 = `I would welcome the opportunity to discuss how my experience and qualifications can add value to your team. I am available for an interview at your earliest convenience and can be reached at +92 332 4862219 or marketbrain@gmail.com. Thank you for considering my application.`;
    writePara(p4);
  }

  // Signature block
  y += 4;
  doc.text("Yours sincerely,", left, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(doc, CLR.navy);
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
  const cvBuffer = buildCvPdf(cv);
  writeFileSync(cvPdfPath, cvBuffer);
  console.log(`[pdf] CV PDF saved: ${cvPdfPath} (${cvBuffer.length} bytes)`);

  console.log("[pdf] Generating cover letter PDF...");
  const clBuffer = buildCoverLetterPdf(
    cv,
    options?.jobTitle || cv.roleTitle,
    options?.company,
    options?.extraKeywords,
    options?.coverLetterText
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