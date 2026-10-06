"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { card, iconButton, textarea } from "@/lib/ui";

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
        {/* Counts in the bright step and words in the dim one, the same as the
            next-action line on Applications and Network. */}
        <div>
          <h1 className="text-h1 text-fg-1">Profile</h1>
          <p className="text-body text-fg-3 mt-1">
            <span className="text-fg-1 tabular-nums">{allRows.length}</span> question{allRows.length === 1 ? "" : "s"}
            {blanks > 0 && (
              <>
                <span className="text-fg-4 mx-1.5">·</span>
                <span className="text-fg-1 tabular-nums">{blanks}</span> still blank
              </>
            )}
          </p>
        </div>
      </div>


      {/* One readable column: answers cap at 72ch, and from lg the question moves
          into a left rail beside its answer instead of above it. Full-width answer
          fields ran 160 characters to a line, past where the eye can find the next
          one (STYLE_GUIDE 3.3). */}
      <div className="space-y-6 max-w-[calc(16rem+72ch+3rem)]">
      {GROUPS.map((g) => {
        const items = allRows.filter((a) => groupOf(a.tags) === g.tag);
        if (items.length === 0) return null;
        return (
          <section key={g.tag}>
            <h2 className="t-section">{g.label}</h2>
            <p className="text-meta text-fg-3 mt-0.5 mb-2">{g.blurb}</p>
            <div className={`${card} divide-y divide-line-1`}>
              {items.map((a) => {
                const value = drafts[a.id] ?? a.answer;
                const isBlank = !value;
                return (
                  <div key={a.id} className="p-3 group lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6 lg:items-start">
                    <div className="flex items-start justify-between gap-3 lg:pt-1.5">
                      <label htmlFor={`ans-${a.id}`} className="text-meta text-fg-2">
                        {a.question}
                        {isBlank && <span className="ml-2 text-fg-3">blank</span>}
                        {a.useCount > 0 && (
                          <span className="ml-2 text-fg-3">
                            used <span className="tabular-nums">{a.useCount}×</span>
                          </span>
                        )}
                      </label>
                      {/* 28px hit targets, pulled into the label's line with a
                          negative margin so the row does not grow to fit them. */}
                      <div className="flex items-center gap-1 shrink-0 -my-1">
                        {a.id.startsWith("cell:") ? null : (
                        <button
                          onClick={() => copy(a)}
                          disabled={isBlank}
                          title={isBlank ? "Nothing to copy yet" : "Copy to clipboard"}
                          aria-label="Copy to clipboard"
                          className={iconButton("quiet", "compact")}
                        >
                          {copiedId === a.id ? (
                            <Check size={14} strokeWidth={1.5} absoluteStrokeWidth className="text-fg-1" />
                          ) : (
                            <Copy size={14} strokeWidth={1.5} absoluteStrokeWidth />
                          )}
                        </button>
                        )}
                        {a.id.startsWith("cell:") ? null : (
                        <button
                          onClick={() => remove(a.id)}
                          title="Remove this question"
                          aria-label="Remove this question"
                          className={`opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${iconButton("destructive", "compact")}`}
                        >
                          <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth />
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
                      rows={1}
                      // A real field now, canvas on the card with the input border,
                      // rather than bare text with an underline that only showed on
                      // focus: thirty rows of borderless text did not say which
                      // parts you could type into. A blank one reads as blank by its
                      // dash placeholder and the "blank" word in the label.
                      className={`${textarea()} mt-2 lg:mt-0`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
