import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 5, 25);
  const onlyPending = body.onlyPending !== false;

  const jobs = await prisma.job.findMany({
    where: {
      enrichedAt: null,
      ...(onlyPending ? { verdict: null } : {}),
    },
    orderBy: { dateFound: "desc" },
    take: limit,
    select: { id: true, company: true, roleTitle: true },
  });

  const origin = new URL(req.url).origin;
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const job of jobs) {
    try {
      const r = await fetch(`${origin}/api/jobs/${job.id}/enrich`, { method: "POST" });
      const ok = r.ok;
      results.push({ id: job.id, ok, ...(ok ? {} : { error: `status ${r.status}` }) });
    } catch (e) {
      results.push({ id: job.id, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
