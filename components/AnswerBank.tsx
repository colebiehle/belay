"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Copy, Trash2 } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { PasteAnything, type PasteRow } from "@/components/PasteAnything";
import { card, iconButton, textarea } from "@/lib/ui";
import { KNOWN_ANSWER_KEYS, SECTIONS, qid, type Question, type Section } from "@/lib/profile-sections";

type Answer = {
  id: string;
  questionKey: string;
  question: string;
  answer: string;
  tags: string | null;
  useCount: number;
  lastUsedAt: string | null;
};

type Cell = { id: string; kind: string; title: string | null; content: string | null };

// What the tool has distilled from your accepts and passes. Shown read-only, so the
// understanding every prompt reads is not invisible; it is rewritten by the brain,
// not by hand.
const LEARNED: { kind: string; label: string }[] = [
  { kind: "understanding_taste", label: "Taste" },
  { kind: "understanding_strengths", label: "Strengths" },
  { kind: "understanding_gaps", label: "Gaps" },
  { kind: "understanding_themes", label: "Themes" },
];

/**
 * The Profile: what Belay knows about you, in sections by what each part is for
 * (lib/profile-sections). Each section says what it feeds and how much of it is
 * filled; the rail beside it is the table of contents with the same counts, so the
 * page answers "where do I start" at a glance. A new profile starts from a paste:
 * a resume or LinkedIn profile drafts the blank answers for review.
 */
