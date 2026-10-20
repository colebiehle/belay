import { NextRequest, NextResponse } from "next/server";
import { captureJobs, enqueueCapture } from "@/lib/capture-queue";
import { cleanTags } from "@/lib/people-merge";

export const dynamic = "force-dynamic";

/**
 * The "Send to Belay" extension (extension/ in this repo). POST a LinkedIn page's
 * HTML with the popup's mutual and tags; it joins the backlog and this answers at
 * once. GET is the backlog, for the popup's status line and the People queue.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (!str(body.html) && !str(body.url) && !str(body.text)) {
    return NextResponse.json({ error: "Nothing was captured from that page." }, { status: 400 });
  }
  const job = enqueueCapture({
    html: str(body.html),
    text: str(body.text),
    debug: body.debug ?? undefined,
    url: str(body.url),
    title: str(body.title),
    mutual: str(body.mutual),
    tags: cleanTags(body.tags),
  });
  return NextResponse.json({ job });
}

export async function GET() {
  return NextResponse.json({ jobs: captureJobs() });
}
