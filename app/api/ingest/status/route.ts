import { NextResponse } from "next/server";
import { gmailStatus } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/** Whether each source that can lapse is working: today, the Gmail sign-in. */
export async function GET() {
  return NextResponse.json({ gmail: await gmailStatus() });
}
