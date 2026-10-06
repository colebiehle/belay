"use client";

import { useEffect, useState } from "react";
import { brandColor } from "@/lib/brand-colors";
import { logoUrl } from "@/lib/logo";

// Colours already read this session, keyed by the image they came from.
const cache = new Map<string, string | null>();

/**
 * The company's brand colour: the hand-checked table first, then the dominant
 * colour of its logo, read through /api/logo so the canvas can see the pixels.
 * The table covered about thirty companies, so every other one, Snap and every
 * startup included, had no colour at all.
 *
 * Null when neither gives a colour (a black or grey logo), and the panel header
 * stays plain: there is no theme hue to fall back to.
 */
export function useBrandColor(domain: string, logo?: string | null): string | null {
  const known = brandColor(domain);
  const src = logo ?? logoUrl(domain);
  const [read, setRead] = useState<{ src: string; color: string | null } | null>(null);

  useEffect(() => {
    if (known || cache.has(src)) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      const color = dominantColor(img);
      cache.set(src, color);
      if (live) setRead({ src, color });
    };
    img.onerror = () => cache.set(src, null);
    img.src = `/api/logo?src=${encodeURIComponent(src)}`;
    return () => {
      live = false;
    };
  }, [known, src]);

  if (known) return known;
  if (cache.has(src)) return cache.get(src) ?? null;
  return read?.src === src ? read.color : null;
}

// The most common saturated hue in the image, averaged. White backgrounds, black
// wordmarks, greys and transparent pixels are skipped: they are the setting the
// logo sits in, not its colour.
function dominantColor(img: HTMLImageElement): string | null {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>();
  let opaque = 0;
  let chromatic = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    opaque++;
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    if (s < 0.3 || l > 0.92 || l < 0.1) continue;
    chromatic++;
    let h = 0;
    const d = max - min;
    if (max === r / 255) h = ((g - b) / 255 / d) % 6;
    else if (max === g / 255) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
    const key = Math.round(((h * 60 + 360) % 360) / 15);
    const e = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 };
    e.w += s;
    e.r += r * s;
    e.g += g * s;
    e.b += b * s;
    buckets.set(key, e);
  }
  // A few coloured pixels in a black-and-white logo are antialiasing, not a brand.
  if (opaque === 0 || chromatic / opaque < 0.05) return null;
  const best = [...buckets.values()].reduce((a, b) => (b.w > a.w ? b : a));
  const hex = (v: number) => Math.round(v / best.w).toString(16).padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}
