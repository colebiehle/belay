import { NextResponse } from "next/server";
import { computeInsights } from "@/lib/insights";

// Read fresh on every request. The numbers move every time a status changes, and a
// cached view that disagrees with the pipeline is worse than a slow one.
export const dynamic = "force-dynamic";

/**
 * The Insights aggregates as JSON. The /insights page computes the same thing
 * in-process; this route is for anything else that wants the numbers (the home chat,
 * a script) without reimplementing them.
 */
export async function GET() {
  const data = await computeInsights();
  return NextResponse.json(data);
}
