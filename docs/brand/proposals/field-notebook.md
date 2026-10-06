# Belay design language — proposal: Field notebook

> One of three rival directions. This document argues for this one, then lists where it is weak.

---

## 1. The vibe

**A well-kept logbook of your career, written in pencil on warm black paper and read at a glance every morning.**

| Is | Is | Is | Is | Is |
|---|---|---|---|---|
| **Kept** (dated, ruled, cumulative) | **Exact** (numbers line up, dates are absolute) | **Warm** (paper and graphite, not glass and neon) | **Quiet** (the record speaks louder than the chrome) | **Worn-in** (feels like it has been used daily for a year) |

**It must never be:**
1. **Precious.** No faux paper, no grain, no torn edges, no handwriting font, no leather. If it slows triage by one keystroke, it goes.
2. **Nostalgic cosplay.** No sepia, no typewriter clacks, no "vintage" badges. This is the structure of a logbook, not its costume.
3. **A dashboard.** No glowing KPI tiles, gradients, glassmorphism or hero charts. Belay records what happened; it doesn't put on a show.

---

## 2. Why it fits Belay specifically

**The name already describes a logbook.** Climbers keep logbooks: a dated line per climb with the route, grade, partner, style and a note. Belay's data has the same columns. A role is the route, its tier and score are the grade, the referrer or mutual is the partner, the stage is the style (attempted, sent, flashed), and the notes are notes. The pipeline's "gap in days between stages" is a pitch log. The network's dated touches ("Met at Config 2026", follow-ups, call logs) are belay partners in the back pages. Other directions would have to put climbing imagery on top of Belay. This one takes the structure of a climbing logbook and leaves the imagery out.

**The owner writes like this already.** The codebase is full of reasoned, dated, first-person notes. `contact-stages.ts` explains *why* "Drafted" exists ("four AI-written messages sat in the database for months, finished and unsent"). The product is someone's working record of their own judgement, and the visual language should look like one.

**It suits daily use.** A logbook can be scanned. Entries go down the page, dates sit in a fixed margin, and rules separate entries without boxing them. That suits the two jobs Belay does every day: triage (top of the page, newest first, act and move on) and recall (when did I last talk to Daniel, what did I send Stripe). Ledger structure makes dense lists easier to scan, because the eye follows the margin and the rules instead of reading every card border.

**Company colours look better on paper than on chrome.** The owner likes that brand colours show up in logos and panel headers. On a neutral warm ground, a Figma or Stripe tile reads like a sticker or stamp pressed into the book: it is the only saturated object on the line, so it gets noticed without competing with UI accents. Cool zinc gives logos a slightly clinical, app-store look. Warm ink gives them the look of a collection.

**It suits the portfolio.** A Google-bound product designer gains little from showing yet another Linear clone. A tool that is clearly *authored*, with its own typography, ledger grid and voice, while still being dense and keyboard-fast, shows taste and systems thinking together. It reads as "designed for one person very well", which is what Belay is.

---

## 3. Colour

### Principle
Graphite on warm black. The ground stays out of the way. **Chroma marks meaning and nothing else**, and every chromatic colour has one job:

| Hue | Job |
|---|---|
| **Highlighter** (the one accent) | *Where you are*: focus, keyboard cursor, today, the current selection, search hits |
| **Pink / blue** (section inks) | *Which side of the search*: applications or people |
| **Moss / ochre / brick** | *State*: done, needs attention, gone stale |
| **Company colours** | *Who*: logos and panel header stripes only |

### Dark palette (primary)

Contrast ratios are WCAG 2.x against **ground `#13110E`**, the main background.

