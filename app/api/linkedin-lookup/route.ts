import { NextResponse } from "next/server";
import { EMPTY, lookupProfile } from "@/lib/linkedin-profile";

/**
 * Name and company from a LinkedIn profile URL, for the Network page's Add form.
 * The form used to guess the name from the URL slug, which is wrong whenever the
 * slug is a handle. Every failure answers { name: null, company: null } with a 200,
 * so the form keeps its slug guess and never waits on, or errors over, this. The
 * fetch and parsing live in lib/linkedin-profile.ts.
 */
export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(EMPTY);
  }
  return NextResponse.json(await lookupProfile(body.url));
}
