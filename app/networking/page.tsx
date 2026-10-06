"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, Search } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ContactPanel, type PanelContact } from "@/components/ContactPanel";
import {
  CONTACT_STAGES,
  CONTACT_STAGE_COLORS,
  DEFAULT_STAGE,
  FOLLOW_UP_STAGES,
  NUDGE_AFTER_DAYS,
  orderTags,
  TO_MESSAGE_STAGES,
  TO_SCHEDULE_STAGES,
  WARMTH_LEVELS,
} from "@/lib/contact-stages";
import { ChipFilterRow } from "@/components/ChipFilterRow";
import { PersonPicker } from "@/components/PersonPicker";
import { PeopleQueue, type Candidate } from "@/components/PeopleQueue";
import { PageHeader, TabBar, headerButton } from "@/components/PageChrome";

/**
 * Networking as a queue, not a directory.
 *
 * The surface this replaces was 1,577 lines and had ten contacts in it, all added
 * inside one week in May, with zero messages ever marked sent and four AI-drafted
 * messages sitting unused in the database. The drafting worked; the sending never
 * happened. So the thing to fix is not how messages get written, it is that nothing
 * ever made sending the obvious next action.
 *
 * Hence the same shape as the pipeline: grouped by stage, work at the top, finished
 * rows sinking. "Identified" is first because it is the only group that asks
 * something of you today, and emptying it is the point of the page.
 *
 * Two ways in, both matching how you actually finds people. By company: open LinkedIn
 * people-search pre-filtered, paste the URLs back, and they inherit that company. By
 * mutual: the same, but it records who the connection is — because a warm path is a
 * different conversation from a cold one and the draft needs to know which it is.
 */

type Contact = PanelContact & {
  type: string;
  lastChat: string | null;
  dateAdded?: string | null;
};

// When someone last moved: the latest stage-history entry, a nudge included, which
// is also what the row's day counter reads. Falls back to when they were added.
function lastTouch(c: Contact): number {
  try {
    const h = JSON.parse(c.stageHistory ?? "[]") as { at?: string }[];
    const at = Array.isArray(h) && h.length ? new Date(h[h.length - 1].at ?? "").getTime() : NaN;
    if (!Number.isNaN(at)) return at;
  } catch {}
  const added = c.dateAdded ? new Date(c.dateAdded).getTime() : NaN;
  return Number.isNaN(added) ? 0 : added;
}

// Stages where the ball is with them: the longest wait goes to the top, because that
// is the next nudge. Everywhere else the most recent move is the most relevant.
const OLDEST_FIRST = new Set(["Sent", "Connected", "Replied"]);

const INPUT =
  "w-full text-sm bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent-blue/60 transition-all duration-150";


/**
 * The company's own People tab, filtered by role. A general keyword search returns
 * anyone who merely mentions the company — former employees, recruiters pitching
 * them, people who wrote a post about them. The People tab is only people who work
 * there, which is the only set worth reading.
 */
function peopleTabUrl(slug: string, keywords: string): string {
  const base = `https://www.linkedin.com/company/${encodeURIComponent(slug)}/people/`;
  return keywords.trim() ? `${base}?keywords=${encodeURIComponent(keywords.trim())}` : base;
}

// Pink like the company chips in ChipFilterRow directly above: pink is what a filter
// chip is across the app, and two adjacent rows in two hues read as two systems.
function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`text-[11px] px-2 py-0.5 rounded-full border transition-all duration-150 ${
        on
          ? "bg-accent-pink border-accent-pink text-black"
          : "border-zinc-800 text-zinc-500 hover:border-accent-pink hover:text-accent-pink"
      }`}
    >
      {label}
    </button>
  );
}

