import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logJournal } from "@/lib/journal";
import { fetchLinkedInJobs, GmailAuthError } from "@/lib/gmail";
import { canonicalCompany, isDesignRole, isReachableLevel, isUsLocation } from "@/lib/role-filter";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Reads LinkedIn job-alert email and adds anything new to the queue.
//
// This used to spawn `.venv/bin/python3 agent.py --gmail`. That file was never
// committed, so the arm failed on every run and the failure was buried inside the
// combined ingest summary. The reader now lives in lib/gmail.ts.
//
// Alerts carry no job description, so rows land thin: the scoring pass fills in
// fit and flags afterwards.
export async function POST() {
  let alerts;
  try {
    // 2 days of mail covers a daily schedule with a day of slack if a run is missed.
    alerts = await fetchLinkedInJobs(2);
  } catch (e) {
    if (e instanceof GmailAuthError) {
      // Not a crash: an expected, actionable state. ok:true keeps it out of the
      // red "Failed" path in the UI, where it would read as a broken ingest.
      return NextResponse.json({ ok: true, summary: e.message, added: 0, needsReauth: true });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  if (alerts.length === 0) {
    return NextResponse.json({ ok: true, summary: "No new job-alert mail.", added: 0 });
  }

  // Companies whose board we read directly. A LinkedIn alert for one of these
  // carries strictly less than the board does: title and company but no job
  // description, which is what the scorer actually reads. Both arms run in
  // parallel at noon, so without this a thin alert row can land first and dedupe
  // would then reject the rich one. Alerts fill gaps; they never compete.
  const autoIngested = new Set(
    (await prisma.targetCompany.findMany({ select: { name: true, careersUrl: true } }))
      .filter((c) => /greenhouse|ashby|lever|amazon\.jobs|myworkdayjobs/i.test(c.careersUrl))
      .map((c) => c.name.toLowerCase()),
  );

  let added = 0;
  let flagged = 0;
  let filtered = 0;
  let skippedAuto = 0;
  const addedRows: { company: string; roleTitle: string }[] = [];

  for (const a of alerts) {
    // Same rules as the career-page scanner. Alert mail is noisy: LinkedIn pads
    // it with promoted and loosely-matched roles, and without this every new-grad
    // and staff req in the email lands in the queue.
    //
    // allowResearch is false here: alert mail carries no company tier, and the
    // research exemption only ever applied to tier-1 companies.
    if (!isDesignRole(a.roleTitle) || !isReachableLevel(a.roleTitle) || !isUsLocation(a.location)) {
      filtered += 1;
      continue;
    }

    // Normalise before anything keys on the name. LinkedIn writes "Amazon Web
    // Services (AWS)" where the board writes "Amazon", and the skip below, the
    // dedupe query and the row itself all match on an exact string — so an
    // un-normalised variant skips the auto-ingest guard, fails to dedupe against
    // the board's copy, and misses that company's reapplication cooldown.
    const company = canonicalCompany(a.company);

    if (autoIngested.has(company.trim().toLowerCase())) {
      skippedAuto += 1;
      continue;
    }

    // Same dedupe rule as the career-page ingest: URL, or the same title at the
    // same company arriving from a different source.
    const existing = await prisma.job.findFirst({
      where: {
        OR: [
          { jobUrl: a.url },
          { AND: [{ company }, { roleTitle: a.roleTitle }] },
        ],
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.job.create({
      data: {
        company,
        roleTitle: a.roleTitle,
        jobUrl: a.url,
        location: a.location,
        compRange: "Not disclosed",
        expRange: "",
        description: "",
        fitScore: 0,
        fitRationale: a.needsReview
          ? "From a LinkedIn job alert; the email parsed badly, so check the title and company against the posting."
          : "From a LinkedIn job alert email.",
        priority: "MONITOR",
      },
    });
    added += 1;
    if (a.needsReview) flagged += 1;
    addedRows.push({ company: a.company, roleTitle: a.roleTitle });
  }

  if (added > 0) {
    await logJournal({
      type: "ai_run",
      surface: "ingest/gmail",
      summary: `Gmail ingest added ${added} jobs: ${addedRows
        .slice(0, 5)
        .map((j) => `${j.company} — ${j.roleTitle}`)
        .join("; ")}${added > 5 ? "…" : ""}`,
      meta: { added, flagged },
    });
  }

  return NextResponse.json({
    ok: true,
    summary:
      `${alerts.length} role${alerts.length === 1 ? "" : "s"} in alert mail, ${added} new` +
      (filtered ? `, ${filtered} filtered out` : "") +
      (skippedAuto ? `, ${skippedAuto} already covered by a board scan` : "") +
      (flagged ? `, ${flagged} need a manual title check` : ""),
    added,
    flagged,
    filtered,
    skippedAuto,
  });
}