export function AnswerBank() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [openLearned, setOpenLearned] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/answers")
      .then((r) => r.json())
      .then((d: Answer[]) => setAnswers(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/materials")
      .then((r) => r.json())
      .then((d: Cell[]) => setCells(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const answerOf = (key: string) => answers.find((a) => a.questionKey === key);
  const stored = (q: Pick<Question, "store" | "key">): string =>
    (q.store === "cell" ? cells.find((c) => c.kind === q.key)?.content : answerOf(q.key)?.answer) ?? "";
  const valueOf = (q: Pick<Question, "store" | "key">): string => drafts[qid(q)] ?? stored(q);

  // Anything the bank holds that no section names: a question a form asked that was
  // added by hand. Kept, in a section of its own at the end.
  const custom: Section | null = (() => {
    const extra = answers.filter((a) => !KNOWN_ANSWER_KEYS.has(a.questionKey));
    if (!extra.length) return null;
    return {
      id: "yours",
      title: "Yours",
      usedFor: "Anything a form asked for that was not already here.",
      questions: extra.map((a) => ({ store: "answer" as const, key: a.questionKey, label: a.question, long: true })),
    };
  })();
  const sections = custom ? [...SECTIONS, custom] : SECTIONS;
  const countOf = (s: Section) => s.questions.filter((q) => valueOf(q).trim()).length;
  const total = sections.reduce((n, s) => n + s.questions.length, 0);
  const done = sections.reduce((n, s) => n + countOf(s), 0);

  // Written to whichever table the question lives in. Saved on blur, not per
  // keystroke: these are paragraphs.
  const write = async (q: Pick<Question, "store" | "key" | "label">, value: string) => {
    if (q.store === "cell") {
      const row = cells.find((c) => c.kind === q.key);
      if (row) {
        setCells((prev) => prev.map((c) => (c.id === row.id ? { ...c, content: value } : c)));
        await fetch(`/api/materials/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: value }),
        });
      } else {
        const made: Cell = await fetch("/api/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: q.key, content: value }),
        }).then((r) => r.json());
        setCells((prev) => [...prev, made]);
      }
      return;
    }
    const row = answerOf(q.key);
    const saved: Answer = row
      ? await fetch(`/api/answers/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: value }),
        }).then((r) => r.json())
      : await fetch("/api/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionKey: q.key, question: q.label, answer: value }),
        }).then((r) => r.json());
    setAnswers((prev) => (row ? prev.map((a) => (a.id === row.id ? saved : a)) : [...prev, saved]));
  };

  const save = async (q: Question) => {
    const id = qid(q);
    const value = drafts[id];
    if (value === undefined) return;
    if (value !== stored(q)) await write(q, value);
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  };

  const copy = async (q: Question) => {
    const text = valueOf(q);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(qid(q));
      setTimeout(() => setCopied((c) => (c === qid(q) ? null : c)), 1200);
      // Bumped on copy, not on edit, so "used 4×" counts what forms actually ask for.
      const row = answerOf(q.key);
      if (row) {
        fetch(`/api/answers/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ used: true }),
        });
      }
    } catch {
      // The clipboard can be refused; the text is selectable in the field anyway.
    }
  };

  const remove = async (key: string) => {
    const row = answerOf(key);
    if (!row) return;
    await fetch(`/api/answers/${row.id}`, { method: "DELETE" });
    setAnswers((prev) => prev.filter((a) => a.id !== row.id));
  };

  const allQuestions = sections.flatMap((s) => s.questions);
  const byId = new Map(allQuestions.map((q) => [qid(q), q] as const));
  const describeFill = (updates: Record<string, unknown>): PasteRow[] =>
    Object.entries(updates)
      .filter(([k, v]) => byId.has(k) && typeof v === "string")
      .map(([k, v]) => ({ key: k, label: byId.get(k)!.label, from: null, to: v as string }));
  const applyFill = async (p: { updates: Record<string, unknown> }, kept: Set<string>) => {
    for (const k of kept) {
      const q = byId.get(k);
      const v = p.updates[k];
      if (q && typeof v === "string") await write(q, v);
    }
  };

  const learned = LEARNED.map((l) => ({ ...l, content: cells.find((c) => c.kind === l.kind)?.content ?? "" })).filter(
    (l) => l.content.trim(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-fg-1">Profile</h1>
        {/* Counts bright, words dim, as on Roles and People. */}
        <p className="text-body text-fg-3 mt-1">
          <span className="text-fg-1 tabular-nums">{done}</span> of <span className="tabular-nums">{total}</span> answered
          <span className="text-fg-4 mx-1.5">·</span>
          the more here, the better every draft and score
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        {/* The table of contents, with each section's count, from lg. Sticky, so
            any section is one click away from anywhere in a long page. */}
        <nav aria-label="Profile sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {sections.map((s) => {
              const n = countOf(s);
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-center justify-between gap-2 h-8 px-2 -mx-2 rounded-control text-body text-fg-2 hover:text-fg-1 hover:bg-raised transition-colors duration-90 ease-enter"
                  >
                    <span className="truncate">{s.title}</span>
                    {n === s.questions.length ? (
                      <Check size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0 text-fg-3" aria-label="Complete" />
                    ) : (
                      <span className="text-meta text-fg-3 tabular-nums shrink-0">
                        {n}/{s.questions.length}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
            {learned.length > 0 && (
              <li>
                <a
                  href="#learned"
                  className="flex items-center h-8 px-2 -mx-2 rounded-control text-body text-fg-2 hover:text-fg-1 hover:bg-raised transition-colors duration-90 ease-enter"
                >
                  What Belay has learned
                </a>
              </li>
            )}
            <li className="pt-2 mt-2 border-t border-line-1">
              <Link
                href="/profile/materials"
                className="flex items-center h-8 px-2 -mx-2 rounded-control text-meta text-fg-3 hover:text-fg-1 hover:bg-raised transition-colors duration-90 ease-enter"
              >
                Resume and all material →
              </Link>
            </li>
          </ul>
        </nav>

        {/* One readable column: answers cap near 72ch beside a 13rem label rail. */}
        <div className="space-y-10 min-w-0 max-w-[calc(13rem+72ch+1.5rem)]">
          {/* The way in for a new profile, and for anything still blank: paste once,
              review the drafts, keep what is right. Only blank questions are offered,
              and never eligibility, pay or disclosure. */}
          <section className={`${card} p-4 space-y-1`}>
            <h2 className="t-section">Start from your resume</h2>
            <p className="text-meta text-fg-3 pb-1">
              Paste a resume or your LinkedIn profile. Belay drafts answers for the blank questions, and you keep what is
              right.
            </p>
            <PasteAnything
              endpoint="/api/profile/fill"
              label="Fill from a resume or LinkedIn"
              placeholder="Paste your resume, or your LinkedIn profile (select all on the page, copy, paste)."
              describe={describeFill}
              onApplied={applyFill}
            />
          </section>

          {sections.map((s) => {
            const n = countOf(s);
            return (
              <section key={s.id} id={s.id} className="scroll-mt-20">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="t-section">{s.title}</h2>
                  <span className="text-meta text-fg-3 tabular-nums">
                    {n} of {s.questions.length}
                  </span>
                </div>
                <p className="text-meta text-fg-3 mt-0.5 mb-3">{s.usedFor}</p>
                <div className={`${card} divide-y divide-line-1`}>
                  {s.questions.map((q) => {
                    const id = qid(q);
                    const value = valueOf(q);
                    const uses = q.store === "answer" ? (answerOf(q.key)?.useCount ?? 0) : 0;
                    return (
                      <div key={id} className="group p-3 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6 lg:items-start">
                        <div className="flex items-start justify-between gap-3 lg:pt-1.5">
                          <div className="min-w-0">
                            <label htmlFor={`q-${id}`} className="block text-body text-fg-1">
                              {q.label}
                            </label>
                            {q.hint && <p className="text-meta text-fg-3 mt-0.5">{q.hint}</p>}
                            {uses > 0 && (
                              <p className="text-meta text-fg-3 mt-0.5">
                                Used <span className="tabular-nums">{uses}×</span>
                              </p>
                            )}
                          </div>
                          {/* Copy for the form answers (that is what they are for);
                              remove only for the ones you added. 28px targets pulled
                              into the label's line so the row does not grow. */}
                          {q.store === "answer" && (
                            <div className="flex items-center gap-1 shrink-0 -my-1">
                              <button
                                onClick={() => copy(q)}
                                disabled={!value}
                                title={value ? "Copy to clipboard" : "Nothing to copy yet"}
                                aria-label={`Copy ${q.label}`}
                                className={iconButton("quiet", "compact")}
                              >
                                {copied === id ? (
                                  <Check size={14} strokeWidth={1.5} absoluteStrokeWidth className="text-fg-1" />
                                ) : (
                                  <Copy size={14} strokeWidth={1.5} absoluteStrokeWidth />
                                )}
                              </button>
                              {s.id === "yours" && (
                                <button
                                  onClick={() => remove(q.key)}
                                  title="Remove this question"
                                  aria-label={`Remove ${q.label}`}
                                  className={`opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${iconButton("destructive", "compact")}`}
                                >
                                  <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <AutoResizeTextarea
                          id={`q-${id}`}
                          value={value}
                          onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                          onBlur={() => save(q)}
                          // The example shows what a good answer looks like; a blank
                          // with no example is a dash.
                          placeholder={q.example ? `e.g. ${q.example}` : "—"}
                          rows={q.long ? 3 : 1}
                          // Long answers stop growing at about twelve lines and
                          // scroll inside: the story cells run to thousands of
                          // characters, and grown in full they made the page 8000px
                          // tall and the sections impossible to scan.
                          className={`${textarea()} mt-2 lg:mt-0 max-h-[16.5rem] overflow-y-auto`}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {learned.length > 0 && (
            <section id="learned" className="scroll-mt-20">
              <h2 className="t-section">What Belay has learned</h2>
              <p className="text-meta text-fg-3 mt-0.5 mb-3">
                Distilled from your accepts and passes, and read by every prompt. If something here is wrong, say so in
                Your story or the flags above; the next distillation takes it from there.
              </p>
              <div className={`${card} divide-y divide-line-1`}>
                {learned.map((l) => {
                  const isOpen = openLearned.has(l.kind);
                  return (
                    <div key={l.kind}>
                      <button
                        onClick={() =>
                          setOpenLearned((prev) => {
                            const next = new Set(prev);
                            if (next.has(l.kind)) next.delete(l.kind);
                            else next.add(l.kind);
                            return next;
                          })
                        }
                        aria-expanded={isOpen}
                        className="w-full flex items-center gap-2 h-10 px-3 text-left text-body text-fg-1 hover:bg-lift transition-colors duration-90 ease-enter first:rounded-t-card"
                      >
                        {isOpen ? (
                          <ChevronDown size={14} strokeWidth={1.5} absoluteStrokeWidth className="text-fg-3" />
                        ) : (
                          <ChevronRight size={14} strokeWidth={1.5} absoluteStrokeWidth className="text-fg-3" />
                        )}
                        {l.label}
                      </button>
                      {isOpen && (
                        <p className="px-3 pb-3 pl-8 text-body text-fg-2 whitespace-pre-wrap max-w-[72ch]">{l.content}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Below lg the rail is hidden, so its last link lives here too. */}
          <Link href="/profile/materials" className="lg:hidden block text-meta text-fg-3 hover:text-fg-1">
            Resume and all material →
          </Link>
        </div>
      </div>
    </div>
  );
}
