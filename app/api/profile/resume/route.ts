import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Your base resume: the one file every tailored copy starts from. The file lives in
 * private/uploads (never committed); its text is a Material row, resume_base, so the
 * role chat's resume advice and the Profile fill read the resume you actually send
 * rather than a pasted copy that drifted from it.
 *
 * GET is what Profile shows (name, date, size of the text read), or the file itself
 * with ?download=1. POST replaces it. One base, so there is nothing to choose between.
 */

const KIND = "resume_base";
const DIR = path.join(process.cwd(), "private", "uploads");
const run = promisify(execFile);

type Meta = { fileName: string; file: string; mime: string };

const metaOf = (notes: string | null): Meta | null => {
  try {
    const m = JSON.parse(notes ?? "");
    return m && typeof m.file === "string" ? m : null;
  } catch {
    return null;
  }
};

// macOS tools rather than a parsing library: pdftotext (poppler) for PDFs, textutil
// for Word. Layout mode keeps a resume's columns on their own lines.
async function textOf(file: string, ext: string): Promise<string> {
  const { stdout } =
    ext === ".pdf"
      ? await run("pdftotext", ["-layout", file, "-"], { maxBuffer: 8 << 20 })
      : await run("textutil", ["-convert", "txt", "-stdout", file], { maxBuffer: 8 << 20 });
  return stdout.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function GET(req: NextRequest) {
  const row = await prisma.material.findFirst({ where: { kind: KIND } });
  const meta = metaOf(row?.notes ?? null);
  if (!row || !meta) return NextResponse.json(null);
  if (req.nextUrl.searchParams.get("download")) {
    const bytes = await readFile(path.join(DIR, meta.file)).catch(() => null);
    if (!bytes) return NextResponse.json({ error: "The file is missing. Upload it again." }, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": meta.mime,
        "Content-Disposition": `inline; filename="${meta.fileName.replace(/"/g, "")}"`,
      },
    });
  }
  return NextResponse.json({
    fileName: meta.fileName,
    updatedAt: row.updatedAt,
    chars: row.content?.length ?? 0,
    text: row.content ?? "",
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF or Word file." }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  if (![".pdf", ".docx", ".doc"].includes(ext)) {
    return NextResponse.json({ error: "A resume as PDF or Word (.docx)." }, { status: 400 });
  }

  await mkdir(DIR, { recursive: true });
  const stored = `base-resume${ext}`;
  const full = path.join(DIR, stored);
  const prev = await prisma.material.findFirst({ where: { kind: KIND } });
  const prevMeta = metaOf(prev?.notes ?? null);
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  if (prevMeta && prevMeta.file !== stored) await unlink(path.join(DIR, prevMeta.file)).catch(() => {});

  // A scanned PDF has no text layer; keep the file and say so rather than fail.
  const text = await textOf(full, ext).catch(() => "");
  const meta: Meta = { fileName: file.name, file: stored, mime: file.type || "application/octet-stream" };
  const data = { title: `Base resume: ${file.name}`, content: text, notes: JSON.stringify(meta) };
  const row = prev
    ? await prisma.material.update({ where: { id: prev.id }, data })
    : await prisma.material.create({ data: { kind: KIND, ...data } });

  return NextResponse.json({ fileName: meta.fileName, updatedAt: row.updatedAt, chars: text.length, text });
}
