import { NextRequest, NextResponse } from "next/server";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { RELATIONSHIP_TAGS, WARMTH_LEVELS, orderTags } from "@/lib/contact-stages";
import { identityLine } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * "Paste anything" for a person: a profile, call notes, an email thread. Reads it
 * and PROPOSES changes; it never writes. The panel shows the proposal as a diff and
 * applies what you keep through the ordinary PATCH and note list, so the record only
 * changes when you have looked at what is changing.
 *
 * The current values go into the prompt so the model can leave a field alone when
 * the paste agrees with it, and so the preview is not a wall of no-op rows.
 */

type Proposed = {
  updates?: {
    title?: string;
    role?: string;
    howMet?: string;
    relationship?: string[];
    warmth?: string;
    profileText?: string;
  };
  note?: { title?: string; body?: string } | null;
};

// The prompt asks for no em dashes; this makes sure, because a stray one in a note
// reads as machine-written the moment it is pasted into a message.
const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s*[—–]\s*/g, ", ").replace(/\s+\n/g, "\n").trim() : "";

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Paste something first." }, { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentTags = parseTags(contact.relationship);
  // The starters plus every tag already in use, so the model can reuse one you
  // made up. It never invents a new one: that is your call, from the panel.
  const allowedTags = orderTags([
    ...RELATIONSHIP_TAGS,
    ...(await prisma.contact.findMany({ select: { relationship: true } })).flatMap((c) => parseTags(c.relationship)),
  ]);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const who = await identityLine();

  const prompt = `${who} pasted some text about one person they know or want to know. It could be a LinkedIn profile, notes from a call, an email or message thread, or a recruiter message. Read it and say what it changes about their record of this person.

Today is ${today}.

The person, as currently recorded:
- Name: ${contact.name}
- Company: ${contact.company}
- Title: ${contact.title || "(none)"}
- Function: ${contact.role || "(none)"}
- How they met: ${contact.howMet || "(none)"}
- Relationship tags: ${currentTags.length ? currentTags.join(", ") : "(none)"}
- Warmth: ${contact.warmth || "(none)"}
- Background on file: ${contact.profileText ? contact.profileText.slice(0, 600) : "(none)"}

The paste:
"""
${text.slice(0, 12000)}
"""

Return ONLY valid JSON, no preamble, no code fences:

{
  "updates": {
    "title": "Their job title, as the paste states it.",
    "role": "Their function in one or two words (design, engineering, recruiting, product).",
    "howMet": "Where or how the two of them met, in a few words: \\"Config 2026\\", \\"CMU alum\\", \\"cold outreach\\".",
    "relationship": ["tags from this list only: ${allowedTags.join(", ")}"],
    "warmth": "one of: ${WARMTH_LEVELS.join(", ")}",
    "profileText": "Only when the paste is a profile or a bio: a condensed background in under 120 words. Current role and team, previous roles, focus areas, anything distinctive. Plain sentences."
  },
  "note": {
    "title": "A short title naming what this was: \\"Call notes\\", \\"Recruiter email\\", \\"LinkedIn profile\\".",
    "body": "What the paste says that is worth keeping, in two to five short lines. Start with the date the paste refers to if it gives one, otherwise ${today}. Decisions, asks, next steps, names, dates."
  }
}

Rules:
- Facts from the paste only. Never invent a title, a date, a shared history or a tag the paste does not support.
- Leave a field out entirely rather than guess. An empty "updates" object is a fine answer.
- Leave a field out when the paste agrees with what is already recorded.
- relationship: only values from the list, exactly as written. Only tags the paste clearly supports: "could refer" needs them to offer or agree to refer, "recruiter" needs them to be one. Do not repeat tags already recorded.
- warmth: only when the paste shows it. A first cold message is cold; a real conversation is at least warm.
- profileText: leave out unless the paste is a profile or bio.
- note: always include one, unless the paste has nothing in it at all.
- No em dashes anywhere. No marketing language. Write plainly.`;

  const { text: raw, timedOut } = await callClaudeDetailed(prompt, 120_000);
  const parsed = extractJson<Proposed>(raw, "object");
  if (!parsed) {
    return NextResponse.json(
      { error: timedOut ? "That timed out. Try again." : "Could not read a proposal out of that. Try again." },
      { status: 502 },
    );
  }

  // Validate everything the model returned. A field that does not survive is dropped
  // rather than passed through, and one that matches the record is not a change.
  const u = parsed.updates ?? {};
  const updates: Record<string, unknown> = {};
  const title = clean(u.title);
  if (title && title !== contact.title) updates.title = title;
  const role = clean(u.role);
  if (role && role !== contact.role) updates.role = role;
  const howMet = clean(u.howMet);
  if (howMet && howMet !== contact.howMet) updates.howMet = howMet;
  const warmth = clean(u.warmth).toLowerCase();
  if ((WARMTH_LEVELS as readonly string[]).includes(warmth) && warmth !== contact.warmth) updates.warmth = warmth;
  // Proposed as the whole set, existing tags plus new ones, so applying it adds
  // rather than replaces. Only proposed at all if something new arrived.
  const newTags = (Array.isArray(u.relationship) ? u.relationship : [])
    .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
    .filter((t) => allowedTags.includes(t) && !currentTags.includes(t));
  if (newTags.length) updates.relationship = orderTags([...currentTags, ...newTags]);
  const profileText = clean(u.profileText);
  if (profileText && profileText !== contact.profileText) updates.profileText = profileText;

  const noteBody = clean(parsed.note?.body);
  const note = noteBody ? { title: clean(parsed.note?.title) || "Pasted", body: noteBody } : null;

  return NextResponse.json({ updates, note });
}
