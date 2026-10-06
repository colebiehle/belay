# Belay style guide

*Version 1, 6 October 2026. Supersedes the three proposals in `docs/brand/proposals/`.
This is the decision. The proposals stay as the record of the argument.*

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
  closer to you. Hairline borders do the structure. Shadows only on things that float.
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
| 5 | Density | **Set per surface, never by the user.** Queue: comfortable cards. Every list: compact 44px rows in one container instead of separate cards. No density setting. | Daily use and fast scanning. The people list today spends about 66px per person in separate cards. At 44px, a 900px viewport shows about 14 people instead of 8. A setting is one more thing to maintain in a solo codebase. | A user setting would cover the laptop screen and the large monitor, and the days you want air. |
| 6 | Network graph | **A hybrid.** Instrument-style canvas (the dot grid lives only here, and the simulation stops when it settles). Company-coloured nodes, kept. Stage is encoded as a hollow or filled node, the notebook's idea. Rope orange is the only highlight. | Graph nodes are the second place company colour belongs, and the owner likes it. Hollow versus filled works without colour. Stage-weighted edges (the chalk-and-rope proposal) do not fit the data: edges are mutual links between two contacts, not your relationship with either one. | A pure topo (single ink, stage on edges) would be the most distinctive portfolio image. |
| 7 | Logo | **The top-rope arch** (from "quiet instrument"). Not the figure-eight knot. | Two proposals chose the knot, but it fails two practical tests. Its over-and-under crossing turns to mush at 16px, and Gemini reliably draws knots wrong, so the owner would be fixing topology instead of refining. The arch is three points and one line. It is literally a belay (anchor, climber, belayer), it is a three-node graph fragment for the network side, and it holds at favicon size. | The figure-eight is the most trusted object in climbing, checked by a partner, and it doubles as a B. |
| 8 | Panel header: brand wash or a 4px strip | **Keep the wash**, made safer: a 16% brand-tinted gradient fading to the panel colour, plus a 3px brand band on the top edge. Nothing else in the panel takes brand colour. | The owner asked for this explicitly. Contrast is computed: at 16%, `fg-1` stays at 8.8:1 or better and `fg-2` at 5.4:1 or better against every tested brand, including pure white and lime. | A strip says the panel is about your relationship with the company, not the company's marketing. |
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
     doesn't have a job. The only gradients are the brand header wash and the graph
     canvas lift.

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

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | Use |
|---|---|---|---|---|---|---|
| `canvas` | `#0D0E10` | `oklch(0.165 0.004 260)` | — | 1.06 | 1.14 | Page background, input fill on panels |
| `surface` | `#141618` | `oklch(0.198 0.005 260)` | 1.06 | — | 1.07 | Cards, list containers, tab bar |
| `raised` | `#1B1D1F` | `oklch(0.228 0.006 260)` | 1.14 | 1.07 | — | Slide-over panels, popovers, modals, tooltips |
| `lift` | `#232528` | `oklch(0.262 0.007 260)` | 1.26 | 1.18 | 1.10 | Row hover, active tab segment, pressed quiet button |
| `line-1` | `#232528` | `oklch(0.262 0.007 260)` | 1.26 | 1.18 | 1.10 | Dividers between rows inside a container |
| `line-2` | `#2F3236` | `oklch(0.315 0.008 260)` | 1.50 | 1.41 | 1.31 | Card, container and panel borders |
| `line-3` | `#4A4D52` | `oklch(0.420 0.009 260)` | 2.28 | 2.14 | 1.99 | Hover border on cards and secondary buttons |
| `line-input` | `#606368` | `oklch(0.500 0.009 260)` | **3.20** | **3.01** | 2.80 | Input and checkbox borders (the 3:1 non-text rule on canvas and surface) |

