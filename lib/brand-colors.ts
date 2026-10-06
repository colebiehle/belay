/**
 * Company colours. They are content, not chrome: a brand colour appears on the logo
 * tile, the slide-over header's 3px band and 24% wash, and the network graph's
 * nodes, and on no control anywhere (STYLE_GUIDE 2.6).
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
 * The fix is a floor, not a replacement: the hue is kept and the colour is raised
 * toward a dark grey until it separates from the background. A brand that is actually
 * black still looks black-ish, it is just visible.
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

export function usableAccent(hex: string): string {
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
