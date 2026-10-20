import { NextResponse } from "next/server";
import { noteStats } from "@/lib/note-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await noteStats());
}
