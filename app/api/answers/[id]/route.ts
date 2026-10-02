import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * `useCount` is bumped by the copy button rather than on edit, so the ordering
 * in the answer bank reflects which answers forms actually ask for. After a
 * dozen applications the list sorts itself.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.question === "string") data.question = body.question;
  if (typeof body.answer === "string") data.answer = body.answer;
  if (typeof body.tags === "string") data.tags = body.tags;
  if (body.used === true) {
    data.useCount = { increment: 1 };
    data.lastUsedAt = new Date();
  }

  const updated = await prisma.answerBank.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.answerBank.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
