"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { logoUrl } from "@/lib/logo";

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
    setDraftInput("");
    setDraftName("");
    setDraftUrl("");
    setResolved(null);
    setAdding(false);
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
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Companies</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-accent-pink hover:opacity-80 transition-opacity duration-150"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {adding && (
        <div className="mb-3 bg-zinc-900 border border-accent-pink/30 rounded-lg p-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") lookup();
              }}
              placeholder="Paste the company's LinkedIn URL"
              autoFocus
              className="flex-1 text-sm border border-zinc-700 rounded-md px-3 py-1.5 bg-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent-pink transition-all duration-150"
            />
            <button
              onClick={lookup}
              disabled={!draftInput.trim() || looking}
              className="text-sm font-medium px-3 py-1.5 border border-zinc-700 text-zinc-300 rounded-md hover:border-accent-pink/50 hover:text-accent-pink disabled:opacity-40 transition-all duration-150"
            >
              {looking ? "Looking…" : "Look up"}
            </button>
          </div>
          {lookupError && <p className="text-xs text-accent-pink">{lookupError}</p>}
          {resolved && (
            <>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Name"
                className="w-full text-sm border border-zinc-700 rounded-md px-3 py-1.5 bg-zinc-800 text-zinc-100 focus:outline-none focus:border-accent-pink"
              />
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="Careers or board URL"
                className="w-full text-sm border border-zinc-700 rounded-md px-3 py-1.5 bg-zinc-800 text-zinc-100 focus:outline-none focus:border-accent-pink"
              />
              <p className="text-xs text-zinc-600">
                Lands in Unsorted. Drag it into a tier from there.
              </p>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setDraftInput("");
                setResolved(null);
                setLookupError(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={!draftName.trim() || !draftUrl.trim()}
              className="text-sm font-medium px-4 py-1.5 bg-accent-pink text-black rounded-md hover:opacity-90 disabled:opacity-40 transition-all duration-150"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {groups.map((g) => (
          <div
            key={g.tier}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={() => g.tier !== 0 && dropOn(g.tier, null)}
          >
            {/* Same treatment as every other group heading in the app: the pipeline's
                status groups, the network's stage groups, the sites' categories. This
                one was bolder, lighter, un-cased and differently tracked, and it held
                the count inside itself instead of beside it. */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                {g.tier === 0 ? g.label : `${g.label}-tier`}
              </h3>
              <span className="text-xs text-zinc-600">{g.items.length}</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {g.items.map((c) =>
                editingId === c.id ? (
                  <div
                    key={c.id}
                    className="col-span-3 sm:col-span-5 md:col-span-7 bg-zinc-900 border border-accent-pink/40 rounded-lg p-3 space-y-1.5"
                  >
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:border-accent-pink"
                    />
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:border-accent-pink"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => remove(c.id)}
                          className="text-xs text-zinc-600 hover:text-accent-pink transition-colors duration-150"
                        >
                          Delete
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
                          Cancel
                        </button>
                        <button onClick={saveEdit} className="text-xs font-semibold text-accent-pink hover:opacity-80">
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
                      className="flex flex-col items-center gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-accent-pink/50 hover:bg-zinc-800 transition-all duration-150"
                      title={c.name}
                    >
                      <img
                        src={logoUrl(c.domain)}
                        alt={c.name}
                        className="w-10 h-10 rounded-md object-contain bg-white p-1"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = logoUrl(c.domain, 64);
                        }}
                      />
                      <span className="text-xs text-zinc-300 group-hover:text-accent-pink transition-colors duration-150 text-center leading-tight">
                        {c.name}
                      </span>
                    </a>
                    <button
                      onClick={() => startEdit(c)}
                      className="absolute top-1.5 right-1.5 text-zinc-600 hover:text-accent-pink opacity-0 group-hover:opacity-100 transition-all duration-150"
                      title="Edit or delete"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
