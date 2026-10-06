"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardPaste, Users, X } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { PersonPicker } from "@/components/PersonPicker";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { openInBackgroundTab } from "@/components/PageChrome";
import { compactPaste, countProfileLinks, IMPORT_MAX_CHARS } from "@/lib/people-import";

/**
 * The Network page's Queue tab: paste a LinkedIn page of people, then add or pass on
 * each one.
 *
 * The same loop as the job queue, because it is the same job: a pile of strangers
 * found somewhere else, and a yes or no on each. Same keys, same two-up cards, and
 * the same decided state: the card stays where it was, the chosen button takes a
 * check, and the lower half asks "Why this one?" or "Why not?" until Done files it.
 * The pass reasons are what the next import's fit ranking reads. Before this the only way in was one
 * profile URL at a time, so a company's People tab with twelve good names on it was
 * twelve round trips, and in practice none.
 *
 * It does not care which page the paste came from. Connections, a company's People
 * tab, a search, "people also viewed": all a list of people in LinkedIn's chrome,
 * and the extractor reads them the same way.
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

type Pasted = { text: string; links: number; fromHtml: boolean };

type ImportResult = {
  found: number;
  added: number;
  alreadyInNetwork: number;
  alreadyQueued: number;
  source: string;
  truncated: boolean;
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

/**
 * The paste itself. The HTML flavour first, because it is the only one that carries
 * each person's /in/ link: plain text keeps the names and headlines and loses every
 * address. Plain text is the fallback for a paste from somewhere that offers no HTML
 * (a text file, a note).
 */
function readPaste(data: DataTransfer | null): Pasted | null {
  if (!data) return null;
  const html = data.getData("text/html");
  const plain = data.getData("text/plain");
  if (!html.trim() && !plain.trim()) return null;
  const text = compactPaste({ html: html.trim() ? html : null, text: plain });
  return { text, links: countProfileLinks(text), fromHtml: !!html.trim() };
}

const INPUT =
  "w-full text-sm bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-blue/60 transition-all duration-150";

