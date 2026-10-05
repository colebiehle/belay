"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { PersonPicker } from "@/components/PersonPicker";
import { getLogoDomain } from "@/components/CompanyLogo";
import { useBrandColor } from "@/lib/use-brand-color";
import { readableOn, usableAccent } from "@/lib/brand-colors";
import { logoUrl } from "@/lib/logo";
import { PasteAnything, type PasteRow } from "@/components/PasteAnything";
import { CONTACT_STAGES, CONNECT_NOTE_LIMIT, RELATIONSHIP_TAGS, WARMTH_LEVELS, orderTags } from "@/lib/contact-stages";

/**
 * One person's panel, built the same way as the role panel because outreach turned
 * out to have the same shape: a stage it moves through, a history of how it got
 * there, dated events, notes that accumulate, and a chat for drafting.
 *
 * Details holds the facts, the mutual, which tracked roles sit at their company, the
 * events, and titled notes. Chat is a scratchpad with contexts for the four things
 * that recur: drafting a connect note, following up, prepping for the call, and
 * working out the ask afterwards. Highlight anything in the transcript to keep it as
 * a note — the message you actually sends belongs in the record, the conversation that
 * produced it does not.
 *
 * The profile paste is a first-class field rather than an afterthought. Nothing here
 * can fetch a LinkedIn profile, so the paste is the only way a draft gets specific,
 * and specific is the whole difference between a reply and silence.
 */

type Note = { id: string; title: string; body: string; createdAt: string };
type Event = { id: string; label: string; at: string };
type ChatMsg = { id: string; role: string; content: string; createdAt: string };

export type PanelContact = {
  id: string;
  name: string;
  company: string;
  title: string | null;
  role: string | null;
  linkedinUrl: string | null;
  email: string | null;
  introVia: string | null;
  stage: string | null;
  stageHistory: string | null;
  noteList: string | null;
  eventList: string | null;
  profileText: string | null;
  // JSON array of mutual connections' names. introVia is the first of them, kept
  // because the chat prompt and the list filter both read it.
  introVias: string | null;
  // A free-text line of your own about this person. Distinct from noteList, which
  // is titled notes about events; this is the standing line a draft should carry.
  notes: string | null;
  // The relationship, structured so the Network page can filter on it: where you
  // met, a JSON string[] of RELATIONSHIP_TAGS, and cold / warm / close.
  howMet: string | null;
  relationship: string | null;
  warmth: string | null;
  dateAdded: string;
};

/**
 * Every draft, always, in the order the relationship runs.
 *
 * Three of these prompts were already written in the chat route and had no chip
 * pointing at them, so "propose a time" and "say thanks" existed and could not be
 * reached. The referral ask was buried inside the debrief and the tail of the
 * thank-you, which is exactly why it never felt like a thing you could do; it is the
 * one move that connects this page to the applications page, so it gets its own chip.
 */
