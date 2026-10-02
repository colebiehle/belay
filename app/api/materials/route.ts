import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const materials = await prisma.material.findMany({
    orderBy: [{ kind: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(materials);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.kind) {
    return NextResponse.json({ error: "kind required" }, { status: 400 });
  }
  const material = await prisma.material.create({
    data: {
      kind: body.kind,
      title: body.title ?? null,
      content: body.content ?? null,
      url: body.url ?? null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(material);
}
