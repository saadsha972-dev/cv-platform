"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Search, Mail, Loader2, Download, ExternalLink, RefreshCw,
  Briefcase, Target, TrendingUp, Clock, CheckCircle2, AlertCircle,
  Sparkles, Wand2, Send, Eye, Filter, Globe,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface CvVariant {
  id: string;
  slug: string;
  roleTitle: string;
  roleShort: string;
  summary: string;
}

interface SearchProfile {
  id: string;
  name: string;
  countries: string;
  keywords: string;
  excludeKeywords: string | null;
  frequency: string;
  lastRunAt: string | null;
  cvVariant: { slug: string; roleTitle: string; roleShort: string };
}

interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  matchScore: number;
  status: string;
  createdAt: string;
  searchProfile: { name: string; cvVariant: { slug: string; roleShort: string } };
  matches?: Array<{ matchScore: number; rationale: string; cvVariant: { roleShort: string } }>;
}

interface JobAnalysis {
  jobTitle: string;
  company: string;
  location: string;
  keywords: string[];
  requirements: string[];
  responsibilities: string[];
  seniority: string;
  tone: string;
  industry: string;
}

interface TailoredContent {
  tailoredSummary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------
export default function HomePage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1b365d] to-[#2d3748] flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1b365d] leading-tight">CV Platform</h1>
              <p className="text-xs text-slate-500">Tailor & Hunt · Muhammad Ali Bhatti</p>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:flex border-[#8c7853] text-[#8c7853]">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 max-w-lg mx-auto">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
              <TrendingUp className="w-4 h-4 mr-1.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tailor" className="text-xs sm:text-sm">
              <Wand2 className="w-4 h-4 mr-1.5" />
              CV Tailor
            </TabsTrigger>
            <TabsTrigger value="hunter" className="text-xs sm:text-sm">
              <Search className="w-4 h-4 mr-1.5" />
              Job Hunter
            </TabsTrigger>
            <TabsTrigger value="remote" className="text-xs sm:text-sm">
              <Globe className="w-4 h-4 mr-1.5" />
              Remote Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab onNavigate={setActiveTab} />
          </TabsContent>
          <TabsContent value="tailor">
            <TailorTab />
          </TabsContent>
          <TabsContent value="hunter">
            <HunterTab />
          </TabsContent>
          <TabsContent value="remote">
            <RemoteJobsTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white/50 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-slate-500">
          CV Platform · LaTeX-powered CV generation + AI job matching · Email alerts to thealibhatti@gmail.com
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD TAB
// ---------------------------------------------------------------------------
function DashboardTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState({ cvVariants: 0, searchProfiles: 0, jobs: 0, newJobs: 0, generatedCvs: 0 });
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<JobPosting[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cvRes, profileRes, jobsRes] = await Promise.all([
          fetch("/api/cv-variants"),
          fetch("/api/search-profiles"),
          fetch("/api/jobs?limit=5"),
        ]);
        const cvData = await cvRes.json();
        const profileData = await profileRes.json();
        const jobsData = await jobsRes.json();

        setStats({
          cvVariants: cvData.variants?.length || 0,
          searchProfiles: profileData.profiles?.length || 0,
          jobs: jobsData.jobs?.length || 0,
          newJobs: jobsData.jobs?.filter((j: JobPosting) => j.status === "new").length || 0,
          generatedCvs: 0,
        });
        setRecentJobs(jobsData.jobs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="border-[#1b365d]/20 bg-gradient-to-br from-[#1b365d] to-[#2d3748] text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back, Muhammad</CardTitle>
          <CardDescription className="text-slate-300">
            Your AI-powered job application workflow — search jobs, match them to your CVs, and generate tailored applications in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => onNavigate("tailor")} className="bg-[#8c7853] hover:bg-[#8c7853]/90 text-white">
            <Wand2 className="w-4 h-4 mr-2" />
            Tailor a CV
          </Button>
          <Button onClick={() => onNavigate("hunter")} variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
            <Search className="w-4 h-4 mr-2" />
            Search Jobs
          </Button>
          <a
            href="/cv-platform-source.zip"
            download
            className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Download App Source Code (ZIP)
          </a>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="w-5 h-5" />} label="CV Variants" value={stats.cvVariants} color="#1b365d" />
        <StatCard icon={<Target className="w-5 h-5" />} label="Search Profiles" value={stats.searchProfiles} color="#8c7853" />
        <StatCard icon={<Briefcase className="w-5 h-5" />} label="Jobs Found" value={stats.jobs} color="#2d3748" />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="New Jobs" value={stats.newJobs} color="#dc2626" />
      </div>

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#8c7853]" />
              Recent Job Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-start justify-between p-3 rounded-lg border border-slate-200 hover:border-[#8c7853]/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[#1b365d] truncate">{job.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {job.company} · {job.location} · <span className="uppercase">{job.source}</span>
                    </div>
                  </div>
                  <Badge
                    className={job.matchScore >= 80 ? "bg-green-100 text-green-700" : job.matchScore >= 60 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}
                  >
                    {job.matchScore}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CV TAILOR TAB
// ---------------------------------------------------------------------------
function TailorTab() {
  const { toast } = useToast();
  const [variants, setVariants] = useState<CvVariant[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [jobPosting, setJobPosting] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    cvPdfBase64: string;
    coverLetterPdfBase64: string;
    jobAnalysis: JobAnalysis;
    tailoredContent: TailoredContent;
    generatedCvId: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/cv-variants")
      .then((r) => r.json())
      .then((data) => {
        setVariants(data.variants || []);
        if (data.variants?.length) setSelectedSlug(data.variants[0].slug);
      });
  }, []);

  const handleTailor = async () => {
    if (!jobPosting.trim() || !selectedSlug) {
      toast({ title: "Missing input", description: "Please select a CV variant and paste a job posting.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Abort after 90 seconds
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPosting, cvVariantSlug: selectedSlug }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        let errMsg = `Server error (${res.status})`;
        try {
          const err = await res.json();
          errMsg = err.error || err.step
            ? `${err.step ? err.step + ": " : ""}${err.error}`
            : errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      // Defensive: ensure all nested fields exist before setting state
      const safe = {
        cvPdfBase64: data.cvPdfBase64 || "",
        coverLetterPdfBase64: data.coverLetterPdfBase64 || "",
        generatedCvId: data.generatedCvId || "",
        jobAnalysis: {
          jobTitle: data.jobAnalysis?.jobTitle || "Unknown",
          company: data.jobAnalysis?.company || "Unknown",
          location: data.jobAnalysis?.location || "",
          industry: data.jobAnalysis?.industry || "",
          seniority: data.jobAnalysis?.seniority || "",
          tone: data.jobAnalysis?.tone || "",
          keywords: Array.isArray(data.jobAnalysis?.keywords) ? data.jobAnalysis.keywords : [],
          requirements: Array.isArray(data.jobAnalysis?.requirements) ? data.jobAnalysis.requirements : [],
          responsibilities: Array.isArray(data.jobAnalysis?.responsibilities) ? data.jobAnalysis.responsibilities : [],
        },
        tailoredContent: {
          tailoredSummary: data.tailoredContent?.tailoredSummary || "",
          matchedKeywords: Array.isArray(data.tailoredContent?.matchedKeywords) ? data.tailoredContent.matchedKeywords : [],
          missingKeywords: Array.isArray(data.tailoredContent?.missingKeywords) ? data.tailoredContent.missingKeywords : [],
        },
      };
      setResult(safe);
      toast({ title: "CV tailored!", description: `Generated for ${safe.jobAnalysis.jobTitle} at ${safe.jobAnalysis.company}` });
    } catch (err: any) {
      const msg = err.name === "AbortError"
        ? "Request timed out (90s). The AI analysis is taking too long — try a shorter job posting."
        : err.message || "Tailoring failed";
      toast({ title: "CV generation failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = (base64: string, filename: string) => {
    const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1b365d]">
            <Wand2 className="w-5 h-5 text-[#8c7853]" />
            Tailor Your CV
          </CardTitle>
          <CardDescription>
            Paste a job posting and select which CV variant to tailor. The AI will analyze the posting, extract keywords, and generate a tailored LaTeX CV + cover letter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cv-variant">CV Variant</Label>
            <Select value={selectedSlug} onValueChange={setSelectedSlug}>
              <SelectTrigger id="cv-variant">
                <SelectValue placeholder="Select a CV variant" />
              </SelectTrigger>
              <SelectContent>
                {variants.map((v) => (
                  <SelectItem key={v.slug} value={v.slug}>
                    {v.roleTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-posting">Job Posting</Label>
            <Textarea
              id="job-posting"
              placeholder="Paste the full job posting here (title, company, description, requirements)..."
              value={jobPosting}
              onChange={(e) => setJobPosting(e.target.value)}
              className="min-h-[300px] font-mono text-xs"
            />
            <p className="text-xs text-slate-500">{jobPosting.length} characters</p>
          </div>

          <Button
            onClick={handleTailor}
            disabled={loading || !jobPosting.trim() || !selectedSlug}
            className="w-full bg-[#1b365d] hover:bg-[#1b365d]/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing & Tailoring...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Tailored CV + Cover Letter
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#1b365d]">
            <FileText className="w-5 h-5 text-[#8c7853]" />
            Generated Documents
          </CardTitle>
          <CardDescription>
            {result ? "Your tailored CV and cover letter are ready to download." : "Results will appear here after generation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No documents generated yet</p>
            </div>
          )}

          {loading && (
            <div className="space-y-4 py-8">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Job Analysis */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="text-sm font-semibold text-[#1b365d] mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Job Analysis
                </h4>
                <div className="space-y-2 text-xs">
                  <div><span className="text-slate-500">Title:</span> <span className="font-medium">{result.jobAnalysis?.jobTitle || "Unknown"}</span></div>
                  <div><span className="text-slate-500">Company:</span> <span className="font-medium">{result.jobAnalysis?.company || "Unknown"}</span></div>
                  {result.jobAnalysis?.location && <div><span className="text-slate-500">Location:</span> <span className="font-medium">{result.jobAnalysis.location}</span></div>}
                  {result.jobAnalysis?.industry && <div><span className="text-slate-500">Industry:</span> <span className="font-medium">{result.jobAnalysis.industry}</span></div>}
                  {result.jobAnalysis?.seniority && <div><span className="text-slate-500">Seniority:</span> <span className="font-medium capitalize">{result.jobAnalysis.seniority}</span></div>}
                </div>
                {result.jobAnalysis?.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {result.jobAnalysis.keywords.slice(0, 12).map((kw: string) => (
                    <Badge key={kw} variant="secondary" className="text-[10px] bg-[#8c7853]/10 text-[#8c7853]">
                      {kw}
                    </Badge>
                  ))}
                </div>
                )}
              </div>

              {/* Keyword Match */}
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Matched Keywords ({result.tailoredContent?.matchedKeywords?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {(result.tailoredContent?.matchedKeywords || []).map((kw: string) => (
                    <Badge key={kw} className="bg-green-100 text-green-700 text-[10px]">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>

              {(result.tailoredContent?.missingKeywords?.length || 0) > 0 && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Gaps ({result.tailoredContent.missingKeywords.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {result.tailoredContent.missingKeywords.map((kw: string) => (
                      <Badge key={kw} className="bg-amber-100 text-amber-700 text-[10px]">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Download Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => downloadPdf(result.cvPdfBase64, `CV_${(result.jobAnalysis?.jobTitle || "CV").replace(/\s+/g, "_")}.pdf`)}
                  className="bg-[#1b365d] hover:bg-[#1b365d]/90"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CV (PDF)
                </Button>
                <Button
                  onClick={() => downloadPdf(result.coverLetterPdfBase64, `CoverLetter_${(result.jobAnalysis?.company || "Company").replace(/\\s+/g, "_")}.pdf`)}
                  variant="outline"
                  className="border-[#8c7853] text-[#8c7853] hover:bg-[#8c7853]/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Cover Letter (PDF)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JOB HUNTER TAB
// ---------------------------------------------------------------------------
function HunterTab() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchingProfileId, setSearchingProfileId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [minScore, setMinScore] = useState("0");

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/search-profiles");
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?limit=200&minScore=${minScore}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  }, [minScore]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await fetch("/api/search-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Search complete!",
          description: data.results.map((r: any) => `${r.profile}: ${r.saved} saved`).join(" · "),
        });
        loadJobs();
      } else if (data.needsSetup) {
        toast({
          title: "Setup required",
          description: "Add GROQ_API_KEY (console.groq.com) and SERPER_API_KEY (serper.dev) in Vercel Environment Variables. Both are free.",
          variant: "destructive",
        });
      } else {
        throw new Error(data.error || "Search failed");
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSearchSingle = async (profileId: string, profileName: string) => {
    setSearchingProfileId(profileId);
    try {
      const res = await fetch("/api/search-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (data.success) {
        const result = data.results?.[0];
        toast({
          title: `Search complete: ${profileName}`,
          description: result ? `Found ${result.found}, saved ${result.saved} jobs` : "Done",
        });
        loadJobs();
        loadProfiles();
      } else if (data.needsSetup) {
        toast({
          title: "Setup required",
          description: "Add GROQ_API_KEY (console.groq.com) and SERPER_API_KEY (serper.dev) in Vercel Environment Variables. Both are free.",
          variant: "destructive",
        });
      } else {
        throw new Error(data.error || "Search failed");
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearchingProfileId(null);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch("/api/email-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: parseInt(minScore) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Email sent!", description: `${data.sent} jobs sent to your inbox.` });
      } else if (data.needsSetup) {
        toast({
          title: "Email not configured",
          description: "Go to Vercel Settings → Environment Variables and add SMTP_USER (your Gmail) and SMTP_PASS (Gmail App Password from https://myaccount.google.com/apppasswords).",
          variant: "destructive",
        });
      } else {
        toast({ title: "Email not sent", description: data.error || data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Email failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleStatusUpdate = async (jobId: string, status: string) => {
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      loadJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearOldJobs = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/jobs?olderThanDays=30", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Old jobs cleared", description: data.message });
        loadJobs();
      } else {
        toast({ title: "Failed to clear", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Profiles */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#1b365d]">
                <Target className="w-5 h-5 text-[#8c7853]" />
                Search Profiles
              </CardTitle>
              <CardDescription>One profile per CV variant — each searches different keywords and countries.</CardDescription>
            </div>
            <Button onClick={handleSearch} disabled={searching} className="bg-[#1b365d] hover:bg-[#1b365d]/90">
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Search Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingProfiles ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profiles.map((p) => {
                const isThisSearching = searchingProfileId === p.id;
                return (
                  <div key={p.id} className={`p-3 rounded-lg border transition-colors ${isThisSearching ? "border-[#1b365d] bg-[#1b365d]/5" : "border-slate-200 hover:border-[#8c7853]/40"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-[#1b365d] truncate">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{p.cvVariant.roleTitle}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-[#8c7853] text-[#8c7853]">
                        {p.frequency}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {p.keywords.split(",").slice(0, 3).map((k, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                            {k.trim()}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        🌍 {p.countries}
                      </p>
                      {p.lastRunAt && (
                        <p className="text-[10px] text-slate-400">
                          Last run: {new Date(p.lastRunAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSearchSingle(p.id, p.name)}
                      disabled={isThisSearching || searching}
                      className="mt-3 w-full h-7 text-xs bg-[#1b365d] hover:bg-[#1b365d]/90 disabled:opacity-50"
                    >
                      {isThisSearching ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-3 h-3 mr-1" />
                          Run This Search
                        </>
                      )}
                    </Button>
                    {/* Quick Links — always work, even when rate-limited */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-[10px] text-slate-400 w-full mb-0.5">Quick links:</span>
                      {buildQuickLinks(p).map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-[#8c7853]/20 text-slate-600 hover:text-[#8c7853] transition-colors cursor-pointer"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs Found */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#1b365d]">
                <Briefcase className="w-5 h-5 text-[#8c7853]" />
                Job Matches ({jobs.length})
              </CardTitle>
              <CardDescription>Sorted by match score — highest first.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={minScore} onValueChange={setMinScore}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All scores</SelectItem>
                  <SelectItem value="50">50%+</SelectItem>
                  <SelectItem value="60">60%+</SelectItem>
                  <SelectItem value="70">70%+</SelectItem>
                  <SelectItem value="80">80%+</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSendEmail} disabled={sendingEmail} variant="outline" className="border-[#8c7853] text-[#8c7853] hover:bg-[#8c7853]/10">
                {sendingEmail ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Email Digest
              </Button>
              <Button onClick={handleClearOldJobs} disabled={clearing} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 text-xs">
                {clearing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                Clear Old Jobs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingJobs ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <Briefcase className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No jobs found yet</p>
              <p className="text-xs mt-1">Click "Run Search Now" to find jobs matching your profiles.</p>
            </div>
          ) : (
            <div className="max-h-[80vh] overflow-y-auto pr-2">
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onStatusUpdate={handleStatusUpdate} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QUICK LINKS BUILDER — generates direct search URLs for job portals
// These always work, even when the web search API is rate-limited
// ---------------------------------------------------------------------------
function buildQuickLinks(profile: SearchProfile): Array<{ label: string; url: string }> {
  const primaryKeyword = profile.keywords.split(",")[0].trim();
  const primaryCountry = profile.countries.split(",")[0].trim();
  const encodedKeyword = encodeURIComponent(primaryKeyword);
  const encodedLocation = encodeURIComponent(primaryCountry);

  // Determine region-specific portals based on the target country
  const isGCC = /qatar|uae|dubai|abu dhabi|saudi|kuwait|oman|bahrain/i.test(primaryCountry);
  const isEurope = /germany|uk|united kingdom|london|europe|luxembourg/i.test(primaryCountry);
  const isAsia = /pakistan|singapore|india|malaysia/i.test(primaryCountry);
  const isOceania = /new zealand|australia|auckland|sydney|melbourne/i.test(primaryCountry);

  const links: Array<{ label: string; url: string }> = [
    {
      label: "LinkedIn",
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodedKeyword}&location=${encodedLocation}`,
    },
    {
      label: "Indeed",
      url: `https://www.indeed.com/jobs?q=${encodedKeyword}&l=${encodedLocation}`,
    },
    {
      label: "Google Jobs",
      url: `https://www.google.com/search?q=${encodedKeyword}+jobs+${encodedLocation}&ibp=htl;jobs`,
    },
    {
      label: "Glassdoor",
      url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodedKeyword}&locT=C&locId=${encodedLocation}`,
    },
  ];

  // Add region-specific portals
  const isUSA = /usa|united states/i.test(primaryCountry);

  if (isGCC) {
    links.push(
      { label: "Bayt", url: `https://www.bayt.com/en/jobs/q/${encodedKeyword}/` },
      { label: "GulfTalent", url: `https://www.gulftalent.com/jobs/search?keyword=${encodedKeyword}` },
      { label: "Naukri Gulf", url: `https://www.naukrigulf.com/${encodedKeyword}-jobs` }
    );
  }

  if (isUSA) {
    links.push(
      { label: "ZipRecruiter", url: `https://www.ziprecruiter.com/candidate/search?search=${encodedKeyword}&location=${encodedLocation}` },
      { label: "USAJobs", url: `https://www.usajobs.gov/Search/Results?k=${encodedKeyword}` }
    );
  }

  if (isAsia) {
    links.push(
      { label: "Rozee.pk", url: `https://www.rozee.pk/job/jobs/${encodedKeyword}` },
      { label: "Mustakbil", url: `https://www.mustakbil.com/jobs/search?keyword=${encodedKeyword}&city=${encodedLocation}` }
    );
  }

  if (isEurope) {
    links.push(
      { label: "StepStone", url: `https://www.stepstone.de/jobs/${encodedKeyword}` },
      { label: "XING Jobs", url: `https://www.xing.com/jobs/search?keywords=${encodedKeyword}&location=${encodedLocation}` },
      { label: "UK Gov Jobs", url: `https://www.gov.uk/find-a-job` }
    );
  }

  if (isOceania) {
    links.push(
      { label: "Seek AU", url: `https://www.seek.com.au/${encodedKeyword}-jobs` },
      { label: "Seek NZ", url: `https://www.seek.co.nz/${encodedKeyword}-jobs` },
      { label: "TradeMe", url: `https://www.trademe.co.nz/a/jobs/search?q=${encodedKeyword}` }
    );
  }

  // Always add Monster (global)
  links.push({
    label: "Monster",
    url: `https://www.monster.com/jobs/search?q=${encodedKeyword}&where=${encodedLocation}`,
  });

  return links;
}

// ---------------------------------------------------------------------------
// JOB CARD
// ---------------------------------------------------------------------------
function JobCard({ job, onStatusUpdate }: { job: JobPosting; onStatusUpdate: (id: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = job.matchScore >= 80 ? "text-green-600" : job.matchScore >= 60 ? "text-amber-600" : "text-slate-500";
  const scoreBg = job.matchScore >= 80 ? "bg-green-50 border-green-200" : job.matchScore >= 60 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200";

  return (
    <div className={`p-4 rounded-lg border ${scoreBg} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-[#1b365d]">{job.title}</h4>
            <Badge variant="outline" className="text-[10px] uppercase">{job.source}</Badge>
            {job.status !== "new" && (
              <Badge className={
                job.status === "applied" ? "bg-green-100 text-green-700 text-[10px]" :
                job.status === "viewed" ? "bg-blue-100 text-blue-700 text-[10px]" :
                "bg-slate-100 text-slate-600 text-[10px]"
              }>
                {job.status}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {job.company} · {job.location}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Matched to: {job.searchProfile.cvVariant.roleShort} · {new Date(job.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${scoreColor}`}>{job.matchScore}%</div>
          <div className="text-[10px] text-slate-400">match</div>
        </div>
      </div>

      {/* Match rationale (if available) */}
      {job.matches && job.matches.length > 0 && (
        <div className="mt-2 text-xs text-slate-600 bg-white/50 p-2 rounded">
          {job.matches[0].rationale}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          <Eye className="w-3 h-3 mr-1" />
          {expanded ? "Hide" : "Details"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[#1b365d] cursor-pointer"
          onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          View Job
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-green-600"
          onClick={() => onStatusUpdate(job.id, "applied")}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Mark Applied
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-slate-400"
          onClick={() => onStatusUpdate(job.id, "dismissed")}
        >
          Dismiss
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 whitespace-pre-wrap">
          {job.description}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// REMOTE JOBS TAB
// Searches for genuinely remote-friendly roles (QHSE, ISO, Compliance,
// Quality, Safety) in USA, Germany, UK, Australia, Canada.
// ---------------------------------------------------------------------------
interface RemoteJob {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  country: string;
}

const REMOTE_COUNTRIES = ["All Countries", "USA", "Germany", "United Kingdom", "Australia", "Canada"];

function RemoteJobsTab() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<RemoteJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [filterCountry, setFilterCountry] = useState("All");

  const handleSearch = async () => {
    setSearching(true);
    setJobs([]);
    try {
      const body: any = {};
      if (selectedCountry !== "All Countries") body.country = selectedCountry;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const res = await fetch("/api/remote-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
        toast({ title: `Found ${data.jobs.length} remote jobs`, description: selectedCountry !== "All Countries" ? `Filtered to ${selectedCountry}` : "Across all 5 countries" });
      } else {
        throw new Error(data.error || "No remote jobs found");
      }
    } catch (err: any) {
      const msg = err.name === "AbortError" ? "Search timed out. Try again." : err.message;
      toast({ title: "Remote search failed", description: msg, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const filteredJobs = filterCountry === "All" ? jobs : jobs.filter((j) => j.country === filterCountry);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-[#1b365d]/20 bg-gradient-to-br from-[#1b365d] to-[#2d3748] text-white">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#8c7853]" />
            Remote Job Search
          </CardTitle>
          <CardDescription className="text-slate-300">
            Find remote-friendly managerial, director, and senior specialist roles across all industries — USA, Germany, UK, Australia, and Canada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-48 bg-white/10 border-white/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMOTE_COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="bg-[#8c7853] hover:bg-[#8c7853]/90 text-white"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching Remote Jobs...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search Remote Jobs
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#1b365d]">
                <Briefcase className="w-5 h-5 text-[#8c7853]" />
                Remote Jobs Found ({filteredJobs.length})
              </CardTitle>
              <CardDescription>Remote positions from LinkedIn, Indeed, and remote job boards — all industries and functions.</CardDescription>
            </div>
            {jobs.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Countries</SelectItem>
                    <SelectItem value="USA">USA</SelectItem>
                    <SelectItem value="Germany">Germany</SelectItem>
                    <SelectItem value="United Kingdom">UK</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="Global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {searching ? (
            <div className="space-y-3 py-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <Globe className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No remote jobs found yet</p>
              <p className="text-xs mt-1">Click "Search Remote Jobs" to discover remote positions across all industries.</p>
            </div>
          ) : (
            <div className="max-h-[80vh] overflow-y-auto pr-2">
              <div className="space-y-3">
                {filteredJobs.map((job, idx) => (
                  <div key={`${job.url}-${idx}`} className="p-4 rounded-lg border border-slate-200 hover:border-[#8c7853]/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-[#1b365d]">{job.title}</h4>
                          <Badge variant="outline" className="text-[10px] uppercase">{job.source}</Badge>
                          <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Remote</Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {job.company} · {job.location}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {job.country}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{job.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-[#1b365d]"
                        onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Job
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
