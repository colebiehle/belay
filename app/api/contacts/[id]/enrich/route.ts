import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichContact } from "@/lib/enrich-contact";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * "Look up" on a person: search the web from their LinkedIn link and fill the empty
 * title, company and summary (lib/enrich-contact). Waits for the answer, about a
 * minute, and returns only the fields it wrote, so the panel can show them.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const before = await prisma.contact.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!before.linkedinUrl) return NextResponse.json({ error: "Add their LinkedIn link first." }, { status: 400 });
  const wrote = await enrichContact(id);
  if (!wrote) {
    return NextResponse.json({ error: "Could not find enough on them to be sure. Paste their profile instead." }, { status: 404 });
  }
  const after = await prisma.contact.findUnique({ where: { id } });
  const updates: Record<string, string> = {};
  for (const k of ["title", "company", "profileText"] as const) {
    if (after?.[k] && after[k] !== before[k]) updates[k] = after[k] as string;
  }
  return NextResponse.json({ updates });
}
