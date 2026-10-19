import { NextRequest, NextResponse } from "next/server";
import { callClaudeDetailed } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { understandingBlock, contextBlock, FOUNDATION_KINDS } from "@/lib/foundation";
import { logJournal } from "@/lib/journal";
import { CONNECT_NOTE_LIMIT } from "@/lib/contact-stages";
import { identity, identityLine } from "@/lib/identity";

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

  const me = await identity();
  // The last few connect drafts written for other people, so a run of notes does
  // not open the same way every time: sameness is what makes a note read as a template.
  const recentNotes =
    scope === "connect"
      ? (
          await prisma.chatMessage.findMany({
            where: { cellKey: "connect", role: "assistant", contactId: { not: id } },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { content: true },
          })
        )
          .map((m) => m.content.replace(/\s+/g, " ").slice(0, 500))
          .join("\n---\n")
      : "";
  let task = "";
  switch (scope) {
    case "connect":
      task = `Draft a LinkedIn connection note, ${CONNECT_NOTE_LIMIT} characters at most including spaces (aim for 200 to 280). Its jobs, in order: get accepted, then get a reply.

Write for the person receiving it: a busy professional reading it on their phone between meetings, deciding in two seconds. People reply when a note makes them feel recognised (specifically, not flattered), lets them talk about their own choices and story, asks for their advice rather than their help, reminds them of a community they belong to and pay forward, takes thirty seconds to answer, and, when it is true, offers them something too.

The voice is theirs: relatable and conversational, like talking to someone, not writing. Plain everyday words ("it's been interesting", "pretty much changed how we all work", "how it's changed things for you"), never polished or buzzwordy ("in the age of AI", "leverage", "landscape", "excited to"). Never a pitch or a template. Their structure, in this order:
1. Say hi: "Hey {first name}!"
2. A quick attention grabber, the strongest true tie: "I'm a recent CMU MHCI grad" (for anyone), a mutual ("We're both connected with Nicole Willis"), a shared past employer, UCSD for UCSD alumni. Not "Fellow X here" or "X grad here".
3. Context, said casually: they are teaching design at CMU right now, and it has been interesting with how much AI has changed the way everyone works.
4. Interest in how AI has changed things for this person, tied to their role, team or company.
5. That they are starting to look at industry roles, as the reason for reaching out now.

The vibe, filled in (models for the tone, not templates):
"Hey Priya! I'm a recent CMU MHCI grad and I'm teaching design at CMU right now, which has been interesting since AI has pretty much changed how we all work. I'm starting to look at industry roles and would love to hear how AI has changed things for you on the onboarding team at Figma!" (285)
"Hey Jeel! We're both connected with Nicole Willis. I'm a recent CMU MHCI grad teaching design at CMU right now, and it's been interesting with how much AI has changed the way we work. As I look at industry roles, I'd love to hear how it's changed things for you at Nvidia!" (272)
For someone AI is the wrong topic for (a recruiter, someone outside product work), keep 1, 2, 3 and 5, and swap 4 for another angle below.

EVERY note has, woven together lightly (they share sentences; there is no room for each at full length):
- "Hey {first name}!" and who they are in a few casual words, picking the part of their background that connects to THIS person.
- The relation: the shared program, school, mutual, field or community. This is the rapport.
- One specific, true detail about this person, said as genuine recognition. Never praise something they have not actually seen; no generic praise ("impressive", "inspiring").
- A light, specific, easy ask to connect and chat, about their advice or their story. Not "pick your brain", not a call, never a referral.
- Honesty: never imply the outreach is only for students or research when they are also job hunting. Where the angle leans on teaching, a light "and for my own next step" keeps it straight.
No sign-off; LinkedIn shows the name.

Then ONE angle, the one that fits this person best:
- AI in practice (the default, and the conversation they genuinely want): they are a recent MHCI grad teaching interaction design in this age of AI, they want to design AI products in industry, and they want this person's take on AI and how it shows up in their design work, both the AI in what their team builds and the AI in how they work. Timely, and an opinion is easy to give. For designers, researchers, PMs and engineers at product companies. Tie it to this person's team, product or work ("saw you lead design on Nvidia's gaming platform"), never a generic "thoughts on AI".
- Path: they are a few years ahead on the same road (MHCI or CMU into design or research at a company like the ones they want). Ask what they would do differently, or how they made a specific jump. Strong for alumni.
- Teaching: they teach interaction design at CMU and want industry perspective in general to bring to their students (and to their own next step), when AI is not the right topic for this person.
- Hiring bar: for managers, leads and recruiters. Their students (and they) are entering the market: what do they look for in junior designers right now?
- Their work: when a specific launch, talk, post or project of theirs is known from the summary or notes. One question about one decision in it.
- Congratulations: when a recent new role, promotion or launch is known. Lead with it.
And, only when true and it fits, ONE offer: a guest critique in their CMU interaction design class (senior designers, mentors, people who speak or teach); their UI for AI work on AI interaction patterns (people working on AI products); pointing strong MHCI students their way (people who hire). Most notes will have no room for one; never force it.

Craft that raises replies:
- Front-load the tie. The invitation preview shows only the first few words, so what you share comes right after the greeting, said plainly, never "Fellow X here":
  - Same program: "I just finished MHCI too" (MHCI alumni), "a CMU grad too" (CMU outside MHCI), "a UCSD cog sci alum too" (UCSD).
  - A mutual, when there is one: "We're both connected with Nicole Willis". Only say they introduced you, or that you know the mutual well, when that is true.
  - A shared past employer or field: "We both worked at Mindswarms".
  - No shared tie: lead with them instead, the specific detail first ("Your path from research into onboarding design at Figma caught my eye"), then who you are.
- The question is narrow and answerable in a line or two, ideally a this-or-that or a "which" ("has AI changed how your team designs, or mostly the tools?", "which AI tools have actually stuck on your team?"), not a broad "your take on AI".
- The detail goes past their job title when anything more is known (their path, a project, a talk); a title alone is something anyone could see.
- No stock phrases: "in the age of AI", "pick your brain", "I'd love to connect" as the whole ask, "passionate". At most one exclamation mark.

Before answering, run a premortem on each draft and rewrite until none of these is true: it could go to someone else with the names swapped; it does not say why this person; replying takes real effort; it is all take; the praise is generic or about something they have not seen; it is stiff, formal or over the limit; it reads like a copy of the recent notes listed below (their voice cues can recur; the sentences around them should not all be identical). If there is no real hook, ask for one in a single line instead of inventing it. They may give a line like "goal: … · hook: … · role: …"; use it and fill the rest from what is known below.

Give two versions with different angles, each labelled with its angle and its character count (count them yourself, and say nothing about tools), then one line on which you would send and why.${recentNotes ? `\n\nRecent notes they drafted for other people (vary from these):\n${recentNotes}` : ""}`;
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
