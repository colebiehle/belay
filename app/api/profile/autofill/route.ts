import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EDUCATION_FIELDS, SHIPPED_FIELDS, entryLine, parseEntries } from "@/lib/profile-sections";

export const dynamic = "force-dynamic";

/**
 * Your Profile, shaped for an application form: what the Send to Belay extension
 * fills in. Only facts you have written in Profile; nothing here is generated.
 * Split forms of the same fact (first and last name, title and company) are
 * derived here so the extension can match whichever a form asks for.
 */
export async function GET() {
  const rows = await prisma.answerBank.findMany({ select: { questionKey: true, answer: true } });
  const a: Record<string, string> = {};
  for (const r of rows) if (r.answer?.trim()) a[r.questionKey] = r.answer.trim();

  // First and last are the first and last words; anything between is a middle name
  // ("Thomas Cole Biehle" is Thomas, Cole, Biehle), so a middle name never lands in
  // the last-name field.
  const words = (a.full_name ?? "").split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1] : "";
  const middle = words.slice(1, -1).join(" ");
  const role = a.current_role ?? "";
  const [title, company] = role.includes(",")
    ? role.split(/,\s*(.+)/)
    : role.split(/\s+at\s+(.+)/i);

  // Education is a list, most recent first; forms ask for one school at a time, so
  // they get the first. The lists also go out as plain lines, not their JSON.
  const edu = parseEntries(a.education);
  const latest = edu[0] ?? {};
  const shipped = parseEntries(a.shipped_work);

  return NextResponse.json({
    ...a,
    education: edu.map((e) => entryLine(EDUCATION_FIELDS, e)).join("\n"),
    edu_school: latest.school ?? "",
    edu_degree: latest.degree ?? "",
    edu_grad_date: latest.date ?? "",
    gpa: latest.gpa ?? "",
    shipped_work: shipped.map((e) => entryLine(SHIPPED_FIELDS, e)).join("\n"),
    first_name: first,
    middle_name: middle,
    last_name: last,
    // What you go by, for "Preferred name" fields; your first name when not set.
    preferred_name: a.preferred_name || first,
    current_title: (title ?? "").trim(),
    current_company: (company ?? "").trim(),
  });
}
