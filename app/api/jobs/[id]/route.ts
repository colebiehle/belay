import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { verdict, verdictNotes, ...rest } = body;

  // Stamp verdictAt when a verdict transitions from null -> set
  let verdictAtPatch: { verdictAt?: Date } = {};
  if (verdict !== undefined) {
    const existing = await prisma.job.findUnique({ where: { id }, select: { verdict: true, verdictAt: true } });
    if (existing && !existing.verdict && verdict) {
      verdictAtPatch = { verdictAt: new Date() };
    }
  }

  const job = await prisma.job.update({
    where: { id },
    data: {
      ...(verdict !== undefined && { verdict }),
      ...(verdictNotes !== undefined && { verdictNotes }),
      ...verdictAtPatch,
      ...rest,
    },
  });

  // Undo from the queue clears the verdict, so the application it created has to
  // go with it. Guarded to rows that never left "Applying": once something has
  // actually been sent, an undo must not destroy the record of it.
  if (verdict === null) {
    await prisma.application.deleteMany({
      where: { jobId: id, status: "Applying", dateApplied: null },
    });
  }

  let applicationId: string | null = null;
  if (verdict === "Apply") {
    const initialHistory = JSON.stringify([{ status: "Applying", at: new Date().toISOString() }]);
    // Clearing archivedAt matters: a role whose application was archived (say,
    // during a history reset) keeps its Application row, so this upsert takes
    // the update branch. With an empty update the row stayed archived, and
    // re-accepting the role would appear to work while the application stayed
    // invisible in Applying and absent from every count.
    const application = await prisma.application.upsert({
      where: { jobId: id },
      update: { archivedAt: null, outcome: null },
      create: { jobId: id, status: "Applying", statusHistory: initialHistory },
    });
    applicationId = application.id;
  }

  return NextResponse.json({ ...job, applicationId });
}
