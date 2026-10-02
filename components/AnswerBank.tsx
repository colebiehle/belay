"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";

type Answer = {
  id: string;
  questionKey: string;
  question: string;
  answer: string;
  tags: string | null;
  useCount: number;
  lastUsedAt: string | null;
};

/**
 * Groups exist so the two kinds of blank read differently. An empty
 * "eligibility" row is a thing to go and find out; an empty "voluntary" row is a
 * decision to skip, and both were indistinguishable in one flat list.
 */
const CONTEXT: { kind: string; group: string; question: string }[] = [
  { kind: "positioning", group: "you", question: "What do you do, and who for? In your own words." },
  { kind: "personality", group: "you", question: "How do you work, and what are you like to work with?" },
  { kind: "career_arc", group: "you", question: "What is the throughline of what you have built, and where is it going?" },
  { kind: "voice", group: "you", question: "How do you write? What do you never want to sound like?" },
  { kind: "anti_patterns", group: "you", question: "What kind of role or place is not for you?" },
  { kind: "search_target_roles", group: "looking", question: "Which titles are worth your time?" },
  { kind: "search_target_problems", group: "looking", question: "What work do you actually want to be doing?" },
  { kind: "search_target_companies", group: "looking", question: "What makes a company worth applying to?" },
  { kind: "search_work_environment", group: "looking", question: "What do you need around you to do your best work?" },
  { kind: "search_positive_signals", group: "looking", question: "What in a posting makes it a yes?" },
  { kind: "search_negative_signals", group: "looking", question: "What in a posting makes it a no?" },
  { kind: "search_hard_skips", group: "looking", question: "What would you never apply to, whatever else it offered?" },
  { kind: "search_skills_to_learn", group: "looking", question: "What do you want the next role to teach you?" },
];

const GROUPS: { tag: string; label: string; blurb: string }[] = [
  { tag: "you", label: "You", blurb: "Written in your words, quoted in every draft. Worth doing properly once." },
  { tag: "looking", label: "What you are looking for", blurb: "The queue scores every role against these. Vague answers make a vague queue." },
  { tag: "links", label: "Links", blurb: "Pasted into almost every form." },
  { tag: "eligibility", label: "Eligibility", blurb: "Fill these in yourself — a wrong answer here is the kind that matters." },
  { tag: "comp", label: "Compensation", blurb: "A negotiating position, not a fact. Decide once, then reuse it." },
  { tag: "logistics", label: "Logistics", blurb: "Location, start date, remote preference." },
  { tag: "background", label: "Background", blurb: "Facts that do not change between applications." },
  { tag: "written", label: "Written prompts", blurb: "Worth writing properly once. The company-specific line goes on top of a reusable spine." },
  { tag: "voluntary", label: "Voluntary disclosure", blurb: "Blank means you skip it." },
  { tag: "custom", label: "Yours", blurb: "Anything a form asked for that was not already here." },
];

function groupOf(tags: string | null): string {
  const list = (tags ?? "").split(",").map((t) => t.trim());
  for (const g of GROUPS) if (list.includes(g.tag)) return g.tag;
  return "custom";
}

type Cell = { id: string; kind: string; content: string | null };

export function AnswerBank() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/answers").then((r) => r.json()).then(setAnswers);
    fetch("/api/materials")
      .then((r) => r.json())
      .then((d: Cell[]) => setCells(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Saved on blur rather than per keystroke: these are paragraphs, and a PATCH
  // per character turns a long answer into a hundred writes.
  const save = async (id: string) => {
    const value = drafts[id];
    if (value === undefined) return;
    if (id.startsWith("cell:")) {
      await saveCell(id.slice(5), value);
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      return;
    }
    const res = await fetch(`/api/answers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: value }),
    });
    const updated: Answer = await res.json();
    setAnswers((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  };

  const copy = async (a: Answer) => {
    const text = drafts[a.id] ?? a.answer;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(a.id);
      setTimeout(() => setCopiedId((c) => (c === a.id ? null : c)), 1200);
      // Bumping on copy, not on edit, means the list sorts itself by what forms
      // actually ask for.
      fetch(`/api/answers/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ used: true }),
      });
    } catch {
      // Clipboard can be refused; the text is selectable in the field anyway.
    }
  };



  const remove = async (id: string) => {
    await fetch(`/api/answers/${id}`, { method: "DELETE" });
    setAnswers((prev) => prev.filter((a) => a.id !== id));
  };

  // Adapter, not a second renderer: a context cell is a question with an answer, and
  // the only difference is which table it is written back to.
  const contextRows: Answer[] = CONTEXT.map((c) => {
    const row = cells.find((x) => x.kind === c.kind);
    return {
      id: `cell:${c.kind}`,
      questionKey: c.kind,
      question: c.question,
      answer: row?.content ?? "",
      tags: c.group,
      useCount: 0,
      lastUsedAt: null,
    };
  });
  const allRows = [...contextRows, ...answers];

  const saveCell = async (kind: string, content: string) => {
    const row = cells.find((x) => x.kind === kind);
    if (row) {
      setCells((prev) => prev.map((x) => (x.id === row.id ? { ...x, content } : x)));
      await fetch(`/api/materials/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } else {
      const made: Cell = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, content }),
      }).then((r) => r.json());
      setCells((prev) => [...prev, made]);
    }
  };

  const blanks = allRows.filter((a) => !(drafts[a.id] ?? a.answer)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Profile</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {allRows.length} question{allRows.length === 1 ? "" : "s"}
            {blanks > 0 && (
              <>
                {" · "}
                <span className="text-zinc-400">{blanks} still blank</span>
              </>
            )}
          </p>
        </div>
      </div>


      {GROUPS.map((g) => {
        const items = allRows.filter((a) => groupOf(a.tags) === g.tag);
        if (items.length === 0) return null;
        return (
          <section key={g.tag}>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{g.label}</h2>
            <p className="text-xs text-zinc-600 mt-0.5 mb-2">{g.blurb}</p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800">
              {items.map((a) => {
                const value = drafts[a.id] ?? a.answer;
                const isBlank = !value;
                return (
                  <div key={a.id} className="p-3 group">
                    <div className="flex items-start justify-between gap-3">
                      <label htmlFor={`ans-${a.id}`} className="text-xs text-zinc-400 leading-snug">
                        {a.question}
                        {isBlank && <span className="ml-2 text-zinc-600">blank</span>}
                        {a.useCount > 0 && (
                          <span className="ml-2 text-zinc-600">
                            used {a.useCount}×
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.id.startsWith("cell:") ? null : (
                        <button
                          onClick={() => copy(a)}
                          disabled={isBlank}
                          title={isBlank ? "Nothing to copy yet" : "Copy to clipboard"}
                          className="text-zinc-600 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-600 transition-colors duration-150"
                        >
                          {copiedId === a.id ? <Check size={13} className="text-zinc-100" /> : <Copy size={13} />}
                        </button>
                        )}
                        {a.id.startsWith("cell:") ? null : (
                        <button
                          onClick={() => remove(a.id)}
                          title="Remove this question"
                          className="text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all duration-150"
                        >
                          <Trash2 size={13} />
                        </button>
                        )}
                      </div>
                    </div>
                    <AutoResizeTextarea
                      id={`ans-${a.id}`}
                      value={value}
                      onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                      onBlur={() => save(a.id)}
                      placeholder="—"
                      className={`w-full mt-1 text-sm bg-transparent border-0 border-b border-transparent px-0 py-0.5 resize-none focus:outline-none focus:border-zinc-500 transition-colors duration-150 ${
                        isBlank ? "text-zinc-600 placeholder-zinc-700" : "text-zinc-100"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
