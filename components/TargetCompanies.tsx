"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { logoUrl } from "@/lib/logo";
import { button, card, iconButton, input, sectionHead } from "@/lib/ui";

type Company = {
  id: string;
  name: string;
  domain: string;
  careersUrl: string;
  tier: number;
  position: number;
  note: string | null;
};

// S through D, the convention people read without explanation. D is the fallback
// tier: everything above it is being pursued, D is what is worth knowing about if the
// search stalls. Why a company sits where it does is worth writing down somewhere with room
// for the argument.
const TIERS: { tier: number; label: string }[] = [
  { tier: 1, label: "S" },
  { tier: 2, label: "A" },
  { tier: 3, label: "B" },
  { tier: 4, label: "C" },
  { tier: 5, label: "D" },
];

/**
 * The tier list.
 *
 * Managing it used to mean a Manage toggle that swapped the whole grid into a
 * different layout with inline forms — a mode to enter and leave for what is usually a
 * one-field change. Each tile now carries a pencil and edits in place.
 *
 * Tier is a drag rather than a dropdown, because moving a company from S to A *is* the
 * move being described and a select was a translation of it. Dragging within a tier
 * sets the order.
 *
 * Notes are off this surface: a sentence per tile explaining a judgement the tier
 * already states, in a grid built for scanning.
 */
