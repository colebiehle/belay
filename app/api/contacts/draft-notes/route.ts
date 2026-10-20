import { NextRequest, NextResponse } from "next/server";
import { draftStatus, enqueueDrafts } from "@/lib/draft-notes";

export const dynamic = "force-dynamic";

/** POST { ids } drafts connection notes for those people in the background; GET is progress. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((i: unknown) => typeof i === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "Pick someone to draft for." }, { status: 400 });
  const queued = enqueueDrafts(ids);
  return NextResponse.json({ queued, ...draftStatus() });
}

export async function GET() {
  return NextResponse.json(draftStatus());
}
