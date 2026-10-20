import { NextResponse } from "next/server";
import { rescoreStatus, startRescore } from "@/lib/people-rescore";

export const dynamic = "force-dynamic";

/** POST starts re-scoring the waiting queue against the current fit rubric ({ maxFit } for just the low end); GET is progress. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const maxFit = typeof body.maxFit === "number" ? body.maxFit : undefined;
  return NextResponse.json({ started: startRescore(maxFit), ...rescoreStatus() });
}

export async function GET() {
  return NextResponse.json(rescoreStatus());
}
