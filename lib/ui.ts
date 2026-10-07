/**
 * The class recipes for the controls every page shares, from the style guide's
 * component specs (docs/brand/STYLE_GUIDE.md, 5.4, 5.5 and 5.9). They live here,
 * not in a component file, because a plain module can be imported from server and
 * client components alike, and because the same button was hand-written forty times
 * and drifted: a ring on one primary, `hover:opacity-90` on another, a pink border
 * on a third.
 *
 * Nothing here puts a company colour on a control. Brand colour is content (logo
 * tiles, the panel's wash, top and left lines and History markers, graph nodes) and
 * never touches a button, tab, select or link.
 */

export type ButtonKind = "primary" | "secondary" | "quiet" | "destructive";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 text-button rounded-control whitespace-nowrap transition-colors duration-90 ease-enter disabled:cursor-not-allowed";

const BUTTON_KIND: Record<ButtonKind, string> = {
  // One per view. Rope means "your next move", so a second rope fill on screen
  // dilutes the one that matters. Disabled drops the rope entirely: rope never
  // means "you can't".
  primary:
    "bg-rope text-on-rope enabled:hover:bg-rope-hover enabled:active:bg-rope-press disabled:bg-lift disabled:text-fg-4",
  secondary:
    "bg-surface border border-line-2 text-fg-1 enabled:hover:border-line-3 enabled:hover:bg-lift enabled:active:bg-lift disabled:text-fg-4",
  // Inline verbs: Cancel, Clear, Follow up, Undo.
  quiet: "text-fg-2 enabled:hover:text-fg-1 enabled:hover:bg-lift enabled:active:bg-line-2 disabled:text-fg-4",
  // Alarm only shows on hover, with the Trash glyph the caller puts inside.
  destructive: "text-fg-3 enabled:hover:text-alarm enabled:hover:bg-lift disabled:text-fg-4",
};

/** A button: 32px by default, 28px inside rows. */
export function button(kind: ButtonKind, size: "default" | "compact" = "default"): string {
  const box = size === "compact" ? "h-7 px-2.5" : "h-8 px-3";
  return `${BUTTON_BASE} ${box} ${BUTTON_KIND[kind]}`;
}

/** A square icon-only button (24px hit target minimum); give it an aria-label. */
export function iconButton(kind: ButtonKind = "quiet", size: "default" | "compact" = "default"): string {
  const box = size === "compact" ? "h-7 w-7" : "h-8 w-8";
  return `${BUTTON_BASE} ${box} ${BUTTON_KIND[kind]}`;
}

/**
 * A text input, select or textarea. Canvas fill so the field reads by its fill as
 * well as its border when it sits on a surface or a raised panel; the border is
 * line-input because it is the only cue on canvas and must clear 3:1. Focus adds a
 * rope border on top of the global focus ring.
 */
// `fit` sizes the field to its content, for a select beside a full-width input.
// Adding w-auto to a full-width field does not work: both classes land and the
// stylesheet's order, not the class list's, decides which wins.
export function input(size: "default" | "compact" = "default", fit = false): string {
  const box = size === "compact" ? "h-7" : "h-8";
  return `${box} ${fit ? "w-auto shrink-0" : "w-full"} ${FIELD}`;
}

/** The same frame without a fixed height, for textareas. */
export const textarea = () => `w-full py-1.5 ${FIELD}`;

const FIELD =
  "bg-canvas border border-line-input rounded-control px-2.5 text-body text-fg-1 placeholder:text-fg-3 hover:border-fg-3 focus:border-rope transition-colors duration-90 ease-enter disabled:text-fg-4 disabled:cursor-not-allowed";

/** A tag: relationship tags, queue tags. A lift fill and fg-2, no border: tone
 * separates it from the card, and a hairline round every tag drew a fence. */
export const tag =
  "inline-flex items-center gap-1 h-5 px-1.5 rounded-control bg-lift text-chip t-chip text-fg-2 whitespace-nowrap";

