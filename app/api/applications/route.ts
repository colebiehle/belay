import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const applications = await prisma.application.findMany({
    where: { archivedAt: null },
    include: { job: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(applications);
}
