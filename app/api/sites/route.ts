import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function GET() {
  // Starter sites live in scripts/seed.ts, for the same reason the companies do.
  const sites = await prisma.huntSite.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(sites);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = (body.url as string) || "";
  const domain = body.domain || domainFromUrl(url);
  const category = (body.category as string) || null;
  // Position is per group, since the grid orders within a category. Taking the
  // global maximum put every new site at the end of whichever group it joined with a
  // number far past its neighbours, which survived until the next drag rewrote them.
  const last = await prisma.huntSite.findFirst({
    where: { category },
    orderBy: { position: "desc" },
  });
  const site = await prisma.huntSite.create({
    data: {
      name: body.name || "New site",
      url,
      domain,
      category,
      note: body.note ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
  return NextResponse.json(site);
}
