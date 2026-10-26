import { NextRequest, NextResponse } from "next/server";
import { callClaudeDetailed } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { understandingBlock, contextBlock, FOUNDATION_KINDS } from "@/lib/foundation";
import { logJournal } from "@/lib/journal";
import { CONNECT_NOTE_LIMIT } from "@/lib/contact-stages";
import { identityLine } from "@/lib/identity";
import { buildNote, firstName, openerFor } from "@/lib/connect-template";

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

const VOICE = `Write the way they write: direct, specific, no em-dashes, no AI phrasing, no "I hope this finds you well", no "I'd love to pick your brain". Never invent a shared detail, a mutual interest, or a fact about their background. What they tell you about the person is not invented: they can see the person's full profile and you cannot, so it outranks the summary below.`;

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

  // The opener follows the person's group (lib/connect-template), as batch drafting does.
  const group = openerFor(relTags, `${contact.title ?? ""} ${contact.role ?? ""} ${contact.howMet ?? ""} ${contact.profileText ?? ""}`);
  // MHCI alumni get the journey note (settled with the owner Oct 25 2026); everyone
  // else keeps the earlier template until theirs is revisited.
  const mhci = group === "mhci" || group === "ucsd_mhci";
  const templateLine = buildNote({
    firstName: firstName(contact.name),
    group,
    kind: "standard",
    who: "{who}",
    focus: "{focus}",
    aside: "{aside}",
  });
  const first = firstName(contact.name);
  // The MHCI note (settled with the owner Oct 26 2026). The opening and the ask are
  // fixed; the middle sentence is written per person to a job, not filled in:
  // what is interesting about their career, said in plain words, then why and what
  // carried over. Company names and titles read as keywords, and keywords read as AI.
  const journeyRules = `The note:
"Hi ${first}! I'm a recent MHCI grad, currently teaching interaction design at CMU. I saw you {their path, in plain words}, and I'd love to hear {why} and {what carried over}. Would you be open to a 15-minute chat?"

The first sentence and the ask are word for word. The middle sentence is written for this person. Examples the user approved:
"I saw you started in HCI and moved into more data integration work, and I'd love to hear why you made that shift and what from HCI actually carried over."
"I saw you started out at startups and are now at a much bigger company, and I'd love to hear why you made that jump and what from startup life carried over."
"I saw you've stuck with financial products through most of your career, and I'd love to hear what keeps you in that space and how the work has changed over time."
"I saw you've spent about ten years designing for space missions, and I'd love to hear what's kept you there and what designing for that kind of work is really like."

How to write it:
1. Start with "I saw you" (or "I noticed you"), straight into the interesting thing. Never a lead-in like "caught my eye" or "your path from".
2. The interesting thing is what the user called out in their notes or this chat. With nothing from them, the most notable thing in the profile: a move (engineering to design), staying somewhere a long time, a through-line (always financial products), moving into an area, an unusual background (psychology to design).
3. Say it in plain, everyday words, as someone who understood their profile would say it to them. No company names, program names or exact job titles ("a much bigger company", not "DoorDash"; "data integration work", not "Lead, Artemis Data Integration"), unless the name itself is the point. Keywords pulled from a profile read as a template or as AI.
4. Then why: why they made the shift, or what keeps them there.
5. Then the part that would help the user: what carried over, what they still lean on, how it shows up in their work now, or what the work is really like. Rotate these so notes do not share one phrase.
   Best of all, when you can see it: a real connection between where they were and what they focus on now, which shows the user understood their path rather than read it. The user loved this one: "I'd love to hear why you chose a bigger company and how the startup pace set you up for your growth work there" (startups and growth are both about fast experiments and moving numbers). Other real links: engineering and design systems, research and product strategy, psychology and behavior design, teaching and onboarding. Only when both ends are known (from their notes or the profile) and the link is one most designers would recognize. A stretched connection is worse than none; then use the plain version.
6. Never MHCI as the thing they moved from; the opening already says it. "Since the program" is fine when their career starts there.

Optional, only when it fits: the user's own reason, only when they gave one (never invent it): "and since I'm hoping to make a similar move, I'd love to hear…".

The out-loud test: would the user say this sentence, word for word, to this person over coffee? If not, rewrite it. Never: "kept you growing", "shaped your perspective", "your journey" on its own, "leverage", "impact", "passionate", "caught my eye". No slang, no flattery, never "fellow" or "we're both". Mention AI only when their work is about AI.

Never a parenthetical aside like "(so cool!)": the user does not want them. Over the limit: drop the user's reason, then shorten the path.
- What the user tells you about this person (in their notes or in this chat) is fact: they are looking at the full LinkedIn profile, and the summary below is a short, partial lookup. Use it as given, even when the summary does not mention it, and never push back because the summary leaves it out. Only ask when what they said is unclear, not when it is unconfirmed.
- With nothing from the user and nothing notable in the profile (a title and a company, little else), ask them for one detail from their LinkedIn instead of writing something generic. Otherwise, when you chose the interesting thing yourself, say in one line under the drafts what you based it on.`;
  let task = "";
  switch (scope) {
    case "connect":
      if (mhci) {
        task = `Draft their outreach message. ${CONNECT_NOTE_LIMIT} characters at most including spaces. The same wording goes out as a LinkedIn note or, reformatted automatically (subject, greeting, thank-you and sign-off added), as an email, so draft only the note and never an email version.

${journeyRules}

Before answering, check: under the limit; the middle sentence is true, specific to this person and in plain words; the fixed wording is unchanged; it reads naturally out loud, like a person wrote it.

Think before drafting, and show it briefly. The template is only the frame; what makes a note land is understanding what the user noticed and why it matters, then finding the connection a thoughtful person would see. Read their points for what they are really getting at (a note like "startups to DoorDash, similar to what I want" is about choosing a bigger company, and about whether startup experience transfers), then look across everything known about this person: where they started, the moves they made, how long they stayed, what they focus on now, and what the user is weighing in their own search.

Start the reply with "Angles:" and two to four of them, one line each: something interesting about this person and, where there is one, the connection that makes it insightful (for example: "Startups to growth design: both are about fast experiments, so the startup years may be exactly what prepared her"). Mark the one you think is strongest. No angle that rests on a guess about them; a connection has to follow from what is known.

Then give two drafts from the two strongest angles, each with its character count (count them yourself, and say nothing about tools), then one line on which you would send and why. Put the one you would send, on its own, between two lines of three dashes (---) so they can save it with one click.
${contact.connectionNote ? `
Their current drafted note for this person:
"${contact.connectionNote}"
If it follows this template and they ask for a change, revise it in place: keep their wording, work the change in, stay under the limit, and give just the revised note between two lines of three dashes (---) with its character count and one line on what changed. If it is an older note that does not follow this template, ignore it and draft fresh.` : ""}`;
        break;
      }
      // The owner's own note (settled Oct 23 2026). The fixed part is theirs word for
      // word; only who they are, their focus and an optional aside change.
      task = `Draft a LinkedIn connection note from their template. ${CONNECT_NOTE_LIMIT} characters at most including spaces.

The template for this person (their group decides the opener), word for word. Only {who}, {focus} and {aside} change:
"${templateLine}"

- {who}: their role at their company, at their real level: "a designer at Figma", "a PM at Google Health", "a design leader at Stripe", "Figma's head of design". Never undersell a senior person as "a designer".
- {focus}: what they work on, two to five words ("onboarding", "patient care", "design systems"). Only when it is clear from what is below; otherwise drop ", especially in your work on {focus}" and say in one line under the drafts that you left it out, so they can add one. A vague or wrong focus is worse than none.
- {aside}: a short parenthetical about something real they did or lead (a launch, a talk, a project) when it is named below ("the Make launch looked great"). Otherwise drop " ({aside})". Never claim to have seen something that is not below.

Engineers: "…hear how {who} is actually using AI alongside designers, especially in your work on {focus}!"

Recruiters and talent people (in-house), a different note: the same opener, then ", and I'm exploring product design roles, especially in AI tools. I saw you recruit at {company} and would love to connect and be on your radar if anything fits. Happy to share my portfolio!" ("recruit for design" when they recruit for design).

Do not mention a mutual; LinkedIn shows it. The one exception: when their notes say the mutual suggested reaching out, start with "{mutual} suggested I reach out!" after the greeting.

Over the limit? Cut the aside first, then the focus.

Before answering, check each draft: it is under the limit; who, focus and aside are true and specific to this person; nothing else in the template has been reworded.

Give two drafts (with different focus or aside choices where there is room), each with its character count (count them yourself, and say nothing about tools), then one line on which you would send and why. Put the one you would send, on its own, between two lines of three dashes (---) so they can save it with one click.
${contact.connectionNote ? `
Their current drafted note for this person:
"${contact.connectionNote}"
If they ask to change it or tell you something to include (a detail from their profile, a shared experience), revise that note rather than starting over: work the new detail in naturally, keep the rest of their wording unless they ask otherwise, stay under the limit, and give just the revised note between two lines of three dashes (---) with its character count and one line on what changed.` : ""}`;
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

${contact.profileText ? `Who this person is (a summary from their profile or a web lookup, possibly older than the company and title above: where they disagree, the company and title above are current):\n${contact.profileText.slice(0, 4000)}\n` : "There is no summary of this person yet. You cannot look them up yourself. Ask for one detail if the draft needs something specific about them.\n"}
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
