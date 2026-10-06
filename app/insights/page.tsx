import Link from "next/link";
import type { ReactNode } from "react";
import { computeInsights, type BreakdownRow, type CompanyRow, type CountRow, type Insights } from "@/lib/insights";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TierBadge } from "@/components/TierBadge";
import NetworkGraph from "@/components/NetworkGraph";

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
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150">
          ← Home
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100 mt-1">Insights</h1>
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

function SectionHeading({ children, tone }: { children: ReactNode; tone: "pink" | "blue" }) {
  // The small dot is the only colour in the heading. The headings themselves stay
  // zinc like every other section heading in the app; the dot says which half of
  // the search the section is about.
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
      <span className={`w-1.5 h-1.5 rounded-full ${tone === "pink" ? "bg-accent-pink" : "bg-accent-blue"}`} />
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-5 ${className}`}>{children}</div>;
}

function CardTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-zinc-200">{children}</h3>
      {note && <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{note}</p>}
    </div>
  );
}

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
      className="relative group/hover -mx-2 px-2 py-1 rounded-md outline-none hover:bg-zinc-800/60 focus-visible:bg-zinc-800/60 transition-colors duration-150"
      tabIndex={0}
    >
      {children}
      <div className="pointer-events-none absolute left-2 top-full z-20 mt-1 hidden min-w-[14rem] max-w-sm rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 shadow-xl group-hover/hover:block group-focus/hover:block">
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
    <section className="space-y-5">
      <SectionHeading tone="pink">Applications</SectionHeading>

      {/* The two numbers that matter. Response rate is the headline because it is
          the one that says whether the approach works; the count beside it says how
          much evidence the rate stands on. Side by side in one card now that the
          column is half the page wide; stacked beside the funnel they left a tall
          card with a band of nothing in it. */}
      <Card className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-zinc-400">Response rate</p>
          {/* 4xl, one step above the dashboard's 3xl tiles: the headline, but not
              so loud the page reads as a BI wall. */}
          {apps.sent === 0 ? (
            <p className="text-4xl font-bold mt-1 text-zinc-700">—</p>
          ) : apps.responseRate !== null ? (
            <p className="text-4xl font-bold mt-1 text-accent-pink tabular-nums">{pct(apps.responseRate)}</p>
          ) : (
            // Under the floor the headline is the raw fraction. "1 of 3" is true;
            // "33%" claims a precision three applications cannot carry.
            <p className="text-4xl font-bold mt-1 text-accent-pink tabular-nums">
              {apps.responded}
              <span className="text-xl text-zinc-500 font-semibold"> of {apps.sent}</span>
            </p>
          )}
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            {apps.sent === 0
              ? "Shows once applications go out."
              : `${apps.responded} of ${apps.sent} sent reached a screen or further.`}
            {apps.heardBack > apps.responded &&
              ` ${apps.heardBack} heard back at all, including ${apps.heardBack - apps.responded === 1 ? "1 rejection" : `${apps.heardBack - apps.responded} rejections`}.`}
          </p>
          {apps.freshSent > 0 && (
            // Not "of those": the sentence before ends on rejections, and these are
            // the ones still waiting.
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              {apps.freshSent === apps.waiting && apps.waiting === 1 ? (
                <>The one application still waiting</>
              ) : apps.freshSent === apps.waiting ? (
                <>All <span className="text-zinc-300">{apps.waiting}</span> still waiting</>
              ) : (
                <>
                  <span className="text-zinc-300">{apps.freshSent}</span> of the {apps.waiting} still waiting
                </>
              )}{" "}
              went out in the last {apps.freshDays} days and may not have been read yet.
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-zinc-400">Applications sent</p>
          {/* The dashboard tile's size: this is the evidence under the rate, not a
              second headline competing with it. */}
          <p className={`text-3xl font-bold mt-1 tabular-nums ${apps.sent > 0 ? "text-accent-pink" : "text-zinc-700"}`}>{apps.sent}</p>
          {apps.notYetSent > 0 && (
            <Link href="/applications?tab=pipeline" className="text-xs text-zinc-500 hover:text-zinc-300 mt-1 inline-block">
              + {apps.notYetSent} accepted, not sent yet →
            </Link>
          )}
        </div>
      </Card>

      <Card className="flex flex-col">
        <CardTitle note="Each step counts every application that reached it, including ones later rejected.">The funnel</CardTitle>
        {apps.sent === 0 ? (
          <p className="text-sm text-zinc-500">Nothing sent yet. The funnel fills in as applications go out.</p>
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
                      <span className="text-zinc-500">None yet.</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {step.apps.map((a) => (
                          <li key={a.id} className="truncate">
                            <span className="text-zinc-100">{a.company}</span>
                            <span className="text-zinc-500"> · {a.roleTitle}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                >
                  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_7.5rem] items-center gap-3 cursor-default">
                    <span className={`text-sm ${step.count > 0 ? "text-zinc-300" : "text-zinc-600"}`}>{step.label}</span>
                    <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        // One solid pink. A tint per step (40% → 100%) rendered as
                        // dusty mauve on the dark track, and made two steps with
                        // the same count look like different amounts.
                        className="h-full rounded-full bg-accent-pink"
                        style={{ width: `${(step.count / sentStep.count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm tabular-nums text-right">
                      <span className={step.count > 0 ? "text-zinc-100 font-semibold" : "text-zinc-600"}>{step.count}</span>
                      {i > 0 && prev > 0 && (
                        <span className="text-xs text-zinc-500">
                          {" "}
                          {/* Under the floor, a step's conversion is a fraction, not a percentage. */}
                          · {prev >= minSample && step.fromPrevious !== null ? pct(step.fromPrevious) : `${step.count}/${prev}`}
                        </span>
                      )}
                    </span>
                  </div>
                </Hover>
              );
            })}
            </div>
            <div className="mt-auto pt-4">
              <p className="pt-3 border-t border-zinc-800 text-xs text-zinc-500">
                {apps.waiting} still waiting · {apps.rejected} rejected
                {apps.withdrawn > 0 && ` · ${apps.withdrawn} withdrawn`}
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
          <h3 className="text-sm font-medium text-zinc-200">What is working</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
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
        <p className="text-sm text-zinc-500">Nothing to compare until applications go out.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <Hover
              key={r.key}
              detail={
                <>
                  <p>
                    <span className="text-zinc-100">{r.responded}</span> of {r.sent} got a response.
                  </p>
                  <p className="text-zinc-500 mt-1">{r.companies.join(", ")}</p>
                </>
              }
            >
              <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4.5rem] items-center gap-3 cursor-default">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{r.label}</p>
                  <p className="text-[11px] text-zinc-600">{r.sent} sent</p>
                </div>
                {r.rate !== null ? (
                  <>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-accent-pink" style={{ width: `${r.rate * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-zinc-100 tabular-nums text-right">{pct(r.rate)}</span>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {r.outcomes.map((ok, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full ${ok ? "bg-accent-pink" : "border border-zinc-600"}`}
                        />
                      ))}
                    </div>
                    {/* Short enough for one line in the rate column; "Too few to read"
                        wrapped to two ragged lines at 11px. */}
                    <span className="text-xs text-zinc-600 text-right whitespace-nowrap">Too early</span>
                  </>
                )}
              </div>
            </Hover>
          ))}
          {readable === 0 && (
            <p className="text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-800">
              No group has {minSample} applications yet, so nothing here is a pattern. Keep going.
            </p>
          )}
          {readable === 1 && rows.length > 1 && (
            <p className="text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-800">
              Only one group is big enough to read, so there is nothing to compare it with yet.
            </p>
          )}
          {footnote && <p className="text-[11px] text-zinc-600 leading-relaxed pt-2">{footnote}</p>}
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
    const cell = (n: number, tone: string) => (
      <span className={`text-sm tabular-nums text-right ${n > 0 ? tone : "text-zinc-700"}`}>{n > 0 ? n : "·"}</span>
    );
    return (
      <Link
        key={r.company}
        href={`/applications?tab=${tab}&company=${encodeURIComponent(r.company)}`}
        className={`grid ${cols} items-center gap-2 px-2 py-1.5 -mx-2 rounded-md hover:bg-zinc-800/60 transition-colors duration-150`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <CompanyLogo company={r.company} jobUrl={r.jobUrl} domain={r.domain} logo={r.logo} size={22} />
          <span className="text-sm text-zinc-200 truncate">{r.company}</span>
          {/* No badge for untracked companies here. TierBadge's dashed "·" box is
              meant for the queue, where untracked is a signal; in this table a
              column of empty boxes read as missing logos. */}
          {r.tier !== null && <TierBadge tier={r.tier} />}
          {r.contacts > 0 && (
            <span
              className="text-[11px] text-accent-blue shrink-0"
              title={`You know ${r.contacts} ${r.contacts === 1 ? "person" : "people"} here`}
            >
              {r.contacts} known
            </span>
          )}
        </span>
        {cell(r.pipeline, "text-accent-pink font-semibold")}
        {cell(r.queue, "text-zinc-200")}
        {cell(r.passed, "text-zinc-500")}
        {anyClosed && cell(r.closed, "text-zinc-500")}
      </Link>
    );
  };

  return (
    <Card>
      <CardTitle note="Every company with a role in the queue, the pipeline, or passed on. Click through to its roles.">
        Roles by company
      </CardTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No roles yet. The queue fills from the daily scan.</p>
      ) : (
        <div>
          <div className={`grid ${cols} gap-2 pb-2 mb-1 border-b border-zinc-800 text-[11px] text-zinc-500 uppercase tracking-wider`}>
            <span>Company</span>
            <span className="text-right">Pipeline</span>
            <span className="text-right">Queue</span>
            <span className="text-right">Passed</span>
            {anyClosed && <span className="text-right">Closed</span>}
          </div>
          {head.map(row)}
          {/* <details> rather than state, so the page stays a server component. */}
          {tail.length > 0 && (
            <details className="group/more">
              <summary className="cursor-pointer list-none text-xs text-zinc-500 hover:text-zinc-300 pt-2">
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
    <section className="space-y-5">
      <SectionHeading tone="blue">Network</SectionHeading>

      {/* Everyone you know and how they connect through mutuals, at the top of the
          column because it is the one picture of the whole network. It may move to
          Home once there are enough people for it to carry that page. */}
      <NetworkGraph />

      <Card className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-zinc-400">People in conversation</p>
          <p className={`text-4xl font-bold mt-1 tabular-nums ${net.inConversation > 0 ? "text-accent-blue" : "text-zinc-700"}`}>
            {net.inConversation}
          </p>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            {net.total === 0
              ? "No one in your network yet."
              : `Of ${net.total} ${net.total === 1 ? "person" : "people"} in your network: replied, booked, or talked.`}
          </p>
        </div>

        {/* Follow-ups due. The one list on the page that is an action, so it names
            names and links straight to each person. */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Follow-ups due</p>
          {net.due.length === 0 ? (
            <p className="text-xs text-zinc-500 leading-relaxed">
              None. A conversation shows here after {net.nudgeAfterDays} quiet days at Connected or Replied.
            </p>
          ) : (
            <ul className="space-y-1">
              {net.due.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/networking?contact=${c.id}`}
                    className="flex items-center gap-2 text-sm rounded-md px-2 py-1 -mx-2 hover:bg-zinc-800/60 transition-colors duration-150"
                  >
                    <span className="text-zinc-200 truncate">{c.name}</span>
                    <span className="text-xs text-zinc-500 truncate">{c.company}</span>
                    <span className="ml-auto text-xs text-accent-blue tabular-nums shrink-0">{c.days}d</span>
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
          <p className="text-sm text-zinc-400">Nothing in the pipeline yet to check against.</p>
        ) : (
          <p className="text-base text-zinc-200">
            You know someone at{" "}
            <span className="font-semibold text-accent-blue tabular-nums">{net.knownPipelineCompanies.length}</span> of your{" "}
            <span className="font-semibold text-zinc-100 tabular-nums">{net.pipelineCompanies.length}</span> pipeline{" "}
            {net.pipelineCompanies.length === 1 ? "company" : "companies"}.
          </p>
        )}

        {net.pipelineCompanies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {net.knownPipelineCompanies.map((c) => (
              <Link
                key={c.company}
                href={`/networking?company=${encodeURIComponent(c.company)}`}
                className="inline-flex items-center gap-2 text-sm pl-1.5 pr-2.5 py-1 rounded-md bg-accent-blue/10 border border-accent-blue/30 text-zinc-100 hover:border-accent-blue/60 transition-colors duration-150"
              >
                <CompanyLogo company={c.company} size={18} />
                {c.company}
                <span className="text-xs text-accent-blue tabular-nums">{c.contacts}</span>
              </Link>
            ))}
            {/* ?discover= opens the Network page's find-people flow for that company. */}
            {unknownPipeline.map((c) => (
              <Link
                key={c}
                href={`/networking?discover=${encodeURIComponent(c)}`}
                title={`No one yet at ${c}. Find someone.`}
                className="inline-flex items-center gap-2 text-sm pl-1.5 pr-2.5 py-1 rounded-md border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors duration-150"
              >
                <CompanyLogo company={c} size={18} />
                {c}
                <span className="text-xs text-zinc-600">find</span>
              </Link>
            ))}
          </div>
        )}

        {net.otherKnownCompanies.length > 0 && (
          <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
            Also know people at{" "}
            {net.otherKnownCompanies.map((c, i) => (
              <span key={c.company}>
                {i > 0 && ", "}
                <Link href={`/networking?company=${encodeURIComponent(c.company)}`} className="text-zinc-300 hover:text-accent-blue">
                  {c.company}
                </Link>
                {c.contacts > 1 && <span className="text-zinc-600"> ({c.contacts})</span>}
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
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2.5rem] items-center gap-3">
          <span className={`text-sm capitalize truncate ${r.count > 0 ? "text-zinc-300" : "text-zinc-600"}`}>{r.label}</span>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${r.key === "unset" ? "bg-zinc-600" : "bg-accent-blue"}`}
              style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }}
            />
          </div>
          <span className={`text-sm tabular-nums text-right ${r.count > 0 ? "text-zinc-100 font-semibold" : "text-zinc-600"}`}>
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
        <p className="text-sm text-zinc-500">No one in your network yet.</p>
      ) : rows.length === 0 ? (
        // Honest and quiet: the absence is the finding, and a row of zero bars
        // would only dress it up.
        <p className="text-sm text-zinc-500">Nobody is tagged yet. Tags like mentor or peer are set on each person.</p>
      ) : (
        <>
          <CountBars rows={rows} total={total} />
          {untagged > 0 && (
            <p className="text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-800">
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
        <p className="text-sm text-zinc-500">No one in your network yet.</p>
      ) : unset === total ? (
        <p className="text-sm text-zinc-500">No warmth set on anyone yet. Cold, warm or close is set on each person.</p>
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
        <p className="text-sm text-zinc-500">No one in your network yet.</p>
      ) : (
        <div>
          {rows.map((r) => (
            <Link
              key={r.company}
              href={`/networking?company=${encodeURIComponent(r.company)}`}
              className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md hover:bg-zinc-800/60 transition-colors duration-150"
            >
              <CompanyLogo company={r.company} size={22} />
              <span className="text-sm text-zinc-200 truncate">{r.company}</span>
              {r.inPipeline && <span className="text-[11px] text-accent-pink shrink-0">in pipeline</span>}
              <span className="ml-auto text-sm font-semibold text-zinc-100 tabular-nums">{r.contacts}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
