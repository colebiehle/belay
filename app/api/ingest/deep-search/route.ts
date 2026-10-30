import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canonicalCompany, extractCompRange, isUsLocation, yearsRange } from "@/lib/role-filter";
import { callClaudeWithToolsDetailed, extractJson } from "@/lib/claude";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { understandingBlock } from "@/lib/foundation";
import { logJournal } from "@/lib/journal";
import { identityLine } from "@/lib/identity";
import { NOTABLE_BACKERS } from "@/lib/backers";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

// Deep search: ask Claude to use WebSearch + WebFetch to surface fresh job
// listings from across the web matching your criteria + accumulated taste.
// Replaces the brittle "scrape blocked HuntSites" approach since most useful
// boards (LinkedIn, Wellfound, YC, Handshake) are JS-rendered or block scrapers.

const SEARCH_CONTEXT_KINDS = [
  "search_target_roles",
  "search_target_problems",
  "search_target_companies",
  "search_positive_signals",
  "search_negative_signals",
  "search_hard_skips",
];

type DeepResult = {
  company: string;
  roleTitle: string;
  jobUrl: string;
  location?: string;
  compRange?: string;
  expRange?: string;
  descriptionSnippet?: string;
  why?: string;
};

export async function POST(req: NextRequest) {
  // The weekly gap check (?weekly) asks a different question: not "what is new",
  // but "what did the daily scan miss at the companies that matter most".
  const weekly = new URL(req.url).searchParams.has("weekly");
  const [criteria, understanding, existingJobs, targets] = await Promise.all([
    prisma.material.findMany({ where: { kind: { in: SEARCH_CONTEXT_KINDS } } }),
    understandingBlock(1200),
    // Don't re-recommend listings we already have.
    prisma.job.findMany({ select: { jobUrl: true, company: true, roleTitle: true }, take: 200, orderBy: { createdAt: "desc" } }),
    prisma.targetCompany.findMany({ select: { name: true }, orderBy: [{ tier: "asc" }, { position: "asc" }] }),
  ]);
  const criteriaBlock = criteria.map((m) => `[${m.kind}]\n${(m.content ?? "").slice(0, 800)}`).join("\n\n");
  const existingBlock = existingJobs.length > 0
    ? existingJobs.slice(0, weekly ? 200 : 50).map((j) => `- ${j.company}: ${j.roleTitle}`).join("\n")
    : "(none)";
  const task = weekly
    ? `Use the WebSearch tool to find currently-open product design / UX / interaction design roles posted in the LAST 30 DAYS that the list below does not already have. This is a weekly check for roles a daily scan missed, so aim at where a scan misses things:
- Each of these companies they track, in this order of priority: ${targets.map((t) => t.name).join(", ")}. Search each one's own careers site and LinkedIn for design roles.
- Startups backed by ${NOTABLE_BACKERS.join(", ")}, especially founding or first-designer roles, and companies that raised a notable round in the last six months.

Return up to 15. An empty list is a good answer if the scan missed nothing.`
    : `Use the WebSearch tool to find 5-10 currently-open product design / UX / interaction design / design research roles posted in the LAST 7 DAYS that fit their profile. Look across:
- AI-native company career pages (Anthropic, OpenAI, Cursor, Granola, etc.)
- Founding and first-designer roles at early-stage startups (YC, seed and Series A),
  titled "Founding Designer", "Founding Product Designer" or "first design hire".
  Spend at least a third of the search here: these sit at companies the user has not
  heard of yet, which is exactly what the other sources miss.
- Job boards (LinkedIn, Wellfound, YC's ycombinator.com/jobs, Greenhouse-hosted, AshbyHQ-hosted)
- Specific role aggregators if useful`;

  const who = await identityLine();
  const prompt = `You are doing a fresh deep web search for design job postings for ${who}.

their criteria:
${criteriaBlock}

${understanding ? `their accumulated taste signals (durable preferences from past decisions — apply these to filter):\n${understanding}\n` : ""}

Jobs they already have in their queue — DO NOT return duplicates:
${existingBlock}

TASK:
${task}

Search results are usually enough: you do not need to open every posting, because Belay fetches and reads each one itself afterwards. Use WebFetch only when a result does not show the company, the title or a link. Stop searching once you have your matches; the answer matters more than exhaustiveness.

Hard filters (skip these):
- PhD requirements
- Pure engineering / pure PM / pure sales / pure ops roles
- Anything the criteria above rule out. Those are the user's own words and they win
  over any general instinct about what a good role looks like.

Return ONLY a JSON array. No preamble, no markdown, no code fences. Each entry:

[
  {
    "company": "Anthropic",
    "roleTitle": "Product Designer, Claude",
    "jobUrl": "https://www.anthropic.com/jobs/...",
    "location": "San Francisco / NY",
    "compRange": "$160-220K (if disclosed)",
    "expRange": "3-5 yrs",
    "descriptionSnippet": "1-2 sentences on the role",
    "why": "1 sentence: why this matches they specifically (cite criterion or taste signal)"
  }
]

If you find fewer than 5 strong matches, return what you found — don't pad with weak fits.`;

  // Up to 9 minutes and 30 turns. At 12 turns the run hit its cap before it
  // answered, every day, and an unanswered run read as "No fresh matches found".
  const { text: raw, timedOut } = await callClaudeWithToolsDetailed(prompt, ["WebSearch", "WebFetch"], 540_000, 30);
  const parsed = extractJson<DeepResult[]>(raw, "array");
  const results = parsed ?? [];

  // The last raw answer, kept for diagnosis: the summary line says what went wrong,
  // this says why.
  await mkdir(path.join(process.cwd(), "private", "logs"), { recursive: true })
    .then(() => writeFile(path.join(process.cwd(), "private", "logs", "deep-search-last.txt"), raw.slice(0, 50_000)))
    .catch(() => {});

  if (results.length === 0) {
    // Say which kind of empty this was. "No fresh matches" is only true when the
    // search finished and answered with an empty list.
    const summary = timedOut
      ? "Deep search timed out before answering."
      : !parsed && /max turns/i.test(raw)
        ? "Deep search ran out of turns before answering."
        : !parsed
          ? "Deep search answered without a list of roles."
          : "No fresh matches found.";
    await logJournal({ type: "ai_run", surface: "ingest/deep-search", summary });
    return NextResponse.json({ ok: true, added: 0, summary, results: [] });
  }

  let added = 0;
  // No company gate here: this search is already run against your criteria by a
  // model reading the postings, which is a stricter screen than the pre-screen the
  // other company-blind arms use. A role at a company you have not heard of is the
  // point of this arm.
  const inserted: { company: string; roleTitle: string }[] = [];
  for (const r of results) {
    if (!r.company || !r.roleTitle || !r.jobUrl) continue;
    if (!isUsLocation(r.location ?? "")) continue;
    // Normalised like every other arm. An un-normalised variant skips the
    // auto-ingest guard, fails to dedupe against the board's own copy of the same
    // role, and misses that company's reapplication cooldown.
    const company = canonicalCompany(r.company);
    // Company plus title as well as URL, because this arm will otherwise re-insert
    // a role already ingested from a board under a different URL — the exact case
    // every other arm guards against.
    const existing = await prisma.job.findFirst({
      where: { OR: [{ jobUrl: r.jobUrl }, { AND: [{ company }, { roleTitle: r.roleTitle }] }] },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.job.create({
      data: {
        company,
        roleTitle: r.roleTitle,
        jobUrl: r.jobUrl,
        location: r.location ?? "",
        // The search answers these in prose when it has no figure ("Not shown; a
        // related listing on Built In shows…"). Keep the figure or nothing.
        compRange: extractCompRange(r.compRange) ?? "Not disclosed",
        expRange: yearsRange(r.expRange) ?? "",
        description: r.descriptionSnippet ?? "",
        fitScore: 0,
        fitRationale: `Surfaced via deep web search. ${r.why ?? ""}`.trim(),
        priority: "MONITOR",
      },
    });
    added += 1;
    inserted.push({ company: r.company, roleTitle: r.roleTitle });
  }

  await logJournal({
    type: "ai_run",
    surface: "ingest/deep-search",
    summary: `Deep search added ${added} fresh listings: ${inserted.slice(0, 3).map((j) => `${j.company} — ${j.roleTitle}`).join("; ")}`,
    meta: { added, returned: results.length },
  });

  return NextResponse.json({
    ok: true,
    added,
    summary: `Deep search found ${results.length} candidates, ${added} new.`,
    results: inserted,
  });
}
