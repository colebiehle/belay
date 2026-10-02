import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logJournal } from "@/lib/journal";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    orderBy: { dateAdded: "desc" },
  });
  return NextResponse.json(contacts);
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
