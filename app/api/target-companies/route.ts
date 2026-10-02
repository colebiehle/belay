import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coverageFor } from "@/lib/ats-boards";


function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function GET() {
  // No seed-on-empty here. A starter list belongs in scripts/seed.ts, where it is
  // explicit and editable; hidden in a GET it meant a user who deleted every company
  // got them all back on the next page load.
  const companies = await prisma.targetCompany.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  // Derived, not stored: coverage follows the board table, and a stored copy
  // would go stale the moment a token is added there.
  return NextResponse.json(
    companies.map((c) => ({ ...c, coverage: coverageFor(c.name, c.tier) })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const careersUrl = (body.careersUrl as string) || "";
  const domain = body.domain || domainFromUrl(careersUrl);
  const last = await prisma.targetCompany.findFirst({ orderBy: { position: "desc" } });
  const company = await prisma.targetCompany.create({
    data: {
      name: body.name || "New company",
      domain,
      careersUrl,
      tier: body.tier ?? 2,
      note: body.note ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
  return NextResponse.json(company);
}
