import Link from "next/link";
import type { ReactNode } from "react";
import { Clock, Users } from "lucide-react";
import { computeInsights, type BreakdownRow, type CompanyRow, type CountRow, type Insights } from "@/lib/insights";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TierBadge } from "@/components/TierBadge";
import NetworkGraph from "@/components/NetworkGraph";
import { card, tag } from "@/lib/ui";

// Every visit reads the database. Insights is only worth opening if it agrees
// with the pipeline you just left.
export const dynamic = "force-dynamic";

/**
 * Insights: the deeper, occasional read on whether the search is working.
 *
 * Home carries the few numbers that change this week's plan and links here; this
 * page is where they are taken apart: the funnel, which kinds of company and which
 * sources are producing replies, the company table, and where you know people. It
 * has no nav tab, since it is opened now and then rather than every day.
 *
 * It is deliberately read-only (every row links through to the page where the thing
 * lives). Counts by stage and the weekly pace chart were cut: they described the
 * data without changing what to do next. The network column is the exception that
 * proves it: Home now carries only what is on the plate, so this is where the
 * network is taken apart by the user's own categories (relationship tags, warmth,
 * company), which is how "who could I ask" actually gets answered.
 *
 * The whole page is written for small numbers. The search has a dozen applications,
 * not a thousand, and a dashboard that prints "0%" or "100%" for a group of two will
 * be read as a finding. Groups below the sample floor show what actually happened
 * (one pip per application) and say it is too early, rather than a rate.
 */
