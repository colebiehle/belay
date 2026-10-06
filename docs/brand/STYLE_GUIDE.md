# Belay style guide

*Version 1.2, 6 October 2026. Supersedes the three proposals in `docs/brand/proposals/`.
This is the decision. The proposals stay as the record of the argument. Version 1.1
folds in a design critique of the shipped rebrand; version 1.2 folds in the owner's
feedback on the queues, lists, panels and add forms. Every change each made is listed,
with its reason, in Part 3 at the end.*

How to read this: Part 1 explains the rulings and why they were made. Part 2 is the
spec. If you are only implementing, start at Part 2. Every value in Part 2 is final
unless it is marked "verify".

---

## Part 1. Deliberation

### What the three proposals agree on (adopted as-is)

- **Company colour is content, not chrome.** All three put brand colour only on
  logo tiles, the panel header and graph nodes. The current code breaks this rule in
  `ContactPanel.tsx`, which applies the brand `accent` to the Save button, link text,
  input borders, the stage `<select>` fill, the panel's left border and section
  eyebrows (about 25 `style={{ color: accent }}` and `borderColor: accent` sites).
  All of that goes.
- **One accent, rope orange.** Two of the three chose it independently (`#F57F3A` and
  `#F0803C`). The third chose a yellow highlighter.
- **Hierarchy comes from lightness, not shadow.** The surface gets lighter as it gets
  closer to you. Tone does the structure; hairlines only where tone cannot (v1.1, see
  4.3). Shadows only on things that float.
- **The dot grid comes off content pages.** Two of the three move it to the network
  graph only. The third keeps it on the page ground.
- **The dimmest readable text is at least 4.5:1.** Today `text-zinc-600` and
  `text-zinc-700` carry real information ("no summary", counts, "How we met") at about
  2.6:1 and below. All three proposals fix this.
- **Lucide at a 1.5px stroke. Motion confirms, never performs. No springs.** The
  graph settles and then stops.
- **Voice.** Plain, numeric, no exclamation marks, no AI theatre, "Scan" instead of
  "ingest". The code comments are the voice. The UI should sound like them, in fewer
  words.

### Where they conflict, and the rulings

| # | Question | Ruling | Why (tied to the owner's constraints) | Best case for the losing side |
|---|---|---|---|---|
| 1 | Accent hue | **Rope orange `#F67F3D`.** Not the yellow highlighter. | It is the most visible hue on a neutral ground, and it sits furthest from the blues and violets that dominate the target list (Stripe, Meta, LinkedIn, Notion, Perplexity), so it does not compete with company colour in panels. It also ties to the name. | Yellow means neither section and sits further from alarm red. Orange shares a neighbourhood with Figma, Airbnb and Anthropic's clay. |
| 2 | Do pink and blue survive as section accents? | **No. Both are retired from the UI.** Stage ramps become one shared neutral ramp. The heatmap becomes one ramp. The nav underline is rope on every page. | "Practical, dense, legible" means each hue gets one job. Pink and blue only tell you which side of the app you are on, which the nav and the page title already say. They also forced a third chrome hue (`accent-both`) and a separate alarm hue. Removing them is what lets company colour be the only colour in a panel. | They are a learned mapping, and the half-rope argument is real: two strands in two colours, so one person never mixes them up. |
| 3 | Type families: one (Plex Sans + Plex Mono), two (Archivo + Plex Mono) or three (Newsreader + Instrument Sans + Plex Mono) | **Two: Archivo for everything, IBM Plex Mono for numbers that get compared.** | One working face keeps it dense and quick to build. Archivo's width axis gives the wordmark and labels a stamped, engineered look. It reads as a decision without needing a serif. A serif on a dark, dense triage tool is the "precious" the owner ruled out. | A serif display face makes the tool look authored and editorial, which is good for a portfolio. Plex Sans with Plex Mono share metrics exactly. |
| 4 | Warm or cool neutrals | **Cool-neutral graphite**: OKLCH hue 260 at chroma 0.004 to 0.010. Close enough to grey that it reads as neutral. | Company colours are the point of the panels, so the ground has to sit as close to neutral as possible. Warm greys turn brown next to an orange accent and look like a theme. A faint cool tint makes orange stand out by complement. | Warm granite or paper is easier on the eyes in month four of a stressful search, and less "developer tool". |
| 5 | Density | **Set per surface, never by the user.** Queue: comfortable cards. Every list: two-line rows in one container instead of separate cards (44px in v1, 56px since v1.2). No density setting. | Daily use and fast scanning. The people list today spends about 66px per person in separate cards. At 44px, a 900px viewport shows about 14 people instead of 8. A setting is one more thing to maintain in a solo codebase. | A user setting would cover the laptop screen and the large monitor, and the days you want air. |
| 6 | Network graph | **A hybrid.** Instrument-style canvas (the dot grid lives only here, and the simulation stops when it settles). Company-coloured nodes, kept. Stage is encoded as a hollow or filled node, the notebook's idea. Rope orange is the only highlight. | Graph nodes are the second place company colour belongs, and the owner likes it. Hollow versus filled works without colour. Stage-weighted edges (the chalk-and-rope proposal) do not fit the data: edges are mutual links between two contacts, not your relationship with either one. | A pure topo (single ink, stage on edges) would be the most distinctive portfolio image. |
| 7 | Logo | **The top-rope arch** (from "quiet instrument"). Not the figure-eight knot. | Two proposals chose the knot, but it fails two practical tests. Its over-and-under crossing turns to mush at 16px, and Gemini reliably draws knots wrong, so the owner would be fixing topology instead of refining. The arch is three points and one line. It is literally a belay (anchor, climber, belayer), it is a three-node graph fragment for the network side, and it holds at favicon size. | The figure-eight is the most trusted object in climbing, checked by a partner, and it doubles as a B. |
| 8 | Panel header: brand wash or a 4px strip | **Keep the wash**, made safer: a brand tint (16% at rollout, 24% after, 22% since the v1.1 panel colour; see 2.6), a gradient fading to the panel colour until v1.2 and a **flat band across the whole header** since. Nothing else in the panel takes brand colour. (The 3px brand band that sat on the top edge was dropped in v1.1: on orange brands it read as rope.) | The owner asked for this explicitly. Contrast is measured: at 22% on the v1.1 `raised`, `fg-1` stays at 7.64:1 or better and `fg-2` at 4.67:1 or better across the whole flat band against every tested brand, including pure white and Snap yellow. | A strip says the panel is about your relationship with the company, not the company's marketing. |
| 9 | Pills | **No pills except dots and avatars.** Chips, stage chips, filter toggles and count badges are 4px rectangles. | Rectangles are denser and read as controls on an instrument. Pills read as friendly decoration. | Pill for "moves along a track", rectangle for "holds things" gives shape a meaning. |
| 10 | Notebook grammar (date margin, dashed means tentative) | **Adopt two pieces.** A dashed border means written but not sent (the **Drafted** stage chip and unsent drafts). A fixed mono date column goes on log-shaped lists (history, timeline, Coming up). No double rules, no 72px margin on the queue. | Both carry meaning without colour, and Drafted is a stage the owner built specifically to make visible. | The full ledger system is what makes the notebook direction coherent. Partial adoption weakens it. |

### What this direction is, in one line

Quiet instrument's discipline, chalk-and-rope's accent and condensed type, and the
notebook's two non-colour encodings. The colour on screen belongs to the companies.
The one orange on screen is your next move.

---

## Part 2. The style guide

### 1. Vibe

**A well-made instrument for a long climb: graphite and chalk, other people's colours
in the panels, and one rope-orange line that marks your next move.**

- **Five adjectives:** exact, dense, calm, load-bearing, unfussy.
- **Never:**
  1. **Themed.** No mountains, carabiners, rope textures, climbing jargon in copy, or
     paper or grain effects.
  2. **Motivational.** No cheering, no confetti, no "You've got this", no exclamation
     marks.
  3. **Decorative.** No gradients on chrome, no glass, no glow, and no colour that
     doesn't have a job. The only gradient is the graph canvas lift (the brand header
     is a flat tint since v1.2).

### 2. Colour

#### 2.1 Principles

1. **Lightness does the hierarchy.** Surfaces get lighter as they come closer. Text
   gets dimmer as it matters less.
2. **Rope means one thing: your next move, or where you are.** That covers the primary
   button, the focus ring, the active nav item, today in the heatmap, the queue count,
   an overdue follow-up, and the graph highlight. If more than about 3% of a screen is
   orange, something is wrong.
3. **Company colour is content.** It appears only in the places listed in 2.6.
4. **A semantic colour is never the only signal.** See 2.4.
5. **Chrome chroma stays under 0.010** everywhere except rope and the semantic colours.

#### 2.2 Dark palette (the default)

All ratios are WCAG 2.x relative luminance contrast, computed by script
(OKLCH → linear sRGB → relative luminance), not estimated. Columns: against the page
background (`canvas`), cards (`surface`), panels (`raised`), and hover or selected
(`lift`).

**Surfaces and lines**

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | vs lift | Use |
|---|---|---|---|---|---|---|---|
| `canvas` | `#0D0E10` | `oklch(0.165 0.004 260)` | — | 1.10 | 1.18 | 1.34 | Page background, input fill on panels |
| `surface` | `#17191C` | `oklch(0.213 0.007 258)` | 1.10 | — | 1.08 | 1.23 | Cards, tiles, list containers, tab bar |
| `raised` | `#1E2023` | `oklch(0.243 0.006 258)` | 1.18 | 1.08 | — | 1.14 | Slide-over panels, popovers, modals, tooltips |
| `lift` | `#282A2E` | `oklch(0.285 0.008 264)` | 1.34 | 1.23 | 1.14 | — | Row and tile hover, tags, toggle on, active tab segment |
| `line-1` | `#1E2023` | `oklch(0.243 0.006 258)` | 1.18 | 1.08 | — | 1.14 | Dividers between rows inside a container |
| `line-2` | `#2F3236` | `oklch(0.315 0.008 260)` | 1.50 | 1.37 | 1.27 | 1.12 | Floating-layer edges, panel and header rules, secondary button, step-0 stage chip |
| `line-3` | `#4A4D52` | `oklch(0.420 0.009 260)` | 2.28 | 2.08 | 1.92 | 1.69 | Hover border on secondary buttons, the dashed Drafted chip |
| `line-input` | `#63666B` | `oklch(0.509 0.009 261)` | **3.35** | **3.06** | 2.83 | 2.49 | Input and checkbox borders (the 3:1 non-text rule on canvas and surface) |
| `plate` | `#E6E8EB` | `oklch(0.930 0.005 258)` | 15.73 | 14.35 | 13.30 | 11.71 | The plate behind a company logo |

