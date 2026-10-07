"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { brandColor, usableAccent } from "@/lib/brand-colors";
import { DEFAULT_STAGE } from "@/lib/contact-stages";
import { button } from "@/lib/ui";

/**
 * The network as a graph, the way Obsidian draws a vault: every person is a dot, and
 * a line means one of them is listed as the other's mutual.
 *
 * The Network page answers "who do I write to next"; this answers a different
 * question, "where are the clusters", which a list cannot show. Three Figma designers
 * all reached through Julian is one introduction to ask for, not three cold messages,
 * and that is only visible when the shared mutual sits in the middle of them.
 */

// Only the fields the graph reads. Callers that already hold the full Contact rows can
// pass them straight in; extra fields are ignored.
export type GraphContact = {
  id: string;
  name: string;
  company: string;
  stage?: string | null;
  warmth?: string | null;
  introVia?: string | null;
  introVias?: string | null;
};

type Props = {
  /** Skip the fetch when the parent already has the rows. */
  contacts?: GraphContact[];
  /** Overrides the default click, which opens the person's panel on /networking. */
  onSelect?: (contact: GraphContact) => void;
  className?: string;
};

type GNode = SimulationNodeDatum & {
  id: string;
  contact: GraphContact;
  degree: number;
  r: number;
  color: string;
  shape: NodeShape;
};
type GLink = SimulationLinkDatum<GNode> & { key: string };

type View = { x: number; y: number; k: number };
type Focus = { kind: "node"; id: string } | { kind: "company"; name: string } | null;

const MIN_HEIGHT = 420;
const MIN_K = 0.25;
const MAX_K = 4;

/**
 * The hover highlight is chalk, not rope. Hover is a neutral lift everywhere in the
 * app (STYLE_GUIDE 4.3), and orange that follows the cursor around the graph spent the
 * accent on pointing rather than on a next move. Rope stays for keyboard focus: the
 * node ring turns rope only under :focus-visible, the same as the app's focus ring.
 * It used to be the networking side's blue before that. A CSS variable, so it stays
 * in step with the token instead of being a second copy of the hex.
 */
const HIGHLIGHT = "var(--color-fg-1)";

/**
 * The fallback when a company has no brand colour: eight muted hues at one lightness
 * (OKLCH L 0.74, C 0.075), all 8.1-8.7:1 on canvas, so no company outshouts another
 * just by landing on a brighter slot. Hues 20-80 are left out on purpose: that band
 * is rope and alarm, and a node that reads as orange reads as "highlighted" or
 * "broken" when it is neither (STYLE_GUIDE 5.13).
 */
const PALETTE = [
  "#B6AC75", // olive sand
  "#92B78A", // sage
  "#76BBA8", // jade
  "#6FB9C1", // teal
  "#7BB3D4", // sky
  "#98A9DB", // periwinkle
  "#B69FD1", // lavender
  "#CC99BA", // orchid
];
// fg-3: someone with no company is still a person, just not part of any cluster's hue.
const NO_COMPANY = "#90949A";
// The neutral brand colours are pulled toward. Hex rather than a CSS variable
// because `mix` does arithmetic on it.
const GRAPH_NEUTRAL = "#A1A5AB";

/**
 * Stage is drawn as shape, not hue, because hue is already the company. Not yet
 * contacted (Identified, and Drafted, which is written but still unsent) is a hollow
 * ring: nothing has gone out, so there is nothing to fill. Sent onward is a solid
 * dot. No response is solid but faded to 40%: it happened, and it went quiet.
 */