| Token | Hex | OKLCH | Contrast vs ground | Use |
|---|---|---|---|---|
| `--sunken` | `#0D0C0A` | `oklch(15.5% 0.004 85)` | — | inputs, the triage well, code |
| `--ground` | `#13110E` | `oklch(17.9% 0.007 78)` | 1.00 | page background |
| `--surface` | `#1B1915` | `oklch(21.4% 0.008 85)` | 1.07 | cards, list rows on hover-free lists |
| `--raised` | `#24211C` | `oklch(24.9% 0.010 81)` | 1.18 | side panel, menus, modal |
| `--hover` | `#2B2722` | `oklch(27.5% 0.011 73)` | 1.27 | row hover, pressed ghost button |
| `--rule` | `#312C25` | `oklch(29.6% 0.014 76)` | 1.36 | hairline rules between entries, card borders |
| `--rule-strong` | `#4A433A` | `oklch(38.7% 0.018 74)` | 1.93 | margin rule, input borders, double rule under totals |
| `--ink` | `#EEE7DA` | `oklch(93.0% 0.019 83)` | **15.3 : 1** (AAA) | names, headings, primary text |
| `--ink-2` | `#BFB6A6` | `oklch(77.9% 0.024 82)` | **9.4 : 1** (AAA) | body, role titles, summaries |
| `--ink-3` | `#948B7C` | `oklch(64.0% 0.024 81)` | **5.6 : 1** (AA) | metadata, dates in margin, section labels |
| `--ink-4` | `#6B6357` | `oklch(50.4% 0.021 78)` | 3.2 : 1 (AA large / UI only) | placeholders, disabled, "No response" rows. **Never for information you need.** |

Note: `--ink-3` on `--raised` drops to 4.77 : 1. It still passes AA, but that is the floor, and nothing smaller than 12px may use `--ink-3` on panels.

**Accent: Highlighter**

| Token | Hex | OKLCH | Contrast | Use |
|---|---|---|---|---|
| `--hl` | `#F2D46B` | `oklch(87.5% 0.129 94)` | 12.9 : 1 vs ground | focus ring (2px, 2px offset), keyboard cursor bar on triage card, "today" rule in logs |
| `--hl-hover` | `#F8E08C` | `oklch(90.8% 0.107 94)` | 14.4 : 1 | hover on highlighted controls |
| `--hl-press` | `#D8BA4F` | `oklch(79.5% 0.130 94)` | 9.9 : 1 | pressed |
| `--hl-wash` | `#3A331C` | `oklch(32.2% 0.038 93)` | — | selected row background, search-match background behind `--ink` text |
| `--on-hl` | `#1A1608` | `oklch(20.1% 0.026 94)` | 12.4 : 1 on `--hl` | text on a highlighter fill |

Why yellow? It is the highlighter you run over the line that matters today. It is the only hue in the system that means neither section, and focus currently has no colour of its own: any focus ring in a section ink would vanish against that section's own buttons and chips. At 87% lightness it is the clearest focus indicator possible on warm black.

**Semantic**

| Token | Hex | OKLCH | Contrast vs ground | Meaning |
|---|---|---|---|---|
| `--success` | `#9CC48A` | `oklch(77.7% 0.091 136)` | 9.6 : 1 | offer, sent, done. Moss, not traffic-light green |
| `--warn` | `#E6A35E` | `oklch(76.6% 0.117 65)` | 8.8 : 1 | follow-up due soon, interview within 48h |
| `--alarm` | `#F0897C` | `oklch(73.8% 0.128 28)` | 7.7 : 1 | gone stale, overdue. Replaces today's `#f6a6a0`, which was too close to pink at 12px |

Warn (hue 65) and highlighter (hue 94) are about 30° apart. That holds up as text but is risky as small fills, so **warn is always paired with a glyph** (`◷` or a Lucide `clock-alert`) and never shown as a bare dot.

### Do pink and blue survive? **Yes, as section inks, not as brand colours.**

The argument for keeping them: they already *mean* something. Nav, stage ramps, the activity heatmap and the `--color-accent-both` purple are all built on "pink is applications, blue is people", and the owner has rationalised that rule in code comments three times. Taking it out would cost a learned mapping and gain nothing.

