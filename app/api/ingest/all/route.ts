import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Orchestrates a broad ingest pass:
 *   1. Gmail alerts (LinkedIn job emails)
 *   2. Career pages + job sites (HTML scrape)
 *   3. Deep web search (Claude WebSearch tool — catches JS-rendered boards
 *      and surfaces fresh listings that don't appear on tracked sources)
 *
 * Results combined into a single summary.
 */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const results: Record<string, unknown> = {};

  // Forwarded to the career-pages arm, which defaults to S and A only. The
  // other four arms are company-blind and have no tier to scope by.
  let maxTier: number | "all" | undefined;
  try {
    const body = await req.json();
    if (body?.maxTier === "all" || typeof body?.maxTier === "number") maxTier = body.maxTier;
  } catch {
    // bare POST: career-pages uses its own default
  }
  const careerPagesInit: RequestInit =
    maxTier === undefined
      ? { method: "POST" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxTier }),
        };

  // Run them in parallel — they hit independent paths and Claude can handle it.
  const [gmailRes, careerRes, deepRes, linkedinRes, getroRes] = await Promise.allSettled([
    fetch(`${origin}/api/ingest`, { method: "POST" }).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
    fetch(`${origin}/api/ingest/career-pages`, careerPagesInit).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
    fetch(`${origin}/api/ingest/deep-search`, { method: "POST" }).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
    // Searches LinkedIn by title across every employer, not just tracked
    // companies. This is the only arm that surfaces roles at companies not on
    // the target list, and unlike the alert emails it returns the full posting.
    fetch(`${origin}/api/ingest/linkedin`, { method: "POST" }).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
    // VC portfolio boards. The only arm that finds well-funded companies before
    // they are famous, and the only one that reliably carries a salary band.
    fetch(`${origin}/api/ingest/getro`, { method: "POST" }).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
  ]);

  if (gmailRes.status === "fulfilled") {
    results.gmail = { ok: gmailRes.value.ok, summary: gmailRes.value.data?.summary, error: gmailRes.value.data?.error };
  } else {
    results.gmail = { ok: false, error: String(gmailRes.reason) };
  }
  if (careerRes.status === "fulfilled") {
    results.careerPages = { ok: careerRes.value.ok, summary: careerRes.value.data?.summary, added: careerRes.value.data?.added, perCompany: careerRes.value.data?.results };
  } else {
    results.careerPages = { ok: false, error: String(careerRes.reason) };
  }
  if (deepRes.status === "fulfilled") {
    results.deepSearch = { ok: deepRes.value.ok, summary: deepRes.value.data?.summary, added: deepRes.value.data?.added, listings: deepRes.value.data?.results };
  } else {
    results.deepSearch = { ok: false, error: String(deepRes.reason) };
  }
  if (linkedinRes.status === "fulfilled") {
    results.linkedin = { ok: linkedinRes.value.ok, summary: linkedinRes.value.data?.summary, added: linkedinRes.value.data?.added, rows: linkedinRes.value.data?.rows };
  } else {
    results.linkedin = { ok: false, error: String(linkedinRes.reason) };
  }
  if (getroRes.status === "fulfilled") {
    results.getro = { ok: getroRes.value.ok, summary: getroRes.value.data?.summary, added: getroRes.value.data?.added, rows: getroRes.value.data?.rows };
  } else {
    results.getro = { ok: false, error: String(getroRes.reason) };
  }

  const parts: string[] = [];
  const g = results.gmail as { summary?: string; error?: string };
  if (g.summary) parts.push(`Gmail: ${g.summary}`);
  if (g.error) {
    // agent.py was never committed, so this arm fails on every run. Reporting it
    // as a failure trains you to ignore the whole summary line.
    parts.push(
      /ENOENT|agent\.py|No such file/i.test(g.error)
        ? "Gmail: not configured"
        : `Gmail failed: ${g.error}`,
    );
  }
  const c = results.careerPages as { summary?: string; error?: string };
  if (c.summary) parts.push(`Career pages: ${c.summary}`);
  if (c.error) parts.push(`Career pages failed: ${c.error}`);
  const d = results.deepSearch as { summary?: string; error?: string };
  if (d.summary) parts.push(`Deep search: ${d.summary}`);
  if (d.error) parts.push(`Deep search failed: ${d.error}`);
  const li = results.linkedin as { summary?: string; error?: string };
  if (li.summary) parts.push(li.summary);
  if (li.error) parts.push(`LinkedIn failed: ${li.error}`);
  const gt = results.getro as { summary?: string; error?: string };
  if (gt.summary) parts.push(gt.summary);
  if (gt.error) parts.push(`Portfolio boards failed: ${gt.error}`);

  // Score whatever just landed. The rubric pass existed but nothing called it, so
  // every ingested role was written with fitScore 0 and sank to the bottom of a
  // score-sorted queue — the reason the pipeline looked empty.
  let scored = 0;
  try {
    const r = await fetch(`${origin}/api/jobs/enrich-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 12 }),
    });
    if (r.ok) scored = (await r.json())?.processed ?? 0;
  } catch {
    // Scoring is best-effort: a failure here shouldn't lose the ingested rows.
  }
  results.enrich = { scored };
  if (scored) parts.push(`Scored: ${scored}`);

  return NextResponse.json({
    ok: true,
    summary: parts.join(" · ") || "Ingest complete.",
    results,
  });
}
