/**
 * Master CV data for Muhammad Ali Bhatti
 * Ported from /home/z/my-project/scripts/cv_data.py
 * Used by the LaTeX generator to produce tailored CVs.
 */

export const CANDIDATE = {
  name: "MUHAMMAD ALI BHATTI",
  contact: "Lahore, Pakistan | +92 332 4862219 | marketbrain@gmail.com | Open to International Relocation",
  email: "marketbrain@gmail.com",
  phone: "+92 332 4862219",
};

export const EDUCATION = [
  ["MSc in International Marketing Management", "University of East London, United Kingdom (2004 – 2005)"],
] as const;

export const ADDITIONAL_INFO = [
  "Driving Licenses: Qatar, UK, UAE, Pakistan",
  "Global Mobility: Ready to relocate to regional hubs (GCC, Europe, Asia)",
  "Tools: SAP ERP/POS, MS Visio, CRM Systems, Audit Management Software",
];

export const LANGUAGES = [
  "English — Advanced (C1)",
  "German — Elementary (A2)",
  "Urdu — Native / Bilingual",
];

export const TIMELINE = [
  { title: "Stock Manager", company: "Michael Kors (Capri Holdings Group)", location: "Ingolstadt, Germany", dates: "Oct 2024 – Jun 2025" },
  { title: "Process Improvement Specialist / QHSE Lead", company: "Power International Holding (Elegancia Services)", location: "Doha, Qatar", dates: "Dec 2020 – Nov 2023" },
  { title: "HSE Manager", company: "Mace", location: "Doha, Qatar", dates: "Apr 2018 – Dec 2020" },
  { title: "Operations Manager", company: "DQS-Pakistan (DQS Germany Partner)", location: "Lahore, Pakistan", dates: "Jun 2017 – Apr 2018" },
  { title: "Auditor", company: "Guardian Independent Certification Services", location: "Abu Dhabi, UAE", dates: "Feb 2015 – May 2017" },
  { title: "Independent QHSE Consultant & Trainer", company: "Self-Employed", location: "Lahore, Pakistan", dates: "Jan 2014 – Jan 2015" },
  { title: "Manager, Quality Assurance", company: "Etisalat / PTCL", location: "Lahore, Pakistan", dates: "May 2008 – Dec 2013" },
] as const;

export interface SidebarSection {
  title: string;
  items: Array<string | [string, string] | [string, number]>;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
  /** If true, this entry's bullets should NOT be tailored — keep original. */
  lockTailoring?: boolean;
}

export interface EarlierCareerEntry {
  company: string;
  place: string;
  dates: string;
  oneLiner: string;
}

export interface CvData {
  slug: string;
  roleTitle: string;
  roleShort: string;
  summary: string;
  sidebarPage1: SidebarSection[];
  sidebarPage2: SidebarSection[];
  experiencePage1: ExperienceEntry[];
  experiencePage2: ExperienceEntry[];
  earlierCareer: EarlierCareerEntry[];
}

// Reusable earlier career entries (role-specific one-liners per CV)
const EARLIER_CAREER_BASE = [
  { company: "Astors Hotel", place: "London, UK", dates: "2006 – 2007" },
  { company: "Npower", place: "Essex, UK", dates: "2005" },
  { company: "Allied International Ltd", place: "Essex, UK", dates: "2002 – 2005" },
];

const makeEarlierCareer = (oneLiners: [string, string, string]): EarlierCareerEntry[] => [
  { ...EARLIER_CAREER_BASE[0], oneLiner: oneLiners[0] },
  { ...EARLIER_CAREER_BASE[1], oneLiner: oneLiners[1] },
  { ...EARLIER_CAREER_BASE[2], oneLiner: oneLiners[2] },
];

