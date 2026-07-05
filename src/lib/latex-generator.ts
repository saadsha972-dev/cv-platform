/**
 * LaTeX CV Generator
 * ==================
 * Generates a tailored LaTeX .tex document from CvData.
 * Compiles to PDF using Tectonic.
 *
 * This is a TypeScript port of /home/z/my-project/scripts/generate_cvs.py
 */

import { spawnSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { CANDIDATE, CvData, SidebarSection, ExperienceEntry, EarlierCareerEntry } from "./cv-data";

// ---------------------------------------------------------------------------
// PATHS
// ---------------------------------------------------------------------------
const TEX_OUT_DIR = join(homedir(), ".cv-platform", "tex_out");
const PDF_OUT_DIR = join(homedir(), ".cv-platform", "pdfs");

for (const d of [TEX_OUT_DIR, PDF_OUT_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

// ---------------------------------------------------------------------------
// LATEX PREAMBLE (matches the working template from generate_cvs.py)
// ---------------------------------------------------------------------------
const PREAMBLE = `\\documentclass[10pt,a4paper]{article}

% ── Encoding & fonts ──
\\usepackage{fontspec}
\\setmainfont{Carlito}
\\setsansfont{Carlito}

% ── Page layout ──
\\usepackage[a4paper,margin=1.3cm,top=1.0cm,bottom=1.0cm]{geometry}
\\usepackage{xcolor}
% Exact colors sampled from original Sales Management CV template
\\definecolor{accent}{HTML}{1b365d}
\\definecolor{sechdr}{HTML}{2d3748}
\\definecolor{bronze}{HTML}{8c7853}
\\definecolor{darkgray}{HTML}{333333}
\\definecolor{midgray}{HTML}{606774}
\\definecolor{lightgray}{HTML}{989ca5}
\\definecolor{lightrule}{HTML}{cbd5e0}

% ── Lists, spacing, rules ──
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=*,label={\\textcolor{bronze}{\\textbullet}},itemsep=1.5pt,topsep=1.5pt,parsep=0pt}
\\usepackage{titlesec}
\\usepackage{microtype}
\\usepackage{ragged2e}
\\usepackage{amssymb}
\\usepackage{array}
\\usepackage{colortbl}

% ── Page style: page 1 empty, page 2+ has running header ──
\\usepackage{fancyhdr}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\fancyhead[C]{%
  \\parbox{\\linewidth}{\\centering%
    \\textcolor{accent}{\\textbf{\\small MUHAMMAD ALI BHATTI}}\\\\[2pt]
    \\textcolor{midgray}{\\footnotesize Page \\thepage\\ | __ROLE_SHORT__ | __EMAIL__ | __PHONE__}%
  }%
}

% ── Paragraph defaults ──
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{2pt}
\\linespread{1.05}
\\color{sechdr}

% ── PDF metadata ──
\\usepackage{hyperref}
\\hypersetup{
  pdftitle={CV - Muhammad Ali Bhatti - __ROLE_TITLE__},
  pdfauthor={Muhammad Ali Bhatti},
  pdfsubject={Curriculum Vitae},
  pdfcreator={Z.ai},
  pdfkeywords={CV, Resume, __ROLE_TITLE__},
  colorlinks=false,
  pdfborder={0 0 0}
}

% ── Section header helper macros ──
\\newcommand{\\sidebarhdr}[1]{%
  \\vspace{2pt}%
  {\\color{accent}\\bfseries\\fontsize{10.5pt}{12pt}\\selectfont\\MakeUppercase{#1}}\\\\[-3pt]%
  {\\color{lightrule}\\rule{\\linewidth}{0.6pt}}\\\\[2pt]%
}
\\newcommand{\\mainhdr}[1]{%
  \\vspace{4pt}%
  {\\color{accent}\\bfseries\\fontsize{11pt}{13pt}\\selectfont\\MakeUppercase{#1}}\\\\[-3pt]%
  {\\color{bronze}\\rule{\\linewidth}{0.6pt}}\\\\[3pt]%
}
\\newcommand{\\subhdr}[1]{%
  \\vspace{3pt}%
  {\\color{accent}\\bfseries\\fontsize{9.5pt}{11pt}\\selectfont #1}\\\\[1pt]%
}

% ── Experience entry macros ──
\\newcommand{\\exprule}{\\vspace{4pt}\\hrule\\vspace{4pt}}
\\newcommand{\\expry}[5]{%
  \\vspace{2pt}%
  \\noindent\\textbf{#1}\\hfill\\textcolor{midgray}{\\small #4}\\\\[0pt]
  \\noindent\\textit{\\small #2}\\hfill\\textit{\\textcolor{midgray}{\\small #3}}\\\\[1pt]
  \\begin{itemize}[leftmargin=10pt,itemsep=1pt,topsep=1pt]
  #5
  \\end{itemize}\\vspace{4pt}%
}
\\newcommand{\\exprypage}[5]{%
  \\vspace{12pt}%
  \\noindent\\textbf{#1}\\hfill\\textcolor{midgray}{\\small #4}\\\\[0pt]
  \\noindent\\textit{\\small #2}\\hfill\\textit{\\textcolor{midgray}{\\small #3}}\\\\[1pt]
  \\begin{itemize}[leftmargin=10pt,itemsep=2pt,topsep=2pt]
  #5
  \\end{itemize}\\vspace{8pt}%
}

\\begin{document}
\\thispagestyle{empty}
`;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const esc = (s: string): string =>
  s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");

const buildHeader = (roleTitle: string): string =>
  `\\noindent
\\begin{center}
{\\color{accent}\\bfseries\\fontsize{24pt}{28pt}\\selectfont ${esc(CANDIDATE.name)}}\\\\[2pt]
{\\color{darkgray}\\fontsize{12pt}{14pt}\\selectfont ${esc(roleTitle)}}\\\\[3pt]
{\\color{midgray}\\small ${esc(CANDIDATE.contact)}}
\\end{center}
\\vspace{4pt}
{\\color{bronze}\\rule{\\linewidth}{1.0pt}}
\\vspace{6pt}
`;

const buildSidebarSection = (section: SidebarSection): string => {
  const lines: string[] = [`\\sidebarhdr{${esc(section.title)}}`];

  if (section.title === "SKILL PROFICIENCY") {
    lines.push("\\vspace{2pt}");
    for (const item of section.items) {
      const [skill, rating] = item as [string, number];
      const dots: string[] = [];
      for (let i = 0; i < 5; i++) {
        dots.push(i < rating ? "\\textcolor{bronze}{\\large $\\bullet$}" : "\\textcolor{lightrule}{\\large $\\circ$}");
      }
      lines.push(`\\noindent\\fontsize{9pt}{11pt}\\selectfont ${esc(skill)} \\hfill ${dots.join(" ")}\\\\[-1pt]`);
      lines.push("\\vspace{3pt}");
    }
    lines.push("\\vspace{4pt}");
    return lines.join("\n");
  }

  lines.push("\\begin{itemize}[leftmargin=10pt,itemsep=1.5pt,topsep=1.5pt]");
  for (const item of section.items) {
    if (Array.isArray(item)) {
      const [main, sub] = item as [string, string];
      lines.push(`  \\item \\textbf{${esc(main)}}`);
      if (sub) {
        lines.push("  \\begin{itemize}[leftmargin=10pt,itemsep=0pt,topsep=0pt]");
        lines.push(`    \\item {\\footnotesize ${esc(sub)}}`);
        lines.push("  \\end{itemize}");
      }
    } else {
      lines.push(`  \\item ${esc(item as string)}`);
    }
  }
  lines.push("\\end{itemize}");
  lines.push("\\vspace{6pt}");
  return lines.join("\n");
};

const buildSummary = (text: string): string =>
  `\\mainhdr{PROFESSIONAL SUMMARY}\n{\\fontsize{10pt}{12.5pt}\\selectfont ${esc(text)}}\\vspace{4pt}\n`;

const buildCareerTimeline = (): string => {
  const timeline = [
    ["2008", "Etisalat/PTCL"],
    ["2014", "Independent"],
    ["2015", "Guardian ICS"],
    ["2017", "DQS-Pakistan"],
    ["2018", "Mace"],
    ["2020", "Power Intl."],
    ["2024", "Michael Kors"],
  ];
  const colSpec = (">{\\centering\\arraybackslash}p{0.135\\linewidth}").repeat(7);
  const out: string[] = ["\\mainhdr{CAREER TIMELINE}", "\\vspace{2pt}", "\\noindent", "\\renewcommand{\\arraystretch}{1.3}", "\\setlength{\\tabcolsep}{4pt}", `\\begin{tabular}{${colSpec}}`];
  out.push(timeline.map(([y]) => `{\\color{accent}\\bfseries\\fontsize{10.5pt}{12pt}\\selectfont ${y}}`).join(" & ") + " \\\\[2pt]");
  out.push("\\arrayrulecolor{bronze}", "\\hline", "\\arrayrulecolor{black}");
  out.push(timeline.map(([, c]) => `{\\color{sechdr}\\fontsize{8.5pt}{10.5pt}\\selectfont ${esc(c)}}`).join(" & ") + " \\\\");
  out.push("\\end{tabular}", "\\vspace{6pt}");
  return out.join("\n");
};

const buildExperienceBlock = (entries: ExperienceEntry[]): string => {
  const out: string[] = ["\\mainhdr{PROFESSIONAL EXPERIENCE}"];
  for (const e of entries) {
    const items = e.bullets.map((b) => `    \\item ${esc(b)}`).join("\n");
    out.push(`\\expry{${esc(e.title)}}{${esc(e.company)}}{${esc(e.location)}}{${esc(e.dates)}}{${items}}`);
  }
  return out.join("\n");
};

const buildExperienceContinued = (entries: ExperienceEntry[]): string => {
  const out: string[] = [];
  for (const e of entries) {
    const items = e.bullets.map((b) => `    \\item ${esc(b)}`).join("\n");
    out.push(`\\exprypage{${esc(e.title)}}{${esc(e.company)}}{${esc(e.location)}}{${esc(e.dates)}}{${items}}`);
  }
  return out.join("\n");
};

const buildEarlierCareer = (entries: EarlierCareerEntry[]): string => {
  if (!entries.length) return "";
  const out: string[] = ["\\vspace{8pt}", "\\mainhdr{EARLIER CAREER SUMMARY}", "\\begin{itemize}[leftmargin=12pt,itemsep=5pt,topsep=3pt,label={\\textcolor{bronze}{\\textbullet}}]"];
  for (const e of entries) {
    out.push(
      `  \\item \\textbf{${esc(e.company)}}, \\textit{${esc(e.place)}} \\textcolor{midgray}{| ${esc(e.dates)}} \\\\[-2pt]\\hspace{6pt}{\\fontsize{9pt}{11pt}\\selectfont ${esc(e.oneLiner)}}`
    );
  }
  out.push("\\end{itemize}", "\\vspace{4pt}");
  return out.join("\n");
};

// ---------------------------------------------------------------------------
// COVER LETTER BUILDER
// ---------------------------------------------------------------------------
const buildCoverLetter = (cv: CvData, jobTitle: string, company?: string, extraKeywords?: string[]): string => {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const para1 = `I am writing to express my strong interest in the ${jobTitle} position${company ? ` at ${company}` : ""}. With over 20 years of progressive international experience across Germany, the GCC, the UK, and Pakistan, and a proven track record of delivering measurable results in roles demanding both technical command and commercial instinct, I am confident that my background aligns closely with the requirements of this opportunity.`;
  const para2 = `As a ${cv.roleShort}, I have built a career on the kind of outcomes your role demands: ${cv.summary.split(".").slice(1, 3).join(". ").trim()}. My work has consistently paired technical rigor with the ability to win trust across industries, cultures, and senior stakeholders — translating complex requirements into practical systems that hold up to scrutiny while genuinely improving business performance.`;
  const para3 = `What draws me specifically to this opportunity is the chance to bring ${extraKeywords && extraKeywords.length > 0 ? `my expertise in ${extraKeywords.slice(0, 3).join(", ")}${extraKeywords.length > 3 ? ", and related areas" : ""}` : "my cross-border experience and audit-grade rigor"} to your team, and to contribute to ${company ? `${esc(company)}'s` : "your organization's"} continued growth. I am comfortable leading from the front in the field or advising from the boardroom, and I am open to international relocation should the role require it.`;
  const para4 = `I would welcome the opportunity to discuss how my experience can contribute to your team's continued success. Thank you for considering my application; I look forward to the possibility of speaking with you further.`;

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage{fontspec}
\\setmainfont{Carlito}
\\usepackage[a4paper,margin=2.2cm,top=2.0cm,bottom=2.0cm]{geometry}
\\usepackage{xcolor}
\\definecolor{accent}{HTML}{1b365d}
\\definecolor{sechdr}{HTML}{2d3748}
\\definecolor{bronze}{HTML}{8c7853}
\\definecolor{midgray}{HTML}{606774}
\\usepackage{parskip}
\\setlength{\\parskip}{8pt}
\\color{sechdr}

\\begin{document}
\\begin{center}
{\\color{accent}\\bfseries\\fontsize{16pt}{20pt}\\selectfont MUHAMMAD ALI BHATTI}\\\\[2pt]
{\\color{midgray}\\small ${esc(CANDIDATE.contact)}}
\\end{center}
\\vspace{4pt}
{\\color{bronze}\\rule{\\linewidth}{0.8pt}}
\\vspace{12pt}

\\noindent ${date}

\\vspace{8pt}
\\noindent ${company ? "To the Hiring Manager\\\\\n" + esc(company) : "To the Hiring Committee"}

\\vspace{12pt}
\\noindent \\textbf{Re: Application for ${esc(jobTitle)}${company ? " at " + esc(company) : ""}}

\\vspace{8pt}
\\noindent Dear Hiring Manager,

\\vspace{4pt}
\\noindent ${para1}

\\noindent ${para2}

\\noindent ${para3}

\\noindent ${para4}

\\vspace{12pt}
\\noindent Yours sincerely,

\\vspace{20pt}
\\noindent \\textbf{Muhammad Ali Bhatti}
\\end{document}
`;
};

// ---------------------------------------------------------------------------
// ASSEMBLE CV .TEX
// ---------------------------------------------------------------------------
const assembleCvTex = (cv: CvData): string => {
  const preamble = PREAMBLE
    .replace(/__ROLE_SHORT__/g, cv.roleShort)
    .replace(/__ROLE_TITLE__/g, cv.roleTitle)
    .replace(/__EMAIL__/g, CANDIDATE.email)
    .replace(/__PHONE__/g, CANDIDATE.phone);

  const sbP1 = cv.sidebarPage1.map(buildSidebarSection).join("\n\n");
  const sbP2 = cv.sidebarPage2.map(buildSidebarSection).join("\n\n");
  const summaryBlock = buildSummary(cv.summary);
  const timelineBlock = buildCareerTimeline();
  const expP1 = buildExperienceBlock(cv.experiencePage1);
  const expP2 = buildExperienceContinued(cv.experiencePage2);
  const earlierCareer = buildEarlierCareer(cv.earlierCareer);

  const SHIFT_DOWN = "\\vspace{15pt}\n";
  const NAME_SHIFT = "\\vspace*{65pt}\n";

  return (
    preamble + "\n" +
    NAME_SHIFT +
    buildHeader(cv.roleTitle) + "\n" +
    SHIFT_DOWN +
    "\\noindent\n" +
    "\\begin{minipage}[t]{0.31\\textwidth}\n" + sbP1 + "\n\\end{minipage}%\n\\hfill\n" +
    "\\begin{minipage}[t]{0.66\\textwidth}\n" + summaryBlock + "\n\n" + timelineBlock + "\n\n" + expP1 + "\n\\end{minipage}\n\n" +
    "\\newpage\n\\thispagestyle{fancy}\n" +
    SHIFT_DOWN +
    "\\noindent\n" +
    "\\begin{minipage}[t]{0.31\\textwidth}\n" + sbP2 + "\n\\end{minipage}%\n\\hfill\n" +
    "\\begin{minipage}[t]{0.66\\textwidth}\n" + expP2 + "\n\n" + earlierCareer + "\n\\end{minipage}\n\n" +
    "\\end{document}\n"
  );
};

// ---------------------------------------------------------------------------
// COMPILE WITH TECTONIC
// ---------------------------------------------------------------------------
const compileTex = (texPath: string, outputDir: string): { pdfPath: string; success: boolean; error?: string } => {
  const result = spawnSync("tectonic", ["-X", "compile", texPath, "-o", outputDir, "--keep-logs"], {
    captureOutput: true,
    text: true,
    timeout: 120000,
  });

  if (result.status !== 0) {
    return { pdfPath: "", success: false, error: result.stderr || result.stdout || "Unknown tectonic error" };
  }

  const basename = texPath.replace(/\.tex$/, "");
  const pdfPath = `${basename}.pdf`;
  if (!existsSync(pdfPath)) {
    return { pdfPath: "", success: false, error: "PDF not generated after compile" };
  }

  return { pdfPath, success: true };
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

/**
 * Generate a tailored CV + cover letter PDF from CvData.
 * Optionally takes a jobTitle/company for the cover letter.
 */
export const generateCvPdfs = async (
  cv: CvData,
  options?: { jobTitle?: string; company?: string; extraKeywords?: string[]; idPrefix?: string }
): Promise<GenerateCvResult> => {
  const id = options?.idPrefix || `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cvTexPath = join(TEX_OUT_DIR, `${id}_cv.tex`);
  const clTexPath = join(TEX_OUT_DIR, `${id}_cover.tex`);

  // Build .tex contents
  const cvTexContent = assembleCvTex(cv);
  const coverLetterTexContent = buildCoverLetter(
    cv,
    options?.jobTitle || cv.roleTitle,
    options?.company,
    options?.extraKeywords
  );

  // Write .tex files
  writeFileSync(cvTexPath, cvTexContent, "utf-8");
  writeFileSync(clTexPath, coverLetterTexContent, "utf-8");

  // Compile CV
  const cvResult = compileTex(cvTexPath, TEX_OUT_DIR);
  if (!cvResult.success) {
    throw new Error(`CV compilation failed: ${cvResult.error}`);
  }

  // Compile Cover Letter
  const clResult = compileTex(clTexPath, TEX_OUT_DIR);
  if (!clResult.success) {
    throw new Error(`Cover letter compilation failed: ${clResult.error}`);
  }

  return {
    cvPdfPath: cvResult.pdfPath,
    coverLetterPdfPath: clResult.pdfPath,
    cvTexContent,
    coverLetterTexContent,
  };
};

/**
 * Read a PDF file as base64 (for sending via API response).
 */
export const readPdfAsBase64 = (pdfPath: string): string => {
  const buf = readFileSync(pdfPath);
  return buf.toString("base64");
};
