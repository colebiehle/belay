import { NextResponse } from "next/server";
import { rescoreStatus, startRescore } from "@/lib/people-rescore";

export const dynamic = "force-dynamic";

/** POST starts re-scoring the waiting queue against the current fit rubric; GET is progress. */
export async function POST() {
  return NextResponse.json({ started: startRescore(), ...rescoreStatus() });
}

export async function GET() {
  return NextResponse.json(rescoreStatus());
}
