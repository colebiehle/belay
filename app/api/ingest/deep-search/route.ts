import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTierMap, isTrackedEmployer } from "@/lib/company-tier";
import { canonicalCompany } from "@/lib/role-filter";
import { callClaudeWithTools, extractJson } from "@/lib/claude";
import { understandingBlock } from "@/lib/foundation";
import { logJournal } from "@/lib/journal";
import { identityLine } from "@/lib/identity";

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

export async function POST() {
  const [criteria, understanding, existingJobs] = await Promise.all([
    prisma.material.findMany({ where: { kind: { in: SEARCH_CONTEXT_KINDS } } }),
    understandingBlock(1200),
    // Don't re-recommend listings we already have.
    prisma.job.findMany({ select: { jobUrl: true, company: true, roleTitle: true }, take: 200, orderBy: { createdAt: "desc" } }),
  ]);
  const criteriaBlock = criteria.map((m) => `[${m.kind}]\n${(m.content ?? "").slice(0, 800)}`).join("\n\n");
  const existingBlock = existingJobs.length > 0
    ? existingJobs.slice(0, 50).map((j) => `- ${j.company}: ${j.roleTitle}`).join("\n")
    : "(none)";

  const who = await identityLine();
  const prompt = `You are doing a fresh deep web search for design job postings for ${who}.

their criteria:
${criteriaBlock}

${understanding ? `their accumulated taste signals (durable preferences from past decisions — apply these to filter):\n${understanding}\n` : ""}

Jobs they already have in their queue — DO NOT return duplicates:
${existingBlock}

TASK:
Use the WebSearch tool to find 5-10 currently-open product design / UX / interaction design / design research roles posted in the LAST 14 DAYS that fit their profile. Look across:
- AI-native company career pages (Anthropic, OpenAI, Cursor, Granola, etc.)
- Job boards (LinkedIn, Wellfound, Built In, Greenhouse-hosted, AshbyHQ-hosted)
- Specific role aggregators if useful

Use WebFetch to verify the role is real and current if you're uncertain.

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

  // 4 minutes for the search + extraction. WebSearch + multiple WebFetches take time.
  const raw = await callClaudeWithTools(prompt, ["WebSearch", "WebFetch"], 480_000, 12);
  const results = extractJson<DeepResult[]>(raw, "array") ?? [];

  if (results.length === 0) {
    await logJournal({
      type: "ai_run",
      surface: "ingest/deep-search",
      summary: "Deep search returned no results.",
    });
    return NextResponse.json({ ok: true, added: 0, summary: "No fresh matches found.", results: [] });
  }

  let added = 0;
  // Company-blind, like the LinkedIn and portfolio-board arms, so it takes the
  // same target-list gate. See isTrackedEmployer.
  const tierMap = await buildTierMap();
  let untracked = 0;
  const inserted: { company: string; roleTitle: string }[] = [];
  for (const r of results) {
    if (!r.company || !r.roleTitle || !r.jobUrl) continue;
    if (!isTrackedEmployer(canonicalCompany(r.company), tierMap)) { untracked += 1; continue; }
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
        compRange: r.compRange ?? "Not disclosed",
        expRange: r.expRange ?? "",
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
    summary: `Deep search found ${results.length} candidates, ${untracked} skipped as untracked employers, ${added} new.`,
    results: inserted,
  });
}
