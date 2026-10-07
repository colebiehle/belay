"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Plus, Search, Users, X } from "lucide-react";
import { button, cardSub, cardTitle, emptyBox, iconButton, input, kbd, queueCard, textarea, verdictWidth } from "@/lib/ui";
import { CompanyLogo } from "@/components/CompanyLogo";
import { PersonPicker } from "@/components/PersonPicker";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { ChipFilterRow } from "@/components/ChipFilterRow";
import { FormFrame, NoMatch, formLink, openInBackgroundTab } from "@/components/PageChrome";
import { DEFAULT_STAGE } from "@/lib/contact-stages";
import {
  compactPaste,
  countProfileLinks,
  IMPORT_MAX_CHARS,
  loneProfileUrl,
  nameFromProfileUrl,
  PROFILE_LINK_SOURCE,
} from "@/lib/people-import";

/**
 * The Network page's Queue tab, and the one way people come in: paste a LinkedIn
 * page of people or one profile link, then add or pass on each card.
 *
 * The same loop as the job queue, because it is the same job: a pile of strangers
 * found somewhere else, and a yes or no on each. Same layout (search, sort and
 * company chips over two-up cards, the add box hidden behind the header's primary
 * button), same keys, and the same decided state: the card stays where it was, the
 * chosen button takes a check, and the lower half asks "Why this one?" or "Why not?"
 * until Done files it. The pass reasons are what the next import's fit ranking reads.
 *
 * It does not care which page the paste came from. Connections, a company's People
 * tab, a search, "people also viewed": all a list of people in LinkedIn's chrome,
 * and the extractor reads them the same way. A lone profile link skips the
 * extractor: it becomes one card, named from the profile's public page.
 *
 * People who are not on LinkedIn go through "Add someone manually" in the same box,
 * which records them directly, since there is nothing to triage.
 */

export type Candidate = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  location: string | null;
  linkedinUrl: string | null;
  batchNote: string | null;
  mutual: string | null;
  source: string | null;
  batchId: string | null;
  createdAt: string;
  // Judged at import, in the extraction call. Null on rows from before ranking.
  fit?: number | null;
  fitReason?: string | null;
  decisionNote?: string | null;
  // Client-only: decided this session and not yet filed. The row has left "pending"
  // on the server, so a refetch would drop it; the page's loader keeps these.
  decided?: "add" | "skip";
  // The Contact an add created, for the card's Open link.
  contactId?: string | null;
};

// `profile` is set when the paste is one profile link and nothing else.
type Pasted = { text: string; links: number; fromHtml: boolean; profile: string | null };

type ImportResult = {
  found: number;
  added: number;
  alreadyInNetwork: number;
  alreadyQueued: number;
  source: string;
  truncated: boolean;
  // The single-link path's answer: who it was, and where they already are.
  single?: boolean;
  name?: string;
  contactId?: string;
  status?: string;
  lookedUp?: boolean;
};

// One decision, kept so U can take it back. A bulk decision is one entry, so one U
// undoes the whole "Pass all" rather than the last card of it. Single decisions stay
// on screen as decided cards; bulk ones leave, which is why only they get a toast.
type Decision = {
  id: number;
  action: "add" | "skip";
  cards: Candidate[];
  label: string;
  contactIds: string[];
  bulk: boolean;
};

type Sort = "fit" | "newest" | "oldest";

/**
 * The paste itself. The HTML flavour first, because it is the only one that carries
 * each person's /in/ link: plain text keeps the names and headlines and loses every
 * address. Plain text is the fallback for a paste from somewhere that offers no HTML
 * (a text file, a note). A link copied from the address bar is plain text, and is
 * checked on its own so it is never mistaken for a page with no people on it.
 */
function readPaste(data: DataTransfer | null): Pasted | null {
  if (!data) return null;
  const html = data.getData("text/html");
  const plain = data.getData("text/plain");
  if (!html.trim() && !plain.trim()) return null;
  const profile = loneProfileUrl(plain) ?? (html.trim() ? loneProfileUrl(compactPaste({ html })) : null);
  if (profile) return { text: profile, links: 1, fromHtml: false, profile };
  const text = compactPaste({ html: html.trim() ? html : null, text: plain });
  return { text, links: countProfileLinks(text), fromHtml: !!html.trim(), profile: null };
}

const INPUT = input();


/** A typing field has its own paste and keys; the queue's listeners leave it alone. */
const isTyping = (el: EventTarget | null) =>
  !!el && el instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

export type MadeContact = { id: string; name: string; company: string } & Record<string, unknown>;

