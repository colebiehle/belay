import { prisma } from "@/lib/prisma";
import { computeInsights } from "@/lib/insights";
import Link from "next/link";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { JobSites } from "@/components/JobSites";
import { TargetCompanies } from "@/components/TargetCompanies";
import { ChatPanel } from "@/components/ChatPanel";
import { Signals } from "@/components/HomeSignals";

export default async function Home() {
  // The signals come from computeInsights, the same function behind /insights and
  // /api/insights, so a number here can never disagree with the page it links to.
  const [insights, withInterviews] = await Promise.all([
    computeInsights(),
    prisma.application.findMany({
      where: { interviewList: { not: null }, archivedAt: null },
      select: { interviewList: true, job: { select: { company: true } } },
    }),
  ]);

  // Every scheduled interview still in the future, soonest first. Flattened out of
  // each application's interviewList, which is where they are actually recorded.
  const upcoming = withInterviews
    .flatMap((a) => {
      let list: { id: string; label: string; at: string }[] = [];
      try {
        const v = JSON.parse(a.interviewList ?? "[]");
        if (Array.isArray(v)) list = v;
      } catch {
        // malformed JSON on one row should not take down the dashboard
      }
      return list.map((iv) => ({ ...iv, company: a.job.company }));
    })
    .filter((iv) => iv.at && new Date(iv.at).getTime() > Date.now())
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, 5);

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
      {/* Upcoming interviews. The only thing on this page that has a date attached,
          so it goes first — and it is the answer to "how do I track interviews",
          which nothing in the app held before. */}
      {/* Log rows in one container rather than a card each: a fixed mono date
          column, then the time, so the dates line up down the edge and the eye reads
          the column rather than hunting each row. The date was pink; it is a date,
          not an action, so it takes the same dim mono as every other log column. */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="t-section mb-3">Coming up</h2>
          <div className="bg-surface rounded-card divide-y divide-line-1">
            {upcoming.map((iv) => (
              <Link
                key={iv.id}
                href="/applications?tab=pipeline&stage=Interviewing"
                className="flex items-center gap-3 h-9 px-3 hover:bg-lift transition-colors duration-90 ease-enter first:rounded-t-card last:rounded-b-card"
              >
                <span className="w-14 shrink-0 font-mono text-data tabular-nums text-fg-3">
                  {new Date(iv.at).toLocaleDateString(undefined, { month: "short", day: "2-digit" })}
                </span>
                <span className="w-16 shrink-0 font-mono text-data tabular-nums text-fg-3">
                  {new Date(iv.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="text-body text-fg-1 truncate">{iv.company}</span>
                {iv.label && <span className="text-meta text-fg-3 truncate">{iv.label}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The overview: what is on the plate, as two sections side by side,
          "Applications" and "Network", three numbers each. Every block on Home opens
          with a t-section heading (Coming up, Applications, Network, Progress,
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