const SCOPES: { key: string | null; label: string; hint: string }[] = [
  { key: null, label: "No context set", hint: "Anything about this person." },
  {
    key: "connect",
    label: "Drafting a connect note",
    hint: `LinkedIn caps these at ${CONNECT_NOTE_LIMIT} characters. Say what you are curious about and it will write to that.`,
  },
  {
    key: "followup",
    label: "Following up",
    hint: "Only worth it with something new to add. It will say so if there is not.",
  },
  {
    key: "scheduling",
    label: "Proposing a time",
    hint: "Uses your booking link if one is on file, which removes the three-message exchange.",
  },
  {
    key: "referral",
    label: "Asking for a referral",
    hint: "Names one role you are actually applying to and makes the ask easy to say yes to.",
  },
  {
    key: "prep",
    label: "Prepping for the call",
    hint: "What to ask that only they can answer.",
  },
  {
    key: "debrief",
    label: "After the call",
    hint: "What you learned, and what the ask is now.",
  },
  {
    key: "thanks",
    label: "Saying thanks",
    hint: "Short, and specific about what you took from it. Generic thanks is worse than none.",
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

/**
 * "Met at Config 2026", but not "Met at cold outreach" or "Met at CMU alum": a howMet
 * that already reads as a phrase is shown as written.
 */
function metLine(howMet: string): string {
  const v = howMet.trim();
  if (
    /^(met|via|through|cold|from|at|in|on|introduced)\b/i.test(v) ||
    /\b(alum|alumni|colleague|coworker|classmate|friend)s?$/i.test(v)
  )
    return v.charAt(0).toUpperCase() + v.slice(1);
  return `Met at ${v}`;
}

// A pasted note as the note list stores it. Out here so the clock is read when the
// paste is applied, not by anything the compiler could mistake for render.
function stampNote(note: { title: string; body: string }) {
  return { id: `n${Date.now()}`, ...note, createdAt: new Date().toISOString() };
}

export function ContactPanel({
  contact,
  allContacts,
  rolesAtCompany,
  onClose,
  onUpdate,
  onOpenContact,
  onDelete,
  arrivedFromSwitch = false,
  knownTags = [],
}: {
  contact: PanelContact;
  // Tags already used on anyone, so one you made up is offered everywhere.
  knownTags?: string[];
  // Everyone else on file, so a mutual can be picked by name and opened by click.
  allContacts: { id: string; name: string; company: string }[];
  // How many roles at this person's company are in the queue or the pipeline.
  rolesAtCompany: number;
  onClose: () => void;
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onOpenContact?: (id: string) => void;
  onDelete?: (id: string) => void;
  // Opened by clicking a mutual in another panel. The backdrop is already up, so
  // it starts visible instead of fading in a second time.
  arrivedFromSwitch?: boolean;
}) {
  const [tab, setTab] = useState<"details" | "chat">("details");
  const [scope, setScope] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>(() => parseJson<Note[]>(contact.noteList, []));
  const [addingMutual, setAddingMutual] = useState(false);
  // Stored as names rather than ids: the chat prompt reads them, and a name still
  // means something after the person it points at has been deleted.
  const [mutuals, setMutualsState] = useState<string[]>(() => {
    const list = parseJson<string[]>(contact.introVias, []);
    if (list.length > 0) return list;
    return contact.introVia ? [contact.introVia] : [];
  });
  const setMutuals = (next: string[]) => {
    setMutualsState(next);
    onUpdate(contact.id, {
      introVias: next.length > 0 ? JSON.stringify(next) : null,
      // introVia stays the first one, because the chat prompt and the row filter both
      // still read it.
      introVia: next[0] ?? null,
    });
  };
  const [events, setEvents] = useState<Event[]>(() => parseJson<Event[]>(contact.eventList, []));
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [noteQuery, setNoteQuery] = useState("");
  const [editingTldr, setEditingTldr] = useState(false);
  // The header's facts. They were fixed at creation, so a typo in a name meant
  // deleting the person and losing their notes, history and mutuals with them.
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({ name: "", company: "", title: "", linkedinUrl: "" });
  const startHeaderEdit = () => {
    setHeaderDraft({
      name: contact.name,
      company: contact.company,
      title: contact.title ?? contact.role ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
    });
    setEditingHeader(true);
  };
  const saveHeader = () => {
    const name = headerDraft.name.trim();
    if (!name) return;
    onUpdate(contact.id, {
      name,
      company: headerDraft.company.trim(),
      title: headerDraft.title.trim() || null,
      linkedinUrl: headerDraft.linkedinUrl.trim() || null,
    });
    setEditingHeader(false);
  };
  const [tldrDraft, setTldrDraft] = useState(contact.notes ?? "");
  const [addingEvent, setAddingEvent] = useState(false);
  const [howMetDraft, setHowMetDraft] = useState(contact.howMet ?? "");
  const [tagsDraft, setTagsDraft] = useState<string[]>(() => parseJson<string[]>(contact.relationship, []));
  // The inline "+ tag" field, null while closed.
  const [newTag, setNewTag] = useState<string | null>(null);
  const addNewTag = () => {
    const t = (newTag ?? "").trim().toLowerCase().slice(0, 28);
    if (t) setTagsDraft(orderTags([...tagsDraft, t]));
    setNewTag(null);
  };
  const [warmthDraft, setWarmthDraft] = useState<string | null>(contact.warmth);
  const [shown, setShown] = useState(false);
  const [backdropShown, setBackdropShown] = useState(arrivedFromSwitch);
  const [pick, setPick] = useState<{ text: string; top: number } | null>(null);
  const [staged, setStaged] = useState<{ text: string; target: string | null; title: string } | null>(null);
  const [markers, setMarkers] = useState<Record<number, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  const stage = contact.stage ?? "Identified";
  const scopes = SCOPES;
  const active = scopes.find((sc) => sc.key === scope) ?? scopes[0];
  const logoDomain = getLogoDomain(contact.company, contact.linkedinUrl ?? "");
  const brand = useBrandColor(logoDomain);
  const accentHex = brand ? usableAccent(brand) : null;
  const accent = accentHex ?? "rgb(143 205 253)";
  // Black on the lighter brands, white on the near-black ones, so the stage chip's
  // label survives a company whose colour is #000000.
  const accentInk = accentHex ? readableOn(accentHex) : "#000000";
  const openNote = notes.find((n) => n.id === openNoteId) ?? null;
  const tags = parseJson<string[]>(contact.relationship, []);
  const history = parseJson<{ stage: string; at: string; nudge?: boolean }[]>(contact.stageHistory, []);
  // Newest first, because the note you want is almost always the one you just made or
  // the call you just had. Search covers title and body.
  const visibleNotes = [...notes]
    .filter((n) => {
      const q = noteQuery.trim().toLowerCase();
      if (!q) return true;
      return `${n.title} ${n.body}`.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      setShown(true);
      setBackdropShown(true);
    });
    return () => cancelAnimationFrame(t);
  }, []);

  const loadChat = () =>
    fetch(`/api/contacts/${contact.id}/chat`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMessages(Array.isArray(d) ? d : []))
      .catch(() => setMessages([]));

  useEffect(() => {
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  useEffect(() => {
    if (tab === "chat") scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending, tab]);

  const close = () => {
    setShown(false);
    setBackdropShown(false);
    setTimeout(onClose, 200);
  };

  // Moving to a mutual slides this panel out before theirs slides in, so it is
  // clear a different person is now open. Swapping the contents in place read as
  // the same panel with its name changed.
  const switchTo = (id: string) => {
    setShown(false);
    setTimeout(() => onOpenContact?.(id), 200);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistNotes = (next: Note[]) => {
    setNotes(next);
    onUpdate(contact.id, { noteList: JSON.stringify(next) });
  };

  const persistEvents = (next: Event[]) => {
    const sorted = [...next].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    setEvents(sorted);
    // lastChat drives the progress chart's coffee-chat channel, so the most recent
    // past event is written back to it rather than left for a second input to set.
    const past = sorted.filter((e) => new Date(e.at).getTime() <= Date.now());
    onUpdate(contact.id, {
      eventList: JSON.stringify(sorted),
      ...(past.length ? { lastChat: past[past.length - 1].at } : {}),
    });
  };

  const switchScope = (next: string | null) => {
    if (next === scope) return;
    setScope(next);
    const label = scopes.find((sc) => sc.key === next)?.label;
    if (label && messages.length > 0) setMarkers((m) => ({ ...m, [messages.length]: label }));
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
      const res = await fetch(`/api/contacts/${contact.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, scope }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? `Chat failed (HTTP ${res.status})`);
      await loadChat();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

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

  const commitStaged = () => {
    if (!staged) return;
    if (staged.target) {
      persistNotes(
        notes.map((n) =>
          n.id === staged.target ? { ...n, body: `${n.body}${n.body ? "\n\n" : ""}${staged.text}` } : n,
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

  // The route proposes; these turn the proposal into preview rows against what is on
  // file now, and then write what was kept in one PATCH, note included.
  const addedTags = (v: unknown): string[] =>
    Array.isArray(v) ? orderTags((v as unknown[]).filter((t): t is string => typeof t === "string")).filter((t) => !tags.includes(t)) : [];

  const describePaste = (u: Record<string, unknown>): PasteRow[] => {
    const rows: PasteRow[] = [];
    // A value equal to what is on file is not a change, whatever the route thought.
    const str = (k: string, label: string, from: string | null) => {
      const to = u[k];
      if (typeof to === "string" && to.trim() && to.trim() !== (from ?? "").trim())
        rows.push({ key: k, label, from, to });
    };
    str("title", "Title", contact.title);
    str("role", "Function", contact.role);
    str("howMet", "How we met", contact.howMet);
    // Tags only ever add, so the row says what is added rather than restating the
    // whole set twice, which made the one new tag hard to spot.
    const added = addedTags(u.relationship);
    if (added.length) rows.push({ key: "relationship", label: "Tags", from: null, to: `+ ${added.join(", ")}` });
    str("warmth", "Warmth", contact.warmth);
    str("profileText", "Background", contact.profileText);
    return rows;
  };

  const applyPaste = (p: { updates: Record<string, unknown>; note: { title: string; body: string } | null }, kept: Set<string>) => {
    const patch: Record<string, unknown> = {};
    for (const k of kept) {
      // Tags are merged into what is on file now, not taken as the set the route
      // saw, so a tag set in the meantime is not dropped.
      if (k === "relationship") {
        const added = addedTags(p.updates.relationship);
        patch.relationship = JSON.stringify(orderTags([...tags, ...added]));
      } else patch[k] = p.updates[k];
    }
    if (p.note) {
      const next = [...notes, stampNote(p.note)];
      setNotes(next);
      patch.noteList = JSON.stringify(next);
    }
    if (Object.keys(patch).length > 0) onUpdate(contact.id, patch);
  };

  const saveSummary = () => {
    onUpdate(contact.id, {
      notes: tldrDraft.trim() || null,
      howMet: howMetDraft.trim() || null,
      relationship: tagsDraft.length > 0 ? JSON.stringify(tagsDraft) : null,
      warmth: warmthDraft,
    });
    setEditingTldr(false);
  };

  const setStage = (next: string) => {
    const entry = { stage: next, at: new Date().toISOString() };
    onUpdate(contact.id, {
      stage: next,
      stageHistory: JSON.stringify([...history, entry]),
    });
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
          backdropShown ? "opacity-100" : "opacity-0"
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
              alt={contact.company}
              className="w-10 h-10 rounded-md object-contain bg-white p-1 shrink-0"
            />
            {editingHeader ? (
              <div
                className="min-w-0 flex-1 space-y-1.5"
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
                <input
                  value={headerDraft.name}
                  onChange={(e) => setHeaderDraft({ ...headerDraft, name: e.target.value })}
                  placeholder="Name"
                  autoFocus
                  className="w-full text-sm font-semibold bg-zinc-900 border rounded px-2 py-1 text-zinc-100 placeholder-zinc-700 focus:outline-none"
                  style={{ borderColor: accent }}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    value={headerDraft.company}
                    onChange={(e) => setHeaderDraft({ ...headerDraft, company: e.target.value })}
                    placeholder="Company"
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                  />
                  <input
                    value={headerDraft.title}
                    onChange={(e) => setHeaderDraft({ ...headerDraft, title: e.target.value })}
                    placeholder="Title"
                    className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                  />
                </div>
                <input
                  value={headerDraft.linkedinUrl}
                  onChange={(e) => setHeaderDraft({ ...headerDraft, linkedinUrl: e.target.value })}
                  placeholder="LinkedIn URL"
                  className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                />
                <div className="flex items-center justify-end gap-3 pt-0.5">
                  <button onClick={() => setEditingHeader(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
                    Cancel
                  </button>
                  <button
                    onClick={saveHeader}
                    disabled={!headerDraft.name.trim()}
                    title="Save (↵)"
                    className="text-xs font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity duration-150"
                    style={{ color: accent }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
            <div className="min-w-0 flex-1 group/header">
              <p className="text-sm font-semibold text-zinc-100 leading-snug flex items-center gap-1.5">
                <span className="truncate">{contact.name}</span>
                {/* The link out follows the primary name, as it does on the rows and
                    on the applications side. Here the person is the primary name. */}
                {contact.linkedinUrl && (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 hover:opacity-80 transition-opacity duration-150"
                    style={{ color: accent }}
                    title="Open their LinkedIn"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
                <button
                  onClick={startHeaderEdit}
                  className="shrink-0 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover/header:opacity-100 focus:opacity-100 transition-opacity duration-150"
                  title="Edit name, company, title and LinkedIn"
                >
                  <Pencil size={12} />
                </button>
              </p>
              <p className="text-xs text-zinc-300 leading-snug truncate">
                {contact.company}
                {(contact.title || contact.role) && (
                  <span className="text-zinc-500"> · {contact.title || contact.role}</span>
                )}
              </p>
            </div>
            )}
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
                await fetch(`/api/contacts/${contact.id}/chat`, { method: "DELETE" });
                setMessages([]);
              }}
              className="ml-auto text-xs text-zinc-600 hover:text-zinc-200 transition-colors duration-150 pb-2"
              title="Clear this conversation. Anything saved to a note stays."
            >
              Clear
            </button>
          )}
        </div>

        {/* The action row */}
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
            {/* Stage and the facts */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none text-center min-w-[6.5rem]"
                  style={{ backgroundColor: accent, color: accentInk, appearance: "none" }}
                >
                  {CONTACT_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                {/* The one line here that is their own: how they know them, what the
                    ask is, anything a draft should carry that no profile states. */}
                {!editingTldr && (
                  <button
                    onClick={() => {
                      setTldrDraft(contact.notes ?? "");
                      setHowMetDraft(contact.howMet ?? "");
                      setTagsDraft(tags);
                      setWarmthDraft(contact.warmth);
                      setEditingTldr(true);
                    }}
                    className="ml-auto text-zinc-700 hover:text-zinc-300 transition-colors duration-150"
                    title="How you know them, and your note on this person"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>

              {editingTldr ? (
                // Escape cancels and Cmd+Enter saves from anywhere in the form, chips
                // included. Escape stops here so the panel's own Escape (close) does
                // not also fire and throw the panel away with the edit.
                <div
                  className="space-y-1.5"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditingTldr(false);
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      saveSummary();
                    }
                  }}
                >
                  {/* The structured part of the relationship, above the free text
                      because it is quicker to set and it is what the Network page
                      filters on. Tags and warmth are separate on purpose: what
                      someone is to you and how well you know them change apart. */}
                  <div className="flex items-center gap-2">
                    {/* The label stays inside the field so "Config" still reads as
                        where you met once the placeholder is gone. */}
                    <label className="flex-1 min-w-0 flex items-baseline gap-2 text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-1 focus-within:border-zinc-700 transition-colors duration-150">
                      <span className="shrink-0 text-zinc-600">How we met</span>
                      <input
                        value={howMetDraft}
                        onChange={(e) => setHowMetDraft(e.target.value)}
                        placeholder="Config 2026, CMU alum, cold outreach"
                        className="flex-1 min-w-0 bg-transparent text-zinc-200 placeholder-zinc-700 focus:outline-none"
                      />
                    </label>
                    {/* Click the lit one again to clear it: not knowing is a state. */}
                    <div className="flex shrink-0 rounded border border-zinc-800 overflow-hidden">
                      {WARMTH_LEVELS.map((w) => (
                        <button
                          key={w}
                          onClick={() => setWarmthDraft(warmthDraft === w ? null : w)}
                          aria-pressed={warmthDraft === w}
                          className={`text-[11px] px-2 py-1 transition-colors duration-150 ${
                            warmthDraft === w ? "font-medium" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                          // Lit the way the warmth chip reads at rest (accent on an
                          // accent tint), so the choice and the result look the same.
                          // A plain tint on its own was too faint to tell apart.
                          style={
                            warmthDraft === w
                              ? { color: accent, backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)` }
                              : undefined
                          }
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {orderTags([...RELATIONSHIP_TAGS, ...knownTags, ...tagsDraft]).map((t) => {
                      const on = tagsDraft.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() =>
                            setTagsDraft(on ? tagsDraft.filter((x) => x !== t) : orderTags([...tagsDraft, t]))
                          }
                          aria-pressed={on}
                          className={`text-[11px] px-1.5 py-0.5 rounded border transition-all duration-150 ${
                            on ? "text-zinc-100" : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                          }`}
                          style={
                            on
                              ? { borderColor: accent, backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)` }
                              : undefined
                          }
                        >
                          {t}
                        </button>
                      );
                    })}
                    {newTag === null ? (
                      <button
                        onClick={() => setNewTag("")}
                        className="text-[11px] px-1.5 py-0.5 rounded border border-dashed border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-all duration-150"
                      >
                        + tag
                      </button>
                    ) : (
                      <input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter adds the tag rather than saving the form, and Escape
                          // closes only this field, not the editor or the panel.
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            addNewTag();
                          }
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setNewTag(null);
                          }
                        }}
                        onBlur={addNewTag}
                        autoFocus
                        maxLength={28}
                        placeholder="new tag"
                        className="text-[11px] w-28 px-1.5 py-0.5 rounded border bg-transparent text-zinc-200 placeholder-zinc-700 focus:outline-none"
                        style={{ borderColor: accent }}
                      />
                    )}
                  </div>
                  <AutoResizeTextarea
                    value={tldrDraft}
                    onChange={(e) => setTldrDraft(e.target.value)}
                    autoFocus
                    placeholder="How you know them, what the ask is, anything a draft should carry."
                    className="w-full text-xs bg-zinc-900 border rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-700 resize-none focus:outline-none leading-relaxed"
                    style={{ borderColor: accent }}
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => setEditingTldr(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
                      Cancel
                    </button>
                    <button
                      onClick={saveSummary}
                      title="Save (⌘↵)"
                      className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                      style={{ color: accent }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Quiet on purpose: chips for what they are to you, one dim line
                      for where you met, and nothing at all until either is set. */}
                  {(contact.warmth || tags.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {contact.warmth && (
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ color: accent, backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)` }}
                        >
                          {contact.warmth}
                        </span>
                      )}
                      {tags.map((t) => (
                        <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {contact.howMet && <p className="text-xs text-zinc-600">{metLine(contact.howMet)}</p>}
                  {contact.notes && (
                    <p
                      className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap border-l-2 pl-2.5"
                      style={{ borderLeftColor: accent }}
                    >
                      {contact.notes}
                    </p>
                  )}
                  {/* Clamped, and dim. It is context the drafts read rather than
                      something to sit and study, so two lines is enough to tell you it
                      is there and whether it is the right person. */}
                  {contact.profileText && (
                    <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">{contact.profileText}</p>
                  )}
                  {/* Where their background comes from now, and everything else a
                      paste can carry. It replaced a textarea bound to profileText:
                      the paste was always a whole profile or a whole thread, and
                      only one field of it was being kept. */}
                  <PasteAnything
                    endpoint={`/api/contacts/${contact.id}/paste`}
                    accent={accent}
                    label="Add summary"
                    placeholder="Paste their LinkedIn About section and current role. Notes from a call or a message thread work too. Belay pulls out the facts and writes a short summary."
                    describe={describePaste}
                    onApplied={applyPaste}
                  />
                  {/* The one place the networking side points back at the applications
                      side, which is usually the reason you opened a person at all: you
                      are looking at someone and you want the roles at their company.
                      "Find mutuals" pointed outward at LinkedIn and did not survive the
                      question of what it was for. */}
                  {rolesAtCompany > 0 && (
                    <a
                      href={`/applications?company=${encodeURIComponent(contact.company)}`}
                      className="block text-xs hover:opacity-80 transition-opacity duration-150"
                      style={{ color: accent }}
                    >
                      {rolesAtCompany} role{rolesAtCompany === 1 ? "" : "s"} at {contact.company} →
                    </a>
                  )}
                </>
              )}

            </div>

            {/* How this got here, and how long each step took. The gap matters more
                here than on an application: a nudge is worth sending at eight days and
                not at two, and the number is the thing that tells you which. */}
            {history.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">History</p>
                {history.map((h, i) => (
                  <div key={i} className="flex items-baseline gap-2 group">
                    <span className="text-xs text-zinc-600 tabular-nums shrink-0 w-14">
                      {new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-zinc-400">{h.nudge ? "Nudged" : h.stage}</span>
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
                    <button
                      onClick={() =>
                        onUpdate(contact.id, {
                          stageHistory: JSON.stringify(history.filter((_, j) => j !== i)),
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

            {/* Mutuals, shaped exactly like Referral on the applications side: a
                heading, an Add, a list you can add to. It was a single read-only "Via"
                line showing one name, with no way to record a second person and no way
                to get from the name to the person. Each one opens their own panel now,
                because "who else do I know here" is a question you answer by walking
                between people. */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Mutuals</p>
                {/* No "find" link. A mutual is a person, so they come in through the
                    same door everyone else does: add them on the Network page, then
                    pick them here. Two ways to create a contact is how you end up with
                    a name that has no row behind it. */}
                {!addingMutual && (
                  <button
                    onClick={() => setAddingMutual(true)}
                    className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                    style={{ color: accent }}
                  >
                    + Add
                  </button>
                )}
              </div>

              {mutuals.map((name) => {
                const person = allContacts.find(
                  (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
                );
                return (
                  <div key={name} className="flex items-center gap-1.5 group">
                    {person ? (
                      <button
                        onClick={() => switchTo(person.id)}
                        className="text-xs text-zinc-200 hover:opacity-80 transition-opacity duration-150 text-left"
                        title="Open their panel"
                      >
                        {name}
                        {person.company && <span className="text-zinc-600"> · {person.company}</span>}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-200">{name}</span>
                    )}
                    <button
                      onClick={() => setMutuals(mutuals.filter((m) => m !== name))}
                      className="text-xs text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all duration-150 px-1"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {addingMutual && (
                <PersonPicker
                  accent={accent}
                  options={allContacts
                    .filter((c) => c.id !== contact.id && !mutuals.includes(c.name))
                    .map((c) => ({ id: c.id, name: c.name, subtitle: c.company }))}
                  onSave={(id) => {
                    const added = allContacts.find((c) => c.id === id);
                    if (added) setMutuals([...mutuals, added.name]);
                    setAddingMutual(false);
                  }}
                  onCancel={() => setAddingMutual(false)}
                />
              )}
            </div>

            {/* Calls and chats */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Calls</p>
                {!addingEvent && (
                  <button
                    onClick={() => setAddingEvent(true)}
                    className="text-xs font-semibold hover:opacity-80 transition-opacity duration-150"
                    style={{ color: accent }}
                  >
                    + Add
                  </button>
                )}
              </div>
              {events.map((ev) => {
                const when = new Date(ev.at);
                const past = when.getTime() < Date.now();
                return (
                  <div key={ev.id} className="flex items-center gap-1.5 group">
                    <p className={`text-xs ${past ? "text-zinc-600" : "text-zinc-200"}`}>
                      {when.toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {ev.label && <span className="text-zinc-600"> · {ev.label}</span>}
                    </p>
                    <button
                      onClick={() => persistEvents(events.filter((x) => x.id !== ev.id))}
                      className="text-xs text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all duration-150 px-1"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {addingEvent && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const at = String(fd.get("at") ?? "");
                    if (!at) return;
                    persistEvents([
                      ...events,
                      { id: `e${Date.now()}`, label: String(fd.get("label") ?? "").trim(), at: new Date(at).toISOString() },
                    ]);
                    setAddingEvent(false);
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
                    placeholder="Coffee chat, intro call…"
                    className="w-full text-xs bg-zinc-900 border rounded px-2 py-1 text-zinc-300 placeholder-zinc-700 focus:outline-none"
                    style={{ borderColor: accent }}
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setAddingEvent(false)}
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

            {/* Notes */}
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
              {/* Search once there are enough notes for it to matter, matching the body
                  as well as the title. Same rule as the role panel, which had this and
                  its twin did not. */}
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

            {onDelete && (
              <div className="pt-1 border-t border-zinc-800">
                <button
                  onClick={() => {
                    if (confirm(`Remove ${contact.name} from your network? Their notes and history go with them.`))
                      onDelete(contact.id);
                  }}
                  className="text-xs text-zinc-700 hover:text-alarm transition-colors duration-150"
                >
                  Remove this person
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            ref={scrollRef}
            onMouseUp={onTranscriptMouseUp}
            className="relative flex-1 overflow-y-auto px-5 py-4 space-y-4"
          >
            {messages.length === 0 && <p className="text-sm text-zinc-600 leading-relaxed">{active.hint}</p>}
            {messages.map((m, i) => (
              <Fragment key={m.id}>
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

            {pick && !staged && (
              <div
                className="absolute right-3 z-10 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 shadow-lg"
                style={{ top: Math.max(0, pick.top - 6) }}
              >
                <button
                  onClick={() =>
                    setStaged({ text: pick.text, target: null, title: active.label === "No context set" ? "" : active.label })
                  }
                  className="text-xs font-semibold px-1.5 hover:opacity-80 transition-opacity duration-150"
                  style={{ color: accent }}
                >
                  New note
                </button>
                {notes.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && setStaged({ text: pick.text, target: e.target.value, title: "" })}
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

            {staged && (
              <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-zinc-900 border-t border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-500">
                  {staged.target
                    ? `Appending to "${notes.find((n) => n.id === staged.target)?.title || "Untitled"}"`
                    : "Saving as a new note"}
                </p>
                <p
                  className="text-xs text-zinc-400 line-clamp-3 leading-snug border-l-2 pl-2"
                  style={{ borderLeftColor: accent }}
                >
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
                  <button onClick={() => setStaged(null)} className="text-xs text-zinc-600 hover:text-zinc-300">
                    Cancel
                  </button>
                  <button onClick={commitStaged} className="text-xs font-semibold" style={{ color: accent }}>
                    {staged.target ? "Append" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && !openNote && (
          <div className="shrink-0 border-t border-zinc-800 px-5 py-3">
            <div className="flex items-end gap-2">
              <AutoResizeTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
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
