"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ExternalLink, Plus, Search, Users } from "lucide-react";
import { CompanyLogo, domainFromEnrichment, logoFromEnrichment } from "@/components/CompanyLogo";
import { TierBadge } from "@/components/TierBadge";
import { StageSelect } from "@/components/StageChip";
import { ListCard, TimingLine } from "@/components/ListCard";
import { RoleWorkspace } from "@/components/RoleWorkspace";
import { tierRank } from "@/lib/company-tier";
import { ChipFilterRow } from "@/components/ChipFilterRow";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { STATUSES, OPEN_STATUSES } from "@/lib/statuses";
import { MetaLine } from "@/components/MetaLine";
import { cleanTags, daysAgo, displayCompany, metaTokens, nextInterview, referrerNames } from "@/lib/role-meta";
import { FormFrame, NoMatch, PageHeader, TabBar, headerButton, openInBackgroundTab } from "@/components/PageChrome";
import { button, card, cardSub, cardTitle, emptyBox, input, kbd, listGrid, queueCard, revealLink, tag, textarea, verdictWidth } from "@/lib/ui";

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

/** The pipeline group's element id, the target of ?stage=. "Final round" -> stage-final-round. */
const stageAnchor = (status: string) => `stage-${status.toLowerCase().replace(/\s+/g, "-")}`;

