"use client";

import { useEffect, useState } from "react";
import { Clock, ExternalLink, Plus, Search } from "lucide-react";
import { button, emptyBox, input, listGrid, toggle } from "@/lib/ui";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ContactPanel, type PanelContact } from "@/components/ContactPanel";
import {
  CONTACT_STAGES,
  DEFAULT_STAGE,
  FOLLOW_UP_STAGES,
  NUDGE_AFTER_DAYS,
  orderTags,
  TO_MESSAGE_STAGES,
  TO_SCHEDULE_STAGES,
  WARMTH_LEVELS,
} from "@/lib/contact-stages";
import { ChipFilterRow } from "@/components/ChipFilterRow";
import { StageSelect } from "@/components/StageChip";
import { ListCard, TimingLine } from "@/components/ListCard";
import { PeopleQueue, type Candidate } from "@/components/PeopleQueue";
import { FormFrame, PageHeader, TabBar, formLink, headerButton } from "@/components/PageChrome";

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
 * One way in, the Queue tab's Add people box, laid out like Applications: the
 * header's primary button opens it, and it takes a LinkedIn page of people or one
 * profile link, both of which become cards to add or pass on. Someone not on
 * LinkedIn goes in through the same box's "Add someone manually". Find people opens
 * a company's LinkedIn People tab pre-filtered, to have something to paste.
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

const INPUT = input();


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