**Text**

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | vs lift | Use |
|---|---|---|---|---|---|---|---|
| `fg-1` | `#ECEEF0` | `oklch(0.948 0.004 260)` | **16.60** | **15.60** | **14.54** | **13.21** | Names, titles, values, primary text |
| `fg-2` | `#B9BCC1` | `oklch(0.795 0.008 260)` | **10.14** | **9.52** | **8.88** | **8.07** | Body copy in panels, role titles, secondary text |
| `fg-3` | `#90949A` | `oklch(0.665 0.010 260)` | **6.33** | **5.95** | **5.55** | **5.04** | Metadata, labels, placeholders, timestamps. **The dimmest readable text.** |
| `fg-4` | `#606369` | `oklch(0.500 0.010 260)` | 3.21 | 3.01 | 2.81 | 2.55 | Disabled controls and `·` separators only. Never information. |

`fg-3` passes AA (4.5:1) on every surface, including hover. That is why it is the
floor. Nothing a person has to read uses `fg-4`.

#### 2.3 Accent: Rope

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | vs lift | Use |
|---|---|---|---|---|---|---|---|
| `rope` | `#F67F3D` | `oklch(0.72 0.165 47)` | **7.38** | **6.93** | **6.46** | **5.87** | Primary button fill, focus ring, active nav underline, rope text |
| `rope-hover` | `#FD9C5D` | `oklch(0.78 0.140 52)` | 9.28 | 8.72 | 8.12 | 7.38 | Hover on rope fills and rope text |
| `rope-press` | `#E06C34` | `oklch(0.66 0.160 44)` | 5.85 | 5.50 | 5.12 | 4.66 | Pressed |
| `rope-wash` | `#412212` | `oklch(0.29 0.055 47)` | 1.34 | 1.26 | 1.18 | — | Selected row or keyboard-cursor row background |
| `on-rope` | `#0D0E10` (= `canvas`) | — | — | — | — | — | Text and icons on a rope fill |

- Text on rope: `on-rope` on `rope` is **7.38**, on `rope-hover` **9.28**, on
  `rope-press` **5.85**. **White on rope is 2.62. Never use it.**
- On `rope-wash`: `fg-1` **12.35**, `fg-2` **7.54**, `rope` **5.49**.
- **Disabled** primary button: `lift` fill, `fg-4` text, no rope. Rope never means "you
  can't".
- **Focus ring:** `outline: 2px solid rope; outline-offset: 2px`. The offset shows the
  canvas behind it, so the ring is 7.38:1 against that gap, even next to a white logo
  plate (rope against white alone is only 2.62).

#### 2.4 Semantic colours

| Token | Hex | OKLCH | vs canvas | vs surface | vs raised | Meaning |
|---|---|---|---|---|---|---|
| `ok` | `#7FCC94` | `oklch(0.78 0.110 152)` | 10.09 | 9.47 | 8.83 | It happened: sent, scan succeeded, offer |
| `warn` | `#ECCA6C` | `oklch(0.85 0.120 90)` | 12.17 | 11.43 | 10.65 | Getting close: due within 2 days, a source returned 0 rows |
| `alarm` | `#F0626E` | `oklch(0.68 0.175 18)` | 6.14 | 5.77 | 5.38 | Stale or broken: failed scan arm, posting opened 7+ days ago and not sent, destructive hover |

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
| Home signal card headings (pink and blue) | `label` eyebrow in `fg-3` |

Fallback, only if the owner misses the cue after two weeks of use: a 2px section tick
to the left of the page title. It must be argued for. Do not ship it by default.

#### 2.6 Company colour rules

The brand colour `B` is `usableAccent(brandColor(domain))` from `lib/brand-colors.ts`.

**Allowed, and only here:**

1. **Logo tiles** (the logo itself, on its white or brand plate, at full strength).
2. **Slide-over header wash** (role panel and contact panel):
   - a 3px band at the top edge in `B` at 100%;
   - a background of
     `linear-gradient(180deg, color-mix(in oklab, B 16%, var(--color-raised)) 0%, var(--color-raised) 100%)`
     across the header block only (logo, name, title, stage). It stops at the
     header's bottom border (`line-2`).
   - Text on the wash: `fg-1` and `fg-2` only. Computed worst cases at the top of the
     gradient, against white, `#FFD43B` yellow, `#C6F432` lime, Figma `#F24E1E` and
     Spotify `#1DB954`: **`fg-1` ≥ 8.81, `fg-2` ≥ 5.38.** `fg-3` drops to 2.7 on a
     white brand, so it is **not allowed on the wash**.
   - Remove the blurred blob (`blur-3xl` at 20%). The gradient replaces it.
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
- **IBM Plex Mono** (static 400 and 500). Used only for **numbers that get compared or
  scanned**:
  - scores, day counts and gaps (`12d`, `+12d`), dates in log columns (`06 Oct`),
    times, salary ranges, counts in tabs and group headers, the 300-character counter,
    and keyboard hints.
  - **Never** for names, sentences, buttons or labels.
  - Fixed width means number columns line up without a table.

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

