import { NextResponse } from "next/server";
import { enrichMissing } from "@/lib/enrich-contact";

export const dynamic = "force-dynamic";

/**
 * Queue everyone with a LinkedIn link and no summary for a background lookup
 * (lib/enrich-contact), one at a time. Returns how many were queued.
 */
export async function POST() {
  const queued = await enrichMissing();
  return NextResponse.json({ queued });
}
