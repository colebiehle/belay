# Chalk & rope

*A design language proposal for Belay. One of three rival directions.*

The short version: Belay should look like the gear on a crag. Granite greys, chalk-white
type, one rope-orange accent, and hardware that is engineered, labelled and checked. The
climbing shows up in the **materials and the rules**, never in pictures of climbing.

---

## 1. The vibe

**One sentence:** a well-used gear rack: stone-grey, chalk-dusted, every piece labelled,
and one bright rope you can find without looking.

**Five adjectives:** grounded, load-bearing, legible, checked, warm.

**It must never be:** outdoorsy (no mountains, pine trees, sunsets or Patagonia-catalogue
styling), playful (no "Crush it! 🧗", no gamified summits), or rugged-textured (no rock
photos, grunge, rope-braid patterns or topo-line wallpaper).

The test for every decision: *would this look right stamped on a carabiner spine or
printed in a guidebook topo?* Carabiners carry tiny condensed figures (`kN 24 ⇕ 8 ⇔ 7`),
guidebooks are dense tables of grades and dates, and rope is the one coloured thing on
grey rock so you can always see it. All three are information design already.

---

## 2. Why it fits Belay specifically

**The name already does the work.** A belay is not the climb. It is the system that
catches you: an anchor, a rope, a partner paying attention. That is exactly what Belay
is to a job search. It doesn't apply for you; it holds the line, remembers where you are,
and takes in slack when things go quiet. A direction built from that system (anchor,
rope, check) carries the metaphor without having to explain it. The rival directions
would need the README tagline to justify the name. This one is the tagline.

**The owner.** A product designer joining Google needs a portfolio piece that shows
judgement, not decoration. "I took the name seriously and derived a system from the
material culture behind it, then refused every cliché" is a stronger story than "I made
a nice dark dashboard." It is also clearly a *personal* tool: it has a point of view
that a Material or Linear-clone theme never would.

**Daily use.** Climbing gear is the original dense, practical, high-stakes UI. A
carabiner gets 6 numbers and 3 symbols on a 4 mm spine. A guidebook topo puts 40 routes,
grades and first-ascent dates on one page. This direction asks for *more* information
density, not less, so it doesn't fight the queue, the pipeline or the people list. What
it changes is temperature: today's zinc is cold and generic; granite is the same job
with a few degrees of warmth, which matters for a tool you open every morning during a
stressful search.

**Company colours.** Belay already pulls brand colours into panel headers, logos and
graph nodes, and the owner likes it. Those colours are the loudest thing on screen and
they're never ours. Rock is the ideal ground for other people's colours: neutral, a
little warm, low chroma, so Figma's purple and Stripe's blurple both sit on it without
fighting. On a crag the only saturated things are the ropes and the gear. Here, the
only saturated things are our rope and *their* brands. That's a rule, not a coincidence:
our palette stays below chroma 0.02 everywhere except the accent.

---

## 3. Colour

### Dark theme (primary)

Granite, not zinc. Every neutral sits at OKLCH hue ~80 with chroma 0.003–0.016: warm
enough to read as stone next to zinc, not warm enough to read as beige.

Contrast ratios are WCAG 2.x against **Granite 0** (`#131211`), the page background.

| Token | Role | Hex | OKLCH | vs bg |
|---|---|---|---|---|
| `granite-0` | Page background | `#131211` | `oklch(18.3% 0.003 68)` | — |
| `granite-1` | Cards, rows, queue cards | `#1a1917` | `oklch(21.4% 0.004 85)` | 1.07 |
| `granite-2` | Panels, inputs, popovers | `#22211e` | `oklch(24.8% 0.006 92)` | 1.16 |
| `granite-3` | Hover, pressed, selected row | `#2c2a27` | `oklch(28.6% 0.006 78)` | 1.31 |
| `seam-subtle` | Dividers inside a card | `#2a2825` | `oklch(27.8% 0.006 78)` | 1.27 |
| `seam` | Card and input borders | `#3a3733` | `oklch(33.8% 0.008 75)` | 1.58 |
| `seam-strong` | Focused input, drag target | `#57534c` | `oklch(44.4% 0.012 82)` | 2.45 |
| `chalk` | Primary text, names, titles | `#efebe4` | `oklch(94.1% 0.010 82)` | **15.75** (AAA) |
| `chalk-2` | Secondary text, metadata | `#bdb7ad` | `oklch(78.2% 0.016 81)` | **9.39** (AAA) |
| `chalk-3` | Tertiary: timestamps, counts, placeholders | `#8f897f` | `oklch(63.2% 0.016 81)` | **5.39** (AA) |
| `chalk-4` | Disabled only; never information | `#625d56` | `oklch(48.1% 0.013 77)` | 2.87 (exempt) |

