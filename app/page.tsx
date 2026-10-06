import { prisma } from "@/lib/prisma";
import { computeInsights } from "@/lib/insights";
import Link from "next/link";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { JobSites } from "@/components/JobSites";
import { TargetCompanies } from "@/components/TargetCompanies";
import { ChatPanel } from "@/components/ChatPanel";
import { Signals } from "@/components/HomeSignals";

export default async function Dashboard() {
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
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      {/* The "Today" section is gone. It held the follow-ups panel and a
          generated action list ("Review 33 roles waiting", "Submit 1 application
          you've already greenlit") — both of which restated numbers the signals
          below already carry, and neither of which told they anything they did not
          know on opening the app. You go to the queue when you want to triage. */}
      {/* Upcoming interviews. The only thing on this page that has a date attached,
          so it goes first — and it is the answer to "how do I track interviews",
          which nothing in the app held before. */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Coming up</h2>
          <div className="space-y-2">
            {upcoming.map((iv) => (
              <Link
                key={iv.id}
                href="/applications?tab=pipeline"
                className="flex items-center gap-3 px-3.5 py-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all duration-150"
              >
                <span className="text-sm font-semibold text-accent-pink tabular-nums shrink-0">
                  {new Date(iv.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                  {new Date(iv.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="text-sm text-zinc-200 truncate">{iv.company}</span>
                {iv.label && <span className="text-xs text-zinc-500 truncate">{iv.label}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The overview: what is on the plate, three numbers a side (queue, active
          pipeline, upcoming interviews; people, upcoming calls, follow-ups due).
          Rates and warm paths are on /insights, behind the button in its header. */}
      <Signals insights={insights} />

      {/* Its own section now the tiles above it are gone: the heatmap is a record
          of effort, not a signal, so it sits under the signals rather than in them. */}
      <ActivityHeatmap />

      {/* Where to look. The tier list is the primary discovery surface now that the
          scan only covers S and A, so it gets the wide column; the four browse
          sites are a short list and sit beside it rather than above it. */}
      <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        <TargetCompanies compact />
        <JobSites compact />
      </section>


      {/* "Review Matches" used to sit here, listing the top five pending roles.
          It duplicated the queue one click away, and the action list above already
          says how many are waiting. */}

      <ChatPanel
        storageKey="homeChatOpen"
        title="Chat with Claude"
        subtitle="What should I focus on today?"
        fetchUrl="/api/home/chat"
        postUrl="/api/home/chat"
        emptyHint="Ask Claude what to prioritize today, who needs a follow-up, how this week is going."
      />
    </div>
  );
}
