"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { logDate, calendarDays } from "@/lib/dates";
import { AlertTriangle, ArrowLeft, ExternalLink, Pencil, Plus, Search, Send, Trash2, X } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { PersonPicker } from "@/components/PersonPicker";
import { getLogoDomain } from "@/components/CompanyLogo";
import { useBrandColor } from "@/lib/use-brand-color";
import { usableAccent } from "@/lib/brand-colors";
import { button, card as cardClass, iconButton, input as field, sectionHead, tag as tagClass, textarea, toggle, washOf, brandLine, brandEdge, historyDot, historyDotColor, headerLink, panelTab, panelTabLine } from "@/lib/ui";
import { StageSelect } from "@/components/StageChip";
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
  // A background lookup (lib/enrich-contact) is still running for them.
  enriching?: boolean;
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
  { key: null, label: "No context set", hint: "Ask anything about this person." },
  {
    key: "connect",
    label: "Drafting a connect note",
    hint: `Personal, specific to them, ending on one easy question. Under ${CONNECT_NOTE_LIMIT} characters. Optional: "goal: … · hook: … · role: …"`,
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
  prevId = null,
  nextId = null,
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
  // The people either side of this one in the list behind the panel, for J and K.
  // Going through Identified one person at a time used to be open, close, find the
  // next row, open. The header's "3 of 34" and up/down arrows went in v1.6: the keys
  // cost nothing on screen, the arrows were two more controls beside close.
  prevId?: string | null;
  nextId?: string | null;
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
  // "Look up": the web search from their LinkedIn link, about a minute.
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lookUp = async () => {
    setLookingUp(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/enrich`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? `Could not look them up (HTTP ${res.status})`);
      if (d.updates && Object.keys(d.updates).length) onUpdate(contact.id, d.updates);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : String(e));
    } finally {
      setLookingUp(false);
    }
  };
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
  // The company's colour, for the header band and wash only. Null (a black or grey
  // logo) means no band and no wash: the header is plain raised, and nothing falls
  // back to a theme hue, because there is no theme hue any more.
  const brandHex = brand ? usableAccent(brand) : null;
  const openNote = notes.find((n) => n.id === openNoteId) ?? null;
  const tags = parseJson<string[]>(contact.relationship, []);
  // Anything recorded about how you know them: the edit control names what it adds
  // until one of these exists.
  const relationSet = !!(contact.warmth || tags.length || contact.notes || contact.howMet);
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

  // J and K step to the next and previous person through switchTo, the same slide as
  // following a mutual, so a step reads as a different person rather than the same
  // panel with its name changed. Not while typing anywhere, and not mid header edit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || editingHeader) return;
      const key = e.key.toLowerCase();
      const to = key === "j" ? nextId : key === "k" ? prevId : null;
      if (!to) return;
      e.preventDefault();
      switchTo(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevId, nextId, editingHeader]);

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

  // The summary is the one thing a paste writes, so the preview is one row.
  const describePaste = (u: Record<string, unknown>): PasteRow[] =>
    typeof u.profileText === "string" && u.profileText.trim()
      ? [{ key: "profileText", label: "Summary", from: contact.profileText, to: u.profileText }]
      : [];

  const applyPaste = (p: { updates: Record<string, unknown> }, kept: Set<string>) => {
    if (kept.has("profileText")) onUpdate(contact.id, { profileText: p.updates.profileText });
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
        className={`fixed inset-0 bg-canvas/60 z-40 transition-opacity ${
          backdropShown ? "opacity-100 duration-200 ease-enter" : "opacity-0 duration-140 ease-exit"
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
            <img
              src={logoUrl(logoDomain)}
              alt={contact.company}
              className="w-10 h-10 rounded-card object-contain bg-plate p-1 shrink-0"
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
                <input
                  value={headerDraft.name}
                  onChange={(e) => setHeaderDraft({ ...headerDraft, name: e.target.value })}
                  placeholder="Name"
                  aria-label="Name"
                  autoFocus
                  className={`${field("compact")} font-semibold`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={headerDraft.company}
                    onChange={(e) => setHeaderDraft({ ...headerDraft, company: e.target.value })}
                    placeholder="Company"
                    aria-label="Company"
                    className={field("compact")}
                  />
                  <input
                    value={headerDraft.title}
                    onChange={(e) => setHeaderDraft({ ...headerDraft, title: e.target.value })}
                    placeholder="Title"
                    aria-label="Title"
                    className={field("compact")}
                  />
                </div>
                <input
                  value={headerDraft.linkedinUrl}
                  onChange={(e) => setHeaderDraft({ ...headerDraft, linkedinUrl: e.target.value })}
                  placeholder="LinkedIn URL"
                  aria-label="LinkedIn URL"
                  className={field("compact")}
                />
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setEditingHeader(false)} className={button("quiet", "compact")}>
                    Cancel
                  </button>
                  <button
                    onClick={saveHeader}
                    disabled={!headerDraft.name.trim()}
                    title="Save (↵)"
                    className={button("primary", "compact")}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
            <div className="min-w-0 flex-1">
              {/* Title and subtitle wrap rather than truncate (v1.6): on a phone a
                  long name or role was cut to a few words with nothing to read the
                  rest from. The link out flows after the last word. */}
              <p className="text-h2 text-fg-1 break-words">
                {/* The name is the edit control. A pencil beside it sat next to the
                    LinkedIn link and read as a second link. */}
                <button
                  onClick={startHeaderEdit}
                  className="inline text-left cursor-text decoration-fg-2 decoration-dotted underline-offset-4 hover:underline"
                  title="Click to edit name, company, title and LinkedIn"
                >
                  {contact.name}
                </button>
                {/* The link out follows the primary name, as it does on the rows and
                    on the applications side. Here the person is the primary name. */}
                {contact.linkedinUrl && (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={headerLink}
                    title="Open their LinkedIn"
                    aria-label="Open their LinkedIn"
                  >
                    <ExternalLink size={14} strokeWidth={1.5} absoluteStrokeWidth />
                  </a>
                )}
              </p>
              <p className="text-body text-fg-2 truncate">
                {contact.company}
                {(contact.title || contact.role) && <> · {contact.title || contact.role}</>}
              </p>
              {/* The stage chip is the stage control, in the shared neutral ramp: it
                  used to be filled with the company's colour, which made every
                  person's stage look different for no reason to do with the stage. */}
              <div className="flex items-center gap-2 mt-2 min-w-0">
                <StageSelect value={stage} options={CONTACT_STAGES} onChange={setStage} onWash />
                {contact.howMet && <span className="text-meta text-fg-2 truncate">{metLine(contact.howMet)}</span>}
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

        {/* Tabs. The active underline is fg-1, not the company's colour and not rope:
            rope is kept for the next move, and which tab is open is not one. */}
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
                await fetch(`/api/contacts/${contact.id}/chat`, { method: "DELETE" });
                setMessages([]);
              }}
              className="ml-auto text-button text-fg-3 hover:text-fg-1 transition-colors duration-90 pb-2"
              title="Clear this conversation. Anything saved to a note stays."
            >
              Clear
            </button>
          )}
        </div>

        {/* The action row */}
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
            {/* The relationship and the facts */}
            <div className="space-y-2">
              {/* The one line here that is their own: how they know them, what the
                  ask is, anything a draft should carry that no profile states. */}
              {!editingTldr && (
                <div className="flex items-center gap-2">
                  {/* Quiet on purpose: tags for what they are to you, and nothing at
                      all until one is set. Warmth is the brighter tag because it
                      decides what you can ask. */}
                  {(contact.warmth || tags.length > 0) && (
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {contact.warmth && <span className={`${tagClass} text-fg-1`}>{contact.warmth}</span>}
                      {tags.map((t) => (
                        <span key={t} className={tagClass}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setTldrDraft(contact.notes ?? "");
                      setHowMetDraft(contact.howMet ?? "");
                      setTagsDraft(tags);
                      setWarmthDraft(contact.warmth);
                      setEditingTldr(true);
                    }}
                    // With nothing set yet, a pencil alone at the far right of an
                    // empty row edited nothing you could see; it says what it adds
                    // instead, like a section's add (5.8). Once something is set, the
                    // pencil beside it edits it.
                    className={
                      relationSet
                        ? `${iconButton("quiet", "compact")} ml-auto shrink-0`
                        : `${button("quiet", "compact")} -ml-2.5`
                    }
                    title="How you know them, and your note on this person"
                    aria-label={relationSet ? "Edit how you know them and your note" : undefined}
                  >
                    {relationSet ? (
                      <Pencil size={14} strokeWidth={1.5} absoluteStrokeWidth />
                    ) : (
                      <>
                        <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add how you know them
                      </>
                    )}
                  </button>
                </div>
              )}

              {editingTldr ? (
                // Escape cancels and Cmd+Enter saves from anywhere in the form, chips
                // included. Escape stops here so the panel's own Escape (close) does
                // not also fire and throw the panel away with the edit.
                <div
                  className="space-y-2"
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
                    <label className="flex-1 min-w-0 flex items-center gap-2 h-7 text-body bg-canvas border border-line-input rounded-control px-2.5 hover:border-fg-3 focus-within:border-rope transition-colors duration-90">
                      <span className="shrink-0 text-fg-3">How we met</span>
                      <input
                        value={howMetDraft}
                        onChange={(e) => setHowMetDraft(e.target.value)}
                        placeholder="Config 2026, CMU alum, cold outreach"
                        aria-label="How you met"
                        className="flex-1 min-w-0 bg-transparent text-fg-1 placeholder:text-fg-3 outline-none"
                      />
                    </label>
                    {/* Click the lit one again to clear it: not knowing is a state.
                        Lit is a lift fill, the same as an active tab segment. */}
                    <div className="flex shrink-0 h-7 p-0.5 gap-0.5 rounded-control bg-surface">
                      {WARMTH_LEVELS.map((w) => (
                        <button
                          key={w}
                          onClick={() => setWarmthDraft(warmthDraft === w ? null : w)}
                          aria-pressed={warmthDraft === w}
                          className={`text-chip t-chip px-2 rounded-control transition-colors duration-140 ease-enter ${
                            warmthDraft === w ? "bg-lift text-fg-1" : "text-fg-3 hover:text-fg-2"
                          }`}
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
                          className={toggle(on)}
                        >
                          {t}
                        </button>
                      );
                    })}
                    {newTag === null ? (
                      <button
                        onClick={() => setNewTag("")}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-control border border-dashed border-line-2 text-chip t-chip text-fg-3 hover:border-line-3 hover:text-fg-1 transition-colors duration-90"
                      >
                        <Plus size={12} strokeWidth={1.5} absoluteStrokeWidth /> tag
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
                        aria-label="New tag"
                        className="text-chip t-chip w-28 h-6 px-2 rounded-control border border-line-input bg-canvas text-fg-1 placeholder:text-fg-3 focus:border-rope"
                      />
                    )}
                  </div>
                  <AutoResizeTextarea
                    value={tldrDraft}
                    onChange={(e) => setTldrDraft(e.target.value)}
                    autoFocus
                    placeholder="How you know them, what the ask is, anything a draft should carry."
                    aria-label="Your note on this person"
                    className={textarea()}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setEditingTldr(false)} className={button("quiet", "compact")}>
                      Cancel
                    </button>
                    <button onClick={saveSummary} title="Save (⌘↵)" className={button("primary", "compact")}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                contact.notes && (
                  <p className="text-body text-fg-1 whitespace-pre-wrap border-l-2 border-line-3 pl-3">
                    {contact.notes}
                  </p>
                )
              )}

              {/* Who they are, the person-side twin of a role's headline: it stays in
                  view while you edit your note above it, the way the role panel's
                  headline does. */}
              {contact.profileText && <p className="text-body text-fg-2">{contact.profileText}</p>}
              {/* Shown until there is a summary; after that it only appears while
                  editing, as a way to redo it. */}
              {/* With a profile link and no summary, Belay can find them itself: a web
                  search from the link (lib/enrich-contact), which also fills an empty
                  company and swaps the pasted headline for their job title. People
                  added from the queue are looked up on Add, so this says so while
                  that is still running. Pasting stays below for when it cannot be sure. */}
              {!contact.profileText && contact.linkedinUrl && (
                lookingUp || contact.enriching ? (
                  <p className="text-meta text-fg-3">Looking them up from their LinkedIn link…</p>
                ) : (
                  <div className="space-y-1">
                    <button
                      onClick={lookUp}
                      className={`${button("quiet", "compact")} -ml-2.5`}
                      title="Search the web from their LinkedIn link for their role, company and a summary"
                    >
                      <Search size={14} strokeWidth={1.5} absoluteStrokeWidth /> Look up from LinkedIn
                    </button>
                    {lookupError && (
                      <p className="flex items-center gap-1.5 text-meta text-alarm">
                        <AlertTriangle size={12} strokeWidth={1.5} absoluteStrokeWidth /> {lookupError}
                      </p>
                    )}
                  </div>
                )
              )}
              {(!contact.profileText || editingTldr) && (
                <PasteAnything
                  endpoint={`/api/contacts/${contact.id}/paste`}
                  label={contact.profileText ? "Replace summary" : "Add summary"}
                  placeholder="Paste their About section, call notes or a thread. Belay writes a 2–3 sentence summary."
                  describe={describePaste}
                  onApplied={applyPaste}
                />
              )}
              {/* The one place the networking side points back at the applications
                  side, which is usually the reason you opened a person at all: you
                  are looking at someone and you want the roles at their company.
                  "Find mutuals" pointed outward at LinkedIn and did not survive the
                  question of what it was for. A neutral link, underlined: it is a
                  way through, not the next move. */}
              {rolesAtCompany > 0 && (
                <a
                  href={`/applications?company=${encodeURIComponent(contact.company)}`}
                  className="block w-fit text-body text-fg-1 underline decoration-line-3 underline-offset-4 hover:decoration-fg-1 transition-colors duration-90"
                >
                  <span className="tabular-nums">{rolesAtCompany}</span> role{rolesAtCompany === 1 ? "" : "s"} at {contact.company} →
                </a>
              )}
            </div>

            {/* How this got here, and how long each step took. The gap matters more
                here than on an application: a nudge is worth sending at eight days and
                not at two, and the number is the thing that tells you which. A log
                row: mono date column first, then the entry, then the gap. */}
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
                      <span className="text-body text-fg-2">{h.nudge ? "Nudged" : h.stage}</span>
                      {i > 0 && (
                        <span className="font-mono text-data text-fg-3">
                          +
                          {calendarDays(new Date(history[i - 1].at), new Date(h.at))}
                          d
                        </span>
                      )}
                      <button
                        onClick={() =>
                          onUpdate(contact.id, {
                            stageHistory: JSON.stringify(history.filter((_, j) => j !== i)),
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

            {/* Mutuals, shaped exactly like Referral on the applications side: a
                heading with its add beside it, a list you can add to. It was a single read-only "Via"
                line showing one name, with no way to record a second person and no way
                to get from the name to the person. Each one opens their own panel now,
                because "who else do I know here" is a question you answer by walking
                between people. */}
            <div className="space-y-2">
              <div className={sectionHead}>
                <h3 className="t-section">Mutuals</h3>
                {/* No "find" link. A mutual is a person, so they come in through the
                    same door everyone else does: add them on the Network page, then
                    pick them here. Two ways to create a contact is how you end up with
                    a name that has no row behind it. */}
                {!addingMutual && (
                  <button onClick={() => setAddingMutual(true)} className={button("quiet", "compact")}>
                    <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add mutual
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
                        className="text-body text-fg-1 hover:underline decoration-line-3 underline-offset-4 text-left"
                        title="Open their panel"
                      >
                        {name}
                        {person.company && <span className="text-fg-3"> · {person.company}</span>}
                      </button>
                    ) : (
                      <span className="text-body text-fg-1">{name}</span>
                    )}
                    <button
                      onClick={() => setMutuals(mutuals.filter((m) => m !== name))}
                      className={`${iconButton("destructive", "compact")} h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                      title="Remove"
                      aria-label={`Remove ${name}`}
                    >
                      <X size={14} strokeWidth={1.5} absoluteStrokeWidth />
                    </button>
                  </div>
                );
              })}

              {addingMutual && (
                <PersonPicker
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

            {/* Calls and chats, as log rows: date, time, then what it was. */}
            <div className="space-y-2">
              <div className={sectionHead}>
                <h3 className="t-section">Calls</h3>
                {!addingEvent && (
                  <button onClick={() => setAddingEvent(true)} className={button("quiet", "compact")}>
                    <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add call
                  </button>
                )}
              </div>
              {events.map((ev) => {
                const when = new Date(ev.at);
                const past = when.getTime() < Date.now();
                return (
                  <div key={ev.id} className="flex items-center gap-2 h-7 group">
                    <span className="font-mono text-data text-fg-3 shrink-0 w-14">{logDate(ev.at)}</span>
                    <span className="font-mono text-data text-fg-3 shrink-0 w-16">
                      {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className={`text-body truncate ${past ? "text-fg-3" : "text-fg-1"}`}>{ev.label}</span>
                    <button
                      onClick={() => persistEvents(events.filter((x) => x.id !== ev.id))}
                      className={`${iconButton("destructive", "compact")} h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                      title="Remove"
                      aria-label="Remove this call"
                    >
                      <X size={14} strokeWidth={1.5} absoluteStrokeWidth />
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
                  className="space-y-2"
                >
                  <input name="at" type="datetime-local" required autoFocus className={field("compact")} />
                  <input name="label" placeholder="Coffee chat, intro call…" aria-label="What the call is" className={field("compact")} />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setAddingEvent(false)} className={button("quiet", "compact")}>
                      Cancel
                    </button>
                    <button type="submit" className={button("primary", "compact")}>
                      Save
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Notes */}
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
              {/* Search once there are enough notes for it to matter, matching the body
                  as well as the title. Same rule as the role panel, which had this and
                  its twin did not. */}
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

            {onDelete && (
              <div className="pt-4 border-t border-line-1">
                <button
                  onClick={() => {
                    if (confirm(`Remove ${contact.name} from your network? Their notes and history go with them.`))
                      onDelete(contact.id);
                  }}
                  className={`${button("destructive", "compact")} -ml-2.5`}
                >
                  <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth /> Remove this person
                </button>
              </div>
            )}
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
                {markers[i] && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-line-2" />
                    <span className="t-group">{markers[i]}</span>
                    <div className="h-px flex-1 bg-line-2" />
                  </div>
                )}
                {/* Your messages sit on lift, Claude's on nothing: who said it is
                    told by the surface, not a brand-coloured rule. */}
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

            {pick && !staged && (
              <div
                className="absolute right-3 z-10 flex items-center gap-1 rounded-card bg-raised p-1 shadow-float"
                style={{ top: Math.max(0, pick.top - 6) }}
              >
                <button
                  onClick={() =>
                    setStaged({ text: pick.text, target: null, title: active.label === "No context set" ? "" : active.label })
                  }
                  className={button("quiet", "compact")}
                >
                  New note
                </button>
                {notes.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && setStaged({ text: pick.text, target: e.target.value, title: "" })}
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
          <div className="shrink-0 border-t border-line-2 px-6 py-3">
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
