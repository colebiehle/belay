import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Mutuals are stored by name (see introVias in ContactPanel), so a rename has to
  // reach everyone who lists this person, or their mutual stops opening anyone.
  const before =
    typeof body.name === "string" ? await prisma.contact.findUnique({ where: { id }, select: { name: true } }) : null;
  const oldName = before?.name.trim().toLowerCase();
  const newName = typeof body.name === "string" ? body.name.trim() : "";
  if (oldName && newName && oldName !== newName.toLowerCase()) {
    const swap = (n: string) => (n.trim().toLowerCase() === oldName ? newName : n);
    const listing = await prisma.contact.findMany({
      where: { id: { not: id }, OR: [{ introVia: { not: null } }, { introVias: { not: null } }] },
      select: { id: true, introVia: true, introVias: true },
    });
    await prisma.$transaction(
      listing
        .map((c) => {
          let list: string[] = [];
          try {
            list = JSON.parse(c.introVias ?? "[]");
          } catch {}
          const nextList = Array.isArray(list) ? list.map(swap) : [];
          const nextVia = c.introVia ? swap(c.introVia) : c.introVia;
          const changed = nextVia !== c.introVia || JSON.stringify(nextList) !== JSON.stringify(list);
          return changed
            ? prisma.contact.update({
                where: { id: c.id },
                data: { introVia: nextVia, introVias: nextList.length ? JSON.stringify(nextList) : c.introVias },
              })
            : null;
        })
        .filter((u) => u !== null),
    );
  }

  const contact = await prisma.contact.update({ where: { id }, data: body });
  return NextResponse.json(contact);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
