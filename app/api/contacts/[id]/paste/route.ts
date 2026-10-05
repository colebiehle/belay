import { NextRequest, NextResponse } from "next/server";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { identityLine } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * "Add summary" for a person: paste their LinkedIn About section and current role
 * (or call notes, or a thread) and get back a short summary of who they are. It
 * PROPOSES; the panel shows the summary and saves it only when you keep it.
 *
 * It writes the summary and nothing else. It used to propose title, tags, warmth and
 * a note as well, which made one paste quietly reach into half the record: the
 * header now edits the facts, and how close you are and what someone is to you are
 * your call, not something to read off a profile.
 */

type Proposed = { summary?: string };

// The prompt asks for no em dashes; this makes sure, because a stray one reads as
// machine-written the moment the summary is read back into a draft.
const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s*[—–]\s*/g, ", ").replace(/\s+\n/g, "\n").trim() : "";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Paste something first." }, { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const who = await identityLine();
  const prompt = `${who} pasted some text about ${contact.name} (${[contact.title, contact.company].filter(Boolean).join(", ")}). It is most likely their LinkedIn About section and current role, but it could be notes from a call or a message thread.

Write a short summary of who this person is, for the top of their record: two or three plain sentences, under 70 words. What they do now and where, what they have done before, and what they focus on or care about. If the paste is call notes or a thread, summarise what it says about them instead.

The paste:
"""
${text.slice(0, 12000)}
"""

Return ONLY valid JSON, no preamble, no code fences:

{ "summary": "..." }

Rules:
- Facts from the paste only. Never invent a role, a company or a shared history.
- Write about them in the third person, plainly. No marketing language, no em dashes.`;

  const { text: raw, timedOut } = await callClaudeDetailed(prompt, 120_000);
  const parsed = extractJson<Proposed>(raw, "object");
  const summary = clean(parsed?.summary);
  if (!summary) {
    return NextResponse.json(
      { error: timedOut ? "That timed out. Try again." : "Could not write a summary from that. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ updates: { profileText: summary }, note: null });
}