type NodeShape = "hollow" | "filled" | "faded";
function stageShape(stage: string | null | undefined): NodeShape {
  const s = stage || DEFAULT_STAGE;
  if (s === "Identified" || s === "Drafted") return "hollow";
  if (s === "No response") return "faded";
  return "filled";
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Blend two #rrggbb colours; `t` is how much of `b`. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/**
 * One colour per company, the same one every time the page loads.
 *
 * Contacts carry a company name but no domain, so the brand table is tried with the
 * name squashed onto the three TLDs it actually uses. That is a guess, which is why it
 * only ever upgrades the colour: a miss falls through to the palette, never to wrong.
 * Brand colours come in at full saturation, so they are pulled 40% of the way
 * toward the graph neutral to sit with the palette instead of shouting over it;
 * near-black and near-white brands (Notion, Nike, Uber) take the shared neutral grey
 * first (usableAccent), or they vanish on the canvas.
 *
 * The palette is indexed by a hash of the name rather than by order of appearance, so
 * adding a person at a new company does not repaint everyone else.
 */
function companyColor(company: string): string {
  const key = company.trim().toLowerCase();
  if (!key) return NO_COMPANY;
  const slug = key.replace(/[^a-z0-9]/g, "");
  for (const tld of [".com", ".so", ".app"]) {
    const brand = brandColor(slug + tld);
    if (brand) return mix(usableAccent(brand), GRAPH_NEUTRAL, 0.4);
  }
  return PALETTE[hash(key) % PALETTE.length];
}

const norm = (s: string) => s.trim().toLowerCase();

function mutualNames(c: GraphContact): string[] {
  const out: string[] = [];
  if (c.introVias) {
    try {
      const parsed: unknown = JSON.parse(c.introVias);
      if (Array.isArray(parsed)) for (const v of parsed) if (typeof v === "string") out.push(v);
    } catch {
      // A malformed array is treated like an empty one; introVia below still counts.
    }
  }
  // Older rows only have the single field, and newer ones duplicate its first entry.
  if (c.introVia) out.push(c.introVia);
  return out;
}

/**
 * Mutuals are stored by name, not id, so an edge exists only where the name resolves
 * to someone else in the list. A mutual you have not added as a contact yet is real,
 * but it has no dot to connect to, so it is skipped rather than invented.
 */
function buildGraph(contacts: GraphContact[]) {
  const byName = new Map<string, string[]>();
  for (const c of contacts) {
    const k = norm(c.name);
    if (!k) continue;
    byName.set(k, [...(byName.get(k) ?? []), c.id]);
  }
  const links: GLink[] = [];
  const seen = new Set<string>();
  const neighbours = new Map<string, Set<string>>();
  for (const c of contacts) neighbours.set(c.id, new Set());
  for (const c of contacts) {
    for (const name of mutualNames(c)) {
      for (const other of byName.get(norm(name)) ?? []) {
        if (other === c.id) continue;
        // A knows B through each other is one relationship, so the key ignores direction.
        const key = c.id < other ? `${c.id}|${other}` : `${other}|${c.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ key, source: c.id, target: other });
        neighbours.get(c.id)!.add(other);
        neighbours.get(other)!.add(c.id);
      }
    }
  }
  const nodes: GNode[] = contacts.map((c) => {
    const degree = neighbours.get(c.id)!.size;
    return {
      id: c.id,
      contact: c,
      degree,
      // Square root so a hub reads as bigger without dwarfing everyone; Obsidian's
      // sizing is about this gentle.
      r: 4 + Math.sqrt(degree) * 2.2,
      color: companyColor(c.company),
      shape: stageShape(c.stage),
    };
  });
  return { nodes, links, neighbours };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function NetworkGraph({ contacts: given, onSelect, className = "" }: Props) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();

  const [fetched, setFetched] = useState<GraphContact[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (given) return;
    let live = true;
    fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows: GraphContact[]) => live && setFetched(rows))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [given]);
  const contacts = given ?? fetched;
  const isEmpty = !!contacts && contacts.length === 0;

  const graph = useMemo(() => buildGraph(contacts ?? []), [contacts]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(Math.max(height, MIN_HEIGHT)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
    // The empty state renders a different element, so re-observe when it swaps.
  }, [error, isEmpty]);

  // d3 moves the node objects in place; this counter is how React hears about it.
  const [, setFrame] = useState(0);
  const rafRef = useRef(0);
  const scheduleFrame = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setFrame((f) => f + 1);
    });
  }, []);

  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  // Handlers need the current view without re-binding on every pan frame.
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);
  // Once you have panned or zoomed, the graph stops reframing itself under you. The
  // reset control hands control back.
  const userMovedRef = useRef(false);
  const tweenRef = useRef(0);

  const fitView = useCallback(
    (animate: boolean) => {
      const { w, h } = size;
      if (!w || !graph.nodes.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of graph.nodes) {
        const x = n.x ?? 0, y = n.y ?? 0;
        x0 = Math.min(x0, x - n.r); y0 = Math.min(y0, y - n.r);
        x1 = Math.max(x1, x + n.r); y1 = Math.max(y1, y + n.r);
      }
      // Room for labels at the edges, which are drawn outside the node bounds.
      const pad = 56;
      const k = clamp(Math.min((w - pad * 2) / (x1 - x0 || 1), (h - pad * 2) / (y1 - y0 || 1)), MIN_K, 2);
      const target: View = { k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k };
      cancelAnimationFrame(tweenRef.current);
      if (!animate) {
        setView(target);
        return;
      }
      const from = viewRef.current;
      const start = performance.now();
      const step = (now: number) => {
        const t = clamp((now - start) / 450, 0, 1);
        const e = 1 - Math.pow(1 - t, 3);
        setView({
          k: from.k + (target.k - from.k) * e,
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
        });
        if (t < 1) tweenRef.current = requestAnimationFrame(step);
      };
      tweenRef.current = requestAnimationFrame(step);
    },
    [size, graph],
  );
  // The simulation effect calls the latest fitView without restarting when size changes.
  const fitRef = useRef(fitView);
  useLayoutEffect(() => {
    fitRef.current = fitView;
  }, [fitView]);

  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  useEffect(() => {
    if (!graph.nodes.length) return;
    userMovedRef.current = false;
    const sim = forceSimulation<GNode, GLink>(graph.nodes)
      .force(
        "link",
        forceLink<GNode, GLink>(graph.links).id((d) => d.id).distance(46).strength(0.6),
      )
      // Repulsion with a cap on range, so far-apart clusters stop pushing each other
      // once they are clearly separate, and the whole thing does not drift outward.
      .force("charge", forceManyBody<GNode>().strength(-110).distanceMax(320))
      // Weak gravity toward the middle. Without it, people with no mutuals have only
      // repulsion acting on them and fly off screen; with it they settle in a loose
      // ring around the connected core, the way unlinked notes do in Obsidian.
      .force("x", forceX<GNode>(0).strength(0.07))
      .force("y", forceY<GNode>(0).strength(0.07))
      .force("collide", forceCollide<GNode>((d) => d.r + 6))
      .stop();

    if (reduced) {
      // Settle it all before the first paint: same layout, no motion.
      for (let i = 0; i < 300; i++) sim.tick();
      scheduleFrame();
      fitRef.current(false);
    } else {
      // A head start, so the first frame is already a recognisable shape and the
      // animation is the last stretch of settling rather than an explosion from a dot.
      for (let i = 0; i < 120; i++) sim.tick();
      fitRef.current(false);
      // Then cool fast enough that what is left takes about 72 ticks, 1.2s at 60fps,
      // and the simulation stops itself. d3's default decay would keep nudging dots
      // for another few seconds, which reads as idle drift: a graph that will not sit
      // still while you are trying to read it. A drag warms it back up, and releasing
      // (alphaTarget(0)) cools it on the same short curve.
      sim.alphaDecay(1 - Math.pow(sim.alphaMin() / sim.alpha(), 1 / 72));
      sim.on("tick", scheduleFrame);
      sim.on("end", () => {
        if (!userMovedRef.current) fitRef.current(true);
      });
      sim.restart();
    }
    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [graph, reduced, scheduleFrame]);

  // A resize reframes the graph unless you have taken over the view.
  useEffect(() => {
    if (!userMovedRef.current) fitRef.current(false);
  }, [size.w, size.h]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(tweenRef.current);
    },
    [],
  );

  // --- Interaction ---------------------------------------------------------------

  const [focus, setFocus] = useState<Focus>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const select = useCallback(
    (c: GraphContact) => {
      if (onSelect) onSelect(c);
      else router.push(`/networking?contact=${encodeURIComponent(c.id)}`);
    },
    [onSelect, router],
  );

  const toLocal = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    userMovedRef.current = true;
    cancelAnimationFrame(tweenRef.current);
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const f = k / v.k;
      // Keep the point under the cursor fixed while the scale changes around it.
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  }, []);

  // React attaches wheel listeners as passive, which cannot preventDefault, so the
  // page would scroll while you zoom. A native listener can.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = toLocal(e.clientX, e.clientY);
      // Trackpad pinch arrives as a wheel with ctrlKey and much smaller deltas.
      const speed = e.ctrlKey ? 0.012 : 0.0015;
      zoomAt(x, y, Math.exp(-e.deltaY * speed));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt, contacts]);

  type Gesture =
    | { kind: "pan"; startX: number; startY: number; view: View }
    | { kind: "drag"; node: GNode; startX: number; startY: number; moved: boolean }
    | { kind: "pinch"; dist: number; cx: number; cy: number }
    | null;
  const gestureRef = useRef<Gesture>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());

  const pinchState = () => {
    const pts = [...pointersRef.current.values()];
    const [a, b] = pts;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toLocal(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, p);
    svgRef.current!.setPointerCapture(e.pointerId);
    if (pointersRef.current.size === 2) {
      // A second finger turns whatever the first was doing into a pinch.
      const g = gestureRef.current;
      if (g?.kind === "drag") releaseNode(g.node);
      gestureRef.current = { kind: "pinch", ...pinchState() };
      setDragId(null);
      return;
    }
    const id = (e.target as Element).closest("[data-node]")?.getAttribute("data-node");
    const node = id ? graph.nodes.find((n) => n.id === id) : undefined;
    if (node) {
      gestureRef.current = { kind: "drag", node, startX: p.x, startY: p.y, moved: false };
      setDragId(node.id);
    } else {
      gestureRef.current = { kind: "pan", startX: p.x, startY: p.y, view: viewRef.current };
    }
  };

  const releaseNode = (node: GNode) => {
    // Let go the way Obsidian does: the node rejoins the simulation instead of staying
    // pinned where you dropped it. With motion reduced there is no simulation running,
    // so it simply stays put.
    if (reduced) return;
    node.fx = null;
    node.fy = null;
    simRef.current?.alphaTarget(0);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const p = toLocal(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, p);
    const g = gestureRef.current;
    if (!g) return;
    if (g.kind === "pinch" && pointersRef.current.size === 2) {
      const next = pinchState();
      zoomAt(next.cx, next.cy, next.dist / (g.dist || 1));
      setView((v) => ({ ...v, x: v.x + next.cx - g.cx, y: v.y + next.cy - g.cy }));
      gestureRef.current = { kind: "pinch", ...next };
    } else if (g.kind === "pan") {
      const dx = p.x - g.startX, dy = p.y - g.startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        userMovedRef.current = true;
        cancelAnimationFrame(tweenRef.current);
      }
      setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
    } else if (g.kind === "drag") {
      // A few pixels of slop, so a click with a slightly shaky hand still opens the
      // person instead of nudging their dot.
      if (!g.moved && Math.hypot(p.x - g.startX, p.y - g.startY) < 4) return;
      g.moved = true;
      const v = viewRef.current;
      const x = (p.x - v.x) / v.k, y = (p.y - v.y) / v.k;
      g.node.fx = x;
      g.node.fy = y;
      if (reduced) {
        g.node.x = x;
        g.node.y = y;
        scheduleFrame();
      } else {
        simRef.current?.alphaTarget(0.25).restart();
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (g?.kind === "drag") {
      releaseNode(g.node);
      setDragId(null);
      if (!g.moved && e.type === "pointerup") select(g.node.contact);
    }
    // Lifting one finger of a pinch should not leave a half-gesture behind.
    gestureRef.current = null;
    if (pointersRef.current.size === 1 && g?.kind === "pinch") {
      const [p] = [...pointersRef.current.values()];
      gestureRef.current = { kind: "pan", startX: p.x, startY: p.y, view: viewRef.current };
    }
  };

  const resetView = () => {
    userMovedRef.current = false;
    fitView(!reduced);
  };

  // --- What is lit -----------------------------------------------------------------

  // While dragging, the dragged node owns the highlight even if the pointer slips off.
  const active = useMemo<Focus>(() => (dragId ? { kind: "node", id: dragId } : focus), [dragId, focus]);
  const lit = useMemo(() => {
    if (!active) return null;
    if (active.kind === "node") return new Set([active.id, ...(graph.neighbours.get(active.id) ?? [])]);
    return new Set(
      graph.nodes.filter((n) => norm(n.contact.company) === active.name).map((n) => n.id),
    );
  }, [active, graph]);
  const centerId = active?.kind === "node" ? active.id : null;

  const legend = useMemo(() => {
    const counts = new Map<string, { label: string; color: string; n: number }>();
    for (const n of graph.nodes) {
      const key = norm(n.contact.company);
      if (!key) continue;
      const cur = counts.get(key);
      if (cur) cur.n++;
      else counts.set(key, { label: n.contact.company.trim(), color: n.color, n: 1 });
    }
    return [...counts.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  }, [graph]);

  // --- Render ----------------------------------------------------------------------

  const { k } = view;
  // Labels arrive with zoom, as in Obsidian: at overview scale a big graph is just its
  // shape, and names fade in over 1.0-1.2x so they are fully there from 1.2x on. A
  // small graph fits at a scale past that, so it reads as named from the start; a big
  // one never prints every name at once over its own dots.
  const labelBase = clamp((k - 1) / 0.2, 0, 1);
  // Dots grow with the square root of zoom, not linearly. Zooming in is for reading
  // names and following lines; at 3x a linearly scaled dot is a coin that covers both.
  const dot = 1 / Math.sqrt(k);
  const hovered = centerId ? graph.nodes.find((n) => n.id === centerId) : undefined;
  let tooltipSide = 1;
  if (hovered) {
    let dx = 0;
    for (const id of graph.neighbours.get(hovered.id) ?? []) {
      const m = graph.nodes.find((n) => n.id === id);
      if (m) dx += (m.x ?? 0) - (hovered.x ?? 0);
    }
    tooltipSide = dx > 0 ? -1 : 1;
  }

  const shell = `relative w-full h-full overflow-hidden rounded-panel border border-line-2 bg-canvas select-none ${className}`;
  // The only place in the app with a dot grid: here it is a surface you pan across,
  // so it moves with the view and tells you that you are moving. Under it, a radial
  // lift from canvas to surface at the centre, so the canvas reads as a space rather
  // than a flat panel and the dots near the edge feel further away. The grid does not
  // scale with zoom; 24px dots that grew to 96px would stop reading as texture.
  const canvasStyle = {
    minHeight: MIN_HEIGHT,
    backgroundImage:
      "radial-gradient(var(--color-line-1) 1px, transparent 1px), radial-gradient(ellipse at center, var(--color-surface), var(--color-canvas) 70%)",
    backgroundSize: "24px 24px, 100% 100%",
    backgroundPosition: `${view.x}px ${view.y}px, center`,
  };

  if (error || isEmpty) {
    return (
      <div ref={wrapRef} className={shell} style={canvasStyle}>
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-meta text-fg-3">
          {error ? "Could not load your network." : "No people yet. Add someone on the Network page and they appear here."}
        </p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={shell} style={canvasStyle}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className={`absolute inset-0 touch-none ${dragId ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={`Network graph: ${graph.nodes.length} people, ${graph.links.length} mutual links`}
      >
        {contacts && (
          <g transform={`translate(${view.x},${view.y}) scale(${k})`}>
            <g>
              {graph.links.map((l) => {
                const s = l.source as GNode, t = l.target as GNode;
                if (typeof s !== "object" || typeof t !== "object") return null;
                // Focused edges are the ones out of the hovered node, or, when a legend
                // company is hovered, the ones between its people. They turn chalk and
                // thicken; everything else drops to 6% so the lit paths are the only
                // lines left to follow. At rest, lines are fg-3 at 28%: present enough
                // to show the clusters, quiet enough that the dots stay the subject.
                const on = centerId
                  ? s.id === centerId || t.id === centerId
                  : !!lit && lit.has(s.id) && lit.has(t.id);
                return (
                  <line
                    key={l.key}
                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    strokeOpacity={on ? 0.85 : lit ? 0.06 : 0.28}
                    strokeWidth={on ? 1.5 : 1}
                    vectorEffect="non-scaling-stroke"
                    style={{ stroke: on ? HIGHLIGHT : "var(--color-fg-3)", transition: "stroke-opacity 140ms" }}
                  />
                );
              })}
            </g>
            <g>
              {graph.nodes.map((n) => {
                const isLit = !lit || lit.has(n.id);
                const isCenter = n.id === centerId;
                const labelOpacity = lit ? (isLit ? 1 : 0.06) : labelBase;
                const r = n.r * dot;
                const hollow = n.shape === "hollow";
                return (
                  <g
                    key={n.id}
                    data-node={n.id}
                    transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                    opacity={isLit ? 1 : 0.18}
                    style={{ transition: "opacity 140ms", cursor: "pointer" }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.contact.name}${n.contact.company ? `, ${n.contact.company}` : ""}`}
                    onPointerEnter={() => !gestureRef.current && setFocus({ kind: "node", id: n.id })}
                    onPointerLeave={() => !gestureRef.current && setFocus(null)}
                    onFocus={() => setFocus({ kind: "node", id: n.id })}
                    onBlur={() => setFocus(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(n.contact);
                      }
                    }}
                    // The ring below is this node's focus indicator, drawn at the
                    // node's own size, so the browser's square outline is not needed.
                    className="outline-none"
                  >
                    {/* A larger invisible target: a 4px dot is hard to hit. */}
                    <circle r={Math.max(r, 9 / k)} fill="transparent" />
                    {/* A 1.5px ring with a 3px gap of canvas between it and the dot,
                        the same offset-ring shape as the app's focus outline. Chalk on
                        hover, rope when the node has keyboard focus. */}
                    {isCenter && (
                      <circle
                        r={r + 3.75 / k}
                        fill="none"
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                        className="stroke-fg-1 [g:focus-visible>&]:stroke-rope"
                      />
                    )}
                    {/* Hollow is drawn 0.75px inside the radius so its 1.5px stroke
                        lands on the same outer edge as a filled dot of that degree. */}
                    <circle
                      r={hollow ? Math.max(r - 0.75 / k, 0.5 / k) : r}
                      fillOpacity={n.shape === "faded" ? 0.4 : 1}
                      stroke={hollow ? n.color : "none"}
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      style={{ fill: hollow ? "var(--color-canvas)" : n.color }}
                    />
                    {labelOpacity > 0.01 && (
                      // Archivo, not mono: a name is text, not data. The canvas halo
                      // (stroke painted under the fill) keeps it legible where it
                      // crosses a line or another dot.
                      <text
                        y={r + 11 / k}
                        textAnchor="middle"
                        fontSize={11 / k}
                        opacity={labelOpacity}
                        strokeWidth={3 / k}
                        strokeLinejoin="round"
                        className="font-sans"
                        style={{
                          pointerEvents: "none",
                          paintOrder: "stroke",
                          fill: isCenter ? "var(--color-fg-1)" : "var(--color-fg-2)",
                          stroke: "var(--color-canvas)",
                          transition: "opacity 140ms",
                        }}
                      >
                        {n.contact.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        )}
      </svg>

      {!contacts && (
        <p className="absolute inset-0 flex items-center justify-center text-meta text-fg-3">Loading network…</p>
      )}

      {contacts && (
        <div className="pointer-events-none absolute left-3 top-3 text-meta text-fg-3">
          <span className="tabular-nums">{graph.nodes.length}</span> {graph.nodes.length === 1 ? "person" : "people"}
          <span className="mx-1 text-fg-4">·</span>
          <span className="tabular-nums">{graph.links.length}</span> {graph.links.length === 1 ? "link" : "links"}
        </div>
      )}

      <button
        type="button"
        onClick={resetView}
        title="Reset view"
        aria-label="Reset view"
        className={`${button("quiet", "compact")} absolute right-2 top-2`}
      >
        <LocateFixed size={14} strokeWidth={1.5} absoluteStrokeWidth />
        Reset
      </button>

      {contacts && graph.links.length === 0 && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 text-center text-meta text-fg-3">
          No mutual links yet. Add mutuals in a person&apos;s panel and they connect here.
        </p>
      )}

      {/* The legend doubles as a filter: hovering a company lights its people. The
          count is fg-3, not the guide's fg-4: fg-4 is 3.2:1 and a count is
          information, and nothing a person has to read goes below fg-3. */}
      {contacts && legend.length > 0 && graph.links.length > 0 && (
        <ul className="absolute bottom-3 left-3 flex max-w-[70%] flex-wrap gap-x-3 gap-y-1 text-meta text-fg-3">
          {legend.slice(0, 7).map((c) => (
            <li
              key={c.key}
              className="flex cursor-default items-center gap-1.5 transition-colors duration-90 ease-enter hover:text-fg-1"
              onPointerEnter={() => setFocus({ kind: "company", name: c.key })}
              onPointerLeave={() => setFocus(null)}
            >
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
              {c.label}
              <span className="font-mono text-data-sm text-fg-3">{c.n}</span>
            </li>
          ))}
          {legend.length > 7 && <li>+{legend.length - 7} more</li>}
        </ul>
      )}

      {hovered && !dragId && (
        <Tooltip node={hovered} side={tooltipSide} view={view} size={size} />
      )}
    </div>
  );
}

function Tooltip({
  node,
  side,
  view,
  size,
}: {
  node: GNode;
  /** Negative when the node's connections lie mostly to its right. */
  side: number;
  view: View;
  size: { w: number; h: number };
}) {
  const sx = (node.x ?? 0) * view.k + view.x;
  const sy = (node.y ?? 0) * view.k + view.y;
  const W = 200;
  const H = 66;
  const r = node.r * Math.sqrt(view.k);
  // Beside the dot, on the side away from its connections, so the lines and names
  // the hover just lit are the ones left uncovered. Above was tried first: on a hub
  // it sat squarely on the neighbours fanned out over it.
  // Clear of the name label too, which is centred under the dot and wider than it
  // (about 6px per character at 11px).
  const gap = Math.max(r + 12, node.contact.name.length * 3.1 + 10);
  const preferLeft = side < 0;
  const fitsRight = sx + gap + W <= size.w - 8;
  const fitsLeft = sx - gap - W >= 8;
  const left = (preferLeft ? fitsLeft || !fitsRight : !fitsRight && fitsLeft) ? sx - gap - W : sx + gap;
  const top = clamp(sy - H / 2, 8, size.h - H - 8);
  const c = node.contact;
  const warmth = c.warmth ? c.warmth[0].toUpperCase() + c.warmth.slice(1) : null;
  const meta = [c.stage || DEFAULT_STAGE, warmth].filter(Boolean).join(" · ");
  // The mutual count used to be the networking blue; it is plain metadata now, since
  // the lines the hover just lit already show the same thing.
  return (
    <div
      className="pointer-events-none absolute rounded-card border border-line-2 bg-raised px-3 py-2 shadow-float"
      style={{ left, top, width: W, minHeight: H }}
    >
      <div className="truncate text-body font-medium text-fg-1">{c.name}</div>
      {c.company && (
        <div className="flex items-center gap-1.5 truncate text-meta text-fg-2">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: node.color }} />
          {c.company}
        </div>
      )}
      <div className="text-meta text-fg-3">
        {meta}
        {node.degree > 0 && (
          <>
            <span className="mx-1 text-fg-4">·</span>
            <span className="tabular-nums">{node.degree}</span> {node.degree === 1 ? "mutual link" : "mutual links"}
          </>
        )}
      </div>
    </div>
  );
}