/** A filter toggle (company filter row, chip filters). Off is plain text you can
 * click; on is a filled key. No border either way. */
export function toggle(on: boolean): string {
  return `inline-flex items-center gap-1.5 h-6 px-2 rounded-control text-chip t-chip whitespace-nowrap transition-colors duration-140 ease-enter ${
    on ? "bg-lift text-fg-1" : "text-fg-2 hover:bg-lift hover:text-fg-1"
  }`;
}

/** A card, tile or list container: a surface fill and a 6px radius, no border. The
 * surface steps are far enough apart now that tone alone separates it from the page
 * (STYLE_GUIDE 4.3); hairlines are for row dividers, inputs and floating layers. */
export const card = "bg-surface rounded-card";

/** A card or tile that is itself a link or a button: hover steps the fill to lift. */
export const cardHover = "hover:bg-lift transition-colors duration-90 ease-enter";

/** An empty state where a list would be: dashed so it reads as "nothing here yet". */
export const emptyBox =
  "bg-surface border border-dashed border-line-2 rounded-card py-8 px-4 text-center text-body text-fg-3";

/** A keyboard hint box: 16px, mono, hairline. */
export const kbd =
  "inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-control border border-line-2 font-mono text-kbd font-medium tracking-[0.02em] text-fg-3";

/**
 * The slide-over header band: the brand at 22%, mixed in oklab so it keeps the
 * brand's hue rather than drifting grey, as one flat tint across the whole header
 * block. It used to be a gradient fading to the panel colour, which put the full
 * strength only on the top row and read as "a hint of colour" everywhere else; the
 * owner found it too subtle. Flat, the whole header is the brand at the strength the
 * top row already had, so the contrast floor is unchanged: measured in Chromium
 * (pixel-sampled on the flat band) on the v1.1 panel colour (#1E2023), the worst case
 * (a white brand) holds fg-1 at 7.64:1 and fg-2 at 4.67:1, and a black brand (lifted
 * by usableAccent) sits at 11.72 and 7.16. fg-3 falls to 2.92 on white, so it is
 * still not allowed on the band. (v1.3 brought back the fade and a 3px top line, and
 * v1.4 a matching left edge; see washOf, brandLine and brandEdge below.) One of the
 * four places company colour is allowed (STYLE_GUIDE 2.6).
 */
export const WASH_PCT = 22;

// v1.3: the gradient is back, under a solid brand line. Flat, the tint covered the
// whole header and read as "the panel is that colour"; the owner preferred the fade,
// and what it lacked was an anchor, now the 3px line (brandLine). The gradient starts
// at the measured 22% and only fades from there, so contrast never drops below the
// flat-band figures above.
export function washOf(brandHex: string): string {
  return `linear-gradient(180deg, color-mix(in oklab, ${brandHex} ${WASH_PCT}%, var(--color-raised)) 0%, var(--color-raised) 100%)`;
}

// The solid brand line along the panel's top edge: the company's true colour, once,
// at full strength. An inset shadow, so it adds no height to the header.
export function brandLine(brandHex: string): string {
  return `inset 0 3px 0 ${brandHex}`;
}

/**
 * The panel's left edge in the brand (v1.4): the same 3px and the same colour as the
 * top line, down the full height, in place of the neutral line-2 border. Together the
 * two lines frame the panel as the company's from the moment it slides in, while the
 * wash stays in the header. `brandHex` is already through usableAccent, so a black
 * brand is the same lifted grey here as on top. Without a brand the edge stays
 * line-2 (the aside's own class). No line on the bottom: the footer is controls.
 */
export function brandEdge(brandHex: string): { borderLeftColor: string; borderLeftWidth: number } {
  return { borderLeftColor: brandHex, borderLeftWidth: 3 };
}

/**
 * The one brand accent inside the panel body: the History timeline's markers, a 6px
 * dot per entry in the brand (fg-3 without one). A dot carries no text, so contrast
 * is not at stake, and it is content (the company's record), not a control: buttons,
 * tabs, selects and links stay neutral (STYLE_GUIDE 2.6).
 */
