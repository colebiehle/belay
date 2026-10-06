"use client";
import { useEffect, useState } from "react";
import { Check, ExternalLink, Plus, X, Search, Mail, Users } from "lucide-react";
import { CompanyLogo, domainFromEnrichment, logoFromEnrichment } from "@/components/CompanyLogo";
import { TierBadge } from "@/components/TierBadge";
import { RoleWorkspace } from "@/components/RoleWorkspace";
import { tierRank } from "@/lib/company-tier";
import { ChipFilterRow } from "@/components/ChipFilterRow";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { STATUSES, OPEN_STATUSES } from "@/lib/statuses";
import { MetaLine } from "@/components/MetaLine";
import { cleanTags, daysAgo, displayCompany, metaTokens } from "@/lib/role-meta";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Job = {
  id: string;
  company: string;
  roleTitle: string;
  jobUrl: string;
  description: string;
  location: string;
  compRange: string;
  expRange: string;
  fitScore: number;
  fitRationale: string;
  greenFlags: string;
  redFlags: string;
  priority: string;
  verdict: string | null;
  verdictNotes: string | null;
  dateFound: string;
  datePosted: string | null;
  dateUpdated: string | null;
  queueEnrichment: string | null;
  enrichedAt: string | null;
  // Derived by /api/jobs from the target list, not stored on the row.
  companyTier?: number | null;
};

