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
  WARMTH_LEVELS,
} from "@/lib/contact-stages";
import { ChipFilterRow } from "@/components/ChipFilterRow";
import { PersonPicker } from "@/components/PersonPicker";

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
};

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

/** A LinkedIn profile URL yields a usable name when nothing better is to hand. */
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
  }, []);

  const update = async (id: string, patch: Record<string, unknown>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? ({ ...c, ...patch } as Contact) : c)));
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const remove = async (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setOpenId(null);
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
  };

  const clearAddForm = () => {
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
  const addOne = async () => {
    const name = addName.trim();
    if (!name) return;
    const url = addUrl.trim().match(/https?:\/\/\S*linkedin\.com\/in\/[^\s,]+/i)?.[0] ?? null;
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
      urlRef.current?.focus();
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

  const open = contacts.find((c) => c.id === openId) ?? null;
  const selectedSlug = companies.find((co) => co.name === addCompany)?.linkedinSlug ?? null;

  return (
    <div className="space-y-6">
      {/* items-center, matching the Applications header. items-start pinned the
          button to the top of a two-line title block and it sat visibly higher than
          the Add button on the other page. */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Network</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {/* The count of people waiting on a nudge used to sit here. The rows that
                need one already say "no reply in 12d" in the alarm tone, in the place
                you would act on it, so the header was a number telling you to go and
                look at something already visible. */}
            {contacts.length} {contacts.length === 1 ? "person" : "people"}
          </p>
        </div>
        {/* Two verbs, matching the applications header: one that goes and looks, one
            that records. They were a single panel that did both, so "add someone I
            already know about" meant stepping through a company picker and a
            people-search link that had nothing to do with it. */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              setFinding((v) => !v);
              setAdding(false);
            }}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-200 rounded-lg hover:border-accent-blue/50 hover:text-accent-blue transition-all duration-150"
          >
            <Search size={14} /> Find people
          </button>
          <button
            onClick={() => {
              setAdding((v) => !v);
              setFinding(false);
            }}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-accent-blue text-black rounded-lg hover:opacity-90 transition-opacity duration-150"
          >
            <Plus size={14} /> Add person
          </button>
        </div>
      </div>

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
          <div className="flex items-center justify-end">
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

      {/* Add: the record. Nothing here can read a LinkedIn page, so the name, company
          and role are typed — except that pasting the profile URL fills the name from
          its slug, which is right about nine times in ten. Saving keeps the panel open
          and clears it, because people arrive in batches of five. */}
      {adding && (
        <div className="bg-zinc-900 border border-accent-blue/30 rounded-lg p-4 space-y-2">
          <input
            ref={urlRef}
            value={addUrl}
            onChange={(e) => {
              setAddUrl(e.target.value);
              const guess = nameFromLinkedIn(e.target.value);
              if (guess && !addName.trim()) setAddName(guess);
            }}
            placeholder="LinkedIn profile URL (optional)"
            autoFocus
            className={INPUT}
          />
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
          <p className="text-zinc-500">Nobody here yet.</p>
          <button
            onClick={() => setAdding(true)}
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
          {CONTACT_STAGES.map((stage) => {
            const group = visible.filter((c) => (c.stage ?? DEFAULT_STAGE) === stage);
            if (group.length === 0) return null;
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