Note: today's `text-zinc-600` is used for real information ("No summary yet…", counts).
Under this system that text moves up to `chalk-3`. Nothing the owner needs to read sits
below 4.5:1.

`seam-strong` is 2.45:1. Non-text UI needs 3:1 where the border is the *only* cue, so
focus states use the accent ring (below), not `seam-strong` alone.

### The accent: Rope

One warm accent, taken from the most common dynamic-rope colour. It is the thing your
eye finds first, and it means one thing: **your next action / where you are.**

| Token | Use | Hex | OKLCH | vs bg |
|---|---|---|---|---|
| `rope` | Primary button, active tab, focus ring, current stage | `#f0803c` | `oklch(71.4% 0.159 49)` | **7.00** |
| `rope-hover` | Hover | `#f59a5e` | `oklch(76.7% 0.133 53)` | 8.61 |
| `rope-pressed` | Active/pressed | `#d96c2b` | `oklch(65.0% 0.156 48)` | 5.46 |
| `rope-ink` | Text on a rope fill | `#1a0f08` | `oklch(18.1% 0.023 54)` | 7.04 on `rope` |
| `rope-wash` | Selected row / chip background (rope at ~14% on granite) | `#362119` | `oklch(27.2% 0.036 42)` | `rope-hover` text on it: 6.96 |

Focus ring: 2px `rope` with a 2px `granite-0` offset. 7:1 against the page, so it
passes the 3:1 non-text rule everywhere.

### Semantic

| Token | Meaning | Hex | OKLCH | vs bg |
|---|---|---|---|---|
| `lichen` | Success: accepted, offer, chatted | `#93c47d` | `oklch(76.8% 0.110 136)` | 9.30 |
| `sandstone` | Warn: going stale, due soon | `#e2c164` | `oklch(82.1% 0.119 90)` | 10.73 |
| `flag` | Alarm: overdue, failed, destructive | `#ef5a6f` | `oklch(66.8% 0.183 15)` | 5.67 |
| `flag-text` | Alarm text at small sizes | `#f07a8a` | `oklch(71.8% 0.145 13)` | 7.00 |

The honest problem with a warm accent is that orange sits between red (alarm) and
yellow (warn). The palette spaces them deliberately: flag at hue 15, rope at 49,
sandstone at 90, a 34° and 41° gap, with sandstone also 11 points lighter. That's
enough on a swatch and not quite enough on a 6px dot, so there's a hard rule: **alarm
and warn are never colour alone.** They always carry a glyph (`!` triangle, clock) or a
word ("12d"). The current code's insight, one alarm hue declared once, is kept exactly.

### Do pink and blue survive?

**Pink dies. Blue survives, demoted, as the second strand.**

The argument comes from the sport, not the moodboard. Trad and alpine climbers use
*half ropes*: two ropes clipped alternately, always in two contrasting colours, so the
belayer can call "slack on orange, take on blue" and never confuse them. That is exactly
Belay's structure: two lines being worked at once (applications and people) by one
person who must never mix them up. So the split is earned.

- **Applications = Rope orange** `#f0803c`. It's the daily surface (the nav comment says
  so); it gets the brand colour.
- **Network = Strand blue** `#86b6d8` / `oklch(75.4% 0.071 240)`, 8.64:1. Same job as
  today's `#8fcdfd`, but with chroma pulled down from ~0.10 to 0.07 so it reads as a
  dyed cord, not a UI link. It only appears inside the network side: tab, stage ramp,
  graph highlights. It never appears in the logo or brand surfaces.