The base size is 14px. Line heights sit on a 4px grid. Negative tracking only at 20px
and above. Weights in use: 400, 500 and 600 (700 only for the wordmark).

| Token | Family | Size / line | Weight | Width | Tracking | Use |
|---|---|---|---|---|---|---|
| `display` | Archivo | 28 / 32 | 600 | 100 | −0.02em | At most one per page: Home's date, Insights' headline number |
| `stat` | Archivo, `tnum` | 28 / 32 | 600 | 87 | −0.01em | The signal numbers on Home and Insights |
| `h1` | Archivo | 20 / 28 | 600 | 100 | −0.012em | Page titles |
| `h2` | Archivo | 16 / 22 | 600 | 100 | −0.005em | Panel titles: person or role name in a slide-over |
| `h3` | Archivo | 14 / 20 | 600 | 100 | 0 | Card titles, company name, person name in rows |
| `body` | Archivo | 14 / 20 | 400 | 100 | 0 | Headlines, notes, chat, summaries |
| `body-sm` | Archivo | 13 / 18 | 400 | 100 | 0 | Role title under a name, the next-action line |
| `meta` | Archivo | 12 / 16 | 400 | 100 | +0.005em | Metadata lines, helper text |
| `button` | Archivo | 13 / 16 | 500 | 100 | 0 | Buttons and tabs |
| `chip` | Archivo | 12 / 16 | 500 | 87 | +0.01em | Stage chips, tags, filter toggles |
| `label` | Archivo, uppercase | 11 / 16 | 600 | 80 | +0.08em | Section eyebrows ("COMING UP", "CONNECTED"), table headers. Always `fg-3`. |
| `data` | Plex Mono | 12 / 16 | 400 | — | 0 | Days, dates, scores, salary, counts |
| `data-sm` | Plex Mono | 11 / 16 | 400 | — | 0 | Counts in group headers and tabs, graph legend counts |
| `kbd` | Plex Mono | 10 / 14 | 500 | — | +0.02em | Key hints in a 16px box with a 1px `line-2` border and 4px radius |
| `wordmark` | Archivo, uppercase | 13 / 16 | 700 | 75 | +0.14em | "BELAY" in the nav and lockup |

**Rules**

- Sentence case everywhere except `label` and `wordmark`. No italics in the UI. The
  current `tracking-widest` (0.1em) on 12px eyebrows becomes `label`.
- **Emphasis comes from colour step (`fg-1` against `fg-3`), not bold.** Never use
  `font-bold` in body text.
- **Tabular figures:** every number that changes, stacks or sits in a column is either
  Plex Mono (`data`) or Archivo with `font-variant-numeric: tabular-nums` (`stat`, and
  numbers inside sentences in the next-action line). Proportional figures are only
  acceptable inside running prose. **Verify** that Archivo's `tnum` works in a quick
  test. If it doesn't, `stat` switches to Plex Mono 500.
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
- **Structure comes from 1px hairlines.** Cards and containers use `line-2`, which
  moves to `line-3` on hover. Rows inside a container are divided by `line-1`. There
  is no lift, glow or ring on hover.
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
| Two-line list row (person, pipeline role) | **44px** | 24px logo, `h3` and `body-sm`, 12px horizontal padding |
| Single-line list row (Coming up, history, notes, sites) | **36px** | Mono date column first |
| Group header in a list | 32px | Sticky, `label` plus `data-sm` count |
| Queue card (role) | about 176px (min 160) | 16px padding, 32px logo. Two side by side at 1280px or more |
| Queue card (person) | about 120px | Same frame |
| Home signal tile | 88px | `label`, then `stat` |
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
  focus.
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
  `title` ("Accept (A)"). The keyboard-cursor card has a 1px `rope` border. Escape
  closes the top layer only.
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