The argument for demoting them: in a notebook, coloured ink is used for marking up, not for printing. So pink and blue lose the jobs that make them feel like brand colours:

- **They keep:** the active nav tab underline, the stage ramp chips, the section's primary button ("Add role", "Add person"), the heatmap and the score numeral.
- **They lose:** every focus ring (goes to highlighter), every link colour (links become `--ink` with a `--rule-strong` underline), "See all (12)" style text links (become `--ink-3`), and the badge outlines on the Queue/Pipeline tabs (become mono numerals in `--ink-3`).
- **Small warm-up, same identity:**

| Token | Was | Now | OKLCH | Contrast vs ground |
|---|---|---|---|---|
| `--ink-apps` | `#FF8DE3` | `#F49AD6` | `oklch(79.5% 0.130 340)` | 9.4 : 1 |
| `--ink-people` | `#8FCDFD` | `#94C8EE` | `oklch(81.0% 0.076 241)` | 10.6 : 1 |
| `--ink-both` | `#C6A4F3` | `#C6A4F3` (unchanged) | `oklch(77.7% 0.116 304)` | 9.0 : 1 |

The change pulls about 25% of the chroma out of each. Full-chroma pink on warm black looks fluorescent. Slightly chalky pink looks like a coloured pencil. Text on a filled section chip is `--ground` (`#13110E`), which gives 9.1 : 1 on pink and 11.1 : 1 on blue.

### Light theme (note, not a commitment)
Paper `#F5F0E6` with ink `#1E1B16` (15.1 : 1). Meta ink `#5C5448` (6.6 : 1). Section inks darken to `#B5338F` pink (4.8 : 1) and `#1F6FA8` blue (4.7 : 1). The highlighter flips to a fill-only `#F7E3A1` behind text, the way a real highlighter works, with focus rings in `#7A6200`. This direction gets a light theme almost for free, because "paper and ink" is its model. It is worth shipping later for printing a week's log or screenshotting for the portfolio.

---

## 4. Typography

Three families, each with a single job. All three are free on Google Fonts and all have variable axes, so the total is three font files.

| Role | Typeface | Why this one |
|---|---|---|
| **Display and headings** | **Newsreader** (Production Type, variable `opsz` 6–72, `wght` 200–800, true italics) | A screen-first serif built for long reading, with a real optical-size axis. At `opsz 72` it is crisp and editorial for page titles. At `opsz 16` it thickens its hairlines enough to survive dark backgrounds, where most display serifs fail. The italic does the "annotation" voice (marginal notes, "met at…"). It is warmer and less mannered than Fraunces, and much sturdier than Instrument Serif, which has one weight and breaks below 20px. |
| **UI and body** | **Instrument Sans** (variable `wght` 400–700, `wdth` 75–100) | A grotesk with a little character (the lowercase `a`, `t` and `y` have some bite) but no quirks at 13px. The width axis is the reason to choose it: chips, stage pills and tag rows can drop to `wdth 87` to recover density without changing the face. It is not Inter, not Geist, and not a Helvetica clone. |
| **Data, dates, numbers, labels** | **IBM Plex Mono** (static 400 / 500; see the note on zeros below) | The ledger voice. Dates in the margin, comp ranges, scores, day counts and section labels. Plex Mono has a hint of typewriter, which suits a logbook, without the costume of Courier. Fixed width means dates and day counts line up into columns by themselves. |

Note on zeros: Plex Mono's default zero is already dotted, so `0` and `O` are never confused in counts like "10d" or "$170k–$230k". Instrument Sans gets `font-variant-numeric: tabular-nums` anywhere a number sits in a sans context.

**Rule: serif above 18px, or for a proper noun at the top of a panel. Never in a list, chip, button, input or table.** The serif is for *titles in the book*, not the entries.

### Scale

Base 14px. The ratio is about 1.25 for headings, and the sizes below 14 are hand-set for density.

