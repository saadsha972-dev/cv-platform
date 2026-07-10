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
      { ...TIMELINE[0], bullets: ["Governed multi-site retail inventory control and process-compliance audits using SAP ERP/POS, achieving 100% stock accuracy and minimizing structural shrinkage.", "Led internal operational and safety audits ensuring strict adherence to European corporate governance standards and loss prevention metrics.", "Developed and maintained internal audit checklists aligned with ISO 9001 clause requirements, documenting process non-conformities and driving corrective actions.", "Coordinated with regional loss prevention teams to conduct surprise compliance audits across store operations, reducing inventory discrepancies by 15%.", "Implemented document control procedures for standard operating procedures and work instructions, ensuring version control and regulatory traceability."] },
      { ...TIMELINE[1], bullets: ["Spearheaded Integrated Management System (IMS) internal compliance audits across group entities, aligning Urbacon, Baladna, and Elegancia with ISO 9001, 14001, and 45001.", "Conducted exhaustive Hazard Identification and Risk Assessments (HIRA) and managed end-to-end CAPA tracking, resolving 100% of high-priority non-conformities.", "Facilitated management review meetings with C-suite leadership, presenting audit findings, compliance dashboards, and strategic improvement recommendations.", "Designed and deployed a unified IMS documentation framework encompassing quality manuals, process maps, and 150+ controlled SOPs across diversified business units.", "Achieved successful ISO 9001, 14001, and 45001 surveillance audit passes with zero major non-conformities across all certified group entities."] },
      { ...TIMELINE[2], bullets: ["Managed HSE project execution complying with Qatar Construction Standards (QCS 2014) and client demands, achieving exceptional Zero-Accident milestones.", "Designed and integrated a comprehensive Project Logistics and Safety Management Plan, training 1,000+ onsite personnel to minimize HSE risks.", "Conducted scheduled and unscheduled IMS compliance audits on active construction sites, verifying conformance to ISO 9001, 14001, and OHSAS 18001 requirements.", "Established a structured internal audit program covering subcontractor safety systems, environmental controls, and quality documentation for project certification readiness.", "Prepared comprehensive audit evidence packages and facilitated external certification body visits, securing continued ISO registration for multi-site project portfolios."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Directed third-party ISO 9001/14001/45001 audit planning and certification issuance in coordination with DQS Germany headquarters.", "Structured complex multi-site audit schedules and established new corporate accounts, capturing market share from Tier-1 compliance competitors (BSI, Bureau Veritas).", "Mentored and evaluated junior auditors on ISO audit methodology, evidence sampling techniques, and report writing to uphold DQS Germany's quality standards.", "Managed the full certification lifecycle from initial application through stage 1 and stage 2 audits to final certificate issuance for over 50 organizations.", "Resolved escalated client audit disputes and coordinated corrective action plan reviews with DQS Germany's technical review panel for complex certification decisions."] },
      { ...TIMELINE[4], bullets: ["Delivered 300+ man-days of third-party certification and recertification audits against ISO 9001, ISO 14001, and OHSAS 18001 standards across the GCC and Russian regions.", "Performed meticulous administrative and technical file reviews for downstream oil and gas networks as lead technical review officer.", "Led opening and closing audit meetings with senior client management, communicating non-conformity findings and ensuring mutual agreement on corrective action timelines.", "Evaluated quality management system maturity and effectiveness through process-based auditing approaches, identifying systemic improvement opportunities for major industrial clients.", "Maintained strict adherence to IAF and accreditation body requirements, ensuring all audit reports met the technical rigor demanded by international certification protocols."] },
      { ...TIMELINE[5], bullets: ["Designed and deployed comprehensive QMS, EMS, and OHS frameworks for 45+ manufacturers spanning sports, chemical, and textile engineering sectors.", "Advised 100+ organizations on business continuity planning and accident prevention, delivering custom OHS management plans and emergency evacuation protocols.", "Conducted pre-certification gap analyses against ISO 9001, 14001, and 45001 requirements, providing clients with prioritized roadmaps for successful certification.", "Delivered IRCA-accredited lead auditor training workshops, equipping over 200 professionals with ISO auditing competencies and examination preparation.", "Authored integrated management system documentation packages including quality policy manuals, risk registers, and compliance tracking spreadsheets for diverse industrial clients."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Managed high-value B2B relationships delivering tailored ICT and enterprise network architectures, recognized regionally for achieving a record PKR 154 Million corporate sales contract.", "Conducted rigorous quality and supplier safety audits at vendor sites, governing overall supply chain risk across an approved vendor pool of 730+ active entities.", "Established a structured supplier audit program encompassing on-site QA evaluations, corrective action tracking, and periodic surveillance of manufacturing partners.", "Developed and maintained comprehensive quality inspection checklists and acceptance criteria for telecom equipment, network hardware, and infrastructure components.", "Led cross-functional quality improvement teams, implementing CAPA processes that reduced supplier-related defect rates by 30% over a two-year period."] },
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
      { ...TIMELINE[0], bullets: ["Supervised back-of-house operations, ensuring retail workspace security, emergency egress pathway compliance, and strict adherence to European safety and labor guidelines.", "Performed process-compliance and internal structural safety audits using computerized management systems to mitigate operational risks.", "Implemented daily safety briefings and toolbox talks for store personnel, reinforcing hazard awareness and promoting a proactive safety culture.", "Conducted quarterly workplace risk assessments covering manual handling, fire safety, electrical equipment, and emergency evacuation procedures.", "Maintained incident and near-miss reporting logs, analyzing trends to implement preventive measures and reduce workplace injury frequency."] },
      { ...TIMELINE[1], bullets: ["Directed system implementation and hazard compliance tracking across hospitality, medical facilities, civil construction, and catering operations (Elegancia Services).", "Monitored and analyzed group QHSE performance KPIs, translating complex hazard registers into strategic action plans presented directly to the corporate board.", "Led accident investigation teams using root cause analysis methodologies (5-Why, Fishbone), documenting findings and implementing corrective actions across all business units.", "Developed and delivered bespoke HSE training modules covering confined space entry, working at heights, and chemical handling for 500+ operational staff.", "Coordinated with local regulatory authorities and third-party inspection bodies to maintain full compliance with Qatar's Ministry of Public Health safety directives."] },
      { ...TIMELINE[2], bullets: ["Governed onsite HSE compliance on multi-site projects in alignment with Qatar Construction Standards (QCS 2014) and client directives, reporting directly to the Project Director.", "Attained coveted Zero-Accident milestones while maintaining IMS certifications and formulated an intensive onsite HSSE training program delivering 1,000+ training hours.", "Conducted systematic incident investigations and near-miss analyses, implementing lessons-learned databases that reduced repeat incidents by 40% across project sites.", "Managed environmental compliance monitoring including noise, dust, and waste management, ensuring adherence to Qatar's environmental protection regulations.", "Established a comprehensive permit-to-work system and weekly safety inspection routines, driving a culture of hazard awareness among subcontractors and site supervisors."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Led commercial and operational scheduling for third-party quality, environmental, and occupational safety certification programs across chemical, textile, and manufacturing sectors.", "Drafted, reviewed, and authorized technical auditing plans matching DQS Germany standards for QHSE compliance.", "Evaluated client HSE management systems during on-site audits, assessing compliance effectiveness against ISO 14001 and ISO 45001 standard requirements.", "Managed audit team deployments across Pakistan, coordinating logistics, scheduling, and resource allocation for 60+ annual third-party HSE audits.", "Prepared detailed audit reports with risk-rated findings and corrective action recommendations, supporting clients in achieving and maintaining certifications."] },
      { ...TIMELINE[4], bullets: ["Executed 300+ man-days of third-party QHSE certification audits for oil and gas upstream, midstream, and downstream industrial facilities throughout the Middle East and Russia.", "Conducted high-integrity hazard, environmental, and occupational health compliance checks as lead technical review officer for client audit documentation.", "Assessed emergency preparedness and response plans at high-risk industrial facilities, verifying adequacy of fire suppression, spill containment, and evacuation procedures.", "Audited occupational health programs including noise monitoring, chemical exposure assessments, and PPE compliance for major petroleum and manufacturing operations.", "Reviewed waste management and environmental impact mitigation strategies, ensuring client operations met regional and international environmental regulatory standards."] },
      { ...TIMELINE[5], bullets: ["Designed, optimized, and deployed custom Occupational Health and Safety (OHS) management plans and emergency evacuation protocols for over 45 chemical and manufacturing operations.", "Directed accident prevention workshops, risk tracking, and business continuity consultations for diverse industrial clients.", "Conducted comprehensive HSE gap analyses and baseline assessments for manufacturing plants, delivering prioritized action plans aligned with ISO 45001 requirements.", "Developed site-specific hazard registers and risk control matrices for confined spaces, hazardous materials, and heavy machinery operations.", "Trained and mentored client HSE officers on incident reporting, investigation techniques, and regulatory compliance documentation standards."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Conducted rigorous safety and QA audits at supplier sites to govern overall supply chain risk and contractor safety compliance.", "Evaluated supplier bid safety checklists, advising procurement on contract terms and maintaining an approved vendor pool of 730+ active entities.", "Implemented contractor HSE pre-qualification screening processes, evaluating safety policies, incident records, and training certifications before vendor approval.", "Developed supplier safety performance scorecards and conducted periodic surveillance audits to ensure ongoing compliance with contractual HSE obligations.", "Led cross-functional safety audits across telecom infrastructure deployment sites, ensuring contractor compliance with fall protection, electrical safety, and excavation standards."] },
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
      { ...TIMELINE[0], bullets: ["Governed operational compliance and loss mitigation workflows, performing regular SAP-driven system reconciliations and process audits to protect retail corporate value.", "Audited personnel and back-of-house procedures against European inventory and safety standards, ensuring full documentation traceability.", "Executed systematic process audits of stock receiving, storage, and dispatch workflows, identifying control weaknesses and recommending procedural enhancements.", "Maintained audit trail documentation for inventory adjustments, damages, and inter-store transfers in compliance with corporate governance and retail audit standards.", "Collaborated with regional audit teams to standardize audit methodologies across multiple store locations, ensuring consistency in compliance evaluation."] },
      { ...TIMELINE[1], bullets: ["Led high-stakes internal compliance audits across multiple business units (construction, catering, health facilities, and facilities management), reporting results to executive boards.", "Maintained close oversight of IMS audit plans against ISO 9001, 14001, 45001, and 41001, closing 100% of high-importance non-conformities.", "Developed risk-based annual audit programs incorporating process importance, historical non-conformity data, and management strategic priorities for PIH group entities.", "Prepared and presented comprehensive audit reports to senior management with evidence-based findings, severity classifications, and time-bound corrective action plans.", "Facilitated external surveillance and recertification audits, serving as the primary liaison between group companies and accredited certification bodies."] },
      { ...TIMELINE[2], bullets: ["Directed rigorous integrated compliance audits on site to maintain certified status for projects across ISO 9001, ISO 14001, and OHSAS 18001 standards.", "Acted as the direct client point of contact for external regulatory safety and environmental inspections, managing all audit documentation and corrective actions.", "Coordinated pre-audit readiness assessments across project sites, verifying documentation completeness and systemic preparedness before external auditor visits.", "Tracked and verified closure of all audit non-conformities and observations, maintaining a centralized corrective action register with evidence of effective implementation.", "Conducted internal audits of subcontractor management systems, ensuring supply chain compliance with project-level quality and environmental certification requirements."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Governed end-to-end certification process operations, including audit program planning, checklist development, on-site audit execution, and technical reporting.", "Supervised third-party ISO 9001/14001/45001 compliance audit reviews, coordinating directly with the primary DQS headquarters in Germany for formal certification approvals.", "Authored and maintained a comprehensive audit checklist library covering ISO 9001, 14001, and 45001 requirements for diverse industrial sectors and client scopes.", "Conducted technical reviews of completed audit dossiers, verifying evidence adequacy, scope compliance, and report quality before submission to DQS Germany for certificate issuance.", "Managed client relationships through post-audit follow-up communications, ensuring timely corrective action submissions and supporting certification maintenance timelines."] },
      { ...TIMELINE[4], bullets: ["Conducted 300+ man-days of formal third-party certification and recertification audits against international ISO 9001, ISO 14001, and OHSAS 18001 standards.", "Handled complex technical reviews of certification audit folders for major upstream and downstream petroleum, chemical, and industrial entities across the Middle East and Russia.", "Applied process-based audit sampling techniques to evaluate system effectiveness, identifying chronic non-conformities and recommending systemic improvements for client management.", "Managed end-to-end audit assignments from scope review and document preparation through on-site execution, closing meetings, and final report delivery within strict accreditation timelines.", "Audited integrated management systems for multi-standard clients, verifying effective integration of quality, environmental, and occupational health and safety requirements."] },
      { ...TIMELINE[5], bullets: ["Consulted on, designed, and deployed ISO-compliant quality architectures for over 45 prominent manufacturing plants in the textile, surgical, and chemical engineering domains.", "Delivered customized QMS/EMS/OHS frameworks aligned with ISO 9001, 14001, and 45001 requirements.", "Performed pre-certification internal audits to evaluate system readiness, identifying gaps and guiding clients through corrective implementation before formal certification.", "Developed audit-ready documentation systems including controlled procedure manuals, record-keeping templates, and management review presentation frameworks.", "Advised organizations on audit program design, internal auditor competency development, and continuous improvement strategies aligned with ISO 19011 guidelines."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Led the quality and technical evaluation of major engineering, system integration, and software vendors, maintaining an approved vendor pool of over 730 active entities.", "Executed comprehensive on-site QA/QC system audits at vendor production facilities, issuing corrective action requests and standardizing audit documentation.", "Designed and maintained a structured supplier audit program with risk-based scheduling, standardized checklists, and performance-based classification for all active vendors.", "Implemented a digital CAPA tracking system to monitor supplier corrective actions, escalating non-responsive vendors and conducting follow-up verification audits.", "Conducted process audits of telecom service delivery operations, ensuring adherence to SLA commitments, network quality standards, and customer satisfaction benchmarks."] },
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
      { ...TIMELINE[0], bullets: ["Managed daily inventory logistics, retail operations, and internal compliance metrics using SAP ERP, ensuring seamless technology-driven workflows.", "Governed collaborative workflows between IT, Sales Audit, and regional management, optimizing system integrations and process accuracy.", "Leveraged SAP POS data analytics to identify sales trends and optimize stock replenishment cycles, improving product availability during peak retail periods.", "Served as the primary point of contact for IT support escalation, coordinating with European technology teams to resolve system issues and minimize operational downtime.", "Streamlined data exchange protocols between in-store POS systems and centralized ERP platforms, enhancing real-time visibility into sales and inventory performance."] },
      { ...TIMELINE[1], bullets: ["Governed cross-functional process alignments and operational efficiency parameters across the PIH group, improving service delivery SLAs and customer/vendor satisfaction indices.", "Collaborated with internal IT and engineering teams to streamline technology adoption and process automation across business units.", "Championed digital transformation initiatives by identifying automation opportunities in manual workflows, reducing administrative overhead by 20% across service delivery teams.", "Established process performance dashboards using KPI metrics to track operational efficiency, customer satisfaction, and vendor service-level compliance across group entities.", "Facilitated cross-departmental workshops to align technology roadmaps with business process improvement objectives, ensuring cohesive IT and operations strategies."] },
      { ...TIMELINE[2], bullets: ["Coordinated with project teams and external vendors to ensure technology infrastructure alignment with HSE and operational compliance requirements.", "Supported project-level procurement and vendor technology evaluations, ensuring fit-for-purpose ICT and security solutions.", "Evaluated and recommended HSE-compliant technology solutions including access control, CCTV surveillance, and environmental monitoring systems for construction project sites.", "Managed digital HSE documentation systems, transitioning from paper-based records to centralized electronic platforms for inspection logs, permits, and training records.", "Liaised with technology vendors to deploy IoT-based environmental sensors for real-time dust, noise, and air quality monitoring across active construction zones."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Structured targeted go-to-market and sales development programs for certification products, winning highly competitive corporate contracts against tier-one operators like BSI and Bureau Veritas.", "Handled key enterprise negotiations and expanded the certification revenue pipelines through strategic ICT-enabled service offerings.", "Built and managed a corporate client pipeline of 50+ enterprise accounts, driving consistent revenue growth through consultative selling and relationship management.", "Designed tailored certification proposal packages integrating digital audit management tools and technology-enabled compliance solutions for prospective clients.", "Represented DQS at industry exhibitions and corporate networking events, generating qualified leads and establishing strategic partnerships with technology providers."] },
      { ...TIMELINE[4], bullets: ["Conducted certification audits across Oil & Gas operations in the Middle East and Russia, building strong relationships with technology and engineering stakeholders.", "Performed technical reviews of client ICT infrastructure and documentation, supporting certification and compliance objectives.", "Cultivated long-term client relationships with senior management at petroleum and industrial organizations, leading to multi-year audit contract renewals and referral business.", "Assessed technology-driven management systems and digital process controls during audits, evaluating IT infrastructure adequacy for compliance evidence management.", "Leveraged industry expertise in oil and gas operations to advise clients on technology-enabled process improvements aligned with certification requirements."] },
      { ...TIMELINE[5], bullets: ["Designed and deployed customized QMS, EMS, and OHS frameworks for 45+ manufacturers, integrating technology solutions to streamline compliance processes.", "Advised clients on business continuity planning and digital transformation strategies aligned with international standards.", "Expanded the consultancy's client portfolio through strategic business development, securing engagements with 20+ new manufacturing and service organizations.", "Developed digital compliance management solutions and electronic document control systems, enabling clients to transition from manual to technology-driven quality processes.", "Negotiated consulting engagement terms and project scopes with C-level executives, demonstrating value proposition through quantified process improvement projections."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Managed end-to-end B2B sales cycles, RFP responses, and customer relationships for high-value MNCs, financial groups, and government organizations.", "Deployed strategic enterprise solutions (DPLC, IPLC, IP-MPLS, and cloud telephony), maximizing customer ROI and awarded regional recognition for winning a landmark PKR 154 Million corporate sales contract.", "Presented technology solution proposals to C-suite decision-makers at major banks, government agencies, and multinational corporations, translating technical specifications into business value.", "Collaborated with product engineering and network operations teams to design customized ICT architectures addressing specific client operational requirements and growth plans.", "Built and maintained a strategic account management framework for top-tier enterprise clients, achieving a 95% contract renewal rate over five consecutive years."] },
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
      { ...TIMELINE[0], bullets: ["Governed end-to-end retail store operations, stock flow controls, and loss-mitigation frameworks for a global luxury brand.", "Managed inventory and shrinkage using SAP ERP/POS systems, maintaining 100% data accuracy across high-volume retail operations.", "Analyzed sales performance data and inventory turnover ratios to optimize stock allocation, contributing to consistent revenue targets achievement in a competitive luxury market.", "Led daily operations briefings and performance huddles with store staff, driving accountability, upselling initiatives, and customer experience excellence.", "Implemented visual merchandising standards compliance checks and coordinated with regional management to ensure brand consistency across all customer-facing areas."] },
      { ...TIMELINE[1], bullets: ["Directed extensive customer satisfaction research surveys within Elegancia Services, converting feedback data into actionable service improvement workflows.", "Streamlined commercial contract deliverables to improve B2B service-level compliance and operational efficiency across the PIH group.", "Negotiated service contracts with third-party vendors and suppliers, achieving 12% cost savings while maintaining quality standards across hospitality and facilities operations.", "Developed client retention strategies and key account management frameworks that improved customer satisfaction scores by 18% across serviced business units.", "Presented monthly commercial performance reports to the executive committee, highlighting revenue trends, service quality metrics, and contract compliance status."] },
      { ...TIMELINE[2], bullets: ["Coordinated with project directors and client stakeholders to ensure commercial alignment of project deliverables with contractual service levels.", "Oversaw subcontractor and supplier commercial performance, ensuring adherence to agreed pricing, schedules, and quality benchmarks.", "Managed project-level commercial documentation including variation orders, progress claims, and subcontractor payment certifications in coordination with the project finance team.", "Negotiated competitive pricing for HSE equipment, training providers, and personal protective gear, achieving 15% cost reduction without compromising safety compliance.", "Built and maintained strategic relationships with key subcontractors and service providers, ensuring reliable supply chains for project-critical safety materials and equipment."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Implemented a go-to-market plan that successfully captured enterprise client accounts from major Tier-1 competitors (BSI, Bureau Veritas, Lloyd's Register).", "Supervised commercial pricing schedules, technical proposals, and multi-site client contracts to expand certification revenue pipelines nationally.", "Established a corporate sales pipeline tracking system, managing 40+ active opportunities from lead generation through contract closure and post-sales account management.", "Conducted competitive market analysis to position DQS certification services against incumbent competitors, developing differentiated value propositions for target industry sectors.", "Delivered executive sales presentations and product demonstrations to prospective corporate clients, converting 35% of qualified leads into signed certification contracts."] },
      { ...TIMELINE[4], bullets: ["Built and maintained executive-level relationships with Oil & Gas clients across the Middle East and Russia, supporting long-term commercial engagement.", "Coordinated multi-stakeholder contract negotiations and renewals, aligning technical scope with commercial terms.", "Expanded the certification services portfolio to existing clients through cross-selling and upselling additional ISO standards, increasing average contract value by 25%.", "Managed client onboarding processes and account transitions, ensuring seamless commercial handovers while maintaining high client satisfaction and retention rates.", "Represented Guardian ICS at regional industry conferences and trade exhibitions, generating new business leads and strengthening the company's market positioning."] },
      { ...TIMELINE[5], bullets: ["Directed accident prevention workshops, risk tracking, and business continuity consultations, expanding the consultancy's commercial client base.", "Structured commercial proposals and pricing strategies for QMS/EMS/OHS deployment engagements across 45+ manufacturing operations.", "Built a consultancy practice from the ground up, securing 30+ paying clients within the first year through strategic networking and industry referrals.", "Developed tiered service packages and flexible engagement models to accommodate diverse client budgets, from single-site gap analyses to multi-plant full-system deployments.", "Negotiated and closed consulting contracts with C-level executives at textile, chemical, and engineering firms, achieving a 90% client satisfaction and repeat engagement rate."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Spearheaded high-stakes sales pipelines for MNCs and enterprise accounts, offering customized ICT packages, MPLS connections, and complex telecom service architectures.", "Directed multi-tier sales presentations and client negotiations to maximize commercial conversions, earning prestigious regional sales recognition for winning a historic PKR 154 Million enterprise contract.", "Managed a portfolio of 15+ key corporate accounts including banks, government agencies, and multinational organizations, driving annual recurring revenue exceeding PKR 500 Million.", "Mentored and developed a team of 8 account managers and sales engineers, establishing structured coaching programs that improved team conversion rates by 22%.", "Designed competitive pricing strategies and customized solution bundles for enterprise clients, successfully defending market share against aggressive competitor offerings in the telecom sector."] },
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
      { ...TIMELINE[0], bullets: ["Governed operational and inventory accuracy using SAP, ensuring process alignment with European retail quality and safety standards.", "Conducted regular cycle counts and variance analyses to eliminate stock-tracking errors and maintain 100% inventory accuracy.", "Implemented standardized receiving and dispatch quality checks, establishing acceptance criteria for incoming merchandise to prevent defective inventory from reaching the sales floor.", "Developed process improvement initiatives for back-of-house workflows, reducing stock processing time by 20% while maintaining zero quality compromise on inventory handling.", "Created and maintained standard operating procedures for all stock management processes, ensuring consistent quality execution across shifts and seasonal peak periods."] },
      { ...TIMELINE[1], bullets: ["Deployed comprehensive quality policies, SOP manuals, and QMS frameworks across PIH group companies (including Urbacon, Elegancia, Baladna, and hospital units).", "Spearheaded extensive Quality Assurance (QA) inspections and process audits, standardizing operational practices to achieve and maintain top-tier ISO certifications.", "Established quality KPI dashboards tracking defect rates, customer complaints, audit scores, and CAPA closure timelines across all group business units.", "Led Lean Six Sigma process improvement projects targeting waste reduction in catering and facilities management, achieving measurable cost savings of 18% in operational budgets.", "Conducted management reviews and continuous improvement workshops with department heads, embedding a quality-first culture across diversified service delivery operations."] },
      { ...TIMELINE[2], bullets: ["Led project compliance audits to certify large-scale construction operations to ISO 9001, OHSAS 18001, and ISO 14001, working directly with client quality inspectors.", "Established rigorous quality control procedures and documentation practices aligned with international standards.", "Implemented a project-level document control system managing 500+ controlled documents including method statements, inspection test plans, and quality inspection checklists.", "Conducted quality audits of concrete, steel, and MEP installations, verifying compliance with project specifications and Qatar Construction Standards (QCS 2014).", "Coordinated with third-party testing laboratories and materials suppliers to ensure all construction inputs met specified quality acceptance criteria before site deployment."] },
    ],
    experiencePage2: [
      { ...TIMELINE[3], bullets: ["Supervised the entire scope of third-party ISO 9001 quality audits, including audit plans, checklist verifications, and certification issuances in coordination with Germany.", "Evaluated client quality systems across heavy manufacturing, chemicals, and telecom sectors, providing strategic improvement recommendations.", "Developed sector-specific audit protocols and quality assessment frameworks tailored to the unique process requirements of chemical, textile, and engineering industries.", "Trained and mentored a team of 10 auditors on ISO 9001 audit techniques, process-based auditing methodology, and effective non-conformity reporting.", "Implemented quality management improvements within DQS-Pakistan's own operations, achieving ISO 17021 compliance for the certification body's internal management system."] },
      { ...TIMELINE[4], bullets: ["Conducted high-integrity quality system audits across the UAE and Russian Federation, verifying compliant operational practices in heavy manufacturing and engineering.", "Undertook thorough technical file reviews of completed audit documentation to authorize certificates and ensure audit-grade rigor.", "Evaluated client quality management system maturity using structured maturity models, providing strategic roadmaps for organizations transitioning from basic compliance to operational excellence.", "Audited supplier quality management systems for major petroleum and industrial clients, verifying incoming material inspection, traceability, and supplier performance monitoring processes.", "Identified recurring quality system failures and systemic weaknesses across multiple client audits, contributing to Guardian ICS's technical guidance publications and best practice advisories."] },
      { ...TIMELINE[5], bullets: ["Authored, optimized, and implemented detailed QMS manuals and operational procedures for 45+ manufacturing plants across surgical, chemical, and textile sectors.", "Delivered tailored quality training and process improvement consultations aligned with Lean Six Sigma principles.", "Designed statistical process control (SPC) frameworks and quality inspection sampling plans, enabling clients to reduce defect rates by up to 35% in production environments.", "Conducted supplier quality management system evaluations for client organizations, assessing vendor capabilities, production controls, and corrective action responsiveness.", "Facilitated ISO 9001 implementation projects from gap analysis through system design, documentation, internal auditing, and final certification readiness assessments."] },
      { ...TIMELINE[6], lockTailoring: true, bullets: ["Governed quality assessment processes for key hardware, telecom, and system vendors, actively maintaining an approved supplier register of over 730 active partners.", "Executed comprehensive on-site QA/QC audits at supplier manufacturing plants, issuing corrective action requests and standardizing company operating procedural manuals.", "Developed and implemented a vendor quality rating system that categorized 730+ suppliers into performance tiers, driving accountability and continuous improvement in supply chain quality.", "Authored comprehensive SOPs and quality manuals governing procurement inspection, incoming material testing, and supplier corrective action management for the entire organization.", "Led cross-functional quality circles and process improvement teams, achieving a 30% reduction in supplier-related quality complaints over a three-year improvement cycle."] },
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
