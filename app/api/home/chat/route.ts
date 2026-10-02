import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { understandingBlock } from "@/lib/foundation";
import { journalBlock, logJournal } from "@/lib/journal";
import { identityLine } from "@/lib/identity";

// Home page chat — the "what should I focus on today?" assistant. It reads the
// brain, the recent journal, and the current state of the funnel (active apps,
// pending queue items, contact pipeline) so its suggestions are grounded in
// what's actually happening this week — not generic advice.

export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    where: { scope: "home" },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const userMsg = await prisma.chatMessage.create({
    data: { scope: "home", role: "user", content },
  });

  // Snapshot of the funnel + activity so Claude can answer "what should I do today?"
  // without asking back.
  const [
    understanding,
    journal,
    activeApps,
    overdueFollowUps,
    contactsAdded14d,
    recentJobsCount,
  ] = await Promise.all([
    understandingBlock(1200),
    journalBlock(40, 2500),
    prisma.application.findMany({
      where: { archivedAt: null },
      include: { job: { select: { company: true, roleTitle: true, fitScore: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    // Apps in stages where the user typically follows up after N days. Simple
    // heuristic: any non-terminal status not touched in 7+ days.
    prisma.application.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ["Offer", "Rejected", "Withdrawn"] },
        updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: { job: { select: { company: true, roleTitle: true } } },
      orderBy: { updatedAt: "asc" },
      take: 10,
    }),
    prisma.contact.count({
      where: { dateAdded: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.job.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const appsBlock = activeApps.length > 0
    ? activeApps.map((a) => `  - ${a.job.company} (${a.job.roleTitle}) — ${a.status} [fit ${a.job.fitScore}/10]`).join("\n")
    : "  (no active applications)";
  const followUpsBlock = overdueFollowUps.length > 0
    ? overdueFollowUps.map((a) => {
        const days = Math.floor((Date.now() - a.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
        return `  - ${a.job.company} (${a.job.roleTitle}) — ${a.status}, untouched ${days}d`;
      }).join("\n")
    : "  (nothing waiting on a follow-up)";

  const history = (await prisma.chatMessage.findMany({
    where: { scope: "home" },
    orderBy: { createdAt: "desc" },
    take: 30,
  })).reverse();
  const transcript = history
    .map((m) => `${m.role === "user" ? "they" : "Claude"}: ${m.content}`)
    .join("\n\n");

  const who = await identityLine();
  const prompt = `You are the Home-page assistant for ${who}. Your job is to help them decide what to focus on TODAY based on the current state of their job search. Be concise, direct, and practical. No em-dashes. No AI clichés.

This is the WHOLE-SYSTEM operations chat — used for prioritization, "what's the highest-leverage move", and "how am I doing this week". For deep refinement of materials, direct them to the Profile (Studio) page; for specific roles, direct them to that role's page.

${understanding ? `their accumulated taste signals (durable preferences):\n${understanding}\n\n` : ""}Current state of the funnel:
Active applications:
${appsBlock}

Overdue follow-ups (no activity in 7+ days):
${followUpsBlock}

Activity this period:
  - New contacts added last 14 days: ${contactsAdded14d}
  - New jobs ingested last 7 days: ${recentJobsCount}

${journal ? `Recent journal (chronological — what's actually been happening):\n${journal}\n\n` : ""}Conversation so far:
${transcript || "(no prior messages)"}

Reply directly to their latest message. Be specific — cite actual companies, actual queue counts, actual stale apps. When recommending "do X today", pick the move with highest leverage given their current state.`;

  const raw = await callClaude(prompt);
  const reply = raw.trim() || "(no reply)";

  const assistantMsg = await prisma.chatMessage.create({
    data: { scope: "home", role: "assistant", content: reply },
  });

  await logJournal({
    type: "ai_run",
    surface: "home/chat",
    summary: `Home chat turn: ${content.slice(0, 100)}`,
  });

  return NextResponse.json({ user: userMsg, assistant: assistantMsg });
}
