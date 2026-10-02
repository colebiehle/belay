import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTierMap, tierFor } from "@/lib/company-tier";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");

  const where =
    filter === "pending" ? { verdict: null }
    : filter === "passed" ? { verdict: "Pass" }
    : {};

  const [jobs, tierMap] = await Promise.all([
    prisma.job.findMany({
      where,
      include: { application: true },
      orderBy: filter === "passed" ? { verdictAt: "desc" } : { dateFound: "desc" },
    }),
    buildTierMap(),
  ]);

  // Derived per request rather than stored on Job: the tier belongs to the
  // company and changes by hand, so a copy on the role would go stale the next
  // time the list is re-tiered — which has happened four times this week.
  return NextResponse.json(
    jobs.map((j) => ({ ...j, companyTier: tierFor(j.company, tierMap) })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const job = await prisma.job.create({
    data: {
      company: body.company ?? "",
      roleTitle: body.roleTitle ?? "",
      jobUrl: body.jobUrl,
      description: body.description ?? "",
      location: body.location ?? "",
      compRange: body.compRange ?? "Not disclosed",
      expRange: body.expRange ?? "",
      fitScore: body.fitScore ?? 0,
      fitRationale: body.fitRationale ?? "",
      greenFlags: body.greenFlags ?? "",
      redFlags: body.redFlags ?? "",
      priority: body.priority ?? "MONITOR",
      verdict: body.verdict ?? null,
    },
    include: { application: true },
  });

  if (body.verdict === "Apply") {
    await prisma.application.upsert({
      where: { jobId: job.id },
      update: {},
      create: { jobId: job.id, status: "Applying" },
    });
  }

  return NextResponse.json(job, { status: 201 });
}
