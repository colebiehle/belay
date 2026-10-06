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
 * Each number links to where the thing lives, and the dated ones name the next one
 * under the count, because "1 upcoming interview" is not useful until you know when.
 *
 * A server component: no state, and the numbers are read on the server with the
 * rest of the page.
 */
export function Signals({ insights }: { insights: Insights }) {
  const { applications: apps, network: net } = insights;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Overview</h2>
        {/* A button, not a quiet text link: Insights has no nav tab, so this is the
            way in and it has to be findable without hunting. Neutral, because
            Insights reads across both halves and takes neither accent. */}
        <Link
          href="/insights"
          className="text-sm font-medium px-3 py-1.5 border border-zinc-700 text-zinc-300 rounded-md hover:border-zinc-500 hover:text-zinc-100 transition-all duration-150"
        >
          Insights →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ApplicationsCard apps={apps} />
        <NetworkCard net={net} />
      </div>
    </section>
  );
}

function CardHeading({ tone, children }: { tone: "pink" | "blue"; children: ReactNode }) {
  // Same dot-and-label heading as /insights, so the two halves read as the same two
  // halves on both pages.
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
      <span className={`w-1.5 h-1.5 rounded-full ${tone === "pink" ? "bg-accent-pink" : "bg-accent-blue"}`} />
      {children}
    </h3>
  );
}

function Stat({
  label,
  value,
  note,
  href,
  dim,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  dim: boolean;
  tone: "pink" | "blue";
}) {
  // 3xl, the size the old tiles used. One size for every number here: none of them
  // is the headline, and a single big one would make the others look like footnotes.
  const body = (
    <>
      <p className="text-sm text-zinc-400">{label}</p>
      <p
        className={`text-3xl font-bold mt-1 tabular-nums ${
          dim ? "text-zinc-600" : tone === "pink" ? "text-accent-pink" : "text-accent-blue"
        }`}
      >
        {value}
      </p>
      {note && <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{note}</p>}
    </>
  );
  // A linked stat lights up like the rows on /insights. The negative margin keeps the
  // number on the card's text edge while giving the hover a little room.
  return href ? (
    <Link href={href} className="block -m-2 p-2 rounded-md hover:bg-zinc-800/60 transition-colors duration-150">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

/** "Tue, Oct 7, 2:00 PM": the day matters most, the time second. */
function when(at: string): string {
  const d = new Date(at);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  // Date-only entries (midnight) carry no time worth printing.
  if (d.getHours() === 0 && d.getMinutes() === 0) return day;
  return `${day}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function ApplicationsCard({ apps }: { apps: Insights["applications"] }) {
  const next = apps.nextInterview;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <CardHeading tone="pink">Applications</CardHeading>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Stat label="In the queue" value={apps.queued} href="/applications" dim={apps.queued === 0} tone="pink" />
        <Stat
          label="Active pipeline"
          value={apps.activePipeline}
          href="/applications?tab=pipeline"
          dim={apps.activePipeline === 0}
          tone="pink"
        />
        <Stat
          label="Upcoming interviews"
          value={apps.upcomingInterviews}
          href={next ? `/applications?app=${next.appId}` : undefined}
          dim={apps.upcomingInterviews === 0}
          tone="pink"
          // The one note worth its line: a dated count is not useful until you know
          // when. Empty states say nothing; the dimmed zero already says it.
          note={next && <NextLine name={next.company} at={next.at} />}
        />
      </div>
    </div>
  );
}

function NetworkCard({ net }: { net: Insights["network"] }) {
  const next = net.nextCall;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <CardHeading tone="blue">Network</CardHeading>
      {/* The networking funnel, step for step with the applications card: people to
          message, people connected but not yet on a call, calls coming up. Totals and
          follow-ups live on /insights; the progress chart below already counts what
          was done, so these are only what to do next. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Stat label="To message" value={net.toMessage} href="/networking" dim={net.toMessage === 0} tone="blue" />
        <Stat label="To schedule" value={net.toSchedule} href="/networking" dim={net.toSchedule === 0} tone="blue" />
        <Stat
          label="Upcoming calls"
          value={net.upcomingCalls}
          href={next ? `/networking?contact=${next.contactId}` : undefined}
          dim={net.upcomingCalls === 0}
          tone="blue"
          note={next && <NextLine name={next.name} at={next.at} />}
        />
      </div>
    </div>
  );
}

function NextLine({ name, at }: { name: string; at: string }) {
  return (
    <>
      Next: <span className="text-zinc-300">{name}</span>, {when(at)}
    </>
  );
}
