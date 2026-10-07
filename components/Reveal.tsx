"use client";

import { useState, type ReactNode } from "react";

/**
 * A box that opens and closes in place (STYLE_GUIDE 4.6, `reveal`): it grows in
 * over 200ms and, on close, stays mounted for the 140ms it takes to fold away
 * before it is removed. `{open && <Form/>}` could only animate in, because the form
 * was gone the moment `open` went false.
 *
 * With reduced motion the global rule turns animations off, so no animationend
 * arrives to unmount it; it is removed at once instead.
 */
export function Reveal({ open, className = "", children }: { open: boolean; className?: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  // Mount on open during render rather than in an effect, so the first open frame
  // already has the box (and its enter animation) in it.
  if (open && !mounted) setMounted(true);

  if (!mounted) return null;
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!open && reduce) {
    setMounted(false);
    return null;
  }
  return (
    <div
      className={`${open ? "reveal" : "unreveal"} ${className}`}
      // Closing: no clicks or focus into a form that is leaving.
      inert={!open}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && !open) setMounted(false);
      }}
    >
      {children}
    </div>
  );
}
