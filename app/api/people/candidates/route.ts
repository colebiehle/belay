import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logJournal } from "@/lib/journal";
import { DEFAULT_STAGE } from "@/lib/contact-stages";
import { normalizeLinkedInUrl, personKey } from "@/lib/people-import";
import { enqueueEnrich } from "@/lib/enrich-contact";

export const dynamic = "force-dynamic";

/**
 * The Network queue: people pasted from LinkedIn, waiting for Add or Skip.
 *
 * GET is the pending cards, oldest paste first so a batch is finished before the
 * next one starts. PATCH decides one card or many with the same call, because "Add
 * all" on a 30-person paste is the same act as Add on one card, thirty times.
 */

export async function GET() {
  const pending = await prisma.personCandidate.findMany({
    where: { status: "pending" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(pending);
}

// "note" files the reason typed on a decided card. It is its own action because the
// reason arrives after the decision, as on the job queue: the card is decided the
// moment you press Accept or Pass, and the note is written in the gap before Done.
type Action = "add" | "skip" | "undo" | "note";

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((i: unknown) => typeof i === "string") : [];
  const action = body.action as Action;
  if (!ids.length || !["add", "skip", "undo", "note"].includes(action)) {
    return NextResponse.json({ error: "Expected { ids, action: add | skip | undo | note }" }, { status: 400 });
  }
  if (action === "note") {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    // Only on decided rows: a note on a pending card would be a reason for nothing.
    await prisma.personCandidate.updateMany({
      where: { id: { in: ids }, status: { not: "pending" } },
      data: { decisionNote: note || null },
    });
    return NextResponse.json({ ok: true });
  }
  const rows = await prisma.personCandidate.findMany({ where: { id: { in: ids } } });
  const now = new Date();

  if (action === "skip") {
    await prisma.personCandidate.updateMany({
      where: { id: { in: rows.filter((r) => r.status === "pending").map((r) => r.id) } },
      data: { status: "skipped", decidedAt: now },
    });
    return NextResponse.json({ ok: true, contacts: [] });
  }

  if (action === "undo") {
    // Back to pending. An add is undone by removing the Contact it created, and only
    // that one: a card marked added because the person was already in the network
    // (contactId null) leaves the existing record alone.
    const made = rows.map((r) => r.contactId).filter((c): c is string => !!c);
    await prisma.$transaction([
      prisma.contact.deleteMany({ where: { id: { in: made } } }),
      prisma.personCandidate.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: "pending", decidedAt: null, contactId: null, decisionNote: null },
      }),
    ]);
    return NextResponse.json({ ok: true, contacts: [], removed: made });
  }

  // Add. The import deduped against Contact, but the card may have sat in the queue
  // while the same person was added by hand, so check again rather than make a twin.
  const existing = await prisma.contact.findMany({ select: { id: true, name: true, company: true, linkedinUrl: true } });
  const byUrl = new Map(
    existing.map((c) => [normalizeLinkedInUrl(c.linkedinUrl), c.id] as const).filter(([u]) => !!u),
  );
  const byKey = new Map(existing.map((c) => [personKey(c.name, c.company), c.id] as const));

  const created = [];
  for (const r of rows.filter((x) => x.status === "pending")) {
    const twin = (r.linkedinUrl && byUrl.get(r.linkedinUrl)) || byKey.get(personKey(r.name, r.company ?? ""));
    if (twin) {
      await prisma.personCandidate.update({ where: { id: r.id }, data: { status: "added", decidedAt: now } });
      continue;
    }
    const contact = await prisma.contact.create({
      data: {
        type: "Target",
        name: r.name,
        // Contact.company is required; an unclear headline leaves it blank, which the
        // panel's header edit fills in later.
        company: r.company ?? "",
        title: r.title,
        linkedinUrl: r.linkedinUrl,
        howMet: r.batchNote,
        introVia: r.mutual,
        introVias: r.mutual ? JSON.stringify([r.mutual]) : null,
        stage: DEFAULT_STAGE,
        stageHistory: JSON.stringify([{ stage: DEFAULT_STAGE, at: now.toISOString() }]),
        dateAdded: now,
      },
    });
    await prisma.personCandidate.update({
      where: { id: r.id },
      data: { status: "added", decidedAt: now, contactId: contact.id },
    });
    created.push(contact);
  }

  // The paste gave a headline at most: look each new person up from their profile
  // link, in the background, to fill the title, company and summary.
  enqueueEnrich(created.filter((c) => c.linkedinUrl).map((c) => c.id));

  if (created.length) {
    // One entry for a bulk add rather than thirty: the journal is read by the brain,
    // and thirty near-identical lines would drown everything else in it.
    await logJournal({
      type: "contact",
      surface: "network/queue",
      summary:
        created.length === 1
          ? `Added contact: ${created[0].name}${created[0].company ? ` at ${created[0].company}` : ""} (from a LinkedIn paste)`
          : `Added ${created.length} contacts from a LinkedIn paste${rows[0]?.source ? ` (${rows[0].source})` : ""}`,
      refs: created.length === 1 ? { contactId: created[0].id } : undefined,
    });
  }
  return NextResponse.json({ ok: true, contacts: created });
}
