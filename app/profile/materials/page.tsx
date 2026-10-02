"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";

type Material = {
  id: string;
  kind: string;
  title: string | null;
  content: string | null;
  updatedAt: string;
};

/**
 * Settings: the context every prompt in the app reads, and everywhere else your
 * material lives.
 *
 * What was here before was a workshop — nine personas reviewing your positioning,
 * proposal queues, audits, research runs, a visual-strategy generator. It was 3,300
 * lines, it was a different product from the one around it, and in five months it had
 * produced zero runs and zero proposals. This is what is left when you keep only the
 * part that feeds the job search: somewhere to write what you want, and somewhere to
 * see what the tool has gathered on your behalf.
 *
 * Two groups, because they are two different things. The cells at the top are yours
 * to write, and nothing works well until they are filled in. Everything below was
 * produced by the app and is here so it is not invisible: dossiers it wrote while
 * scanning a company, the playbooks the drafts quote from, the running journal the
 * taste signals are distilled out of.
 */

// The cells the user writes. Order is the order they are useful in: who you are,
// then what you are looking for.
const AUTHORED: { kind: string; label: string; hint: string }[] = [
  { kind: "positioning", label: "Positioning", hint: "What you do and who for, in your own words. Read by every draft." },
  { kind: "personality", label: "Personality", hint: "How you work, and what you are like to work with." },
  { kind: "career_arc", label: "Career arc", hint: "The throughline. Used to judge whether a role moves you forward." },
  { kind: "voice", label: "Voice", hint: "How you write, and what you never want to sound like." },
  { kind: "anti_patterns", label: "Anti-patterns", hint: "The roles and places that are not for you." },
  { kind: "search_target_roles", label: "Target roles", hint: "The titles worth your time." },
  { kind: "search_target_problems", label: "Target problems", hint: "The work you actually want to be doing." },
  { kind: "search_target_companies", label: "Target companies", hint: "What makes a company worth applying to." },
  { kind: "search_work_environment", label: "Work environment", hint: "What you need to do your best work." },
  { kind: "search_positive_signals", label: "Green flags", hint: "What makes a posting worth a yes. Feeds the queue score." },
  { kind: "search_negative_signals", label: "Red flags", hint: "What makes a posting a no. Feeds the queue score." },
  { kind: "search_hard_skips", label: "Hard skips", hint: "What you will never apply to. Filtered out before you see it." },
  { kind: "search_skills_to_learn", label: "Skills to learn", hint: "What you want the next role to teach you." },
];

const AUTHORED_KINDS = new Set(AUTHORED.map((a) => a.kind));

// How the gathered material is grouped, by kind prefix. Anything unmatched falls into
// "Other", which is the honest place for it rather than a bucket that pretends.
const GATHERED: { label: string; test: (k: string) => boolean; note: string }[] = [
  { label: "Company dossiers", test: (k) => k === "company_dossier", note: "Written while scanning a company. Pulled in when you open a role there." },
  { label: "Playbooks", test: (k) => k.startsWith("playbook_"), note: "The standing advice the drafts quote from." },
  { label: "Resume corpus", test: (k) => k.startsWith("resume_"), note: "Your experience in pieces, so a tailored resume can be assembled from facts." },
  { label: "Research", test: (k) => k.startsWith("research_"), note: "Market and role research. Frozen: the thing that refreshed it has been removed." },
  { label: "Distilled understanding", test: (k) => k.startsWith("understanding_"), note: "Compressed out of your accept and pass decisions. Read by every prompt." },
  { label: "Journal", test: (k) => k === "system_journal", note: "Every decision the app recorded. The raw material the understanding is distilled from." },
  { label: "Archived", test: (k) => k.startsWith("zz_archive"), note: "Set aside at some point and kept rather than deleted." },
];

