import { NextRequest, NextResponse } from "next/server";
import { callClaudeDetailed } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { understandingBlock, contextBlock, FOUNDATION_KINDS } from "@/lib/foundation";
import { logJournal } from "@/lib/journal";
import { CONNECT_NOTE_LIMIT } from "@/lib/contact-stages";
import { identityLine } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The outreach chat: one conversation per person, with a context that sets the task.
 *
 * Deliberately the same design as the role chat, including the mistakes already paid
 * for there. One transcript regardless of scope, because a scratchpad that splits into
 * threads loses the arc of working one person. No digest of "other threads", because
 * the version of that in the role chat used `NOT { cellKey }` and matched nothing at
 * all. And a failed call returns an error rather than being written in as though
 * Claude had said it.
 */

const GUARD = `

NEVER claim to have read a profile, page or document that is not reproduced in this prompt. You cannot browse. If they have not pasted something, you do not have it, and saying otherwise is a fabrication they will act on.`;

const VOICE = `Write the way they write: direct, specific, no em-dashes, no AI phrasing, no "I hope this finds you well", no "I'd love to pick your brain". Never invent a shared detail, a mutual interest, or a fact about their background.`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await prisma.chatMessage.findMany({
    where: { contactId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { count } = await prisma.chatMessage.deleteMany({ where: { contactId: id } });
  return NextResponse.json({ ok: true, deleted: count });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const content: string = body.content;
  const scope: string | null =
    typeof body.scope === "string" && body.scope.trim() ? body.scope.trim() : null;
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userMsg = await prisma.chatMessage.create({
    data: { contactId: id, role: "user", content, cellKey: scope, scope: "contact" },
  });

  const history = (
    await prisma.chatMessage.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
    })
  ).reverse();

  const transcript = history.map((m) => `${m.role === "user" ? "they" : "Claude"}: ${m.content}`).join("\n\n");
  const understanding = await understandingBlock(1000);
  // Who they are comes out of the profile now rather than a sentence in this file.
  const foundation = await contextBlock({ include: [...FOUNDATION_KINDS], maxCharsPerKind: 700 });

  // Roles at this company, so a draft can name something concrete and so the ask can
  // point at an actual opening rather than a general interest.
  const theirRoles = await prisma.job.findMany({
    where: { company: contact.company, OR: [{ verdict: "Apply" }, { verdict: null }] },
    select: {
      roleTitle: true,
      verdict: true,
      jobUrl: true,
      // Whether you have already sent it changes the ask completely: "refer me before I
      // apply" and "I applied on the 30th, could you flag it internally" are
      // different messages, and the prompt could not previously tell them apart.
      application: { select: { status: true, dateApplied: true } },
    },
    take: 6,
  });

  // A booking link belongs in the answer bank with your other reusable facts, so the
  // scheduling draft can use it rather than asking every time.
  const booking = await prisma.answerBank.findFirst({
    where: { questionKey: "booking_link" },
    select: { answer: true },
  });

  const notes = (() => {
    if (!contact.noteList) return "";
    try {
      const v = JSON.parse(contact.noteList) as { title: string; body: string }[];
      return Array.isArray(v) ? v.map((n) => `[${n.title}] ${n.body}`).join("\n\n").slice(0, 2500) : "";
    } catch {
      return "";
    }
  })();

  // The relationship, when it has been recorded. Where you met is the most natural
  // opener there is, and warmth decides what the draft may ask for: a referral ask
  // to a stranger is the message that burns the contact.
  const relTags = (() => {
    if (!contact.relationship) return [] as string[];
    try {
      const v = JSON.parse(contact.relationship);
      return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
    } catch {
      return [];
    }
  })();
  const WARMTH_NOTE: Record<string, string> = {
    cold: "cold: they do not know each other yet. Do not ask a cold contact for a referral; earn a conversation first.",
    warm: "warm: they have talked. A specific, small ask is fine.",
    close: "close: they know each other well. Be direct, skip the formalities.",
  };
  const relationshipLines = [
    contact.howMet ? `- Where they met: ${contact.howMet} (use it as the shared context when it fits)` : "",
    relTags.length ? `- What this person is to them: ${relTags.join(", ")}` : "",
    contact.warmth ? `- Warmth: ${WARMTH_NOTE[contact.warmth] ?? contact.warmth}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let task = "";
  switch (scope) {
    case "connect":
      task = `Draft a LinkedIn connection note. It has two jobs, in order: get accepted, then get a reply.

Accepted: it must read as one person writing to one person, not outreach. Human, warm, plain, and specific to THEM: something only this person could receive. Anything that could be pasted to the next person on the list reads as spam and gets ignored.
Replied: it ends on one easy, specific question about their work that they could answer in a line or two from their phone. That question is the call to action and the thread the conversation continues from. Not "can we chat", not a call, never a referral: a big ask in a first note lowers acceptance.

Structure, ${CONNECT_NOTE_LIMIT} characters at most including spaces:
1. "Hi {first name}," and straight in. No "hope you're well", no "I came across your profile".
2. Why them, one sentence, the strongest true hook available: shared ground first (CMU or UCSD, a mutual, an event, a shared field), then something specific in their work or path, then the team or role they are pursuing there. Specific beats flattering; never praise a post or project they have not actually seen.
3. Who they are, half a sentence, only the part that makes sense to this person ("I'm finishing my MHCI at CMU and design AI products").
4. The question: about the person's own work or experience, easy, a little curious. Make it one they would enjoy answering.
No sign-off; LinkedIn shows the name.

They may give a line like "goal: … · hook: … · role: …". Use it; fill anything missing from what is known below. If there is no real hook, ask them for one in a single line instead of inventing it.

Give two versions, each with its character count: a warmer, more personal one and a more direct one. Then one line on which you would send and why.`;
      break;
    case "followup":
      task = `Draft a follow-up. One short paragraph. No apology for following up, no guilt, no restating the original message at length. Add one new thing — a reason the timing changed, something they read, a specific question — because a bare "just bumping this" gives them nothing to reply to. If there is nothing new to add, say that waiting longer is the better move.`;
      break;
    case "scheduling":
      task = `Draft a short message proposing a time. Two sentences at most.

If they have a booking link on file (below), use it — one link replaces the three-message exchange that otherwise happens, and it is the single biggest friction in getting a chat on the calendar. If they have no link, offer two or three concrete windows rather than "when works for you", which puts the work back on them.`;
      break;
    case "thanks":
      task = `Draft a thank-you. Short, three or four sentences. Name one specific thing they actually took from the conversation — if they have not said what that was, ask, because a generic thank-you is worse than none.

No ask in this one. There is a separate referral draft for that, and bundling a favour into a thank-you makes the thanks read as the setup for it.`;
      break;
    case "referral":
      task = `Draft the referral ask.

Pick ONE role from the list above and name it, with the link. Six options is not a favour, it is homework. If they have already applied, the ask is for an internal flag or a note to the hiring manager and it should say when they applied; if they have not sent it yet, the ask is for the referral itself and the timing is worth saying out loud. If they are not tracking a role at their company, say so and suggest asking to be kept in mind instead of inventing a req.

Make it easy to say no. One short paragraph, a sentence on why they are a fit for that specific role, and an explicit out. Offer to send anything that makes it easier for them: the resume, a two-line blurb they can paste, the req link. People say yes to referrals when the work is already done for them.`;
      break;
    case "prep":
      task = `Help them prepare for this conversation. What to ask that they can uniquely answer, what they want out of it, and what not to ask. Keep it to a handful of questions they could hold in their head, not a script.`;
      break;
    case "debrief":
      task = `they just had the conversation and will say what happened. Help them pull out what they learned, then get specific about the ask: a referral, an internal flag, an intro to someone else, or nothing. The conversation is not the goal. If the right move is no ask at all, say so.`;
      break;
    default:
      task = `No particular context is set. Help with whatever they ask about this person.`;
  }

  const who = await identityLine();
  const prompt = `You are helping ${who} with outreach to one person.${foundation ? `\n\nWho they are, in their own words:\n${foundation}\n` : ""} ${VOICE}${GUARD}

The person:
- Name: ${contact.name}
- Company: ${contact.company}
- Title: ${contact.title || "(unknown)"}
- Function: ${contact.role || "(unknown)"}
- LinkedIn: ${contact.linkedinUrl || "(none on file)"}
- How they found them: ${contact.introVia ? `through ${contact.introVia}` : "cold, no mutual connection"}
- Stage: ${contact.stage || "To reach out"}${relationshipLines ? `\n${relationshipLines}` : ""}

${contact.profileText ? `Who this person is (a summary from their profile or a web lookup):\n${contact.profileText.slice(0, 4000)}\n` : "There is no summary of this person yet. You cannot look them up yourself. Ask for one detail if the draft needs something specific about them.\n"}
${theirRoles.length > 0 ? `Roles they are tracking at ${contact.company}:\n${theirRoles
    .map((r) => {
      const app = r.application;
      const state = app?.dateApplied
        ? ` (applied ${new Date(app.dateApplied).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, now at ${app.status})`
        : app
          ? " (accepted, not sent yet)"
          : r.verdict === "Apply"
            ? " (accepted, not sent yet)"
            : " (still deciding)";
      return `  - ${r.roleTitle}${state}`;
    })
    .join("\n")}\n` : `they are not tracking any roles at ${contact.company} right now.\n`}
${booking?.answer ? `Their booking link: ${booking.answer}\n` : "They have no booking link on file.\n"}${notes ? `Their notes on this person:\n${notes}\n` : ""}${understanding ? `Their durable preferences:\n${understanding}\n` : ""}
Conversation so far:
${transcript || "(nothing yet)"}

Your task right now:
${task}

Reply to their latest message directly and briefly. They are working, not reading.`;

  const { text: raw, timedOut } = await callClaudeDetailed(prompt, 180_000);
  const reply = raw.trim();
  const failed =
    timedOut || !reply || /^you've hit your (session|usage) limit/i.test(reply) || /^error\b/i.test(reply);
  if (failed) {
    return NextResponse.json(
      {
        error: timedOut
          ? "That timed out. Your message is saved; send again."
          : reply || "Claude returned nothing. Your message is saved; send again.",
        userMessageId: userMsg.id,
      },
      { status: 502 },
    );
  }

  const assistantMsg = await prisma.chatMessage.create({
    data: { contactId: id, role: "assistant", content: reply, cellKey: scope, scope: "contact" },
  });

  await logJournal({
    type: "ai_run",
    surface: "contacts/chat",
    summary: `Outreach chat: ${contact.name} (${contact.company})${scope ? ` · ${scope}` : ""}`,
  });

  return NextResponse.json({ user: userMsg, assistant: assistantMsg });
}