export const historyDot = "w-1.5 h-1.5 rounded-full shrink-0";
export function historyDotColor(brandHex: string | null): string {
  return brandHex ?? "var(--color-fg-3)";
}

/**
 * A section heading in a slide-over with its add button beside it. The button says
 * what it adds ("Add interview", not "Add") and sits right after the heading, 12px
 * on, rather than at the far edge of the panel: across 590px of empty row a bare
 * "+ Add" belonged to nothing in particular. The pair is one 28px row.
 */
export const sectionHead = "flex items-center gap-3 h-7";

/**
 * A queue card (role or person): one frame for both queues. Surface, no border at
 * rest (a transparent one holds the place of the cursor's, so the cursor moving
 * shifts nothing); the keyboard cursor is a 1px rope border, shown only once J or K
 * has been pressed. Hover steps the fill to raised, not lift, which is the tags' fill.
 */
// One fixed height for every queue card, roles and people, in every state. Sized to
// content, a card grew when a decision swapped its reading line and tags for the
// reason box, so the grid jumped under the cursor; 200px holds the tallest state.
export function queueCard(focused: boolean): string {
  return `group/row h-[200px] overflow-hidden flex flex-col bg-surface border rounded-card p-4 transition-colors duration-90 ease-enter ${
    focused ? "border-rope" : "border-transparent hover:bg-raised"
  }`;
}

/**
 * A list card (Roles → Active, People → Network): one frame for both lists, in a
 * grid of three at 1440, two at about 1024 and one on a phone (`listGrid`). Surface,
 * no border, 12px padding (the compact card, 4.1); hover steps to lift like a row.
 * Selected (its panel is open) is the row's treatment carried over: rope-wash with a
 * 2px rope bar inside the left edge, drawn as an inset shadow so it follows the
 * corner radius and shifts nothing. `h-full` so every card in a grid row is the
 * height of the tallest, which keeps the row calm when one card has an interview line
 * and its neighbour does not. Keyboard focus on the card's open button rings the
 * whole card (the button covers it), not just the name: that rule is in globals.css
 * (`[data-list-card]`), beside the global focus ring it has to outrank.
 */
export function listCard(selected: boolean, flash = false): string {
  return `group/row relative h-full flex gap-3 p-3 rounded-card transition-colors duration-90 ease-enter ${
    selected
      ? "bg-rope-wash shadow-[inset_2px_0_0_var(--color-rope)]"
      : flash
        ? "bg-lift"
        : "bg-surface hover:bg-lift"
  }`;
}

/** The grid the list cards sit in: 1 across on a phone, 2 from md (768), 3 from xl (1280). */
export const listGrid = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2";

/** The card's primary name (the company on a role card, the person on a person
 * card): 16px semibold, the largest text on the card, so it is what the eye lands on.
 * At 14px it was the same size as the line under it and only weight told them apart. */
export const cardTitle = "text-h3 text-fg-1";

/** The line under it: the role title, or "Company · Role" as in the person panel. */
export const cardSub = "text-body text-fg-2 truncate";

/** The verdict buttons on a queue card (Pass, Accept, Add) keep one width in every
 * state: at rest, under the keyboard cursor with its key hint, and decided with its
 * check. They used to size to their content, so a click that swapped the hint for a
 * check made the button jump. */
export const verdictWidth = "w-[5.5rem]";
/**
 * The external-link icon after a name (People and Pipeline rows, person cards). It
 * shows on hover of the row or card (which carries `group/row`) and on keyboard
 * focus, and stays in the tab order while hidden: at rest a column of identical link
 * icons was the loudest pattern in the list (STYLE_GUIDE 5.6).
 */
export const revealLink =
  "shrink-0 text-fg-3 hover:text-fg-1 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-[color,opacity] duration-90 ease-enter";
