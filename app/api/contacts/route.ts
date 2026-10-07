import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logJournal } from "@/lib/journal";
import { isEnriching } from "@/lib/enrich-contact";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    orderBy: { dateAdded: "desc" },
  });
  // enriching: a background lookup is still running for them, so the panel says
  // so instead of offering to paste a summary that is on its way.
  return NextResponse.json(contacts.map((c) => ({ ...c, enriching: isEnriching(c.id) })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contact = await prisma.contact.create({ data: body });
  await logJournal({
    type: "contact",
    surface: "contacts/add",
    summary: `Added contact: ${contact.name ?? "(no name)"}${contact.company ? ` at ${contact.company}` : ""}${contact.role ? ` (${contact.role})` : ""}`,
    refs: { contactId: contact.id },
  });
  return NextResponse.json(contact, { status: 201 });
}
