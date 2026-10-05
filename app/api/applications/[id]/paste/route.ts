import { NextRequest, NextResponse } from "next/server";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { STATUSES } from "@/lib/statuses";
import { identityLine } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * "Paste anything" for a role: a recruiter email, interview notes, an offer letter,
 * a scheduling thread. Reads it and PROPOSES changes; it never writes. The panel
 * shows the proposal and applies only what you keep, through the ordinary PATCH.
 *
 * Only fields the role panel actually shows, and only ones a paste plausibly carries:
 * the stage (a rejection, a screen being booked), an interview with a date, the comp
 * figure, and the form link. Everything else a paste says goes in the note, which is
 * where the panel already keeps what happened.
 */

type Proposed = {
  updates?: {
    status?: string;
    compRange?: string;
    portalUrl?: string;
    interviews?: { label?: string; at?: string }[];
  };
  note?: { title?: string; body?: string } | null;
};

const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s*[—–]\s*/g, ", ").replace(/\s+\n/g, "\n").trim() : "";

// Wall-clock time as the paste states it, no offset, so the browser reads it in the
// user's own zone the same way the datetime-local input in the panel does. A date
// with no time is kept (a booked day is still worth having) at noon, and says so.
function normaliseAt(raw: string): { at: string; timeKnown: boolean } | null {
  const v = raw.trim();
  const dt = v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (dt) return { at: `${dt[1]}T${dt[2]}`, timeKnown: true };
  const d = v.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (d) return { at: `${d[1]}T12:00`, timeKnown: false };
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Paste something first." }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id }, include: { job: true } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing: { label: string; at: string }[] = (() => {
    try {
      const v = JSON.parse(app.interviewList ?? "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  })();

  const now = new Date();
  const today = now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const who = await identityLine();

  const prompt = `${who} pasted some text about one job application. It could be a recruiter email, a scheduling thread, notes from an interview, a rejection, or an offer. Read it and say what it changes about their record of this application.

Today is ${today}. Resolve relative dates ("next Thursday") against today.

The application, as currently recorded:
- Company: ${app.job.company}
- Role: ${app.job.roleTitle}
- Stage: ${app.status} (stages, in order: ${STATUSES.join(", ")})
- Comp: ${app.job.compRange || "(none)"}
- Application form link: ${app.portalUrl || "(none)"}
- Interviews on file: ${existing.length ? existing.map((i) => `${i.label || "(unlabelled)"} at ${i.at}`).join("; ") : "(none)"}

The paste:
"""
${text.slice(0, 12000)}
"""

Return ONLY valid JSON, no preamble, no code fences:

{
  "updates": {
    "status": "The stage this puts the application at, exactly one of: ${STATUSES.join(", ")}.",
    "compRange": "The pay figure or range exactly as the paste states it, e.g. \\"$150k-$180k base\\".",
    "portalUrl": "A link to the application form or candidate portal, if the paste gives one.",
    "interviews": [{ "label": "What it is and with whom: \\"Recruiter screen with Dana\\".", "at": "YYYY-MM-DDTHH:mm in the time the paste states, or YYYY-MM-DD if it gives a day but no time" }]
  },
  "note": {
    "title": "A short title naming what this was: \\"Recruiter email\\", \\"Screen notes\\", \\"Rejection\\".",
    "body": "What the paste says that is worth keeping, in two to five short lines. Start with the date the paste refers to if it gives one, otherwise ${today}. Who said what, next steps, deadlines, what they asked for."
  }
}

Rules:
- Facts from the paste only. Never invent a date, a time, a name or a figure.
- Leave a field out entirely rather than guess. An empty "updates" object is a fine answer.
- Leave a field out when the paste agrees with what is already recorded.
- status: only when the paste makes the stage plain: a screen or interview being booked, a rejection, an offer. Never move it backwards on a hunch.
- interviews: only ones with at least a date, and not ones already on file. If the paste names a timezone different from the reader's, say it in the label.
- compRange: only a figure the paste states. Not a guess from the level.
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

  const u = parsed.updates ?? {};
  const updates: Record<string, unknown> = {};
  const status = clean(u.status);
  const canonical = STATUSES.find((s) => s.toLowerCase() === status.toLowerCase());
  if (canonical && canonical !== app.status) updates.status = canonical;
  const comp = clean(u.compRange);
  if (comp && comp !== app.job.compRange) updates.compRange = comp;
  const portal = clean(u.portalUrl);
  if (/^https?:\/\/\S+$/i.test(portal) && portal !== app.portalUrl) updates.portalUrl = portal;
  const interviews = (Array.isArray(u.interviews) ? u.interviews : [])
    .map((iv) => {
      const when = normaliseAt(typeof iv?.at === "string" ? iv.at : "");
      if (!when) return null;
      const label = clean(iv?.label);
      return { label: when.timeKnown ? label : `${label}${label ? " " : ""}(time not set)`, at: when.at };
    })
    .filter((iv): iv is { label: string; at: string } => iv !== null)
    // Skip anything already on file for the same minute, whatever its label.
    .filter((iv) => !existing.some((e) => new Date(e.at).getTime() === new Date(iv.at).getTime()));
  if (interviews.length) updates.interviews = interviews;

  const noteBody = clean(parsed.note?.body);
  const note = noteBody ? { title: clean(parsed.note?.title) || "Pasted", body: noteBody } : null;

  return NextResponse.json({ updates, note });
}
