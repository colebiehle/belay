import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { SECTIONS, qid } from "@/lib/profile-sections";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * "Fill from a resume or LinkedIn" on the Profile page: paste either, and get draft
 * answers for the questions that are still blank. It PROPOSES; the page shows each
 * one and saves only what you keep (PasteAnything).
 *
 * Blank questions only, so nothing you wrote is ever offered a replacement, and
 * never the ones marked noFill (eligibility, pay, disclosure, passwords): those are
 * yours to state. Facts from the paste only; the story questions are drafted in the
 * first person from what it says, for you to rewrite in your own voice.
 */

const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s*[—–]\s*/g, ", ").replace(/[ \t]+\n/g, "\n").trim() : "";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Paste a resume or a LinkedIn profile first." }, { status: 400 });

  const [answers, cells] = await Promise.all([
    prisma.answerBank.findMany({ select: { questionKey: true, answer: true } }),
    prisma.material.findMany({ select: { kind: true, content: true } }),
  ]);
  const filled = new Set([
    ...answers.filter((a) => a.answer?.trim()).map((a) => `answer:${a.questionKey}`),
    ...cells.filter((c) => c.content?.trim()).map((c) => `cell:${c.kind}`),
  ]);
  const open = SECTIONS.flatMap((s) => s.questions).filter((q) => !q.noFill && !filled.has(qid(q)));
  if (!open.length) return NextResponse.json({ updates: {}, note: null });

  const prompt = `Someone pasted their resume or LinkedIn profile into the profile page of their job-search tool. Draft answers to the questions below that are still blank, from the paste only.

The questions, as id: label (what to put):
${open.map((q) => `- ${qid(q)}: ${q.label}${q.hint ? ` (${q.hint})` : ""}`).join("\n")}

The paste:
"""
${text.slice(0, 20000)}
"""

Return ONLY valid JSON, no preamble, no code fences: an object from question id to answer, with only the questions the paste actually answers.

{ "answer:full_name": "...", "cell:positioning": "..." }

Rules:
- Facts from the paste only. Never invent a role, an employer, a number, a skill or a preference. Leave a question out rather than guess; most of "what you're looking for" will not be in a resume, and that is fine.
- Short facts (name, location, links, years) exactly as the paste has them. Years of experience is a number, counted from the paste's dates.
- The longer ones (positioning, career arc, proudest work) in the first person, plain and specific, two to four sentences, as a first draft they will rewrite. No marketing language, no em dashes.`;

  const { text: raw, timedOut } = await callClaudeDetailed(prompt, 150_000);
  const parsed = extractJson<Record<string, unknown>>(raw, "object");
  if (!parsed) {
    return NextResponse.json(
      { error: timedOut ? "That timed out. Try again." : "Could not read that. Try again." },
      { status: 502 },
    );
  }
  const allowed = new Set(open.map(qid));
  const updates: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const value = clean(v);
    if (allowed.has(k) && value) updates[k] = value;
  }
  return NextResponse.json({ updates, note: null });
}