/** The profile URL inside whatever was pasted, or null when there is none. */
function profileUrlIn(text: string): string | null {
  return text.trim().match(/https?:\/\/\S*linkedin\.com\/in\/[^\s,/?#]+/i)?.[0] ?? null;
}

/**
 * A LinkedIn profile URL yields a usable name when nothing better is to hand. It is
 * the instant guess; /api/linkedin-lookup replaces it with the real name when
 * LinkedIn answers.
 */
function nameFromLinkedIn(url: string): string {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!m) return "";
  return decodeURIComponent(m[1])
    .replace(/-[a-z0-9]{6,}$/i, "")
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function NetworkingPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  // company (lowercased) -> how many roles are in the queue or the pipeline there.
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  // "Who could refer me", "who do I ask about craft": the relationship tags and
  // warmth, filtered the same way as companies (any of the lit chips matches).
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedWarmth, setSelectedWarmth] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  // Read once per visit for the follow-up counters, rather than during every render.
  const [now] = useState(() => Date.now());
  // Whether the open panel was reached from another panel's mutual.
  const [switched, setSwitched] = useState(false);

  // The add flow. One company (or one mutual) at a time, then paste URLs.
  const [addCompany, setAddCompany] = useState("");
  const [addKeywords, setAddKeywords] = useState("product designer");
  const [addVia, setAddVia] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [finding, setFinding] = useState(false);
  const [pickingVia, setPickingVia] = useState(false);
  const [companies, setCompanies] = useState<{ name: string; linkedinSlug: string | null; tier: number }[]>([]);
  const urlRef = useRef<HTMLInputElement>(null);
  // The LinkedIn lookup. `autoName` is the last name the form filled in by itself
  // (slug guess or lookup), so a later fill can tell "still our guess, replace it"
  // from "the user typed this, leave it". `lookupSeq` drops stale answers: every
  // keystroke in the URL field and every reset bumps it, and a response only lands
  // if its number is still current.
  const [lookingUp, setLookingUp] = useState(false);
  const autoName = useRef("");
  const lookupSeq = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Two tabs, as on Applications: Queue (people pasted from LinkedIn, waiting for a
  // yes or no) and People (the network itself). Null until chosen, so the default
  // can follow the queue: open on it when someone is waiting, on People when not.
  const [tab, setTab] = useState<"queue" | "people" | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  // The server only returns pending rows, so a refetch would drop the cards decided
  // this session and still waiting for their reason. Keep those where they are.
  const loadCandidates = () =>
    fetch("/api/people/candidates")
      .then((r) => (r.ok ? r.json() : []))
      .then((cs: Candidate[]) => {
        const server = Array.isArray(cs) ? cs : [];
        const ids = new Set(server.map((c) => c.id));
        setCandidates((prev) => [...server, ...prev.filter((c) => c.decided && !ids.has(c.id))]);
      })
      .catch(() => {})
      .finally(() => setCandidatesLoaded(true));

  const load = () =>
    Promise.all([
      fetch("/api/contacts").then((r) => r.json()),
      fetch("/api/target-companies").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/jobs").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cs, co, js]) => {
        // Queue and pipeline only, which is what the panel's link lands on. Counting
        // every row also counted passed and archived roles, so Google read 12 and
        // the page showed 4.
        const counts: Record<string, number> = {};
        if (Array.isArray(js)) {
          for (const j of js as { company?: string; verdict?: string | null }[]) {
            if (j.verdict && j.verdict !== "Apply") continue;
            const k = (j.company ?? "").trim().toLowerCase();
            if (k) counts[k] = (counts[k] ?? 0) + 1;
          }
        }
        setRoleCounts(counts);
        setCompanies(Array.isArray(co) ? co : []);
        setContacts(Array.isArray(cs) ? cs : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    loadCandidates();
    // A link from a role panel arrives with ?company= or ?discover=, so the page lands
    // already pointed at the company that prompted it.
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const company = qs.get("company");
    const discover = qs.get("discover");
    // ?contact=<id> opens straight into one person, so a link from a role panel can
    // point at the person rather than at a filtered list you then have to click.
    const contact = qs.get("contact");
    if (contact) setOpenId(contact);
    if (company) setFilter(company);
    if (discover) {
      setAddCompany(discover);
      setFinding(true);
    }
    // Every link above is about the network, so it lands on People whatever is queued.
    const t = qs.get("tab");
    if (t === "queue" || t === "people") setTab(t);
    else if (contact || company || discover) setTab("people");
  }, []);

  const update = async (id: string, patch: Record<string, unknown>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? ({ ...c, ...patch } as Contact) : c)));
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    // A rename also rewrites other people's mutuals on the server; reload so their
    // panels show the new name.
    if ("name" in patch) load();
  };

  const remove = async (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setOpenId(null);
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
  };

  const clearAddForm = () => {
    lookupSeq.current += 1;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setLookingUp(false);
    autoName.current = "";
    setAddUrl("");
    setAddName("");
    setAddRole("");
    setAddVia("");
    setPickingVia(false);
  };

  // A name is the only hard requirement. The LinkedIn URL is optional because the
  // people worth tracking are not all findable that way, and the name is pre-filled
  // from the URL's slug when there is one, so the common case is still paste, Enter.
  // The company carries over to the next person, because they arrive in batches from
  // one search. The mutual does not: it belongs to the person just saved.
  // Fill name and company from the profile's public page. Debounced so a URL being
  // typed by hand does not fire on every character; best-effort, so a null answer
  // (LinkedIn's 999 or auth wall) just leaves the slug guess where it is, and Save is
  // never disabled while this runs. Company only fills an empty field, because it
  // carries over between adds and the user's batch company is the better answer.
  // Replace the name only while it is empty or still the form's own last fill. The
  // updater stays pure (it reads a captured value, never writes the ref): dev mode
  // runs updaters twice, and one that moved the ref made its second run see the new
  // name as "typed by the user" and keep the old one.
  const fillName = (next: string) => {
    const prevAuto = autoName.current;
    autoName.current = next;
    setAddName((prev) => (!prev.trim() || prev === prevAuto ? next : prev));
  };

  const onUrlChange = (value: string) => {
    setAddUrl(value);
    const seq = ++lookupSeq.current;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    const guess = nameFromLinkedIn(value);
    if (guess) fillName(guess);

    const url = profileUrlIn(value);
    if (!url) {
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
          body: JSON.stringify({ url }),
        });
        if (res.ok) found = await res.json();
      } catch {
        // Offline or the dev server restarting: same as no answer.
      }
      if (seq !== lookupSeq.current) return;
      setLookingUp(false);
      const name = found.name?.trim();
      const company = found.company?.trim();
      if (name) fillName(name);
      if (company) setAddCompany((prev) => (prev.trim() ? prev : company));
    }, 400);
  };

  const addOne = async () => {
    const name = addName.trim();
    if (!name) return;
    const url = addUrl.trim().match(/https?:\/\/\S*linkedin\.com\/in\/[^\s,]+/i)?.[0] ?? null;
    // A lookup still in flight must not land on the next, cleared form.
    lookupSeq.current += 1;
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "Target",
        name,
        company: addCompany.trim(),
        linkedinUrl: url,
        role: addRole.trim() || null,
        introVia: addVia.trim() || null,
        stage: DEFAULT_STAGE,
        stageHistory: JSON.stringify([{ stage: DEFAULT_STAGE, at: new Date().toISOString() }]),
      }),
    });
    if (res.ok) {
      const made = await res.json();
      setContacts((prev) => [...prev, made]);
      clearAddForm();
      // Open them straight away: the next thing after adding someone is their
      // summary, tags and a message, all of which live in the panel. The add form
      // stays open behind it, cleared, so closing the panel lands on the next one.
      setSwitched(false);
      setOpenId(made.id);
    }
  };

  const contactCompanies = [...new Set(contacts.map((c) => c.company).filter(Boolean))].sort();

  const toggleCompany = (co: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      next.has(co) ? next.delete(co) : next.add(co);
      return next;
    });
  };

  const tagsOf = (c: Contact): string[] => {
    try {
      const v = JSON.parse(c.relationship ?? "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  // Only the tags and warmths somebody actually has, so the row is empty (and
  // absent) until you start recording them, and never offers a filter that
  // returns nobody.
  const usedTags = orderTags(contacts.flatMap((c) => tagsOf(c)));
  const usedWarmth = WARMTH_LEVELS.filter((w) => contacts.some((c) => c.warmth === w));

  const toggleIn = (set: (fn: (prev: Set<string>) => Set<string>) => void, v: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const visible = contacts.filter((c) => {
    const q = filter.trim().toLowerCase();
    const matchText =
      !q ||
      `${c.name} ${c.company} ${c.title ?? ""} ${c.role ?? ""} ${c.introVia ?? ""}`
        .toLowerCase()
        .includes(q);
    const matchCompany = selectedCompanies.size === 0 || selectedCompanies.has(c.company);
    const matchTag = selectedTags.size === 0 || tagsOf(c).some((t) => selectedTags.has(t));
    const matchWarmth = selectedWarmth.size === 0 || (c.warmth !== null && selectedWarmth.has(c.warmth));
    return matchText && matchCompany && matchTag && matchWarmth;
  });

  // The stage groups as drawn, computed once: the list renders them, and the open
  // panel's J/K and arrows walk the same order, so "next" is the row below.
  const groups = CONTACT_STAGES.map((stage) => ({
    stage,
    people: visible
      .filter((c) => (c.stage ?? DEFAULT_STAGE) === stage)
      .sort((a, b) => (OLDEST_FIRST.has(stage) ? lastTouch(a) - lastTouch(b) : lastTouch(b) - lastTouch(a))),
  })).filter((g) => g.people.length > 0);
  const order = groups.flatMap((g) => g.people.map((c) => c.id));

  const open = contacts.find((c) => c.id === openId) ?? null;
  const openAt = open ? order.indexOf(open.id) : -1;

  // The header line's numbers. To message and to schedule are Home's, by the same
  // stage sets; to review is the queue's undecided cards, the Queue badge.
  const toReview = candidates.filter((c) => !c.decided).length;
  const toMessage = contacts.filter((c) => TO_MESSAGE_STAGES.includes(c.stage ?? DEFAULT_STAGE)).length;
  const toSchedule = contacts.filter((c) => TO_SCHEDULE_STAGES.includes(c.stage ?? DEFAULT_STAGE)).length;
  const activeTab = tab ?? (candidatesLoaded ? (candidates.length > 0 ? "queue" : "people") : null);
  const selectedSlug = companies.find((co) => co.name === addCompany)?.linkedinSlug ?? null;

  return (
    <div className="space-y-6">
      {/* The shared header: the same layout as Applications, and the line under the
          title is the next action from the same numbers as Home's network funnel,
          plus the people waiting in the queue. The head count that sat here counted
          the directory rather than the work. */}
      <PageHeader
        title="Network"
        parts={
          loading || !candidatesLoaded
            ? null
            : [
                { n: toReview, label: "to review" },
                { n: toMessage, label: "to message" },
                { n: toSchedule, label: "to schedule" },
              ]
        }
        actions={
          <>
            {/* Two verbs, matching the applications header: one that goes and looks,
                one that records. */}
            <button
              onClick={() => {
                setFinding((v) => !v);
                setAdding(false);
                setTab("people");
              }}
              className={headerButton("secondary", "blue")}
            >
              <Search size={14} /> Find people
            </button>
            <button
              onClick={() => {
                setAdding((v) => !v);
                setFinding(false);
                setTab("people");
              }}
              className={headerButton("primary", "blue")}
            >
              <Plus size={14} /> Add person
            </button>
          </>
        }
      />

      <TabBar
        tone="blue"
        active={activeTab}
        onChange={setTab}
        tabs={[
          { key: "queue", label: "Queue", count: toReview },
          { key: "people", label: "People", count: contacts.length },
        ]}
      />

      {activeTab === null && <p className="text-sm text-zinc-500">Loading…</p>}

      {/* Mounted whenever the tab has been decided, hidden on People, so an import
          that takes a minute keeps going if you look at the list meanwhile. */}
      {activeTab !== null && (
        <div hidden={activeTab !== "queue"}>
          <PeopleQueue
            active={activeTab === "queue"}
            paused={!!open}
            candidates={candidates}
            setCandidates={setCandidates}
            reloadCandidates={loadCandidates}
            contacts={contacts.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
            onContactsChanged={load}
            onOpenContact={(id) => {
              setSwitched(false);
              setOpenId(id);
            }}
            onFind={() => {
              setTab("people");
              setAdding(false);
              setFinding(true);
            }}
          />
        </div>
      )}

      {activeTab === "people" && (
        <>
          {/* Find: pick a company, open its People tab pre-filtered. This panel does not
              record anything. The company is a select rather than a text field so the
              slug is known and the link lands on the real People tab. */}
          {finding && (
            <div className="bg-zinc-900 border border-accent-blue/30 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-2">
                <select
                  value={addCompany}
                  onChange={(e) => setAddCompany(e.target.value)}
                  autoFocus
                  className={INPUT}
                >
                  <option value="">Which company…</option>
                  {[...companies]
                    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
                    .map((co) => (
                      <option key={co.name} value={co.name}>
                        {co.name}
                      </option>
                    ))}
                </select>
                <input
                  value={addKeywords}
                  onChange={(e) => setAddKeywords(e.target.value)}
                  placeholder="Role filter (e.g. product designer)"
                  className={INPUT}
                />
                <a
                  href={selectedSlug ? peopleTabUrl(selectedSlug, addKeywords) : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!selectedSlug) e.preventDefault();
                  }}
                  className={`shrink-0 text-sm font-medium px-4 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-all duration-150 ${
                    selectedSlug
                      ? "bg-zinc-800 text-zinc-200 hover:text-accent-blue"
                      : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  Search LinkedIn
                  <ExternalLink size={12} />
                </a>
              </div>
              {/* Two ways back from LinkedIn: one person by hand, or the whole results
                  page pasted into the queue, which is the faster one past three names. */}
              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={() => {
                    setFinding(false);
                    setTab("queue");
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
                >
                  Paste the whole page into the queue
                </button>
                <button
                  onClick={() => {
                    setFinding(false);
                    setAdding(true);
                  }}
                  className="text-xs font-semibold text-accent-blue hover:opacity-80 transition-opacity duration-150"
                >
                  Found someone? Add them →
                </button>
              </div>
            </div>
          )}

          {/* Add: the record. Pasting the profile URL fills the name from its slug at
              once, then from the profile's public page (name and current company) when
              LinkedIn answers a logged-out request, which it does not always. The role
              stays typed: LinkedIn masks it for logged-out visitors. Saving keeps the
              panel open and clears it, because people arrive in batches of five. */}
          {adding && (
            <div className="bg-zinc-900 border border-accent-blue/30 rounded-lg p-4 space-y-2">
              <input
                ref={urlRef}
                value={addUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="LinkedIn profile URL (optional)"
                autoFocus
                className={INPUT}
              />
              {/* Quiet and in flow, under the field it is about. Reserved height so the
                  form does not jump when it appears and goes. */}
              <p className="text-[11px] text-zinc-500 h-3 -mt-1" aria-live="polite">
                {lookingUp ? "Looking up…" : ""}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Name"
                  className={INPUT}
                />
                <input
                  value={addCompany}
                  onChange={(e) => setAddCompany(e.target.value)}
                  list="target-company-names"
                  placeholder="Company"
                  className={INPUT}
                />
                <input
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  placeholder="Their role"
                  className={INPUT}
                />
              </div>
              <datalist id="target-company-names">
                {companies.map((co) => (
                  <option key={co.name} value={co.name} />
                ))}
              </datalist>

              {/* The mutual, same picker as a referral on the applications side. Empty by
                  default, because most of these are cold and a prompt to name a connection
                  you do not have is a prompt to leave a field blank. */}
              {addVia ? (
                <div className="flex items-center justify-between gap-2 border border-accent-blue/40 rounded px-2 py-1">
                  <p className="text-xs text-zinc-200 truncate">Found through {addVia}</p>
                  <button
                    onClick={() => setAddVia("")}
                    className="text-xs text-zinc-600 hover:text-zinc-300 shrink-0"
                    title="Cold instead"
                  >
                    ×
                  </button>
                </div>
              ) : pickingVia ? (
                <PersonPicker
                  accent="rgb(143 205 253)"
                  confirm={false}
                  options={contacts.map((c) => ({ id: c.id, name: c.name, subtitle: c.company }))}
                  placeholder="Who connects you?"
                  onSave={(id) => {
                    setAddVia(contacts.find((c) => c.id === id)?.name ?? "");
                    setPickingVia(false);
                  }}
                  onCancel={() => setPickingVia(false)}
                />
              ) : (
                <button
                  onClick={() => setPickingVia(true)}
                  className="text-xs font-semibold text-accent-blue hover:opacity-80 transition-opacity duration-150"
                >
                  + Add a mutual
                </button>
              )}

              <div className="flex items-center justify-end pt-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setAdding(false);
                      clearAddForm();
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addOne}
                    disabled={!addName.trim()}
                    className="text-sm font-medium px-4 py-1.5 bg-accent-blue text-black rounded-md hover:opacity-90 disabled:opacity-40 transition-all duration-150"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filter */}
          {contacts.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search by name, role or company…"
                  className="w-full text-sm pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-accent-blue/50 transition-all duration-150"
                />
              </div>
              <ChipFilterRow
                items={contactCompanies}
                selected={selectedCompanies}
                onToggle={toggleCompany}
                onClear={() => setSelectedCompanies(new Set())}
              />
              {/* One row for the relationship, smaller than the company chips because it
                  is the second question you ask of the list, not the first. Warmth leads,
                  then a hairline, then the tags. */}
              {usedTags.length + usedWarmth.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {usedWarmth.map((w) => (
                    <FilterChip key={w} label={w} on={selectedWarmth.has(w)} onClick={() => toggleIn(setSelectedWarmth, w)} />
                  ))}
                  {usedWarmth.length > 0 && usedTags.length > 0 && <span className="w-px h-3 bg-zinc-800 mx-1" />}
                  {usedTags.map((t) => (
                    <FilterChip key={t} label={t} on={selectedTags.has(t)} onClick={() => toggleIn(setSelectedTags, t)} />
                  ))}
                  {selectedTags.size + selectedWarmth.size > 0 && (
                    <button
                      onClick={() => {
                        setSelectedTags(new Set());
                        setSelectedWarmth(new Set());
                      }}
                      className="text-[11px] px-1.5 py-0.5 text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : contacts.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <p className="text-zinc-500">Nobody here yet. Add someone from the queue and they land here.</p>
              <button
                onClick={() => setFinding(true)}
                className="mt-3 text-sm text-accent-blue hover:opacity-80 transition-opacity duration-150"
              >
                Find people at a company you are tracking
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Warmth, tags, companies and the search all narrow together, so they can
                  meet at nobody. Say so, rather than leave a blank page under the chips. */}
              {visible.length === 0 && (
                <p className="px-1 text-sm text-zinc-500">
                  Nobody matches these filters.{" "}
                  <button
                    onClick={() => {
                      setFilter("");
                      setSelectedCompanies(new Set());
                      setSelectedTags(new Set());
                      setSelectedWarmth(new Set());
                    }}
                    className="text-zinc-300 hover:text-white transition-colors duration-150"
                  >
                    Clear all
                  </button>
                </p>
              )}
              {groups.map(({ stage, people: group }) => {
                return (
                  <div key={stage}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{stage}</h3>
                      <span className="text-xs text-zinc-600">{group.length}</span>
                    </div>
                    <div className="space-y-2">
                      {group.map((c) => {
                        const hist = (() => {
                          try {
                            const v = JSON.parse(c.stageHistory ?? "[]");
                            return Array.isArray(v) ? v : [];
                          } catch {
                            return [];
                          }
                        })();
                        // Days since the last stage change or recorded nudge, for people
                        // who have accepted but have no call booked.
                        const last = hist.length ? new Date(hist[hist.length - 1].at).getTime() : NaN;
                        const quietDays =
                          FOLLOW_UP_STAGES.includes(c.stage ?? DEFAULT_STAGE) && !Number.isNaN(last)
                            ? Math.max(0, Math.floor((now - last) / 86_400_000))
                            : null;
                        const overdue = quietDays !== null && quietDays >= NUDGE_AFTER_DAYS;
                        return (
                          <div
                            key={c.id}
                            className="bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all duration-150"
                          >
                            <div className="flex items-center gap-3 px-3.5 py-3">
                              <CompanyLogo company={c.company} jobUrl={c.linkedinUrl ?? ""} size={40} />
                              <button onClick={() => setOpenId(c.id)} className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                                  <span className="truncate">{c.name}</span>
                                  {c.linkedinUrl && (
                                    <a
                                      href={c.linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="shrink-0 text-zinc-600 hover:text-accent-blue transition-colors duration-150"
                                      title="Open their LinkedIn"
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  )}
                                </p>
                                <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 min-w-0">
                                  <span className="shrink-0">{c.company}</span>
                                  {(c.title || c.role) && (
                                    <>
                                      <span className="text-zinc-700 shrink-0">·</span>
                                      <span className="truncate">{c.title || c.role}</span>
                                    </>
                                  )}

                                </p>
                              </button>
                              <div className="flex items-center gap-2 shrink-0">
                                {/* What is left to fill in on the stage that asks the most
                                    of you. Quiet on purpose: a to-do marker, not an alarm,
                                    and it goes the moment a summary is pasted. */}
                                {(c.stage ?? DEFAULT_STAGE) === DEFAULT_STAGE && !c.profileText?.trim() && (
                                  <span className="text-[11px] text-zinc-600" title="No summary yet. Open them and paste their profile.">
                                    no summary
                                  </span>
                                )}
                                {quietDays !== null && (
                                  <span
                                    className={`text-xs tabular-nums ${overdue ? "text-accent-blue font-medium" : "text-zinc-600"}`}
                                    title={overdue ? "Time to reach out again" : "Days since your last touch"}
                                  >
                                    {quietDays}d
                                  </span>
                                )}
                                {/* A nudge does not change the stage, so it is recorded as a
                                    history entry of its own, which restarts the count. */}
                                {overdue && (
                                  <button
                                    onClick={() =>
                                      update(c.id, {
                                        stageHistory: JSON.stringify([
                                          ...hist,
                                          { stage: c.stage ?? DEFAULT_STAGE, at: new Date().toISOString(), nudge: true },
                                        ]),
                                      })
                                    }
                                    className="text-xs font-semibold text-accent-blue border border-accent-blue/40 rounded-full px-2 py-0.5 hover:bg-accent-blue/10 transition-all duration-150"
                                    title="You followed up; restart the count"
                                  >
                                    Nudged
                                  </button>
                                )}
                                <select
                                  value={c.stage ?? DEFAULT_STAGE}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    update(c.id, {
                                      stage: next,
                                      stageHistory: JSON.stringify([
                                        ...hist,
                                        { stage: next, at: new Date().toISOString() },
                                      ]),
                                    });
                                  }}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none text-center min-w-[6.5rem] ${
                                    CONTACT_STAGE_COLORS[c.stage ?? DEFAULT_STAGE] ?? "bg-zinc-800 text-zinc-300"
                                  }`}
                                  style={{ appearance: "none" }}
                                >
                                  {CONTACT_STAGES.map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {open && (
        <ContactPanel
          // Keyed by person so each one mounts fresh. Reusing one instance kept the
          // previous person's mutuals, notes and calls in its state.
          key={open.id}
          contact={open}
          allContacts={contacts.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
          // Tags you made up for one person are offered on everyone else's.
          knownTags={usedTags}
          rolesAtCompany={roleCounts[open.company.trim().toLowerCase()] ?? 0}
          onOpenContact={(id) => {
            setSwitched(true);
            setOpenId(id);
          }}
          arrivedFromSwitch={switched}
          // Going through a stage one person at a time without closing the panel.
          // Null at either end, and when the open person is filtered out of the list.
          prevId={openAt > 0 ? order[openAt - 1] : null}
          nextId={openAt >= 0 && openAt < order.length - 1 ? order[openAt + 1] : null}
          position={openAt >= 0 ? `${openAt + 1} of ${order.length}` : null}
          onDelete={remove}
          onClose={() => {
            setSwitched(false);
            setOpenId(null);
          }}
          onUpdate={update}
        />
      )}
    </div>
  );
}