| Style | Family | Size / line height | Weight | Tracking | Example |
|---|---|---|---|---|---|
| `display` | Newsreader `opsz 72` | 40 / 44 | 450 | −0.02em | Home title: *Tuesday 6 October* |
| `h1` | Newsreader `opsz 48` | 28 / 32 | 500 | −0.015em | Page titles: *Applications*, *Network* |
| `h2` | Newsreader `opsz 24` | 20 / 26 | 500 | −0.01em | Panel header: *Daniel Okafor*, *Figma — Product Designer, AI* |
| `h3` | Instrument Sans | 15 / 20 | 600 | −0.005em | Card title: company name, person name in list |
| `body` | Instrument Sans | 14 / 20 | 400 | 0 | Summaries, notes, chat |
| `body-strong` | Instrument Sans | 14 / 20 | 550 | 0 | Role title on card |
| `small` | Instrument Sans | 12.5 / 16 | 400 | +0.005em | Tags, secondary meta |
| `annotation` | Newsreader italic `opsz 14` | 13 / 18 | 400 | 0 | Margin notes: *met at Config 2026*, pass reasons |
| `label` | IBM Plex Mono | 11 / 16 | 500 | +0.08em, UPPERCASE | Section heads: `IDENTIFIED · 1`, `COMING UP` |
| `data` | IBM Plex Mono | 12.5 / 20 | 400 | 0 | `06 OCT  14:00`, `$170–230k`, `12d`, `4+ yrs` |
| `data-lg` | IBM Plex Mono | 24 / 28 | 400 | −0.02em | Signal counts on Home (queue 12, pipeline 4) |

Date format, everywhere: `DD MMM` in mono (`06 OCT`), with the weekday added only in the display title. Relative time ("2d old") is a mono suffix in `--ink-3`, never the only date shown.

---

## 5. Shape, space, density, rules, elevation, icons, motion, graph

### Shape
- **Radius:** `0` for rules and list rows, `3px` for controls (buttons, inputs, chips), `6px` for cards and panels. That is square-ish, the way a notebook page is, and it moves away from the soft 8px pill-everything of the current UI. Stage pills become **3px-radius tabs**, not capsules.
- **Logo tiles** keep their own shape (company identity), placed inside a 1px `--rule` frame like a stuck-in stamp.

### Spacing and density
- **4px base.** Steps: 4, 8, 12, 16, 24, 32, 48.
- **The margin.** Every log-shaped view (pipeline history, contact timeline, Home "Coming up", call logs) has a fixed **72px date margin** on the left, set in `data` mono and `--ink-3`, separated from the entry by a 1px `--rule-strong` vertical rule. This one device holds the whole direction together, so it must be used consistently.
- **Two densities**, as a user setting, not per page:
  - *Ledger* (default): rows 36px, card padding 12px, queue cards about 136px tall.
  - *Spread*: rows 44px, card padding 16px.
- **Queue cards stay cards.** Triage is a decision, not a read, so the two-at-a-time card stays. Inside the card, the meta line moves to mono and the tags row moves to `wdth 87` Instrument Sans.

### Rules and borders (the notebook grammar)
| Rule | Meaning |
|---|---|
| 1px solid `--rule` | separates entries |
| 1px solid `--rule-strong` | the margin, input edges |
| **1px dashed `--rule-strong`** | *tentative*: Drafted (written, not sent), unsent drafts, unconfirmed interview times |
| **double rule** (two 1px lines, 2px apart) | *a total or a close*: under the signal counts, above "No response" / "Rejected" (the ruled-off part of the page) |

The dashed rule for "Drafted" is the most useful idea in this proposal. The owner built a whole stage to make "written, not sent" visible. In this direction, that state also gets its own *line style*, and it can be read without colour.

The dot-grid background already in the app stays, as **dot-grid notebook paper**: `--rule` dots at 16px pitch, on `--ground` only, never under cards. It is already there and already right.

