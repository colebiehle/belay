"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { domainFromEnrichment, getLogoDomain, logoFromEnrichment } from "@/components/CompanyLogo";
import { useBrandColor } from "@/lib/use-brand-color";
import { readableOn, usableAccent } from "@/lib/brand-colors";
import { MetaLine } from "@/components/MetaLine";
import { cleanTags, displayCompany, metaTokens } from "@/lib/role-meta";
import { PersonPicker } from "@/components/PersonPicker";
import { logoUrl } from "@/lib/logo";
import { restrictionLine } from "@/lib/portal-limits";
import { STATUSES } from "@/lib/statuses";

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
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
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
  // The one fact about an application that is not on the posting: where the form
  // actually lives, when it is not the posting itself. It was only settable from a
  // detail page nothing linked to, so it was null on every row while the header link
  // quietly fell back to the job URL.
  const [portalDraft, setPortalDraft] = useState(app.portalUrl ?? "");
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
  // Whether the referral picker is showing. A plus that reveals a picker reads as
  // "add one or more"; a permanent dropdown reads as "choose exactly one".
  const [adding, setAdding] = useState(false);
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
  const accentHex = brand ? usableAccent(brand) : null;
  const accent = accentHex ?? "rgb(255 141 227)";
  // Black on the lighter brands, white on the near-black ones. Notion, IDEO, Nike,
  // Uber and Epic are all within a few points of #000, so a hard-coded black label
  // on a brand-coloured chip was invisible for five companies on the list.
  const accentInk = accentHex ? readableOn(accentHex) : "#000000";

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
  // Stored in referrerId as JSON so more than one person can be credited without
  // another column. A bare id from before the change still reads correctly.
  const referrerIds: string[] = (() => {
    const raw = app.referrerId;
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [String(v)];
    } catch {
      return [raw];
    }
  })();
  const setReferrerIds = (ids: string[]) =>
    onUpdate(app.id, { referrerId: ids.length ? JSON.stringify(ids) : null });
  const referrers = contacts.filter((c) => referrerIds.includes(c.id));
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
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
        aria-hidden
      />
      <aside
        className={`fixed right-0 top-0 h-full w-full max-w-2xl z-50 flex flex-col bg-zinc-950 transition-transform duration-200 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ borderLeft: `2px solid ${accent}` }}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-zinc-800">
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accent }} />
          <div
            className="absolute -top-16 -left-10 w-64 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ backgroundColor: accent }}
          />
          <div className="relative flex items-start gap-3 px-5 py-4">
            <img
              src={logoUrl(logoDomain)}
              alt={app.job.company}
              className="w-10 h-10 rounded-md object-contain bg-white p-1 shrink-0"
            />
            {/* Company, then role. Same order as the queue card, the pipeline row and
                the passed row, so the thing you clicked is the thing that opens. */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100 leading-snug flex items-center gap-1.5">
                <span className="truncate">{displayCompany(app.job.company)}</span>
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
                  className="shrink-0 hover:opacity-80 transition-opacity duration-150"
                  style={{ color: accent }}
                  title={app.portalUrl ? "Open the application form" : "Open the posting"}
                >
                  <ExternalLink size={13} />
                </a>
              </p>
              <p className="text-xs text-zinc-300 leading-snug">{app.job.roleTitle}</p>
            </div>
            <button onClick={close} className="text-zinc-600 hover:text-zinc-300 shrink-0" title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-5 pt-3 flex gap-4 border-b border-zinc-800">
          {(["details", "chat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs pb-2 -mb-px border-b-2 transition-all duration-150 ${
                tab === t ? "text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
              style={tab === t ? { borderBottomColor: accent } : undefined}
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
              className="ml-auto text-xs text-zinc-600 hover:text-zinc-200 transition-colors duration-150 pb-2"
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
          <div className="shrink-0 px-5 py-2.5 border-b border-zinc-800 flex flex-wrap gap-1.5">
            {scopes.map((sc) => (
              <button
                key={sc.key ?? "none"}
                onClick={() => switchScope(sc.key)}
                className={`text-xs px-2 py-1 rounded border transition-all duration-150 ${
                  scope === sc.key
                    ? "text-zinc-100"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
                style={scope === sc.key ? { borderColor: accent, backgroundColor: `${accent}22` } : undefined}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}

        {openNote ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setOpenNoteId(null)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors duration-150"
                title="Back to notes"
              >
                <ArrowLeft size={14} />
              </button>
              <input
                value={openNote.title}
                onChange={(e) =>
                  setNotes(notes.map((x) => (x.id === openNote.id ? { ...x, title: e.target.value } : x)))
                }
                onBlur={() => persistNotes(notes)}
                placeholder="Title"
                className="flex-1 text-sm font-semibold bg-transparent text-zinc-100 placeholder-zinc-700 focus:outline-none"
              />
              <button
                onClick={() => {
                  persistNotes(notes.filter((x) => x.id !== openNote.id));
                  setOpenNoteId(null);
                }}
                className="text-zinc-700 hover:text-zinc-300 transition-colors duration-150"
                title="Delete this note"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <AutoResizeTextarea
              value={openNote.body}
              onChange={(e) =>
                setNotes(notes.map((x) => (x.id === openNote.id ? { ...x, body: e.target.value } : x)))
              }
              onBlur={() => persistNotes(notes)}
              placeholder="…"
              className="w-full text-sm bg-transparent text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none leading-relaxed"
            />
          </div>
        ) : tab === "details" ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* The role, as briefly as it goes. */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Editable here: the panel is where they are working when the stage
                    actually changes, and reaching back to the row for it was a
                    trip out of the surface they were in. */}
                <select
                  value={app.status}
                  onChange={(e) => onUpdate(app.id, { status: e.target.value })}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none text-center min-w-[6.5rem]"
                  style={{ backgroundColor: accent, color: accentInk, appearance: "none" }}
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
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
                    className="ml-auto text-zinc-700 hover:text-zinc-300 transition-colors duration-150"
                    title="Your note on this role, and where the form lives"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>

              {editingTldr ? (
                <div className="space-y-1.5">
                  <AutoResizeTextarea
                    value={tldrDraft}
                    onChange={(e) => setTldrDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingTldr(false);
                    }}
                    autoFocus
                    placeholder="Anything about this role worth keeping at the top."
                    className="w-full text-xs bg-zinc-900 border rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-700 resize-none focus:outline-none leading-relaxed"
                    style={{ borderColor: accent }}
                  />
                  <input
                    value={portalDraft}
                    onChange={(e) => setPortalDraft(e.target.value)}
                    placeholder="Application form link, if it is not the posting"
                    className="w-full text-xs bg-zinc-900 border rounded px-2 py-1 text-zinc-200 placeholder-zinc-700 focus:outline-none"
                    style={{ borderColor: accent }}
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => setEditingTldr(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onUpdate(app.id, {
                          notes: tldrDraft.trim() || null,
                          portalUrl: portalDraft.trim() || null,
                        });
                        setEditingTldr(false);
                      }}
                      className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                      style={{ color: accent }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                app.notes && (
                  <p
                    className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap border-l-2 pl-2.5"
                    style={{ borderLeftColor: accent }}
                  >
                    {app.notes}
                  </p>
                )
              )}
              <p className="text-xs text-zinc-500 flex items-center gap-1.5 min-w-0">
                <MetaLine tokens={tokens} />
              </p>
              {/* text-xs like every other line in the panel. At text-sm it was the one
                  larger thing on the surface and read as a styling mistake. */}
              {enrichment.headline && (
                <p className="text-xs text-zinc-300 leading-relaxed">{enrichment.headline}</p>
              )}
              {cleanTags(enrichment.tags).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cleanTags(enrichment.tags).map((t, i) => (
                    <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
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
                <p className="text-xs text-zinc-500">
                  <span className="text-zinc-600">Needs · </span>
                  {(enrichment.applicationNeeds ?? []).join(" · ")}
                </p>
              )}
              {limit && (
                <p className="text-xs text-zinc-500">
                  <span className="text-zinc-600">Limit · </span>
                  {limit}
                </p>
              )}
              {/* Who they know here is a fact about the role, so it reads with the
                  rest of them. It was sitting under the Referral heading, which
                  implied these people had agreed to something. */}
              <a
                href={
                  atCompany.length > 0
                    ? `/networking?company=${encodeURIComponent(app.job.company)}`
                    : `/networking?discover=${encodeURIComponent(app.job.company)}`
                }
                className="block text-xs hover:opacity-80 transition-opacity duration-150"
                style={{ color: accent }}
              >
                {atCompany.length > 0
                  ? `${atCompany.length} contact${atCompany.length === 1 ? "" : "s"} at ${app.job.company} →`
                  : `Discover contacts at ${app.job.company} →`}
              </a>
            </div>

            {/* How this role got here, first, because it is the answer to the question
                the panel is usually opened with. Every stage change is already appended
                with a timestamp by the PATCH route, and it was being recorded
                faithfully and shown nowhere since the inline row expansion was removed.
                It also replaced the "sent 30 Sep" chip at the top: the date belongs
                against the stage it describes, not floating beside the current one. */}
            {history.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">History</p>
                {history.map((h, i) => (
                  <div key={i} className="flex items-baseline gap-2 group">
                    <span className="text-xs text-zinc-600 tabular-nums shrink-0 w-14">
                      {new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-zinc-400">{h.status}</span>
                    {i > 0 && (
                      <span className="text-xs text-zinc-700">
                        {Math.max(
                          0,
                          Math.round(
                            (new Date(h.at).getTime() - new Date(history[i - 1].at).getTime()) / 86400000,
                          ),
                        )}
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
                      className="text-xs text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all duration-150 px-1"
                      title="Remove this entry"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Referral is only the people who are actually putting their name in,
                which is a different and stronger fact than knowing someone there.
                Shaped like Files: a heading, an Add on the right, and a list. */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Referral</p>
                {/* Stays put as long as there is anybody left to add, so a second
                    and third referral is the same gesture as the first. */}
                {!adding && atCompany.some((c) => !referrerIds.includes(c.id)) && (
                  <button
                    onClick={() => setAdding(true)}
                    className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                    style={{ color: accent }}
                  >
                    + Add
                  </button>
                )}
                {!adding && atCompany.length > 0 && !atCompany.some((c) => !referrerIds.includes(c.id)) && (
                  <span className="text-xs text-zinc-700">everyone you know here</span>
                )}
              </div>

              {referrers.map((r) => (
                <div key={r.id} className="flex items-center gap-1.5 group">
                  <p className="text-xs text-zinc-200">
                    {r.name}
                    {r.title && <span className="text-zinc-600"> · {r.title}</span>}
                  </p>
                  <button
                    onClick={() => setReferrerIds(referrerIds.filter((x) => x !== r.id))}
                    className="text-xs text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all duration-150 px-1"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}

              {adding && (
                <PersonPicker
                  accent={accent}
                  options={atCompany
                    .filter((c) => !referrerIds.includes(c.id))
                    .map((c) => ({ id: c.id, name: c.name, subtitle: c.title }))}
                  onSave={(id) => {
                    setReferrerIds([...referrerIds, id]);
                    setAdding(false);
                  }}
                  onCancel={() => setAdding(false)}
                />
              )}
            </div>

            {/* Interviews. Same shape as Referral and Files: a heading, an Add, a
                list. It exists because nothing anywhere held a date — the activity
                recap counted interviews off a renamed status and read 0 while an
                application sat at final round.

                Always rendered. Hiding it until the stage reached Screen meant the one
                place to book an interview only appeared once there was already one
                booked, and a section that comes and goes is a section you forget
                exists. */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Interviews</p>
                {!addingInterview && (
                  <button
                    onClick={() => setAddingInterview(true)}
                    className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                    style={{ color: accent }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {interviews.map((iv) => {
                const when = new Date(iv.at);
                const past = when.getTime() < Date.now();
                return (
                  <div key={iv.id} className="flex items-center gap-1.5 group">
                    <p className={`text-xs ${past ? "text-zinc-600" : "text-zinc-200"}`}>
                      {when.toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {iv.label && <span className="text-zinc-600"> · {iv.label}</span>}
                    </p>
                    <button
                      onClick={() => persistInterviews(interviews.filter((x) => x.id !== iv.id))}
                      className="text-xs text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all duration-150 px-1"
                      title="Remove"
                    >
                      ×
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
                  className="space-y-1.5"
                >
                  <input
                    name="at"
                    type="datetime-local"
                    required
                    autoFocus
                    className="w-full text-xs bg-zinc-900 border rounded px-2 py-1 text-zinc-300 focus:outline-none"
                    style={{ borderColor: accent }}
                  />
                  <input
                    name="label"
                    placeholder="Recruiter screen, portfolio review…"
                    className="w-full text-xs bg-zinc-900 border rounded px-2 py-1 text-zinc-300 placeholder-zinc-700 focus:outline-none"
                    style={{ borderColor: accent }}
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setAddingInterview(false)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                      style={{ color: accent }}
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Files */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Files</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                  style={{ color: accent }}
                >
                  + Add
                </button>
              </div>
              {saved.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 border border-zinc-800 rounded-md px-2.5 py-1.5"
                  >
                    <a
                      href={v.dataUrl ?? "#"}
                      download={v.fileName}
                      className="text-xs text-zinc-300 hover:opacity-80 truncate"
                    >
                      {v.label}
                    </a>
                    <span className="text-xs text-zinc-700 shrink-0">
                      {new Date(v.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
              ))}
            </div>

            {/* Notes: titles only. One opens as its own view with a back arrow,
                the way a mail client does it — a panel of expanded bodies is
                unreadable past the second note. */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Notes</p>
                <button
                  onClick={() => {
                    const n = { id: `n${Date.now()}`, title: "Untitled", body: "", createdAt: new Date().toISOString() };
                    persistNotes([...notes, n]);
                    setOpenNoteId(n.id);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                  style={{ color: accent }}
                >
                  <Plus size={11} /> New note
                </button>
              </div>
              {/* Matching the body as well as the title is the point: "what did the
                  recruiter say about comp" is a search for a phrase inside a note,
                  not for a note called that. */}
              {notes.length > 0 && (
                <input
                  value={noteQuery}
                  onChange={(e) => setNoteQuery(e.target.value)}
                  placeholder="Search notes"
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-700"
                />
              )}
              {visibleNotes.length === 0 && notes.length > 0 && (
                <p className="text-xs text-zinc-700">Nothing matches that.</p>
              )}
              {visibleNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setOpenNoteId(n.id)}
                  className="w-full flex items-center gap-2 text-left border border-zinc-800 rounded-md px-2.5 py-1.5 hover:border-zinc-700 transition-all duration-150"
                >
                  <FileText size={12} className="text-zinc-600 shrink-0" />
                  <span className="text-xs text-zinc-300 truncate flex-1">{n.title || "Untitled"}</span>
                  <span className="text-xs text-zinc-700 shrink-0">
                    {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onMouseUp={onTranscriptMouseUp}
            className="relative flex-1 overflow-y-auto px-5 py-4 space-y-4"
          >
            {messages.length === 0 && (
              <p className="text-sm text-zinc-600 leading-relaxed">{active.hint}</p>
            )}
            {messages.map((m, i) => (
              <Fragment key={m.id}>
                {/* Switching action drops a rule here, so one transcript still
                    reads as sections of work rather than a flat log. */}
                {markers[i] && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-[11px] uppercase tracking-widest" style={{ color: accent }}>
                      {markers[i]}
                    </span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>
                )}
                {m.role === "user" ? (
                  <p
                    className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap border-l-2 pl-3"
                    style={{ borderLeftColor: accent }}
                  >
                    {m.content}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                )}
              </Fragment>
            ))}
            {sending && <p className="text-sm text-zinc-600">Thinking…</p>}
            {error && <p className="text-sm text-accent-pink">{error}</p>}

            {/* Appears against the selection rather than in a toolbar, so the
                gesture is highlight-then-click. */}
            {pick && !staged && (
              <div
                className="absolute right-3 z-10 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 shadow-lg"
                style={{ top: Math.max(0, pick.top - 6) }}
              >
                <button
                  onClick={() => setStaged({ text: pick.text, target: null, title: active.key === null ? "" : active.label })}
                  className="text-xs font-semibold px-1.5 hover:opacity-80 transition-opacity duration-150"
                  style={{ color: accent }}
                >
                  New note
                </button>
                {notes.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) =>
                      e.target.value && setStaged({ text: pick.text, target: e.target.value, title: "" })
                    }
                    className="text-xs bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-400 focus:outline-none max-w-[9rem]"
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
              <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-zinc-900 border-t border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-500">
                  {staged.target
                    ? `Appending to "${notes.find((n) => n.id === staged.target)?.title || "Untitled"}"`
                    : "Saving as a new note"}
                </p>
                <p className="text-xs text-zinc-400 line-clamp-3 leading-snug border-l-2 pl-2" style={{ borderLeftColor: accent }}>
                  {staged.text}
                </p>
                {!staged.target && (
                  <input
                    value={staged.title}
                    onChange={(e) => setStaged({ ...staged, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitStaged();
                    }}
                    autoFocus
                    placeholder="Title this note"
                    className="w-full text-xs bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-700"
                  />
                )}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setStaged(null)}
                    className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={commitStaged}
                    className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                    style={{ color: accent }}
                  >
                    {staged.target ? "Append" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && !openNote && (
          <div className="shrink-0 border-t border-zinc-800">
            {/* A select, not chips: only one context applies at a time, and nine
                chips wrapping over two lines read as filters rather than a mode. */}
            <div className="flex items-end gap-2 px-5 py-3">
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
                className="flex-1 text-sm bg-transparent text-zinc-200 placeholder-zinc-700 resize-none focus:outline-none leading-relaxed max-h-40"
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="disabled:opacity-25 transition-opacity duration-150 pb-1.5 hover:opacity-80"
                style={{ color: accent }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
