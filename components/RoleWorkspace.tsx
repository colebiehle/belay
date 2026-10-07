"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { logDate, calendarDays } from "@/lib/dates";
import { AlertTriangle, ArrowLeft, ExternalLink, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { CompanyLogo, domainFromEnrichment, getLogoDomain, logoFromEnrichment } from "@/components/CompanyLogo";
import { useBrandColor } from "@/lib/use-brand-color";
import { usableAccent } from "@/lib/brand-colors";
import { button, card as cardClass, iconButton, input as field, sectionHead, tag as tagClass, textarea, toggle, washOf, brandLine, brandEdge, historyDot, historyDotColor, headerLink, panelTab, panelTabLine } from "@/lib/ui";
import { StageSelect } from "@/components/StageChip";
import { MetaLine } from "@/components/MetaLine";
import { cleanTags, displayCompany, isContactId, metaTokens, parseReferrers } from "@/lib/role-meta";
import { formLink } from "@/components/PageChrome";
import { PersonPicker } from "@/components/PersonPicker";
import { PasteAnything, type PasteRow } from "@/components/PasteAnything";
import { restrictionLine } from "@/lib/portal-limits";
import { STATUSES } from "@/lib/statuses";
import { canonicalCompany } from "@/lib/role-filter";

/**
 * The per-role panel. Two tabs, holding genuinely different kinds of thing.
 *
 * **Details** is the record: the facts of the role, where it sits in the process,
 * the meta that accumulates (who could refer you, which resume you sent), the
 * files, and titled notes. Notes here are authored — one per recruiter call, one
 * per question you are working through.
 *
 * **Chat** is a scratchpad. It gets used and mostly thrown away; your read is
 * that you would never save a whole conversation, only the line or paragraph that
 * came out of it. So saving works by selection: highlight text anywhere in the
 * transcript and a Save affordance appears beside it, starting a new note or
 * appending to one that exists. The chat stays disposable, the notes keep what
 * survived. That is why they are separate tabs rather than one merged surface,
 * which is what the previous version got wrong.
 *
 * Scope chips sit by the composer because all they do is pick which thread a
 * message lands in; the API already keeps one thread per scope.
 */

type SavedArtifact = {
  kind: string;
  label: string;
  savedAt: string;
  content?: string;
  fileName?: string;
  dataUrl?: string;
};
type Note = { id: string; title: string; body: string; createdAt: string };
type Interview = { id: string; label: string; at: string; notes?: string };
type ChatMsg = { id: string; role: string; content: string; createdAt: string };

type App = {
  id: string;
  status: string;
  dateApplied: string | null;
  savedArtifacts: string | null;
  noteList: string | null;
  interviewList: string | null;
  statusHistory: string | null;
  referrerId: string | null;
  portalUrl: string | null;
  applyStartedAt: string | null;
  // A free-text line of your own about this role. Distinct from noteList, which is
  // titled notes about events; this is the standing description the generated
  // headline cannot know.
  notes: string | null;
  job: {
    company: string;
    roleTitle: string;
    jobUrl: string;
    location: string;
    compRange: string;
    expRange: string;
    queueEnrichment?: string | null;
  };
};

/**
 * What a scope is for: setting the context once for a thing you do repeatedly,
 * so you do not re-explain the task every time. Default is none — plain chat
 * about the role — because most questions do not need a mode.
 */
const SCOPES: { key: string | null; label: string; hint: string }[] = [
  { key: null, label: "No context set", hint: "Ask anything about this role." },
  { key: "resume", label: "Tailoring my resume", hint: "What to change in the base resume for this one. You get line-level edits to apply yourself." },
  { key: "questions", label: "Answering a form question", hint: "Paste the prompt as the form words it, then your rough thoughts." },
  { key: "portfolio", label: "Choosing portfolio work", hint: "Which projects and case studies to lead with for this role." },
  { key: "outreach", label: "Networking and outreach", hint: "Who to reach here and what to send them." },
];

/**
 * Scopes that only exist once the application has reached a stage where they
 * apply, so the list stays short early and grows with the process.
 */
const SCOPES_LATE: { key: string; label: string; hint: string; from: string[] }[] = [
  {
    key: "followup",
    label: "Following up",
    hint: "Nudging after silence, or replying to a recruiter.",
    from: ["Applied", "Screen", "Interviewing", "Final round", "Offer"],
  },
  {
    key: "prep",
    label: "Interview prep",
    hint: "Practise questions, portfolio framing, what this team will probe on.",
    from: ["Screen", "Interviewing", "Final round"],
  },
  {
    key: "debrief",
    label: "Debriefing an interview",
    hint: "What happened, what to fix, what to send after.",
    from: ["Screen", "Interviewing", "Final round"],
  },
  {
    key: "offer",
    label: "Reading an offer",
    hint: "The numbers, what to ask for, how to compare it.",
    from: ["Offer", "Accepted"],
  },
];




function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function RoleWorkspace({
  app,
  contacts,
  onClose,
  onUpdate,
}: {
  app: App;
  contacts: { id: string; name: string; company: string; title: string | null }[];
  onClose: () => void;
  // Resolves to an error message (or null) where the caller reports one. Most
  // edits here fire and forget; the header edit waits on it, because a posting URL
  // another role already has is refused and the editor should stay open to say so.
  onUpdate: (id: string, patch: Record<string, unknown>) => void | Promise<string | null | void>;
}) {
  const [tab, setTab] = useState<"details" | "chat">("details");
  const [scope, setScope] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedArtifact[]>(() =>
    parseJson<SavedArtifact[]>(app.savedArtifacts, []),
  );
  const [notes, setNotes] = useState<Note[]>(() => parseJson<Note[]>(app.noteList, []));
  const [interviews, setInterviews] = useState<Interview[]>(() =>
    parseJson<Interview[]>(app.interviewList, []),
  );
  const [addingInterview, setAddingInterview] = useState(false);
  const [editingTldr, setEditingTldr] = useState(false);
  const [tldrDraft, setTldrDraft] = useState(app.notes ?? "");
  // The header's facts: the job's own role title, company and posting URL. They
  // came from whatever the ingest scraped, so a mangled title or an alert-mail
  // company name stayed wrong for the life of the role. Same pattern as the person
  // panel: click the primary name to edit in place.
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({ company: "", roleTitle: "", jobUrl: "" });
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerSaving, setHeaderSaving] = useState(false);
  const startHeaderEdit = () => {
    setHeaderDraft({ company: app.job.company, roleTitle: app.job.roleTitle, jobUrl: app.job.jobUrl });
    setHeaderError(null);
    setEditingHeader(true);
  };
  const saveHeader = async () => {
    // Canonicalised the way ingest does it, so "Google LLC" typed here still
    // dedupes and filters with the Google roles that came in from scans.
    const company = canonicalCompany(headerDraft.company.trim());
    const roleTitle = headerDraft.roleTitle.trim();
    const jobUrl = headerDraft.jobUrl.trim();
    // All three are required on Job, and jobUrl is its unique key, so none can be blank.
    if (!company || !roleTitle || !jobUrl || headerSaving) return;
    // Only what changed, so an untouched jobUrl never trips its own unique check.
    const update: Record<string, string> = {};
    if (company !== app.job.company) update.company = company;
    if (roleTitle !== app.job.roleTitle) update.roleTitle = roleTitle;
    if (jobUrl !== app.job.jobUrl) update.jobUrl = jobUrl;
    if (Object.keys(update).length === 0) {
      setEditingHeader(false);
      return;
    }
    setHeaderSaving(true);
    setHeaderError(null);
    const err = await onUpdate(app.id, { job: { update } });
    setHeaderSaving(false);
    if (err) {
      setHeaderError(err);
      return;
    }
    setEditingHeader(false);
  };
  // The one fact about an application that is not on the posting: where the form
  // actually lives, when it is not the posting itself. It was only settable from a
  // detail page nothing linked to, so it was null on every row while the header link
  // quietly fell back to the job URL.
  const [portalDraft, setPortalDraft] = useState(app.portalUrl ?? "");
  const saveTldr = () => {
    onUpdate(app.id, {
      notes: tldrDraft.trim() || null,
      portalUrl: portalDraft.trim() || null,
    });
    setEditingTldr(false);
  };
  const [shown, setShown] = useState(false);
  // The pending selection from the transcript, and where its Save chip should sit.
  const [pick, setPick] = useState<{ text: string; top: number } | null>(null);
  // Transcript index -> the action switched into at that point. Local to the
  // session: a marker is a reading aid, not a record worth a column.
  const [markers, setMarkers] = useState<Record<number, string>>({});
  // The note being read. Notes are a list of titles until one is opened, the way
  // a mail client works, because a panel of expanded note bodies is unreadable
  // once there are more than two.
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  // The referral adder: closed, picking someone from the network, or noting a name
  // for someone who is not in it. A plus that reveals a picker reads as "add one or
  // more"; a permanent dropdown reads as "choose exactly one".
  const [adding, setAdding] = useState<false | "pick" | "name">(false);
  const [referrerDraft, setReferrerDraft] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  // A save from the chat is staged rather than immediate: a new note gets titled
  // first, an append shows where the text is going, and either way you confirms.
  const [staged, setStaged] = useState<{ text: string; target: string | null; title: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Scopes that only make sense at a stage appear at that stage, so the chip row
  // stays short early on and grows as the application actually progresses.
  const scopes = [
    ...SCOPES,
    ...SCOPES_LATE.filter((sc) => sc.from.includes(app.status)).map(({ key, label, hint }) => ({ key, label, hint })),
  ];
  const active = scopes.find((sc) => sc.key === scope) ?? scopes[0];
  const logoDomain = getLogoDomain(
    app.job.company,
    app.job.jobUrl,
    domainFromEnrichment(app.job.queueEnrichment),
  );
  const brand = useBrandColor(logoDomain, logoFromEnrichment(app.job.queueEnrichment));
  // The company's colour, for the header band and wash only. Every control in the
  // panel used to take it (Save, links, input borders, the stage chip, the left
  // border), which made each company's panel a different app.
  const brandHex = brand ? usableAccent(brand) : null;

  const enrichment = parseJson<{
    headline?: string;
    tags?: string[];
    levelSignals?: string;
    applicationNeeds?: string[];
  }>(app.job.queueEnrichment, {});

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // One transcript. The scope shapes the prompt for the message being sent; it
  // does not filter what is shown, so the conversation reads as one session of
  // work on this application rather than six disconnected threads.
  const loadChat = () =>
    fetch(`/api/applications/${app.id}/chat?all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMessages(Array.isArray(d) ? d : []))
      .catch(() => setMessages([]));

  useEffect(() => {
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);

  useEffect(() => {
    if (tab === "chat") scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending, tab]);

  const close = () => {
    setShown(false);
    setTimeout(onClose, 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchScope = (next: string | null) => {
    if (next === scope) return;
    setScope(next);
    const label = scopes.find((sc) => sc.key === next)?.label;
    if (label && messages.length > 0) setMarkers((m) => ({ ...m, [messages.length]: label }));
  };

  const persistInterviews = (next: Interview[]) => {
    // Sorted so the next one is always first, which is the only order that matters
    // when you are looking at this to find out what is coming up.
    const sorted = [...next].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    setInterviews(sorted);
    onUpdate(app.id, { interviewList: JSON.stringify(sorted) });
  };

  const persistNotes = (next: Note[]) => {
    setNotes(next);
    onUpdate(app.id, { noteList: JSON.stringify(next) });
  };

  // "Paste anything": the route proposes, these show the proposal against what is on
  // file and then write what was kept. One PATCH for all of it, because the page
  // replaces this row with each response and two in flight can land out of order.
  // Comp lives on the Job, so it goes as a nested update through the same PATCH.
  const describePaste = (u: Record<string, unknown>): PasteRow[] => {
    const rows: PasteRow[] = [];
    if (typeof u.status === "string" && u.status !== app.status)
      rows.push({ key: "status", label: "Stage", from: app.status, to: u.status });
    if (Array.isArray(u.interviews))
      (u.interviews as { label: string; at: string }[]).forEach((iv, i) =>
        rows.push({
          key: `interview:${i}`,
          label: "New interview",
          from: null,
          to: `${new Date(iv.at).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}${iv.label ? ` · ${iv.label}` : ""}`,
        }),
      );
    if (typeof u.compRange === "string" && u.compRange !== app.job.compRange)
      rows.push({ key: "compRange", label: "Comp", from: app.job.compRange || null, to: u.compRange });
    if (typeof u.portalUrl === "string" && u.portalUrl !== app.portalUrl)
      rows.push({ key: "portalUrl", label: "Form link", from: app.portalUrl, to: u.portalUrl });
    return rows;
  };

  const applyPaste = (
    p: { updates: Record<string, unknown>; note: { title: string; body: string } | null },
    kept: Set<string>,
  ) => {
    const u = p.updates;
    const patch: Record<string, unknown> = {};
    if (kept.has("status")) patch.status = u.status;
    if (kept.has("portalUrl")) patch.portalUrl = u.portalUrl;
    if (kept.has("compRange")) patch.job = { update: { compRange: u.compRange } };
    const newInterviews = (Array.isArray(u.interviews) ? (u.interviews as { label: string; at: string }[]) : [])
      .filter((_, i) => kept.has(`interview:${i}`))
      .map((iv, i) => ({ id: `i${Date.now()}${i}`, label: iv.label, at: new Date(iv.at).toISOString() }));
    if (newInterviews.length) {
      const sorted = [...interviews, ...newInterviews].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      );
      setInterviews(sorted);
      patch.interviewList = JSON.stringify(sorted);
    }
    if (p.note) {
      const next = [...notes, { id: `n${Date.now()}`, ...p.note, createdAt: new Date().toISOString() }];
      setNotes(next);
      patch.noteList = JSON.stringify(next);
    }
    if (Object.keys(patch).length > 0) onUpdate(app.id, patch);
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setError(null);
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await fetch(`/api/applications/${app.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, cellKey: scope }),
      });
      if (!res.ok) throw new Error(`Chat failed (HTTP ${res.status})`);
      await loadChat();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const attach = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Could not read that file"));
      r.readAsDataURL(file);
    });
    const next = [
      ...saved,
      { kind: scope ?? "role", label: file.name, fileName: file.name, dataUrl, savedAt: new Date().toISOString() },
    ];
    setSaved(next);
    onUpdate(app.id, { savedArtifacts: JSON.stringify(next) });
  };

  // Selection inside the transcript is the save gesture. Read on mouseup so it
  // stays out of the way until something is actually highlighted.
  const onTranscriptMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || !scrollRef.current || !sel?.rangeCount) {
      setPick(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const box = scrollRef.current.getBoundingClientRect();
    setPick({ text, top: rect.top - box.top + scrollRef.current.scrollTop });
  };

  // Staging rather than saving. A new note gets a title first; an append names its
  // destination. Either way it takes a second click, so a stray highlight never
  // silently writes into a note.
  const commitStaged = () => {
    if (!staged) return;
    if (staged.target) {
      persistNotes(
        notes.map((n) =>
          n.id === staged.target
            ? { ...n, body: `${n.body}${n.body ? "\n\n" : ""}${staged.text}` }
            : n,
        ),
      );
      setOpenNoteId(staged.target);
    } else {
      const n = {
        id: `n${Date.now()}`,
        title: staged.title.trim() || "Untitled",
        body: staged.text,
        createdAt: new Date().toISOString(),
      };
      persistNotes([...notes, n]);
      setOpenNoteId(n.id);
    }
    setStaged(null);
    setPick(null);
    window.getSelection()?.removeAllRanges();
    setTab("details");
  };

  const atCompany = contacts.filter(
    (c) => c.company.trim().toLowerCase() === app.job.company.trim().toLowerCase(),
  );
  // Stored in referrerId as a JSON list so more than one person can be credited
  // without another column. Each entry is a contact's id, or a name noted for someone
  // not in the network (lib/role-meta parseReferrers). A bare id from before the list
  // still reads.
  const referrerIds = parseReferrers(app.referrerId);
  const setReferrerIds = (ids: string[]) =>
    onUpdate(app.id, { referrerId: ids.length ? JSON.stringify(ids) : null });
  // Anyone in the network can refer you, not only people whose company field matches
  // this role's: the picker used to offer only exact company matches and hid its Add
  // when there were none, which is why a referral could not be added on most roles.
  // People here come first, then everyone else.
  const referrerOptions = [
    ...atCompany,
    ...contacts.filter((c) => !atCompany.includes(c)),
  ]
    .filter((c) => !referrerIds.includes(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      subtitle: atCompany.includes(c) ? c.title : [c.company, c.title].filter(Boolean).join(" · "),
    }));
  const addReferrerName = () => {
    const name = referrerDraft.trim();
    if (!name) return;
    // A name that is someone in the network is recorded as them.
    const match = contacts.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    const entry = match ? match.id : name;
    if (!referrerIds.includes(entry)) setReferrerIds([...referrerIds, entry]);
    setReferrerDraft("");
    setAdding(false);
  };
  const openNote = notes.find((n) => n.id === openNoteId) ?? null;
  // Oldest first, so it reads as a path rather than a feed, with the gap between
  // stages shown — how long a recruiter sat on it is the useful part.
  const history = parseJson<{ status: string; at: string }[]>(app.statusHistory, []);
  // Newest first, because the note you want is almost always the one you just made
  // or the call you just had. Search covers title and body.
  const visibleNotes = [...notes]
    .filter((n) => {
      const q = noteQuery.trim().toLowerCase();
      if (!q) return true;
      return `${n.title} ${n.body}`.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // Moved here from the queue card: it constrains sending, not wanting.
  const limit = restrictionLine(app.job.company);

  const tokens = metaTokens(app.job);

  return (
    <>
      <div
        className={`fixed inset-0 bg-canvas/60 z-40 transition-opacity ${
          shown ? "opacity-100 duration-200 ease-enter" : "opacity-0 duration-140 ease-exit"
        }`}
        onClick={close}
        aria-hidden
      />
      <aside
        className={`fixed right-0 top-0 h-full w-full max-w-[640px] z-50 flex flex-col bg-raised border-l border-line-2 shadow-float transition-transform ${
          shown ? "translate-x-0 duration-200 ease-enter" : "translate-x-full duration-140 ease-exit"
        }`}
        // The left edge in the brand, the full height, matching the top line.
        style={brandHex ? brandEdge(brandHex) : undefined}
      >
        {/* Header. The company's colour: a solid 3px line of the brand along the top
            edge (and down the left, on the aside), and under it the brand at 22%
            fading to the panel colour (STYLE_GUIDE 2.6); in the body only the History
            markers take it. Only fg-1 and fg-2 sit
            on it (7.86:1 and 4.80:1 at worst, Snap yellow, at the strongest point);
            fg-3 drops under 3:1 there, so nothing on the header uses it. */}
        <div
          className="relative shrink-0 border-b border-line-2"
          style={brandHex ? { background: washOf(brandHex), boxShadow: brandLine(brandHex) } : undefined}
        >
          <div className="relative flex items-start gap-3 px-6 py-4">
            {/* The same mark the queue card shows: the logo saved from the posting's
                source first, then the domain's favicon. A favicon of a domain guessed
                from the name put someone else's icon on startups like Effective AI. */}
            <CompanyLogo
              company={app.job.company}
              jobUrl={app.job.jobUrl}
              domain={domainFromEnrichment(app.job.queueEnrichment)}
              logo={logoFromEnrichment(app.job.queueEnrichment)}
              size={40}
            />
            {editingHeader ? (
              <div
                className="min-w-0 flex-1 space-y-2"
                onKeyDown={(e) => {
                  // Enter saves; Escape backs out of the edit without closing the panel.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveHeader();
                  }
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setEditingHeader(false);
                  }
                }}
              >
                {/* Company first, as at rest: the field you clicked is the one focused. */}
                <input
                  value={headerDraft.company}
                  onChange={(e) => setHeaderDraft({ ...headerDraft, company: e.target.value })}
                  placeholder="Company"
                  aria-label="Company"
                  autoFocus
                  className={`${field("compact")} font-semibold`}
                />
                <input
                  value={headerDraft.roleTitle}
                  onChange={(e) => setHeaderDraft({ ...headerDraft, roleTitle: e.target.value })}
                  placeholder="Role title"
                  aria-label="Role title"
                  className={field("compact")}
                />
                <input
                  value={headerDraft.jobUrl}
                  onChange={(e) => {
                    setHeaderDraft({ ...headerDraft, jobUrl: e.target.value });
                    setHeaderError(null);
                  }}
                  placeholder="Posting URL"
                  aria-label="Posting URL"
                  className={`${field("compact")} ${headerError ? "border-alarm" : ""}`}
                />
                <div className="flex items-center justify-end gap-2">
                  {headerError && (
                    <p className="mr-auto flex items-center gap-1 text-meta text-alarm">
                      <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" /> {headerError}
                    </p>
                  )}
                  <button onClick={() => setEditingHeader(false)} className={button("quiet", "compact")}>
                    Cancel
                  </button>
                  <button
                    onClick={saveHeader}
                    disabled={
                      !headerDraft.company.trim() || !headerDraft.roleTitle.trim() || !headerDraft.jobUrl.trim() || headerSaving
                    }
                    title="Save (↵)"
                    className={button("primary", "compact")}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
            /* Company, then role. Same order as the queue card, the pipeline row and
                the passed row, so the thing you clicked is the thing that opens. */
            <div className="min-w-0 flex-1">
              {/* Title and subtitle wrap rather than truncate (v1.6): on a phone a
                  long name or role was cut to a few words with nothing to read the
                  rest from. The link out flows after the last word. */}
              <p className="text-h2 text-fg-1 break-words">
                {/* The company is the edit control, as the name is on a person. */}
                <button
                  onClick={startHeaderEdit}
                  className="inline text-left cursor-text decoration-fg-2 decoration-dotted underline-offset-4 hover:underline"
                  title="Click to edit company, role title and posting URL"
                >
                  {displayCompany(app.job.company)}
                </button>
                {/* One rule across the app: the link out follows the primary name.
                    Company here, person on a contact, in rows and in panels alike. */}
                <a
                  href={app.portalUrl || app.job.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (app.status === "Applying" && !app.applyStartedAt) {
                      onUpdate(app.id, { applyStartedAt: new Date().toISOString() });
                    }
                  }}
                  className={headerLink}
                  title={app.portalUrl ? "Open the application form" : "Open the posting"}
                  aria-label={app.portalUrl ? "Open the application form" : "Open the posting"}
                >
                  <ExternalLink size={14} strokeWidth={1.5} absoluteStrokeWidth />
                </a>
              </p>
              <p className="text-body text-fg-2 break-words">{app.job.roleTitle}</p>
              {/* Editable here: the panel is where they are working when the stage
                  actually changes, and reaching back to the row for it was a trip out
                  of the surface they were in. The shared neutral ramp, not the
                  company's colour: a brand-filled chip said nothing about the stage. */}
              <div className="mt-2">
                <StageSelect
                  value={app.status}
                  options={STATUSES}
                  onChange={(next) => onUpdate(app.id, { status: next })}
                  onWash
                />
              </div>
            </div>
            )}
            <button
              onClick={close}
              className={`${iconButton("quiet", "compact")} text-fg-2 shrink-0`}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.5} absoluteStrokeWidth />
            </button>
          </div>
        </div>

        {/* Tabs. The open tab's underline is the company's colour (v1.6; fg-1 without
            one), never rope, which is kept for the next move. The labels stay neutral. */}
        <div className="shrink-0 px-6 pt-3 flex gap-4 border-b border-line-2">
          {(["details", "chat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={panelTab(tab === t)}
              style={panelTabLine(tab === t, brandHex)}
            >
              {t === "details" ? "Details" : "Chat"}
            </button>
          ))}
          {tab === "chat" && messages.length > 0 && (
            <button
              onClick={async () => {
                await fetch(`/api/applications/${app.id}/chat`, { method: "DELETE" });
                setMessages([]);
              }}
              className="ml-auto text-button text-fg-3 hover:text-fg-1 transition-colors duration-90 pb-2"
              title="Clear this conversation. Anything saved to a note stays."
            >
              Clear
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) attach(f);
            e.target.value = "";
          }}
        />

        {/* A note open replaces the panel body. Back returns to the list. */}
        {/* The action row, above the transcript. It was a select pinned under the
            composer: a native dropdown at the bottom of the viewport opens
            off-screen, and the current mode was invisible once the transcript
            scrolled. Up here it is both reachable and legible as state. */}
        {tab === "chat" && !openNote && (
          <div className="shrink-0 px-6 py-2 border-b border-line-2 flex flex-wrap gap-1">
            {scopes.map((sc) => (
              <button key={sc.key ?? "none"} onClick={() => switchScope(sc.key)} className={toggle(scope === sc.key)}>
                {sc.label}
              </button>
            ))}
          </div>
        )}

        {openNote ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setOpenNoteId(null)}
                className={iconButton("quiet", "compact")}
                title="Back to notes"
                aria-label="Back to notes"
              >
                <ArrowLeft size={16} strokeWidth={1.5} absoluteStrokeWidth />
              </button>
              <input
                value={openNote.title}
                onChange={(e) =>
                  setNotes(notes.map((x) => (x.id === openNote.id ? { ...x, title: e.target.value } : x)))
                }
                onBlur={() => persistNotes(notes)}
                placeholder="Title"
                aria-label="Title"
                className="flex-1 text-name bg-transparent text-fg-1 placeholder:text-fg-3 rounded-control"
              />
              <button
                onClick={() => {
                  persistNotes(notes.filter((x) => x.id !== openNote.id));
                  setOpenNoteId(null);
                }}
                className={iconButton("destructive", "compact")}
                title="Delete this note"
                aria-label="Delete this note"
              >
                <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth />
              </button>
            </div>
            <AutoResizeTextarea
              value={openNote.body}
              onChange={(e) =>
                setNotes(notes.map((x) => (x.id === openNote.id ? { ...x, body: e.target.value } : x)))
              }
              onBlur={() => persistNotes(notes)}
              placeholder="…"
              aria-label="Note"
              className="w-full text-body bg-transparent text-fg-2 placeholder:text-fg-3 resize-none rounded-control"
            />
          </div>
        ) : tab === "details" ? (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* The role, as briefly as it goes. */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-meta text-fg-3 flex items-center gap-1.5 min-w-0 flex-1">
                  <MetaLine tokens={tokens} />
                </p>
                {/* Everything else in this block is generated or scraped. This is the
                    one place they write their own line about the role, which is also
                    the only part of it the chat prompt cannot infer from the posting. */}
                {!editingTldr && (
                  <button
                    onClick={() => {
                      setTldrDraft(app.notes ?? "");
                      setPortalDraft(app.portalUrl ?? "");
                      setEditingTldr(true);
                    }}
                    className={`${iconButton("quiet", "compact")} shrink-0`}
                    title="Your note on this role, and where the form lives"
                    aria-label="Edit your note on this role"
                  >
                    <Pencil size={14} strokeWidth={1.5} absoluteStrokeWidth />
                  </button>
                )}
              </div>

              {editingTldr ? (
                // Escape cancels and Cmd+Enter saves from anywhere in the form, as in
                // the person panel. Escape stops here so the panel's own Escape
                // (close) does not also fire and throw the panel away with the edit;
                // it used to, from the textarea, and from the link field it did
                // nothing but close.
                <div
                  className="space-y-2"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditingTldr(false);
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      saveTldr();
                    }
                  }}
                >
                  <AutoResizeTextarea
                    value={tldrDraft}
                    onChange={(e) => setTldrDraft(e.target.value)}
                    autoFocus
                    placeholder="Anything about this role worth keeping at the top."
                    aria-label="Your note on this role"
                    className={textarea()}
                  />
                  <input
                    value={portalDraft}
                    onChange={(e) => setPortalDraft(e.target.value)}
                    placeholder="Application form link, if it is not the posting"
                    aria-label="Application form link"
                    className={field("compact")}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setEditingTldr(false)} className={button("quiet", "compact")}>
                      Cancel
                    </button>
                    <button onClick={saveTldr} title="Save (⌘↵)" className={button("primary", "compact")}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                app.notes && (
                  <p className="text-body text-fg-1 whitespace-pre-wrap border-l-2 border-line-3 pl-3">{app.notes}</p>
                )
              )}
              {/* Body size, like the person panel's summary: the headline is the
                  reading, the meta line above it is the scanning. */}
              {enrichment.headline && <p className="text-body text-fg-2">{enrichment.headline}</p>}
              {cleanTags(enrichment.tags).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cleanTags(enrichment.tags).map((t, i) => (
                    <span key={i} className={tagClass}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {/* What the form will ask for. The extractor already produces it and
                  nothing rendered it, so "portfolio required" was a surprise at the
                  point of opening the form rather than a fact known before. Read-only
                  on purpose: a checklist is one more manual step that stops getting
                  done. */}
              {(enrichment.applicationNeeds ?? []).length > 0 && (
                <p className="text-meta text-fg-2">
                  <span className="text-fg-3">Needs · </span>
                  {(enrichment.applicationNeeds ?? []).join(" · ")}
                </p>
              )}
              {limit && (
                <p className="text-meta text-fg-2">
                  <span className="text-fg-3">Limit · </span>
                  {limit}
                </p>
              )}
              {/* Who they know here is a fact about the role, so it reads with the
                  rest of them. It was sitting under the Referral heading, which
                  implied these people had agreed to something. A neutral underlined
                  link: a way through, not the next move. */}
              <a
                href={
                  atCompany.length > 0
                    ? `/networking?company=${encodeURIComponent(app.job.company)}`
                    : `/networking?discover=${encodeURIComponent(app.job.company)}`
                }
                className="block w-fit text-body text-fg-1 underline decoration-line-3 underline-offset-4 hover:decoration-fg-1 transition-colors duration-90"
              >
                {atCompany.length > 0
                  ? `${atCompany.length} ${atCompany.length === 1 ? "person" : "people"} at ${app.job.company} →`
                  : `Find people at ${app.job.company} →`}
              </a>
            </div>

            {/* How this role got here, first, because it is the answer to the question
                the panel is usually opened with. Every stage change is already appended
                with a timestamp by the PATCH route, and it was being recorded
                faithfully and shown nowhere since the inline row expansion was removed.
                It also replaced the "sent 30 Sep" chip at the top: the date belongs
                against the stage it describes, not floating beside the current one.
                A log row: mono date column, the stage, then the gap as +12d. */}
            {history.length > 0 && (
              <div className="space-y-2">
                <h3 className="t-section">History</h3>
                <div>
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 h-7 group">
                      {/* The timeline's marker, in the brand: the one place company
                          colour reaches the body (2.6). */}
                      <span className={historyDot} style={{ backgroundColor: historyDotColor(brandHex) }} aria-hidden />
                      <span className="font-mono text-data text-fg-3 shrink-0 w-14">{logDate(h.at)}</span>
                      <span className="text-body text-fg-2">{h.status}</span>
                      {i > 0 && (
                        <span className="font-mono text-data text-fg-3">
                          +
                          {calendarDays(new Date(history[i - 1].at), new Date(h.at))}
                          d
                        </span>
                      )}
                      {/* A misclick on the stage dropdown writes an entry that was
                          otherwise permanent, and the history is read by the chat
                          prompt, so a wrong one misinforms more than the display. */}
                      <button
                        onClick={() =>
                          onUpdate(app.id, {
                            statusHistory: JSON.stringify(history.filter((_, j) => j !== i)),
                          })
                        }
                        className={`${iconButton("destructive", "compact")} h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                        title="Remove this entry"
                        aria-label="Remove this entry"
                      >
                        <X size={14} strokeWidth={1.5} absoluteStrokeWidth />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referral is only the people who are actually putting their name in,
                which is a different and stronger fact than knowing someone there.
                Shaped like Mutuals on a person: a heading with its add, a list, and a
                picker over the whole network, or a name noted for someone not in it. */}
            <div className="space-y-2">
              <div className={sectionHead}>
                <h3 className="t-section">Referral</h3>
                {!adding && (
                  <button onClick={() => setAdding("pick")} className={button("quiet", "compact")}>
                    <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add referral
                  </button>
                )}
              </div>

              {referrerIds.map((entry) => {
                const person = isContactId(entry) ? contacts.find((c) => c.id === entry) : null;
                // An id whose contact has since been removed shows nothing.
                if (isContactId(entry) && !person) return null;
                return (
                  <div key={entry} className="flex items-center gap-1.5 group">
                    {person ? (
                      <a
                        href={`/networking?contact=${person.id}`}
                        className="text-body text-fg-1 hover:underline decoration-line-3 underline-offset-4"
                        title="Open them on the Network page"
                      >
                        {person.name}
                        {(person.title || person.company) && (
                          <span className="text-fg-3"> · {person.title || person.company}</span>
                        )}
                      </a>
                    ) : (
                      <p className="text-body text-fg-1">
                        {entry}
                        <span className="text-fg-3"> · not in your network</span>
                      </p>
                    )}
                    <button
                      onClick={() => setReferrerIds(referrerIds.filter((x) => x !== entry))}
                      className={`${iconButton("destructive", "compact")} h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                      title="Remove"
                      aria-label={`Remove ${person?.name ?? entry}`}
                    >
                      <X size={14} strokeWidth={1.5} absoluteStrokeWidth />
                    </button>
                  </div>
                );
              })}

              {adding === "pick" && (
                <>
                  <PersonPicker
                    options={referrerOptions}
                    placeholder={contacts.length ? "Who is referring you?" : "Nobody in your network yet"}
                    onSave={(id) => {
                      setReferrerIds([...referrerIds, id]);
                      setAdding(false);
                    }}
                    onCancel={() => setAdding(false)}
                  />
                  <button onClick={() => setAdding("name")} className={formLink}>
                    Not in your network? Note their name
                  </button>
                </>
              )}
              {adding === "name" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addReferrerName();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setAdding(false);
                    }
                  }}
                  className="space-y-1.5"
                >
                  <input
                    value={referrerDraft}
                    onChange={(e) => setReferrerDraft(e.target.value)}
                    placeholder="Their name"
                    aria-label="Their name"
                    autoFocus
                    className={field("compact")}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setAdding("pick")} className={formLink}>
                      Pick from your network instead
                    </button>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setAdding(false)} className={button("quiet", "compact")}>
                        Cancel
                      </button>
                      <button type="submit" disabled={!referrerDraft.trim()} className={button("primary", "compact")}>
                        Save
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Interviews. Same shape as Referral and Files: a heading, its add, a
                list. It exists because nothing anywhere held a date — the activity
                recap counted interviews off a renamed status and read 0 while an
                application sat at final round.

                Always rendered. Hiding it until the stage reached Screen meant the one
                place to book an interview only appeared once there was already one
                booked, and a section that comes and goes is a section you forget
                exists. */}
            <div className="space-y-2">
              <div className={sectionHead}>
                <h3 className="t-section">Interviews</h3>
                {!addingInterview && (
                  <button onClick={() => setAddingInterview(true)} className={button("quiet", "compact")}>
                    <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add interview
                  </button>
                )}
              </div>

              {interviews.map((iv) => {
                const when = new Date(iv.at);
                const past = when.getTime() < Date.now();
                return (
                  <div key={iv.id} className="flex items-center gap-2 h-7 group">
                    <span className="font-mono text-data text-fg-3 shrink-0 w-14">{logDate(iv.at)}</span>
                    <span className="font-mono text-data text-fg-3 shrink-0 w-16">
                      {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className={`text-body truncate ${past ? "text-fg-3" : "text-fg-1"}`}>{iv.label}</span>
                    <button
                      onClick={() => persistInterviews(interviews.filter((x) => x.id !== iv.id))}
                      className={`${iconButton("destructive", "compact")} h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                      title="Remove"
                      aria-label="Remove this interview"
                    >
                      <X size={14} strokeWidth={1.5} absoluteStrokeWidth />
                    </button>
                  </div>
                );
              })}

              {addingInterview && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const at = String(fd.get("at") ?? "");
                    if (!at) return;
                    persistInterviews([
                      ...interviews,
                      {
                        id: `i${Date.now()}`,
                        label: String(fd.get("label") ?? "").trim(),
                        at: new Date(at).toISOString(),
                      },
                    ]);
                    setAddingInterview(false);
                  }}
                  className="space-y-2"
                >
                  <input name="at" type="datetime-local" required autoFocus className={field("compact")} />
                  <input name="label" placeholder="Recruiter screen, portfolio review…" aria-label="What the interview is" className={field("compact")} />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingInterview(false)}
                      className={button("quiet", "compact")}
                    >
                      Cancel
                    </button>
                    <button type="submit" className={button("primary", "compact")}>
                      Save
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Files */}
            <div className="space-y-2">
              <div className={sectionHead}>
                <h3 className="t-section">Files</h3>
                <button onClick={() => fileRef.current?.click()} className={button("quiet", "compact")}>
                  <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add file
                </button>
              </div>
              {saved.length > 0 && (
                <div className={`${cardClass} divide-y divide-line-1 overflow-hidden`}>
                  {saved.map((v, i) => (
                    <a
                      key={i}
                      href={v.dataUrl ?? "#"}
                      download={v.fileName}
                      className="flex items-center gap-2 h-9 px-3 hover:bg-lift transition-colors duration-90 ease-enter"
                    >
                      <span className="font-mono text-data text-fg-3 shrink-0 w-14">{logDate(v.savedAt)}</span>
                      <span className="text-body text-fg-1 truncate">{v.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Notes: titles only. One opens as its own view with a back arrow,
                the way a mail client does it — a panel of expanded bodies is
                unreadable past the second note. */}
            <div className="space-y-2">
              <div className={sectionHead}>
                <h3 className="t-section">Notes</h3>
                <button
                  onClick={() => {
                    const n = { id: `n${Date.now()}`, title: "Untitled", body: "", createdAt: new Date().toISOString() };
                    persistNotes([...notes, n]);
                    setOpenNoteId(n.id);
                  }}
                  className={button("quiet", "compact")}
                >
                  <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add note
                </button>
              </div>
              {/* Under the Notes heading because the note is the one thing every
                  paste produces; the stage, interview and comp it may also carry
                  are shown in its preview before anything is written. */}
              <PasteAnything
                endpoint={`/api/applications/${app.id}/paste`}
                label="Add from email or notes"
                placeholder="Paste a recruiter email, interview notes or an offer. Belay picks out dates, stage and pay, and adds a summary note."
                describe={describePaste}
                onApplied={applyPaste}
              />
              {/* Matching the body as well as the title is the point: "what did the
                  recruiter say about comp" is a search for a phrase inside a note,
                  not for a note called that. */}
              {notes.length > 0 && (
                <input
                  value={noteQuery}
                  onChange={(e) => setNoteQuery(e.target.value)}
                  placeholder="Search notes"
                  aria-label="Search notes"
                  className={field("compact")}
                />
              )}
              {visibleNotes.length === 0 && notes.length > 0 && (
                <p className="text-body text-fg-3">Nothing matches that.</p>
              )}
              {visibleNotes.length > 0 && (
                <div className={`${cardClass} divide-y divide-line-1 overflow-hidden`}>
                  {visibleNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setOpenNoteId(n.id)}
                      className="w-full flex items-center gap-2 text-left h-9 px-3 hover:bg-lift transition-colors duration-90 ease-enter"
                    >
                      <span className="font-mono text-data text-fg-3 shrink-0 w-14">{logDate(n.createdAt)}</span>
                      <span className="text-body text-fg-1 truncate flex-1">{n.title || "Untitled"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onMouseUp={onTranscriptMouseUp}
            className="relative flex-1 overflow-y-auto px-6 py-4 space-y-4"
          >
            {messages.length === 0 && <p className="text-body text-fg-3">{active.hint}</p>}
            {messages.map((m, i) => (
              <Fragment key={m.id}>
                {/* Switching action drops a rule here, so one transcript still
                    reads as sections of work rather than a flat log. */}
                {markers[i] && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-line-2" />
                    <span className="t-group">{markers[i]}</span>
                    <div className="h-px flex-1 bg-line-2" />
                  </div>
                )}
                {/* Your messages sit on lift, Claude's on nothing. */}
                {m.role === "user" ? (
                  <p className="text-body text-fg-1 whitespace-pre-wrap bg-lift rounded-card px-3 py-2">{m.content}</p>
                ) : (
                  <p className="text-body text-fg-2 whitespace-pre-wrap">{m.content}</p>
                )}
              </Fragment>
            ))}
            {sending && <p className="text-meta text-fg-3">Writing…</p>}
            {error && (
              <p className="flex items-center gap-1 text-meta text-alarm">
                <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" /> {error}
              </p>
            )}

            {/* Appears against the selection rather than in a toolbar, so the
                gesture is highlight-then-click. */}
            {pick && !staged && (
              <div
                className="absolute right-3 z-10 flex items-center gap-1 rounded-card bg-raised p-1 shadow-float"
                style={{ top: Math.max(0, pick.top - 6) }}
              >
                <button
                  onClick={() => setStaged({ text: pick.text, target: null, title: active.key === null ? "" : active.label })}
                  className={button("quiet", "compact")}
                >
                  New note
                </button>
                {notes.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) =>
                      e.target.value && setStaged({ text: pick.text, target: e.target.value, title: "" })
                    }
                    className={`${field("compact")} w-auto max-w-[9rem]`}
                  >
                    <option value="">add to…</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title || "Untitled"}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Staged: confirm before anything is written. */}
            {staged && (
              <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-surface border-t border-line-2 space-y-2">
                <p className="text-meta text-fg-3">
                  {staged.target
                    ? `Appending to "${notes.find((n) => n.id === staged.target)?.title || "Untitled"}"`
                    : "Saving as a new note"}
                </p>
                <p className="text-body text-fg-2 line-clamp-3 border-l-2 border-line-3 pl-2">{staged.text}</p>
                {!staged.target && (
                  <input
                    value={staged.title}
                    onChange={(e) => setStaged({ ...staged, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitStaged();
                    }}
                    autoFocus
                    placeholder="Title this note"
                    aria-label="Note title"
                    className={field("compact")}
                  />
                )}
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setStaged(null)} className={button("quiet", "compact")}>
                    Cancel
                  </button>
                  <button onClick={commitStaged} className={button("primary", "compact")}>
                    {staged.target ? "Append" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && !openNote && (
          <div className="shrink-0 border-t border-line-2">
            <div className="flex items-end gap-2 px-6 py-3">
              <AutoResizeTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                // Just a prompt to type. The action is already shown as a selected
                // button above, and the hint for it sits in the empty transcript, so
                // repeating either here was the same words three times.
                placeholder="Write something…"
                aria-label="Message"
                className={`${textarea()} max-h-40`}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className={iconButton("primary")}
                title="Send (↵)"
                aria-label="Send"
              >
                <Send size={16} strokeWidth={1.5} absoluteStrokeWidth />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