- `h1` in `fg-1`, with the next-action line 4px below it in `body-sm`.
- **Next-action line:** numbers in `fg-1` with `tabular-nums`, labels in `fg-3`, and
  separators as `·` in `fg-4` with 6px on each side. Example: **3** to triage · **12**
  to message · **2** to schedule. When everything is zero: "Nothing waiting" in
  `fg-3`.
- Actions on the right, 8px apart: at most **one primary** and one or two secondary
  buttons.
- The Home `h1` is "Home". The line under it is the long date in `fg-3`.

#### 5.3 Tabs with count badges (`TabBar`)

- **Container:** `surface`, 1px `line-2` border, `rounded-card`, 2px padding.
- **Segment:** 28px high, `px-3`, `button` type, `rounded-control`. At rest it is
  `fg-3`, with `fg-2` on hover. **Active:** `lift` fill and `fg-1`. No shadow.
- **Count:** `data-sm` with 6px gap, no border and no pill. At rest it is `fg-3`, and
  `fg-2` on the active tab. **A count of undecided work** (the Queue tab when it is
  above 0) is `rope`. That is the "needs you" signal. Other counts (Pipeline, People)
  stay neutral.

#### 5.4 Buttons

| Kind | Rest | Hover | Press | Disabled |
|---|---|---|---|---|
| **Primary** (one per view) | `rope` fill, `on-rope` text, no border | `rope-hover` | `rope-press` | `lift` fill, `fg-4` text |
| **Secondary** | `surface` fill, 1px `line-2`, `fg-1` text | `line-3` border, `lift` fill | `lift` fill | `fg-4` text, `line-1` border |
| **Quiet** (inline: Cancel, Clear, Follow up, Undo) | transparent, `fg-2` | `fg-1` text, `lift` fill | `line-2` fill | `fg-4` |
| **Destructive** (quiet variant) | transparent, `fg-3` | `alarm` text plus `Trash` glyph | — | — |

- All buttons: `button` type, `rounded-control`, 32px (or 28px compact), 16px icon
  leading with 6px gap. Remove `hover:opacity-90` and the `ring-1` halo.
- **Queue Accept and Pass** are secondary. On the card under the keyboard cursor,
  Accept becomes primary. That means only one rope fill shows at a time, and it marks
  where A will land.
- Company colour never touches a button. The Save button in a panel is a primary
  button.

#### 5.5 Chips, stage chips, tags, tier badges

**Base chip:** 20px, `px-1.5`, `chip` type, `rounded-control`.

**Stage chips: one shared ramp** (`components/StageChip.tsx`, replacing both
`STATUS_COLORS` and `CONTACT_STAGE_COLORS`). How full the chip is shows how far along
it is. Text contrast is computed on each fill:

| Step | Fill | Text (contrast) | Applications | Network |
|---|---|---|---|---|
| 0 | none, 1px `line-input` border | `fg-2` | Applying | Identified |
| 0 dashed | none, **1px dashed** `line-input` | `fg-2` | — | **Drafted** (written, not sent) |
| 1 | `#2F3236` (`line-2`) | `fg-1` (11.07) | Applied | Sent |
| 2 | `#4A4D52` (`line-3`) | `fg-1` (7.30) | Screen | Connected |
| 3 | `#7D8086` `oklch(0.60 0.010 260)` | `canvas` (4.88) | Interviewing | Replied |
| 4 | `#B4B7BD` `oklch(0.78 0.008 260)` | `canvas` (9.61) | Final round | Scheduled |
| 5 | `#ECEEF0` (`fg-1`) | `canvas` (16.60) | Offer | Chatted |
| 5 plus check | `fg-1` with a 12px `Check` glyph | `canvas` | Accepted | — |
| End | none, no border | `fg-3` | Rejected, Withdrawn | No response |

- A stage chip that is also the stage control (a `<select>`) keeps this look and adds
  a 12px `ChevronDown` in the chip's text colour. **In the contact panel, the chip is
  this ramp, not the brand colour.**