- **Both** (the activity grid's purple `#c6a4f3`) goes away. A day where both happened
  is drawn as a cell split diagonally, orange and blue. A mix colour asks you to decode
  a third hue; two strands in one cell is literally what happened.

Why pink must go: `#ff8de3` is the single least "Belay" thing in the current UI. It
says *generic dark-mode app with a personality accent*. It has no reason to exist except
that it was picked first. Pink also sits 20° from `flag`; orange-and-blue are near
complements, the strongest possible pair for "these are two different things."

The stage ramps keep their logic (opacity steps of one hue, darkest = furthest along),
re-based on rope and strand.

### Light theme note

Optional, but the palette inverts cleanly to *chalk bag* rather than paper: background
`#f6f3ee`, cards `#ffffff`, seams `#d0cbc2`, text `#1c1b19` (15.55:1), secondary
`#55514a` (7.13:1), tertiary `#6b665e` (5.15:1). Rope darkens to `#a8471a` (5.30:1) for
text and links; filled buttons can keep `#f0803c` with `rope-ink` on top. Semantics
darken: lichen `#2f7a3a` (4.78), flag `#c23b2f` (4.79). Ship dark first; this is the
portfolio screenshot's alternate, not a v1 requirement.

---

## 4. Typography

Two families, both free on Google Fonts, both chosen because they look *engineered*,
like something stamped or printed for a job rather than drawn for a brand.

### Archivo (UI, headings, display)

Omnibus-Type's grotesque, variable on weight (100–900) **and width (62–125)**. Why it
wins:

- It was designed for both print and dense screen use; it's sturdy at 12px, with open
  apertures and a tall-ish x-height, which the queue and people rows need.
- The **width axis** is the brand move. Body runs at width 100. Section labels and the
  wordmark run at **width 75–87, semi-bold, tracked**, which is exactly the condensed
  stamped type on a carabiner spine or a rope label. One family, so it never looks like a
  font pairing exercise.
- It's warmer and plainer than Space Grotesk (overused, quirky), and less corporate than
  IBM Plex Sans. It doesn't announce itself, which is right for a daily tool.
- Tabular figures (`font-feature-settings: "tnum"`) for counts in tables.

### IBM Plex Mono (stamped data)

For the numbers that are *readings*: day counts, scores, dates, comp figures, the
"12d since last touch" badges. Why Plex Mono:

- IBM designed Plex to express "the relationship between man and machine"; it has
  engineering heritage without the developer-tool cliché of JetBrains Mono or Fira Code.
- Its slab-ish terminals look stamped, which suits the carabiner-rating idea.
- At 11–12px it holds up next to Archivo without looking like a different product.

Mono is scoped tightly: figures and short codes only, never sentences, never buttons.

### Type scale

Base 14px (the app already lives at `text-sm`; don't fight it). Sizes in px.

| Style | Font | Size / line | Weight | Width | Tracking | Use |
|---|---|---|---|---|---|---|
| Display | Archivo | 32 / 36 | 650 | 100 | −0.02em | Home greeting, empty-state headline, portfolio |
| H1 | Archivo | 24 / 30 | 600 | 100 | −0.015em | Page titles |
| H2 | Archivo | 18 / 24 | 600 | 100 | −0.01em | Panel titles, person name in panel |
| H3 | Archivo | 15 / 20 | 600 | 100 | 0 | Card titles (role, person) |
| Body | Archivo | 14 / 20 | 400 | 100 | 0 | Default everything |
| Body small | Archivo | 13 / 18 | 400 | 100 | 0 | Metadata lines, notes |
| Small | Archivo | 12 / 16 | 450 | 100 | +0.005em | Helper text, chips |
| Label | Archivo | 11 / 14 | 600 | **80** | +0.08em, uppercase | Section heads ("TO REACH OUT"), table headers |
| Data | Plex Mono | 12 / 16 | 500 | — | 0, `tnum` | Day counts, dates, scores |
| Data large | Archivo | 28 / 32 | 600 | 87 | −0.01em, `tnum` | Home funnel and Insights numbers |
| Wordmark | Archivo | 13 / 1 | 700 | **75** | +0.14em, uppercase | `BELAY` in the nav |

Rules: sentence case everywhere except Label and Wordmark. No italics in UI. Weight
does the hierarchy; size steps are small because density matters.

---

## 5. Shape, space, density, borders, elevation, icons, motion

### Shape: rock and rope

Two kinds of object, two kinds of corner.

- **Rock (containers)**: cards, panels, inputs, modals. Small, firm radii: **4px** on
  inputs and buttons, **6px** on cards and rows, **10px** on panels and modals. Today's
  mix of `rounded`, `rounded-md` and `rounded-lg` collapses to these three.
- **Rope (things that move along a track)**: stage chips, the status pill, progress,
  the filter chips. **Fully round.** If it can advance a stage, it's a pill. If it
  holds things, it's a rectangle. This gives the existing "move the chip to move the
  role" interaction a shape-level meaning.

### Spacing and density

4px base grid. Row padding 12/14px (the current `px-3.5 py-3` is right). Gutters 16px
mobile, 24px desktop. Compact is the default; there is no "comfortable" mode. A queue
card should show a role's headline, five tags, score and company without scrolling at
1280×800, and people rows stay at 56px tall.

### Borders and elevation

Granite is layered by **lightness plus a 1px seam**, never by shadow. Each step up
(`granite-0 → 1 → 2`) is one surface. Shadows exist only for things that float above
the page (modals, popovers, the chat drawer): `0 12px 40px rgb(0 0 0 / 0.55)`, plus a
1px `seam` border so the edge is still drawn.

Company brand colour gets one slot: a **4px top edge** on the role/person panel and
the logo. Not a full header fill. On granite, a strip of their colour reads like a
coloured sling clipped to grey rock: present and identifying, but it's not our room.
(This is a reduction from the current filled header; argued in section 8.)

Kill the dot-grid page background. It is the one texture in the app and it's
graph-paper, which is the wrong material. Flat `granite-0`.

### Iconography

Keep **Lucide** (already in use): 16px, 1.5px stroke, round caps, `chalk-2` by default,
`rope` only when active. No custom climbing icons in the UI, ever. A carabiner icon
for "connect" is precisely where this direction turns into a theme park. The brand's
climbing lives in the logo and the system's rules; the icons stay generic and legible.

### Motion: the soft catch

A good belayer gives a *soft catch*: the climber decelerates smoothly and doesn't
bounce. That is the motion principle. **Decelerate, never overshoot. No springs.**

| Token | Duration | Easing | Use |
|---|---|---|---|
| `snap` | 100ms | `cubic-bezier(0.2, 0, 0, 1)` | Hover, press, chip colour |
| `settle` | 180ms | `cubic-bezier(0.2, 0, 0, 1)` | Queue card accept/pass, row reorder, panel content swap |
| `pay-out` | 240ms | `cubic-bezier(0.2, 0, 0, 1)` | Panel/drawer enter |
| `take-in` | 160ms | `cubic-bezier(0.4, 0, 1, 1)` | Panel/drawer exit (exits are faster than entrances) |

Accept/pass: the card slides 24px toward its destination and fades; the next card
rises 8px into place. Stage changes animate the chip's colour only, not its position.
`prefers-reduced-motion`: everything becomes an 80ms opacity crossfade.

### The network graph

The graph is where the metaphor is most tempting and most dangerous. The rule: draw a
**belay system diagram**, the kind in a rigging manual, not a rope illustration.

- **You** are the anchor: a small filled `chalk` square (an anchor bolt), pinned at the
  centre. Everyone else is a circle. Squares vs circles distinguishes "fixed" from
  "people" without a legend.
- **People** are 6–10px circles in their company colour mixed 40% toward `chalk-3`
  (today's code already does this toward zinc; just re-base it on granite).
- **Edges are strands, and their weight is the relationship's stage**: identified =
  1px dashed `seam-strong` (not yet tied in); sent/connected = 1px solid `chalk-4`;
  replied/scheduled = 1.25px `chalk-3`; chatted = 1.5px `strand` blue. Load-bearing
  relationships are literally thicker.
- **Introducers** (mutuals) are drawn as the intermediate node on a two-segment strand,
  like a quickdraw between anchor and climber.
- **Hover** traces the path from you to that person in `rope` orange and dims everything
  else to 25%. That is the one moment the brand colour enters the graph: "here's your
  line to them."
- Never: rope-textured edges, curved "hanging rope" edges, a cliff background.

---

## 6. Logo direction

### Concept: the figure-eight follow-through

The figure-eight follow-through is the knot every climber ties into their harness, and
the knot their partner checks before they leave the ground ("partner check": knot,
harness, belay device). It is the most trusted object in climbing, and it is checked by
someone else. That's Belay in one shape: a structure you can trust *because* it's been
checked.

**Construction:**

- A single continuous monoline path describing a simplified figure-eight: two stacked
  loops, the lower one ~10% larger, built on a 24×24 grid so it renders crisply at 16px
  (favicon) and scales to an app icon.
- Stroke weight = 1/8 of mark height (3px at 24). Round caps, round joins.
- **One visible crossing break**: at the waist, one strand passes *under* the other,
  shown by a gap of exactly one stroke width. This is what makes it a knot rather than an
  8 or an ∞ sign, and the gap is the honest, engineered detail.
- Optional doubled strand (the "follow-through"): a second parallel line offset by one
  stroke width on the lower loop only. Use on the app icon and portfolio; drop it below
  32px.
- Colour: `rope` on `granite-0`, or `chalk` on `granite-0`. Monochrome must work first.
- Wordmark: `BELAY` in Archivo 700, width 75, tracked +0.14em. The mark sits to the
  left at cap-height ×1.4.

**Fallback concept** (if the knot reads too much like ∞ in testing): *the anchor*.
Two short bolt marks at the top converging in a V to a single ring at the bottom, the
master point of an anchor. Simpler, more geometric, slightly less warm.

**It must avoid:** mountains or peaks of any kind; a climber silhouette; a literal
carabiner (it's the stock-icon cliché, and it's every outdoor-retail logo); braided or
twisted rope texture; gradients; the letter B shaped from rope; anything that looks
like the infinity sign or a pretzel; a shield or badge container.

### Gemini image prompts

**Prompt 1: monoline knot, primary**

> A minimalist logo mark of a simplified figure-eight climbing knot, drawn as a single
> continuous monoline stroke of uniform thickness with round caps. Two stacked loops,
> the bottom loop slightly larger than the top. At the waist where the strands cross,
> one strand passes under the other, shown by a clean gap in the line. Stroke colour
> warm rope orange #F0803C on a flat solid warm charcoal background #131211. Geometric,
> precise, built on a grid, Swiss modernist, like a technical icon. Flat vector, no
> text, no gradients, no shadows, no texture, no rope braid detail, no 3D, centered,
> generous padding, square format.

**Prompt 2: doubled strand app icon**

> App icon: a rounded-square tile in flat warm granite grey #1A1917. Centered on it, a
> geometric figure-eight follow-through knot rendered as two parallel monoline strands
> of equal weight in off-white chalk colour #EFEBE4, with exactly one over-under
> crossing gap at the middle. Clean engineered geometry, consistent stroke width, round
> line caps, reads clearly at small sizes. Flat vector illustration, no text, no
> letters, no mountains, no carabiner, no gradient, no shadow, no texture, no 3D.

**Prompt 3: anchor fallback**

> A minimalist geometric logo mark representing a climbing anchor: two short vertical
> bolt marks at the top, two straight lines converging downward in a V shape to a
> single small circle ring at the bottom point. Uniform monoline stroke, round caps,
> perfectly symmetrical, strong and simple. Rope orange #F0803C lines on a flat dark
> warm charcoal background #131211. Flat vector, no text, no gradients, no shading, no
> mountains, no climber figure, no rope texture, square composition with generous
> margin.

---

## 7. Voice and microcopy

Climbing has a superb model for interface language: **belay calls**. "On belay?"
"Belay on." "Climbing." "Climb on." "Take." Short, unambiguous, confirming state, said
the same way every time because someone's safety depends on it being understood the
first time. We borrow the *properties* of belay calls, never the words.

**Principles:**

1. **Confirm the state, then the next move.** Say what just happened and what happens
   next, in that order.
2. **Numbers over adjectives.** "14 new roles" beats "Ingest complete."
3. **Same call, same words.** A thing has one name everywhere ("pass", not
   pass/reject/skip/dismiss).
4. **Sentence case, plain verbs, no exclamation marks.** Calm is the point; the search
   is stressful enough.
5. **No climbing jargon in the UI.** Not "Belay on!", not "Send it", not "Crux".
   The metaphor belongs to the name and the logo. Once it leaks into a button it's
   kitsch.
6. **When something fails, say where to look.** It's a local tool; the fix is usually
   on this machine.

**Before / after (from Belay's current copy):**

| Before | After | Why |
|---|---|---|
| `Ingest complete.` | `Scan done: 14 new roles, 3 from LinkedIn. Next scan at noon.` | Confirms state with a number, then the next move. "Ingest" is a developer word. |
| `Could not reach the server. Try again.` | `Can't reach Belay on this machine. Is npm run dev running?` | A retry button won't fix a stopped dev server; tell the owner where to look. |
| `Review Matches` / `Chat with Claude` (Title Case, next to sentence-case copy) | `Review 33 roles` / `Ask Claude` | One case rule. And the count is the reason to click. |

**And the anti-example this direction must never ship**, so the debate has a line to
point at:

> ~~Belay on! You've sent it — the queue is clear. 🧗~~
>
> `Queue clear. Nothing waiting for a verdict.`

The current copy is already mostly in this voice ("Pass. They will not be offered
again", "You already know someone here. Ask before applying cold."). This direction
doesn't rewrite the voice; it names it and protects it.

---

## 8. Weaknesses, honestly

**Kitsch is one bad decision away.** This is the real risk and it's not hypothetical.
The palette is safe; the danger is accretion. Someone adds a carabiner icon to the
"connect" button, then "Send it!" on the apply button, then a topo-line hero, and within
a month it's a climbing-gym website. The defence is the rules in sections 5 and 7
(climbing in the logo and the system, *never* in icons, copy or imagery), and those
rules depend on discipline. The rival directions are more self-policing: a neutral
system can't go theme-park because it has no theme.

**It means something only to climbers.** Non-climbers (most recruiters, most hiring
managers looking at a portfolio) see "warm grey with an orange accent" and miss the
half-rope logic, the soft catch and the knot. The design has to work without the story,
and it does, but the story is half of its portfolio value and it requires a caption.

**Orange is crowded.** Warm accents compete with semantic warn and alarm, and with
company brands that are themselves orange or red (Figma's orange, Airbnb, Duolingo
adjacent hues, Anthropic's own clay). A rope-orange button beside an orange brand strip
is a genuine collision. Mitigation: brand colours are confined to the 4px strip and
graph nodes; rope never touches them. A cool-accent direction avoids this entirely.

**It reduces the company colours.** I'm proposing the panel header goes from a filled
brand header to a 4px strip. The owner *likes* the filled header. I think the strip is
right (the panel is about your relationship with the company, not the company's
marketing), but a direction that leans into company colour as the main expressive
element would make the owner happier on day one.

**Warm greys can look muddy.** On a cheap or warm-shifted display, granite at chroma
0.006 can drift towards brown. It needs testing on the actual monitors used and a
fallback of dropping chroma to 0.003.

**It's less "Google-ready" in the obvious sense.** A Material-adjacent or crisp
editorial direction would sit more naturally in a Google portfolio review. This
direction bets that a distinct, well-argued point of view beats familiarity. That's a
bet, not a certainty.

**What the other directions might do better:** a *neutral/editorial* direction would
be more timeless and lower risk, and lets company colours carry all the expression. A
*bolder/expressive* direction would be more memorable in a portfolio thumbnail and more
fun to use. Chalk & rope sits between them: more character than neutral, more
restraint than expressive, and the only one where the name, the palette, the motion and
the logo all come from the same source.
