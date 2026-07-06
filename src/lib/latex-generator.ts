/**
 * PDF CV Generator
 * =================
 * Generates tailored CV and cover letter PDFs using jsPDF (pure JS).
 * No external binaries needed — works on Vercel's Alpine runtime.
 *
 * v5.0 — Layout precisely matched to original CV sample (CV_02_QHSE_Manager.pdf):
 *   - Two-column layout, NO sidebar background (both columns white)
 *   - Sidebar: ~33% width, left side
 *   - Main column: ~67% width, right side
 *   - NO vertical divider line between columns
 *   - Gold/Bronze bullet points (●) throughout
 *   - Page 1 section underlines: gold/bronze; Page 2: gray
 *   - Job title + date on SAME LINE (title left, date right)
 *   - Company on SEPARATE line (italic, gray)
 *   - Location on SEPARATE line (light gray)
 *   - Credentials: two-level bullet (bold cert name + indented sub-line with gold ●)
 *   - Skill proficiency dots: filled ● (gold) and empty ○ (light gray)
 *   - Career timeline on Page 1: horizontal gold line with year labels above
 *   - Page 2 header: minimal centered "Page 2 | Role | email | phone" in small gray text
 *   - No footer on any page
 *   - Font sizes: ~10-14pt body (matching sample), not 7-8pt
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
// Matched to sample: ~1 inch margins, both columns white, no sidebar bg
// ---------------------------------------------------------------------------
const PW = 210;
const PH = 297;
const ML = 25;    // ~1 inch left margin (sample)
const MR = 25;    // ~1 inch right margin
const CW = PW - ML - MR; // 160

const SB_W = 52;     // sidebar ~33% of content
const GAP = 8;       // gap between columns (whitespace separator)
const MAIN_W = CW - SB_W - GAP; // 100

const SB_X = ML;                    // 25
const SB_R = ML + SB_W;            // 77
const MAIN_X = ML + SB_W + GAP;    // 85
const MAIN_R = ML + CW;            // 185

// Vertical layout
const HDR_NAME_Y = 38;
const HDR_TITLE_Y = 46;
const HDR_CONTACT_Y = 54;
const HDR_RULE_Y = 58;
const CONTENT_TOP = 64;

// Colors — precisely matched to sample
const CLR = {
  navy: [26, 54, 93] as [number, number, number],       // #1A365D — name, section headers, job titles
  bronze: [184, 134, 11] as [number, number, number],    // #B8860B — bullets, P1 underlines, timeline, skill dots
  body: [51, 51, 51] as [number, number, number],        // #333333 — body text
  midGray: [102, 102, 102] as [number, number, number],  // #666666 — contact line, company names
  lightGray: [136, 136, 136] as [number, number, number],// #888888 — dates, locations, P2 header
  emptyDot: [224, 224, 224] as [number, number, number], // #E0E0E0 — empty skill dots
  p2Rule: [204, 204, 204] as [number, number, number],   // #CCCCCC — P2 section underlines
};

// Font sizes (pt) — simplified consistent set
const FS = {
  name: 20,          // bold navy centered
  title: 11,         // regular navy centered
  contact: 8.5,      // gray centered
  sectionHdr: 11,    // bold uppercase navy (main column)
  sbSectionHdr: 9.5, // bold uppercase navy (sidebar)
  body: 9,           // regular dark gray
  bullet: 8.5,       // for bullet text
  small: 7.5,        // for dates, locations, sub-items
  tiny: 7.5,         // for P2 header, timeline companies
  timelineYear: 8.5, // navy for timeline years
  certBold: 9,       // bold for credential names
  skillName: 9,      // for skill proficiency names
};

// Standard bullet character
const BULLET = "\u2022"; // • (U+2022 BULLET)

// ---------------------------------------------------------------------------
// LOW-LEVEL HELPERS
// ---------------------------------------------------------------------------
function setColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function hLine(doc: jsPDF, y: number, x1: number, x2: number, color?: [number, number, number], w?: number) {
  const c = color || CLR.bronze;
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w || 0.4);
  doc.line(x1, y, x2, y);
}

// ---------------------------------------------------------------------------
// SECTION HEADERS
// ---------------------------------------------------------------------------
function sidebarSectionHeader(doc: jsPDF, title: string, y: number, isPage2: boolean): number {
  doc.setFontSize(FS.sbSectionHdr);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), SB_X, y);
  const ruleY = y + 1.8;
  // Page 1: bronze underline; Page 2: gray underline
  hLine(doc, ruleY, SB_X, SB_R, isPage2 ? CLR.p2Rule : CLR.bronze, 0.3);
  return ruleY + 3;
}

function mainSectionHeader(doc: jsPDF, title: string, y: number, isPage2: boolean): number {
  doc.setFontSize(FS.sectionHdr);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), MAIN_X, y);
  const ruleY = y + 1.8;
  const ruleEnd = MAIN_X + MAIN_W * 0.95;
  // Page 1: bronze underline; Page 2: gray underline
  hLine(doc, ruleY, MAIN_X, ruleEnd, isPage2 ? CLR.p2Rule : CLR.bronze, 0.4);
  return ruleY + 4;
}

// ---------------------------------------------------------------------------
// SIDEBAR SECTION BUILDER
// ---------------------------------------------------------------------------
function buildSidebarSection(doc: jsPDF, section: SidebarSection, startY: number, isPage2: boolean, maxY?: number): number {
  let y = sidebarSectionHeader(doc, section.title, startY, isPage2);

  for (const item of section.items) {
    if (maxY && y > maxY - 5) break;

    if (Array.isArray(item) && typeof item[1] === "number") {
      // Skill proficiency: [skillName, rating] — skill left, dots right
      const [skill, rating] = item as [string, number];
      doc.setFontSize(FS.skillName);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "normal");
      doc.text(skill, SB_X, y, { maxWidth: SB_W - 22 });
      // Draw 5 dots on the right
      const dotX = SB_R - 13;
      for (let i = 0; i < 5; i++) {
        setColor(doc, i < rating ? CLR.bronze : CLR.emptyDot);
        doc.setFontSize(7);
        doc.text(i < rating ? BULLET : "\u25CB", dotX + i * 2.6, y);
      }
      y += 4.5;
    } else if (Array.isArray(item) && typeof item[1] === "string") {
      // Credential: [certName, description] — two-level bullet
      const [name, desc] = item as [string, string];
      // Line 1: Gold bullet + bold cert name
      setColor(doc, CLR.bronze);
      doc.setFontSize(6.5);
      doc.text(BULLET, SB_X, y);
      doc.setFontSize(FS.certBold);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "bold");
      doc.text(name, SB_X + 3, y, { maxWidth: SB_W - 6 });
      y += 4;
      // Line 2: Indented sub-bullet + description
      if (desc) {
        setColor(doc, CLR.bronze);
        doc.setFontSize(6);
        doc.text(BULLET, SB_X + 3, y);
        doc.setFontSize(FS.small);
        setColor(doc, CLR.midGray);
        doc.setFont("helvetica", "normal");
        doc.text(desc, SB_X + 6, y, { maxWidth: SB_W - 10 });
        y += 4;
      }
    } else {
      // Plain string bullet with standard •
      const text = String(item);
      setColor(doc, CLR.bronze);
      doc.setFontSize(6.5);
      doc.text(BULLET, SB_X, y);
      doc.setFontSize(FS.body);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "normal");
      doc.text(text, SB_X + 3, y, { maxWidth: SB_W - 6 });
      y += 4.5;
    }
  }
  return y + 2;
}

// ---------------------------------------------------------------------------
// EXPERIENCE ENTRY BUILDER
// Matches sample: title+date on SAME LINE, company SEPARATE, location SEPARATE
// ---------------------------------------------------------------------------
function buildExperienceEntry(
  doc: jsPDF, e: ExperienceEntry, y: number,
  x: number, xR: number, w: number, maxY?: number
): number {
  // Line 1: Job title (bold navy LEFT) + Date range (gray RIGHT) — SAME LINE
  doc.setFontSize(FS.bullet + 0.5);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text(e.title, x, y, { maxWidth: w - 32 });
  doc.setFontSize(FS.small);
  setColor(doc, CLR.lightGray);
  doc.setFont("helvetica", "normal");
  doc.text(e.dates, xR, y, { align: "right" });
  y += 4.2;

  // Line 2: Company (italic, gray) — SEPARATE LINE
  doc.setFontSize(FS.body);
  setColor(doc, CLR.midGray);
  doc.setFont("helvetica", "italic");
  doc.text(e.company, x, y, { maxWidth: w - 5 });
  y += 3.8;

  // Line 3: Location (regular, light gray) — SEPARATE LINE
  doc.setFontSize(FS.small);
  setColor(doc, CLR.lightGray);
  doc.setFont("helvetica", "normal");
  doc.text(e.location, x, y);
  y += 4;

  // Bullet points — gold ● bullets
  doc.setFont("helvetica", "normal");
  const maxBullets = maxY ? Math.min(e.bullets.length, Math.floor((maxY - y) / 4)) : e.bullets.length;
  for (let i = 0; i < maxBullets; i++) {
    if (maxY && y > maxY - 4) break;
    // Gold bullet
    setColor(doc, CLR.bronze);
    doc.setFontSize(6);
    doc.text(BULLET, x + 1, y);
    // Bullet text
    setColor(doc, CLR.body);
    doc.setFontSize(FS.bullet);
    const bulletLines = doc.splitTextToSize(e.bullets[i], w - 6);
    for (const line of bulletLines) {
      if (maxY && y > maxY - 3) break;
      doc.text(line, x + 4, y);
      y += 3.6;
    }
    y += 0.8;
  }
  return y;
}

// ---------------------------------------------------------------------------
// CV PAGE 1
// ---------------------------------------------------------------------------
function buildCvPage1(doc: jsPDF, cv: CvData): void {
  // === HEADER (centered, all white bg — no banner) ===
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

  // Bronze rule below header
  hLine(doc, HDR_RULE_Y, ML, ML + CW, CLR.bronze, 0.6);

  // === NO sidebar background — both columns white ===

  // === SIDEBAR CONTENT (Page 1) ===
  let sbY = CONTENT_TOP + 2;
  for (const section of cv.sidebarPage1) {
    sbY = buildSidebarSection(doc, section, sbY, false, PH - 12);
  }

  // === MAIN CONTENT ===
  let mainY = CONTENT_TOP + 2;
  const pageBottom = PH - 12;

  // Professional Summary
  mainY = mainSectionHeader(doc, "Professional Summary", mainY, false);
  doc.setFontSize(FS.body);
  setColor(doc, CLR.body);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(cv.summary, MAIN_W);
  for (const line of summaryLines) {
    if (mainY > pageBottom - 5) break;
    doc.text(line, MAIN_X, mainY);
    mainY += 3.8;
  }
  mainY += 3;

  // Career Timeline — horizontal gold line with year labels above
  mainY = mainSectionHeader(doc, "Career Timeline", mainY, false);
  const years = ["2008", "2014", "2015", "2017", "2018", "2020", "2024"];
  const companies = ["Etisalat/PTCL", "Independent", "Guardian ICS", "DQS-Pak", "Mace", "Power Intl.", "Michael Kors"];
  const colW = (MAIN_W - 6) / 7;
  // Years ABOVE the line (navy bold)
  doc.setFontSize(FS.timelineYear);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  for (let i = 0; i < years.length; i++) {
    doc.text(years[i], MAIN_X + 3 + colW * i + colW / 2, mainY, { align: "center" });
  }
  mainY += 3;
  // Gold horizontal line
  hLine(doc, mainY, MAIN_X, MAIN_X + MAIN_W * 0.95, CLR.bronze, 0.35);
  mainY += 3;
  // Company names BELOW the line
  doc.setFontSize(FS.tiny);
  setColor(doc, CLR.body);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < companies.length; i++) {
    doc.text(companies[i], MAIN_X + 3 + colW * i + colW / 2, mainY, { align: "center" });
  }
  mainY += 5;

  // Professional Experience (page 1 entries)
  mainY = mainSectionHeader(doc, "Professional Experience", mainY, false);
  for (const entry of cv.experiencePage1) {
    if (mainY > pageBottom - 14) break;
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W, pageBottom);
    mainY += 2.5;
  }
}

// ---------------------------------------------------------------------------
// CV PAGE 2
// ---------------------------------------------------------------------------
function buildCvPage2(doc: jsPDF, cv: CvData): void {
  // Page 2 header — minimal centered text in light gray (not bold navy)
  doc.setFontSize(FS.tiny);
  setColor(doc, CLR.lightGray);
  doc.setFont("helvetica", "normal");
  const p2Header = `Page 2  |  ${cv.roleShort}  |  ${CANDIDATE.email}  |  ${CANDIDATE.phone}`;
  doc.text(p2Header, PW / 2, 12, { align: "center" });

  hLine(doc, 16, ML, ML + CW, CLR.p2Rule, 0.3);

  const p2Top = 22;
  const pageBottom = PH - 12;

  // === NO sidebar background — both columns white ===

  // Sidebar content (Page 2)
  let sbY = p2Top + 2;
  for (const section of cv.sidebarPage2) {
    sbY = buildSidebarSection(doc, section, sbY, true, pageBottom);
  }

  // Main content (Page 2): experience entries continued
  let mainY = p2Top + 2;
  for (const entry of cv.experiencePage2) {
    if (mainY > pageBottom - 14) break;
    mainY = buildExperienceEntry(doc, entry, mainY, MAIN_X, MAIN_R, MAIN_W, pageBottom);
    mainY += 2.5;
  }

  // Earlier Career Summary
  if (cv.earlierCareer.length > 0 && mainY < pageBottom - 18) {
    mainY = mainSectionHeader(doc, "Earlier Career Summary", mainY, true);
    for (const e of cv.earlierCareer) {
      if (mainY > pageBottom - 10) break;
      // Gold bullet + company, place, dates
      setColor(doc, CLR.bronze);
      doc.setFontSize(6);
      doc.text(BULLET, MAIN_X, mainY);
      doc.setFontSize(FS.bullet);
      setColor(doc, CLR.body);
      doc.setFont("helvetica", "bold");
      const hdr = `${e.company}, `;
      doc.text(hdr, MAIN_X + 3, mainY);
      const hdrW = doc.getTextWidth(hdr);
      doc.setFont("helvetica", "italic");
      doc.text(e.place, MAIN_X + 3 + hdrW, mainY);
      const placeW = doc.getTextWidth(e.place);
      doc.setFontSize(FS.small);
      setColor(doc, CLR.lightGray);
      doc.setFont("helvetica", "normal");
      doc.text(`  |  ${e.dates}`, MAIN_X + 3 + hdrW + placeW, mainY);
      mainY += 4;
      // One-liner
      doc.setFontSize(FS.bullet);
      setColor(doc, CLR.midGray);
      doc.setFont("helvetica", "normal");
      doc.text(e.oneLiner, MAIN_X + 5, mainY, { maxWidth: MAIN_W - 8 });
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
  extraKeywords?: string[],
  coverLetterText?: string
): Buffer {
  const doc = new jsPDF({ compress: true, unit: "mm", format: "a4" });

  const left = 25;
  const right = PW - 25;
  const textW = right - left;
  const companyName = (company && company !== "Unknown" && company !== "Not specified") ? company : "";

  // === HEADER (matching CV style) ===
  doc.setFontSize(16);
  setColor(doc, CLR.navy);
  doc.setFont("helvetica", "bold");
  doc.text("MUHAMMAD ALI BHATTI", PW / 2, 30, { align: "center" });

  doc.setFontSize(8);
  setColor(doc, CLR.midGray);
  doc.setFont("helvetica", "normal");
  doc.text("Lahore, Pakistan  |  +92 332 4862219  |  marketbrain@gmail.com  |  Open to International Relocation", PW / 2, 37, { align: "center" });

  hLine(doc, 42, left, right, CLR.navy, 0.6);

  let y = 54;

  // Date
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric"
  });
  doc.setFontSize(10);
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
  doc.setFontSize(10);
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
  const writePara = (text: string, spacing = 4.5) => {
    const lines = doc.splitTextToSize(text, textW);
    for (const line of lines) {
      doc.text(line, left, y);
      y += spacing;
    }
    y += 3;
  };

  // --- BODY PARAGRAPHS ---
  setColor(doc, CLR.body);
  doc.setFontSize(10);

  if (coverLetterText) {
    // Use custom cover letter text: split by double-newline into paragraphs
    const paras = coverLetterText.split(/\n\n+/).filter(p => p.trim());
    for (const para of paras) {
      writePara(para.trim());
    }
  } else {
    // --- PARAGRAPH 1: Opening ---
    const p1 = `I am writing to express my strong interest in the ${jobTitle} position${companyName ? ` at ${companyName}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial acumen, I am confident that my background aligns closely with the requirements of this opportunity.`;
    writePara(p1);

    // --- PARAGRAPH 2: Core expertise ---
    const p2 = `Throughout my career as a ${cv.roleShort}, I have consistently delivered outcomes that matter. My work has paired technical rigor with the ability to build trust across industries, cultures, and senior stakeholders, translating complex requirements into practical systems that hold up to scrutiny while genuinely improving business performance.`;
    writePara(p2);

    // --- PARAGRAPH 3: Role-specific alignment ---
    const kw = extraKeywords && extraKeywords.length > 0 ? extraKeywords.slice(0, 4).join(", ") : "";
    const p3 = kw
      ? `What draws me specifically to this opportunity is the chance to bring my expertise in ${kw} to your team${companyName ? `, and to contribute to ${companyName}'s continued growth and success` : ""}. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`
      : `What draws me to this opportunity is the alignment between my career achievements and the demands of this role. I am equally comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;
    writePara(p3);

    // --- CLOSING ---
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