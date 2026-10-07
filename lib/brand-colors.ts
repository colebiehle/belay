/**
 * Company colours. They are content, not chrome: a brand colour appears on the logo
 * tile, the slide-over's top and left edges, its header wash, its active tab's
 * underline and History markers, and the network graph's nodes, and on no other
 * control anywhere (STYLE_GUIDE 2.6). Every one of those goes through usableAccent.
 *
 * The first attempt sampled the company's logo on a canvas at runtime. It did not
 * work, for two reasons: the panel built the logo URL by stripping non-alphanumerics
 * off the company name, so "The New York Times" resolved to thenewyorktimes.com,
 * and Clearbit's response taints a cross-origin canvas, so even a correct URL
 * returned nothing readable.
 *
 * This is the honest version: a short hand-checked list, then the logo read through
 * /api/logo (lib/use-brand-color.ts). The fallback is not a degraded state: a
 * company with no colour gets a plain header, which looks like the rest of the app.
 */
const BRAND: Record<string, string> = {
  "google.com": "#4285F4",
  "apple.com": "#A2AAAD",
  "openai.com": "#10A37F",
  "anthropic.com": "#D4A27F",
  "figma.com": "#F24E1E",
  "stripe.com": "#635BFF",
  "netflix.com": "#E50914",
  "linear.app": "#5E6AD2",
  "microsoft.com": "#00A4EF",
  "adobe.com": "#FF0000",
  "notion.so": "#000000",
  "meta.com": "#0866FF",
  "airbnb.com": "#FF5A5F",
  "cursor.com": "#6E7681",
  "shopify.com": "#95BF47",
  "duolingo.com": "#58CC02",
  "amazon.com": "#FF9900",
  "aws.amazon.com": "#FF9900",
  "uber.com": "#09091A",
  "spotify.com": "#1DB954",
  "tiktok.com": "#FE2C55",
  "linkedin.com": "#0A66C2",
  "discord.com": "#5865F2",
  "ramp.com": "#F5C518",
  "snap.com": "#FFFC00",
  "snapchat.com": "#FFFC00",
  "strava.com": "#FC4C02",
  "riotgames.com": "#D32936",
  "epicgames.com": "#2A2A2A",
  "nintendo.com": "#E60012",
  "playstation.com": "#0070D1",
  "disney.com": "#113CCF",
  "nike.com": "#111111",
  "atlassian.com": "#0052CC",
  "asana.com": "#F06A6A",
  "ideo.com": "#000000",
};

/** Null means "no brand colour": no band, no wash, a neutral graph node. A choice, not a failure. */
export function brandColor(logoDomain: string): string | null {
  return BRAND[logoDomain.toLowerCase()] ?? null;
}

/**
 * Black or white, whichever is legible on `hex`.
 *
 * Written when the panel painted its stage chip in the brand colour: five of the
 * colours in this table are near-black (Notion, IDEO, Nike, Uber, Epic), so those
 * chips were black text on a black fill. Stage chips are a neutral ramp now and no
 * text sits on a brand fill, so nothing calls this today; it is kept for logo
 * plates, the one place a brand fill could still carry a mark or a letter.
 *
 * sRGB relative luminance, 0.5 as the switch point. Close enough for a chip, and it
 * needs no colour library.
 */
export function readableOn(hex: string): "#000000" | "#ffffff" {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return "#000000";
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#000000" : "#ffffff";
}


/**
 * Lift a brand colour that is too dark to function as an accent.
 *
 * Five of the colours in the table are effectively black: Notion and IDEO are
 * #000000, Nike is #111111, Uber is #09091A, Epic is #2A2A2A. The panel header band
 * and the graph nodes sit on near-black graphite, so those brands drew an invisible
 * band and a node that read as a hole punched in the canvas.
 *
 * The fix was a floor: the hue kept and the colour raised toward a dark grey until it
 * separated from the background. Since v1.6 those five are caught first by
 * isNeutralBrand and take NEUTRAL_BRAND; the floor is left for a dark brand that does
 * have a hue (a deep navy or green over 0.06 chroma), which it lifts toward grey.
 */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return 1;
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

const MIN_LUM = 0.12;

/**
 * The grey a near-black or near-white brand takes everywhere a brand colour appears
 * (the panel's top and left edges, its header wash, the active tab's underline, the
 * History markers, graph nodes). It is `fg-3`: 5.36:1 on the `raised` panel, so a
 * 3px edge and a 6px marker read clearly, and its 22% wash keeps `fg-1` at 10.25 and
 * `fg-2` at 6.26. Lifted black (#636374 for Uber) was a murky blue-grey, and white
 * was the brightest line on the screen with the weakest wash for text; neither said
 * anything a plain neutral does not (STYLE_GUIDE 2.6, v1.6).
 */
export const NEUTRAL_BRAND = "#90949A";

// OKLCH lightness and chroma, the axes the threshold is set on: sRGB luminance alone
// cannot tell a dark navy from a black, and chroma is what says "has a hue".
function oklch(hex: string): { l: number; c: number } | null {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return null;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B) };
}

/**
 * Near-black or near-white: OKLCH chroma under 0.06 (no hue you would name) and
 * lightness under 0.40 or over 0.90. Catches Notion, IDEO and Nike (C 0), Uber
 * (L 0.15, C 0.036), Epic (L 0.29), white and off-white logos, and pale tints like
 * #FFD6E0 (L 0.91, C 0.047). Leaves mid greys (Apple L 0.73, Cursor L 0.56), which
 * already read as a neutral, and every brand with a hue, including Snap's yellow
 * (L 0.96 but C 0.21) and Anthropic's clay (C 0.076).
 */
export function isNeutralBrand(hex: string): boolean {
  const v = oklch(hex);
  return !!v && v.c < 0.06 && (v.l < 0.4 || v.l > 0.9);
}

/**
 * The brand colour as it is drawn: the one rule every brand-coloured thing goes
 * through. A near-black or near-white brand becomes NEUTRAL_BRAND; any other brand
 * too dark to show on graphite is lifted (below); everything else is itself.
 */
export function usableAccent(hex: string): string {
  if (isNeutralBrand(hex)) return NEUTRAL_BRAND;
  if (luminance(hex) >= MIN_LUM) return hex;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return "#52525b";
  let [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Walk it up toward grey until it clears the floor. Pure black has no hue to
  // preserve, so it lands on a mid grey and reads as a deliberate neutral.
  for (let i = 0; i < 24 && luminance(`#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`) < MIN_LUM; i++) {
    r = Math.min(255, r + 10);
    g = Math.min(255, g + 10);
    bl = Math.min(255, bl + 10);
  }
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