// The same toggle as the company chips in ChipFilterRow directly above, so the two
// rows read as one system: neutral, with "on" as a lift fill rather than a hue.
function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={toggle(on)}>
      {label}
    </button>
  );
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

  // Find: a company and a role filter, for the link to its LinkedIn People tab.
  const [findCompany, setFindCompany] = useState("");
  const [findKeywords, setFindKeywords] = useState("product designer");
  const [finding, setFinding] = useState(false);
  // The Add people box on the Queue tab, opened by the header's primary button.
  const [showAdd, setShowAdd] = useState(false);
  const [companies, setCompanies] = useState<{ name: string; linkedinSlug: string | null; tier: number }[]>([]);
  // ?stage=<Stage> on the People tab: scroll to that group and light it briefly.
  const [flashStage, setFlashStage] = useState<string | null>(null);

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
      setFindCompany(discover);
      setFinding(true);
    }
    // ?stage= names a People group, as Home's "Upcoming calls" does with Scheduled.
    const stage = qs.get("stage");
    const stageName = stage ? CONTACT_STAGES.find((s) => s.toLowerCase() === stage.toLowerCase()) : undefined;
    if (stageName) setFlashStage(stageName);
    // A person or a company is about the network, so it lands on People whatever is
    // queued; Find is how the queue fills, so it lands on the Queue.
    const t = qs.get("tab");
    // The tab is labelled Network; ?tab=network and the older ?tab=people both land on it.
    if (t === "queue" || t === "people") setTab(t);
    else if (t === "network") setTab("people");
    else if (discover) setTab("queue");
    else if (contact || company || stageName) setTab("people");
  }, []);

  // ?stage=: once the list is drawn, scroll the group into view and light it for a
  // moment. Waits for the People tab and the contacts, since before both the group
  // does not exist. Runs once per arrival: the stage is cleared when the light goes.
  const [flashOn, setFlashOn] = useState(false);
  const showingPeople = tab === "people";
  useEffect(() => {
    if (!flashStage || loading || !showingPeople) return;
    const el = document.getElementById(`stage-${flashStage}`);
    if (!el) return;
    const start = setTimeout(() => {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      setFlashOn(true);
    }, 50);
    const stop = setTimeout(() => setFlashOn(false), 1650);
    const done = setTimeout(() => setFlashStage(null), 1850);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
      clearTimeout(done);
    };
  }, [flashStage, loading, showingPeople]);

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
  const selectedSlug = companies.find((co) => co.name === findCompany)?.linkedinSlug ?? null;

  return (
    <div className="space-y-6">
      {/* The shared header: the same layout as Applications, and the line under the
          title is the next action from the same numbers as Home's network funnel,
          plus the people waiting in the queue. The head count that sat here counted
          the directory rather than the work. */}
      <PageHeader
        title="People"
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
                one that records. Both work on the Queue, which is where people come in. */}
            <button
              onClick={() => {
                setFinding((v) => (activeTab === "queue" ? !v : true));
                setShowAdd(false);
                setTab("queue");
              }}
              className={headerButton("secondary")}
            >
              <Search size={16} strokeWidth={1.5} absoluteStrokeWidth /> Find people
            </button>
            <button
              onClick={() => {
                setShowAdd((v) => (activeTab === "queue" ? !v : true));
                setFinding(false);
                setTab("queue");
              }}
              className={headerButton("primary")}
            >
              <Plus size={16} strokeWidth={1.5} absoluteStrokeWidth /> Add people
            </button>
          </>
        }
      />

      <TabBar
        active={activeTab}
        onChange={setTab}
        tabs={[
          { key: "queue", label: "Queue", count: toReview, urgent: true },
          { key: "people", label: "Network", count: contacts.length },
        ]}
      />

      {activeTab === null && <p className="text-body text-fg-3">Loading…</p>}

      {/* Find: pick a company, open its People tab pre-filtered. This form records
          nothing; what you find comes back through Add people. The company is a
          select rather than a text field so the slug is known and the link lands on
          the real People tab. The same frame as Add people and Add role. */}
      {activeTab === "queue" && finding && (
        <FormFrame
          title="Find people"
          hint="Opens the company's People tab on LinkedIn, filtered by role. Select all there and paste it into Add people."
          onClose={() => setFinding(false)}
          footerStart={
            <button
              onClick={() => {
                setFinding(false);
                setShowAdd(true);
              }}
              className={formLink}
            >
              Paste what you found
            </button>
          }
          footerEnd={
            <a
              href={selectedSlug ? peopleTabUrl(selectedSlug, findKeywords) : "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!selectedSlug) e.preventDefault();
              }}
              aria-disabled={!selectedSlug}
              className={`${button("secondary")} ${selectedSlug ? "hover:border-line-3 hover:bg-lift" : "text-fg-4 cursor-not-allowed"}`}
            >
              Search LinkedIn
              <ExternalLink size={16} strokeWidth={1.5} absoluteStrokeWidth />
            </a>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={findCompany}
              onChange={(e) => setFindCompany(e.target.value)}
              autoFocus
              aria-label="Company"
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
              value={findKeywords}
              onChange={(e) => setFindKeywords(e.target.value)}
              placeholder="Role filter (e.g. product designer)"
              aria-label="Role filter"
              className={INPUT}
            />
          </div>
        </FormFrame>
      )}

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
            companies={companies}
            onContactsChanged={load}
            onContactCreated={(made) => {
              setContacts((prev) => [...prev, made as unknown as Contact]);
              // Open them straight away: the next thing after adding someone is their
              // summary, tags and a message, all of which live in the panel. The form
              // stays open behind it, cleared, so closing the panel lands on the next.
              setSwitched(false);
              setOpenId(made.id);
            }}
            onOpenContact={(id) => {
              setSwitched(false);
              setOpenId(id);
            }}
            showAdd={showAdd}
            onShowAdd={setShowAdd}
            onFind={() => {
              setShowAdd(false);
              setFinding(true);
            }}
          />
        </div>
      )}

      {activeTab === "people" && (
        <>
          {/* Filter */}
          {contacts.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} strokeWidth={1.5} absoluteStrokeWidth className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search by name, role or company…"
                  className={`${input()} pl-8`}
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
                  {usedWarmth.length > 0 && usedTags.length > 0 && <span className="w-px h-3 bg-line-2 mx-1" />}
                  {usedTags.map((t) => (
                    <FilterChip key={t} label={t} on={selectedTags.has(t)} onClick={() => toggleIn(setSelectedTags, t)} />
                  ))}
                  {selectedTags.size + selectedWarmth.size > 0 && (
                    <button
                      onClick={() => {
                        setSelectedTags(new Set());
                        setSelectedWarmth(new Set());
                      }}
                      className={`${button("quiet", "compact")} h-6`}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-body text-fg-3">Loading…</p>
          ) : contacts.length === 0 ? (
            <div className={emptyBox}>
              <p>No people yet. Add someone from the queue, or use Add people.</p>
              <button
                onClick={() => {
                  setTab("queue");
                  setShowAdd(false);
                  setFinding(true);
                }}
                className={`${button("secondary")} mt-3`}
              >
                Find people
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Warmth, tags, companies and the search all narrow together, so they can
                  meet at nobody. Say so, rather than leave a blank page under the chips. */}
              {visible.length === 0 && (
                <p className={emptyBox}>
                  Nobody matches these filters.{" "}
                  <button
                    onClick={() => {
                      setFilter("");
                      setSelectedCompanies(new Set());
                      setSelectedTags(new Set());
                      setSelectedWarmth(new Set());
                    }}
                    className="text-fg-1 underline decoration-line-3 underline-offset-4 hover:decoration-fg-1"
                  >
                    Clear all
                  </button>
                </p>
              )}
              {groups.map(({ stage, people: group }) => {
                return (
                  // scroll-mt clears the sticky nav when ?stage= scrolls here.
                  <div key={stage} id={`stage-${stage}`} className="scroll-mt-14">
                    {/* Sticky under the nav, so a long Identified group still says
                        which group you are in. */}
                    <div className="sticky top-12 z-[5] bg-canvas flex items-center gap-2 h-8">
                      <h3 className="t-group">{stage}</h3>
                      <span className="text-meta tabular-nums text-fg-3">{group.length}</span>
                    </div>
                    {/* A grid of cards per stage, the same frame as Roles → Active:
                        three across at 1440, two at about 1024, one on a phone. Each
                        person was a bordered card, then a 56px row; the card keeps a
                        readable logo and says only who they are and when you last
                        moved. How you met, tags and mutuals are in the panel. Arriving
                        by ?stage= lights the group's cards with a neutral lift for a
                        moment, so the eye finds them; no rope, because nothing is
                        being asked. */}
                    <div className={listGrid}>
                      {group.map((c) => {
                        const hist = (() => {
                          try {
                            const v = JSON.parse(c.stageHistory ?? "[]");
                            return Array.isArray(v) ? v : [];
                          } catch {
                            return [];
                          }
                        })();
                        const stageNow = c.stage ?? DEFAULT_STAGE;
                        // Days since the last stage change or recorded nudge (or since
                        // they were added, for someone never moved), on every row, so the
                        // right edge is one column. Overdue only where the ball is with
                        // them and nothing is booked.
                        const touched = lastTouch(c);
                        const quietDays = touched ? Math.max(0, Math.floor((now - touched) / 86_400_000)) : null;
                        const overdue =
                          FOLLOW_UP_STAGES.includes(stageNow) && quietDays !== null && quietDays >= NUDGE_AFTER_DAYS;
                        // Nobody has been contacted at Identified, so its count is how
                        // long they have waited on you, not a touch.
                        const untouched = stageNow === DEFAULT_STAGE && hist.length <= 1;
                        const flash = flashStage === stage && flashOn;
                        return (
                          <ListCard
                            key={c.id}
                            logo={<CompanyLogo company={c.company} jobUrl={c.linkedinUrl ?? ""} size={40} />}
                            name={c.name}
                            // "Company · Role", as in the panel's header.
                            sub={
                              <>
                                {c.company}
                                {(c.title || c.role) && <> · {c.title || c.role}</>}
                              </>
                            }
                            link={c.linkedinUrl ? { href: c.linkedinUrl, title: "Open their LinkedIn" } : null}
                            lines={
                              touched
                                ? [
                                    // When they were added, or when you last moved: a
                                    // stage change or a recorded follow-up. Overdue is an
                                    // action, not an alarm, so it is rope with the clock,
                                    // and the follow-up sits at the end of the same line.
                                    <span key="at" className="flex items-center gap-1 min-w-0 flex-1">
                                      {overdue && (
                                        <Clock size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0 text-rope" />
                                      )}
                                      <TimingLine
                                        verb={untouched ? "Added" : "Last touch"}
                                        at={new Date(touched)}
                                        className={overdue ? "text-rope" : "text-fg-3"}
                                        title={
                                          untouched
                                            ? `Added ${quietDays} days ago and not contacted yet`
                                            : overdue
                                              ? `${quietDays} days since your last touch (a stage change or a follow-up). Follow up.`
                                              : `${quietDays} days since your last touch (a stage change or a follow-up)`
                                        }
                                      />
                                      {/* A nudge does not change the stage, so it is
                                          recorded as a history entry of its own, which
                                          restarts the count. Negative margins keep the
                                          28px button inside the 16px line, so an overdue
                                          card is no taller than its neighbours. */}
                                      {overdue && (
                                        <button
                                          onClick={() =>
                                            update(c.id, {
                                              stageHistory: JSON.stringify([
                                                ...hist,
                                                { stage: stageNow, at: new Date().toISOString(), nudge: true },
                                              ]),
                                            })
                                          }
                                          className={`${button("quiet", "compact")} relative z-[1] ml-auto -my-1.5 -mr-1`}
                                          title="You followed up; restart the count"
                                        >
                                          Follow up
                                        </button>
                                      )}
                                    </span>,
                                  ]
                                : []
                            }
                            stage={
                              <StageSelect
                                value={stageNow}
                                options={CONTACT_STAGES}
                                onChange={(next) => {
                                  update(c.id, {
                                    stage: next,
                                    stageHistory: JSON.stringify([
                                      ...hist,
                                      { stage: next, at: new Date().toISOString() },
                                    ]),
                                  });
                                }}
                              />
                            }
                            selected={c.id === openId}
                            flash={flash}
                            onOpen={() => setOpenId(c.id)}
                          />
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
