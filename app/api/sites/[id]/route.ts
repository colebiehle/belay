import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  // Whitelisted rather than spread: the client sends partial patches from three
  // places, and an unknown key here is a 500 rather than a quietly ignored field.
  const data: Record<string, unknown> = {};
  for (const k of ["name", "url", "domain", "note", "category", "position"]) {
    if (k in body) data[k] = body[k];
  }
  const site = await prisma.huntSite.update({ where: { id }, data });
  return NextResponse.json(site);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.huntSite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