*Why these values (v1.1).* The surface steps were 1.06 and 1.07 apart, too close for
tone alone to separate a card from the page, so every card needed a hairline. They are
now 1.10, 1.08 and 1.14 apart with `canvas` unchanged, which is enough for a tile to
read as a tile with no border (4.3). `line-1` used to equal `lift`, so a hovered row
merged with the dividers above and below it; it now sits one step under `lift`.
`line-input` rose from `#606368` because on the lighter `surface` it would have fallen
to 2.92, under 3:1. `plate` replaces pure white behind logos: white was the brightest
thing on every screen (17.6:1 on `surface`), and a plate a step under `fg-1` keeps
every logo legible without the glare.

**Text**

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | vs lift | Use |
|---|---|---|---|---|---|---|---|
| `fg-1` | `#ECEEF0` | `oklch(0.948 0.004 260)` | **16.60** | **15.14** | **14.04** | **12.36** | Names, titles, values, primary text |
| `fg-2` | `#B9BCC1` | `oklch(0.795 0.008 260)` | **10.14** | **9.25** | **8.57** | **7.55** | Body copy in panels, role titles, secondary text |
| `fg-3` | `#90949A` | `oklch(0.665 0.010 260)` | **6.33** | **5.78** | **5.36** | **4.72** | Metadata, labels, placeholders, timestamps. **The dimmest readable text.** |
| `fg-4` | `#606369` | `oklch(0.500 0.010 260)` | 3.21 | 2.92 | 2.71 | 2.39 | Disabled controls and `·` separators only. Never information. |

`fg-3` passes AA (4.5:1) on every surface, including hover (4.72 on the v1.1 `lift`,
and 4.71 on `rope-wash`). That is why it is the floor. Nothing a person has to read uses `fg-4`.

#### 2.3 Accent: Rope

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | vs lift | Use |
|---|---|---|---|---|---|---|---|
| `rope` | `#F67F3D` | `oklch(0.72 0.165 47)` | **7.38** | **6.73** | **6.24** | **5.49** | Primary button fill, focus ring, active nav underline, rope text |
| `rope-hover` | `#FD9C5D` | `oklch(0.78 0.140 52)` | 9.28 | 8.46 | 7.85 | 6.91 | Hover on rope fills and rope text |
| `rope-press` | `#E06C34` | `oklch(0.66 0.160 44)` | 5.85 | 5.34 | 4.95 | 4.36 | Pressed |
| `rope-wash` | `#412212` | `oklch(0.29 0.055 47)` | 1.34 | 1.23 | 1.14 | 1.00 | Selected row background |
| `on-rope` | `#0D0E10` (= `canvas`) | — | — | — | — | — | Text and icons on a rope fill |

- Text on rope: `on-rope` on `rope` is **7.38**, on `rope-hover` **9.28**, on
  `rope-press` **5.85**. **White on rope is 2.62. Never use it.**
- On `rope-wash`: `fg-1` **12.35**, `fg-2` **7.54**, `rope` **5.49**.
- **Disabled** primary button: `lift` fill, `fg-4` text, no rope. Rope never means "you
  can't".
- **Focus ring:** `outline: 2px solid rope; outline-offset: 2px`. The offset shows the
  canvas behind it, so the ring is 7.38:1 against that gap, even next to a logo plate.
  **On a rope fill the ring is `fg-1`** (16.60 against the canvas gap): a rope ring
  around a rope button is the same colour twice and does not read as focus (v1.1).

#### 2.4 Semantic colours

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | Meaning |
|---|---|---|---|---|---|---|
| `ok` | `#7FCC94` | `oklch(0.78 0.110 152)` | 10.09 | 9.20 | 8.53 | It happened: sent, scan succeeded, offer |
| `warn` | `#ECCA6C` | `oklch(0.85 0.120 90)` | 12.17 | 11.10 | 10.29 | Getting close: due within 2 days, a source returned 0 rows |
| `alarm` | `#F0626E` | `oklch(0.68 0.175 18)` | 6.14 | 5.60 | 5.19 | Stale or broken: failed scan arm, posting opened 7+ days ago and not sent, destructive hover |

**Pairing rule (no exceptions):** a semantic colour always comes with a glyph **and**
a word or number. Examples: `● 9d stale`, `[!] LinkedIn arm failed`, `[✓] Sent`.
Semantic colours appear as a 6px dot, a 14px Lucide glyph, or text. They never fill a
row, card or chip. Alarm and rope are only 1.2:1 apart in luminance and separated by
29° of hue, so they must never be told apart by colour alone.

**Overdue follow-up is not alarm.** It is an action, so it uses rope: the
`Clock` glyph plus `9d` in `rope`, plus a quiet "Follow up" button. This matches the
existing intent in `networking/page.tsx`: "a to-do marker, not an alarm".

#### 2.5 Section accents: retired

`accent-pink`, `accent-pink-light`, `accent-blue` and `accent-both` are removed. Their
jobs are reassigned:

| Old job | New treatment |
|---|---|
| Active nav item (pink or blue by page) | `fg-1` text with a 2px `rope` underline, the same on every page |
| Primary header button | `rope` fill |
| Tab count badges | Mono numeral, see 5.3 |
| Pipeline stage ramp (pink) and contact stage ramp (blue) | **One shared neutral ramp**, see 5.5 |
| Heatmap pink, blue and both | One neutral ramp, with the side breakdown in the day detail, see 5.12 |
| Tier S and A badges (pink) | Chalk fill and chalk outline, see 5.5 |
| Graph highlight (blue) | `rope` |
| Home signal card headings (pink and blue) | `t-section` headings, "Applications" and "Network", like every other block on Home (v1.2) |

Fallback, only if the owner misses the cue after two weeks of use: a 2px section tick
to the left of the page title. It must be argued for. Do not ship it by default.

#### 2.6 Company colour rules

The brand colour `B` is `usableAccent(brandColor(domain))` from `lib/brand-colors.ts`.

**Allowed, and only here:**

1. **Logo tiles** (the logo itself, on the `plate` token `#E6E8EB`, never pure white,
   at full strength).