- **Tags** (relationship tags, queue tags): no fill, `fg-2` text, 1px `line-2`
  border. Removable tags show a 12px `X` on hover.
- **Filter toggles** (company filter row): 24px, 1px `line-2`, `fg-2`. **On:** `lift`
  fill, `line-3` border, `fg-1`. An optional 6px brand dot before the name is allowed
  (2.6). "Clear" is a quiet button.
- **Tier badge:** 20px square, `data` type. S: `fg-1` fill with `canvas` text.
  A: 1px `fg-2` border with `fg-1` text. B: `line-input` border with `fg-2` text.
  C and D: `line-2` border with `fg-3` text. Untracked: dashed `line-2` border with a
  `·` in `fg-3`.

#### 5.6 Cards

**Role card (queue):**

- `surface`, 1px `line-2`, `rounded-card`, 16px padding. Hover border `line-3`.
  **Keyboard cursor:** 1px `rope` border and nothing else.
- Row 1: 32px logo tile (company colour lives here), company in `h3` `fg-1`, role
  title in `body-sm` `fg-2`. Score is right-aligned in `data` `fg-1` (no colour scale;
  the queue is already sorted).
- Row 2, the meta line: `meta` `fg-3`. Places are in Archivo. Numbers (`2d`, `4+ yrs`,
  `$170–230k`) are in `data` mono. `·` separators in `fg-4`.
- Row 3: the headline in `body` `fg-1`, at most 2 lines.
- Row 4: up to 5 tags. Then the action row: Open (quiet, `ExternalLink`), Pass
  (secondary), Accept (secondary, or primary on the cursor card), with `kbd` hints.
- After a decision, the lower half shows the "Why this one?" / "Why not?" input
  (5.9).

**Person card (people queue):** the same frame and padding. A 32px logo, name in
`h3`, then title · company in `body-sm` `fg-2`, the mutuals line in `meta` `fg-3` with
a `Users` glyph, then the actions. No tags row.

**Home signal tile:** `surface`, `line-2`, 12px padding, `label` eyebrow, `stat`
number in `fg-1` (`fg-3` when 0). The whole tile links somewhere. Hover border
`line-3`.

#### 5.7 List rows (people list, pipeline, Coming up, history)

- **One container per group, not one card per row:** `surface`, 1px `line-2`,
  `rounded-card`, with rows divided by `line-1`. This replaces today's
  `space-y-2` stack of bordered cards.
- **Two-line row (44px):** 24px logo tile with `rounded-control`, then the name in
  `h3` `fg-1` (truncate) and `company · title` in `body-sm` `fg-3`. The right-hand
  cluster has 8px gaps: optional "no summary" (`meta` `fg-3`), day count (`data`,
  `fg-3`, or `rope` with a `Clock` glyph when overdue), quiet compact actions, and the
  stage chip last, right-aligned so the chips form a column.
- Hover: `lift`. Selected (its panel is open): `rope-wash` with a 2px `rope` bar on
  the left inside edge.
- **Group header (32px, sticky):** `label` stage name in `fg-3` plus a `data-sm` count
  in `fg-3`, sitting on `canvas` above the container.
- **Log rows (36px):** a fixed **56px** date column first, in `data` `fg-3`
  (`06 Oct`, with the time in a second column for Coming up), then the entry in
  `body-sm`. Pipeline history gaps show as `+12d` in `data` `fg-3`.

#### 5.8 Slide-over panel (role workspace and contact panel)

- Fixed right, full height, 640px wide, `raised` background, 1px `line-2` left border
  (**not** brand colour), `shadow-float`, and a scrim behind it. It slides in over
  200ms and out over 140ms.
- **Header**, padding 16px top and bottom and 20px on the sides:
  - the 3px brand band at the top edge, and the 16% brand gradient wash behind the
    header (2.6);
  - a 40px logo tile, then the name in `h2` `fg-1`, `title · company` in `body-sm`
    `fg-2`, and the stage chip plus "How we met" in `meta` `fg-2`. **`fg-3` is not
    allowed on the wash.**
  - the close `X` as a quiet icon button at the top right, `fg-2`.
