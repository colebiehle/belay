import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * The answer bank: the questions every application form asks, answered once.
 *
 * The AnswerBank table existed and held zero rows, so the Applying checklist
 * could tell you a form would ask about work authorization without giving you
 * anywhere to keep the answer. Every application meant retyping the same dozen
 * facts from memory, which is both slow and how inconsistencies get into
 * submitted forms.
 *
 * Seeded with the questions, not the answers. Nothing is pre-filled — the rest arrive blank on purpose, because a
 * guessed answer to "do you require sponsorship" is worse than an empty one.
 */

type Seed = {
  questionKey: string;
  question: string;
  answer: string;
  tags: string;
};


export async function GET() {
  // The question list is seeded by scripts/seed.ts, not from here. It used to live
  // in this route as a literal with real answers already filled in, which meant a
  // fresh install came up wearing somebody else's portfolio URL.
  const answers = await prisma.answerBank.findMany({
    orderBy: [{ useCount: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(answers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const answer = await prisma.answerBank.create({
    data: {
      questionKey: body.questionKey || `custom_${Date.now()}`,
      question: body.question || "Untitled question",
      answer: body.answer || "",
      tags: body.tags || "custom",
    },
  });
  return NextResponse.json(answer, { status: 201 });
}
