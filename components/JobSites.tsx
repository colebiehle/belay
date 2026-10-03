"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { logoUrl } from "@/lib/logo";

type Site = {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string | null;
  position: number;
  note: string | null;
  scanStatus: string | null;
  scanNote: string | null;
};

// Grouped by what the daily scan can do with each site, which the scan itself
// records: the ones it reads, and the ones you have to open yourself. The old
// groups said what a site was for, which did not tell you which ones needed you.
const GROUPS = [
  { key: "daily", label: "Scanned for you" },
  { key: "manual", label: "Check yourself" },
  { key: "unscanned", label: "Not checked yet" },
];
const groupOf = (s: Site) => (s.scanStatus === "daily" || s.scanStatus === "manual" ? s.scanStatus : "unscanned");

export function JobSites({ compact = false }: { compact?: boolean } = {}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // One field. A link is all you have to hand; the route reads the page for its own
  // name and classifies it, so there is nothing left to type. Asking for a name and a
  // category was asking you to restate what the page already says about itself.
  const [draftUrl, setDraftUrl] = useState("");
  const [saving, setAdding_] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sites").then((r) => r.json()).then(setSites);
  }, []);

  const resetDraft = () => {
    setAdding(false);
    setDraftUrl("");
    setAddError(null);
  };

  const create = async () => {
    const raw = draftUrl.trim();
    if (!raw) return;
    setAdding_(true);
    setAddError(null);
    try {
      const res = await fetch("/api/resolve-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? `Lookup failed (HTTP ${res.status})`);
      const made = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: d.name, url: d.url, domain: d.domain, category: d.category }),
      }).then((r) => r.json());
      setSites((prev) => [...prev, made]);
      resetDraft();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding_(false);
    }
  };

  const remove = async (id: string) => {
    setSites((prev) => prev.filter((s) => s.id !== id));
    setEditingId(null);
    await fetch(`/api/sites/${id}`, { method: "DELETE" });
  };

  const startEdit = (s: Site) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditUrl(s.url);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const patch = { name: editName.trim(), url: editUrl.trim() };
    setSites((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...patch } : s)));
    setEditingId(null);
    await fetch(`/api/sites/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  // Same shape as the company tiles: dropping rewrites position across the whole
  // group it landed in, so the stored order always matches what is on screen rather
  // than drifting as rows are added and deleted. Dragging only reorders: the scan
  // decides the group.
  const dropOn = async (targetGroup: string, beforeId: string | null) => {
    if (!dragId) return;
    const moving = sites.find((s) => s.id === dragId);
    if (!moving || groupOf(moving) !== targetGroup) {
      setDragId(null);
      return;
    }
    const rest = sites
      .filter((s) => s.id !== dragId && groupOf(s) === targetGroup)
      .sort((a, b) => a.position - b.position);
    const at = beforeId ? rest.findIndex((s) => s.id === beforeId) : rest.length;
    const idx = at < 0 ? rest.length : at;
    const ordered = [...rest.slice(0, idx), moving, ...rest.slice(idx)];

    setSites((prev) =>
      prev.map((s) => {
        const i = ordered.findIndex((o) => o.id === s.id);
        return i < 0 ? s : { ...s, position: i };
      }),
    );
    setDragId(null);

    await Promise.all(
      ordered.map((s, i) =>
        fetch(`/api/sites/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: i }),
        }),
      ),
    );
  };

  const groups = GROUPS.map((g) => ({
    cat: g.key,
    label: g.label,
    items: sites.filter((s) => groupOf(s) === g.key).sort((a, b) => a.position - b.position),
  })).filter((g) => g.items.length > 0);

  const tileGrid = compact ? "flex flex-col gap-2" : "grid grid-cols-1 sm:grid-cols-2 gap-2";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Sites</h2>
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
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") resetDraft();
              }}
              placeholder="Paste the board's URL"
              autoFocus
              className="flex-1 text-sm border border-zinc-700 rounded-md px-3 py-1.5 bg-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent-pink transition-all duration-150"
            />
            <button
              onClick={create}
              disabled={!draftUrl.trim() || saving}
              className="text-sm font-medium px-4 py-1.5 bg-accent-pink text-black rounded-md hover:opacity-90 disabled:opacity-40 transition-all duration-150 shrink-0"
            >
              {saving ? "Reading…" : "Add"}
            </button>
          </div>
          <p className="text-xs text-zinc-600">
            {addError ?? "The name comes from the page itself, and a test scan sorts it into a group."}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <div
            key={g.cat}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={() => dropOn(g.cat, null)}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{g.label}</h3>
              <span className="text-xs text-zinc-600">{g.items.length}</span>
            </div>
            <div className={tileGrid}>
              {g.items.map((s) =>
                editingId === s.id ? (
                  <div key={s.id} className="bg-zinc-900 border border-accent-pink/40 rounded-lg p-3 space-y-1.5">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      autoFocus
                      className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent-pink"
                    />
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="URL"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent-pink"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => remove(s.id)}
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
                    key={s.id}
                    draggable
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => {
                      if (dragId && dragId !== s.id) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      dropOn(groupOf(s), s.id);
                    }}
                    className={`relative group ${dragId === s.id ? "opacity-40" : ""}`}
                  >
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.scanNote ?? undefined}
                      className="flex items-center gap-3 p-3 pr-7 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-accent-pink/50 hover:bg-zinc-800 transition-all duration-150"
                    >
                      <img
                        src={logoUrl(s.domain)}
                        alt={s.name}
                        className="w-10 h-10 rounded-md object-contain bg-white p-1 shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = logoUrl(s.domain, 64);
                        }}
                      />
                      <span className="text-xs font-medium text-zinc-300 group-hover:text-accent-pink transition-colors duration-150">
                        {s.name}
                      </span>
                    </a>
                    {/* Top right, as on the company tiles. Everything you can do to a
                        site lives behind it, so there is no second icon to aim at. */}
                    <button
                      onClick={() => startEdit(s)}
                      className="absolute top-1.5 right-1.5 text-zinc-600 hover:text-accent-pink opacity-0 group-hover:opacity-100 transition-all duration-150"
                      title="Edit or delete"
                    >
                      <Pencil size={13} />
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