2. **Slide-over header band** (role panel and contact panel):
   - a **flat** background of `color-mix(in oklab, B 22%, var(--color-raised))`
     across the header block only (logo, name, title, stage), with no fade. It stops
     at the header's bottom border (`line-2`). The recipe is `washOf()` in `lib/ui.ts`.
   - **Why flat (v1.2).** It was a gradient from 22% at the top row to the bare panel
     colour at the bottom border, so most of the header sat at a few percent and the
     owner read it as "too subtle". Flat, the whole header carries the strength only the
     top row had, so nothing about the contrast floor moves: the old worst case was
     measured at the top row, and the top row is now everywhere.
   - Text on the band: `fg-1` and `fg-2` only. Measured in Chromium (pixel-sampled on
     the flat band, v1.2) on the `#1E2023` panel:

     | Brand `B` (after `usableAccent`) | Band | `fg-1` | `fg-2` | `fg-3` |
     |---|---|---|---|---|
     | White `#FFFFFF` | `#484A4D` | **7.64** | **4.67** | 2.92 |
     | Snap `#FFFC00` | `#484A30` | 7.86 | 4.80 | 3.00 |
     | Figma `#F24E1E` | `#492E28` | 10.59 | 6.47 | 4.04 |
     | Google `#4285F4` | `#27354C` | 10.62 | 6.49 | 4.05 |
     | Stripe `#635BFF` | `#2B2F4E` | 11.15 | 6.81 | 4.25 |
     | Uber `#09091A` → `#636374` | `#2C2E33` | 11.68 | 7.13 | 4.46 |
     | Black `#000000` → `#646464` | `#2C2E30` | 11.72 | 7.16 | 4.47 |

     **`fg-1` ≥ 7.64, `fg-2` ≥ 4.67** (both worst cases are the white brand). `fg-3`
     drops under 3 on light brands, so it is **not allowed on the band**; a stage chip
     there whose step would use `fg-3` takes `fg-2` instead (5.5). (v1.1 quoted 7.76
     and 4.74 for the same 22% from a sample at the gradient's first row, which
     sub-pixel blending had already pulled a fraction toward the panel colour.)
   - **Why 22% (v1.1).** `raised` moved from `#1B1D1F` to `#1E2023`. Re-measured the
     same way, 24% on the lighter panel drops the white brand to `fg-1` 7.30 and `fg-2`
     **4.46, under AA**; 22% brings it back to 7.76 and 4.74, the figures 24% gave on
     the old panel, and the brand reads at the same strength because the base is
     lighter. The history of the step:
   - **Why 24%** (raised from 16% in October 2026, when 16% read as "a tint of grey"
     on most brands; measured on the old `#1B1D1F` panel). The steps compared, worst
     case across the eight brands:

     | Wash | `fg-1` worst | `fg-2` worst | Reads as the brand? |
     |---|---|---|---|
     | 16% | 9.83 | 6.00 | Only the saturated ones (Figma, Stripe); Google and Airbnb read as grey-blue and grey-brown |
     | **24%** | **7.77** | **4.75** | Yes for every chromatic brand; black and white brands stay neutral, as they should |
     | 32% | 6.05 | 3.69 | Yes, but fails: `fg-1` under 7 and `fg-2` under AA on white and yellow (3.83) |

     The rule that came out of this holds on any panel colour: the wash is the
     strongest step where `fg-1` stays above 7:1 and `fg-2` above 4.5:1 on every brand.
     It is the ceiling, not a starting point: do not raise it, or lighten `raised`,
     without re-measuring the white and yellow cases.
   - **No band** (v1.1). The 3px brand band on the top edge was removed: on an orange
     brand (Figma's, Amazon's, Strava's) it sat a few degrees from rope and read as
     "your next move" across the top of the panel. The wash already names the brand.
   - Remove the blurred blob (`blur-3xl` at 20%). The band replaces it.
3. **Network graph nodes and their legend swatches** (see 5.13).
4. **Company filter chip swatch:** a 6px dot of `B` before the company name is
   allowed. The chip itself stays neutral.

**Forbidden:** button fills and text, link text, input borders, focus rings, stage
chip fills, tab underlines, panel borders (the left border is `line-2`), section
eyebrows, icons, and selection highlights. Every one of these uses tokens.
`readableOn()` is then no longer needed for chips and can be kept for logo plates only.

#### 2.7 Light theme (future work)

Not in v1. Dark is the product. The starting values below are computed, so a later
light theme does not reopen the debate.

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised |
|---|---|---|---|---|---|
| `canvas` | `#F9FAFB` | `oklch(0.985 0.002 260)` | — | 1.05 | 1.04 |
| `surface` | `#FFFFFF` | `oklch(1 0 0)` | 1.05 | — | 1.09 |
| `raised` | `#F4F5F7` | `oklch(0.97 0.003 260)` | 1.04 | 1.09 | — |
| `lift` | `#E9EBEE` | `oklch(0.94 0.004 260)` | 1.14 | 1.19 | 1.09 |
| `line-2` | `#D9DBDE` | `oklch(0.89 0.005 260)` | 1.33 | 1.39 | 1.27 |
| `line-input` | `#83868B` | `oklch(0.62 0.008 260)` | 3.50 | 3.65 | 3.35 |
| `fg-1` | `#191B1D` | `oklch(0.22 0.006 260)` | 16.53 | 17.27 | 15.83 |
| `fg-2` | `#4A4D52` | `oklch(0.42 0.008 260)` | 8.12 | 8.49 | 7.78 |
| `fg-3` | `#686C72` | `oklch(0.53 0.010 260)` | 5.05 | 5.28 | 4.84 |
| `rope` | `#BA480D` | `oklch(0.55 0.16 42)` | 5.00 | 5.22 | 4.79 |
| `alarm` | `#BE2D39` | `oklch(0.53 0.18 22)` | 5.55 | 5.79 | 5.31 |
| `ok` | `#287C42` | `oklch(0.52 0.12 150)` | 4.96 | 5.18 | 4.75 |
| `warn` | `#976200` | `oklch(0.54 0.12 75)` | 4.95 | 5.17 | 4.74 |

In light mode, text on a rope fill is white (5.22). The brand wash drops to 10%.

### 3. Typography

#### 3.1 Families (Google Fonts)

- **Archivo** (variable: `wght` 100–900, `wdth` 62–125). Used for all UI, body,
  headings, labels and the wordmark.
  - It is a sturdy grotesque with open apertures that holds up at 11–12px on dark
    backgrounds.
  - **The width axis is the brand move.** Labels run at width 80, the wordmark at 75,
    and chips at 87 for density. That gives the stamped, engineered look of a gear
    label without a second family.
  - It is not Inter, Roboto, Arial, Geist or the system stack, which are the faces
    that make a tool look undesigned.
- **IBM Plex Mono** (static 400 and 500). Used only for **numbers in a column or a
  log** (v1.1):
  - the right-hand day count on list rows (`12d`, `+12d`), dates and times in log
    columns (`06 Oct`), the heatmap's Day and Year columns, the queue card score,
    the character counter, and keyboard hints.
  - **Inline numbers are Archivo with `tabular-nums`:** counts in tabs and group
    headers, the next-action line, "28 of 34", and every number on the meta line
    (`2d old`, `5+ yrs`, `$169–303k`).
  - **Never** for names, sentences, buttons or labels.
  - *Why:* mono's job is to make a column line up. Inline, a mono figure sits a
    different width and colour of type from the words around it, so "28 of 34" or a
    salary read as code pasted into a sentence.

Not used: a serif (too precious for a triage tool) or a third family.

#### 3.2 Loading (Next.js 16, `next/font/google`)

In `app/layout.tsx`:

```tsx
import { Archivo, IBM_Plex_Mono } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],          // weight is variable by default; add the width axis
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],  // static font: weights are required
  variable: "--font-plex-mono",
  display: "swap",
});

// <html lang="en" className={`dark ${archivo.variable} ${plexMono.variable}`}>
```

- In `globals.css`, map the variables in `@theme inline` (see 9.1) so `font-sans` and
  `font-mono` resolve to them.
- Remove the `font-family` line on `body` in `globals.css`, and the inline
  `background` and `backgroundImage` style on `<body>` in `layout.tsx`.
- Width is set with `font-stretch` (for example `font-stretch: 80%`), which maps to
  `wdth`. **Verify** that the generated `@font-face` declares a `font-stretch` range.
  If it doesn't, use `font-variation-settings: "wdth" 80` in the same utilities.

#### 3.3 Type scale

The base size is 14px. Line heights sit on a 4px grid (22px is the one exception,
for 16px). Negative tracking only at 16px and above. Weights in use: 400, 500 and 600
(700 only for the wordmark).

**Seven sizes and no more (v1.1): 11, 12, 14, 16, 20, 24, 28.** The 13px step and the
10px key hint are gone. Below 14 the scale steps by one pixel at a time and the eye
cannot tell 12 from 13, so two names for nearly one size only produced drift; above 14
it grows by about 1.2 per step, which is a difference you can see.

| Token | Family | Size / line | Weight | Width | Tracking | Use |
|---|---|---|---|---|---|---|
| `display` | Archivo | 28 / 32 | 600 | 100 | −0.02em | At most one per page: Insights' headline number |
| `stat` | Archivo, `tnum` | 28 / 32 | 600 | 87 | −0.01em | The signal numbers on Home and Insights |
| `h1` | Archivo | 24 / 32 | 600 | 100 | −0.015em | Page titles |
| `h2` | Archivo | 20 / 28 | 600 | 100 | −0.01em | Panel titles: person or role name in a slide-over |
| `h3` (`t-section`) | Archivo | 16 / 22 | 600 | 100 | −0.005em | Section headings, on a page ("Progress", "Companies", "Sites", "Coming up") and in a slide-over ("History", "Mutuals", "Notes"), and the titles of the add forms (5.9). Always `fg-1`, sentence case. As `text-h3` it is also the **primary name on a queue card** (`cardTitle`, v1.2), the largest text on the card |
| `name` | Archivo | 14 / 20 | 600 | 100 | 0 | A name in a row or card: person, company, role |
| `body` | Archivo | 14 / 20 | 400 | 100 | 0 | Headlines, notes, chat, summaries, the next-action line, empty states |
| `button` | Archivo | 14 / 20 | 500 | 100 | 0 | Buttons and tabs |
| `meta` | Archivo | 12 / 16 | 400 | 100 | +0.005em | Metadata lines, the second line of a row, helper text, tile names |
| `group` (`t-group`) | Archivo | 12 / 16 | 600 | 100 | +0.01em | **Group names inside a section**, sentence case, `fg-3`: "S-tier", "Scanned for you", "Applied", "Identified". The count beside it is `meta` `tabular-nums` |
| `chip` | Archivo | 12 / 16 | 500 | 87 | +0.01em | Stage chips, tags, filter toggles |
| `data` | Plex Mono | 12 / 16 | 400 | — | 0 | Numbers in a column or log: day counts, log dates, scores |
| `label` (`t-label`) | Archivo, uppercase | 11 / 16 | 600 | 80 | +0.08em | **Column headers only** ("DAY", "YEAR"). The two halves of Home's overview are section headings, not labels (v1.2). At most one row of them per section. Always `fg-3` |
| `data-sm` | Plex Mono | 11 / 16 | 400 | — | 0 | Graph legend counts, the character counter |
| `kbd` | Plex Mono | 11 / 14 | 500 | — | +0.02em | Key hints in a 16px box with a 1px `line-2` border and 4px radius |
| `wordmark` | Archivo, uppercase | 13 / 16 | 700 | 75 | +0.14em | "BELAY" in the nav and lockup. A logotype, not a step of the scale, so it keeps its 13 |

**The heading ladder.** Four steps, and each one changes size or colour, so no single
cue has to carry the difference:

| Step | Style | Example |
|---|---|---|
| Page title | `text-h1` 24px `fg-1` (in a slide-over: `text-h2`, 20px) | Home, Applications |
| Section heading | `t-section`, 16px `fg-1` sentence case (the same in a slide-over) | Progress, Companies, History |
| Group name | `t-group`, 12px semibold `fg-3` sentence case | S-tier, Applied, Scanned for you |
| Body | `text-name` / `text-body` `fg-1`/`fg-2`, `text-meta` `fg-3` | a row, a tile's name |

*Why:* sections and the groups inside them used to share `label`, so "COMPANIES" and
"S-TIER" sat one above the other in the same 11px uppercase grey and read as peers. In
v1 the section moved up to 16px chalk; in v1.1 the group name also drops its capitals,
because five uppercase tier labels stacked down one section turned capitals back into
texture. Uppercase now means one thing, "this heads a column", and a section has at
most one row of it.

**Rules**

- Sentence case everywhere except `label` and `wordmark`. No italics in the UI.
- **Emphasis comes from colour step (`fg-1` against `fg-3`), not bold.** Never use
  `font-bold` in body text.
- **Tabular figures:** every number that changes, stacks or sits in a column is either
  Plex Mono (`data`, in a column or a log) or Archivo with
  `font-variant-numeric: tabular-nums` (inline: `stat`, the next-action line, tab and
  group counts, the meta line, "28 of 34"). Proportional figures are only acceptable
  inside running prose.
- **Prose measure: 72ch at most** (v1.1). Answers on Profile, page lead text, panel
  summaries and notes cap at `max-w-[72ch]`. Past about 75 characters the eye loses
  the next line on the way back; a dense app still reads prose like a page. On Profile
  the answers are one readable column, with the question in a left rail from `lg` up
  and above the answer below it.
- Truncate with an ellipsis on one line. Never wrap names in rows.

### 4. Space, shape, structure

#### 4.1 Spacing

The base is 4px. Allowed steps are **2, 4, 8, 12, 16, 24, 32 and 48** (Tailwind
`0.5, 1, 2, 3, 4, 6, 8, 12`). Nothing else: no `py-3.5`, no `px-5`.

- Page gutter: 24px (`px-6`) at `md` and above, 16px on mobile. Max content width
  1280px (`max-w-7xl`, kept).
- Vertical rhythm between page sections: 32px. Between a section label and its
  content: 8px.
- Inside cards: 16px padding (queue) or 12px (compact).
- **Slide-over panels: 24px on the sides** (v1.1; was 20px, `px-5`, which is off the
  scale). Header and body share the edge so the title, tabs and fields line up.

#### 4.2 Radii

| Token | Value | Use |
|---|---|---|
| `rounded-control` | 4px | Buttons, inputs, chips, tags, toggles, tab segments, kbd, logo tiles 24px and smaller |
| `rounded-card` | 6px | Cards, list containers, tab bar container, popovers, tooltips, logo tiles 32px and larger |
| `rounded-panel` | 10px | Modals, the chat sheet, the graph canvas frame |
| `rounded-full` | — | Status dots, graph nodes, avatars. **Nothing else.** |

Slide-overs are full-height and flush right, with radius 0.

#### 4.3 Borders and elevation

- **Elevation is lightness:** `canvas` → `surface` (cards) → `raised` (panels) →
  `lift` (hover or selected).
- **Tone does the structure; a hairline only where tone cannot** (v1.1). Cards, tiles,
  list containers, the tab bar, stat tiles, company tiles, site rows and queue cards
  are a `surface` fill with **no border**: the v1.1 steps are far enough apart to
  separate them from the page. Hairlines stay in three places: **row dividers**
  (`line-1`) inside a container, **inputs** (`line-input`, the 3:1 rule), and
  **floating layers** (the `shadow-float` ring, and the slide-over's left edge and
  header rules). A secondary button keeps its `line-2` edge because it is a control,
  and a control must read as pressable at rest.
  *Why:* a hairline around every card drew a grid of boxes on the page, and a border
  that tone can replace is chrome the eye still has to read past.
- **No card in a card.** A surface inside a surface gets no second fill; group it with
  space and a `t-group` name instead.
- **Hover is always neutral.** Rows and tiles step to `lift`, fields and secondary
  buttons step their border up a line, text steps up a colour (`fg-3` → `fg-2` → `fg-1`).
  Because `line-1` sits a step under `lift`, a hovered row is always distinct from
  the dividers around it. **Rope never appears
  on hover**, including in the graph: rope is the next move, focus and "you are here",
  and orange that follows the cursor spends it on pointing. The one exception is a
  rope fill (the primary button) going to `rope-hover`, which is the same element
  getting lighter, not orange appearing.
- **One shadow, only for things that float over content** (slide-over, popover, menu,
  modal, tooltip, chat sheet): `shadow-float` =
  `0 12px 32px -8px rgb(0 0 0 / 0.6), 0 0 0 1px #2F3236`.
- **Scrim** behind slide-overs and modals: `canvas` at 60% opacity. No blur.
- **The nav is solid `canvas`** with a `line-1` bottom border. Remove `backdrop-blur`
  and the `/80` alpha.
- **No dot grid** on the page background. The dot grid exists only on the graph canvas.

#### 4.4 Density targets

| Element | Height | Notes |
|---|---|---|
| Nav | 48px | Was 56px |
| Button (default) | 32px | `px-3`, 16px icon |
| Button (compact, inside rows) | 28px | `px-2.5`, 14px icon |
| Input / select | 32px | Compact inside rows: 28px |
| Chip / stage chip / tag | 20px | `px-1.5`, `chip` type |
| Filter toggle | 24px | `px-2` |
| Two-line list row (person, pipeline role) | **56px** | 32px logo, `name` and `meta`, 12px horizontal padding (v1.2; was 44px with a 24px logo, too thin to read the marks) |
| Single-line list row (Coming up, history, notes, sites) | **36px** | Mono date column first |
| Group header in a list | 32px | Sticky, `t-group` plus a `meta` `tabular-nums` count |
| Queue card (role) | about 176px (min 160) | 16px padding, 32px logo. Two side by side at 1280px or more |
| Queue card (person) | about 164px | Same frame and the same rows as the role card, without tags |
| Verdict button (Pass, Accept, Add) | 28 × 88px | Fixed in every state (v1.2) |
| Home signal tile | 88px | `meta` name, then `stat`. Three across at every width (two rows of three on a phone) |
| Company tile | about 88px wide | Auto-fill grid, `minmax(88px, 1fr)`, so a tier of 8 fits one row at 1440 and no tier strands one tile under a full row |
| Slide-over width | 640px | Was `max-w-2xl` (672px) |
| Heatmap cell | 11px, 2px gap | 53 weeks fit in 676px |

#### 4.5 Iconography

- **Lucide** (already installed). Always `strokeWidth={1.5}` with
  `absoluteStrokeWidth`. Colour is always `currentColor`.
- Sizes: **16px** in buttons and headers, **14px** in rows and chips, **12px** inside
  20px chips. No other sizes.
- **Only use an icon where it speeds up scanning:** external link, search, add, the
  mutuals glyph, clock (due), check (done), alert triangle (alarm), and locate (graph
  reset). Remove icons whose label already says it all (the `Mail` icon on "Scan
  now").
- The only filled shape in the system is the **6px status dot**.
- No emoji. No custom climbing icons, ever.

#### 4.6 Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--dur-hover` | 90ms | `ease-enter` | Hover, press, colour changes |
| `--dur-quick` | 140ms | `ease-enter` | Chips, toggles, tab change, stage change, queue card exit (8px slide plus fade) |
| `--dur-panel` | 200ms | `ease-enter` | Slide-over and chat sheet enter |
| `--dur-panel-exit` | 140ms | `ease-exit` | Slide-over exit (exits are about 30% shorter) |

- `ease-enter` = `cubic-bezier(0.2, 0, 0, 1)` (fast out, long settle).
  `ease-exit` = `cubic-bezier(0.4, 0, 1, 1)`. Nothing takes longer than 240ms. No
  springs, overshoot or bounce.
- **Never animate:** numbers counting up, list reorder on data refresh, page
  transitions, the brand wash, skeleton shimmer, graph idle drift, or anything on
  first paint.
- `prefers-reduced-motion: reduce`: all transforms are removed. Opacity fades stay at
  80ms. The graph renders its settled layout without animating
  (`NetworkGraph` already reads this media query).
- Replace `transition-all` with `transition-colors` or `transition-[opacity,transform]`.
  Animating everything is how layout jank gets in.

#### 4.7 Focus and accessibility

- **Global focus style:** `:focus-visible { outline: 2px solid var(--color-rope); outline-offset: 2px; }`.
  Never `outline-none` without a replacement. Inputs also take a `rope` border on
  focus. **A rope-filled button takes an `fg-1` ring instead** (2.3).
- **Text contrast floor is 4.5:1 on the surface it actually sits on**, including
  hover. In this palette that means `fg-3` or brighter. `fg-4` is for disabled
  controls and separators only.
- **Non-text contrast 3:1** where a border is the only cue: inputs, checkboxes and the
  hollow graph nodes (`line-input` is 3.20 on canvas and 3.01 on surface). Inputs on
  `raised` panels sit on a `canvas` fill, so the field reads by its fill as well as
  its border.
- **Colour is never the only signal:** semantics follow 2.4, stages carry their name,
  Drafted is dashed, graph stages are hollow or filled.
- **Keyboard:** every action that has a key shows a `kbd` hint on hover or in its
  `title` ("Accept (A)"). The keyboard-cursor card has a 1px `rope` border, and
  **the cursor appears only once you start keyboard navigation** (v1.2): the first J
  or K shows it where it is (the first card, or the last one clicked) without moving
  it, a click hides it again, and A and P do nothing while it is hidden. At rest no
  card is orange; the only rope on the page is the header's primary button. (v1.1 put
  the cursor on the first card at load so one rope Accept always showed; the owner read
  an orange box nobody had chosen as a bug.) Escape closes the top layer only.
- **Hover-revealed controls are focus-revealed too.** Anything shown on row hover (the
  stage control, the external-link icon, a tile's edit button) also shows on
  `:focus-visible` or `:focus-within`, and stays in the tab order while hidden.
- Hit targets are at least 24×24px (WCAG 2.2 AA). Icon-only buttons get
  `aria-label`.
- `<html>` keeps `color-scheme: dark` so native controls and scrollbars match.

### 5. Components

#### 5.1 Nav

- 48px high, solid `canvas`, `line-1` bottom border, sticky.
- **Left:** the 16px mark followed by the `BELAY` wordmark in `fg-1`, 8px gap, as a
  link to `/`. Remove the opacity-60 trick. On Home it is the same as everywhere else.
- **Links:** `button` type, `fg-3`, hover `fg-1`. **Active:** `fg-1` with a 2px
  `rope` underline sitting on the nav's bottom edge. Every page uses the same
  treatment. Remove `tone` from `Nav.tsx`.
- Links are Applications, Network and Profile, 24px apart. Home is the wordmark.

#### 5.2 Page header and next-action line (`PageChrome.tsx`)

- `h1` in `fg-1`, with the next-action line 4px below it in `body`, capped at 72ch.
- **Next-action line:** numbers in `fg-1` with `tabular-nums`, labels in `fg-3`, and
  separators as `·` in `fg-4` with 6px on each side. Example: **3** to triage · **12**
  to message · **2** to schedule. When everything is zero: "Nothing waiting" in
  `fg-3`.
- Actions on the right, 8px apart: at most **one primary** and one or two secondary
  buttons.
- The Home `h1` is "Home". The line under it is the long date in `fg-3`.
- **Ask Claude** sits in the Home header's actions as a quiet button (v1.1). It used to
  float at the bottom right and covered whatever scrolled under it (the Sites "Add"
  among them); a floating launcher has no place it is guaranteed not to cover. The
  sheet it opens still docks to the bottom edge.

#### 5.3 Tabs with count badges (`TabBar`)

- **Container:** `surface`, no border (4.3), `rounded-card`, 2px padding.
- **Segment:** 28px high, `px-3`, `button` type, `rounded-control`. At rest it is
  `fg-3`, with `fg-2` on hover. **Active:** `lift` fill and `fg-1`. No shadow.
- **Count:** `meta` with `tabular-nums` (Archivo, not mono: it is inline, 3.1), 6px
  gap, no border and no pill. At rest it is `fg-3`, and
  `fg-2` on the active tab. **A count of undecided work** (the Queue tab when it is
  above 0) is `rope`. That is the "needs you" signal. Other counts (Pipeline, People)
  stay neutral.

#### 5.4 Buttons

| Kind | Rest | Hover | Press | Disabled |
|---|---|---|---|---|
| **Primary** (one per view) | `rope` fill, `on-rope` text, no border | `rope-hover` | `rope-press` | `lift` fill, `fg-4` text |
| **Secondary** | `surface` fill, 1px `line-2`, `fg-1` text | `line-3` border, `lift` fill | `lift` fill | `fg-4` text, `line-2` border |
| **Quiet** (inline: Cancel, Clear, Follow up, Undo) | transparent, `fg-2` | `fg-1` text, `lift` fill | `line-2` fill | `fg-4` |
| **Destructive** (quiet variant) | transparent, `fg-3` | `alarm` text plus `Trash` glyph | — | — |

- All buttons: `button` type, `rounded-control`, 32px (or 28px compact), 16px icon
  leading with 6px gap. Remove `hover:opacity-90` and the `ring-1` halo.
- **Queue Accept is secondary; Pass is quiet** (v1.1: Pass is the common verdict but
  never the next move, and two bordered buttons per card doubled the chrome). Once the
  keyboard cursor is showing (4.7), Accept (or Add, in the people queue) on the card
  under it becomes primary, so the one rope fill marks where A will land. At rest
  there is no cursor and no rope on any card.
- **Verdict buttons keep one size in every state** (v1.2): 28px high and 88px wide
  (`verdictWidth` in `lib/ui.ts`) at rest, under the cursor with a `kbd` hint, and
  decided with a check. They sized to their content, so a click that swapped the hint
  for a check made the pair jump.
- Company colour never touches a button. The Save button in a panel is a primary
  button.

#### 5.5 Chips, stage chips, tags, tier badges

**Base chip:** 20px, `px-1.5`, `chip` type, `rounded-control`.

**Stage chips: one shared ramp** (`components/StageChip.tsx`, replacing both
`STATUS_COLORS` and `CONTACT_STAGE_COLORS`). How full the chip is shows how far along
it is. Text contrast is computed on each fill:

| Step | Fill | Text (contrast) | Applications | Network |
|---|---|---|---|---|
| 0 | none, 1px `line-2` border | `fg-3` (5.78 on `surface`, 4.72 on `lift`) | Applying | Identified |
| 0 dashed | none, **1px dashed** `line-3` | `fg-2` | — | **Drafted** (written, not sent) |
| 1 | `#2F3236` (`line-2`) | `fg-1` (11.07) | Applied | Sent |
| 2 | `#4A4D52` (`line-3`) | `fg-1` (7.30) | Screen | Connected |
| 3 | `#7D8086` `oklch(0.60 0.010 260)` | `canvas` (4.88) | Interviewing | Replied |
| 4 | `#B4B7BD` `oklch(0.78 0.008 260)` | `canvas` (9.61) | Final round | Scheduled |
| 5 | `#ECEEF0` (`fg-1`) | `canvas` (16.60) | Offer | Chatted |
| 5 plus check | `fg-1` with a 12px `Check` glyph | `canvas` | Accepted | — |
| End | none, no border | `fg-3` | Rejected, Withdrawn | No response |

- *Why step 0 changed (v1.1):* it was a `line-input` border (3.2:1) with `fg-2` text,
  which made "not started" the loudest outline in the ramp, louder than the faint
  `line-2` fill of step 1. The ramp now rises in weight at every step: a faint
  outline, a dashed brighter outline (Drafted sits between Identified and Sent), then
  fills from `line-2` to `fg-1`.
- A stage chip that is also the stage control (a `<select>`) keeps this look and adds
  a 12px `ChevronDown` in the chip's text colour. **In the contact panel, the chip is
  this ramp, not the brand colour.** On the brand wash, a step whose text is `fg-3`
  (0 and End) takes `fg-2` (2.6).
- **In a list grouped by stage, rows carry no stage chip at rest** (v1.1): the group
  name already says it, and thirty identical chips down a column is a column of
  nothing. The stage control appears in that slot on row hover and on
  `:focus-within`; at rest the slot holds the row's day count, **said in words**
  (v1.2): "12d in Applied" on a pipeline row, "last touch 9d" (or "added 9d" for
  someone never contacted) on a person, "Applied today" for a zero. The number is
  `data`, the words `meta`, both `fg-3`, and a tooltip says what is counted. A bare
  "12d" left the owner guessing what it measured. Tab still reaches the control, and
  focusing it shows it.
- **Tags** (relationship tags, queue tags): `lift` fill, `fg-2` text (7.55), **no
  border** (v1.1). Removable tags show a 12px `X` on hover.
- **Filter toggles** (company filter row): 24px, no border. **Off:** `fg-2` text,
  `lift` fill on hover. **On:** `lift` fill, `fg-1`. An optional 6px brand dot before
  the name is allowed (2.6). "Clear" is a quiet button. *Why (v1.1):* fifteen outlined
  toggles in a row read as a fence; off is plain text you can click, on is a filled
  key, and the difference between them is the one that matters.
- **Tier badge:** 20px square, `data` type. S: `fg-1` fill with `canvas` text.
  A: 1px `fg-2` border with `fg-1` text. B: `line-input` border with `fg-2` text.
  C and D: `line-2` border with `fg-3` text. Untracked: dashed `line-2` border with a
  `·` in `fg-3`.

#### 5.6 Cards

**Role card (queue):**

- `surface`, no border, `rounded-card`, 16px padding (`queueCard()` in `lib/ui.ts`,
  shared by both queues). **Keyboard cursor:** 1px `rope` border and nothing else, shown
  only after J or K (4.7); the border is transparent otherwise, so the cursor moving
  does not shift the card.
- Row 1: 32px logo tile on the left (company colour lives here), then the company in
  `h3` (16px semibold) `fg-1`, the largest text on the card (v1.2; at 14px it was the
  size of the line under it), and the role title in `body` `fg-2` below it. Score is
  right-aligned in `data`: the score in `fg-1` and `/10` in `fg-3` (`8/10`), so the
  number reads as a mark out of something. No colour scale; the queue is already
  sorted. **The score shows in every state**, decided included (v1.2: it covers
  nothing, and a card that loses its number on a click looks like another card).
- Row 2, the meta line: `meta` `fg-3`, all Archivo with `tabular-nums` (3.1). Pay is
  normalised to one shape, `$169–303k`: one currency sign, en dash, lowercase k,
  whole thousands (`formatComp()` in `lib/role-meta.ts`); a figure it cannot parse
  is shown as written. `·` separators in `fg-4`.
- Row 3: the headline in `body` `fg-1`, at most 2 lines.
- Row 4: up to 5 tags. Then the action row: Pass (quiet), Accept (secondary, or
  primary on the cursor card), with `kbd` hints on the cursor card.
- After a decision, the lower half shows the "Why this one?" / "Why not?" input
  (5.9).

**Person card (people queue):** the role card's structure, sizes and spacing, row for
row (v1.2): the same frame, padding, score and buttons (Pass quiet, Add secondary or
primary on the cursor card). Row 1: a 32px logo on the left, the person's name in
`h3` `fg-1` (the largest text), then **Company · Role** in `body` `fg-2`, matching the
person panel's header. Row 2, the meta line: the mutual (`Users` glyph and name) and
the batch note, `meta` `fg-3`, **on every card**. Row 3, in the headline's slot: the
fit's one line of why, `body` `fg-1`, two lines at most. No tags row. (v1.1 said a
mutual shared by every visible card once, above them, as "All via Nicole Willis"; it
made the two queues two layouts, so v1.2 puts it back on each card.)
- The `ExternalLink` after a name (person cards, People and Pipeline rows) shows on
  hover and focus only (v1.1). At rest, a column of identical link icons was the
  loudest pattern in the list.

**Home signal tile:** `surface`, no border, 12px padding, the tile's name in `meta`
`fg-3` sentence case, `stat` number in `fg-1` (`fg-3` when 0). The whole tile links
to where the thing lives (Upcoming interviews → Pipeline at `?stage=Interviewing`;
Upcoming calls → People at `?stage=Scheduled`). Hover fill `lift`. **A zero is not a
link** and has no hover: there is nothing behind it. Home has no Insights button;
`/insights` is reachable by URL. The two halves are headed "Applications" and
"Network" in `label` (they are side-by-side columns, 3.3); there is no "Overview"
heading above them, since the two labels already say what the tiles are.

#### 5.7 List rows (people list, pipeline, Coming up, history)

- **One container per group, not one card per row:** `surface`, no border,
  `rounded-card`, with rows divided by `line-1`.
- **Two-line row (56px, v1.2):** 32px logo tile with `rounded-card`, then the primary
  name in `name` `fg-1` (truncate) and the secondary line in `meta` `fg-2`: the role
  title on a pipeline row, `Company · Role` on a person. The name block takes 38% of
  the row from `md` up.
- **The middle says what is next** (v1.2; it was empty space): `meta`, from `md` up,
  hidden on a phone. A pipeline row shows, in order, the next interview ("Interview Thu
  9 Oct · Portfolio review", `fg-2`), the form's state on an Applying row ("Form opened
  9d ago", `alarm` with its glyph from 7 days; "Form not opened yet" in `fg-3`), and who
  is referring you (`Users` glyph, "Referred by …"). A person row shows how you met,
  up to three relationship tags (warmth first, brighter) and the first mutual with
  "+N". The posting's original age is **not** on a pipeline row: it is a reason to
  accept, not a fact about an application, and the panel keeps it. Rows carry no "no
  summary" cue: the panel already prompts for the summary.
- **The right-hand cluster** has 8px gaps: quiet compact actions (Follow up), then the
  fixed slot that holds the labelled day count at rest and the stage control on hover
  or focus (5.5), right-aligned. Overdue on a person is `rope` with a `Clock` glyph.
- Hover: `lift`. Selected (its panel is open): `rope-wash` with a 2px `rope` bar on
  the left inside edge.
- **Group header (32px, sticky):** `t-group` stage name plus a `meta` `tabular-nums`
  count, both `fg-3`, sitting on `canvas` above the container.
- **Log rows (36px):** a fixed **56px** date column first, in `data` `fg-3`
  (`06 Oct`, with the time in a second column for Coming up), then the entry in
  `body`. Pipeline history gaps show as `+12d` in `data` `fg-3`.

#### 5.8 Slide-over panel (role workspace and contact panel)

- Fixed right, full height, 640px wide, `raised` background, 1px `line-2` left border
  (**not** brand colour), `shadow-float`, and a scrim behind it. It slides in over
  200ms and out over 140ms.
- **Header**, padding 16px top and bottom and 24px on the sides:
  - the flat 22% brand band behind the whole header (2.6), with no fade and no top
    strip;
  - a 40px logo tile, then the name in `h2` `fg-1`, `title · company` in `body`
    `fg-2`, and the stage chip plus "How we met" in `meta` `fg-2`. **`fg-3` is not
    allowed on the band.** The "28 of 34" position is `meta` `tabular-nums` `fg-2`.
  - the close `X` as a quiet icon button at the top right, `fg-2`.
- **Body:** 24px side padding, sections separated by 24px, each starting with a
  `t-section` heading (16px, `fg-1`, sentence case; not brand colour). **A section's
  add button names what it adds and sits beside its heading** (v1.2, `sectionHead` in
  `lib/ui.ts`): a quiet compact button with a 14px `Plus`, 12px after the heading in one
  28px row: "Add referral", "Add interview", "Add file", "Add note", "Add mutual", "Add
  call". A bare "+ Add" at the far right edge, 590px from its heading, belonged to
  nothing in particular.
- **Referral** (role panel) works like Mutuals on a person: "Add referral" opens a
  picker over the whole network, people at the company first, and a quiet link to note
  a name for someone not in it. Entries are stored in `Application.referrerId` as a
  JSON list of contact ids and noted names (`parseReferrers()` in `lib/role-meta.ts`);
  a contact links to their Network panel, a noted name reads "· not in your network". Groups inside a
  section, if any, take `t-group`. Inner cards are `surface` on `raised`, no border.
  Inputs are `canvas`.
- **Footer actions** (Save and similar) are primary or secondary buttons. **None take
  brand colour.**

#### 5.9 Inputs

- 32px, `canvas` fill (on `surface` or `raised`), 1px `line-input` border,
  `rounded-control`, `px-2.5`, `body` text in `fg-1`, placeholder in `fg-3`.
- Hover: `fg-3` border (v1.1: `fg-4` was the same grey as `line-input`, so hover did
  nothing). Focus: `rope` border plus the global focus ring. Error:
  `alarm` border, plus an `AlertTriangle` and message in `meta` `alarm` below.
- Textareas use the same style and grow with `AutoResizeTextarea`. The paste box shows
  a character or limit counter in `data-sm` `fg-3` at the bottom right (`212/300`),
  which turns `alarm` with a glyph past the limit.
- Selects use the same frame with a 14px `ChevronDown` in `fg-3`.
- Inline label above a field: `meta` in `fg-2`. Field groups are 12px apart.
- **Paste boxes are not wrapped in a bordered card.** The dashed field is the target;
  a bordered card around a dashed box is two frames for one thing. The borderless form
  frame below is tone, not a frame, so a dashed field may sit in it.
- **Header-triggered forms share one frame** (v1.2, `FormFrame` in
  `components/PageChrome.tsx`): Add role, Add people (and its manual variant) and Find
  people. A `surface` card, no border, 16px padding; the title in `t-section` `fg-1`
  with the close `X` (quiet icon button) at the top right in one 28px row; one hint
  line in `meta` `fg-3`, capped at 72ch, 4px under it; the fields 12px below, 8px
  apart; then a footer row 12px below with any quiet way sideways on the left (an
  underlined `meta` link, `formLink`) and the form's verb on the right as a
  **secondary** button (the header's button is the page's one rope fill). Errors and
  results sit under the footer. Escape closes it. Find people opened in a card while
  Add people opened bare, with a different title, footer and button placement, so the
  two buttons beside each other in the header opened two different-looking things.

#### 5.10 Empty states

- One line in `body` `fg-3`, plus at most one action (a secondary button or a quiet
  link). Centred in the region, with 32px vertical padding. If the empty state sits
  where a list would be, it goes inside a `surface` container with a **dashed**
  `line-2` border.
- No illustrations, no icons larger than 16px, no encouragement.
- Formula: what is missing, then how it fills. For example: "No people yet. Add
  someone from the queue, or use Add people."

#### 5.11 Chat sheet and tooltips

- **Chat sheet:** `raised`, `rounded-panel` at the top corners, `shadow-float`. The
  title is "Ask Claude" in `name`. Your messages sit on `lift`, Claude's on none. While
  waiting, "Writing…" in `meta` `fg-3`, not italic.
- **Tooltips and popovers:** `raised`, 1px `line-2`, `rounded-card`, `shadow-float`,
  8px/10px padding, `meta` text.

#### 5.12 Activity heatmap

- **One neutral ramp**, coloured by total actions per day. A day where both sides
  happened is no longer a third colour.

  | Level | Hex | OKLCH | vs `surface` |
  |---|---|---|---|
  | `heat-0` (none) | `#232528` | `oklch(0.262 0.007 260)` | 1.15 |
  | `heat-1` | `#3F4348` | `oklch(0.38 0.010 260)` | 1.77 |
  | `heat-2` | `#656970` | `oklch(0.52 0.012 260)` | 3.19 |
  | `heat-3` | `#9A9FA6` | `oklch(0.70 0.012 260)` | 6.61 |
  | `heat-4` | `#E2E5E9` | `oklch(0.92 0.006 260)` | 13.94 |

  Neighbouring steps differ by 1.54–2.11:1, so each step reads at 11px. (`vs surface`
  recomputed for the v1.1 `surface`; the ramp itself is unchanged, and `heat-0` stays
  under the new `lift` on purpose, so an empty day never looks hovered.)
- **The grid fills the panel's width.** Each week is a `1fr` column and each day a
  square in it, with a 3px gap and 2px radius (about 19px cells at a 1440 window,
  16px at 1280). Below a 10px cell the grid stops shrinking and scrolls sideways,
  parked on the current week (phones). The legend keeps fixed 11px squares. Cell
  borders are not used.
- **Panel header:** the streak on the left (`meta` `fg-2`), the year select on the
  right, inside the panel. The section heading "Progress" sits above the panel.
- **Today:** a 1.5px inset `rope` ring. **Selected day:** a 1.5px inset `fg-1` ring.
- **Day detail** (under the grid) **must not move** as the cursor sweeps the grid: the
  Day and Year columns are fixed widths (3rem and 4rem) in tabular mono, and every row
  is a fixed 28px. The date is Archivo `tabular-nums` and sits at the left edge with
  nothing after it but "Today" (when it is), 8px on (v1.1: the date had a fixed 18ch
  box, which stopped the jitter but left a hole before "Today"; with nothing to its
  right that the date could push, the box was guarding nothing). The date, then two labelled groups,
  "Applying" (Roles triaged, Applications submitted, Interviews) and "People" (People
  identified, People messaged, Coffee chats), each with a count in `data` `fg-1` and a
  year total in `fg-3`. The side is shown by position and words, not hue.
- Legend: "Less" plus five cells plus "More", in `meta` `fg-3`, right-aligned under
  the grid. Streak in `meta` `fg-2`: "14-day streak" or "No streak".

#### 5.13 Network graph

The only expressive surface in the app, and the portfolio and README hero.

- **Canvas:** `canvas` with a 24px dot grid (1px dots in `line-1`), a radial lift to
  `surface` at the centre, and a `line-2` frame with `rounded-panel`.
- **Nodes:** circles with radius `4 + sqrt(degree) * 2.2` (unchanged).
  - Fill is the company colour: `mix(usableAccent(B), graph-neutral #A1A5AB, 0.4)`.
    This keeps today's 40% pull toward grey, re-based on the new neutral.
  - **Fallback when there is no brand:** the hash palette is kept and cut to 8 muted
    hues at the same lightness (L 0.74, C 0.075), **leaving out hues 20–80 so nothing
    reads as rope or alarm**: `#B6AC75`, `#92B78A`, `#76BBA8`, `#6FB9C1`, `#7BB3D4`,
    `#98A9DB`, `#B69FD1`, `#CC99BA` (all 8.1–8.7:1 on canvas). A contact with no
    company is `fg-3` `#90949A`.
  - **Stage is encoded by shape, not hue.** Identified and Drafted are **hollow**: a
    1.5px stroke in the node colour with a `canvas` fill. Sent onward is **filled**.
    No response is filled at 40% opacity.
- **Edges (mutual links):** 1px `fg-3` at 28% opacity, non-scaling. When a node or
  company is hovered or focused, the focused edges turn `fg-1` at 85% and 1.5px, and
  everything else dims to 6%. (They were rope; hover is neutral, see 4.3.)
- **Ring** on the hovered or focused node: a 1.5px ring with a 3px gap, `fg-1` on
  hover and `rope` only under keyboard `:focus-visible` (the app's focus colour). The
  old `ACCENT = "#8fcdfd"` constant is gone.
- **Labels:** Archivo 11px (names are text, not data), `fg-2` with a 3px `canvas`
  halo. `fg-1` when focused. Shown on hover, on focus, and from 1.2× zoom. Never all at
  once.
- **Legend:** a 6px node-colour dot, the company name in `meta` `fg-3` (`fg-1` on
  hover), and the count in `data-sm` `fg-4`. Shows 7 at most, then "+N more".
- **Overlays** (reset button, count line, empty and loading text): quiet buttons and
  `meta` `fg-3`. No blue hovers.
- **Motion:** the simulation settles within about 1.2s and then stops
  (`alphaTarget(0)`). No idle drift. Opacity transitions are 140ms.
- **Later (needs a "you" node):** pin a `fg-1` you-node at the centre, and draw the
  shortest warm path to a chosen company as a 2px rope line. That is the brand gesture,
  the rope that holds you, drawn through real people. It is not built in v1 because
  the graph has no self node yet.

### 6. Logo

#### 6.1 Concept: the top-rope

A top-rope belay is three points and one line: an anchor at the top, the rope running
over it, the climber on one end and the belayer on the other. Drawn as a diagram, it is
**an arch with a dot at each foot, and the two legs are different lengths**. The
climber is partway up and the belayer is on the ground.

- It is what the product is named after, with no mountain, carabiner or knot.
- It is a graph fragment (two people and the line between them through a shared
  anchor), which ties it to the network graph.
- It reads at 16px as a lowercase n or an arch.
- **The climber's dot is rope orange. The climber is you.** Everything else is chalk.

#### 6.2 Construction (24 × 24 grid)

- Monoline stroke **2.5 units**, round caps and joins.
- **Arch:** a semicircle with radius 6, centred at (12, 9), from (6, 9) over the top
  (12, 3) to (18, 9).
- **Left leg (climber):** straight down from (6, 9) to (6, 13). The dot is centred at
  (6, 14.5), 4.5 units in diameter, in **rope `#F67F3D`**.
- **Right leg (belayer):** straight down from (18, 9) to (18, 19). The dot is centred
  at (18, 20.5), 4.5 units in diameter, in **chalk `#ECEEF0`**.
- **Stroke** in chalk `#ECEEF0`. The dots overlap the leg ends, with no gap.
- Clear space is 3 units on every side (the drawing spans x 4.75–20.25, y 1.75–22.75,
  so it is optically centred inside 24 with its weight slightly to the right, which is
  intended).
- At 16px, use the **one-colour version** with a 3-unit stroke and 5-unit dots so the
  short leg stays visible.

#### 6.3 Wordmark and lockup

- **Wordmark:** `BELAY` in Archivo 700, width 75, uppercase, +0.14em tracking, in
  `fg-1`. This replaces the current system-font `font-bold` with 0.12em tracking.
- **Lockup:** the mark on the left. Mark height is 1.6× the wordmark's cap height, and
  the gap is 0.5× mark width. The mark's arch top aligns with the cap height, and the
  belayer dot hangs below the baseline. The nav uses the lockup at a 16px mark.
- The tagline "The rope that holds you while you climb" appears only in the README and
  portfolio, set in `body` `fg-3`, never in the app.

#### 6.4 Do and don't

| Do | Don't |
|---|---|
| Keep the legs unequal, short on the left and long on the right | Make it symmetrical (then it is just an n) |
| Keep the climber dot rope and everything else chalk, or all one colour | Swap the colours, or add a third colour |
| Use it on `canvas`, `raised` or white | Put it on a brand colour or a photo |
| Scale the stroke up at 16px | Outline it, add shadows, gradients, bevels or 3D |
| Keep it alone or in the lockup | Add mountains, a carabiner, a figure, rope texture, a shield or circle container |
| Keep the climber on the left in every theme and context | Mirror it, rotate it, animate it, or use it as a loading spinner |

#### 6.5 App icon and favicon

- **App icon** (`app/icon.svg` and a 512px `app/apple-icon.png`, using Next's file
  conventions; then remove `app/favicon.ico`): the two-colour mark at 60% of the tile
  width, centred, on a `#1B1D1F` (`raised`) square with a 1px inner `#2F3236` border.
  The OS applies its own corner mask, so do not pre-round.
- **32px favicon:** the two-colour mark on a `#0D0E10` rounded square (radius 6).
- **16px favicon:** the one-colour chalk version (3-unit stroke, 5-unit dots) on
  `#0D0E10`. Orange is dropped because it disappears at that size.
- **Social card or README hero:** the lockup on the left, with a cropped screenshot of
  the network graph on the right.

#### 6.6 Gemini prompts

The generator will not hit exact coordinates. These prompts get the proportions right,
and the owner then redraws the result on the grid in 6.2.

**1. Primary mark**

> A minimal flat vector logo mark, centered on a solid flat near-black background
> (#0D0E10), square format with generous empty margin. A single monoline stroke of
> uniform weight with round caps forms a perfect semicircular arch at the top, like a
> lowercase letter n. Two straight vertical legs drop from the ends of the arch. The
> legs are unequal: the left leg is short and ends roughly one third of the way down,
> and the right leg is long and ends near the bottom. Each leg ends in a solid filled
> circle about twice the stroke width. The stroke and the right circle are off-white
> chalk (#ECEEF0). The left circle is safety orange (#F67F3D). Strict geometric
> construction on a square grid, technical-drawing precision, like a symbol on a
> scientific instrument. Flat vector, centered, no text, no gradients, no shadows, no
> texture, no 3D, no mountains, no climber figure, no carabiner, no rope braid.

**2. Mark plus wordmark lockup**

> A flat vector horizontal logo lockup, centered on a solid flat near-black background
> (#0D0E10), wide format with generous margin. On the left, a minimal monoline symbol:
> a semicircular arch like a lowercase n with two straight legs of unequal length, the
> left leg short and the right leg long, each ending in a solid round dot; uniform
> stroke with round caps; stroke and right dot off-white (#ECEEF0), left dot safety
> orange (#F67F3D). To the right of the symbol, the text "BELAY" in uppercase, set in a
> semi-condensed bold grotesque sans-serif with wide letter spacing, off-white
> (#ECEEF0). The top of the arch aligns with the top of the capital letters, and the
> long leg's dot hangs slightly below the text baseline. The only text is the word
> BELAY. Flat vector, centered, no gradients, no shadows, no 3D, no other text, no
> tagline.

**3. App icon**

> A flat vector app icon: a square tile filled with flat dark graphite (#1B1D1F) and a
> subtle 1px inner border in a slightly lighter graphite (#2F3236), no rounded corners
> (the OS will mask them). Centered on the tile at about 60 percent of its width, a
> minimal monoline symbol: a semicircular arch with two straight vertical legs of
> unequal length, the left leg short and the right leg long, each ending in a solid
> round dot about twice the stroke width. Thick uniform stroke with round caps so it
> stays legible at small sizes. The stroke and right dot are off-white (#ECEEF0); the
> left dot is safety orange (#F67F3D). Precise, engineered, lots of negative space.
> Flat vector, centered, no text, no letters, no gradients, no glow, no shadow, no 3D,
> no texture.

**4. Monochrome / one-colour version**

> A sheet of three flat vector logo marks in a single row on a plain flat white
> background (#FFFFFF), all in one solid near-black colour (#191B1D) only. Each is the
> same abstract symbol: a single continuous monoline that rises from a short left leg,
> curves over a perfect semicircular arch, and drops down a long right leg, with a
> solid round dot at the end of each leg. The left leg is clearly shorter than the
> right. Show the symbol at three sizes, large, medium and tiny, with the stroke
> getting proportionally thicker and the dots proportionally larger as the size
> shrinks so the tiny version stays legible. Swiss modernist, geometric, built on a
> grid. Flat vector, centered, no text, no labels, no second colour, no gradients, no
> shadows, no 3D.

### 7. Voice and microcopy

**Principles**

1. **Say the thing, then stop.** One sentence. Cut "please", "simply", "just" and
   "actually".
2. **Numbers beat adjectives.** "14 new roles", not "Scan complete". "9d", not "a
   while".
3. **Verbs on buttons, nouns on headers.** A button says what happens. A header names
   what is below it.
4. **The owner's words, not the system's.** Scan, not ingest. People, not contacts.
   Role, not job. Pass, never reject, skip or dismiss.
5. **One name per thing.** If the nav says Home, the page says Home. The two lists are
   **Roles** (tabs: Queue, Active) and **People** (tabs: Queue, Network). Never
   "pipeline", "applications" as a page, or "contacts" (v1.2).
6. **Empty states say how the space fills.** One line, no encouragement.
7. **When something fails, say where to look.** It's a local tool, so the fix is
   usually on this machine.
8. **No exclamation marks, no "Oops", no AI theatre.** Claude is named only where it
   is literally Claude. It "writes" and "drafts". It never "thinks".
9. **No climbing jargon in the UI.** The metaphor belongs to the name and the logo.
10. **Sentence case everywhere.** Uppercase only in `label`, through CSS, never typed
    in caps.

**Replacements (real strings in the app today)**

| # | Where | Now | Replace with |
|---|---|---|---|
| 1 | `app/applications/page.tsx:611` header button | Run ingest | Scan now |
| 2 | same, loading state | Scouring… | Scanning… (add "· 12 of 34 sources" once progress is reported) |
| 3 | `app/applications/page.tsx:563` fallback result | Ingest complete. | Scan done. |
| 4 | `app/page.tsx` `h1` (nav says Home) | Dashboard | Home |
| 5 | `app/page.tsx` `ChatPanel` title and `components/ChatPanel.tsx:131` | Chat with Claude | Ask Claude |
| 6 | `app/page.tsx` `emptyHint` | Ask Claude what to prioritize today, who needs a follow-up, how this week is going. | What to do today, who is due a follow-up, how the week went. |
| 7 | `components/ChatPanel.tsx:191` | Claude is thinking… | Writing… |
| 8 | `app/applications/page.tsx:713` empty queue | All caught up. Nothing is waiting for a verdict. | Queue clear. Scan now to look for more. |
| 9 | `app/networking/page.tsx:716` empty people list | Nobody here yet. Add someone from the queue and they land here. | No people yet. Add someone from the queue, or use Add people. |
| 10 | `app/networking/page.tsx:815` day-count tooltip | Time to reach out again / Days since your last touch | {n} days since last touch. Follow up. / {n} days since last touch |
| 11 | `components/PeopleQueue.tsx:193` (and similar) | Could not reach the server. Try again. | Can't reach Belay on this machine. Is `npm run dev` running? |
| 12 | `components/ContactPanel.tsx:899` placeholder | Paste their LinkedIn About section and current role. Call notes or a message thread work too. Belay writes a two or three sentence summary of who they are. | Paste their About section, call notes or a thread. Belay writes a 2–3 sentence summary. |
| 13 | `components/PageChrome.tsx` next-action line, all zero | All caught up | Nothing waiting |

Strings to keep as they are, because they are already right: "Pass. They will not be
offered again (P)", "Why this one?" / "Why not?", "You followed up; restart the
count". ("no summary" left the people rows in v1.2.)

### 8. Implementation

#### 8.1 `globals.css`

The paste-ready block that stood here shipped in phase 1 and has since drifted from the
live file twice. Two copies of the tokens is one too many, so it is gone (v1.1):
**`app/globals.css` is the only copy**, and it must match the tables in 2 and 3.
Change a value there and change the table here in the same commit, with the contrast
figures recomputed by script.

Utility names it produces: `bg-canvas`, `bg-surface`, `bg-raised`, `bg-lift`,
`bg-plate`, `border-line-2`, `text-fg-3`, `bg-rope`, `text-on-rope`, `bg-rope-wash`,
`text-alarm`, `bg-stage-3`, `rounded-card`, `shadow-float`, `ease-enter`, `text-h1`,
`text-name`, `text-label`, `text-data`, plus `t-section`, `t-group`, `t-label`,
`t-chip`, `t-num` and `wordmark`. For duration, use `duration-90`, `duration-140` and
`duration-200`. The control recipes (buttons, inputs, tags, toggles, cards) are in
`lib/ui.ts`.

#### 8.2 Mapping from today's classes

| Today | Count | New | Note |
|---|---|---|---|
| `bg-zinc-950`, inline `#09090b` | 6 + layout | `bg-canvas` | Remove the dot grid from `<body>` |
| `bg-zinc-900` | 68 | `bg-surface` (cards), `bg-canvas` (inputs) | Inputs sit on canvas |
| `bg-zinc-900/95`, panel `bg-zinc-950` | — | `bg-raised` | Slide-overs, tooltips |
| `bg-zinc-800`, `bg-zinc-800/60` | 32 + 6 | `bg-lift` | Hover, active tab, Identified chip becomes step 0 |
| `border-zinc-800`, `divide-zinc-800` | 87 | `border-line-2` (containers), `border-line-1` (dividers) | |
| `border-zinc-700`, `border-zinc-600` | 43 + 11 | `border-line-3` (hover), `border-line-input` (inputs) | |
| `text-zinc-100`, `text-zinc-200` | 55 + 56 | `text-fg-1` | |
| `text-zinc-300`, `text-zinc-400` | 98 + 42 | `text-fg-2` | |
| `text-zinc-500` | 146 | `text-fg-3` | |
| `text-zinc-600` | 83 | `text-fg-3` | Was about 2.6:1, a contrast failure |
| `text-zinc-700` | 39 | `text-fg-4` (separators `·` only), otherwise `text-fg-3` | Audit each one |
| `placeholder-zinc-600`, `placeholder-zinc-700` | 42 | `placeholder-fg-3` | |
| `bg-accent-pink`, `bg-accent-blue` (buttons) | 25 | `bg-rope text-on-rope` | Primary only |
| `text-accent-pink`, `text-accent-blue` (links, accents) | 65 | `text-fg-1` with underline, or `text-rope` when it means "act here" | Decide per site. The default is neutral. |
| `border-accent-*/30–70`, `ring-accent-*` | about 40 | `border-line-3` on hover. Focus uses the global outline. | |
| `STATUS_COLORS`, `CONTACT_STAGE_COLORS` | 2 maps | `<StageChip step>` (5.5) | One component |
| `TierBadge` `STYLES` | 1 map | 5.5 tier spec | |
| ActivityHeatmap `app`, `net`, `both` ramps | 3 | `bg-heat-1…4` | 5.12 |
| `--color-accent-both` | 1 | removed | |
| `text-alarm` (`#f6a6a0`) | 6 | `text-alarm` (`#F0626E`) plus a glyph | Same name, new value |
| `text-black` on accent fills | 18 | `text-on-rope` or `text-canvas` | |
| `rounded` | 52 | `rounded-control` | |
| `rounded-md` | 37 | `rounded-control` (controls) or `rounded-card` | |
| `rounded-lg` | 44 | `rounded-card` | Panels and modals use `rounded-panel` |
| `rounded-full` | 26 | `rounded-control`, except dots, nodes and avatars | Pills go |
| `tracking-widest uppercase text-xs font-semibold` | many | `t-label` | |
| `tabular-nums` on numbers | — | `t-num` (mono), or keep `tabular-nums` for `stat` | |
| `transition-all duration-150` | many | `transition-colors duration-90 ease-enter` | |
| `ContactPanel` `style={{ color/borderColor/backgroundColor: accent }}` | about 25 | Tokens. Brand stays only in the header band and wash. | 2.6 |
| `NetworkGraph` `ACCENT "#8fcdfd"`, `PALETTE`, `"#a1a1aa"`, `"#09090b"` | — | `rope`, the 8-hue fallback, `graph-neutral`, `canvas` | 5.13 |
| `Nav` `tone`, `backdrop-blur-sm`, `bg-zinc-950/80` | — | Removed. Solid `bg-canvas`, rope underline. | 5.1 |
| `headerButton(kind, tone)` | — | `headerButton(kind)` | Tone parameter removed |

#### 8.3 Rollout plan

Each phase ships on its own and leaves the app consistent.

**Phase 1: foundation (one evening, two files, the biggest visible change).**
`globals.css` and `app/layout.tsx` only.
- Paste the `@theme` block, including the temporary zinc remap. Every surface
  re-tints to graphite, and all dim text passes AA immediately.
- Load Archivo and Plex Mono through `next/font`.
- Delete the body dot grid and the inline background.
- Add the global `:focus-visible` rope ring and the reduced-motion rule.
- Leave `accent-pink` and `accent-blue` defined for now, so nothing breaks.

**Phase 2: the accent swap in the shared chrome (`Nav.tsx`, `PageChrome.tsx`).**
- Nav: wordmark, rope underline, remove the blur, 48px.
- `headerButton` loses `tone`: primary is rope, secondary is neutral.
- `TabBar` counts become mono numerals, with Queue in rope.
- These components cover the top of every page, so after this phase pink and blue are
  gone from all the chrome you see first.

**Phase 3: stages and company colour (`StageChip`, `ContactPanel`, `RoleWorkspace`,
`TierBadge`).**
- Build `StageChip` with the shared neutral ramp and the dashed Drafted step. Delete
  `STATUS_COLORS` and `CONTACT_STAGE_COLORS`.
- Strip the brand `accent` from every control in the two panels. Brand stays in the
  header wash (16% at rollout, then 24%, 22% since v1.1; the 3px band was dropped in v1.1; see 2.6). The left border goes to `line-2`.
- After this phase, company colour is the only hue inside a panel, which is the
  owner's favourite part, made safer.

**Phase 4: density and the remaining surfaces.**
- People list and pipeline become grouped containers with 44px rows and sticky
  group headers.
- Log rows get the mono date column.
- Heatmap: one ramp, with the today ring.
- Network graph: rope highlight, hollow and filled stages, the new fallback palette,
  and the simulation stops when it settles.
- Microcopy table (7).
- Replace every `zinc-*` and `accent-*` class with semantic tokens, then delete the
  zinc remap and the accent variables. Lint for them:
  `rg "zinc-|accent-(pink|blue|both)"` must return nothing.

**Phase 5: identity.**
- Redraw the Gemini output on the 24-unit grid.
- Ship `app/icon.svg` and `apple-icon.png`, and put the nav lockup in place.
- Make the README hero (lockup plus graph) and refresh the screenshots in `docs/`.

**Phase 6 (optional): light theme** from 2.7, as a `[data-theme="light"]` override
of the same tokens.

---

## Part 3. Changes in v1.1 (6 October 2026)

A design critique of the shipped rebrand, applied as one pass. Each line is the rule
that changed and the reason. Where the critique conflicted with a principle in Part 2,
the principle won, and the line says so.

| # | Change | Why |
|---|---|---|
| 1 | Cards, tiles, site rows, queue cards, list containers and the tab bar lose their border; tags become `lift` fill with no border; filter toggles are plain text off and a `lift` key on (4.3, 5.5) | A border that tone can replace is chrome the eye reads past. Hairlines stay for row dividers, inputs, floating layers, and secondary buttons (a control must look pressable) |
| 2 | `surface` `#17191C`, `raised` `#1E2023`, `lift` `#282A2E`, `line-1` `#1E2023`, `line-input` `#63666B` (2.2) | Steps of 1.06–1.07 were too close for tone to separate anything; `line-1` equalled `lift`, so a hovered row merged with its dividers; `line-input` had to rise to keep 3:1 on the lighter surface |
| 3 | In a list grouped by stage, the stage control shows only on row hover or focus, and its slot holds the day count at rest (5.5, 5.7) | The group header already names the stage |
| 4 | Stage step 0 is a `line-2` outline with `fg-3` text; Drafted a dashed `line-3` (5.5) | Step 0 was the loudest outline in the ramp; the ramp now rises at every step |
| 5 | New `plate` token `#E6E8EB` behind logos (2.2, 2.6) | Pure white was the brightest thing on every screen |
| 6 | No brand band on panel tops; the wash drops from 24% to 22% (2.6) | The band read as rope on orange brands. The wash percentage is the critique's "keep 24%" overruled by the AA floor: on the lighter `raised`, 24% puts `fg-2` at 4.46 on a white brand |
| 7 | Prose caps at 72ch (3.3) | Line length past ~75 characters loses the return sweep |
| 9 | Queue score `8/10` with `/10` in `fg-3`; the first card holds the cursor at load; Pass is quiet; same on the people queue (4.7, 5.4, 5.6) | One rope Accept at rest, where A lands; one bordered button per card |
| 10 | Mono only for numbers in columns and logs; inline numbers are Archivo `tabular-nums`; pay normalised to `$169–303k` (3.1, 5.6) | Inline mono read as code in a sentence; six spellings of a salary read as noise |
| 11 | No "Overview" heading on Home; tile names `meta` `fg-3`; uppercase `label` only for column headers, at most one row per section, with group names in a new sentence-case `t-group` (3.3, 5.6) | Five uppercase tier labels down one section made capitals texture again |
| 12 | Company tiles in an auto-fill grid at `minmax(88px, 1fr)`; stat tiles three across on a phone (4.4) | The critique suggested ~120px, but 8 tiles across the 804px company column at 1440 needs ≤93px; at 120 a tier of 8 would wrap 6 + 2 |
| 13 | Row hover is `lift`, dividers `line-1`, one step apart (4.3) | Follows from 2 |
| 14 | External-link icons after names show on hover and focus; a mutual shared by every visible person card is said once above them (5.6) | A column of identical icons or sentences is read once, then skipped |
| 15 | Ask Claude docks into the Home header as a quiet button; rope buttons take an `fg-1` focus ring; paste boxes are not wrapped in a card (2.3, 5.2, 5.9) | The floating launcher covered content; a rope ring on rope does not show |
| — | Type scale collapsed to 11, 12, 14, 16, 20, 24, 28 (13px `body-sm` removed, `button` 13 → 14, `kbd` 10 → 11, `h1` 20 → 24, `h2` 16 → 20, `h3` 14 → 16; new `name` and `t-group`; `t-section-panel` merged into `t-section`) (3.3) | Below 14, one-pixel steps produced two names for one size; above, ~1.2 steps you can see |
| — | Slide-over side padding 24px (4.1, 5.8) | 20px was off the spacing scale |
| — | Input hover border `fg-3` (5.9) | `fg-4` was the same grey as `line-input`, so hover did nothing |
| — | Heatmap day detail: the date loses its fixed box; "Today" follows it (5.12) | The box stopped jitter that could not happen (nothing sits to the right of the date) and left a hole |
| 8 | Not done: the logo mark | The owner is generating it |

## Part 3b. Changes in v1.2 (6 October 2026)

The owner's feedback after using v1.1, applied as one pass.

| # | Change | Why |
|---|---|---|
| 1 | The keyboard cursor (rope border, rope Accept/Add) appears only after J or K; nothing is orange at rest but the header's primary button (4.7, 5.4) | The v1.1 rule put a rope box round the first card at load, which read as a bug, a selection nobody made |
| 2 | Verdict buttons fixed at 28 × 88px in every state (4.4, 5.4) | They sized to their content, so the hint-to-check swap on a click made them jump |
| 3 | The queue score shows in every state (5.6) | Hiding it on a decision made the card look like a different card, and it covers nothing |
| 4 | Both queue cards: logo left, primary name 16px (the largest text), then the second line; the person card's second line is Company · Role; the mutual is back on every person card and "All via …" is gone (5.6) | One layout for both queues; at 14px the name was the size of the line under it |
| 5 | List rows 56px with a 32px logo; second line `fg-2` (4.4, 5.7) | 44px rows with 24px logos were too thin to read the marks |
| 6 | List rows use the middle for what is next (interview, form state, referral; how you met, tags, mutual), label the day count ("12d in Applied", "last touch 9d"), drop the posting's age and "no summary" (5.5, 5.7) | The middle was empty, and a bare "12d" did not say what it counted |
| 7 | The panel header is a flat 22% band, not a gradient; contrast re-measured on the flat band (2.6, 5.8) | The fade left most of the header at a few percent and read as too subtle; flat at the same strength keeps every ratio |
| 8 | Section adds say what they add and sit beside their heading (5.8) | "+ Add" at the far right edge was ambiguous |
| 9 | Referrals: pick anyone in the network or note a name (5.8) | The picker only offered exact company matches and hid its Add when there were none, so most roles could not take a referral |
| 10 | One frame for Add role, Add people and Find people (5.9) | The three header forms opened three different ways |

| 11 | Home: every block opens with a `t-section` heading, including Applications and Network; the day detail reads number-then-label with the year total beside it; the year selector resets the detail and totals are scoped to the selected year (3.3, 5.6, 5.11) | Two halves of Home sat under uppercase labels while every other block had a heading, and labels sat a column away from their numbers |
| 12 | Names: the pages are **Roles** and **People**, parallel nouns for the two lists; the Roles tabs are **Queue** and **Active** (was Pipeline); the People tabs are **Queue** and **Network**. URLs are unchanged (/applications, /networking), and ?tab=active / ?tab=network work alongside the old values | "Applications" and "Network" named a process and a group, not the two kinds of thing listed; "pipeline" is sales jargon for "the ones in motion" |
| 13 | Panel header: a solid 3px brand line on the top edge over a 22% wash that fades to the panel (v1.3). Replaces the flat band | Flat, the tint made the whole header read as the company colour; the gradient alone read as faint. The line anchors it with the true colour, once. It sits on the panel edge where nothing is clickable, so on an orange brand it does not read as the rope accent |