### Elevation
None by shadow on the page. Elevation is a **step in surface colour plus a rule**: ground, then surface, then raised. The side panel and modals get one shadow, `0 16px 48px oklch(0% 0 0 / 0.5)`, because they sit *over* the page like a loose sheet. Nothing else casts a shadow.

### Iconography
**Lucide** (already in use), 16px, 1.5px stroke, `--ink-3`, rising to `--ink` on hover. Icons only label actions. They are never decoration and never used as section emblems. Three typographic glyphs do the jobs that would otherwise need icons, and they read like marks in a log: `→` (moved to stage), `·` (meta separator), `◷` (due). No filled icons and no duotone.

### Motion
A notebook does not animate, but a fast tool needs feedback. Motion only confirms that a change happened.

| Event | Duration | Easing |
|---|---|---|
| hover, focus, colour change | 100ms | `cubic-bezier(0.2, 0, 0, 1)` |
| chip / stage change | 140ms | same, with a 1-frame highlighter flash on the row (`--hl-wash` fading to transparent over 600ms). The "ink drying" moment |
| triage card exit (accept / pass) | 160ms, 12px translate and fade | `cubic-bezier(0.3, 0, 0.8, 0.15)` (accelerate out) |
| next card enter | 180ms | `cubic-bezier(0.2, 0, 0, 1)` (decelerate in) |
| side panel open / close | 220ms / 160ms | decelerate / accelerate |

No springs, no bounce, no stagger longer than 3 items × 30ms. With `prefers-reduced-motion`, everything becomes a 0ms swap except the ink-drying flash, which turns into a static 1s `--hl-wash`.

### The network graph: a topo, not a galaxy
Climbing guidebooks draw routes as **topos**: line drawings in a single ink where symbols carry the information. The graph should look like one instead of a glowing force-directed starfield.

- **Ground:** `--sunken`, with the dot grid at 50% opacity. This is the one place the grid is visible under content, because the graph *is* a drawing on the page.
- **Edges:** 1px `--ink-4` pencil lines. A mutual connection that gives a warm path is drawn 1.5px `--ink-2`. A *referral* edge is `--ink-people`. No curves with gradients, and no glow.
- **People:** 8px circles with a `--ink-people` stroke. **Fill depth follows the stage ramp** (Identified is hollow, Chatted is solid), the same encoding as the chips, so the graph legend teaches nothing new.
- **Companies:** 20px logo stamps in their brand colours, the only saturated objects on the canvas, which is right because companies are the landmarks.
- **You:** a 12px `--ink` dot with a 2px `--hl` ring, like the "you are here" mark on a topo.
- **Labels:** `data` mono 11px, `--ink-3`, shown on hover or when zoom is above 1.2. Never show all labels at once.
- **Stale:** a person past their follow-up window gets a dashed stroke, using the same dashed = unfinished grammar.
- **Motion:** the simulation settles in under 600ms, then **freezes**. No idle drift. A notebook drawing doesn't move.

---

## 6. Logo

### Concept: the figure-eight follow-through
The figure-eight follow-through is the knot a climber ties into the rope with. It is the first thing a partner checks before anyone leaves the ground, and that check is literally the belay. Drawn as a single monoline, the knot is **two stacked loops, which is also a B**. The mark is the name, the tagline and the initial in one stroke.