export default function SettingsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then((d: Material[]) => {
        setMaterials(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const byKind = useMemo(() => {
    const m = new Map<string, Material[]>();
    for (const x of materials) {
      const arr = m.get(x.kind) ?? [];
      arr.push(x);
      m.set(x.kind, arr);
    }
    return m;
  }, [materials]);

  const save = async (kind: string, content: string) => {
    const existing = byKind.get(kind)?.[0];
    if (existing) {
      setMaterials((prev) => prev.map((m) => (m.id === existing.id ? { ...m, content } : m)));
      setSavedId(existing.id);
      await fetch(`/api/materials/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } else {
      const made: Material = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, content }),
      }).then((r) => r.json());
      setMaterials((prev) => [...prev, made]);
      setSavedId(made.id);
    }
    setTimeout(() => setSavedId(null), 1600);
  };

  const remove = async (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/materials/${id}`, { method: "DELETE" });
  };

  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const gathered = GATHERED.map((g) => ({
    ...g,
    items: materials.filter((m) => !AUTHORED_KINDS.has(m.kind) && g.test(m.kind)),
  })).filter((g) => g.items.length > 0);

  const claimed = new Set(gathered.flatMap((g) => g.items.map((i) => i.id)));
  const other = materials.filter((m) => !AUTHORED_KINDS.has(m.kind) && !claimed.has(m.id));
  const filled = AUTHORED.filter((a) => (byKind.get(a.kind)?.[0]?.content ?? "").trim().length > 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {filled} of {AUTHORED.length} written
          {filled < AUTHORED.length && (
            <>
              {" · "}
              <span className="text-alarm">the queue scores against these</span>
            </>
          )}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Your profile</h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="space-y-2">
            {AUTHORED.map((a) => {
              const row = byKind.get(a.kind)?.[0];
              const value = drafts[a.kind] ?? row?.content ?? "";
              const dirty = drafts[a.kind] !== undefined && drafts[a.kind] !== (row?.content ?? "");
              return (
                <div key={a.kind} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-100">{a.label}</p>
                    {savedId && savedId === row?.id && !dirty ? (
                      <span className="text-xs text-zinc-600 shrink-0">Saved</span>
                    ) : dirty ? (
                      <button
                        onClick={() => {
                          save(a.kind, value);
                          setDrafts((d) => {
                            const n = { ...d };
                            delete n[a.kind];
                            return n;
                          });
                        }}
                        className="text-xs font-semibold text-zinc-100 hover:opacity-80 shrink-0"
                      >
                        Save
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-zinc-600">{a.hint}</p>
                  <AutoResizeTextarea
                    value={value}
                    onChange={(e) => setDrafts((d) => ({ ...d, [a.kind]: e.target.value }))}
                    placeholder="Write this in your own words. It is read verbatim by the drafts."
                    className="w-full text-xs bg-transparent text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none leading-relaxed pt-1 min-h-[2rem]"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(gathered.length > 0 || other.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">What the app has gathered</h2>
          <div className="space-y-2">
            {[...gathered, ...(other.length > 0 ? [{ label: "Other", note: "Everything else in the table.", items: other }] : [])].map(
              (g) => (
                <div key={g.label} className="bg-zinc-900 border border-zinc-800 rounded-lg">
                  <button
                    onClick={() => toggle(g.label)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors duration-150 rounded-lg"
                  >
                    {open.has(g.label) ? (
                      <ChevronDown size={13} className="text-zinc-600 shrink-0" />
                    ) : (
                      <ChevronRight size={13} className="text-zinc-600 shrink-0" />
                    )}
                    <span className="text-sm text-zinc-200">{g.label}</span>
                    <span className="text-xs text-zinc-600">{g.items.length}</span>
                    <span className="text-xs text-zinc-700 truncate ml-2">{g.note}</span>
                  </button>
                  {open.has(g.label) && (
                    <div className="px-4 pb-3 space-y-1">
                      {g.items.slice(0, 200).map((m) => (
                        <div key={m.id} className="flex items-center gap-2 group">
                          <span className="text-xs text-zinc-400 truncate flex-1">
                            {m.title || m.kind}
                            {m.content && <span className="text-zinc-700"> · {m.content.length.toLocaleString()} chars</span>}
                          </span>
                          <button
                            onClick={() => remove(m.id)}
                            className="text-zinc-700 hover:text-alarm opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                      {g.items.length > 200 && (
                        <p className="text-xs text-zinc-700">…and {g.items.length - 200} more.</p>
                      )}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
