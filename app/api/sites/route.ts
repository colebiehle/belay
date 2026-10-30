import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { probeSite } from "@/lib/site-probe";
import { PORTFOLIO_BOARDS } from "@/lib/portfolio-boards";


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
  // The VC boards the scan reads, listed after the sites so Home shows every
  // source. Read-only: they live in code (lib/portfolio-boards), not in the table.
  const boards = PORTFOLIO_BOARDS.map((b, i) => ({
    id: `board:${b.name}`,
    ...b,
    category: "vc",
    position: i,
    note: null,
    scanStatus: "daily",
    scanNote: "Read every day through the board's job API",
    readOnly: true,
  }));
  return NextResponse.json([...sites, ...boards]);
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
  // Test-read the site now, so it lands in the right home-page group straight
  // away rather than after the next daily scan.
  const name = body.name || "New site";
  const scan = await probeSite(name, url);
  const site = await prisma.huntSite.create({
    data: {
      name,
      url,
      domain,
      category,
      note: body.note ?? null,
      position: (last?.position ?? -1) + 1,
      ...scan,
      scannedAt: new Date(),
    },
  });
  return NextResponse.json(site);
}
