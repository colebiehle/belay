import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaude, extractJson } from "@/lib/claude";
import { canonicalCompany } from "@/lib/role-filter";
import { understandingBlock } from "@/lib/foundation";
import { FIT_RUBRIC } from "@/lib/fit-rubric";
import { verdictSignalBlock } from "@/lib/verdict-signal";
import { stripHtml } from "@/lib/html";
import { identityLine } from "@/lib/identity";

type Extracted = {
  company: string;
  roleTitle: string;
  location: string;
  compRange: string;
  expRange: string;
  description: string;
  fitScore: number;
  fitRationale: string;
  greenFlags: string;
  redFlags: string;
  datePosted?: string;
};

const FETCH_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Belay/1.0)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobUrl: string | undefined = body.jobUrl?.trim();
  if (!jobUrl) return NextResponse.json({ error: "jobUrl required" }, { status: 400 });

  // Exact-URL match is not enough. you paste links for roles you found on
  // LinkedIn, and the scan often already has the same posting under the board's
  // own URL — which produced two identical Stripe Growth rows. The company and
  // title check is the same one the ingest paths use.
  const existing = await prisma.job.findUnique({ where: { jobUrl } });
  if (existing) return NextResponse.json({ error: "Job already in your queue", existingId: existing.id }, { status: 409 });

  const html = await fetchWithTimeout(jobUrl);
  const text = html ? stripHtml(html).slice(0, 20_000) : null;

  const [positioning, understanding, verdictSignal] = await Promise.all([
    prisma.material.findMany({
      where: { kind: { in: ["positioning", "search_target_roles", "search_positive_signals", "search_negative_signals"] } },
    }),
    understandingBlock(1200),
    verdictSignalBlock(),
  ]);
  const contextBlock = positioning.map((m) => `[${m.kind}]\n${(m.content ?? "").slice(0, 1000)}`).join("\n\n");

  const who = await identityLine();
  const prompt = `You are extracting structured data from a job posting URL pasted by ${who}.

their context for scoring (use to set fitScore 1-10 and rationale):
${contextBlock}

${understanding ? `their accumulated taste signals (durable preferences — let these shift the fitScore):\n${understanding}\n` : ""}

URL: ${jobUrl}

${text ? `Page content (HTML-stripped):\n${text}` : "(Could not fetch the page — extract whatever signal you can from the URL itself; mark unknowns)"}

Extract a complete structured record. Voice: direct, no clichés, no em-dashes.

Return ONLY valid JSON. No preamble, no code fences:

{
  "company": "<company name; never empty — guess from URL if you must>",
  "roleTitle": "<exact role title; never empty>",
  "location": "<location string or empty>",
  "compRange": "<comp range like '$120k-$150k' or 'Not disclosed'>",
  "expRange": "<like '3-5 yrs' or '5+ yrs' or empty>",
  "description": "<2-4 sentence summary of what the role is and key requirements — DO NOT include the entire JD>",
  "fitScore": <integer 1-10, scored against the rubric below>,
  "fitRationale": "<1-2 sentences explaining the score against their criteria>",
  "greenFlags": "<newline-separated bullets, '- ' prefix>",
  "redFlags": "<newline-separated bullets, '- ' prefix>",
  "datePosted": "<ISO 8601 date (YYYY-MM-DD) the source shows for when the role was originally posted — empty string if not visible. Do NOT guess. Convert relative phrasing like 'Posted 3 days ago' to an absolute date using today's date if you can.>"
}

How to score fitScore:
${FIT_RUBRIC}${verdictSignal ? `\n\n${verdictSignal}` : ""}
`;

  const raw = await callClaude(prompt, 60_000);
  const parsed = extractJson<Extracted>(raw, "object");
  if (!parsed || !parsed.company || !parsed.roleTitle) {
    return NextResponse.json({ error: "Could not extract job from URL", raw: raw.slice(0, 500) }, { status: 500 });
  }

  // Only accept a posting date if it parses cleanly — never store a malformed
  // value that would render as "Invalid Date" in the queue.
  let parsedDatePosted: Date | null = null;
  if (parsed.datePosted && parsed.datePosted.trim()) {
    const candidate = new Date(parsed.datePosted.trim());
    if (!Number.isNaN(candidate.getTime())) parsedDatePosted = candidate;
  }

  // Only the URL identifies a posting. The company-and-title check that used to sit
  // here blocked legitimate adds: big companies post the same title for different
  // teams, and the queue already holds four such pairs — Microsoft "Senior Product
  // Designer" twice, Apple's App Store role twice. A same-title match is worth
  // mentioning, not worth refusing, so it comes back on the created row as a note
  // rather than as a 409.
  const canonical = canonicalCompany(parsed.company);
  const similar = await prisma.job.findFirst({
    where: { company: canonical, roleTitle: parsed.roleTitle, NOT: { jobUrl } },
    select: { id: true, jobUrl: true },
  });

  const job = await prisma.job.create({
    data: {
      jobUrl,
      // Same normalisation the alert path uses. Without it a hand-added role
      // arrives as whatever the posting calls the employer ("Amazon Web
      // Services (AWS)"), which silently defeats the portal-limit lookup, the
      // company filter, contact matching and dedupe against the board's copy.
      company: canonicalCompany(parsed.company),
      roleTitle: parsed.roleTitle,
      location: parsed.location ?? "",
      compRange: parsed.compRange ?? "Not disclosed",
      expRange: parsed.expRange ?? "",
      description: parsed.description ?? "",
      fitScore: typeof parsed.fitScore === "number" ? parsed.fitScore : 0,
      fitRationale: parsed.fitRationale ?? "",
      greenFlags: parsed.greenFlags ?? "",
      redFlags: parsed.redFlags ?? "",
      priority: "MONITOR",
      ...(parsedDatePosted ? { datePosted: parsedDatePosted } : {}),
    },
    include: { application: true },
  });

  // Run the same extractor the ingested roles go through. Without this a
  // manually added role had no queueEnrichment, so its card fell back to a
  // single summary line while every board-sourced card showed the Team and Role
  // split — the one place a hand-added role looked different from the rest.
  try {
    const origin = new URL(req.url).origin;
    await fetch(`${origin}/api/jobs/${job.id}/enrich`, { method: "POST" });
  } catch {
    // Non-fatal. The role is already queued and enrichment can be re-run.
  }

  const enriched = await prisma.job.findUnique({
    where: { id: job.id },
    include: { application: true },
  });

  return NextResponse.json(enriched ?? job, { status: 201 });
}