export function TargetCompanies({ compact = false }: { compact?: boolean } = {}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draftInput, setDraftInput] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ domain: string; verified: boolean } | null>(null);

  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/target-companies").then((r) => r.json()).then(setCompanies);
  }, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? ({ ...c, ...body } as Company) : c)));
    await fetch(`/api/target-companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  const lookup = async () => {
    if (!draftInput.trim()) return;
    setLooking(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/resolve-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draftInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? `Lookup failed (HTTP ${res.status})`);
      setDraftName(d.name);
      setDraftUrl(d.careersUrl);
      setResolved({ domain: d.domain, verified: d.verified });
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : String(e));
    } finally {
      setLooking(false);
    }
  };

  const resetDraft = () => {
    setAdding(false);
    setDraftInput("");
    setDraftName("");
    setDraftUrl("");
    setResolved(null);
    setLookupError(null);
  };

  const create = async () => {
    if (!draftName.trim() || !draftUrl.trim()) return;
    const res = await fetch("/api/target-companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draftName.trim(),
        careersUrl: draftUrl.trim(),
        tier: 0,
        domain: resolved?.domain,
      }),
    });
    const made: Company = await res.json();
    setCompanies((prev) => [...prev, made]);
    resetDraft();
  };

  const remove = async (id: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setEditingId(null);
    await fetch(`/api/target-companies/${id}`, { method: "DELETE" });
  };

  const startEdit = (c: Company) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditUrl(c.careersUrl);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await patch(editingId, { name: editName.trim(), careersUrl: editUrl.trim() });
    setEditingId(null);
  };

  /**
   * Drop onto a tile: take its place. Drop onto a tier's empty space: go last in that tier.
   * Positions are rewritten across the whole affected tier so the order is stable
   * rather than depending on whatever integers happened to be stored.
   */
  const dropOn = async (targetTier: number, beforeId: string | null) => {
    if (!dragId) return;
    const moving = companies.find((c) => c.id === dragId);
    if (!moving) return;
    const rest = companies
      .filter((c) => c.id !== dragId && c.tier === targetTier)
      .sort((a, b) => a.position - b.position);
    const at = beforeId ? rest.findIndex((c) => c.id === beforeId) : rest.length;
    const idx = at < 0 ? rest.length : at;
    const ordered = [...rest.slice(0, idx), moving, ...rest.slice(idx)];

    setCompanies((prev) =>
      prev.map((c) => {
        const i = ordered.findIndex((o) => o.id === c.id);
        if (i < 0) return c;
        return { ...c, tier: targetTier, position: i };
      }),
    );
    setDragId(null);

    await Promise.all(
      ordered.map((c, i) =>
        fetch(`/api/target-companies/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: targetTier, position: i }),
        }),
      ),
    );
  };

  const known = new Set(TIERS.map((t) => t.tier));
  const unsorted = companies.filter((c) => !known.has(c.tier));
  const groups = [
    ...(unsorted.length > 0 ? [{ tier: 0, label: "Unsorted", items: unsorted }] : []),
    ...TIERS.map((t) => ({
      ...t,
      items: companies.filter((c) => c.tier === t.tier).sort((a, b) => a.position - b.position),
    })),
  ].filter((g) => g.items.length > 0);

  return (
    <section>
      {/* Add is a quiet button, not a pink link: it opens a form, it is not the
          page's next move. It sits right after the heading, so the heading already names
          what it adds: "+ Add" beside "Companies" (its aria-label says "Add company"). The
          form is built the same as the Sites one beside it: one field, a helper
          line that turns into the error line, then Cancel and the primary action
          on the right. Enter does the primary action, Escape cancels.
          A company takes one step more than a site: the lookup fills in the name
          and careers page, which you can correct before adding. The primary
          button says which step you are on. */}
      <div className={`${sectionHead} mb-3`}>
        <h2 className="t-section">Companies</h2>
        <button
          onClick={() => (adding ? resetDraft() : setAdding(true))}
          aria-expanded={adding}
          aria-label="Add company"
          className={button("quiet", "compact")}
        >
          <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add
        </button>
      </div>

      {adding && (
        <div className={`reveal mb-3 ${card} p-4 space-y-2`}>
          <input
            value={draftInput}
            onChange={(e) => {
              setDraftInput(e.target.value);
              // A new link means a new lookup; the fields below were for the old one.
              setResolved(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (resolved) create();
                else lookup();
              }
              if (e.key === "Escape") resetDraft();
            }}
            placeholder="Paste the company's LinkedIn URL"
            aria-label="Company LinkedIn URL"
            autoFocus
            className={input()}
          />
          {resolved && (
            <>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") resetDraft();
                }}
                placeholder="Name"
                aria-label="Name"
                className={input()}
              />
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") resetDraft();
                }}
                placeholder="Careers or board URL"
                aria-label="Careers or board URL"
                className={input()}
              />
            </>
          )}
          {lookupError ? (
            <p className="flex items-start gap-1.5 text-meta text-alarm">
              <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" />
              {lookupError}
            </p>
          ) : (
            <p className="text-meta text-fg-3">
              {resolved
                ? "Check the name and careers page. It lands in Unsorted; drag it into a tier from there."
                : "The name and careers page come from the company's page."}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetDraft} className={button("quiet")}>
              Cancel
            </button>
            {resolved ? (
              <button onClick={create} disabled={!draftName.trim() || !draftUrl.trim()} className={button("primary")}>
                Add company
              </button>
            ) : (
              <button onClick={lookup} disabled={!draftInput.trim() || looking} className={button("primary")}>
                {looking ? "Looking up…" : "Look up"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div
            key={g.tier}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={() => g.tier !== 0 && dropOn(g.tier, null)}
          >
            {/* The group heading every list uses (t-group), without the count beside
                it (v1.6): on Home the tiles are right under it and countable at a
                glance, and "S-tier 8" read as a score. */}
            <h3 className="t-group mb-2">{g.tier === 0 ? g.label : `${g.label}-tier`}</h3>

            {/* Auto-fill at 88px or wider: a fixed 7 across stranded the eighth tile
                of an 8-company tier alone on a second row. At 1440 the column holds 8. */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
              {g.items.map((c) =>
                editingId === c.id ? (
                  <div
                    key={c.id}
                    className={`col-span-full ${card} p-3 space-y-2`}
                  >
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      aria-label="Name"
                      className={input("compact")}
                    />
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      aria-label="Careers or board URL"
                      className={input("compact")}
                    />
                    {/* Delete on the far left, away from Save, and only alarm on
                        hover with its glyph: the destructive quiet button. */}
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => remove(c.id)} className={button("destructive", "compact")}>
                        <Trash2 size={14} strokeWidth={1.5} absoluteStrokeWidth /> Delete
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingId(null)} className={button("quiet", "compact")}>
                          Cancel
                        </button>
                        <button onClick={saveEdit} className={button("primary", "compact")}>
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => {
                      if (dragId && dragId !== c.id) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      dropOn(c.tier, c.id);
                    }}
                    className={`relative group ${dragId === c.id ? "opacity-40" : ""}`}
                  >
                    <a
                      href={c.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 h-full p-3 bg-surface rounded-card hover:bg-lift transition-colors duration-90 ease-enter"
                      title={c.name}
                    >
                      {/* The logo is the one place company colour lives on this
                          surface; the tile around it stays graphite. */}
                      <img
                        src={logoUrl(c.domain)}
                        alt={c.name}
                        className="w-10 h-10 rounded-card object-contain bg-plate p-1"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = logoUrl(c.domain, 64);
                        }}
                      />
                      {/* One line, ellipsis, the full name in the tile's title: a
                          long name ("Deloitte Digital") wrapped to two lines and made
                          its tile taller than every other tile in the row. */}
                      <span className="w-full truncate text-meta text-fg-2 group-hover:text-fg-1 transition-colors duration-90 ease-enter text-center">
                        {c.name}
                      </span>
                    </a>
                    <button
                      onClick={() => startEdit(c)}
                      className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${iconButton("quiet", "compact")}`}
                      title="Edit or delete"
                      aria-label={`Edit or delete ${c.name}`}
                    >
                      <Pencil size={14} strokeWidth={1.5} absoluteStrokeWidth />
                    </button>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
