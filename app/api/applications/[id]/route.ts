import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logJournal } from "@/lib/journal";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  let statusTransition: { from: string; to: string } | null = null;

  // If status is being changed AND the client isn't explicitly replacing statusHistory,
  // append to history with a 30-min revert window.
  if (typeof body.status === "string" && body.statusHistory === undefined) {
    const existing = await prisma.application.findUnique({
      where: { id },
      select: { status: true, statusHistory: true, dateApplied: true },
    });
    if (existing && existing.status !== body.status) {
      statusTransition = { from: existing.status, to: body.status };
      const history: { status: string; at: string }[] = existing.statusHistory
        ? JSON.parse(existing.statusHistory)
        : [];
      const now = new Date();
      const REVERT_WINDOW_MS = 30 * 60 * 1000;
      const last = history[history.length - 1];
      const prev = history[history.length - 2];

      // Revert detection: A→B→A within 30 min just removes the B entry
      if (
        last &&
        prev &&
        prev.status === body.status &&
        now.getTime() - new Date(last.at).getTime() < REVERT_WINDOW_MS
      ) {
        history.pop();
        body.statusHistory = JSON.stringify(history);
        // If we just removed an "Applied" entry, clear dateApplied to match
        if (last.status === "Applied" && existing.dateApplied) {
          body.dateApplied = null;
        }
      } else {
        history.push({ status: body.status, at: now.toISOString() });
        body.statusHistory = JSON.stringify(history);
        if (body.status === "Applied" && !existing.dateApplied && !body.dateApplied) {
          body.dateApplied = now;
        }
      }
    }
  }

  let application;
  try {
    application = await prisma.application.update({
      where: { id },
      data: body,
      include: { job: true },
    });
  } catch (e) {
    // The role panel can now rewrite the job's posting URL, and Job.jobUrl is
    // unique, so pointing it at a posting another role already has is an ordinary
    // mistake rather than a crash. Say so in words the panel can show inline.
    // Matched on code and message both: the libsql adapter has not always set code.
    const err = e as { code?: string; message?: string };
    if (err.code === "P2002" || /unique constraint/i.test(err.message ?? "")) {
      return NextResponse.json({ error: "Another role already has that posting URL." }, { status: 409 });
    }
    throw e;
  }

  if (statusTransition) {
    await logJournal({
      type: "application",
      surface: `applications/status`,
      summary: `${application.job?.company ?? "(unknown company)"} — ${application.job?.roleTitle ?? "(role)"}: ${statusTransition.from} → ${statusTransition.to}`,
      refs: { applicationId: id },
    });
  }

  return NextResponse.json(application);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { reason, outcome } = await req.json().catch(() => ({ reason: "", outcome: null }));

  const app = await prisma.application.findUnique({
    where: { id },
    select: { jobId: true, job: { select: { verdictNotes: true } } },
  });

  if (!app) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Infer outcome from the reason if not given explicitly
  const r = (reason ?? "").toLowerCase();
  const inferred =
    outcome ??
    (r.includes("reject") ? "Rejected" :
     r.includes("withdr") ? "Withdrew" :
     r.includes("accept") ? "Accepted" :
     r.includes("decline") ? "Declined" :
     "Closed");

  const existing = app.job.verdictNotes ?? "";
  const note = reason ? `Archived (${inferred}): ${reason}` : `Archived (${inferred})`;
  const combined = existing ? `${existing}\n\n${note}` : note;

  await prisma.job.update({
    where: { id: app.jobId },
    data: { verdictNotes: combined },
  });

  await prisma.application.update({
    where: { id },
    data: { archivedAt: new Date(), outcome: inferred },
  });

  return NextResponse.json({ ok: true });
}
