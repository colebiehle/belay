import { NextRequest, NextResponse } from "next/server";

// Serves a company logo from Belay's own origin. A logo loaded straight from
// LinkedIn or Google taints any canvas it is drawn on, so its pixels cannot be read
// and the panel could not take a brand colour from it. Through here it can.
//
// Only the hosts logos actually come from are allowed, so this is not a general
// fetch-anything proxy.
const ALLOWED = [
  "www.google.com", // s2/favicons, which redirects to gstatic
  "media.licdn.com",
  "photos.wellfound.com",
  "bookface-images.s3.amazonaws.com",
];

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src") ?? "";
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED.includes(url.hostname)) {
    return new NextResponse(null, { status: 403 });
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) return new NextResponse(null, { status: 502 });

  return new NextResponse(await res.arrayBuffer(), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800" },
  });
}
