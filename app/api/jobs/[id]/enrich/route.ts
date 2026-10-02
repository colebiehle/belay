import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractCompRange } from "@/lib/role-filter";
import { callClaude, extractJson } from "@/lib/claude";
import { understandingBlock } from "@/lib/foundation";
import { FIT_RUBRIC } from "@/lib/fit-rubric";
import { verdictSignalBlock } from "@/lib/verdict-signal";
import { logJournal } from "@/lib/journal";
import { identityLine } from "@/lib/identity";

const SEARCH_KINDS = [
  "search_target_companies",
  "search_target_roles",
  "search_target_problems",
  "search_work_environment",
  "search_skills_to_learn",
  "search_positive_signals",
  "search_negative_signals",
  "search_hard_skips",
  "positioning",
  "career_arc",
];

// Facts, not a verdict. Surface the relevant information and let the reader judge
// fit themselves. The old shape argued a case (fitReasoning, greenFlags, redFlags),
// which is exactly the judgement they are there to make. The score survives only as
// a sort key for the queue.
// Two subjects, each with its own bullets. The card used to carry two prose lines
// plus a flat `notable` array, and that array was a grab-bag: location, hours,
// AI-centrality and scope all at one level, with no way to tell which mattered.
// Splitting the bullets under the thing they describe is what makes them scannable.
// Flat, because "Team" and "Role" as headings made you read two labels before
// reading anything, and the team bullets came back as generic startup-speak that
// would fit forty postings. What survives is: one line saying what this is, a few
// bullets that decide it, and the two facts most pass notes turn on: the level they
// are actually screening for, and what the form is going to cost you.
type Enrichment = {
  headline: string;        // one short sentence: the role and the team
  tags: string[];          // up to 5, one to three words each
  levelSignals: string;    // years and seniority language, exactly as written
  comp: string;            // as stated, or "Not disclosed"
  applicationNeeds: string[]; // portfolio, cover letter, screening questions
  askingFor: string[];     // stated requirements, close to the posting's words
  refinedFitScore: number; // written to Job.fitScore, shown bottom-right on the card
};
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [criteria, understanding, verdictSignal] = await Promise.all([
    prisma.material.findMany({ where: { kind: { in: SEARCH_KINDS } } }),
    understandingBlock(1200),
    verdictSignalBlock(),
  ]);
  const criteriaBlock = criteria.map((m) => `[${m.kind}]\n${m.content ?? ""}`).join("\n\n");

  const who = await identityLine();
  const prompt = `Extract the facts from this job posting for ${who}, an AI product designer reviewing their queue.

IMPORTANT: Do NOT argue whether this is a good fit, and do NOT recommend or discourage applying. They makes that call themselves. Your job is to surface what the posting actually says, accurately and briefly, so they can decide in fifteen seconds without opening the link.

Their search criteria, for context only (use it to decide what is worth surfacing, never to render a verdict):
${criteriaBlock}

The posting:
Company: ${job.company}
Role: ${job.roleTitle}
Location: ${job.location || "(unspecified)"}
Comp: ${job.compRange || "(unspecified)"}
Experience: ${job.expRange || "(unspecified)"}
URL: ${job.jobUrl}

Description:
${(job.description || "(no description)").slice(0, 8000)}

Return ONLY valid JSON, no preamble, no code fences:

{
  "headline": "ONE short sentence, under 18 words: what the role is and which team. Nothing else.",
  "tags": ["short label", "..."],
  "askingFor": ["stated requirement, close to the posting's own words", "..."],
  "levelSignals": "Years required and any seniority language, exactly as written. If unstated, say so.",
  "comp": "The stated range, or 'Not disclosed'.",
  "applicationNeeds": ["portfolio required", "cover letter optional", "3 screening questions", "..."],
  "refinedFitScore": <integer 1-10, scored against the rubric below>
}

How to score refinedFitScore:
${FIT_RUBRIC}${verdictSignal ? `\n\n${verdictSignal}` : ""}

Rules:
- Facts only in the prose fields. No "this is a strong fit", no "they would thrive", no recommendations.
  The score is the one place a judgement belongs, and it belongs there as a number, not as advocacy.
- If the description is empty, say so plainly in whatItIs and keep the rest short rather than inventing.
- Voice: direct, no em-dashes, no marketing language.
- applicationNeeds: only what the posting states or clearly implies. Empty array if it says nothing.
- headline and tags must not overlap. The headline says what the job is and whose team it sits on, in one short sentence. The tags are the SKILLS AND SUBJECT AREAS the work needs — what they would be doing and what domain it is in.
- tags: at most 5, one to three words each and never more than 28 characters, lowercase except proper nouns. Count the characters. They read like a skills list, not like observations. Good: "ai prototyping", "design systems", "creativity tools", "brand design", "interaction design", "0-to-1", "user research", "data viz", "developer tools", "growth", "trust and safety", "motion". Bad: anything that reads as a sentence or a judgement — "AI is the product", "no AI mentioned", "scope unstated", "8+ yrs required" all belong nowhere near the tag row, because they are commentary rather than the substance of the work.
- Take tags from what the posting actually asks the designer to do. If it names a domain (health, payments, creator tools, enterprise), that is a tag. If it names a craft (prototyping, systems, research, visual), that is a tag.
- Give 3 if the posting only supports 3, and never invent a skill it does not mention. An empty array beats padding.
- Years and seniority belong in levelSignals, application requirements in applicationNeeds. Neither is a tag.
- Location, hours and comp are already columns on the card. Never spend a bullet on them.
- levelSignals: the years figure and seniority wording exactly as the posting states it, in under 15 words. If it states nothing, say "Not stated." This is load-bearing — they are calibrated at one specific level and a mismatch is the single most common reason they passes.`;

  const raw = await callClaude(prompt, 90_000);
  const parsed = extractJson<Enrichment>(raw, "object");
  if (!parsed) {
    return NextResponse.json({ error: "could not parse enrichment", raw: raw.slice(0, 500) }, { status: 500 });
  }

  const enrichment = {
    ...parsed,
    enrichedAt: new Date().toISOString(),
  };

  // The queue card reads fitRationale/greenFlags/redFlags, not queueEnrichment, so
  // writing only the JSON blob left every scored job showing "Surfaced from X via
  // ashby API" and no flags. Write both: the columns drive the card, the blob keeps
  // the full analysis (snapshot, design signal, questions) for the detail view.
  const flagLines = (xs: unknown): string =>
    Array.isArray(xs) ? xs.map((x) => String(x).trim()).filter(Boolean).join("\n") : "";

  // fitRationale is the card's fallback when queueEnrichment is missing. greenFlags and redFlags are written for
  // requirements and application mechanics rather than a case for applying.
  const rationale = (parsed.headline ?? "").trim();

  await prisma.job.update({
    where: { id },
    data: {
      queueEnrichment: JSON.stringify(enrichment),
      enrichedAt: new Date(),
      ...(rationale ? { fitRationale: rationale } : {}),
      greenFlags: flagLines(parsed.askingFor),
      // applicationNeeds is what the form will demand (portfolio, screening
      // questions, work auth) — mechanics, not risk. It lives in redFlags only
      // because that column already existed; the Applying checklist reads the
      // same values back out. Nothing in the UI labels this "red".
      redFlags: flagLines(parsed.applicationNeeds),
      ...(typeof parsed.refinedFitScore === "number" ? { fitScore: parsed.refinedFitScore } : {}),
      // The extractor has always pulled comp; it was written into the JSON blob
      // and then dropped, so every card read "Not disclosed" even when the
      // posting stated a range. Only take it when it actually contains figures —
      // the model often answers in prose ("Not disclosed. The posting includes
      // a pay transparency block…"), which is not a salary.
      ...(() => {
        const range = extractCompRange(parsed.comp);
        return range ? { compRange: range } : {};
      })(),
    },
  });

  await logJournal({
    type: "ai_run",
    surface: "jobs/enrich",
    summary: `Extracted ${job.company} — ${job.roleTitle} (sort score ${parsed.refinedFitScore}/10)`,
    meta: { jobId: id, score: parsed.refinedFitScore },
  });

  return NextResponse.json({ enrichment });
}
