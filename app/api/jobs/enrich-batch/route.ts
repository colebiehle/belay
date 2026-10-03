import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

// Each enrichment is one Claude call of up to 90 seconds. One at a time, a
// 40-role ingest took most of an hour, which is why ingest used to score only
// the first 12 and leave the rest blank. A few in parallel keeps a full run to
// minutes without flooding the CLI.
const CONCURRENCY = 4;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 5, 200);
  const onlyPending = body.onlyPending !== false;

  const jobs = await prisma.job.findMany({
    where: {
      enrichedAt: null,
      ...(onlyPending ? { verdict: null } : {}),
    },
    orderBy: { dateFound: "desc" },
    take: limit,
    select: { id: true },
  });

  const origin = new URL(req.url).origin;
  const results: { id: string; ok: boolean; error?: string }[] = [];

  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const r = await fetch(`${origin}/api/jobs/${job.id}/enrich`, { method: "POST" });
        results.push({ id: job.id, ok: r.ok, ...(r.ok ? {} : { error: `status ${r.status}` }) });
      } catch (e) {
        results.push({ id: job.id, ok: false, error: String(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  return NextResponse.json({ processed: results.length, results });
}