- **Body:** sections separated by 24px, each starting with a `label` eyebrow in
  `fg-3` (not brand colour). Inner cards are `surface` on `raised`. Inputs are
  `canvas`.
- **Footer actions** (Save and similar) are primary or secondary buttons. **None take
  brand colour.**

#### 5.9 Inputs

- 32px, `canvas` fill (on `surface` or `raised`), 1px `line-input` border,
  `rounded-control`, `px-2.5`, `body` text in `fg-1`, placeholder in `fg-3`.
- Hover: `fg-4` border. Focus: `rope` border plus the global focus ring. Error:
  `alarm` border, plus an `AlertTriangle` and message in `meta` `alarm` below.
- Textareas use the same style and grow with `AutoResizeTextarea`. The paste box shows
  a character or limit counter in `data-sm` `fg-3` at the bottom right (`212/300`),
  which turns `alarm` with a glyph past the limit.
- Selects use the same frame with a 14px `ChevronDown` in `fg-3`.
- Inline label above a field: `meta` in `fg-2`. Field groups are 12px apart.

#### 5.10 Empty states

- One line in `body-sm` `fg-3`, plus at most one action (a secondary button or a quiet
  link). Centred in the region, with 32px vertical padding. If the empty state sits
  where a list would be, it goes inside a `surface` container with a **dashed**
  `line-2` border.
- No illustrations, no icons larger than 16px, no encouragement.
- Formula: what is missing, then how it fills. For example: "No people yet. Add
  someone from the queue, or use Add person."

#### 5.11 Chat sheet and tooltips

- **Chat sheet:** `raised`, `rounded-panel` at the top corners, `shadow-float`. The
  title is "Ask Claude" in `h3`. Your messages sit on `lift`, Claude's on none. While
  waiting, "Writing…" in `meta` `fg-3`, not italic.
- **Tooltips and popovers:** `raised`, 1px `line-2`, `rounded-card`, `shadow-float`,
  8px/10px padding, `meta` text.

#### 5.12 Activity heatmap

- **One neutral ramp**, coloured by total actions per day. A day where both sides
  happened is no longer a third colour.

  | Level | Hex | OKLCH | vs `surface` |
  |---|---|---|---|
  | `heat-0` (none) | `#232528` | `oklch(0.262 0.007 260)` | 1.18 |
  | `heat-1` | `#3F4348` | `oklch(0.38 0.010 260)` | 1.82 |
  | `heat-2` | `#656970` | `oklch(0.52 0.012 260)` | 3.29 |
  | `heat-3` | `#9A9FA6` | `oklch(0.70 0.012 260)` | 6.81 |
  | `heat-4` | `#E2E5E9` | `oklch(0.92 0.006 260)` | 14.35 |

  Neighbouring steps differ by 1.5–2.1:1, so each step reads at 11px.
- 11px cells with a 2px gap and 2px radius. Cell borders are not used.
- **Today:** a 1.5px inset `rope` ring. **Selected day:** a 1.5px inset `fg-1` ring.
- **Day detail** (under the grid): the date in `data`, then two labelled groups,
  "Applying" (Roles triaged, Applications submitted, Interviews) and "People" (People
  identified, People messaged, Coffee chats), each with a count in `data` `fg-1` and a
  year total in `fg-3`. The side is shown by position and words, not hue.
- Legend: "Less" plus five cells plus "More", in `meta` `fg-3`. Streak in `meta`
  `fg-2`: "14-day streak" or "No streak".

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
  company is focused, the focused edges turn `rope` at 85% and 1.5px, and everything
  else dims to 6%.