// The status chip is the shared StageChip: one neutral ramp for both sides of the
// app, graded by how far along the application is. It used to be a pink ramp here
// and a blue twin on /networking, which spent a hue on "which side" twice.

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
    // The tab is labelled Active; ?tab=active and the older ?tab=pipeline both land
    // on it. Old ?tab=applying and ?tab=applied links still land somewhere sensible.
    if (t === "applying" || t === "applied" || t === "pipeline" || t === "active") setTab("pipeline");
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
  // The rope border is the keyboard cursor, and it only exists once you start using
  // the keyboard: J or K turns it on, on the card you land on, and a click turns it
  // off. It used to start on the first card, which put an orange box round one card
  // at rest and read as a bug, a selection nobody made (STYLE_GUIDE 4.7). At rest the
  // only rope on the page is the header's primary button.
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

  // ?stage=<status> scrolls the pipeline to that stage's group, so Home's
  // "Upcoming interviews" lands on the interviews rather than the top of the list.
  // A stage with nothing in it falls through to the next one down that has rows.
  // Once per visit: switching tabs and back later should not yank the list again.
  const stageScrolled = useRef(false);
  useEffect(() => {
    const stage = new URLSearchParams(window.location.search).get("stage");
    if (!stage || appsLoading || tab !== "pipeline" || stageScrolled.current) return;
    stageScrolled.current = true;
    const from = STATUS_ORDER.indexOf(stage);
    if (from < 0) return;
    const target = STATUS_ORDER.slice(from).find((s) => document.getElementById(stageAnchor(s)));
    if (target) document.getElementById(stageAnchor(target))?.scrollIntoView({ block: "start" });
  }, [appsLoading, tab]);

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
    // The card shows the decision before the save lands. If the save fails, put the
    // card back undecided rather than leave it looking saved; an uncaught rejection
    // here used to surface as Next's error overlay.
    const ok = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, verdictNotes: notes || null }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (!ok) {
      setDecided((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      return;
    }
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
    }).catch(() => {});
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
  // Home's "not yet sent": accepted, still at Applying, form never went in. The
  // route already leaves archived rows out, which is the other half of that rule.
  const readyToSend = apps.filter((a) => a.status === "Applying" && !a.dateApplied).length;

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
      // The first J or K only shows the cursor where it already is (the first card,
      // or the last one clicked), so the first press never skips a card.
      if (key === "j") {
        e.preventDefault();
        if (keyboardNav) setCursor((c) => clamp(c + 1));
        setKeyboardNav(true);
      } else if (key === "k") {
        e.preventDefault();
        if (keyboardNav) setCursor((c) => clamp(c - 1));
        setKeyboardNav(true);
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
  }, [tab, filteredJobs, cursor, decided, keyboardNav]);

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
        setIngestMsg((data.summary || "Scan done.") + failNote);
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
      {/* Page header. The line under the title is the next action, from the same
          numbers as Home's funnel: roles waiting for a verdict, and accepted roles
          whose form has not gone in. The date that sat here told you nothing the
          menu bar does not. */}
      <PageHeader
        title="Roles"
        parts={
          jobsLoading || appsLoading
            ? null
            : [
                { n: pendingJobs.length, label: "to triage" },
                { n: readyToSend, label: "ready to send" },
              ]
        }
        actions={
          <>
            {ingestMsg && (
              // A failed scan is alarm, and alarm always carries a glyph so it is never
              // told from rope by hue alone.
              <span className={`flex items-center gap-1 text-meta ${ingestMsg.startsWith("Failed") ? "text-alarm" : "text-fg-2"}`}>
                {ingestMsg.startsWith("Failed") && <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth />}
                {ingestMsg}
              </span>
            )}
            {/* One button, and it runs the same scan as the daily schedule, so
                "scan" means one thing wherever it starts. No Mail icon: the label
                already says it, and Gmail is one source of many. */}
            <button
              onClick={() => runIngest()}
              disabled={ingesting}
              title="Scan every tracked company's board, plus LinkedIn, the VC boards and Gmail alerts"
              className={headerButton("secondary")}
            >
              {ingesting ? "Scanning…" : "Scan now"}
            </button>
            <button
              onClick={() => {
                if (tab !== "queue") setTab("queue");
                setShowAddForm((s) => !s);
              }}
              className={headerButton("primary")}
            >
              <Plus size={16} strokeWidth={1.5} absoluteStrokeWidth /> Add role
            </button>
          </>
        }
      />

      <TabBar
        active={tab === "passed" ? null : tab}
        onChange={setTab}
        tabs={[
          { key: "queue", label: "Queue", count: pendingJobs.length, urgent: true },
          { key: "pipeline", label: "Active", count: activeCount },
        ]}
      />

      {/* Queue view */}
      {tab === "queue" && (
        <div className="space-y-4">
          {/* Add role, in the frame every header-triggered form shares (Add people
              and Find people use the same one): title and close, one hint line, the
              field, then the verb on the right of the footer. */}
          {showAddForm && (
            <FormFrame
              title="Add role"
              hint="Paste the posting URL. Claude reads the page, pulls out the company, role and details, scores the fit, and adds it to the queue."
              onClose={() => setShowAddForm(false)}
              status={
                addError && (
                  <p className="flex items-center gap-1 text-meta text-alarm">
                    <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" /> {addError}
                  </p>
                )
              }
              footerEnd={
                <button onClick={addJob} disabled={!addUrl || adding} className={button("secondary")}>
                  {adding ? "Fetching…" : "Add to queue"}
                </button>
              }
            >
              <input
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="https://..."
                autoFocus
                aria-label="Posting URL"
                className={input()}
                onKeyDown={(e) => e.key === "Enter" && addJob()}
              />
            </FormFrame>
          )}

          {/* Filter + Sort */}
          {!jobsLoading && jobs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} strokeWidth={1.5} absoluteStrokeWidth className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
                  <input
                    value={queueFilter}
                    onChange={(e) => setQueueFilter(e.target.value)}
                    placeholder="Filter by company or role…"
                    aria-label="Filter the queue"
                    className={`${input()} pl-8`}
                  />
                </div>
                <select
                  value={queueSort}
                  onChange={(e) => setQueueSort(e.target.value as typeof queueSort)}
                  aria-label="Sort the queue"
                  className={`${input("default", true)} pr-7`}
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
            <p className="text-body text-fg-3">Loading…</p>
          ) : jobs.length === 0 ? (
            // What is missing, then how it fills; one action, and it is the scan,
            // because that is what refills a queue. Adding by URL is in the header.
            <div className={emptyBox}>
              <p>Queue clear. Scan now to look for more.</p>
              <button onClick={() => runIngest()} disabled={ingesting} className={`${button("secondary")} mt-3`}>
                {ingesting ? "Scanning…" : "Scan now"}
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <NoMatch
              query={queueFilter}
              onlyQuery={selectedQueueCompanies.size === 0}
              onClear={() => {
                setQueueFilter("");
                setSelectedQueueCompanies(new Set());
              }}
            />
          ) : (
            // Two per row from 1280px. The raggedness that drove the single column
            // came from variable-height cards, not from the grid — the cards share
            // one shape now (headline clamped to two lines, tags to one), so two up
            // scans better and fits more on screen.
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2" onMouseDown={() => setKeyboardNav(false)}>
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
                <Search size={14} strokeWidth={1.5} absoluteStrokeWidth className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
                <input
                  value={passedFilter}
                  onChange={(e) => setPassedFilter(e.target.value)}
                  placeholder="Filter by company, role or reason…"
                  aria-label="Filter passed roles"
                  className={`${input()} pl-8`}
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
            <p className="text-body text-fg-3">Loading…</p>
          ) : passedJobs.length === 0 ? (
            <div className={emptyBox}>
              <p>No passed roles yet. Pass a role in the queue and it lands here with your reason.</p>
            </div>
          ) : filteredPassed.length === 0 ? (
            <NoMatch
              query={passedFilter}
              onlyQuery={selectedPassedCompanies.size === 0}
              onClear={() => {
                setPassedFilter("");
                setSelectedPassedCompanies(new Set());
              }}
            />
          ) : (
            // One container, rows divided by hairlines, the same as every list.
            <div className={`${card} divide-y divide-line-1 overflow-hidden`}>
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
                <Search size={14} strokeWidth={1.5} absoluteStrokeWidth className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
                <input
                  value={pipelineFilter}
                  onChange={(e) => setPipelineFilter(e.target.value)}
                  placeholder="Filter by company or role…"
                  aria-label="Filter active roles"
                  className={`${input()} pl-8`}
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
            <p className="text-body text-fg-3">Loading…</p>
          ) : apps.length === 0 ? (
            <div className={emptyBox}>
              <p>No active roles yet. Accept a role in the queue and it lands here.</p>
            </div>
          ) : filteredApps.length === 0 ? (
            <NoMatch
              query={pipelineFilter}
              onlyQuery={selectedPipelineCompanies.size === 0}
              onClear={() => {
                setPipelineFilter("");
                setSelectedPipelineCompanies(new Set());
              }}
            />
          ) : (
            // A grid of cards per stage: three across at 1440, two at about 1024, one
            // on a phone. They were 56px rows in one container; as cards the logo is
            // big enough to read and the facts stack instead of trailing across an
            // empty middle. The group header sticks under the nav so a long Applied
            // group still says which group you are in.
            <div className="space-y-6">
              {STATUS_ORDER.map((status) => {
                const group = filteredApps.filter((a) => a.status === status);
                if (group.length === 0) return null;
                return (
                  <div key={status} id={stageAnchor(status)} className="scroll-mt-14">
                    <div className="sticky top-12 z-[5] bg-canvas flex items-center gap-2 h-8">
                      <h3 className="t-group">{status}</h3>
                      <span className="text-meta tabular-nums text-fg-3">{group.length}</span>
                    </div>
                    <div className={listGrid}>
                      {group.map((app) => (
                        <PipelineCard
                          key={app.id}
                          app={app}
                          contacts={contacts}
                          selected={app.id === workspaceId}
                          onUpdate={updateApp}
                          onOpenWorkspace={setWorkspaceId}
                        />
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
  // worse than no company at all. The 32px logo tile is where the company's colour
  // lives on the card, and the only place.
  const head = (
    <div className="flex items-start gap-3">
      <CompanyLogo
        company={job.company}
        jobUrl={job.jobUrl}
        domain={domainFromEnrichment(job.queueEnrichment)}
        logo={logoFromEnrichment(job.queueEnrichment)}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <p className={`${cardTitle} flex items-center gap-1.5 min-w-0`}>
          <span className="truncate">{displayCompany(job.company)}</span>
          {/* The mutuals glyph: knowing someone here changes whether the role is
              worth a cold form. Neutral, with its meaning in the tooltip; it used to
              be the networking side's blue. */}
          {hasContact && (
            <span className="shrink-0 text-fg-2" title="You already know someone here. Ask before applying cold.">
              <Users size={14} strokeWidth={1.5} absoluteStrokeWidth />
            </span>
          )}
        </p>
        <p className={cardSub}>{job.roleTitle}</p>
      </div>
      {/* The fit score, alone, in plain mono: no colour scale, because the queue is
          already sorted by it. "/10" in the dim step says what it is out of, so the
          number reads as a mark rather than a count. The posting's age used to sit
          beside it and parsed as part of the same number; it belongs with the facts
          on the meta line. It stays in every state: it covers nothing, and a card that
          loses its number on a click looks like a different card. */}
      {job.fitScore > 0 && (
        <span
          className="font-mono text-data text-fg-1 shrink-0"
          title={`Fit ${job.fitScore}/10 for this role. Improves as you accept and pass.`}
        >
          {job.fitScore}
          <span className="text-fg-3">/10</span>
        </span>
      )}
    </div>
  );

  const meta = (
    <p className="mt-1 text-meta text-fg-3 flex items-center gap-1.5 min-w-0">
      <MetaLine tokens={tokens} />
    </p>
  );

  const lower = decided ? (
    // The reason, in the space the headline and tags had. Full size, because these
    // notes are the most valuable data in the database: they are what teaches the
    // scorer and what became the intake rules. No Save button and no Skip — leaving
    // the box saves, Done files the card, and walking away costs nothing.
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
        aria-label={accepted ? "Why this one?" : "Why not?"}
        className={`${textarea()} flex-1`}
      />
    </div>
  ) : (
    headline && <p className="mt-2 text-body text-fg-1 line-clamp-2">{headline}</p>
  );

  // Accept is secondary on every card; once the keyboard cursor is showing (after J
  // or K), the card under it turns Accept primary, so the orange marks exactly where A
  // will land. At rest there is no cursor and no rope on any card. Pass is quiet: it
  // is the common verdict but never the next move. A set verdict shows a check and a
  // lift fill, and both buttons keep one width throughout (verdictWidth).
  const verdictButton = (kind: "Apply" | "Pass") => {
    const on = kind === "Apply" ? accepted : passed;
    const other = kind === "Apply" ? passed : accepted;
    const label = kind === "Apply" ? "Accept" : "Pass";
    const key = kind === "Apply" ? "A" : "P";
    const look =
      kind === "Apply" && focused && !decided
        ? button("primary", "compact")
        : `${button(kind === "Apply" ? "secondary" : "quiet", "compact")} ${on ? "bg-lift text-fg-1" : ""} ${other ? "text-fg-3" : ""}`;
    return (
      <button
        onClick={() => (on ? onClearVerdict() : onVerdict(job.id, kind, ""))}
        title={on ? `${kind === "Apply" ? "Accepted" : "Passed"}. Click to undo (U)` : `${label} (${key})`}
        className={`${look} ${verdictWidth}`}
      >
        {on && <Check size={14} strokeWidth={1.5} absoluteStrokeWidth />} {label}
        {focused && !decided && <span className={`${kbd} ${kind === "Apply" ? "border-on-rope/30 text-on-rope" : ""}`}>{key}</span>}
      </button>
    );
  };

  return (
    <div
      data-queue-card
      onClick={onFocus}
      // The frame both queues share (lib/ui queueCard): the rope border only under
      // the keyboard cursor, a transparent one holding its place otherwise.
      className={queueCard(focused)}
    >
      {decided ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {head}
          {meta}
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
            openInBackgroundTab(job.jobUrl);
          }}
          className="flex-1 min-h-0 flex flex-col rounded-control"
          title="Open the posting in a background tab (O)"
        >
          {head}
          {meta}
          {lower}
        </a>
      )}

      {/* The bottom row: the judgement compressed into at most five tags, then both
          verdicts, always, in the same place. A check marks the one that is set;
          clicking it again clears it. Once decided, Done takes the tags' place. */}
      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {decided ? (
          <button onClick={file} className={`${button("quiet", "compact")} -ml-2.5`}>
            Done
          </button>
        ) : (
          <div className="flex flex-wrap gap-1 overflow-hidden max-h-5 min-w-0">
            {tags.slice(0, 5).map((t, i) => (
              <span key={i} className={tag}>
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {verdictButton("Pass")}
          {verdictButton("Apply")}
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Passed row
// ---------------------------------------------------------------------------

function PassedRow({ job }: { job: Job }) {
  return (
    <div className="group/row flex items-start gap-3 px-3 py-3 hover:bg-lift transition-colors duration-90 ease-enter">
      <CompanyLogo
        company={job.company}
        jobUrl={job.jobUrl}
        domain={domainFromEnrichment(job.queueEnrichment)}
        logo={logoFromEnrichment(job.queueEnrichment)}
        size={24}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-name text-fg-1 flex items-center gap-1.5">
              {displayCompany(job.company)}
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={revealLink}
                title="Open the posting"
                aria-label="Open the posting"
              >
                <ExternalLink size={14} strokeWidth={1.5} absoluteStrokeWidth />
              </a>
            </p>
            <p className="text-meta text-fg-3 truncate">
              {job.roleTitle}
              <span className="text-fg-4 mx-1">·</span>
              <MetaLine tokens={metaTokens(job)} />
            </p>
          </div>
          <TierBadge tier={job.companyTier} />
        </div>
        {/* Your reason, in your words: body text, not italic, because it is the
            most useful line on the row. */}
        {job.verdictNotes && !job.verdictNotes.startsWith("⚠️") && (
          <p className="text-body text-fg-2 mt-1">{job.verdictNotes}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active: application card
// ---------------------------------------------------------------------------

/** "Thu, Oct 9": an interview's day, inline, so Archivo with tabular figures. */
function interviewDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// What you did to reach each stage, as the verb on the card's timing line: "Applied
// Oct 3 · 3d ago". Applying is the role you accepted from the queue; the interview
// stages are spans, so they say since when.
const STAGE_VERB: Record<string, string> = {
  Applying: "Accepted",
  Applied: "Applied",
  Screen: "Screened",
  Interviewing: "Interviewing since",
  "Final round": "Final round since",
  Offer: "Offer",
  Accepted: "Accepted",
  Rejected: "Rejected",
  Withdrawn: "Withdrew",
};

function PipelineCard({
  app,
  contacts,
  selected = false,
  onUpdate,
  onOpenWorkspace,
}: {
  app: Application;
  contacts: { id: string; name: string }[];
  selected?: boolean;
  onUpdate: (id: string, patch: Partial<Application>) => void;
  onOpenWorkspace: (id: string) => void;
}) {
  const applying = app.status === "Applying";
  // The gap this closes: accepting a role created a row at "Applying" and nothing
  // ever moved it. All three Applying rows in the database were archived rather than
  // sent, one of them after 63 days. Opening the form stamps applyStartedAt, so
  // "form opened 9d ago, not sent" becomes a thing the card can say. Only the stall
  // is said: from 7 days it is something to do (send it or archive it); under that,
  // and "not opened yet", were facts with nothing to act on.
  const openedAge = applying ? daysAgo(app.applyStartedAt) : null;
  // When the role reached its current stage, from the last history entry for it; an
  // Applying role with no history counts from when it was accepted. Display only;
  // nothing is recorded.
  const stageAt = (() => {
    try {
      const h = JSON.parse(app.statusHistory ?? "[]") as { status?: string; at?: string }[];
      const last = Array.isArray(h) ? [...h].reverse().find((e) => e?.status === app.status) : undefined;
      const iso = last?.at ?? (applying ? app.createdAt : null);
      if (!iso) return null;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  })();
  // The next interview still to come, if one is booked.
  const upcoming = nextInterview(app.interviewList);
  // Who is putting your name in: a contact's id, or a name noted without a row
  // behind it (see the role panel's Referral section).
  const referrers = referrerNames(app.referrerId, contacts);

  // The facts under the names, one per line, in the order they matter: when this
  // stage started, the stall if there is one, the next interview, the referral.
  // Each line is there only when it has something to say.
  const lines: ReactNode[] = [];
  if (stageAt) {
    lines.push(
      <TimingLine
        key="at"
        verb={STAGE_VERB[app.status] ?? app.status}
        at={stageAt}
        title={`Moved to ${app.status} on ${stageAt.toLocaleDateString()}. From the stage change in its history.`}
      />,
    );
  }
  if (openedAge !== null && openedAge >= 7) {
    // Alarm, with the glyph as well as the words, never the hue alone (2.4).
    lines.push(
      <span key="form" className="flex items-center gap-1 text-alarm truncate" title="You opened the form from Belay and have not marked it sent.">
        <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" />
        Form opened {openedAge}d ago, not sent
      </span>,
    );
  }
  if (upcoming) {
    const at = new Date(upcoming.at);
    lines.push(
      <span key="iv" className="truncate text-fg-2" title={`Interview ${at.toLocaleString()}`}>
        Interview {interviewDate(at)}
        {upcoming.label && <span className="text-fg-3"> · {upcoming.label}</span>}
      </span>,
    );
  }
  if (referrers.length > 0) {
    lines.push(
      <span key="ref" className="flex items-center gap-1 min-w-0 text-fg-2">
        <Users size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0 text-fg-3" />
        <span className="truncate">Referred by {referrers.join(", ")}</span>
      </span>,
    );
  }

  return (
    <ListCard
      logo={
        <CompanyLogo
          company={app.job.company}
          jobUrl={app.job.jobUrl}
          domain={domainFromEnrichment(app.job.queueEnrichment)}
          logo={logoFromEnrichment(app.job.queueEnrichment)}
          size={40}
        />
      }
      name={displayCompany(app.job.company)}
      sub={app.job.roleTitle}
      // The link out follows the primary name. On an Applying role it is also the "I
      // have started this" signal, so the click stamps the date rather than asking.
      link={{
        href: app.portalUrl || app.job.jobUrl,
        title: app.portalUrl ? "Open the application form" : "Open the posting",
        onClick: () => {
          if (applying && !app.applyStartedAt) {
            onUpdate(app.id, { applyStartedAt: new Date().toISOString() } as Partial<Application>);
          }
        },
      }}
      lines={lines}
      stage={
        <StageSelect
          value={app.status}
          options={STATUSES}
          onChange={(next) => onUpdate(app.id, { status: next } as Partial<Application>)}
        />
      }
      selected={selected}
      onOpen={() => onOpenWorkspace(app.id)}
      openTitle="Open the workspace for this role"
    />
  );
}