export function PeopleQueue({
  active,
  candidates,
  setCandidates,
  reloadCandidates,
  contacts,
  companies,
  onContactsChanged,
  onContactCreated,
  onOpenContact,
  showAdd,
  onShowAdd,
  onFind,
  paused = false,
}: {
  // Whether the Queue tab is showing. The component stays mounted behind the People
  // tab so a slow import keeps running (and its result waits) while you look away.
  active: boolean;
  candidates: Candidate[];
  setCandidates: (fn: (prev: Candidate[]) => Candidate[]) => void;
  reloadCandidates: () => Promise<void>;
  contacts: { id: string; name: string; company: string }[];
  // Tracked companies, offered as the manual form's company suggestions.
  companies: { name: string }[];
  onContactsChanged: () => void;
  // The manual form saved someone straight into People.
  onContactCreated: (c: MadeContact) => void;
  onOpenContact: (id: string) => void;
  // The Add people box, opened by the header's primary button, as Add role is.
  showAdd: boolean;
  onShowAdd: (open: boolean) => void;
  // The empty state's way out: open the Find panel.
  onFind?: () => void;
  // A contact panel is open over the page; its keys are its own.
  paused?: boolean;
}) {
  // --- Add ------------------------------------------------------------------
  const [pasted, setPasted] = useState<Pasted | null>(null);
  const [mutual, setMutual] = useState("");
  const [pickingMutual, setPickingMutual] = useState(false);
  const [batchNote, setBatchNote] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // The manual form, in place of the paste area, for someone not on LinkedIn.
  const [manual, setManual] = useState(false);

  // --- Filter, as on the job queue --------------------------------------------
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("fit");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());

  // --- Triage ---------------------------------------------------------------
  const [cursor, setCursor] = useState(0);
  // The keyboard cursor, as on the job queue: hidden until J or K, so at rest no card
  // has a rope border or a rope Add (it used to start on the first card, which read
  // as a bug). A click turns it off again.
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [history, setHistory] = useState<Decision[]>([]);
  const decisionSeq = useRef(0);

  const takePaste = (data: DataTransfer | null) => {
    const p = readPaste(data);
    if (!p) return false;
    setPasted(p);
    setResult(null);
    setImportError(null);
    return true;
  };

  // A paste anywhere on the tab opens the box and lands in it, so the move is select
  // all on LinkedIn, switch tabs, Cmd-V, without first finding the button. Typing
  // fields keep their own paste, and so does the manual form.
  useEffect(() => {
    if (!active || paused || manual) return;
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const p = readPaste(e.clipboardData);
      if (!p) return;
      e.preventDefault();
      onShowAdd(true);
      setPasted(p);
      setResult(null);
      setImportError(null);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active, paused, manual, onShowAdd]);

  const clearImport = () => {
    setPasted(null);
    setMutual("");
    setPickingMutual(false);
    setBatchNote("");
  };

  const closeAdd = () => {
    if (importing) return;
    clearImport();
    setResult(null);
    setImportError(null);
    setManual(false);
    onShowAdd(false);
  };

  const runImport = async () => {
    if (!pasted || importing) return;
    setImporting(true);
    setImportError(null);
    setResult(null);
    try {
      const res = await fetch("/api/people/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pasted.text.slice(0, IMPORT_MAX_CHARS),
          mutual: mutual || null,
          batchNote: batchNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        setImportError(data?.error ?? "Could not read that paste. Try again.");
      } else {
        setResult({ ...data, truncated: pasted.text.length > IMPORT_MAX_CHARS });
        const page = !pasted.profile;
        clearImport();
        await reloadCandidates();
        // The new card is at the top of the list; the sort that puts it there has to
        // be on, or "at the top" is a lie.
        if (data.added) setSort((s) => (s === "oldest" ? "fit" : s));
        // Companies the paste did not name are looked up in the background, paced,
        // after the import answers. Fold them in as they land, without disturbing a
        // card already being decided.
        if (page) {
          for (const ms of [20_000, 60_000]) {
            setTimeout(async () => {
              const fresh = (await fetch("/api/people/candidates")
                .then((r) => (r.ok ? r.json() : []))
                .catch(() => [])) as Candidate[];
              const company = new Map(fresh.filter((c) => c.company).map((c) => [c.id, c.company]));
              setCandidates((prev) =>
                prev.map((c) => (!c.company && company.get(c.id) ? { ...c, company: company.get(c.id)! } : c)),
              );
            }, ms);
          }
        }
      }
    } catch {
      setImportError("Can't reach Belay on this machine. Is `npm run dev` running?");
    } finally {
      setImporting(false);
    }
  };

  // --- Decisions --------------------------------------------------------------

  const patch = (body: Record<string, unknown>) =>
    fetch("/api/people/candidates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

  const mark = (ids: Set<string>, fields: Partial<Candidate>) =>
    setCandidates((prev) => prev.map((c) => (ids.has(c.id) ? { ...c, ...fields } : c)));

  // A single card is decided in place, as on the job queue: it keeps its slot and
  // turns into the reason box. A bulk decision removes its cards, because thirty
  // reason boxes is not a thing anyone fills in.
  const decide = async (cards: Candidate[], action: "add" | "skip", bulk = false) => {
    if (!cards.length) return;
    const ids = new Set(cards.map((c) => c.id));
    if (bulk) setCandidates((prev) => prev.filter((c) => !ids.has(c.id)));
    else mark(ids, { decided: action, contactId: null });
    const label = cards.length === 1 ? cards[0].name : `${cards.length} people`;
    const entry: Decision = { id: ++decisionSeq.current, action, cards, label, contactIds: [], bulk };
    setHistory((h) => [...h.slice(-19), entry]);
    const res = await patch({ ids: [...ids], action });
    if (!res?.ok) {
      // Put the cards back rather than pretend: a card that looks decided on a failed
      // write would come back undecided on the next visit.
      setHistory((h) => h.filter((d) => d.id !== entry.id));
      if (!bulk) mark(ids, { decided: undefined });
      await reloadCandidates();
      return;
    }
    if (action === "add") {
      const data = await res.json().catch(() => null);
      const made: string[] = (data?.contacts ?? []).map((c: { id: string }) => c.id);
      setHistory((h) => h.map((d) => (d.id === entry.id ? { ...d, contactIds: made } : d)));
      if (!bulk && made.length === 1) mark(ids, { contactId: made[0] });
      onContactsChanged();
    }
  };

  const undoEntry = async (d: Decision) => {
    setHistory((h) => h.filter((x) => x.id !== d.id));
    const ids = new Set(d.cards.map((c) => c.id));
    // Clear it on screen first, so the card's buttons answer at once.
    if (!d.bulk) mark(ids, { decided: undefined, contactId: null, decisionNote: null });
    await patch({ ids: [...ids], action: "undo" });
    // A bulk undo, or a single card already filed, has to come back from the server.
    if (d.bulk || !candidates.some((c) => ids.has(c.id))) await reloadCandidates();
    if (d.action === "add") onContactsChanged();
  };

  const undo = () => {
    const d = history[history.length - 1];
    if (d) undoEntry(d);
  };

  // The job card's two buttons: press the lit one to clear the decision, press the
  // other to switch it. Switching is an undo then a decide, because an add made a
  // Contact and a pass must not leave one behind.
  const toggle = async (c: Candidate, action: "add" | "skip") => {
    const entry = [...history].reverse().find((d) => !d.bulk && d.cards.some((x) => x.id === c.id));
    if (c.decided) {
      if (entry) await undoEntry(entry);
      else {
        mark(new Set([c.id]), { decided: undefined, contactId: null });
        await patch({ ids: [c.id], action: "undo" });
        if (c.decided === "add") onContactsChanged();
      }
      if (c.decided === action) return;
    }
    await decide([c], action);
  };

  // Done: the reason is saved and the card leaves. Its undo goes with it, as on the
  // job queue, where a filed card is out of reach of U.
  const file = (c: Candidate, note: string) => {
    if (note.trim()) patch({ ids: [c.id], action: "note", note: note.trim() });
    setCandidates((prev) => prev.filter((x) => x.id !== c.id));
    setHistory((h) => h.filter((d) => d.bulk || !d.cards.some((x) => x.id === c.id)));
  };

  // One list, like the job queue. By fit: anyone added from their own profile link
  // first (you picked them, which outranks any score), newest of those first; then
  // best fit, then the newest paste, then name so the order holds still between
  // renders. Unscored rows sort last: no score is not a high one.
  const time = (c: Candidate) => new Date(c.createdAt).getTime() || 0;
  const picked = (c: Candidate) => (c.source === PROFILE_LINK_SOURCE ? 1 : 0);
  const q = filter.trim().toLowerCase();
  const queueCompanies = [...new Set(candidates.map((c) => c.company).filter((c): c is string => !!c))].sort();
  const ordered = candidates
    .filter(
      (c) =>
        (!q ||
          `${c.name} ${c.company ?? ""} ${c.title ?? ""} ${c.mutual ?? ""} ${c.batchNote ?? ""}`.toLowerCase().includes(q)) &&
        (selectedCompanies.size === 0 || (!!c.company && selectedCompanies.has(c.company))),
    )
    .sort((a, b) => {
      if (sort === "newest") return time(b) - time(a) || a.name.localeCompare(b.name);
      if (sort === "oldest") return time(a) - time(b) || a.name.localeCompare(b.name);
      return (
        picked(b) - picked(a) ||
        (picked(a) ? time(b) - time(a) : 0) ||
        (b.fit ?? 0) - (a.fit ?? 0) ||
        time(b) - time(a) ||
        a.name.localeCompare(b.name)
      );
    });
  const indexOf = new Map(ordered.map((c, i) => [c.id, i]));

  // Keyboard triage, the job queue's keys: J and K move, A adds, P passes (S too, for
  // the hand that learned Skip here first), U undoes, O opens the profile. Pressing A
  // or P on a card already decided that way clears it, and the cursor moves on, since
  // the card stays where it is.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (paused) return;
      const key = e.key.toLowerCase();
      if (key === "u" && history.length) {
        e.preventDefault();
        undo();
        return;
      }
      const list = ordered;
      if (!list.length) return;
      const clamp = (n: number) => Math.max(0, Math.min(list.length - 1, n));
      const card = list[clamp(cursor)];
      // The first J or K shows the cursor where it is, without moving it.
      if (key === "j") {
        e.preventDefault();
        if (keyboardNav) setCursor((c) => clamp(c + 1));
        setKeyboardNav(true);
      } else if (key === "k") {
        e.preventDefault();
        if (keyboardNav) setCursor((c) => clamp(c - 1));
        setKeyboardNav(true);
      } else if ((key === "a" || key === "p" || key === "s") && keyboardNav && card) {
        // Gated on keyboardNav, as on the job queue: without it a stray A on a fresh
        // load added whoever was first with no ring on screen to say so.
        e.preventDefault();
        toggle(card, key === "a" ? "add" : "skip");
        setCursor((c) => clamp(c + 1));
      } else if (key === "o" && card?.linkedinUrl) {
        e.preventDefault();
        window.open(card.linkedinUrl, "_blank", "noopener");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Keep the focused card in view as the cursor walks the list.
  // Not on mount: the cursor starts on the first card, and that is no reason to
  // scroll the page before anyone has pressed a key.
  const lastCursor = useRef(cursor);
  useEffect(() => {
    if (lastCursor.current === cursor) return;
    lastCursor.current = cursor;
    if (!keyboardNav) return;
    const c = ordered[cursor];
    if (c) document.getElementById(`cand-${c.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // ordered intentionally omitted: re-scrolling as cards leave would yank the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, keyboardNav]);

  const toggleCompany = (co: string) =>
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(co)) next.delete(co);
      else next.add(co);
      return next;
    });

  // What the single-link path found, said as a sentence about the person.
  const singleLine = (r: ImportResult) => {
    const who = <span className="text-fg-1">{r.name}</span>;
    if (r.added)
      return (
        <>
          Added {who} to the top of the queue.
          {!r.lookedUp && " LinkedIn did not answer, so the name is from the link."}
        </>
      );
    if (r.alreadyInNetwork)
      return (
        <>
          {who} is already in your network.
          {r.contactId && (
            <button
              onClick={() => onOpenContact(r.contactId!)}
              className="ml-1.5 text-fg-1 underline decoration-line-3 underline-offset-4 hover:decoration-fg-1"
            >
              Open
            </button>
          )}
        </>
      );
    if (r.status === "skipped") return <>You passed on {who} before.</>;
    if (r.status === "added") return <>{who} was added from the queue before.</>;
    return <>{who} is already in the queue.</>;
  };

  return (
    <div className="space-y-4">
      {/* Add people: the one way in, in the frame every header-triggered form
          shares (Add role and Find people use the same one). The dashed paste field
          inside it is the target. It reads the clipboard's HTML on paste and says
          what it got instead of dumping a page of LinkedIn into a text field. */}
      {showAdd && (
        <FormFrame
          title={manual ? "Add someone manually" : "Add people"}
          hint={
            manual
              ? "For someone not on LinkedIn. They go straight into People."
              : "Paste a LinkedIn profile link, or select all on any page of people (connections, a company's People tab, a search) and paste. Each person becomes a card below."
          }
          onClose={closeAdd}
          closeDisabled={importing}
          // The manual form draws its own footer, the same row, because its verb
          // needs the form's own state.
          footerStart={
            !manual && (
              <>
                <button
                  onClick={() => {
                    clearImport();
                    setResult(null);
                    setImportError(null);
                    setManual(true);
                  }}
                  disabled={importing}
                  className={formLink}
                >
                  Add someone manually
                </button>
                <p className="text-meta text-fg-3 truncate" aria-live="polite">
                  {importing
                    ? pasted?.profile
                      ? "Looking them up on LinkedIn…"
                      : "Reading the page. A long one takes a minute or two."
                    : ""}
                </p>
              </>
            )
          }
          footerEnd={
            // Always present, disabled until there is a paste: the footer is the same
            // row as Find people and Add role, and the box says what it will do
            // before you have given it anything.
            !manual && (
              <button
                onClick={runImport}
                disabled={importing || !pasted}
                // Secondary: the header's Add people is this page's one rope fill.
                className={button("secondary")}
              >
                {importing
                  ? pasted?.profile
                    ? "Adding…"
                    : "Reading…"
                  : pasted && !pasted.profile
                    ? "Import"
                    : "Add to queue"}
              </button>
            )
          }
          status={
            !manual &&
            (importError ? (
              <p className="flex items-center gap-1 text-meta text-alarm">
                <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" /> {importError}
              </p>
            ) : result ? (
              <p className="text-meta text-fg-2" aria-live="polite">
                {result.single ? (
                  singleLine(result)
                ) : result.found === 0 ? (
                  "No people found on that page."
                ) : (
                  <>
                    Found <span className="tabular-nums">{result.found}</span> on{" "}
                    <span className="text-fg-1">{result.source}</span>
                    {" · "}
                    <span className={result.added ? "text-fg-1" : ""}>
                      <span className="tabular-nums">{result.added}</span> new in the queue
                    </span>
                    {result.alreadyInNetwork > 0 && ` · ${result.alreadyInNetwork} already in your network`}
                    {result.alreadyQueued > 0 && ` · ${result.alreadyQueued} seen before`}
                    {result.truncated && " · only the first part of the page was read"}
                  </>
                )}
              </p>
            ) : null)
          }
        >
          {manual ? (
            <ManualAddForm
              contacts={contacts}
              companies={companies}
              onCreated={onContactCreated}
              onBack={() => setManual(false)}
            />
          ) : (
            <>
              {pasted ? (
                <div className="flex items-center justify-between gap-3 bg-canvas border border-line-3 rounded-control px-3 py-2">
                  <div className="min-w-0">
                    {pasted.profile ? (
                      <p className="text-body text-fg-1 truncate">
                        Profile link
                        <span className="text-fg-4 mx-1.5">·</span>
                        <span className="text-fg-3">{pasted.profile.replace(/^https:\/\/www\./, "").replace(/\/$/, "")}</span>
                      </p>
                    ) : (
                      <p className="text-body text-fg-1">
                        Page pasted
                        <span className="text-fg-3">
                          <span className="text-fg-4 mx-1.5">·</span>
                          <span className="tabular-nums">{pasted.links}</span> profile{" "}
                          {pasted.links === 1 ? "link" : "links"}
                          <span className="text-fg-4 mx-1.5">·</span>
                          <span className="tabular-nums">{pasted.text.length.toLocaleString()}</span> characters
                        </span>
                      </p>
                    )}
                    {/* Said before the import, not after, so the fix (copy again from
                        the browser, or paste less) costs nothing. */}
                    {!pasted.profile && !pasted.fromHtml && (
                      <p className="text-meta text-fg-3 mt-0.5">
                        Plain text, so no profile links. Copy straight from the browser to keep them.
                      </p>
                    )}
                    {pasted.text.length > IMPORT_MAX_CHARS && (
                      <p className="flex items-center gap-1 text-meta text-alarm mt-0.5">
                        <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" />
                        Long page: only the first {IMPORT_MAX_CHARS.toLocaleString()} characters are read. Paste the
                        rest in a second go.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      clearImport();
                      setImportError(null);
                    }}
                    disabled={importing}
                    className={`${iconButton("quiet", "compact")} shrink-0`}
                    title="Clear the paste"
                    aria-label="Clear the paste"
                  >
                    <X size={16} strokeWidth={1.5} absoluteStrokeWidth />
                  </button>
                </div>
              ) : (
                <textarea
                  // Never holds text: the paste is read from the event and summarised
                  // above. Typing does nothing, so nothing half-typed gets imported.
                  value=""
                  onChange={() => {}}
                  onPaste={(e) => {
                    if (takePaste(e.clipboardData)) e.preventDefault();
                  }}
                  autoFocus
                  rows={2}
                  aria-label="Paste a profile link or a page of people"
                  placeholder="Paste a profile link or a page of people"
                  className="block w-full text-body bg-canvas border border-dashed border-line-input rounded-control px-3 py-2 text-fg-1 placeholder:text-fg-3 resize-none hover:border-fg-3 focus:border-rope caret-transparent cursor-text transition-colors duration-90 ease-enter"
                />
              )}

              {/* The batch fields only once there is something to add: everyone from
                  this paste gets the mutual and the note. */}
              {pasted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                  <div className="min-h-8 flex items-center">
                    {mutual ? (
                      <div className="w-full flex items-center justify-between gap-2 h-8 border border-line-2 rounded-control px-2.5">
                        <p className="text-body text-fg-1 truncate">Through {mutual}</p>
                        <button
                          onClick={() => setMutual("")}
                          className="text-fg-3 hover:text-fg-1 shrink-0 transition-colors duration-90"
                          title="Cold instead"
                          aria-label="Cold instead"
                        >
                          <X size={14} strokeWidth={1.5} absoluteStrokeWidth />
                        </button>
                      </div>
                    ) : pickingMutual ? (
                      <div className="w-full">
                        <PersonPicker
                          confirm={false}
                          options={contacts.map((c) => ({ id: c.id, name: c.name, subtitle: c.company }))}
                          placeholder={pasted.profile ? "Who connects you?" : "Whose connections are these?"}
                          onSave={(id) => {
                            setMutual(contacts.find((c) => c.id === id)?.name ?? "");
                            setPickingMutual(false);
                          }}
                          onCancel={() => setPickingMutual(false)}
                        />
                      </div>
                    ) : (
                      <button onClick={() => setPickingMutual(true)} className={`${button("quiet", "compact")} -ml-2.5`}>
                        <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth />{" "}
                        {pasted.profile ? "Add mutual" : "Add mutual for this batch"}
                      </button>
                    )}
                  </div>
                  <input
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runImport()}
                    placeholder={pasted.profile ? "Note, e.g. CMU alum" : "Batch note, e.g. Figma · CMU alum"}
                    maxLength={60}
                    className={INPUT}
                  />
                </div>
              )}
            </>
          )}
        </FormFrame>
      )}

      {/* Filter + sort, the job queue's row: search and sort, then company chips. */}
      {candidates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                strokeWidth={1.5}
                absoluteStrokeWidth
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none"
              />
              <input
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setCursor(0);
                }}
                placeholder="Filter by name, company or title…"
                aria-label="Filter the queue"
                className={`${input()} pl-8`}
              />
            </div>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as Sort);
                setCursor(0);
              }}
              aria-label="Sort the queue"
              className={`${input("default", true)} pr-7`}
            >
              <option value="fit">Fit</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
          <ChipFilterRow
            items={queueCompanies}
            selected={selectedCompanies}
            onToggle={(co) => {
              toggleCompany(co);
              setCursor(0);
            }}
            onClear={() => setSelectedCompanies(new Set())}
          />
        </div>
      )}

      {candidates.length === 0 ? (
        // What is missing, then how it fills; one action, and it is Find, because
        // that is what refills a queue. Adding is in the header, as on Applications.
        <div className={emptyBox}>
          <p>Queue clear. Find people at a company, then paste the page here.</p>
          {onFind && (
            <button onClick={onFind} className={`${button("secondary")} mt-3`}>
              Find people
            </button>
          )}
        </div>
      ) : ordered.length === 0 ? (
        <NoMatch
          query={filter}
          onlyQuery={selectedCompanies.size === 0}
          onClear={() => {
            setFilter("");
            setSelectedCompanies(new Set());
            setCursor(0);
          }}
        />
      ) : (
        // Each card says its own mutual, as each role card says its own location: the
        // "All via" line above them made the two queues two layouts.
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2" onMouseDown={() => setKeyboardNav(false)}>
          {ordered.map((c) => {
            const i = indexOf.get(c.id) ?? 0;
            return (
              <div key={c.id} id={`cand-${c.id}`} className="h-full">
                <CandidateCard
                  c={c}
                  focused={keyboardNav && i === cursor}
                  onFocus={() => setCursor(i)}
                  onDecide={(action) => toggle(c, action)}
                  onFile={(note) => file(c, note)}
                  onOpenContact={c.contactId ? () => onOpenContact(c.contactId!) : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The manual way in, for people LinkedIn cannot give you: a name and, if you have
 * them, company, role, profile link and mutual. A name is the only requirement. It
 * records the person directly, since a card for someone you typed in yourself would
 * be a yes you already said. A pasted profile link fills the name from its slug and
 * then from the profile's public page when LinkedIn answers; the role stays typed,
 * because LinkedIn masks it for logged-out visitors. The company carries over to the
 * next person, because they arrive in batches; the mutual does not.
 */
function ManualAddForm({
  contacts,
  companies,
  onCreated,
  onBack,
}: {
  contacts: { id: string; name: string; company: string }[];
  companies: { name: string }[];
  onCreated: (c: MadeContact) => void;
  onBack: () => void;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [via, setVia] = useState("");
  const [pickingVia, setPickingVia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The LinkedIn lookup. `autoName` is the last name the form filled in by itself
  // (slug guess or lookup), so a later fill can tell "still our guess, replace it"
  // from "the user typed this, leave it". `lookupSeq` drops stale answers.
  const [lookingUp, setLookingUp] = useState(false);
  const autoName = useRef("");
  const lookupSeq = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    },
    [],
  );

  // Replace the name only while it is empty or still the form's own last fill. The
  // updater stays pure (it reads a captured value, never writes the ref): dev mode
  // runs updaters twice.
  const fillName = (next: string) => {
    const prevAuto = autoName.current;
    autoName.current = next;
    setName((prev) => (!prev.trim() || prev === prevAuto ? next : prev));
  };

  const onUrlChange = (value: string) => {
    setUrl(value);
    const seq = ++lookupSeq.current;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const profile = loneProfileUrl(value);
    const guess = profile ? nameFromProfileUrl(profile) : null;
    if (guess) fillName(guess);
    if (!profile) {
      setLookingUp(false);
      return;
    }
    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      let found: { name: string | null; company: string | null } = { name: null, company: null };
      try {
        const res = await fetch("/api/linkedin-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: profile }),
        });
        if (res.ok) found = await res.json();
      } catch {
        // Offline or the dev server restarting: same as no answer.
      }
      if (seq !== lookupSeq.current) return;
      setLookingUp(false);
      if (found.name?.trim()) fillName(found.name.trim());
      const co = found.company?.trim();
      if (co) setCompany((prev) => (prev.trim() ? prev : co));
    }, 400);
  };

  const save = async () => {
    const n = name.trim();
    if (!n || saving) return;
    // A lookup still in flight must not land on the next, cleared form.
    lookupSeq.current += 1;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Target",
          name: n,
          company: company.trim(),
          linkedinUrl: loneProfileUrl(url),
          role: role.trim() || null,
          introVia: via.trim() || null,
          stage: DEFAULT_STAGE,
          stageHistory: JSON.stringify([{ stage: DEFAULT_STAGE, at: new Date().toISOString() }]),
        }),
      });
      if (!res.ok) {
        setError("Could not save them. Try again.");
        return;
      }
      onCreated(await res.json());
      autoName.current = "";
      setUrl("");
      setName("");
      setRole("");
      setVia("");
      setPickingVia(false);
      setLookingUp(false);
    } catch {
      setError("Can't reach Belay on this machine. Is `npm run dev` running?");
    } finally {
      setSaving(false);
    }
  };

  const enter = (e: { key: string }) => {
    if (e.key === "Enter") save();
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={enter}
          placeholder="Name"
          aria-label="Name"
          autoFocus
          className={INPUT}
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={enter}
          list="manual-company-names"
          placeholder="Company"
          aria-label="Company"
          className={INPUT}
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={enter}
          placeholder="Their role"
          aria-label="Their role"
          className={INPUT}
        />
      </div>
      <datalist id="manual-company-names">
        {companies.map((co) => (
          <option key={co.name} value={co.name} />
        ))}
      </datalist>
      {/* "Looking up…" sits inside the field it is about, so the form never jumps
          when it appears and goes. */}
      <div className="relative">
        <input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={enter}
          placeholder="LinkedIn profile link (optional)"
          aria-label="LinkedIn profile link"
          className={`${INPUT} pr-24`}
        />
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-meta text-fg-3 pointer-events-none"
          aria-live="polite"
        >
          {lookingUp ? "Looking up…" : ""}
        </span>
      </div>

      {/* The mutual, the same picker as a referral on the applications side. Empty
          by default, because most of these are cold. */}
      {via ? (
        <div className="flex items-center justify-between gap-2 h-8 border border-line-2 rounded-control px-2.5">
          <p className="text-body text-fg-1 truncate">Through {via}</p>
          <button
            onClick={() => setVia("")}
            className="text-fg-3 hover:text-fg-1 shrink-0 transition-colors duration-90"
            title="Cold instead"
            aria-label="Cold instead"
          >
            <X size={14} strokeWidth={1.5} absoluteStrokeWidth />
          </button>
        </div>
      ) : pickingVia ? (
        <PersonPicker
          confirm={false}
          options={contacts.map((c) => ({ id: c.id, name: c.name, subtitle: c.company }))}
          placeholder="Who connects you?"
          onSave={(id) => {
            setVia(contacts.find((c) => c.id === id)?.name ?? "");
            setPickingVia(false);
          }}
          onCancel={() => setPickingVia(false)}
        />
      ) : (
        <button onClick={() => setPickingVia(true)} className={`${button("quiet", "compact")} -ml-2.5`}>
          <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add mutual
        </button>
      )}

      {error && (
        <p className="flex items-center gap-1 text-meta text-alarm">
          <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" /> {error}
        </p>
      )}

      {/* The frame's footer row, drawn here because the verb needs this form's
          state: 12px above (the 8px gap plus 4), a quiet link left, the verb right. */}
      <div className="flex items-center justify-between gap-3 min-h-8 pt-1">
        <button onClick={onBack} className={formLink}>
          Paste from LinkedIn instead
        </button>
        <button onClick={save} disabled={!name.trim() || saving} className={`${button("secondary")} shrink-0`}>
          {saving ? "Saving…" : "Add to People"}
        </button>
      </div>
    </div>
  );
}

// The job card, person-shaped, line for line: the same frame (queueCard), the same
// head (32px logo; the primary name at 16px, the largest text on the card; the second
// line in body fg-2; the score on the right in every state), the same meta line, the
// same two-line reading line, and the same two buttons at the same fixed widths. Where
// the role card's second line is the role title, this one is "Company · Role", as in
// the person panel's header; where it has a headline, this has the fit's one line of
// why. No tags row: there are none to show.
//
// The verbs are Add and Pass rather than Accept and Pass. On a networking page
// "Accept" reads as accepting a connection request, which is a different act; Add
// says what happens, and it keeps the A key.
function CandidateCard({
  c,
  focused,
  onFocus,
  onDecide,
  onFile,
  onOpenContact,
}: {
  c: Candidate;
  focused: boolean;
  onFocus: () => void;
  onDecide: (action: "add" | "skip") => void;
  onFile: (note: string) => void;
  onOpenContact?: () => void;
}) {
  const [note, setNote] = useState("");
  const added = c.decided === "add";
  const passed = c.decided === "skip";
  const decided = added || passed;

  const head = (
    <div className="flex items-start gap-3">
      {/* The company's logo when the headline named one. Without a company the
          logo lookup would guess a domain from nothing, so it is the initial. */}
      {c.company ? (
        <CompanyLogo company={c.company} size={32} />
      ) : (
        <div className="w-8 h-8 rounded-card bg-lift flex items-center justify-center text-meta font-semibold text-fg-3 shrink-0">
          {c.name[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`${cardTitle} truncate`}>{c.name}</p>
        <p className={cardSub} title={[c.company, c.title].filter(Boolean).join(" · ")}>
          {c.company}
          {c.company && c.title && <> · {c.title}</>}
          {!c.company && (c.title ? c.title : <span className="text-fg-3">No headline</span>)}
        </p>
      </div>
      {/* The fit, where the job card keeps its score: plain mono, no colour scale,
          and kept in every state, as on the role card. */}
      {typeof c.fit === "number" && (
        <span
          className="font-mono text-data text-fg-1 shrink-0"
          title={`Fit ${c.fit}/10${c.fitReason ? `: ${c.fitReason}` : ""}. Learns from what you pass on.`}
        >
          {c.fit}
          <span className="text-fg-3">/10</span>
        </span>
      )}
    </div>
  );

  // The meta line, the role card's location-and-pay line: who connects you (the
  // mutuals glyph and their name) and the batch note, which becomes how you met.
  const meta = (c.batchNote || c.mutual) && (
    <p className="mt-1 text-meta text-fg-3 flex items-center gap-1.5 min-w-0">
      {c.mutual && (
        <span className="flex items-center gap-1 shrink-0" title="Your mutual connection. Becomes their first mutual.">
          <Users size={14} strokeWidth={1.5} absoluteStrokeWidth /> {c.mutual}
        </span>
      )}
      {c.mutual && c.batchNote && <span className="text-fg-4">·</span>}
      {c.batchNote && <span className="truncate">{c.batchNote}</span>}
    </p>
  );

  const lower = decided ? (
    // The reason, in the space below the head, exactly as on the job card: not
    // autofocused (the next A of a run would type into it), Enter is a newline,
    // Done files it.
    <div className="mt-2 flex-1 min-h-0 flex flex-col">
      <AutoResizeTextarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={added ? "Why this one?" : "Why not?"}
        aria-label={added ? "Why this one?" : "Why not?"}
        className={`${textarea()} flex-1`}
      />
    </div>
  ) : (
    // The fit's reason in the headline's slot: the same line, size and colour.
    c.fitReason && <p className="mt-2 text-body text-fg-1 line-clamp-2">{c.fitReason}</p>
  );

  // Add is secondary on every card; once the keyboard cursor shows (after J or K),
  // the card under it turns Add primary, marking where A will land. Pass is quiet,
  // as on the job card. Both keep one width in every state (verdictWidth).
  const verdictButton = (action: "add" | "skip") => {
    const on = action === "add" ? added : passed;
    const other = action === "add" ? passed : added;
    const label = action === "add" ? "Add" : "Pass";
    const key = action === "add" ? "A" : "P";
    const look =
      action === "add" && focused && !decided
        ? button("primary", "compact")
        : `${button(action === "add" ? "secondary" : "quiet", "compact")} ${on ? "bg-lift text-fg-1" : ""} ${other ? "text-fg-3" : ""}`;
    return (
      <button
        onClick={() => onDecide(action)}
        title={
          on
            ? `${action === "add" ? "Added" : "Passed"}. Click to undo (U)`
            : action === "add"
              ? "Add to your network (A)"
              : "Pass. They will not be offered again (P)"
        }
        className={`${look} ${verdictWidth}`}
      >
        {on && <Check size={14} strokeWidth={1.5} absoluteStrokeWidth />} {label}
        {focused && !decided && (
          <span className={`${kbd} ${action === "add" ? "border-on-rope/30 text-on-rope" : ""}`}>{key}</span>
        )}
      </button>
    );
  };

  return (
    <div data-queue-card onClick={onFocus} className={queueCard(focused)}>
      {decided || !c.linkedinUrl ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {head}
          {meta}
          {lower}
        </div>
      ) : (
        // The whole card opens the profile in a background tab, as the job card
        // opens the posting. Cmd/ctrl-click and middle-click fall through.
        <a
          href={c.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            openInBackgroundTab(c.linkedinUrl!);
          }}
          className="flex-1 min-h-0 flex flex-col rounded-control"
          title="Open their LinkedIn in a background tab (O)"
        >
          {head}
          {meta}
          {lower}
        </a>
      )}

      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {decided && (
          <div className="flex items-center gap-1 -ml-2.5">
            <button onClick={() => onFile(note)} className={button("quiet", "compact")}>
              Done
            </button>
            {/* Adding someone is the start of their record, so the way into it sits
                beside Done rather than in a toast that leaves on its own. */}
            {added && onOpenContact && (
              <button onClick={onOpenContact} className={button("quiet", "compact")}>
                Open
              </button>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {verdictButton("skip")}
          {verdictButton("add")}
        </div>
      </div>
    </div>
  );
}