- **Focus ring** on the selected or hovered node: a 1.5px `rope` ring with a 3px gap.
  **Rope is the only highlight colour in the graph.** Replace the `ACCENT = "#8fcdfd"`
  constant.
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
5. **One name per thing.** If the nav says Home, the page says Home.
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
| 9 | `app/networking/page.tsx:716` empty people list | Nobody here yet. Add someone from the queue and they land here. | No people yet. Add someone from the queue, or use Add person. |
| 10 | `app/networking/page.tsx:815` day-count tooltip | Time to reach out again / Days since your last touch | {n} days since last touch. Follow up. / {n} days since last touch |
| 11 | `components/PeopleQueue.tsx:193` (and similar) | Could not reach the server. Try again. | Can't reach Belay on this machine. Is `npm run dev` running? |
| 12 | `components/ContactPanel.tsx:899` placeholder | Paste their LinkedIn About section and current role. Call notes or a message thread work too. Belay writes a two or three sentence summary of who they are. | Paste their About section, call notes or a thread. Belay writes a 2–3 sentence summary. |
| 13 | `components/PageChrome.tsx` next-action line, all zero | All caught up | Nothing waiting |

Strings to keep as they are, because they are already right: "Pass. They will not be
offered again (P)", "Why this one?" / "Why not?", "no summary", "You followed up;
restart the count".

### 8. Implementation

#### 8.1 `globals.css`: paste-ready

This replaces the current `@theme` and `:root` blocks. The `zinc` remap at the bottom
is **temporary** (phase 1, see 8.3): it re-tints every existing `zinc-*` class with no
component edits, and it is deleted in phase 4.

