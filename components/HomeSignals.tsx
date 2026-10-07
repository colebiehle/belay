import Link from "next/link";
import type { ReactNode } from "react";
import type { Insights } from "@/lib/insights";

/**
 * Home's top-down view: what is on the plate, as three numbers a side.
 *
 * Everything here comes from computeInsights, so it cannot drift from /insights.
 * Each side is a funnel of next actions: roles to decide on, applications in motion,
 * interviews coming up; people to message, people to get on a call, calls coming up. Rates
 * (response rate, warm paths) were here and moved to /insights: a rate is something
 * to read now and then, and on Home it sat beside the to-do counts looking like one.
 *
 * Each number links to where the thing lives. The dates are in Upcoming above, not
 * under the counts: "Next: one company" under a 2 read as if it were the only one.
 *
 * A server component: no state, and the numbers are read on the server with the
 * rest of the page.
 */
export function Signals({ insights }: { insights: Insights }) {
  const { applications: apps, network: net } = insights;

  // Two sections side by side, each with its own section heading, like Companies
  // and Sites further down. They were headed in small uppercase (a column-header
  // label), which put the two blocks a step below "Progress", "Companies" and
  // "Sites" although they are peers of them: every block on Home now opens with a
  // t-section heading, and t-group is kept for groups inside a section.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-6">
      <ApplicationsCard apps={apps} />
      <NetworkCard net={net} />
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="t-section mb-3">{children}</h2>;
}

function Stat({
  label,
  value,
  href,
  dim,
}: {
  label: string;
  value: ReactNode;
  href?: string;
  dim: boolean;
}) {
  // A tile: its name in sentence case meta, then the number at stat size. The name
  // was an uppercase label too, which put it on the same step as the "Applications"
  // label above it. One size for every number: none of them is the headline. The
  // number is chalk, not a section hue; a zero drops to the dim step so the eye
  // skips it. Every tile is chalk, the queue included: the rope count of undecided
  // work lives on the Queue tab only (STYLE_GUIDE 5.3). A rope number on Home beside
  // five chalk ones read as an alarm, not as "your next move".
  const body = (
    <>
      <p className="text-meta text-fg-3">{label}</p>
      {/* mt-auto: on a phone a long name wraps to two lines, and the numbers in a
          row of three should still line up. */}
      <p
        className={`text-stat t-chip tabular-nums mt-auto pt-1 ${dim ? "text-fg-3" : "text-fg-1"}`}
      >
        {value}
      </p>
    </>
  );
  // The whole tile links, so the hit target is the tile and the hover is the fill
  // stepping up to lift, the same as every other tile (STYLE_GUIDE 4.3). No border,
  // no rope, no glow. A zero is not a link: there is nothing behind it to go and look at, and a
  // tile that lifts on hover promises there is.
  const tile = "flex flex-col h-full bg-surface rounded-card p-3";
  return href && !dim ? (
    <Link href={href} className={`${tile} hover:bg-lift transition-colors duration-90 ease-enter`}>
      {body}
    </Link>
  ) : (
    <div className={tile}>{body}</div>
  );
}


// The two halves are sections, not cards: the tiles are the cards now, and a card of
// cards is one hairline too many.
function ApplicationsCard({ apps }: { apps: Insights["applications"] }) {
  return (
    <section>
      <SectionHeading>Roles</SectionHeading>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="In the queue" value={apps.queued} href="/applications" dim={apps.queued === 0} />
        <Stat
          label="Active"
          value={apps.activePipeline}
          href="/applications?tab=pipeline"
          dim={apps.activePipeline === 0}
        />
        <Stat
          label="Upcoming interviews"
          value={apps.upcomingInterviews}
          // The pipeline, parked on the interviewing stage, so you see every
          // interview in context rather than one role's panel.
          href="/applications?tab=pipeline&stage=Interviewing"
          dim={apps.upcomingInterviews === 0}
        />
      </div>
    </section>
  );
}

function NetworkCard({ net }: { net: Insights["network"] }) {
  return (
    <section>
      <SectionHeading>People</SectionHeading>
      {/* The networking funnel, step for step with the applications card: people to
          message, people connected but not yet on a call, calls coming up. Totals and
          follow-ups live on /insights; the progress chart below already counts what
          was done, so these are only what to do next. */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="To message" value={net.toMessage} href="/networking" dim={net.toMessage === 0} />
        <Stat label="To schedule" value={net.toSchedule} href="/networking" dim={net.toSchedule === 0} />
        <Stat
          label="Upcoming calls"
          value={net.upcomingCalls}
          // The people list's Scheduled group. /networking reads ?stage= to scroll
          // there (or lands on the People tab until it does).
          href="/networking?tab=people&stage=Scheduled"
          dim={net.upcomingCalls === 0}
        />
      </div>
    </section>
  );
}