export default async function InsightsPage() {
  const data = await computeInsights();
  const { applications: apps, network: net } = data;

  return (
    <div className="space-y-8">
      <div>
        {/* The way back, since there is no tab to click: Insights is reached from Home. */}
        <Link href="/" className="text-meta text-fg-3 hover:text-fg-1 transition-colors duration-90 ease-enter">
          ← Home
        </Link>
        <h1 className="text-h1 text-fg-1 mt-1">Insights</h1>
      </div>

      {/* Applications and Network side by side, each as its own column, so the page
          reads as the two halves of the search rather than one long scroll where the
          network starts below the fold. Applications is wider-content (the company
          table, two breakdowns) and goes left, where reading starts. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-12 items-start">
        <ApplicationsSection apps={apps} minSample={data.minSample} />
        <NetworkSection net={net} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function SectionHeading({ children }: { children: ReactNode }) {
  // The column's name, one step above the card titles under it. It used to be a
  // dim eyebrow with a pink or blue dot saying which half of the search it was;
  // the word already says that, so the dot went and the heading took the h2 step
  // to carry the column on its own.
  return <h2 className="t-section">{children}</h2>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${card} p-4 ${className}`}>{children}</div>;
}

function CardTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-name text-fg-1">{children}</h3>
      {note && <p className="text-meta text-fg-3 mt-0.5">{note}</p>}
    </div>
  );
}

/** The `·` between facts in a line: separator dim, so the facts carry the line. */
function Sep() {
  return <span className="text-fg-4 mx-1.5">·</span>;
}

// Bars are one neutral chalk on a lift track. They used to be pink on the
// applications side and blue on the network side, which only restated the column.
const TRACK = "h-2 rounded-[2px] bg-lift overflow-hidden";
const FILL = "h-full rounded-[2px] bg-fg-2";

/**
 * Hover detail without client JS: a panel that appears under its trigger on hover
 * or keyboard focus. Named group, so a Hover inside a hoverable card does not open
 * every panel in the card at once.
 *
 * The row itself lights up the way the company table's rows do. Without that the
 * detail was undiscoverable: nothing on a bar says there is more under it. The
 * negative margin keeps the row's content on the card's text edge, and the panel
 * starts at that edge too.
 */
function Hover({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  return (
    <div
      className="relative group/hover -mx-2 px-2 py-1 rounded-control hover:bg-lift focus-visible:bg-lift transition-colors duration-90 ease-enter"
      tabIndex={0}
    >
      {children}
      <div className="pointer-events-none absolute left-2 top-full z-20 mt-1 hidden min-w-[14rem] max-w-sm rounded-card border border-line-2 bg-raised px-3 py-2 text-meta text-fg-2 shadow-float group-hover/hover:block group-focus/hover:block">
        {detail}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

function ApplicationsSection({ apps, minSample }: { apps: Insights["applications"]; minSample: number }) {
  const sentStep = apps.funnel[0];

  return (
    <section className="space-y-6">
      <SectionHeading>Roles</SectionHeading>

      {/* The two numbers that matter. Response rate is the headline because it is
          the one that says whether the approach works; the count beside it says how
          much evidence the rate stands on. Side by side in one card now that the
          column is half the page wide; stacked beside the funnel they left a tall
          card with a band of nothing in it. */}
      <Card className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-meta text-fg-3">Response rate</p>
          {/* Display, the page's one headline number. Chalk, not a hue: the number
              is the finding, and colour would only say which column it is in. */}
          {apps.sent === 0 ? (
            <p className="text-display mt-1 text-fg-3">—</p>
          ) : apps.responseRate !== null ? (
            <p className="text-display mt-1 text-fg-1 tabular-nums">{pct(apps.responseRate)}</p>
          ) : (
            // Under the floor the headline is the raw fraction. "1 of 3" is true;
            // "33%" claims a precision three applications cannot carry.
            <p className="text-display mt-1 text-fg-1 tabular-nums">
              {apps.responded}
              <span className="text-h2 text-fg-3"> of {apps.sent}</span>
            </p>
          )}
          <p className="text-meta text-fg-3 mt-2">
            {apps.sent === 0
              ? "Shows once applications go out."
              : `${apps.responded} of ${apps.sent} sent reached a screen or further.`}
            {apps.heardBack > apps.responded &&
              ` ${apps.heardBack} heard back at all, including ${apps.heardBack - apps.responded === 1 ? "1 rejection" : `${apps.heardBack - apps.responded} rejections`}.`}
          </p>
          {apps.freshSent > 0 && (
            // Not "of those": the sentence before ends on rejections, and these are
            // the ones still waiting.
            <p className="text-meta text-fg-3 mt-2">
              {apps.freshSent === apps.waiting && apps.waiting === 1 ? (
                <>The one application still waiting</>
              ) : apps.freshSent === apps.waiting ? (
                <>All <span className="text-fg-1 tabular-nums">{apps.waiting}</span> still waiting</>
              ) : (
                <>
                  <span className="text-fg-1 tabular-nums">{apps.freshSent}</span> of the {apps.waiting} still waiting
                </>
              )}{" "}
              went out in the last {apps.freshDays} days and may not have been read yet.
            </p>
          )}
        </div>
        <div>
          <p className="text-meta text-fg-3">Applications sent</p>
          {/* Stat, Home's tile style: the same height as the headline but condensed,
              so it reads as the evidence under the rate, not a second headline. */}
          <p className={`text-stat t-chip mt-1 tabular-nums ${apps.sent > 0 ? "text-fg-1" : "text-fg-3"}`}>{apps.sent}</p>
          {apps.notYetSent > 0 && (
            <Link
              href="/applications?tab=pipeline"
              className="text-meta text-fg-3 hover:text-fg-1 transition-colors duration-90 ease-enter mt-1 inline-block"
            >
              + {apps.notYetSent} accepted, not sent yet →
            </Link>
          )}
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardTitle note="Each step counts every application that reached it, including ones later rejected.">The funnel</CardTitle>
        {apps.sent === 0 ? (
          <p className="text-body text-fg-3">Nothing sent yet. The funnel fills in as applications go out.</p>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="space-y-1">
            {apps.funnel.map((step, i) => {
              const prev = i > 0 ? apps.funnel[i - 1].count : 0;
              return (
                <Hover
                  key={step.key}
                  detail={
                    step.apps.length === 0 ? (
                      <span className="text-fg-3">None yet.</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {step.apps.map((a) => (
                          <li key={a.id} className="truncate">
                            <span className="text-fg-1">{a.company}</span>
                            <span className="text-fg-4"> · </span>
                            <span className="text-fg-3">{a.roleTitle}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                >
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_7.5rem] items-center gap-3 cursor-default">
                    <span className={`text-body ${step.count > 0 ? "text-fg-2" : "text-fg-3"}`}>{step.label}</span>
                    <div className={TRACK}>
                      <div
                        // One solid fill for every step. A tint per step made two
                        // steps with the same count look like different amounts.
                        className={FILL}
                        style={{ width: `${(step.count / sentStep.count) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-data tabular-nums text-right">
                      <span className={step.count > 0 ? "text-fg-1" : "text-fg-3"}>{step.count}</span>
                      {i > 0 && prev > 0 && (
                        <>
                          <Sep />
                          {/* Under the floor, a step's conversion is a fraction, not a percentage. */}
                          <span className="text-fg-3">
                            {prev >= minSample && step.fromPrevious !== null ? pct(step.fromPrevious) : `${step.count}/${prev}`}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </Hover>
              );
            })}
            </div>
            <div className="mt-auto pt-4">
              <p className="pt-3 border-t border-line-1 text-meta text-fg-3 tabular-nums">
                {apps.waiting} still waiting
                <Sep />
                {apps.rejected} rejected
                {apps.withdrawn > 0 && (
                  <>
                    <Sep />
                    {apps.withdrawn} withdrawn
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* What is working. The page exists for this block: after a few weeks of
          applying, which kinds of company and which sources are producing replies,
          so the next week's effort can go there. */}
      <div>
        <div className="mb-3">
          <h3 className="text-name text-fg-1">What is working</h3>
          <p className="text-meta text-fg-3 mt-0.5">
            Response rate by group. A group shows a rate once it has {minSample} sent applications; before that, each dot
            is one application, filled where it got a response.
          </p>
        </div>
        {/* Stacked: at half the page each breakdown needs the full column for its
            label, bar and rate to stay on one line. */}
        <div className="space-y-4">
          <BreakdownCard title="By company" rows={apps.byTier} minSample={minSample} />
          <BreakdownCard
            title="By source"
            rows={apps.bySource}
            minSample={minSample}
            footnote="Read from the posting's link. A role you pasted in by hand is filed by its link like any other."
          />
        </div>
      </div>

      <CompaniesCard rows={apps.companies} />
    </section>
  );
}

function BreakdownCard({
  title,
  rows,
  minSample,
  footnote,
}: {
  title: string;
  rows: BreakdownRow[];
  minSample: number;
  footnote?: string;
}) {
  // Bars run on a 0–100% track. Scaling to the card's best rate drew 25% as a full
  // bar, and a full track reads as "everyone answered". Short bars are the honest
  // picture of a 20% response rate; the percentage beside them carries the detail.
  const readable = rows.filter((r) => r.rate !== null).length;

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-body text-fg-3">Nothing to compare until applications go out.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <Hover
              key={r.key}
              detail={
                <>
                  <p>
                    <span className="text-fg-1 tabular-nums">{r.responded}</span> of {r.sent} got a response.
                  </p>
                  <p className="text-fg-3 mt-1">{r.companies.join(", ")}</p>
                </>
              }
            >
              <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4.5rem] items-center gap-3 cursor-default">
                <div className="min-w-0">
                  <p className="text-body text-fg-2 truncate">{r.label}</p>
                  <p className="text-meta text-fg-3 tabular-nums">{r.sent} sent</p>
                </div>
                {r.rate !== null ? (
                  <>
                    <div className={TRACK}>
                      <div className={FILL} style={{ width: `${r.rate * 100}%` }} />
                    </div>
                    <span className="font-mono text-data text-fg-1 tabular-nums text-right">{pct(r.rate)}</span>
                  </>
                ) : (
                  <>
                    {/* One pip per application: filled chalk where it got a response,
                        a hollow ring where it did not. Fill against outline, not hue,
                        so it reads the same as the bars above it. */}
                    <div className="flex flex-wrap gap-1">
                      {r.outcomes.map((ok, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full ${ok ? "bg-fg-2" : "border border-line-input"}`}
                        />
                      ))}
                    </div>
                    {/* Short enough for one line in the rate column; "Too few to read"
                        wrapped to two ragged lines at 11px. */}
                    <span className="text-meta text-fg-3 text-right whitespace-nowrap">Too early</span>
                  </>
                )}
              </div>
            </Hover>
          ))}
          {readable === 0 && (
            <p className="text-meta text-fg-3 mt-3 pt-3 border-t border-line-1">
              No group has {minSample} applications yet, so nothing here is a pattern.
            </p>
          )}
          {readable === 1 && rows.length > 1 && (
            <p className="text-meta text-fg-3 mt-3 pt-3 border-t border-line-1">
              Only one group is big enough to read, so there is nothing to compare it with yet.
            </p>
          )}
          {footnote && <p className="text-meta text-fg-3 pt-2">{footnote}</p>}
        </div>
      )}
    </Card>
  );
}

// How many companies show before the rest fold away. Enough to cover the pipeline
// and the top of the queue; the long tail of single passed roles is reference.
const COMPANY_ROWS = 10;

function CompaniesCard({ rows }: { rows: CompanyRow[] }) {
  const anyClosed = rows.some((r) => r.closed > 0);
  const cols = anyClosed
    ? "grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem_3.5rem]"
    : "grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem]";
  const head = rows.slice(0, COMPANY_ROWS);
  const tail = rows.slice(COMPANY_ROWS);

  // A render function, not a nested component: a component declared inside
  // another is a new type on every render.
  const row = (r: CompanyRow) => {
    // Land on the tab where this company's roles actually are.
    const tab = r.pipeline > 0 || r.closed > 0 ? "pipeline" : r.queue > 0 ? "queue" : "passed";
    // Columns step down in lightness by how live they are: pipeline brightest,
    // passed and closed dimmest. A zero is a separator-weight dot, not a "0".
    const cell = (n: number, tone: string) => (
      <span className={`font-mono text-data tabular-nums text-right ${n > 0 ? tone : "text-fg-4"}`}>{n > 0 ? n : "·"}</span>
    );
    return (
      <Link
        key={r.company}
        href={`/applications?tab=${tab}&company=${encodeURIComponent(r.company)}`}
        className={`grid ${cols} items-center gap-2 px-2 py-1 min-h-9 -mx-2 rounded-control hover:bg-lift transition-colors duration-90 ease-enter`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <CompanyLogo company={r.company} jobUrl={r.jobUrl} domain={r.domain} logo={r.logo} size={24} />
          <span className="text-name text-fg-1 truncate">{r.company}</span>
          {/* No badge for untracked companies here. TierBadge's dashed "·" box is
              meant for the queue, where untracked is a signal; in this table a
              column of empty boxes read as missing logos. */}
          {r.tier !== null && <TierBadge tier={r.tier} />}
          {r.contacts > 0 && (
            // The mutuals glyph, not a hue, says "you know people here".
            <span
              className="inline-flex items-center gap-1 text-meta text-fg-2 tabular-nums shrink-0"
              title={`You know ${r.contacts} ${r.contacts === 1 ? "person" : "people"} here`}
            >
              <Users size={12} strokeWidth={1.5} absoluteStrokeWidth />
              {r.contacts} known
            </span>
          )}
        </span>
        {cell(r.pipeline, "text-fg-1")}
        {cell(r.queue, "text-fg-2")}
        {cell(r.passed, "text-fg-3")}
        {anyClosed && cell(r.closed, "text-fg-3")}
      </Link>
    );
  };

  return (
    <Card>
      <CardTitle note="Every company with a role in the queue, active, or passed on. Click through to its roles.">
        Roles by company
      </CardTitle>
      {rows.length === 0 ? (
        <p className="text-body text-fg-3">No roles yet. The queue fills from the daily scan.</p>
      ) : (
        <div>
          <div className={`grid ${cols} gap-2 pb-2 mb-1 border-b border-line-1 t-label`}>
            <span>Company</span>
            <span className="text-right">Active</span>
            <span className="text-right">Queue</span>
            <span className="text-right">Passed</span>
            {anyClosed && <span className="text-right">Closed</span>}
          </div>
          {head.map(row)}
          {/* <details> rather than state, so the page stays a server component. */}
          {tail.length > 0 && (
            <details className="group/more">
              <summary className="cursor-pointer list-none text-meta text-fg-3 hover:text-fg-1 transition-colors duration-90 ease-enter pt-2">
                <span className="group-open/more:hidden">Show {tail.length} more</span>
                <span className="hidden group-open/more:inline">Show fewer</span>
              </summary>
              <div className="pt-1">
                {tail.map(row)}
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

function NetworkSection({ net }: { net: Insights["network"] }) {
  const knownSet = new Set(net.knownPipelineCompanies.map((c) => c.company));
  const unknownPipeline = net.pipelineCompanies.filter((c) => !knownSet.has(c));

  return (
    <section className="space-y-6">
      <SectionHeading>People</SectionHeading>

      {/* Everyone you know and how they connect through mutuals, at the top of the
          column because it is the one picture of the whole network. It may move to
          Home once there are enough people for it to carry that page. */}
      <NetworkGraph />

      <Card className="flex flex-col gap-6">
        <div>
          <p className="text-meta text-fg-3">People in conversation</p>
          {/* Stat, not display: the response rate is the page's one headline. */}
          <p className={`text-stat t-chip mt-1 tabular-nums ${net.inConversation > 0 ? "text-fg-1" : "text-fg-3"}`}>
            {net.inConversation}
          </p>
          <p className="text-meta text-fg-3 mt-2">
            {net.total === 0
              ? "No one in your network yet."
              : `Of ${net.total} ${net.total === 1 ? "person" : "people"} in your network: replied, booked, or talked.`}
          </p>
        </div>

        {/* Follow-ups due. The one list on the page that is an action, so it names
            names and links straight to each person, and it is the one place the
            page uses rope: an overdue follow-up is your next move, not an alarm,
            so it gets the clock glyph and the day count in rope. */}
        <div>
          <p className="t-group mb-2">Follow-ups due</p>
          {net.due.length === 0 ? (
            <p className="text-meta text-fg-3">
              None. A conversation shows here after {net.nudgeAfterDays} quiet days at Connected or Replied.
            </p>
          ) : (
            <ul className="space-y-1">
              {net.due.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/networking?contact=${c.id}`}
                    className="flex items-center gap-2 rounded-control px-2 py-1 -mx-2 hover:bg-lift transition-colors duration-90 ease-enter"
                  >
                    <span className="text-body text-fg-1 truncate">{c.name}</span>
                    <span className="text-meta text-fg-3 truncate">{c.company}</span>
                    <span
                      className="ml-auto inline-flex items-center gap-1 font-mono text-data text-rope tabular-nums shrink-0"
                      title={`${c.days} days since last touch. Follow up.`}
                    >
                      <Clock size={14} strokeWidth={1.5} absoluteStrokeWidth />
                      {c.days}d
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Where you know people, set against where you are applying. The sentence is
          the point: a pipeline company where you know someone is a referral you have
          not asked for, and one where you know no one is a search worth running. */}
      <Card>
        <CardTitle>Where you know people</CardTitle>
        {net.pipelineCompanies.length === 0 ? (
          <p className="text-body text-fg-3">No active roles yet to check against.</p>
        ) : (
          <p className="text-body text-fg-2">
            You know someone at{" "}
            <span className="text-fg-1 tabular-nums">{net.knownPipelineCompanies.length}</span> of your{" "}
            <span className="text-fg-1 tabular-nums">{net.pipelineCompanies.length}</span>{" "}
            {net.pipelineCompanies.length === 1 ? "company" : "companies"} with an active role.
          </p>
        )}

        {/* Known and not-yet-known told apart by fill, not hue: a company where you
            know someone is a solid lifted chip with the head count; one where you
            know no one is dashed, the guide's mark for "not there yet". */}
        {net.pipelineCompanies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {net.knownPipelineCompanies.map((c) => (
              <Link
                key={c.company}
                href={`/networking?company=${encodeURIComponent(c.company)}`}
                className="inline-flex items-center gap-2 text-body pl-1 pr-2 py-1 rounded-control bg-lift text-fg-1 hover:bg-line-2 transition-colors duration-90 ease-enter"
              >
                <CompanyLogo company={c.company} size={18} />
                {c.company}
                <span className="text-meta text-fg-2 tabular-nums">{c.contacts}</span>
              </Link>
            ))}
            {/* ?discover= opens the Network page's find-people flow for that company. */}
            {unknownPipeline.map((c) => (
              <Link
                key={c}
                href={`/networking?discover=${encodeURIComponent(c)}`}
                title={`No one yet at ${c}. Find someone.`}
                className="inline-flex items-center gap-2 text-body pl-1 pr-2 py-1 rounded-control border border-dashed border-line-3 text-fg-2 hover:text-fg-1 hover:border-line-input transition-colors duration-90 ease-enter"
              >
                <CompanyLogo company={c} size={18} />
                {c}
                <span className="text-meta text-fg-3">find</span>
              </Link>
            ))}
          </div>
        )}

        {net.otherKnownCompanies.length > 0 && (
          <p className="text-meta text-fg-3 mt-4">
            Also know people at{" "}
            {net.otherKnownCompanies.map((c, i) => (
              <span key={c.company}>
                {i > 0 && ", "}
                <Link
                  href={`/networking?company=${encodeURIComponent(c.company)}`}
                  className="text-fg-2 hover:text-fg-1 hover:underline transition-colors duration-90 ease-enter"
                >
                  {c.company}
                </Link>
                {c.contacts > 1 && <span className="text-fg-3 tabular-nums"> ({c.contacts})</span>}
              </span>
            ))}
            .
          </p>
        )}
      </Card>

      {/* Who they are, in the user's own categories. These are descriptive, but on
          the network side the description is the tool: "who are my mentors", "who is
          close enough to ask for a referral" is read straight off these. */}
      <TagsCard rows={net.byTag} untagged={net.untagged} total={net.total} />
      <WarmthCard rows={net.byWarmth} total={net.total} />
      <PeopleByCompanyCard rows={net.byCompany} />
    </section>
  );
}

/**
 * One row per category: label, a bar, the count. Bars are scaled to the network's
 * size, not to the biggest row, so "2 mentors" in a network of thirteen draws as
 * the small share it is.
 */
function CountBars({ rows, total }: { rows: CountRow[]; total: number }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2.5rem] items-center gap-3">
          <span className={`text-body capitalize truncate ${r.count > 0 ? "text-fg-2" : "text-fg-3"}`}>{r.label}</span>
          <div className={TRACK}>
            {/* "not set" is a lightness step down from the rest: it is the gap in
                your own notes, not a category, so it should not read as one. */}
            <div
              className={r.key === "unset" ? "h-full rounded-[2px] bg-line-3" : FILL}
              style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }}
            />
          </div>
          <span className={`font-mono text-data tabular-nums text-right ${r.count > 0 ? "text-fg-1" : "text-fg-3"}`}>
            {r.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function TagsCard({ rows, untagged, total }: { rows: CountRow[]; untagged: number; total: number }) {
  return (
    <Card>
      <CardTitle note="What each person is to you. One person can carry several tags.">By relationship</CardTitle>
      {total === 0 ? (
        <p className="text-body text-fg-3">No one in your network yet.</p>
      ) : rows.length === 0 ? (
        // Honest and quiet: the absence is the finding, and a row of zero bars
        // would only dress it up.
        <p className="text-body text-fg-3">Nobody is tagged yet. Tags like mentor or peer are set on each person.</p>
      ) : (
        <>
          <CountBars rows={rows} total={total} />
          {untagged > 0 && (
            <p className="text-meta text-fg-3 tabular-nums mt-3 pt-3 border-t border-line-1">
              {untagged} of {total} not tagged yet.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function WarmthCard({ rows, total }: { rows: CountRow[]; total: number }) {
  const unset = rows.find((r) => r.key === "unset")?.count ?? 0;
  return (
    <Card>
      <CardTitle note="How close you are decides what you can ask: no referral asks of someone cold.">By warmth</CardTitle>
      {total === 0 ? (
        <p className="text-body text-fg-3">No one in your network yet.</p>
      ) : unset === total ? (
        <p className="text-body text-fg-3">No warmth set on anyone yet. Cold, warm or close is set on each person.</p>
      ) : (
        <CountBars rows={rows} total={total} />
      )}
    </Card>
  );
}

function PeopleByCompanyCard({ rows }: { rows: Insights["network"]["byCompany"] }) {
  return (
    <Card>
      <CardTitle note="Where the people you know work. Marked where you also have an open application.">
        People by company
      </CardTitle>
      {rows.length === 0 ? (
        <p className="text-body text-fg-3">No one in your network yet.</p>
      ) : (
        <div>
          {rows.map((r) => (
            <Link
              key={r.company}
              href={`/networking?company=${encodeURIComponent(r.company)}`}
              className="flex items-center gap-2 px-2 py-1 min-h-9 -mx-2 rounded-control hover:bg-lift transition-colors duration-90 ease-enter"
            >
              <CompanyLogo company={r.company} size={24} />
              <span className="text-name text-fg-1 truncate">{r.company}</span>
              {r.inPipeline && <span className={`${tag} shrink-0`}>active role</span>}
              <span className="ml-auto font-mono text-data text-fg-1 tabular-nums">{r.contacts}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