type Application = {
  id: string;
  status: string;
  dateApplied: string | null;
  resumeTailored: string | null;
  coverLetterUrl: string | null;
  recruiterMessage: string | null;
  connectionMessage: string | null;
  notes: string | null;
  statusHistory: string | null;
  applicationQA: string | null;
  savedArtifacts: string | null;
  noteList: string | null;
  interviewList: string | null;
  referrerId: string | null;
  updatedAt: string;
  createdAt: string;
  deepDive: string | null;
  needsChecklist: string | null;
  portalUrl: string | null;
  applyStartedAt: string | null;
  resumeContent: string | null;
  coverLetterContent: string | null;
  job: {
    id: string;
    company: string;
    roleTitle: string;
    jobUrl: string;
    compRange: string;
    location: string;
    description: string;
    fitScore: number;
    expRange: string;
    redFlags: string;
    // The panel shows the same headline and tags the queue card did.
    queueEnrichment: string | null;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The stages of an actual job search, in the order they happen. Renamed from the
// old set: "Applying" read as a instruction rather than a state, and "Scheduling
// Interview" / "Interviewing" were a near-identical pair nobody could tell
// apart at a glance.
// Same list. The pipeline renders in this order, so the earliest stage sits at the
// top and a role moves down the page as it progresses — Offer and Rejected end up
// at the bottom, which is where you look least often.
const STATUS_ORDER = STATUSES;

// Six of seven statuses used to share one identical blue, which made "Applying"
// and "Offer" the same object on screen. Colour now tracks how far along the
// application actually is, as one ramp.
//
// The ramp is pink, not blue. Blue is the networking side of the app, and an
// application's own stage chip is the most application-side object there is — the
// contact stage chip on /networking is the blue twin of this.
const STATUS_COLORS: Record<string, string> = {
  Applying: "bg-zinc-800 text-zinc-300",
  Applied: "bg-accent-pink/15 text-accent-pink",
  Screen: "bg-accent-pink/30 text-accent-pink",
  Interviewing: "bg-accent-pink/50 text-black",
  "Final round": "bg-accent-pink/75 text-black",
  Offer: "bg-accent-pink text-black",
  // Off the ramp on purpose: the search ended, and it ended well.
  Accepted: "bg-accent-pink-light text-black",
  // The two ways a role ends badly. Dim on purpose: they are the bottom of the list
  // and the least-looked-at rows, but they are not failures to hide either.
  Rejected: "bg-zinc-900 text-zinc-600",
  Withdrawn: "bg-zinc-900 text-zinc-600",
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApplicationsPage() {
  // "Pipeline" was one bucket holding both "I haven't applied yet" and "Google
  // made me an offer". Splitting it into Applying and Applied is what makes the
  // gap between accepting a role and sending the form a place you can stand in.
  // Two tabs. Applying and Applied were one object at two stages, and separate tabs
  // implied more difference than there was; they are now one Pipeline list with a
  // status chip. "passed" has no tab — the scorer needs the verdicts, you do not
  // need to browse them — but ?tab=passed still reaches it if you ever wants to.
  const [tab, setTab] = useState<"queue" | "pipeline" | "passed">("queue");
  // The workspace is a page-level overlay: one open at a time, addressed by id.
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [highlightJobId, setHighlightJobId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    // ?tab=pipeline still arrives from older links and the dashboard.
    // Old ?tab=applying and ?tab=applied links still land somewhere sensible.
    if (t === "applying" || t === "applied" || t === "pipeline") setTab("pipeline");
    else if (t === "passed") setTab("passed");
    const j = params.get("job");
    if (j) setHighlightJobId(j);
    // ?app=<id> opens straight into one role's workspace, so a link from a contact
    // panel lands on the role rather than on the list that contains it.
    const a = params.get("app");
    if (a) {
      setTab("pipeline");
      setWorkspaceId(a);
    }
  }, []);

  // Queue state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState("");
  // Tier first by default. Score alone ranked an untracked company level with
  // OpenAI, which is the one thing the curated list exists to prevent.
  // Tier is the more useful cut than company: "show me only S and A" is a real
  // question, "show me only Google" mostly is not.
  // One control. Separate "minimum score" and "tier only" selects answered the same
  // question an ordering already answers — if the best are at the top, a floor on the
  // rest is a second thing to set and remember.
  const [queueSort, setQueueSort] = useState<"tier" | "score" | "newest" | "oldest">("tier");
  const [selectedQueueCompanies, setSelectedQueueCompanies] = useState<Set<string>>(new Set());

  // Roles decided in this session. They stay on screen as a thin undo strip
  // rather than vanishing, so a verdict costs one click and is still reversible.
  const [decided, setDecided] = useState<Map<string, string>>(new Map());
  // Keyboard cursor into filteredJobs. Triaging 40+ roles a day by mouse was the
  // single biggest cost in the loop.
  const [cursor, setCursor] = useState(0);
  // The focus ring is the keyboard cursor, so it only shows while navigating by
  // keyboard. Clicking a card used to light it and leave it lit, which read as a
  // selection state the card does not have.
  const [keyboardNav, setKeyboardNav] = useState(false);
  // Companies where a contact already exists, lowercased for matching.
  const [contactCompanies, setContactCompanies] = useState<Set<string>>(new Set());
  // The contacts themselves, so the role panel can name who might refer you.
  const [contacts, setContacts] = useState<{ id: string; name: string; company: string; title: string | null }[]>([]);

  // Ingest button state
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  // Pipeline state
  const [apps, setApps] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [pipelineFilter, setPipelineFilter] = useState("");
  const [selectedPipelineCompanies, setSelectedPipelineCompanies] = useState<Set<string>>(new Set());

  // Passed state
  const [passedJobs, setPassedJobs] = useState<Job[]>([]);
  const [passedLoaded, setPassedLoaded] = useState(false);
  const [passedFilter, setPassedFilter] = useState("");
  const [selectedPassedCompanies, setSelectedPassedCompanies] = useState<Set<string>>(new Set());

  // passedJobs are fetched on mount above so the badge count is accurate immediately

  const passedCompanies = [...new Set(passedJobs.map((j) => j.company))].sort();

  const togglePassedCompany = (co: string) => {
    setSelectedPassedCompanies((prev) => {
      const next = new Set(prev);
      next.has(co) ? next.delete(co) : next.add(co);
      return next;
    });
  };

  const filteredPassed = passedJobs.filter((j) => {
    const matchText =
      !passedFilter ||
      j.company.toLowerCase().includes(passedFilter.toLowerCase()) ||
      j.roleTitle.toLowerCase().includes(passedFilter.toLowerCase()) ||
      (j.verdictNotes ?? "").toLowerCase().includes(passedFilter.toLowerCase());
    const matchCompany = selectedPassedCompanies.size === 0 || selectedPassedCompanies.has(j.company);
    return matchText && matchCompany;
  });

  useEffect(() => {
    if (highlightJobId && !jobsLoading) {
      const el = document.getElementById(`job-${highlightJobId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightJobId, jobsLoading]);

  useEffect(() => {
    fetch("/api/jobs?filter=pending")
      .then((r) => r.json())
      .then((data) => {
        setJobs(data);
        setJobsLoading(false);
      });
    fetch("/api/applications")
      .then((r) => r.json())
      .then((data) => {
        setApps(data);
        setAppsLoading(false);
      });
    fetch("/api/jobs?filter=passed")
      .then((r) => r.json())
      .then((data) => {
        setPassedJobs(data);
        setPassedLoaded(true);
      });
    // Whether you already know someone at the company changes whether a role is
    // worth applying to cold, so it belongs on the card at decision time.
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((cs: { id: string; name?: string | null; company?: string | null; title?: string | null }[]) => {
        setContactCompanies(
          new Set(cs.map((c) => (c.company ?? "").trim().toLowerCase()).filter(Boolean)),
        );
        setContacts(
          cs.map((c) => ({
            id: c.id,
            name: c.name ?? "",
            company: c.company ?? "",
            title: c.title ?? null,
          })),
        );
      })
      .catch(() => {});
  }, []);

  // Counts have to refetch after a verdict or the tab badges stay stale until a
  // reload — accepting a role used to leave "Applying" showing the old number.
  const refreshCounts = () => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then(setApps)
      .catch(() => {});
    fetch("/api/jobs?filter=passed")
      .then((r) => r.json())
      .then(setPassedJobs)
      .catch(() => {});
  };

  const setVerdict = async (id: string, verdict: string, notes: string) => {
    setDecided((prev) => new Map(prev).set(id, verdict));
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, verdictNotes: notes || null }),
    });
    refreshCounts();
    // Deep dive and tailoring deliberately do NOT fire here. They used to run as
    // a chained client-side fire-and-forget on every Accept: a five-minute LLM
    // call tied to the page, with a swallowed catch. Navigating away killed it,
    // which is why three accepted roles sat for six days with empty materials
    // and no way to retry. Generating now belongs to the Applying tab, where it
    // has a visible status and a re-run button.
  };

  const undoVerdict = async (id: string) => {
    setDecided((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: null, verdictNotes: null }),
    });
    refreshCounts();
  };

  // A decided card leaves the list when you say you are done with it, not when the
  // verdict lands: the gap between the two is where the reason gets written, and the
  // reason is the most valuable thing the queue produces.
  const fileDecided = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setDecided((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const annotateVerdict = async (id: string, note: string) => {
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdictNotes: note }),
    });
  };

  const addJob = async () => {
    if (!addUrl) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/jobs/from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobUrl: addUrl }),
    });
    const data = await res.json();
    if (res.ok) {
      setJobs((prev) => [data, ...prev]);
      setAddUrl("");
      setShowAddForm(false);
    } else {
      setAddError(data.error || "Could not add the role");
    }
    setAdding(false);
  };

  // Resolves to an error message, or null on success. A failed PATCH used to be
  // written into the list as if it were the row, which replaced the application
  // with `{ error }` and closed the panel. Now the row is only replaced on success
  // and the caller (the role panel's header edit) can show what went wrong.
  const updateApp = async (id: string, patch: Partial<Application>): Promise<string | null> => {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const updated = await res.json().catch(() => null);
    if (!res.ok || !updated || updated.error) {
      return updated?.error ?? "Could not save.";
    }
    setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return null;
  };

  const sortedApps = [...apps].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return ai - bi;
  });

  const queueCompanies = [...new Set(jobs.map((j) => j.company))].sort();

  const toggleQueueCompany = (co: string) => {
    setSelectedQueueCompanies((prev) => {
      const next = new Set(prev);
      next.has(co) ? next.delete(co) : next.add(co);
      return next;
    });
  };

  const filteredJobs = jobs
    .filter((j) => {
      const matchText =
        !queueFilter ||
        j.company.toLowerCase().includes(queueFilter.toLowerCase()) ||
        j.roleTitle.toLowerCase().includes(queueFilter.toLowerCase());
      const matchCompany = selectedQueueCompanies.size === 0 || selectedQueueCompanies.has(j.company);
      // null tier means untracked, which no tier filter should ever include.
      return matchText && matchCompany;
    })
    .sort((a, b) => {
      if (queueSort === "tier") {
        // Company tier outranks everything; score breaks ties inside a tier.
        // Untracked companies sort last rather than first — see UNTRACKED_RANK.
        const t = tierRank(a.companyTier ?? null) - tierRank(b.companyTier ?? null);
        if (t !== 0) return t;
        const aUnscored = a.enrichedAt ? 0 : 1;
        const bUnscored = b.enrichedAt ? 0 : 1;
        if (aUnscored !== bUnscored) return bUnscored - aUnscored;
        return b.fitScore - a.fitScore;
      }
      if (queueSort === "score") {
        // Unscored rows go to the top rather than the bottom: a role nothing has
        // looked at yet is not a low-scoring role.
        const au = a.enrichedAt ? 0 : 1;
        const bu = b.enrichedAt ? 0 : 1;
        if (au !== bu) return bu - au;
        return b.fitScore - a.fitScore;
      }
      if (queueSort === "newest") return new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime();
      return new Date(a.dateFound).getTime() - new Date(b.dateFound).getTime();
    });

  // Decided rows stay rendered (as an undo strip) but stop counting as pending.
  const pendingJobs = jobs.filter((j) => !decided.has(j.id));

  // What the badge counts, and the same definition the dashboard tile uses. Closed
  // rows stay in the list, grouped at the bottom, but they are not work in flight.
  const activeCount = apps.filter((a) => OPEN_STATUSES.includes(a.status)).length;

  // Keyboard triage. Mouse-only triage cost three clicks per role — expand,
  // verdict, confirm — which is ~129 interactions for a 43-role morning.
  useEffect(() => {
    if (tab !== "queue") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const list = filteredJobs;
      if (list.length === 0) return;
      const clamp = (n: number) => Math.max(0, Math.min(list.length - 1, n));
      const job = list[clamp(cursor)];
      const key = e.key.toLowerCase();
      if (key === "j") {
        e.preventDefault();
        setKeyboardNav(true);
        setCursor((c) => clamp(c + 1));
      } else if (key === "k") {
        e.preventDefault();
        setKeyboardNav(true);
        setCursor((c) => clamp(c - 1));
      } else if (key === "a" && keyboardNav && job) {
        // Gated on keyboardNav: without it, A on a fresh load accepted whatever
        // was at cursor 0 with no ring anywhere on screen. Not gated on being
        // undecided any more — the card stays put now, so A on a passed row is a
        // correction rather than a no-op.
        e.preventDefault();
        if (decided.get(job.id) === "Apply") undoVerdict(job.id);
        else setVerdict(job.id, "Apply", "");
        setCursor((c) => clamp(c + 1));
      } else if (key === "p" && keyboardNav && job) {
        e.preventDefault();
        if (decided.get(job.id) === "Pass") undoVerdict(job.id);
        else setVerdict(job.id, "Pass", "");
        setCursor((c) => clamp(c + 1));
      } else if (key === "u") {
        const last = [...decided.keys()].pop();
        if (last) {
          e.preventDefault();
          undoVerdict(last);
        }
      } else if (key === "o" && job) {
        e.preventDefault();
        window.open(job.jobUrl, "_blank", "noopener");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, filteredJobs, cursor, decided]);

  // Keep the focused card in view as the cursor walks the list.
  useEffect(() => {
    const job = filteredJobs[cursor];
    if (!job) return;
    document
      .getElementById(`job-${job.id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // filteredJobs intentionally omitted: re-scrolling on every list change
    // would yank the page around as verdicts land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // A filter change reshuffles the list under the cursor, so an index from the old
  // list points at the wrong role or past the end of the new one. Reset it.
  useEffect(() => {
    setCursor(0);
  }, [queueFilter, queueSort, selectedQueueCompanies]);

  // ?company=<name> arrives from a contact panel: you are looking at a person and
  // want the roles at their company without hunting for the chip. Its own effect,
  // below the state it sets, rather than folded into the mount effect above.
  useEffect(() => {
    const co = new URLSearchParams(window.location.search).get("company");
    if (!co) return;
    setSelectedQueueCompanies(new Set([co]));
    setSelectedPipelineCompanies(new Set([co]));
    // The Overview's company table also links here, and a company you have only
    // passed on lands on the Passed tab, which should be filtered the same way.
    setSelectedPassedCompanies(new Set([co]));
  }, []);

  const pipelineCompanies = [...new Set(apps.map((a) => a.job.company))].sort();

  const togglePipelineCompany = (co: string) => {
    setSelectedPipelineCompanies((prev) => {
      const next = new Set(prev);
      next.has(co) ? next.delete(co) : next.add(co);
      return next;
    });
  };

  const filteredApps = sortedApps.filter((a) => {
    const matchText =
      !pipelineFilter ||
      a.job.company.toLowerCase().includes(pipelineFilter.toLowerCase()) ||
      a.job.roleTitle.toLowerCase().includes(pipelineFilter.toLowerCase());
    const matchCompany = selectedPipelineCompanies.size === 0 || selectedPipelineCompanies.has(a.job.company);
    return matchText && matchCompany;
  });

  // The same scan the daily run does: every source, every tracked company, then
  // every new role scored.
  const runIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const res = await fetch("/api/ingest/all", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        // Per-source failures live in results.careerPages.perCompany and were
        // never rendered, so a scan where 14 of 22 sources were unreadable looked
        // identical to a clean one.
        const per = (data.results?.careerPages?.perCompany ?? []) as {
          source: string;
          status: string;
        }[];
        const failed = per.filter((r) => /fail|thin|timed out|blocked/i.test(r.status));
        const failNote = failed.length
          ? ` · ${failed.length} unreadable: ${failed.slice(0, 4).map((f) => f.source).join(", ")}${failed.length > 4 ? "…" : ""}`
          : "";
        setIngestMsg((data.summary || "Ingest complete.") + failNote);
        const refreshed = await fetch("/api/jobs?filter=pending").then((r) => r.json());
        setJobs(refreshed);
      } else {
        setIngestMsg(`Failed: ${data.error || "unknown error"}`);
      }
    } catch (err) {
      setIngestMsg(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIngesting(false);
      // No auto-dismiss. This message is the only place the app reports which
      // sources were unreadable and whether the Gmail arm is alive; throwing it
      // away after 15 seconds meant a run where 14 of 22 sources failed looked
      // exactly like a clean one.
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Applications</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {/* The counts live on the tab badges and the keyboard hints were
                learned in a day, so this line only repeated what was already
                on screen twice. */}
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ingestMsg && (
            <span className={`text-xs ${ingestMsg.startsWith("Failed") ? "text-accent-pink" : "text-zinc-400"}`}>
              {ingestMsg}
            </span>
          )}
          {/* One button, and it runs the same scan as the daily schedule, so
              "ingest" means one thing wherever it starts. */}
          <button
            onClick={() => runIngest()}
            disabled={ingesting}
            title="Scan every tracked company's board, plus LinkedIn, the VC boards and Gmail alerts"
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-200 rounded-lg hover:border-accent-pink/50 hover:text-accent-pink disabled:opacity-50 transition-all duration-150"
          >
            <Mail size={14} /> {ingesting ? "Scouring…" : "Run ingest"}
          </button>
          <button
            onClick={() => {
              if (tab !== "queue") setTab("queue");
              setShowAddForm((s) => !s);
            }}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-accent-pink text-black rounded-lg hover:opacity-90 transition-all duration-150 ring-1 ring-accent-pink/30 hover:ring-accent-pink/50"
          >
            <Plus size={14} /> Add role
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("queue")}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-md transition-all duration-150 ${
            tab === "queue"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Queue
          <span className="text-xs px-2 py-0.5 rounded-full font-bold border border-accent-pink text-accent-pink bg-transparent">
            {pendingJobs.length}
          </span>
        </button>
        <button
          onClick={() => setTab("pipeline")}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-md transition-all duration-150 ${
            tab === "pipeline"
              ? "bg-zinc-800 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Pipeline
          <span className="text-xs px-2 py-0.5 rounded-full font-bold border border-accent-pink text-accent-pink bg-transparent">
            {activeCount}
          </span>
        </button>
      </div>

      {/* Queue view */}
      {tab === "queue" && (
        <div className="space-y-4">
          {/* Add job form */}
          {showAddForm && (
            <div className="bg-zinc-900 border border-accent-pink/30 rounded-lg p-5 shadow-lg shadow-accent-pink/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-zinc-100">Add role</h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Paste the posting URL. Claude reads the page, pulls out the company, role and details, scores the fit, and adds it to the queue.
              </p>
              <div className="flex gap-2">
                <input
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 text-sm border border-zinc-700 rounded-md px-3 py-1.5 bg-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent-pink focus:ring-1 focus:ring-accent-pink/30 transition-all duration-150"
                  onKeyDown={(e) => e.key === "Enter" && addJob()}
                />
                <button
                  onClick={addJob}
                  disabled={!addUrl || adding}
                  className="text-sm font-medium px-4 py-1.5 bg-accent-pink text-black rounded-md hover:opacity-90 disabled:opacity-40 transition-all duration-150 shrink-0"
                >
                  {adding ? "Fetching…" : "Add"}
                </button>
              </div>
              {addError && (
                <p className="text-xs text-accent-pink mt-2">{addError}</p>
              )}
            </div>
          )}

          {/* Filter + Sort */}
          {!jobsLoading && jobs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    value={queueFilter}
                    onChange={(e) => setQueueFilter(e.target.value)}
                    placeholder="Filter by company or role…"
                    className="w-full text-sm pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-accent-pink/50 focus:ring-1 focus:ring-accent-pink/20 transition-all duration-150"
                  />
                </div>
                <select
                  value={queueSort}
                  onChange={(e) => setQueueSort(e.target.value as typeof queueSort)}
                  className="text-sm bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-300 focus:outline-none focus:border-accent-pink/50 focus:ring-1 focus:ring-accent-pink/20 transition-all duration-150"
                >
                  <option value="tier">Tier, then score</option>
                  <option value="score">Score</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
              <ChipFilterRow
                items={queueCompanies}
                selected={selectedQueueCompanies}
                onToggle={toggleQueueCompany}
                onClear={() => setSelectedQueueCompanies(new Set())}
              />
            </div>
          )}

          {jobsLoading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : jobs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <p className="text-zinc-500">All caught up. Nothing is waiting for a verdict.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-3 text-sm text-accent-pink hover:text-accent-pink/80 transition-colors duration-150"
              >
                Add a role by URL
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No results for &quot;{queueFilter}&quot;</p>
          ) : (
            // Two per row. The raggedness that drove the single column came from
            // variable-height cards, not from the grid — the cards are a fixed
            // height now, so two up scans better and fits more on screen.
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5" onMouseDown={() => setKeyboardNav(false)}>
              {filteredJobs.map((job, i) => (
                <div key={job.id} id={`job-${job.id}`} className="h-full">
                  <JobCard
                    job={job}
                    verdict={decided.get(job.id) ?? null}
                    onVerdict={setVerdict}
                    onClearVerdict={() => undoVerdict(job.id)}
                    onNote={(note) => annotateVerdict(job.id, note)}
                    onFile={() => fileDecided(job.id)}
                    focused={keyboardNav && i === cursor}
                    onFocus={() => setCursor(i)}
                    hasContact={contactCompanies.has(job.company.trim().toLowerCase())}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Passed view */}
      {tab === "passed" && (
        <div className="space-y-4">
          {passedLoaded && passedJobs.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  value={passedFilter}
                  onChange={(e) => setPassedFilter(e.target.value)}
                  placeholder="Filter by company, role, or reason…"
                  className="w-full text-sm pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-accent-pink/50 focus:ring-1 focus:ring-accent-pink/20 transition-all duration-150"
                />
              </div>
              <ChipFilterRow
                items={passedCompanies}
                selected={selectedPassedCompanies}
                onToggle={togglePassedCompany}
                onClear={() => setSelectedPassedCompanies(new Set())}
              />
            </div>
          )}

          {!passedLoaded ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : passedJobs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <p className="text-zinc-500">No passed roles yet.</p>
            </div>
          ) : filteredPassed.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No results for &quot;{passedFilter}&quot;</p>
          ) : (
            <div className="space-y-2">
              {filteredPassed.map((j) => (
                <PassedRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </div>
      )}

      {workspaceId && (() => {
        const target = apps.find((a) => a.id === workspaceId);
        if (!target) return null;
        return (
          <RoleWorkspace
            app={target}
            contacts={contacts}
            onClose={() => setWorkspaceId(null)}
            onUpdate={(id, patch) => updateApp(id, patch as Partial<Application>)}
          />
        );
      })()}

      {/* Pipeline: Applying and Applied in one list, grouped by status.
          The follow-up panel that used to sit here is gone — most roles never
          need one, and it was occupying the position where search and filters
          belong. Nothing surfaces stale applications now; the follow-up panel was deleted with it. */}
      {tab === "pipeline" && (
        <div className="space-y-4">
          {/* Filter, directly under the tab bar, matching the Queue tab. */}
          {!appsLoading && apps.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  value={pipelineFilter}
                  onChange={(e) => setPipelineFilter(e.target.value)}
                  placeholder="Filter by company or role…"
                  className="w-full text-sm pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-accent-pink/50 focus:ring-1 focus:ring-accent-pink/20 transition-all duration-150"
                />
              </div>
              <ChipFilterRow
                items={pipelineCompanies}
                selected={selectedPipelineCompanies}
                onToggle={togglePipelineCompany}
                onClear={() => setSelectedPipelineCompanies(new Set())}
              />
            </div>
          )}

          {appsLoading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : apps.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <p className="text-zinc-500">
                Nothing here yet. Accept a role in the queue and it lands here.
              </p>
            </div>
          ) : filteredApps.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No results for &quot;{pipelineFilter}&quot;</p>
          ) : (
            <div className="space-y-5">
              {STATUS_ORDER.map((status) => {
                const group = filteredApps.filter((a) => a.status === status);
                if (group.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                        {status}
                      </h3>
                      <span className="text-xs text-zinc-600">{group.length}</span>
                    </div>
                    <div className="space-y-2">
                      {group.map((app) => (
                        <PipelineRow key={app.id} app={app} onUpdate={updateApp} onOpenWorkspace={setWorkspaceId} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue: Job card helpers
// ---------------------------------------------------------------------------

function firstTwoSentences(text: string): string {
  if (!text) return "";
  // Strip leading bullet glyphs (legacy fitRationale values were bulleted)
  const cleaned = text.replace(/^\s*[•\-\*]\s*/gm, "").replace(/\n+/g, " ").trim();
  const matches = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches) return cleaned.slice(0, 240);
  return matches.slice(0, 2).join("").trim();
}

// ---------------------------------------------------------------------------
// Queue: Job card
// ---------------------------------------------------------------------------

// One shape for every row. The card used to carry prose bullets of variable
// length and expand in place, so no two rows were the same height and scanning
// meant reading. It is now fixed: the same fields in the same places, with the
// judgement compressed into at most five tags.
//
// The whole card opens the posting. An icon in the corner was a smaller target
// for the thing you do most, and it left the corner spent on a control rather
// than on the two signals that order the queue.
//
// A verdict no longer swaps the card for a different component. The old DecidedRow
// replaced it with an undo strip, so one decision cost a click to make, a click to
// confirm and a third to dismiss, and the card you had just judged stopped looking
// like the card beside it. Now the two buttons stay exactly where they were, the
// chosen one takes a check, and the lower half becomes the reason box. Clicking the
// checked button clears the verdict; clicking the other switches it.
function JobCard({
  job,
  verdict,
  onVerdict,
  onClearVerdict,
  onNote,
  onFile,
  focused = false,
  onFocus,
  hasContact = false,
}: {
  job: Job;
  verdict: string | null;
  onVerdict: (id: string, verdict: string, notes: string) => void;
  onClearVerdict: () => void;
  onNote: (note: string) => void;
  onFile: () => void;
  focused?: boolean;
  onFocus?: () => void;
  hasContact?: boolean;
}) {
  const [note, setNote] = useState("");

  const accepted = verdict === "Apply";
  const passed = verdict === "Pass";
  const decided = accepted || passed;

  const enrichment = (() => {
    if (!job.queueEnrichment) return null;
    try {
      return JSON.parse(job.queueEnrichment) as {
        headline?: string;
        tags?: string[];
        levelSignals?: string;
        applicationNeeds?: string[];
        // Older rows predate tags; fall back so nothing reads as broken.
        keyPoints?: string[];
        whatItIs?: string;
      };
    } catch {
      return null;
    }
  })();

  const headline = enrichment?.headline ?? enrichment?.whatItIs ?? firstTwoSentences(job.fitRationale ?? "");
  const tags = cleanTags(enrichment?.tags ?? enrichment?.keyPoints);

  const tokens = metaTokens(job);

  // One action, two ways to reach it. Writing the reason and filing the card are the
  // same gesture because they happen together: Enter files it, and the button is the
  // same thing for a hand already on the mouse. Not a second confirm — the verdict is
  // already recorded, this only decides when the card stops taking up space.
  const file = () => {
    if (note.trim()) onNote(note.trim());
    onFile();
  };

  // Company first, role second, both at the top, then the sub-line. The company is
  // the thing the tier ordering is about and the thing that decides whether the role
  // is worth a form at all, so it leads; it also never truncates, because "Appl…" is
  // worse than no company at all.
  const head = (
    <div className="flex items-start gap-2.5 pr-32">
      <CompanyLogo
        company={job.company}
        jobUrl={job.jobUrl}
        domain={domainFromEnrichment(job.queueEnrichment)}
        logo={logoFromEnrichment(job.queueEnrichment)}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100 leading-snug flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{displayCompany(job.company)}</span>
          {/* Blue, because knowing someone here is the networking side reaching into
              this card. Whether you have a way in changes whether the role is worth a
              cold form. */}
          {hasContact && (
            <span className="shrink-0" title="You already know someone here. Ask before applying cold.">
              <Users size={11} className="text-accent-blue" />
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-300 leading-snug line-clamp-1">{job.roleTitle}</p>
        <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 min-w-0">
          <MetaLine tokens={tokens} />
        </p>
      </div>
    </div>
  );

  const lower = decided ? (
    // The reason, in the space the headline and tags had. Full size, because these
    // notes are the most valuable data in the database: they are what teaches the
    // scorer and what became the intake rules. No Save button and no Skip — Enter
    // saves, leaving the box saves, and walking away costs nothing.
    <div className="mt-2 flex-1 min-h-0 flex flex-col">
      <AutoResizeTextarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        // Enter writes a newline. It used to file the card, which is the wrong
        // default for a box whose whole purpose is a sentence or two of reasoning:
        // the keystroke that ends a thought should not also end the row.
        onKeyDown={(e) => e.stopPropagation()}
        // Deliberately NOT autoFocus. It mounts in the slot the card occupied and
        // the global key handler bails on a focused TEXTAREA, so autofocusing it
        // meant the second A of a triage run typed the letter "a" into a note.
        placeholder={accepted ? "Why this one?" : "Why not?"}
        className="flex-1 w-full text-xs bg-transparent text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed"
      />
      <div className="flex justify-end pt-1">
        <button
          onClick={file}
          className="text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
        >
          Done
        </button>
      </div>
    </div>
  ) : (
    <>
      {headline && <p className="mt-2 text-xs text-zinc-400 leading-snug line-clamp-2">{headline}</p>}
      {tags.length > 0 && (
        <div className="mt-auto pt-2 pr-14 flex flex-wrap gap-1 overflow-hidden max-h-[46px]">
          {tags.map((t, i) => (
            <span
              key={i}
              className="text-[11px] leading-tight px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div
      onClick={onFocus}
      className={`relative h-[188px] flex flex-col bg-zinc-900 border rounded-lg transition-all duration-150 ${
        focused
          ? "border-accent-pink/70 ring-1 ring-accent-pink/30"
          : accepted
            ? "border-accent-pink/40"
            : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {decided ? (
        <div className="flex-1 min-h-0 p-3.5 flex flex-col">
          {head}
          {lower}
        </div>
      ) : (
        /* Opens the posting in a background tab: the whole card is the target, and
           blurring the opened window then refocusing this one keeps you in the
           queue instead of following the link. Browsers have the final say, but
           this holds in Chrome off a user gesture. Cmd/ctrl-click and middle-click
           fall through to the browser's own behaviour. */
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            // window.open then blur does not work: Chrome focuses the new tab
            // regardless. Synthesising a cmd/ctrl-click does, because the browser
            // handles "open in a background tab" itself rather than being asked to
            // un-focus after the fact.
            const a = document.createElement("a");
            a.href = job.jobUrl;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.dispatchEvent(
              new MouseEvent("click", { ctrlKey: true, metaKey: true, bubbles: false, cancelable: true }),
            );
          }}
          className="flex-1 min-h-0 p-3.5 flex flex-col"
          title="Open the posting in a background tab"
        >
          {head}
          {lower}
        </a>
      )}

      {/* Both verdicts, always, in the same place. A check marks the one that is
          set; clicking it again clears it. */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => (accepted ? onClearVerdict() : onVerdict(job.id, "Apply", ""))}
          title={accepted ? "Accepted. Click to undo (U)" : "Accept (A)"}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border transition-all duration-150 ${
            accepted
              ? "border-accent-pink bg-accent-pink text-black"
              : `border-accent-pink/50 bg-transparent text-accent-pink hover:bg-accent-pink/10 ${passed ? "opacity-40" : ""}`
          }`}
        >
          {accepted && <Check size={11} />} Accept
        </button>
        <button
          onClick={() => (passed ? onClearVerdict() : onVerdict(job.id, "Pass", ""))}
          title={passed ? "Passed. Click to undo (U)" : "Pass (P)"}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border transition-all duration-150 ${
            passed
              ? "border-zinc-600 bg-zinc-700 text-zinc-100"
              : `border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 ${accepted ? "opacity-40" : ""}`
          }`}
        >
          {passed && <Check size={11} />} Pass
        </button>
      </div>

      {/* The fit score, alone. The posting's age used to sit beside it and parsed as
          part of the same number; it belongs with the facts, so it leads the sub-line
          now. Tier is not here either: the ordering already carries it. */}
      {/* Hidden once a verdict is in: the Done button lives in that corner now, and
          the score has done its job the moment the decision is made. */}
      {job.fitScore > 0 && !decided && (
        <div
          className="absolute bottom-2.5 right-3 text-xs font-bold tabular-nums text-accent-pink pointer-events-none"
          title={`Fit ${job.fitScore}/10 for this role. Improves as you accept and pass.`}
        >
          {job.fitScore}
        </div>
      )}
    </div>
  );
}
// ---------------------------------------------------------------------------
// Passed row
// ---------------------------------------------------------------------------

function PassedRow({ job }: { job: Job }) {
  return (
    <div className="px-3.5 py-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all duration-150">
      <div className="flex items-start gap-3">
        <CompanyLogo
          company={job.company}
          jobUrl={job.jobUrl}
          domain={domainFromEnrichment(job.queueEnrichment)}
          logo={logoFromEnrichment(job.queueEnrichment)}
          size={40}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100 leading-snug">{displayCompany(job.company)}</p>
              <p className="text-xs text-zinc-300 leading-snug truncate">{job.roleTitle}</p>
              <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 min-w-0">
                <MetaLine tokens={metaTokens(job)} />
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TierBadge tier={job.companyTier} />
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-600 hover:text-accent-pink transition-colors duration-150"
                title="Open the posting"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
          {job.verdictNotes && !job.verdictNotes.startsWith("⚠️") && (
            <p className="text-xs text-zinc-400 mt-1.5 italic leading-relaxed">{job.verdictNotes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline: Application row
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Applying: an accepted role that has not been sent yet
// ---------------------------------------------------------------------------

function PipelineRow({
  app,
  onUpdate,
  onOpenWorkspace,
}: {
  app: Application;
  onUpdate: (id: string, patch: Partial<Application>) => void;
  onOpenWorkspace: (id: string) => void;
}) {
  const statusColor = STATUS_COLORS[app.status] ?? "bg-zinc-800 text-zinc-500";
  const tokens = metaTokens(app.job);
  const applying = app.status === "Applying";
  // The gap this closes: accepting a role created a row at "Applying" and nothing
  // ever moved it. All three Applying rows in the database were archived rather than
  // sent, one of them after 63 days. The only exit was a nine-option select, which is
  // a disclosure control, not a verb.
  //
  // Two signals, no new screen. Opening the form stamps applyStartedAt, so "opened
  // 9 days ago, never sent" becomes a thing the row can say. Marking it sent is one
  // button; the PATCH route already stamps dateApplied when the status becomes
  // Applied, so nothing else has to be recorded.
  const openedAge = applying ? daysAgo(app.applyStartedAt) : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all duration-150">
      {/* Collapsed row: glanceable only, and the same top block as the queue card.
          The two used to invert each other — the card led with the role, the row led
          with the company — so the same role read differently on adjacent tabs.
          "accepted 3d ago" / "sent 12d ago" is gone with it: the row is for finding a
          role, and the dates it was actually asking about are in the panel's history,
          where they sit against the stage they belong to. */}
      <div className="flex items-center gap-3 px-3.5 py-3">
        <CompanyLogo
          company={app.job.company}
          jobUrl={app.job.jobUrl}
          domain={domainFromEnrichment(app.job.queueEnrichment)}
          logo={logoFromEnrichment(app.job.queueEnrichment)}
          size={40}
        />
        <button
          onClick={() => onOpenWorkspace(app.id)}
          className="flex-1 min-w-0 text-left"
          title="Open the workspace for this role"
        >
          <p className="text-sm font-semibold text-zinc-100 leading-snug flex items-center gap-1.5">
            <span className="truncate">{displayCompany(app.job.company)}</span>
            {/* The link out follows the primary name, here and in the panel and on
                the contact rows. On an Applying row it is also the "I have started
                this" signal, so the click stamps the date rather than asking for it. */}
            <a
              href={app.portalUrl || app.job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                if (applying && !app.applyStartedAt) {
                  onUpdate(app.id, { applyStartedAt: new Date().toISOString() } as Partial<Application>);
                }
              }}
              className="shrink-0 text-zinc-500 hover:text-accent-pink transition-colors duration-150"
              title={app.portalUrl ? "Open the application portal" : "Open the posting"}
            >
              <ExternalLink size={13} />
            </a>
          </p>
          <p className="text-xs text-zinc-300 leading-snug truncate">{app.job.roleTitle}</p>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 min-w-0">
            <MetaLine tokens={tokens} />
            {openedAge !== null && (
              <>
                <span className="text-zinc-700 shrink-0">·</span>
                <span className={`shrink-0 ${openedAge >= 7 ? "text-alarm" : "text-zinc-600"}`}>
                  {openedAge === 0 ? "form opened today" : `form opened ${openedAge}d ago`}
                </span>
              </>
            )}
          </p>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* One control for the whole progression, so moving a role forward is
              the same gesture at every stage. */}
          <select
            value={app.status}
            onChange={(e) => onUpdate(app.id, { status: e.target.value } as Partial<Application>)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none text-center min-w-[6.5rem] ${statusColor}`}
            style={{ appearance: "none" }}
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      {/* The row used to expand inline to hold the resume, the questions and the
          notes. All of that moved into RoleWorkspace, which opens on the title:
          the work needs a tall surface and a chat beside it, and duplicating it
          here meant two places to keep in step. The row is now glanceable only. */}
    </div>
  );
}