export const CV_VARIANTS: CvData[] = [
  // CV 1 — QMS Lead Auditor
  {
    slug: "QMS_Lead_Auditor",
    roleTitle: "QMS Lead Auditor & Commercial Operations Specialist",
    roleShort: "QMS Lead Auditor",
    summary:
      "Highly versatile and impact-driven senior business professional with over 20 years of progressive international experience spanning Quality, Health, Safety, Environment (QHSE), ISO Lead Auditing, and Corporate Enterprise Sales across Germany, the GCC, and Pakistan. Demonstrated success in designing and auditing Integrated Management Systems (IMS) against ISO 9001, 14001, 45001, and 22301, while simultaneously driving multi-million dollar sales pipelines in telecom, retail, and corporate sectors. Exceptional communicator and leader skilled at aligning complex compliance frameworks with strategic commercial growth.",
    sidebarPage1: [
      { title: "CORE COMPETENCIES", items: ["ISO 9001:2015 QMS", "ISO 14001:2015 EMS", "ISO 45001:2018 OHS", "ISO 22301 BCMS", "Lead Auditing (IRCA)", "Enterprise ICT Sales", "Business Development", "Risk Assessment (HIRA)", "CAPA & RCA Tracking", "Supply Chain & FIFO"] },
      { title: "CERTIFICATIONS", items: [["CQI-IRCA Lead Auditor", "QMS / EMS / OHSAS"], ["NEBOSH IGC", "International General Certificate"], ["ASQ CMQ/OE", "Certified Manager of Quality"], ["Train the Trainer", "DQS-UL Germany"]] },
      { title: "LANGUAGES", items: [...LANGUAGES] },
    ],
    sidebarPage2: [
      { title: "OTHER CERTIFICATIONS", items: [["Training Delivery", "Highfield Level 3 (UK)"], ["Process Improvement", "Lean Six Sigma Foundations"], ["Business Metrics", "KPI Essentials Certification"], ["First Aid & CPR", "Basic Life Support"]] },
      { title: "EDUCATION", items: [...EDUCATION] as [string, string][] },
      { title: "ADDITIONAL INFO", items: [...ADDITIONAL_INFO] },
      { title: "SKILL PROFICIENCY", items: [["ISO 9001 / 14001 / 45001", 5], ["Lead Auditing (Third-Party)", 5], ["HIRA & Risk Management", 4], ["RCA & CAPA Governance", 5], ["QHSE KPI & Board Reporting", 4], ["Stakeholder Management", 5]] },
    ],
    experiencePage1: [
      { ...TIMELINE[0], bullets: ["Governed multi-site retail inventory control and process-compliance audits using SAP ERP/POS, achieving 100% stock accuracy and minimizing structural shrinkage.", "Led internal operational and safety audits ensuring strict adherence to European corporate governance standards and loss prevention metrics."] },
      { ...TIMELINE[1], bullets: ["Spearheaded Integrated Management System (IMS) internal compliance audits across group entities, aligning Urbacon, Baladna, and Elegancia with ISO 9001, 14001, and 45001.", "Conducted exhaustive Hazard Identification and Risk Assessments (HIRA) and managed end-to-end CAPA tracking, resolving 100% of high-priority non-conformities."] },
      { ...TIMELINE[2], bullets: ["Managed HSE project execution complying with Qatar Construction Standards (QCS 2014) and client demands, achieving exceptional Zero-Accident milestones.", "Designed and integrated a comprehensive Project Logistics and Safety Management Plan, training 1,000+ onsite personnel to minimize HSE risks."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Directed third-party ISO 9001/14001/45001 audit planning and certification issuance in coordination with DQS Germany headquarters.", "Structured complex multi-site audit schedules and established new corporate accounts, capturing market share from Tier-1 compliance competitors (BSI, Bureau Veritas)."] },
      { ...TIMELINE[4], bullets: ["Delivered 300+ man-days of third-party certification and recertification audits against ISO 9001, ISO 14001, and OHSAS 18001 standards across the GCC and Russian regions.", "Performed meticulous administrative and technical file reviews for downstream oil and gas networks as lead technical review officer."] },
      { ...TIMELINE[5], bullets: ["Designed and deployed comprehensive QMS, EMS, and OHS frameworks for 45+ manufacturers spanning sports, chemical, and textile engineering sectors.", "Advised 100+ organizations on business continuity planning and accident prevention, delivering custom OHS management plans and emergency evacuation protocols."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Managed high-value B2B relationships delivering tailored ICT and enterprise network architectures, recognized regionally for achieving a record PKR 154 Million corporate sales contract.", "Conducted rigorous quality and supplier safety audits at vendor sites, governing overall supply chain risk across an approved vendor pool of 730+ active entities."] },
    ],
    earlierCareer: makeEarlierCareer([
      "Sales Manager — cultivated corporate contracts and banquet accounts worth over £1.2 Million, demonstrating early commercial leadership.",
      "Corporate Sales Team Leader — coached a team of 6 corporate sales advisors on performance metrics and pipeline conversion, building foundational team-management skills.",
      "Assistant Manager, Supply Chain — managed raw material procurement, 3PL inventory logistics, and strict FIFO execution rules — early exposure to QA-driven supply chain controls.",
    ]),
  },
  // CV 2 — QHSE Manager
  {
    slug: "QHSE_Manager",
    roleTitle: "Senior QHSE Manager & Lead Safety Specialist",
    roleShort: "QHSE Manager",
    summary:
      "Distinguished, certified Quality, Health, Safety, and Environment (QHSE) executive with over 20 years of international expertise designing, executing, and auditing multi-sector environmental and safety programs in Germany, Qatar, UAE, and Pakistan. Highly accomplished in delivering Zero-Accident milestones on multi-million dollar infrastructure and construction projects while driving absolute compliance with international standards (ISO 14001, ISO 45001) and municipal regulations (QCS 2014). Proven track record leading comprehensive hazard identification (HIRA), incident root cause analyses, and robust emergency safety training programs.",
    sidebarPage1: [
      { title: "SAFETY SKILLS", items: ["Hazard ID & Risk (HIRA)", "Incident Investigation", "QCS 2014 Compliance", "HSE Plans & Manuals", "Integrated Management Systems", "Environmental Control", "Supplier Site Safety", "Site Evacuation Plans", "Root Cause Analysis (RCA)", "Safety Training Programs"] },
      { title: "KEY CREDENTIALS", items: [["NEBOSH IGC", "International General Certificate"], ["ISO 45001 Lead Auditor", "CQI-IRCA Certified"], ["ISO 14001 Lead Auditor", "Environmental Systems"], ["First Aid & CPR", "Gulf Training Centre"]] },
      { title: "LANGUAGES", items: [...LANGUAGES] },
    ],
    sidebarPage2: [
      { title: "OTHER CERTIFICATIONS", items: [["ISO 9001 QMS Auditor", "Lead Auditor Certification"], ["Train the Trainer", "DQS-UL Germany"], ["Training Delivery", "Highfield Level 3 (UK)"], ["Lean Six Sigma", "Process Foundations"]] },
      { title: "EDUCATION", items: [...EDUCATION] as [string, string][] },
      { title: "HSE RECOGNITIONS", items: ["Certified multiple projects to ISO 14001 & 45001", "Trained 1,000+ onsite personnel on safety compliance", "Recognized for Zero-LTI safety leadership on complex sites", "Delivered Zero-Accident milestones across multi-site projects"] },
      { title: "SKILL PROFICIENCY", items: [["HIRA & Risk Management", 5], ["Incident Investigation", 5], ["QCS 2014 Compliance", 5], ["ISO 45001 / 14001 Lead Audit", 5], ["Safety Training Programs", 4], ["Emergency Response Planning", 5]] },
    ],
    experiencePage1: [
      { ...TIMELINE[0], bullets: ["Supervised back-of-house operations, ensuring retail workspace security, emergency egress pathway compliance, and strict adherence to European safety and labor guidelines.", "Performed process-compliance and internal structural safety audits using computerized management systems to mitigate operational risks."] },
      { ...TIMELINE[1], bullets: ["Directed system implementation and hazard compliance tracking across hospitality, medical facilities, civil construction, and catering operations (Elegancia Services).", "Monitored and analyzed group QHSE performance KPIs, translating complex hazard registers into strategic action plans presented directly to the corporate board."] },
      { ...TIMELINE[2], bullets: ["Governed onsite HSE compliance on multi-site projects in alignment with Qatar Construction Standards (QCS 2014) and client directives, reporting directly to the Project Director.", "Attained coveted Zero-Accident milestones while maintaining IMS certifications and formulated an intensive onsite HSSE training program delivering 1,000+ training hours."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Led commercial and operational scheduling for third-party quality, environmental, and occupational safety certification programs across chemical, textile, and manufacturing sectors.", "Drafted, reviewed, and authorized technical auditing plans matching DQS Germany standards for QHSE compliance."] },
      { ...TIMELINE[4], bullets: ["Executed 300+ man-days of third-party QHSE certification audits for oil and gas upstream, midstream, and downstream industrial facilities throughout the Middle East and Russia.", "Conducted high-integrity hazard, environmental, and occupational health compliance checks as lead technical review officer for client audit documentation."] },
      { ...TIMELINE[5], bullets: ["Designed, optimized, and deployed custom Occupational Health and Safety (OHS) management plans and emergency evacuation protocols for over 45 chemical and manufacturing operations.", "Directed accident prevention workshops, risk tracking, and business continuity consultations for diverse industrial clients."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Conducted rigorous safety and QA audits at supplier sites to govern overall supply chain risk and contractor safety compliance.", "Evaluated supplier bid safety checklists, advising procurement on contract terms and maintaining an approved vendor pool of 730+ active entities."] },
    ],
    earlierCareer: makeEarlierCareer([
      "Sales Manager — oversaw event safety, fire evacuation procedures, and UK hospitality HSE compliance while managing £1.2M in corporate contracts.",
      "Corporate Sales Team Leader — enforced workplace safety practices within a corporate sales floor environment, mentoring 6 advisors on safe operations and KPI delivery.",
      "Assistant Manager, Supply Chain — managed safety compliance and hazard prevention inside a high-volume 3PL distribution center, implementing rigid storage safety and material handling procedures.",
    ]),
  },
  // CV 3 — ISO Auditor
  {
    slug: "ISO_Auditor",
    roleTitle: "Senior ISO Auditor & Management Systems Specialist",
    roleShort: "ISO Lead Auditor",
    summary:
      "Expert IRCA-certified ISO Lead Auditor and QMS Specialist with a stellar track record of planning, executing, and reporting 500+ man-days of high-integrity third-party certification and surveillance audits. Highly experienced in evaluating complex processes against ISO 9001 (QMS), ISO 14001 (EMS), ISO 45001 (OH&S), and ISO 22301 (BCMS) standards for tier-one registration bodies (DQS-UL, Guardian GIC) across the GCC, Europe, and Asia. Exceptionally skilled at conducting deep-dive gap analyses, technical file reviews, root cause analyses, and tracking corrective and preventive actions (CAPA) to closure.",
    sidebarPage1: [
      { title: "AUDIT SKILLS", items: ["3rd Party Certification Auditing", "Integrated Management Systems", "ISO 9001 Quality", "ISO 14001 Environment", "ISO 45001 OH&S", "ISO 22301 Business Continuity", "Audit Program Planning", "CAPA & Root Cause Analysis", "Supplier Site Audit", "Document Controls"] },
      { title: "ISO CREDENTIALS", items: [["CQI-IRCA Lead Auditor", "ISO 9001 / 14001 / 45001 / 22301"], ["ASQ CMQ/OE", "Certified Manager of Quality (USA)"], ["Train the Trainer", "DQS-UL Germany"]] },
      { title: "LANGUAGES", items: [...LANGUAGES] },
    ],
    sidebarPage2: [
      { title: "OTHER CERTIFICATIONS", items: [["NEBOSH IGC", "Health & Safety"], ["Lean Six Sigma", "Process Optimization"], ["KPI Essentials", "Business Metrics Certification"], ["First Aid & CPR", "Gulf Training Centre"]] },
      { title: "EDUCATION", items: [...EDUCATION] as [string, string][] },
      { title: "AUDIT DASHBOARD", items: ["500+ Man-Days completed on site", "100% CAPA tracked to completion", "45+ QMS deployed and standardized", "730+ supplier audits in PTCL/Etisalat"] },
      { title: "SKILL PROFICIENCY", items: [["ISO 9001 QMS Auditing", 5], ["ISO 14001 EMS Auditing", 5], ["ISO 45001 OH&S Auditing", 5], ["ISO 22301 BCMS Auditing", 4], ["CAPA & Root Cause Analysis", 5], ["Technical File Review", 5]] },
    ],
    experiencePage1: [
      { ...TIMELINE[0], bullets: ["Governed operational compliance and loss mitigation workflows, performing regular SAP-driven system reconciliations and process audits to protect retail corporate value.", "Audited personnel and back-of-house procedures against European inventory and safety standards, ensuring full documentation traceability."] },
      { ...TIMELINE[1], bullets: ["Led high-stakes internal compliance audits across multiple business units (construction, catering, health facilities, and facilities management), reporting results to executive boards.", "Maintained close oversight of IMS audit plans against ISO 9001, 14001, 45001, and 41001, closing 100% of high-importance non-conformities."] },
      { ...TIMELINE[2], bullets: ["Directed rigorous integrated compliance audits on site to maintain certified status for projects across ISO 9001, ISO 14001, and OHSAS 18001 standards.", "Acted as the direct client point of contact for external regulatory safety and environmental inspections, managing all audit documentation and corrective actions."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Governed end-to-end certification process operations, including audit program planning, checklist development, on-site audit execution, and technical reporting.", "Supervised third-party ISO 9001/14001/45001 compliance audit reviews, coordinating directly with the primary DQS headquarters in Germany for formal certification approvals."] },
      { ...TIMELINE[4], bullets: ["Conducted 300+ man-days of formal third-party certification and recertification audits against international ISO 9001, ISO 14001, and OHSAS 18001 standards.", "Handled complex technical reviews of certification audit folders for major upstream and downstream petroleum, chemical, and industrial entities across the Middle East and Russia."] },
      { ...TIMELINE[5], bullets: ["Consulted on, designed, and deployed ISO-compliant quality architectures for over 45 prominent manufacturing plants in the textile, surgical, and chemical engineering domains.", "Delivered customized QMS/EMS/OHS frameworks aligned with ISO 9001, 14001, and 45001 requirements."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Led the quality and technical evaluation of major engineering, system integration, and software vendors, maintaining an approved vendor pool of over 730 active entities.", "Executed comprehensive on-site QA/QC system audits at vendor production facilities, issuing corrective action requests and standardizing audit documentation."] },
    ],
    earlierCareer: makeEarlierCareer([
      "Sales Manager — developed and documented standard operating procedures for sales and event workflows.",
      "Corporate Sales Team Leader — established performance tracking frameworks and KPI reporting discipline for a 6-member sales team.",
      "Assistant Manager, Supply Chain — managed physical inventory reconciliations, supply chain flow audits, and 3PL supplier evaluations.",
    ]),
  },
  // CV 4 — ICT Enterprise Sales
  {
    slug: "ICT_Enterprise_Sales",
    roleTitle: "Senior ICT Enterprise Sales & Solutions Manager",
    roleShort: "ICT Enterprise Sales",
    summary:
      "Dynamic, results-driven ICT Enterprise Sales and Account Management Executive with over 15 years of international success managing multi-million dollar technology accounts, designing tailored network architectures, and directing complex sales cycles in the GCC and Pakistan. Highly expert in leading collaborative business development initiatives for leading enterprise solutions, including Cisco networking, Mushroom Networks SD-WAN, and high-performance cloud security. A proven record of winning major corporate accounts, negotiating high-value public sector contracts, and driving market expansion in fast-paced tech environments.",
    sidebarPage1: [
      { title: "ICT SALES SKILLS", items: ["B2B Enterprise Sales", "Cisco Networks", "SD-WAN & Link Bonding", "Account Management", "Solutions Architecture", "Bid & RFP Strategy", "Channel Partnerships", "Lead Generation", "Market Penetration", "Executive Liaison"] },
      { title: "TECH PORTFOLIO", items: [["Cisco Systems", "Switches, Routers, Security"], ["Mushroom Networks", "Link Bonding Technologies"], ["Cloud & Security", "F5, Huawei, Juniper, RSA"], ["PTCL / Etisalat", "DPLC, IPLC, IP-MPLS"]] },
      { title: "LANGUAGES", items: [...LANGUAGES] },
    ],
    sidebarPage2: [
      { title: "BUSINESS CREDENTIALS", items: [["MSc International Marketing", "University of East London, UK"], ["PMP Training", "Project Management Certificate"], ["KPI Essentials", "Business Metrics Certification"], ["Train the Trainer", "DQS-Germany"]] },
      { title: "EDUCATION", items: [...EDUCATION] as [string, string][] },
      { title: "SALES DASHBOARD", items: ["PKR 154M Contract won at PTCL in 2009", "GBP 1.2M Generated at Astors Hotel, London", "15+ Tech Brands portfolios managed", "GCC Networks extensive connections"] },
      { title: "SKILL PROFICIENCY", items: [["B2B Enterprise Sales", 5], ["Cisco Network Solutions", 4], ["SD-WAN & Link Bonding", 4], ["Account Management", 5], ["Bid & RFP Strategy", 5], ["Channel Partnerships", 5]] },
    ],
    experiencePage1: [
      { ...TIMELINE[0], bullets: ["Managed daily inventory logistics, retail operations, and internal compliance metrics using SAP ERP, ensuring seamless technology-driven workflows.", "Governed collaborative workflows between IT, Sales Audit, and regional management, optimizing system integrations and process accuracy."] },
      { ...TIMELINE[1], bullets: ["Governed cross-functional process alignments and operational efficiency parameters across the PIH group, improving service delivery SLAs and customer/vendor satisfaction indices.", "Collaborated with internal IT and engineering teams to streamline technology adoption and process automation across business units."] },
      { ...TIMELINE[2], bullets: ["Coordinated with project teams and external vendors to ensure technology infrastructure alignment with HSE and operational compliance requirements.", "Supported project-level procurement and vendor technology evaluations, ensuring fit-for-purpose ICT and security solutions."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Structured targeted go-to-market and sales development programs for certification products, winning highly competitive corporate contracts against tier-one operators like BSI and Bureau Veritas.", "Handled key enterprise negotiations and expanded the certification revenue pipelines through strategic ICT-enabled service offerings."] },
      { ...TIMELINE[4], bullets: ["Conducted certification audits across Oil & Gas operations in the Middle East and Russia, building strong relationships with technology and engineering stakeholders.", "Performed technical reviews of client ICT infrastructure and documentation, supporting certification and compliance objectives."] },
      { ...TIMELINE[5], bullets: ["Designed and deployed customized QMS, EMS, and OHS frameworks for 45+ manufacturers, integrating technology solutions to streamline compliance processes.", "Advised clients on business continuity planning and digital transformation strategies aligned with international standards."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Managed end-to-end B2B sales cycles, RFP responses, and customer relationships for high-value MNCs, financial groups, and government organizations.", "Deployed strategic enterprise solutions (DPLC, IPLC, IP-MPLS, and cloud telephony), maximizing customer ROI and awarded regional recognition for winning a landmark PKR 154 Million corporate sales contract."] },
    ],
    earlierCareer: makeEarlierCareer([
      "Sales Manager — cultivated corporate contracts valued at over £1.2 Million and ranked #2 of four regional divisions in revenue attainment.",
      "Corporate Sales Team Leader — mentored a high-performance team of 6 enterprise sales executives on utility sales cycles and pipeline velocity.",
      "Assistant Manager, Supply Chain — designed strategic vendor relationships and international sourcing plans, managing 3PL warehouse logistics.",
    ]),
  },
  // CV 5 — Director Corporate Sales
  {
    slug: "Director_Corporate_Sales",
    roleTitle: "Director of Corporate Sales & Commercial Operations",
    roleShort: "Director of Sales",
    summary:
      "Dynamic, highly accomplished Sales Director with over 20 years of progressive international experience leading B2B enterprise sales, luxury retail store logistics, and hospitality commercial operations across the UK, GCC, Germany, and Pakistan. A proven track record of securing major corporate contracts, negotiating complex service level agreements, and driving multimillion-dollar revenue streams. Adept at recruiting, mentoring, and directing high-performance sales forces while implementing modern CRM, client pipeline, and inventory controls to exceed ambitious commercial goals.",
    sidebarPage1: [
      { title: "SALES SKILLS", items: ["B2B Corporate Sales", "Key Account Strategy", "Retail Management", "Sales Forecasting", "Contract Negotiation", "Pipeline Building", "Pricing & Promotion", "Team Leadership", "CRM Systems", "Customer Retention"] },
      { title: "COMMERCIAL FOCUS", items: [["B2B Enterprise", "High-volume accounts"], ["Luxury Retail", "Michael Kors, Germany"], ["Utility Sales", "Npower, Essex, UK"], ["Hospitality Sales", "Astors Hotel, London"]] },
      { title: "LANGUAGES", items: [...LANGUAGES] },
    ],
    sidebarPage2: [
      { title: "BUSINESS TRAININGS", items: [["MSc IMM (UK)", "International Marketing"], ["KPI Essentials", "Performance Metrics"], ["PMP (Completed)", "Project Management"], ["Train the Trainer", "DQS Germany"]] },
      { title: "EDUCATION", items: [...EDUCATION] as [string, string][] },
      { title: "COMMERCIAL METRICS", items: ["PKR 154M Account — largest contract won", "6-Agent Team managed at Npower", "GBP 1.2M Portfolio managed in London", "SAP POS Expert — modern retail tech"] },
      { title: "SKILL PROFICIENCY", items: [["Key Account Strategy", 5], ["Contract Negotiation", 5], ["Team Leadership & Coaching", 5], ["Pipeline Building", 5], ["CRM & Sales Forecasting", 4], ["Customer Retention", 5]] },
    ],
    experiencePage1: [
      { ...TIMELINE[0], bullets: ["Governed end-to-end retail store operations, stock flow controls, and loss-mitigation frameworks for a global luxury brand.", "Managed inventory and shrinkage using SAP ERP/POS systems, maintaining 100% data accuracy across high-volume retail operations."] },
      { ...TIMELINE[1], bullets: ["Directed extensive customer satisfaction research surveys within Elegancia Services, converting feedback data into actionable service improvement workflows.", "Streamlined commercial contract deliverables to improve B2B service-level compliance and operational efficiency across the PIH group."] },
      { ...TIMELINE[2], bullets: ["Coordinated with project directors and client stakeholders to ensure commercial alignment of project deliverables with contractual service levels.", "Oversaw subcontractor and supplier commercial performance, ensuring adherence to agreed pricing, schedules, and quality benchmarks."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Implemented a go-to-market plan that successfully captured enterprise client accounts from major Tier-1 competitors (BSI, Bureau Veritas, Lloyd's Register).", "Supervised commercial pricing schedules, technical proposals, and multi-site client contracts to expand certification revenue pipelines nationally."] },
      { ...TIMELINE[4], bullets: ["Built and maintained executive-level relationships with Oil & Gas clients across the Middle East and Russia, supporting long-term commercial engagement.", "Coordinated multi-stakeholder contract negotiations and renewals, aligning technical scope with commercial terms."] },
      { ...TIMELINE[5], bullets: ["Directed accident prevention workshops, risk tracking, and business continuity consultations, expanding the consultancy's commercial client base.", "Structured commercial proposals and pricing strategies for QMS/EMS/OHS deployment engagements across 45+ manufacturing operations."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Spearheaded high-stakes sales pipelines for MNCs and enterprise accounts, offering customized ICT packages, MPLS connections, and complex telecom service architectures.", "Directed multi-tier sales presentations and client negotiations to maximize commercial conversions, earning prestigious regional sales recognition for winning a historic PKR 154 Million enterprise contract."] },
    ],
    earlierCareer: makeEarlierCareer([
      "Manager, Sales & Events — cultivated and executed corporate contracts worth over £1.2 Million, achieving #2 of four regional divisions in revenue.",
      "Corporate Sales Team Leader — led and motivated a dynamic team of 6 sales professionals, establishing strategic sales goals and performance coaching.",
      "Assistant Manager, Sourcing & Logistics — managed the corporate purchasing pipeline and 3PL warehouse inventory using strict FIFO guidelines.",
    ]),
  },
  // CV 6 — Quality Management Director
  {
    slug: "Quality_Management_Director",
    roleTitle: "Senior Quality Management & Process Excellence Director",
    roleShort: "Quality Director",
    summary:
      "Strategic, highly accomplished Quality Assurance and Process Improvement Executive with over 20 years of international success directing Quality Management Systems (QMS), supplier quality auditing, and corporate compliance architectures across diverse industries in Europe, the GCC, and Pakistan. Expert in leveraging Lean Six Sigma principles and robust KPI dashboards to evaluate workflows, reduce defect rates, and draft high-performance SOP manuals. Highly skilled at leading supplier site audits, administering customer satisfaction evaluations, and directing cross-functional teams toward business excellence and ISO certifications.",
    sidebarPage1: [
      { title: "QUALITY SKILLS", items: ["QMS (ISO 9001)", "Quality Assurance", "Supplier Site Audit", "Process Mapping", "SOP Development", "GAP Analysis & RCA", "Lean Six Sigma", "CAPA Governance", "Customer Surveys", "KPI Development"] },
      { title: "QUALITY CREDENTIALS", items: [["ASQ CMQ/OE", "Certified Quality Manager"], ["Lean Six Sigma", "Process Foundations"], ["ISO 9001 Lead Auditor", "CQI-IRCA Certified"], ["Train the Trainer", "DQS-UL Germany"]] },
      { title: "LANGUAGES", items: [...LANGUAGES] },
    ],
    sidebarPage2: [
      { title: "OTHER TRAINING", items: [["Training Delivery", "Highfield Level 3 (UK)"], ["ISO 14001 EMS", "Environmental Systems"], ["ISO 45001 OHS", "Occupational Safety"], ["ISO 22301 BCMS", "Business Continuity"]] },
      { title: "EDUCATION", items: [...EDUCATION] as [string, string][] },
      { title: "QUALITY METRICS", items: ["730+ Suppliers managed and audited", "45+ ISO Deployed across Pakistani plants", "100% QMS Pass on all group audits", "PKR 200M Spend governed by QA rules"] },
      { title: "SKILL PROFICIENCY", items: [["QMS (ISO 9001)", 5], ["Lean Six Sigma", 4], ["Supplier Site Audit", 5], ["SOP Development", 5], ["GAP Analysis & RCA", 5], ["KPI Development", 5]] },
    ],
    experiencePage1: [
      { ...TIMELINE[0], bullets: ["Governed operational and inventory accuracy using SAP, ensuring process alignment with European retail quality and safety standards.", "Conducted regular cycle counts and variance analyses to eliminate stock-tracking errors and maintain 100% inventory accuracy."] },
      { ...TIMELINE[1], bullets: ["Deployed comprehensive quality policies, SOP manuals, and QMS frameworks across PIH group companies (including Urbacon, Elegancia, Baladna, and hospital units).", "Spearheaded extensive Quality Assurance (QA) inspections and process audits, standardizing operational practices to achieve and maintain top-tier ISO certifications."] },
      { ...TIMELINE[2], bullets: ["Led project compliance audits to certify large-scale construction operations to ISO 9001, OHSAS 18001, and ISO 14001, working directly with client quality inspectors.", "Established rigorous quality control procedures and documentation practices aligned with international standards."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Supervised the entire scope of third-party ISO 9001 quality audits, including audit plans, checklist verifications, and certification issuances in coordination with Germany.", "Evaluated client quality systems across heavy manufacturing, chemicals, and telecom sectors, providing strategic improvement recommendations."] },
      { ...TIMELINE[4], bullets: ["Conducted high-integrity quality system audits across the UAE and Russian Federation, verifying compliant operational practices in heavy manufacturing and engineering.", "Undertook thorough technical file reviews of completed audit documentation to authorize certificates and ensure audit-grade rigor."] },
      { ...TIMELINE[5], bullets: ["Authored, optimized, and implemented detailed QMS manuals and operational procedures for 45+ manufacturing plants across surgical, chemical, and textile sectors.", "Delivered tailored quality training and process improvement consultations aligned with Lean Six Sigma principles."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Governed quality assessment processes for key hardware, telecom, and system vendors, actively maintaining an approved supplier register of over 730 active partners.", "Executed comprehensive on-site QA/QC audits at supplier manufacturing plants, issuing corrective action requests and standardizing company operating procedural manuals."] },
    ],
    earlierCareer: makeEarlierCareer([
      "Sales Manager — implemented service quality standards and customer satisfaction tracking for banquet and event operations.",
      "Corporate Sales Team Leader — established performance dashboards and quality metrics for a 6-member sales team, reporting regional progress to the Area Sales Manager.",
      "Assistant Manager, Supply Chain — maintained strict quality control for high-volume incoming medical PPE shipments and supervised 3PL warehousing FIFO metrics.",
    ]),
  },
];

export const getCvBySlug = (slug: string): CvData | undefined =>
  CV_VARIANTS.find((cv) => cv.slug === slug);
