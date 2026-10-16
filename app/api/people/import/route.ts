import { NextRequest } from "next/server";
import { runImport } from "@/lib/people-import-run";

export const dynamic = "force-dynamic";
// A scrolled connections page can hold a hundred people, and the CLI writes every
// one of them back out as JSON. Two minutes was not always enough for that.
export const maxDuration = 300;

/** The paste box. The work is in lib/people-import-run, shared with the capture backlog. */
export async function POST(req: NextRequest) {
  return runImport(await req.json().catch(() => ({})));
}
