import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The write-in questions on an application form, between the extension and the
 * role in Belay. POST { url, title, questions } files them on the matching role's
 * applicationQA (new ones appended, existing ones kept with their answers). GET
 * ?url= returns that role's saved answers, for the extension to put into the form.
 *
 * The role is matched by the page's address against the posting's or the form
 * link's (same host and path, or one inside the other), then by a company name in
 * the page title among roles you are applying to.
 */

type QA = { question: string; answer: string };

const norm = (u: string) => {
  try {
    const x = new URL(u);
    return (x.host.replace(/^www\./, "") + x.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
};
const key = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function findApplication(url: string, title: string) {
  const apps = await prisma.application.findMany({
    where: { archivedAt: null },
    select: { id: true, status: true, portalUrl: true, applicationQA: true, job: { select: { company: true, roleTitle: true, jobUrl: true } } },
  });
  const page = norm(url);
  const byUrl = apps.find((a) =>
    [a.job.jobUrl, a.portalUrl].some((u) => {
      const n = u ? norm(u) : "";
      return n && page && (n === page || page.startsWith(n) || n.startsWith(page));
    }),
  );
  if (byUrl) return byUrl;
  const t = (title || "").toLowerCase();
  const open = apps.filter((a) => ["Applying", "Applied"].includes(a.status));
  return open.find((a) => a.job.company && t.includes(a.job.company.toLowerCase())) ?? null;
}

const parseQA = (raw: string | null): QA[] => {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.question === "string") : [];
  } catch {
    return [];
  }
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const questions: string[] = Array.isArray(body.questions) ? body.questions.filter((q: unknown) => typeof q === "string" && q.trim()) : [];
  const app = await findApplication(String(body.url ?? ""), String(body.title ?? ""));
  if (!app) {
    return NextResponse.json({ error: "No matching role in Belay. Accept the role (or add it by URL) first." }, { status: 404 });
  }
  const qa = parseQA(app.applicationQA);
  const have = new Set(qa.map((q) => key(q.question)));
  for (const q of questions) if (!have.has(key(q))) qa.push({ question: q.trim().slice(0, 600), answer: "" });
  await prisma.application.update({ where: { id: app.id }, data: { applicationQA: JSON.stringify(qa) } });
  return NextResponse.json({ appId: app.id, company: app.job.company, roleTitle: app.job.roleTitle, count: qa.length });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const title = req.nextUrl.searchParams.get("title") ?? "";
  const app = await findApplication(url, title);
  if (!app) return NextResponse.json({ answers: [] });
  return NextResponse.json({ appId: app.id, answers: parseQA(app.applicationQA).filter((q) => q.answer.trim()) });
}
