import { NextRequest, NextResponse } from "next/server";
import { callClaudeDetailed } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { understandingBlock } from "@/lib/foundation";
import { logJournal } from "@/lib/journal";
import { identityLine } from "@/lib/identity";

// GET ?cellKey=resume|coverLetter|qa#N returns the cell-scoped thread;
// without it returns the whole-application thread (cellKey=null).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const qs = new URL(req.url).searchParams;
    const cellKey = qs.get("cellKey");
    // ?all=1 returns the whole conversation regardless of scope. The role panel
    // uses it: the scope shapes the prompt for a message but no longer forks the
    // transcript, because a scratchpad that splits into six threads loses the
    // through-line of working one application.
    const where = qs.get("all")
      ? { applicationId: id }
      : cellKey
        ? { applicationId: id, cellKey }
        : { applicationId: id, cellKey: null };
    const messages = await prisma.chatMessage.findMany({ where, orderBy: { createdAt: "asc" } });
    return NextResponse.json(messages);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const who = await identityLine();
  const { id } = await params;
  const body = await req.json();
  const content: string = body.content;
  // cellKey: "resume" | "coverLetter" | "qa#<index>" — scopes chat to one cell.
  const cellKey: string | null = typeof body.cellKey === "string" && body.cellKey.trim()
    ? body.cellKey.trim()
    : null;
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const app = await prisma.application.findUnique({
    where: { id },
    include: { job: true },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Persist the user's message immediately, scoped to the cell if applicable.
  const userMsg = await prisma.chatMessage.create({
    data: { applicationId: id, role: "user", content, cellKey },
  });

  // The whole conversation, always. The panel shows one transcript, and scoping
  // the history to cellKey meant the model was handed a fragment of what you
  // could see — verified live: you told it a hiring manager's name with no scope
  // set, switched to the resume scope, asked what you had just said, and was told
  // the message had not saved. The scope is a task, not a partition.
  const history = (await prisma.chatMessage.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "desc" },
    take: 40,
  })).reverse();

  // A digest of "other threads" used to be assembled here to compensate for the
  // scoped history above. It never worked: the filter was NOT { cellKey }, and in
  // SQL `NOT (cellKey = 'resume')` evaluates to NULL for rows where cellKey IS
  // NULL, so every unscoped turn was dropped. Verified: the query matched 0 of 82
  // rows. With one unscoped history there is nothing left for it to do.
  const otherChatsDigest = "";

  const stageHistory: { status: string; at: string }[] = (() => {
    if (!app.statusHistory) return [];
    try { return JSON.parse(app.statusHistory); } catch { return []; }
  })();

  const stageTimeline = stageHistory.length > 0
    ? stageHistory.map(h => `  - ${h.status} on ${new Date(h.at).toISOString().slice(0, 10)}`).join("\n")
    : "  (no history)";

  const transcript = history
    .map(m => `${m.role === "user" ? "User" : "Claude"}: ${m.content}`)
    .join("\n\n");

  const understanding = await understandingBlock(1000);

  // Resolve the cell content if cellKey is set. Q&A cells encode the index as
  // "qa#<n>" — pull the specific item from applicationQA JSON.
  let cellLabel = "";
  let cellContent = "";
  let cellGuidance = "";

  // The people you know at this company, for the scopes where they matter (prep,
  // outreach): who they are, how close, and what you have noted. Outreach used to
  // assume you knew no one, and prep never heard of the person who referred you.
  const peopleHere = async (): Promise<string> => {
    const company = app.job.company.trim();
    if (!company) return "";
    const people = await prisma.contact.findMany({
      where: { company: { equals: company } },
      select: { name: true, title: true, role: true, warmth: true, stage: true, profileText: true, notes: true },
      take: 12,
    });
    if (!people.length) return "";
    return `People they know at ${company}:\n${people
      .map((p) =>
        `- ${p.name}${p.title || p.role ? `, ${p.title || p.role}` : ""}${p.warmth ? ` (${p.warmth})` : ""}${p.stage ? `, ${p.stage}` : ""}` +
        (p.profileText ? `\n  ${p.profileText.slice(0, 400)}` : "") +
        (p.notes ? `\n  Their note: ${p.notes.slice(0, 300)}` : ""),
      )
      .join("\n")}`;
  };
  if (cellKey === "resume") {
    // Against the BASE resume, not the tailored copy. you keeps the real document
    // outside this app and edits it there, so the useful output is "change these
    // lines", not a rewritten resume in a side panel you then has to reconcile.
    cellLabel = "Resume, against their base";
    const resumeMaterials = await prisma.material.findMany({
      where: { kind: { startsWith: "resume_" } },
      orderBy: { position: "asc" },
    });
    cellContent = resumeMaterials
      .filter((m) => !m.kind.startsWith("zz_archive") && m.kind !== "resume_source")
      // The facts bank is long and is the thing that decides whether a claim is
      // safe to make, so it gets far more room than a single resume section.
      .map((m) => `[${m.kind}] ${m.title}\n${(m.content ?? "").slice(0, m.kind === "resume_facts" ? 20000 : 1200)}`)
      .join("\n\n");
    cellGuidance =
      "Give specific, applicable changes to the base resume for THIS role. Quote the existing line and give the replacement. Do not output a whole rewritten resume — they edits the real document themselves and then attaches the version they sent. Say plainly when a line should be left alone. If a claim would not survive scrutiny (dates that do not add up, a number they cannot support), say so.";
  } else if (cellKey === "questions") {
    cellLabel = "A short-answer question on the form";
    cellContent = "";
    cellGuidance =
      "They will paste the question as the form words it, then brain-dump rough thoughts. Your job is to turn that into an answer in their voice: concrete, specific to this role, no filler, no em-dashes, no AI phrasing. Ask for the word or character limit if they have not said it. Work from what they actually told you rather than inventing achievements.";
  } else if (cellKey === "outreach") {
    cellLabel = "Outreach for this application";
    cellContent = await peopleHere();
    cellGuidance =
      "Help them decide who to reach at this company and what to send. A weak referral still beats a cold application, so the bar for reaching out is lower than it feels. Keep drafts short and forwardable. Start from the people they already know there, if any are listed above; otherwise say what to search for as well as what to write.";
  } else if (cellKey === "portfolio") {
    cellLabel = "Which portfolio work to lead with";
    const projects = await prisma.material.findMany({
      where: { kind: { in: ["resume_projects", "resume_experience", "positioning"] } },
    });
    cellContent = projects.map((m) => `[${m.kind}] ${m.title}\n${(m.content ?? "").slice(0, 900)}`).join("\n\n");
    cellGuidance =
      "Say which of their projects to lead with for THIS role and why, in their order of strength. Name the specific work rather than describing a category. If a project is a weak fit, say so instead of finding a way to make it sound relevant. Do not invent projects or outcomes that are not in the material above.";
  } else if (cellKey === "research") {
    cellLabel = "Understanding this company and team";
    cellContent = "";
    cellGuidance =
      "Help them understand what this team actually builds and what a designer there would be expected to know. Work from the job description above. Where you are reasoning from general knowledge rather than the posting, say which. Do not invent recent company news.";
  } else if (cellKey === "debrief") {
    cellLabel = "Debriefing an interview";
    cellContent = "";
    cellGuidance =
      "They will describe what happened. Help them separate what went well from what to fix, decide whether to send anything, and draft it if so. Be direct about a bad sign rather than reassuring.";
  } else if (cellKey === "offer") {
    cellLabel = "Reading an offer";
    cellContent = "";
    cellGuidance =
      "Help them read the numbers and decide what to ask for. If they have a reference point on file, anchor to it; otherwise ask what they are comparing against rather than guessing. Comp comparisons across companies are unreliable because rungs hold different experience cohorts, so be careful with any benchmark you offer and say where it is soft.";
  } else if (cellKey === "followup") {
    cellLabel = "Following up";
    cellContent = "";
    cellGuidance =
      "Short, specific, no grovelling and no filler. Say plainly when following up is not worth it yet, and how long to wait.";
  } else if (cellKey === "prep") {
    cellLabel = "Interview prep for this role";
    // The interviews on file, so "prep me for Thursday" knows what Thursday is.
    const interviews = (() => {
      try {
        const v = JSON.parse(app.interviewList ?? "[]") as { label?: string; at?: string }[];
        return Array.isArray(v) ? v.filter((iv) => iv.at) : [];
      } catch {
        return [];
      }
    })();
    cellContent = [
      interviews.length
        ? `Interviews on file:\n${interviews
            .map((iv) => `- ${new Date(iv.at!).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${iv.label ? `: ${iv.label}` : ""}${new Date(iv.at!).getTime() < Date.now() ? " (past)" : ""}`)
            .join("\n")}`
        : "",
      await peopleHere(),
      app.interviewPrep ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
    cellGuidance =
      "Help them prepare for an actual interview at this company. Practise questions, portfolio framing, what this team will probe on. Use the job description, the interview on file (its label often names the round or the interviewer) and their own background rather than generic advice. If they know people there, say what to ask them before the interview. When they ask for a brief, give one they can save as a note: the round, what it tests, 5 to 8 likely questions with the story to answer each from their background, and 3 questions to ask.";
  } else if (cellKey === "coverLetter") {
    cellLabel = "Tailored cover letter";
    cellContent = app.coverLetterContent ?? "";
  } else if (cellKey?.startsWith("qa#")) {
    const idx = Number(cellKey.slice(3));
    if (Number.isInteger(idx) && app.applicationQA) {
      try {
        const items = JSON.parse(app.applicationQA) as { question: string; answer: string }[];
        const item = items[idx];
        if (item) {
          cellLabel = `Q&A: ${item.question.slice(0, 80)}`;
          cellContent = `Q: ${item.question}\nA: ${item.answer}`;
        }
      } catch { /* ignore */ }
    }
  }

  const systemContext = cellKey
    ? `You are helping ${who} refine ONE specific application cell. Be concise, direct, and practical. No em-dashes. No AI clichés.

NEVER claim to have checked a file, document or source that is not reproduced above. If you want to say a claim is verified, it has to be verified against text you were actually given in this prompt. Saying "I checked this against their resume" when that content is not in front of you is a fabrication, and it is worse than useless here because they will trust it.

They have set the context to one kind of work, described below. Help with that. They can see the whole conversation, and so can you, so refer back to it freely — the context setting narrows the task, not what you know.

NEVER claim to have checked a file, document or source that is not reproduced above. If you want to say a claim is verified, it has to be verified against text you were actually given in this prompt. Saying "I checked this against their resume" when that content is not in front of you is a fabrication, and it is worse than useless here because they will trust it.

${understanding ? `their accumulated taste signals (durable preferences — let these guide refinement):\n${understanding}\n\n` : ""}Application: ${app.job.company} — ${app.job.roleTitle}
Status: ${app.status} · Fit: ${app.job.fitScore || "(unscored)"}/10
Job URL: ${app.job.jobUrl}

Job description excerpt:
${(app.job.description || "(none)").slice(0, 2000)}

THIS CELL: ${cellLabel || cellKey}
${cellContent || "(empty)"}

Conversation so far on this application:
${transcript || "(nothing yet)"}

${cellGuidance ? `How to help with this scope:\n${cellGuidance}\n\n` : ""}Reply directly to their latest message. Be brief — they are working, not reading. When suggesting edits, quote the line you'd change and propose the replacement. `
    : `You are an assistant helping ${who} manage a specific job application.${understanding ? `\n\nTheir accumulated taste signals:\n${understanding}\n` : ""} Be concise, direct, and practical. No em-dashes. No AI clichés.

No particular context is set, so this is general: stage strategy, outreach decisions, scheduling, anything about the role. They can set a context in the panel when they want help with a specific recurring task.

Application context:
- Company: ${app.job.company}
- Role: ${app.job.roleTitle}
- Location: ${app.job.location || "(not specified)"}
- Compensation: ${app.job.compRange || "(not specified)"}
- Fit score: ${app.job.fitScore || "(unscored)"}/10
- Status: ${app.status}
- Stage timeline:
${stageTimeline}
- Tailored resume URL: ${app.resumeTailored || "(blank)"}
- Cover letter URL: ${app.coverLetterUrl || "(blank)"}
- Recruiter message draft: ${app.recruiterMessage || "(blank)"}
- Job posting URL: ${app.job.jobUrl}

Job description excerpt:
${(app.job.description || "(none)").slice(0, 2000)}

Conversation so far on this application:
${transcript || "(nothing yet)"}

Reply directly to their latest message. Be helpful and specific to this role and stage. `;

  const { text: raw, timedOut } = await callClaudeDetailed(systemContext);
  // A failed call used to be stored as if Claude had said it. Two rows in the live
  // table are assistant messages reading "You've hit your session limit · resets
  // 6pm" — an error surfaced as an answer, and then kept forever as history. A
  // failure now returns an error to the client and writes nothing, so the
  // transcript only ever holds things that were actually said.
  const reply = raw.trim();
  const looksLikeFailure =
    timedOut ||
    !reply ||
    /^you've hit your (session|usage) limit/i.test(reply) ||
    /^(error|claude:? error)\b/i.test(reply);
  if (looksLikeFailure) {
    // The user's own message stays — it is theirs and they may want to resend.
    return NextResponse.json(
      {
        error: timedOut
          ? "That timed out before Claude answered. Your message is saved; send again."
          : reply || "Claude returned nothing. Your message is saved; send again.",
        userMessageId: userMsg.id,
      },
      { status: 502 },
    );
  }

  const assistantMsg = await prisma.chatMessage.create({
    data: { applicationId: id, role: "assistant", content: reply, cellKey },
  });

  await logJournal({
    type: "ai_run",
    surface: cellKey ? `applications/chat-cell/${cellKey}` : "applications/chat",
    summary: cellKey
      ? `Cell chat (${app.job.company} ${cellKey}): ${content.slice(0, 60)}`
      : `App chat (${app.job.company} — ${app.job.roleTitle}): ${content.slice(0, 80)}`,
    refs: { applicationId: id },
  });

  return NextResponse.json({ user: userMsg, assistant: assistantMsg });
}

/**
 * Clear the scratchpad. The chat is working material — your read is that you
 * would never keep a whole conversation, only what you pulled out of it into a
 * note — so a long transcript sitting there forever is clutter rather than
 * history. Notes are a separate column and are untouched by this.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { count } = await prisma.chatMessage.deleteMany({ where: { applicationId: id } });
  return NextResponse.json({ ok: true, deleted: count });
}