export function PeopleQueue({
  active,
  candidates,
  setCandidates,
  reloadCandidates,
  contacts,
  onContactsChanged,
  onOpenContact,
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
  onContactsChanged: () => void;
  onOpenContact: (id: string) => void;
  // The empty state's way out: open the Find panel on the People tab.
  onFind?: () => void;
  // A contact panel is open over the page; its keys are its own.
  paused?: boolean;
}) {
  // --- Import ---------------------------------------------------------------
  const [pasted, setPasted] = useState<Pasted | null>(null);
  const [mutual, setMutual] = useState("");
  const [pickingMutual, setPickingMutual] = useState(false);
  const [batchNote, setBatchNote] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // --- Triage ---------------------------------------------------------------
  const [cursor, setCursor] = useState(0);
  // The ring only shows while driving by keyboard, as on the job queue: a click
  // lighting a card and leaving it lit read as a selection the card does not have.
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

  // A paste anywhere on the tab lands in the box, so the move is select all on
  // LinkedIn, switch tabs, Cmd-V, without first finding the field. Typing fields
  // keep their own paste.
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      const p = readPaste(e.clipboardData);
      if (!p) return;
      e.preventDefault();
      setPasted(p);
      setResult(null);
      setImportError(null);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active]);

  const clearImport = () => {
    setPasted(null);
    setMutual("");
    setPickingMutual(false);
    setBatchNote("");
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
        clearImport();
        await reloadCandidates();
        // Companies the paste did not name are looked up in the background, paced,
        // after the import answers. Fold them in as they land, without disturbing a
        // card already being decided.
        for (const ms of [20_000, 60_000]) {
          setTimeout(async () => {
            const fresh = (await fetch("/api/people/candidates")
              .then((r) => (r.ok ? r.json() : []))
              .catch(() => [])) as Candidate[];
            const company = new Map(fresh.filter((c) => c.company).map((c) => [c.id, c.company]));
            setCandidates((prev) => prev.map((c) => (!c.company && company.get(c.id) ? { ...c, company: company.get(c.id)! } : c)));
          }, ms);
        }
      }
    } catch {
      setImportError("Could not reach the server. Try again.");
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

  // One list, like the job queue: best fit first, then the newest paste, then name
  // so the order holds still between renders. Pastes just keep adding to it; the
  // batch note and mutual on each card already say where someone came from, so
  // there is nothing to group by. Unscored rows sort last: no score is not a high one.
  const ordered = [...candidates].sort(
    (a, b) =>
      (b.fit ?? 0) - (a.fit ?? 0) ||
      (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0) ||
      a.name.localeCompare(b.name),
  );
  const indexOf = new Map(ordered.map((c, i) => [c.id, i]));

  // Keyboard triage, the job queue's keys: J and K move, A adds, P passes (S too, for
  // the hand that learned Skip here first), U undoes, O opens the profile. Pressing A
  // or P on a card already decided that way clears it, and the cursor moves on, since
  // the card stays where it is.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
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
      if (key === "j") {
        e.preventDefault();
        setKeyboardNav(true);
        setCursor((c) => clamp(c + 1));
      } else if (key === "k") {
        e.preventDefault();
        setKeyboardNav(true);
        setCursor((c) => clamp(c - 1));
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
  useEffect(() => {
    if (!keyboardNav) return;
    const c = ordered[cursor];
    if (c) document.getElementById(`cand-${c.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // ordered intentionally omitted: re-scrolling as cards leave would yank the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, keyboardNav]);

  return (
    <div className="space-y-4">
      {/* Import. The paste target is the whole box: it reads the clipboard's HTML on
          paste and shows what it got instead of dumping a page of LinkedIn into a
          text field. The batch fields only appear once there is a batch. */}
      <div
        className={`bg-zinc-900 border rounded-lg p-4 space-y-3 transition-all duration-150 ${
          pasted ? "border-accent-blue/30" : "border-zinc-800"
        }`}
      >
        {pasted ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-zinc-200">
                Page pasted
                <span className="text-zinc-500">
                  {" · "}
                  {pasted.links} profile {pasted.links === 1 ? "link" : "links"}
                  {" · "}
                  {pasted.text.length.toLocaleString()} characters
                </span>
              </p>
              {/* Said before the import, not after, so the fix (copy again from the
                  browser, or paste less) costs nothing. */}
              {!pasted.fromHtml && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Plain text, so no profile links. Copy straight from the browser to keep them.
                </p>
              )}
              {pasted.text.length > IMPORT_MAX_CHARS && (
                <p className="text-[11px] text-alarm mt-0.5">
                  Long page: only the first {IMPORT_MAX_CHARS.toLocaleString()} characters are read. Paste the rest
                  in a second go.
                </p>
              )}
            </div>
            <button
              onClick={() => {
                clearImport();
                setImportError(null);
              }}
              disabled={importing}
              className="text-zinc-500 hover:text-zinc-300 disabled:opacity-40 shrink-0 transition-colors duration-150"
              title="Clear the paste"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <textarea
            // Never holds text: the paste is read from the event and summarised above.
            // Typing does nothing, so nothing half-typed gets imported.
            value=""
            onChange={() => {}}
            onPaste={(e) => {
              if (takePaste(e.clipboardData)) e.preventDefault();
            }}
            rows={2}
            placeholder="Paste a LinkedIn page of people here"
            className="w-full text-sm bg-zinc-950/60 border border-dashed border-zinc-700 rounded-md px-3 py-3 text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none focus:border-accent-blue/60 caret-transparent cursor-text transition-all duration-150"
          />
        )}
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          <ClipboardPaste size={11} className="shrink-0 text-zinc-600" />
          Select all on any LinkedIn page of people (connections, a company&apos;s People tab, a search) and paste.
          Nav and clutter are ignored.
        </p>

        {pasted && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
              {/* The mutual, the same picker and chip as the Add form. Everyone added
                  from this paste gets them, because a connections page is exactly
                  "people I could reach through Sam". */}
              <div className="min-h-[34px] flex items-center">
                {mutual ? (
                  <div className="w-full flex items-center justify-between gap-2 border border-accent-blue/40 rounded px-2 py-1.5">
                    <p className="text-xs text-zinc-200 truncate">Through {mutual}</p>
                    <button
                      onClick={() => setMutual("")}
                      className="text-xs text-zinc-600 hover:text-zinc-300 shrink-0"
                      title="Cold instead"
                    >
                      ×
                    </button>
                  </div>
                ) : pickingMutual ? (
                  <div className="w-full">
                    <PersonPicker
                      accent="rgb(143 205 253)"
                      confirm={false}
                      options={contacts.map((c) => ({ id: c.id, name: c.name, subtitle: c.company }))}
                      placeholder="Whose connections are these?"
                      onSave={(id) => {
                        setMutual(contacts.find((c) => c.id === id)?.name ?? "");
                        setPickingMutual(false);
                      }}
                      onCancel={() => setPickingMutual(false)}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setPickingMutual(true)}
                    className="text-xs font-semibold text-accent-blue hover:opacity-80 transition-opacity duration-150"
                  >
                    + Mutual for this batch
                  </button>
                )}
              </div>
              <input
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runImport()}
                placeholder="Batch note, e.g. Figma · CMU alum"
                maxLength={60}
                className={INPUT}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-zinc-500" aria-live="polite">
                {importing ? "Reading the page. A long one takes a minute or two." : ""}
              </p>
              <button
                onClick={runImport}
                disabled={importing}
                className="shrink-0 text-sm font-medium px-4 py-1.5 bg-accent-blue text-black rounded-md hover:opacity-90 disabled:opacity-50 transition-all duration-150"
              >
                {importing ? "Reading…" : "Import"}
              </button>
            </div>
          </>
        )}

        {importError && <p className="text-xs text-alarm">{importError}</p>}
        {result && (
          <p className="text-xs text-zinc-400" aria-live="polite">
            {result.found === 0 ? (
              "No people found on that page."
            ) : (
              <>
                Found {result.found} on <span className="text-zinc-300">{result.source}</span>
                {" · "}
                <span className={result.added ? "text-accent-blue font-medium" : ""}>{result.added} new in the queue</span>
                {result.alreadyInNetwork > 0 && ` · ${result.alreadyInNetwork} already in your network`}
                {result.alreadyQueued > 0 && ` · ${result.alreadyQueued} seen before`}
                {result.truncated && " · only the first part of the page was read"}
              </>
            )}
          </p>
        )}
      </div>

      {ordered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-500">All caught up. Nobody is waiting for a decision.</p>
          {onFind && (
            <button
              onClick={onFind}
              className="mt-3 text-sm text-accent-blue hover:opacity-80 transition-opacity duration-150"
            >
              Find people at a company you are tracking
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5" onMouseDown={() => setKeyboardNav(false)}>
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
        </>
      )}
    </div>
  );
}

// The job card, person-shaped. Same fixed height, same head (logo, primary name,
// second line, facts), the same two buttons in the same corner and the same score
// in the bottom corner, so the two queues are one gesture. Where the job card has a
// headline, this has the fit reason; where it has tags, this has what the batch will
// write onto the person (the note becomes how you met, the mutual their first mutual).
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
    <div className="flex items-start gap-2.5 pr-32">
      {/* The company's logo when the headline named one. Without a company the
          logo lookup would guess a domain from nothing, so it is the initial. */}
      {c.company ? (
        <CompanyLogo company={c.company} size={40} />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-500 shrink-0">
          {c.name[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      {/* The person panel's header, line for line: the name, then "Company · Role",
          beside the company logo. The card is the record the person becomes, as a
          role card is the role panel's header. */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100 leading-snug truncate">{c.name}</p>
        <p className="text-xs text-zinc-300 leading-snug truncate" title={[c.company, c.title].filter(Boolean).join(" · ")}>
          {c.company}
          {c.company && c.title && <span className="text-zinc-500"> · {c.title}</span>}
          {!c.company && (c.title ? <span className="text-zinc-500">{c.title}</span> : <span className="text-zinc-600">No headline</span>)}
        </p>
      </div>
    </div>
  );

  const lower = decided ? (
    // The reason, in the space the fit line and chips had, exactly as on the job
    // card: not autofocused (the next A of a run would type into it), Enter is a
    // newline, Done files it.
    <div className="mt-2 flex-1 min-h-0 flex flex-col">
      <AutoResizeTextarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={added ? "Why this one?" : "Why not?"}
        className="flex-1 w-full text-xs bg-transparent text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed"
      />
      <div className="flex justify-end items-center gap-4 pt-1">
        {/* Adding someone is the start of their record, so the way into it sits
            beside Done rather than in a toast that leaves on its own. */}
        {added && onOpenContact && (
          <button
            onClick={onOpenContact}
            className="text-xs font-semibold text-accent-blue hover:opacity-80 transition-opacity duration-150"
          >
            Open
          </button>
        )}
        <button
          onClick={() => onFile(note)}
          className="text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
        >
          Done
        </button>
      </div>
    </div>
  ) : (
    <>

      {(c.batchNote || c.mutual) && (
        <div className="mt-auto pt-2 pr-14 flex items-center gap-1.5 min-w-0">
          {c.batchNote && (
            <span className="text-[11px] leading-tight px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 truncate">
              {c.batchNote}
            </span>
          )}
          {c.mutual && (
            <span className="text-[11px] leading-tight text-accent-blue/80 flex items-center gap-1 shrink-0">
              <Users size={10} /> {c.mutual}
            </span>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      onClick={onFocus}
      // Sized to what it holds: name, role, company and the chips are about half a
      // job card, so the job card's fixed 188px left an empty well in every card.
      // The decided state grows to make room for the reason.
      className={`relative ${decided ? "min-h-[188px]" : "min-h-[112px]"} flex flex-col bg-zinc-900 border rounded-lg transition-all duration-150 ${
        focused
          ? "border-accent-blue/70 ring-1 ring-accent-blue/30"
          : added
            ? "border-accent-blue/40"
            : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {decided || !c.linkedinUrl ? (
        <div className="flex-1 min-h-0 p-3.5 flex flex-col">
          {head}
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
          className="flex-1 min-h-0 p-3.5 flex flex-col"
          title="Open their LinkedIn in a background tab (O)"
        >
          {head}
          {lower}
        </a>
      )}

      <div className="absolute top-3 right-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onDecide("add")}
          title={added ? "Added. Click to undo (U)" : "Add to your network (A)"}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border transition-all duration-150 ${
            added
              ? "border-accent-blue bg-accent-blue text-black"
              : `border-accent-blue/50 bg-transparent text-accent-blue hover:bg-accent-blue/10 ${passed ? "opacity-40" : ""}`
          }`}
        >
          {added && <Check size={11} />} Add
        </button>
        <button
          onClick={() => onDecide("skip")}
          title={passed ? "Passed. Click to undo (U)" : "Pass. They will not be offered again (P)"}
          className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border transition-all duration-150 ${
            passed
              ? "border-zinc-600 bg-zinc-700 text-zinc-100"
              : `border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 ${added ? "opacity-40" : ""}`
          }`}
        >
          {passed && <Check size={11} />} Pass
        </button>
      </div>

      {/* The fit, where the job card keeps its score, hidden once decided for the
          same reason: Done lives in that corner then. */}
      {typeof c.fit === "number" && !decided && (
        <div
          className="absolute bottom-2.5 right-3 text-xs font-bold tabular-nums text-accent-blue pointer-events-none"
          title={`Fit ${c.fit}/10${c.fitReason ? `: ${c.fitReason}` : ""}. Learns from what you pass on.`}
        >
          {c.fit}
        </div>
      )}
    </div>
  );
}
