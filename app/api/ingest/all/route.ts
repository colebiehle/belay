import { NextRequest, NextResponse } from "next/server";
import { logJournal } from "@/lib/journal";

export const dynamic = "force-dynamic";
export const maxDuration = 1800;

/**
 * Orchestrates a broad ingest pass:
 *   1. Career pages + job sites (feeds first, HTML scrape otherwise)
 *   2. Deep web search (Claude WebSearch tool — catches JS-rendered boards
 *      and surfaces fresh listings that don't appear on tracked sources)
 *   3. LinkedIn title search
 *   4. VC portfolio boards
 *
 * Results combined into a single summary.
 */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const results: Record<string, unknown> = {};
  // The weekly gap check (scripts/daily-ingest.sh --weekly): the company-blind arms
  // read further back and deeper, and the web search aims at your companies and
  // well-backed startups. Every role it adds is one the daily scan missed.
  const weekly = new URL(req.url).searchParams.has("weekly");
  const wk = weekly ? "?weekly=1" : "";

  // Forwarded to the career-pages arm. Every tracked company by default: the
  // daily run and the button used to differ here (S and A only versus all), so
  // the same words meant two different scans. Pass a number to narrow. The other
  // four arms are company-blind and have no tier to scope by.
  let maxTier: number | "all" = "all";
  try {
    const body = await req.json();
    if (typeof body?.maxTier === "number") maxTier = body.maxTier;
  } catch {
    // bare POST, as the daily run sends: keep the default
  }
  const careerPagesInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxTier }),
  };

  // Run them in parallel — they hit independent paths and Claude can handle it.
  // The Gmail arm (LinkedIn alert emails, /api/ingest) is no longer run: its sign-in
  // lapsed most of Oct 2026, and when it worked it found 0-1 roles a day that the
  // LinkedIn search had not (the owner's call, Oct 2026). The route remains.
  const [careerRes, deepRes, linkedinRes, getroRes] = await Promise.allSettled([
    fetch(`${origin}/api/ingest/career-pages`, careerPagesInit).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
    fetch(`${origin}/api/ingest/deep-search${wk}`, { method: "POST" }).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
    // Searches LinkedIn by title across every employer, not just tracked
    // companies. This is the only arm that surfaces roles at companies not on
    // the target list, and unlike the alert emails it returns the full posting.
    fetch(`${origin}/api/ingest/linkedin${wk}`, { method: "POST" }).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
    // VC portfolio boards. The only arm that finds well-funded companies before
    // they are famous, and the only one that reliably carries a salary band.
    fetch(`${origin}/api/ingest/getro${wk}`, { method: "POST" }).then(async (r) => ({
      ok: r.ok,
      data: await r.json(),
    })),
  ]);

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

  // Score whatever just landed, all of it. The rubric pass existed but nothing
  // called it, so every ingested role was written with fitScore 0 and sank to the
  // bottom of a score-sorted queue. It then scored only the first 12, which left
  // the rest of a large run blank. Enrichment fetches any missing description
  // before scoring.
  let scored = 0;
  try {
    const r = await fetch(`${origin}/api/jobs/enrich-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 200 }),
    });
    if (r.ok) scored = (await r.json())?.processed ?? 0;
  } catch {
    // Scoring is best-effort: a failure here shouldn't lose the ingested rows.
  }
  results.enrich = { scored };
  if (scored) parts.push(`Scored: ${scored}`);

  if (weekly) {
    const added = [results.careerPages, results.deepSearch, results.linkedin, results.getro]
      .map((r) => Number((r as { added?: number })?.added ?? 0))
      .reduce((a, b) => a + b, 0);
    parts.unshift(
      added === 0
        ? "Weekly gap check: the daily scan missed nothing"
        : `Weekly gap check: ${added} role${added === 1 ? "" : "s"} the daily scan missed`,
    );
    await logJournal({ type: "ai_run", surface: "ingest/weekly", summary: parts[0], meta: { added } });
  }

  return NextResponse.json({
    ok: true,
    summary: parts.join(" · ") || "Scan done.",
    results,
  });
}
