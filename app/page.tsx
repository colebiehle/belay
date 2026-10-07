import { computeInsights } from "@/lib/insights";
import Link from "next/link";
import { logDate } from "@/lib/dates";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { JobSites } from "@/components/JobSites";
import { TargetCompanies } from "@/components/TargetCompanies";
import { ChatPanel } from "@/components/ChatPanel";
import { Signals } from "@/components/HomeSignals";

export default async function Home() {
  // The same function behind /insights and /api/insights, so a number here can
  // never disagree with the page it links to.
  // The signals come from computeInsights, so the Upcoming list and the counts
  // beside it agree on what is ahead.
  const insights = await computeInsights();
  const upcoming = insights.upcoming;

  return (
    <div className="space-y-8">
      {/* "Home", because the nav calls it Home: one name per thing. The date sits
          under it in the dim step where the other pages put their next-action line,
          since Home's next actions are the signal tiles below. */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-fg-1">Home</h1>
          <p className="text-body text-fg-3 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        {/* Docked here rather than floating in the corner, where it covered content.
            The sheet it opens still docks to the bottom edge. */}
        <ChatPanel
          storageKey="homeChatOpen"
          title="Ask Claude"
          subtitle="What should I focus on today?"
          fetchUrl="/api/home/chat"
          postUrl="/api/home/chat"
          emptyHint="What to do today, who is due a follow-up, how the week went."
        />
      </div>

      {/* The "Today" section is gone. It held the follow-ups panel and a
          generated action list ("Review 33 roles waiting", "Submit 1 application
          you've already greenlit") — both of which restated numbers the signals
          below already carry, and neither of which told they anything they did not
          know on opening the app. You go to the queue when you want to triage. */}
      {/* Upcoming: interviews and calls, soonest first. Always here, so the page
          does not change shape the day one is booked; with nothing ahead it is one
          dim line. The dates live here and not under the tiles' counts, where "Next:"
          named one interview of several. Log rows in one container: a fixed mono date
          column, then the time, so the dates line up down the edge. */}
      <section>
        <h2 className="t-section mb-3">Upcoming</h2>
        <div className="bg-surface rounded-card divide-y divide-line-1">
          {upcoming.length === 0 ? (
            <p className="flex items-center h-9 px-3 text-body text-fg-3">No interviews or calls scheduled</p>
          ) : (
            upcoming.map((u) => {
              const d = new Date(u.at);
              const timed = d.getHours() !== 0 || d.getMinutes() !== 0;
              return (
                <Link
                  key={`${u.href}-${u.at}`}
                  href={u.href}
                  className="flex items-center gap-3 h-9 px-3 hover:bg-lift transition-colors duration-90 ease-enter first:rounded-t-card last:rounded-b-card"
                >
                  <span className="w-14 shrink-0 font-mono text-data tabular-nums text-fg-3">{logDate(u.at)}</span>
                  <span className="w-16 shrink-0 font-mono text-data tabular-nums text-fg-3">
                    {timed ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}
                  </span>
                  <span className="text-body text-fg-1 truncate">{u.title}</span>
                  <span className="text-meta text-fg-3 truncate">{u.label}</span>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* The overview: what is on the plate, as two sections side by side,
          "Applications" and "Network", three numbers each. Every block on Home opens
          with a t-section heading (Upcoming, Applications, Network, Progress,
          Companies, Sites), all with the same 12px to their content; t-group names
          only the groups inside a section (the tiers, the site groups, Applying and
          People in the day detail). Rates and warm paths are on /insights. */}
      <Signals insights={insights} />

      {/* Its own section now the tiles above it are gone: the heatmap is a record
          of effort, not a signal, so it sits under the signals rather than in them. */}
      <ActivityHeatmap />

      {/* Where to look. The tier list is the primary discovery surface now that the
          scan only covers S and A, so it gets the wide column; the four browse
          sites are a short list and sit beside it rather than above it. */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 lg:gap-6 items-start">
        <TargetCompanies compact />
        <JobSites compact />
      </div>


      {/* "Review Matches" used to sit here, listing the top five pending roles.
          It duplicated the queue one click away, and the action list above already
          says how many are waiting. */}

    </div>
  );
}