```css
@import "tailwindcss";

/* Fonts come from next/font in app/layout.tsx as CSS variables on <html>.
   `inline` makes the utilities reference the variable directly. */
@theme inline {
  --font-sans: var(--font-archivo), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, "SFMono-Regular", monospace;
}

@theme {
  /* Surfaces: elevation is lightness */
  --color-canvas: #0d0e10;   /* oklch(0.165 0.004 260) */
  --color-surface: #141618;  /* oklch(0.198 0.005 260) */
  --color-raised: #1b1d1f;   /* oklch(0.228 0.006 260) */
  --color-lift: #232528;     /* oklch(0.262 0.007 260) */

  /* Lines */
  --color-line-1: #232528;     /* oklch(0.262 0.007 260) */
  --color-line-2: #2f3236;     /* oklch(0.315 0.008 260) */
  --color-line-3: #4a4d52;     /* oklch(0.420 0.009 260) */
  --color-line-input: #606368; /* oklch(0.500 0.009 260) 3.2:1 on canvas */

  /* Text: fg-3 is the readable floor (>=5.0:1 on every surface) */
  --color-fg-1: #eceef0; /* oklch(0.948 0.004 260) */
  --color-fg-2: #b9bcc1; /* oklch(0.795 0.008 260) */
  --color-fg-3: #90949a; /* oklch(0.665 0.010 260) */
  --color-fg-4: #606369; /* oklch(0.500 0.010 260) disabled and separators only */

  /* The one accent: your next move */
  --color-rope: #f67f3d;       /* oklch(0.72 0.165 47) */
  --color-rope-hover: #fd9c5d; /* oklch(0.78 0.140 52) */
  --color-rope-press: #e06c34; /* oklch(0.66 0.160 44) */
  --color-rope-wash: #412212;  /* oklch(0.29 0.055 47) */
  --color-on-rope: #0d0e10;

  /* Semantics: always with a glyph and a word or number */
  --color-ok: #7fcc94;    /* oklch(0.78 0.110 152) */
  --color-warn: #ecca6c;  /* oklch(0.85 0.120 90) */
  --color-alarm: #f0626e; /* oklch(0.68 0.175 18) */

  /* Stage ramp fills (steps 1-5); step 0 and end states are unfilled */
  --color-stage-1: #2f3236;
  --color-stage-2: #4a4d52;
  --color-stage-3: #7d8086; /* text on it: canvas */
  --color-stage-4: #b4b7bd; /* text on it: canvas */
  --color-stage-5: #eceef0; /* text on it: canvas */

  /* Heatmap */
  --color-heat-0: #232528;
  --color-heat-1: #3f4348;
  --color-heat-2: #656970;
  --color-heat-3: #9a9fa6;
  --color-heat-4: #e2e5e9;

  /* Graph */
  --color-graph-neutral: #a1a5ab;

  /* Radii */
  --radius-control: 4px;
  --radius-card: 6px;
  --radius-panel: 10px;

  /* Elevation, for floating layers only */
  --shadow-float: 0 12px 32px -8px rgb(0 0 0 / 0.6), 0 0 0 1px #2f3236;

  /* Motion */
  --ease-enter: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);

  /* Type scale: text-display, text-h1 ... sets size, line height, tracking, weight */
  --text-display: 28px;
  --text-display--line-height: 32px;
  --text-display--letter-spacing: -0.02em;
  --text-display--font-weight: 600;
  --text-stat: 28px;
  --text-stat--line-height: 32px;
  --text-stat--letter-spacing: -0.01em;
  --text-stat--font-weight: 600;
  --text-h1: 20px;
  --text-h1--line-height: 28px;
  --text-h1--letter-spacing: -0.012em;
  --text-h1--font-weight: 600;
  --text-h2: 16px;
  --text-h2--line-height: 22px;
  --text-h2--letter-spacing: -0.005em;
  --text-h2--font-weight: 600;
  --text-h3: 14px;
  --text-h3--line-height: 20px;
  --text-h3--font-weight: 600;
  --text-body: 14px;
  --text-body--line-height: 20px;
  --text-body-sm: 13px;
  --text-body-sm--line-height: 18px;
  --text-meta: 12px;
  --text-meta--line-height: 16px;
  --text-meta--letter-spacing: 0.005em;
  --text-button: 13px;
  --text-button--line-height: 16px;
  --text-button--font-weight: 500;
  --text-chip: 12px;
  --text-chip--line-height: 16px;
  --text-chip--letter-spacing: 0.01em;
  --text-chip--font-weight: 500;
  --text-label: 11px;
  --text-label--line-height: 16px;
  --text-label--letter-spacing: 0.08em;
  --text-label--font-weight: 600;
  --text-data: 12px;
  --text-data--line-height: 16px;
  --text-data-sm: 11px;
  --text-data-sm--line-height: 16px;
  --text-kbd: 10px;
  --text-kbd--line-height: 14px;

  /* PHASE 1 ONLY: re-tint every existing zinc class. Delete in phase 4.
     Lifts zinc-600 and zinc-500 to the readable floor so dim text passes AA. */
  --color-zinc-50: #eceef0;
  --color-zinc-100: #eceef0;
  --color-zinc-200: #eceef0;
  --color-zinc-300: #b9bcc1;
  --color-zinc-400: #b9bcc1;
  --color-zinc-500: #90949a;
  --color-zinc-600: #90949a;
  --color-zinc-700: #4a4d52;
  --color-zinc-800: #2f3236;
  --color-zinc-900: #141618;
  --color-zinc-950: #0d0e10;
}

/* Composite styles that need more than size */
@utility t-label {
  font-size: var(--text-label);
  line-height: var(--text-label--line-height);
  letter-spacing: var(--text-label--letter-spacing);
  font-weight: 600;
  font-stretch: 80%;
  text-transform: uppercase;
  color: var(--color-fg-3);
}
@utility t-chip {
  font-stretch: 87.5%;
}
@utility t-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
@utility wordmark {
  font-size: 13px;
  line-height: 16px;
  font-weight: 700;
  font-stretch: 75%;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

:root {
  --dur-hover: 90ms;
  --dur-quick: 140ms;
  --dur-panel: 200ms;
  --dur-panel-exit: 140ms;
  color-scheme: dark;
}

html {
  scrollbar-gutter: stable;
}

body {
  background: var(--color-canvas);
  color: var(--color-fg-1);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 20px;
}

:focus-visible {
  outline: 2px solid var(--color-rope);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 80ms !important;
    transition-property: opacity !important;
    animation: none !important;
  }
}
```

Utility names this produces: `bg-canvas`, `bg-surface`, `bg-raised`, `bg-lift`,
`border-line-2`, `text-fg-3`, `bg-rope`, `text-on-rope`, `bg-rope-wash`, `text-alarm`,
`bg-stage-3`, `rounded-card`, `shadow-float`, `ease-enter`, `text-h1`, `text-label`,
`text-data`, plus `t-label`, `t-num` and `wordmark`. For duration, use
`duration-90`, `duration-140` and `duration-200`.

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
  3px band and the 16% header wash. The left border goes to `line-2`.
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