### Construction
- **A single continuous monoline**, stroke weight = 1/9 of mark height, round caps and joins.
- **Two loops stacked vertically**, with the upper loop about 0.85× the size of the lower (a B's proportions, and how a dressed eight actually sits).
- The line crosses itself **once, at the waist**, with a 1-stroke gap at the under-crossing so it reads as rope passing over rope.
- **The tail** leaves the lower right at 30° below horizontal and runs out about 0.4× mark height. That is the rope going up to the climber, and it keeps the mark from closing into a static "8".
- **It must hold at 16px.** At favicon size the gap at the crossing can close up, and the mark still reads as a B or 8.
- **Colour:** `--ink` (`#EEE7DA`) on `--ground` (`#13110E`). One single-colour version, with no two-tone rope. The highlighter may appear as a small dot at the tail end in the app icon only.
- **Wordmark:** "Belay" in Newsreader `opsz 72`, weight 500, sentence case, tracking −0.01em. This replaces the current tracked-out uppercase sans, which reads as a placeholder.

### It must avoid
Carabiners (every climbing app), mountains and peaks (every productivity app), climber silhouettes, rope texture or twist striping, gradients, 3D, a circle badge container, and any resemblance to the infinity sign. The waist crossing and the asymmetric loops are what prevent that last one.

### Gemini image prompts

**1. Primary mark**
```
A minimalist logo mark: a figure-eight climbing knot drawn as a single continuous monoline stroke, forming two stacked loops that also read as a capital letter B. The upper loop is slightly smaller than the lower loop. The line crosses itself once at the waist with a small gap where one strand passes under the other. A short straight tail exits the lower right at a 30-degree downward angle. Uniform stroke weight, round line caps, geometric and precise, generous negative space. Warm off-white line (#EEE7DA) on a flat warm near-black background (#13110E). Flat vector, centered, no text, no gradients, no shading, no texture, no 3D, no carabiner, no mountains.
```

**2. App icon / favicon variant**
```
A square app icon with slightly rounded corners, flat warm near-black background (#13110E). Centered inside it, a bold simplified figure-eight knot shaped like a capital letter B, drawn as one thick continuous monoline with round caps, a single over-under crossing at the middle, and a short tail exiting bottom right. Line colour warm paper white (#EEE7DA). One small solid pale yellow dot (#F2D46B) at the very end of the tail. Must remain legible at 16 pixels: thick strokes, simple geometry, large counters. Flat vector, no text, no gradients, no shadow, no texture, no border.
```

**3. Logbook stamp variant (for README header and portfolio)**
```
A minimalist rubber-stamp style emblem: a thin rectangular frame with square corners, inside it a monoline figure-eight climbing knot that reads as a capital letter B, the knot's tail running out of the frame through a small gap in its right edge. Fine even line weight, technical drawing precision, like a mark printed in a field notebook. Warm paper white lines (#EEE7DA) on a flat warm black background (#13110E). Flat vector, no text, no letters other than the knot shape itself, no ink bleed, no grunge, no distressing, no gradients, no 3D.
```

---

## 7. Voice and microcopy

**Principles**
1. **Write entries, not announcements.** State what happened or what is true, with a date. "Queue clear" beats "All caught up!"
2. **Absolute dates first, relative second.** `06 OCT · 2d ago`. A logbook never says only "recently".
3. **Numerals, not words.** `12 roles`, `3 due`, `14d`.
4. **Verbs on buttons are the action in the owner's words**, not the system's. "Scan" not "Ingest", "Log a call" not "Add event".
5. **No exclamation marks, no "Oops", no AI theatre.** Claude drafts, it doesn't "think". It is a tool in the book, not a character in it.
6. **Keep the owner's dry, reasoned tone.** The code comments are the brand voice. Ship that tone to the surface, in shorter form.

**Before and after**, from Belay's real copy:

| Where | Before | After | Why |
|---|---|---|---|
| Applications header button and its loading state (`app/applications/page.tsx`) | **Run ingest** → *Scouring…* | **Scan now** → *Scanning 38 career pages…* (count illustrative) | "Ingest" is pipeline jargon and "Scouring" is cute. A logbook names the action and counts the work. |
| Empty queue (`app/applications/page.tsx`) | *All caught up. Nothing is waiting for a verdict.* | `06 OCT 14:20` *Queue clear. Next scan at noon tomorrow.* | It becomes a dated entry. It also answers the only useful follow-up question, which is when more will arrive. |
| Follow-up counter tooltip (`app/networking/page.tsx`) | *Time to reach out again* / *Days since your last touch* | `14d` *since last touch: follow up* / `6d` *since last touch* | The number leads, in mono, and the same sentence covers both states. The overdue case only adds the instruction. |

Two smaller ones, for the same reason: the Home `h1` "Dashboard" (when the nav calls it "Home") becomes the date itself, *Tuesday 6 October*, because a logbook page is titled by its day. *Claude is thinking…* becomes *Drafting…*

---

## 8. Weaknesses, honestly

**Legibility risks**
- **Warm off-black costs contrast.** `#13110E` is lighter and warmer than today's `#09090b`. Every grey loses a little. `--ink-3` is 5.6 : 1 on ground but 4.77 : 1 on raised panels, which is the AA floor. `--ink-4` (3.2 : 1) is decorative and will be misused for real information sooner or later. This palette needs lint discipline that a cooler, higher-contrast palette doesn't.
- **Serifs on dark backgrounds bloom.** Light-on-dark text suffers from halation, and serif hairlines suffer most. Newsreader's optical sizing reduces this, but the rule "no serif under 18px except in panel headers" must be enforced. One serif list row will look precious *and* blurry.
- **Pale yellow on warm black is close to warn ochre.** The ~30° hue gap holds for text and focus rings. For colour-deficient viewers (deuteranopia especially), highlighter, warn and the moss success all fall along the yellow axis. That is why warn needs a glyph, and success should too.
- **Warmed pink and blue lose some punch.** At 12px heatmap cells, `--ink-apps` and `--ink-both` are less distinct than before. Check the heatmap specifically.

**Density risks**
- **Mono is wide.** IBM Plex Mono is about 0.6em per character against roughly 0.5em for Instrument Sans. Moving the queue card meta line ("2d old · San Francisco, CA · 4+ yrs · $170k–$230k") fully into mono makes it about 20% wider and it will truncate in the two-column queue at 1280px. Mitigation: only numbers and dates go in mono, place names stay in sans. But that mixed line is fussier.
- **The 72px date margin uses width** the two-column queue needs. That is why the queue is exempt, and that exemption is a crack in the system.
- **Three families** means three font loads (about 180KB woff2 subset in total) and three decisions per string. A single-family direction is simpler to maintain and faster to build.
- **Rules add ink.** Dashed and double rules are information, but on a 40-row network list they can turn into visual noise. Use them only for the states named above.

**Brand risks**
- **It can tip into "aesthetic Notion template".** Warm black, a serif and a mono is a recognisable 2024–26 indie look. What keeps it from being generic is the ledger grammar (margin, dashed = tentative, double rule = closed, topo graph). Ship the colours and fonts without the grammar and it is a mood board.
- **It reads as personal, not product.** That is the point for daily use, but a Google reviewer looking for "can she design a system at scale" may read warmth as taste and miss the rigour unless the portfolio write-up shows the token and rule system.
- **It looks backward** in a product that is substantially AI-driven (scoring, drafting, research). The notebook metaphor has nowhere natural to put the chat. It ends up treated as "a note Claude wrote in the margin", which is fine but understated.

**What the other directions might do better**
- **A precise, instrument-panel direction** (cool neutrals, one typeface, hard grid, Linear or Raycast lineage) will win on density, contrast and speed of implementation. It is also the safer portfolio piece for a systems-heavy role. Its weakness is that it could be anybody's tool.
- **An expressive, climbing-brand direction** (a bold rope colour, big display type, strong illustration) will win on memorability, the GitHub README and the portfolio hero shot. Its weakness is that daily triage pays for the brand every morning.
- **Field notebook's position is between them.** It is less dense than the instrument panel and less loud than the climbing brand, but it is the only one of the three whose structure comes *from the product's own data model* (dated entries, stages as line styles, a graph as a topo) rather than from a style. If the debate comes down to which direction would still feel right after a year of daily use, this proposal should win.
