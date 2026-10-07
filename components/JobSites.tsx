"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";
import { logoUrl } from "@/lib/logo";
import { button, card, iconButton, input, sectionHead } from "@/lib/ui";

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
// records: the ones it reads (Automatic), and the ones you have to open yourself
// (Manual). The old groups said what a site was for, which did not tell you which
// ones needed you. One word each since v1.6: a group name, not a sentence.
const GROUPS = [
  { key: "daily", label: "Automatic" },
  { key: "manual", label: "Manual" },
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
    <section>
      {/* The same header and the same add form as Companies beside it, part for
          part: the button names what it adds and sits after the heading; the form
          is one field, a helper line that turns into the error line, then Cancel
          and the primary action on the right. Enter submits, Escape cancels. */}
      <div className={`${sectionHead} mb-3`}>
        <h2 className="t-section">Sites</h2>
        <button
          onClick={() => (adding ? resetDraft() : setAdding(true))}
          aria-expanded={adding}
          aria-label="Add site"
          className={button("quiet", "compact")}
        >
          <Plus size={14} strokeWidth={1.5} absoluteStrokeWidth /> Add
        </button>
      </div>

      {adding && (
        <div className={`mb-3 ${card} p-4 space-y-2`}>
          <input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") resetDraft();
            }}
            placeholder="Paste the job board's URL"
            aria-label="Job board URL"
            autoFocus
            className={input()}
          />
          {addError ? (
            <p className="flex items-start gap-1.5 text-meta text-alarm">
              <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" />
              {addError}
            </p>
          ) : (
            <p className="text-meta text-fg-3">The name comes from the page. A test scan sorts it into a group.</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={resetDraft} className={button("quiet")}>
              Cancel
            </button>
            <button onClick={create} disabled={!draftUrl.trim() || saving} className={button("primary")}>
              {saving ? "Adding…" : "Add site"}
            </button>
          </div>
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
            {/* No count beside the group name on Home (v1.6), as on the tiers. */}
            <h3 className="t-group mb-2">{g.label}</h3>
            <div className={tileGrid}>
              {g.items.map((s) =>
                editingId === s.id ? (
                  <div key={s.id} className={`${card} p-3 space-y-2`}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      aria-label="Name"
                      autoFocus
                      className={input("compact")}
                    />
                    <input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="URL"
                      aria-label="URL"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className={input("compact")}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => remove(s.id)} className={button("destructive", "compact")}>
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
                      className="flex items-center gap-3 p-3 pr-8 bg-surface rounded-card hover:bg-lift transition-colors duration-90 ease-enter"
                    >
                      <img
                        src={logoUrl(s.domain)}
                        alt={s.name}
                        className="w-10 h-10 rounded-card object-contain bg-plate p-1 shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = logoUrl(s.domain, 64);
                        }}
                      />
                      <span className="min-w-0 truncate text-body text-fg-2 group-hover:text-fg-1 transition-colors duration-90 ease-enter">
                        {s.name}
                      </span>
                    </a>
                    {/* Top right, as on the company tiles. Everything you can do to a
                        site lives behind it, so there is no second icon to aim at. */}
                    <button
                      onClick={() => startEdit(s)}
                      className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${iconButton("quiet", "compact")}`}
                      title="Edit or delete"
                      aria-label={`Edit or delete ${s.name}`}
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
