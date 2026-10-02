import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logJournal } from "@/lib/journal";

const SKILL_KIND_LABEL: Record<string, string> = {
  skill_wanted: "to learn",
  skill_learning: "learning",
  skill_current: "learned",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const before = await prisma.material.findUnique({ where: { id } });
  const material = await prisma.material.update({ where: { id }, data: body });

  // Journal skill status transitions — strong taste signal for the brain.
  if (
    before &&
    typeof body.kind === "string" &&
    body.kind !== before.kind &&
    body.kind.startsWith("skill_") &&
    before.kind.startsWith("skill_")
  ) {
    await logJournal({
      type: "status_change",
      surface: "skill-card",
      summary: `${material.title ?? "(skill)"}: ${SKILL_KIND_LABEL[before.kind] ?? before.kind} → ${SKILL_KIND_LABEL[material.kind] ?? material.kind}`,
      refs: { materialId: id },
    });
  }

  // Journal reflection entries when first written.
  if (
    before &&
    before.kind === "reflection_entry" &&
    typeof body.content === "string" &&
    body.content.trim() &&
    (before.content ?? "").trim() === ""
  ) {
    await logJournal({
      type: "reflection",
      surface: "reflection",
      summary: `New reflection: ${(material.title ?? "").slice(0, 80)}`,
      refs: { materialId: id },
    });
  }

  return NextResponse.json(material);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.material.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
