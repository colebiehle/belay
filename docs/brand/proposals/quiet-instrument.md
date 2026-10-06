# Proposal: Quiet instrument

*A design language for Belay. One of three competing directions.*

---

## 1. The vibe

**Belay should feel like a well-made field instrument: graphite and chalk, with a single orange needle that only moves when something needs you.**

**Is:** calm · exact · dense · honest · durable

**Must never be:** cute · motivational · decorative

"Motivational" is the important one. A job search already produces enough feeling on its own. The tool doesn't need to add any. It should never cheer, never use confetti for an accepted role, and never tell you that you've got this. Its job is to show you where you are and what to do next, every day, for months.

---

## 2. Why it fits Belay specifically

**The owner is the only user, and they use it every day.** Belay is not marketing to anyone. A daily-use utility gets judged on its four-hundredth session, not its first. Expressive surfaces wear out quickly. Neutral ones don't. Linear, Things and a Leica rangefinder all stay pleasant to use years in because they never ask for attention they haven't earned.

**The content already has colour, and it's the right colour.** Company brand colours already show up in panel headers, logo tiles and the graph, and the owner likes them. That only works if the chrome is quiet. Today the Figma logo tile sits next to a pink Accept button and a pink score. The Stripe tile sits next to a blue stage chip. Brand colour, section colour and state colour all compete in the same 40px row. If the surfaces are monochrome, a company's colour becomes the most saturated thing on the screen, and it means *this company*. That makes the app's real subject, the companies and the people at them, the visual subject too.

**The name is about equipment, and the equipment is quiet.** A belay device is a lump of anodised aluminium. A rope is one hi-vis colour so you can see it against rock. Nobody decorates a belay. You trust it because it's plain, it's made well, and it does one thing without fuss. "The rope that holds you while you climb" is a promise of reliability, not excitement. Most of this direction comes straight from that: grey hardware, one high-visibility signal colour (the rope), and the rope shown only where it's actually holding something.

**The owner is a product designer about to join Google.** For a portfolio, restraint is the harder skill to show and the one that's easier to defend in a crit. Anyone can make a dark app colourful. Making a dense, data-heavy tool where every colour has exactly one job, and being able to say what that job is, is a real design argument. The codebase already argues this way: `globals.css` has a comment explaining why there is exactly one alarm hue. This direction finishes that thought.

**The data is dense, and density needs calm.** The queue packs company, role, age, location, years of experience, salary range, a headline, five tags and a score into each card. The pipeline holds history with day gaps. The network holds stages, mutuals and tags. You can only read that much information on a quiet background. Hierarchy has to come from weight, size and lightness, because hue is already taken by the brands.

---

## 3. Colour

### Principles

1. **Lightness does the hierarchy.** Surfaces get lighter as they come closer. Text gets dimmer as it gets less important.
2. **Exactly one signal hue: Rope orange.** It means "this is the thing to act on." That covers the primary action, the focused item, the path through your network, and the one count on a page that needs you. If more than about 3% of the pixels on a screen are orange, something is wrong.
3. **Brand colour is content, not chrome.** It only appears where it represents a company: the logo tile, the panel header band, and graph nodes. Never on buttons, borders or text.
4. **Semantic colours are dots, not fills.** Success, warn and alarm show up as a 6px dot or a small glyph next to text. They never colour a whole row, chip or card.
5. **The neutrals carry a slight cool tint** (hue 265, chroma under 0.008). Pure zinc reads as cheap on most panels. A barely-blue graphite reads as anodised metal.

### Dark palette (the default)

All contrast ratios are WCAG 2.x, measured against **bg-0 `#0C0C0D`** unless noted otherwise.

| Token | OKLCH | Hex | Use | Contrast vs bg-0 |
|---|---|---|---|---|
| `bg-0` canvas | `oklch(0.155 0.003 265)` | `#0C0C0D` | Page background | — |
| `bg-1` surface | `oklch(0.190 0.003 265)` | `#131415` | Cards, rows, inputs | 1.06 |
| `bg-2` raised | `oklch(0.225 0.004 265)` | `#1B1C1E` | Side panels, popovers, modal | 1.15 |
| `bg-3` hover / selected | `oklch(0.262 0.005 265)` | `#232427` | Row hover, selected tab, pressed | 1.26 |
| `line-1` subtle | `oklch(0.262 0.005 265)` | `#232427` | Dividers inside a surface | 1.26 |
| `line-2` default | `oklch(0.310 0.006 265)` | `#2F3033` | Card and input borders | 1.48 |
| `line-3` strong | `oklch(0.390 0.007 265)` | `#434549` | Hover border, focus-adjacent, graph edges at rest | 2.04 |
| `text-1` primary | `oklch(0.950 0.003 265)` | `#EDEEF0` | Names, titles, values | **16.8** (AAA) |
| `text-2` secondary | `oklch(0.760 0.006 265)` | `#AFB1B5` | Role titles, body copy in panels | **9.1** (AAA) |
| `text-3` tertiary | `oklch(0.620 0.007 265)` | `#84868A` | Metadata: "2d old · San Francisco · 4+ yrs" | **5.4** (AA; 4.7 on bg-2) |
| `text-4` disabled | `oklch(0.470 0.007 265)` | `#595B5F` | Disabled controls, placeholder glyphs only | 2.9 (decorative only, never meaningful text) |

On `text-3`: the current app uses `zinc-500`/`zinc-600` for metadata, and `zinc-600` (`#52525b`) is about 2.6:1 on `#09090b`. "No summary yet", "How we met" and the empty states fail AA today. In this direction, the dimmest *readable* text is 5:1. Anything dimmer is decoration and doesn't carry meaning.

#### The signal: Rope orange

| Token | OKLCH | Hex | Use | Contrast vs bg-0 |
|---|---|---|---|---|
| `signal` | `oklch(0.72 0.165 48)` | `#F57F3A` | Primary button fill, focus ring, active nav underline, graph path, "needs you" count | **7.4** |
| `signal-hover` | `oklch(0.78 0.14 52)` | `#FD9C5D` | Hover on signal fills and links | 9.4 |
| `signal-press` | `oklch(0.66 0.16 45)` | `#DF6C32` | Pressed state | 5.9 |
| `signal-wash` | `oklch(0.30 0.06 48)` | `#462311` | Selected-row tint, keyboard-focused card background (behind `text-1`) | 1.4 |
| `on-signal` | — | `#0C0C0D` | Text on a signal fill | 7.4 on `signal` |

Text on orange is always bg-0, never white (white on `#F57F3A` is 2.6:1). The focus ring is `2px solid signal` with a 2px `bg-0` offset, so it reads clearly against brand-coloured logo tiles.

Why orange and not one of the existing accents: climbing ropes and field instruments both use high-visibility orange for the same reason. It's the colour you can find instantly against a neutral background. It also stays clear of most of the brand colours that fill Belay's screens. The target list is mostly blue, violet, black and white (Stripe, Meta, Microsoft, Notion, Apple, Anthropic, Perplexity, LinkedIn's own blue), and blue was the colour most likely to get lost among them. The collisions that remain (Figma, Airbnb, Anthropic's clay) are handled by rule 3: orange never touches an identity surface.

#### Semantics

| Token | OKLCH | Hex | Meaning | Contrast vs bg-0 |
|---|---|---|---|---|
| `ok` | `oklch(0.78 0.11 155)` | `#7BCC98` | Happened: offer, chatted, sent, scan succeeded | 10.2 |
| `warn` | `oklch(0.85 0.12 88)` | `#EEC96C` | Getting close: follow-up due within 2 days, source returned zero rows | 12.3 |
| `alarm` | `oklch(0.70 0.17 20)` | `#F66B71` | Gone stale or broken: overdue follow-up, failed ingest arm, deadline passed | 6.8 |

`alarm` replaces the current `#f6a6a0`. That colour is pale enough to look like a pastel accent, so it doesn't read as *wrong*. The new one sits about 28° of hue away from Rope orange and is noticeably darker. Even so, orange and red are neighbours, which is why semantics are always **dot plus words** ("● 9 days, overdue") and never a colour alone.

### Do pink and blue survive?

**No. Retire both as accents.** This is the hardest call in the proposal, so here is the full argument:

- **They answer a question nobody asks.** Section accents tell you which half of the app you're in. The nav underline, the page title and the content already say that. Nobody has opened `/networking` and wondered whether they were looking at job applications.
- **They use up the hue budget.** Once pink means "applications" and blue means "networking", neither can mean "act here". So the code had to invent a third accent (`accent-both`, a lavender) for days with both kinds of activity, and a separate alarm. That's four hues of chrome before a single company colour is drawn. The comment in `globals.css` already notices this: *"Pink and blue both already mean 'this side of the app', so neither can also mean 'this has gone stale'."*
- **Ramps of an accent are really ramps of lightness.** The contact-stage chips go `blue/15 → /30 → /45 → /65 → /85 → solid`. The information is in how full the chip is, not its hue. Make it a monochrome ramp (`bg-3` → `line-3` → `text-3` → `text-2` → `text-1` fill, with dark text from "Connected" onward) and the pipeline and network can share **one** `StageChip` component. "Chatted" and "Offer" become a full chalk-white fill, the brightest object in the row, without borrowing a colour.
- **The activity heatmap shows what replaces them.** Today a day is pink, blue, or lavender for both. In this direction it becomes two stacked rows of the same grey-to-chalk ramp, labelled "Applying" and "People". Position does the job hue was doing, and it's more readable at 12px than three pastels that are similar in lightness.

**What the owner loses**, said honestly: the peripheral-vision cue that you're on the pink side. If that turns out to matter in daily use, the fallback is a **2px section tick** next to the page title in pink or blue, and nothing else. That fallback should have to be argued for.

### Light theme (note, not a priority)

Belay is a dark-first tool. A light theme is worth having for daytime screen sharing in calls:

| Token | OKLCH | Hex | Contrast vs paper |
|---|---|---|---|
| `paper` | `oklch(0.985 0.002 90)` | `#FAFAF9` | — |
| `surface` | `oklch(1 0 0)` | `#FFFFFF` | — |
| `raised` | `oklch(0.965 0.003 90)` | `#F4F3F1` | — |
| `line-2` | `oklch(0.90 0.004 90)` | `#DFDEDB` | 1.3 |
| `text-1` | `oklch(0.22 0.004 265)` | `#1A1B1C` | 16.5 |
| `text-2` | `oklch(0.45 0.006 265)` | `#545559` | 7.1 |
| `text-3` | `oklch(0.54 0.006 265)` | `#6D6F72` | 4.8 |
| `signal` | `oklch(0.55 0.155 40)` | `#B9491C` | 5.0 (white text on it: 5.2) |
| `alarm` | `oklch(0.55 0.18 22)` | `#C5353E` | 5.1 |

Paper is very slightly warm (hue 90), so the light theme reads as a notebook rather than a hospital.

---

## 4. Typography

### Typefaces (all free on Google Fonts)

**IBM Plex Sans** for UI, body and headings. Weights 400, 500 and 600. No 700.
- It's an engineered grotesque, built for technical interfaces, and its forms look slightly machined: the flat-sided round letters and the angled terminals on `t` and `r`. It gives the app the feel of an instrument without leaning on monospace everywhere.
- It has true tabular figures (`font-feature-settings: "tnum"`), which a tool full of salary ranges, day counts and scores needs.
- Its x-height and spacing hold up at 11–12px on dark backgrounds, where Belay's metadata lives. A lot of fashionable grotesques fall apart at that size.
- It isn't Inter, and it isn't the system font. That matters for a portfolio piece, where the type is the first sign that someone made a decision.

**IBM Plex Mono** for numbers that get compared, keyboard hints, the wordmark and graph labels. Weights 400 and 500.
- It's from the same superfamily with matched metrics, so a mono value inline next to sans text sits on the same baseline and x-height. You get two voices from one family.
- Use it for scores (`9`), day gaps in role history (`+12d`), dates in logs (`Oct 06`), salary ranges in dense rows, and kbd hints (`A` `P` `U` `J` `K`).
- Never use it for running text.

**No display face.** The "display" style is Plex Sans 600, tracked tight. An instrument doesn't change typeface for its label plate. If the owner wants a portfolio hero moment, it should come from the graph, not from a headline font.

*Alternative if Plex reads too corporate:* **Geist + Geist Mono** (also on Google Fonts) keep the same structure and are a little softer. The scale below works unchanged.

### Scale

The UI base is 14px. Line heights sit on a 4px grid. Negative tracking only from 20px up.

| Style | Family / weight | Size / line | Tracking | Used for |
|---|---|---|---|---|
| `display` | Plex Sans 600 | 28 / 32 | −0.02em | One per page at most: the Home date line, the Insights headline number |
| `stat` | Plex Sans 500, `tnum` | 32 / 36 | −0.02em | The three signal numbers per side on Home |
| `h1` | Plex Sans 600 | 20 / 28 | −0.012em | Page titles ("Applications", "Network") |
| `h2` | Plex Sans 600 | 15 / 20 | −0.005em | Panel titles, person name in the contact panel |
| `label` | Plex Sans 500, uppercase | 11 / 16 | +0.06em | Section eyebrows ("COMING UP", "IDENTIFIED 1"), always `text-3` |
| `body` | Plex Sans 400 | 14 / 20 | 0 | Card headlines, notes, chat |
| `body-strong` | Plex Sans 500 | 14 / 20 | 0 | Company and person names in rows |
| `small` | Plex Sans 400 | 12 / 16 | +0.005em | Metadata lines, role titles in dense rows |
| `micro` | Plex Sans 500 | 11 / 14 | +0.01em | Chip text, tags |
| `num` | Plex Mono 400, `tnum` `zero` | 12 / 16 | 0 | Scores, day gaps, dates, salary ranges, counts in tabs |
| `kbd` | Plex Mono 500 | 10 / 14 | +0.02em | Key hints in a `line-2` bordered 16px box |
| `wordmark` | Plex Mono 500, uppercase | 12 / 16 | +0.18em | "BELAY" in the nav |

Rules:
- **Two weights do 95% of the work** (400 and 600, with 500 for names). Bold is not a way to add emphasis. Use `text-1` against `text-3`.
- **Uppercase is only for `label` and the wordmark.** Today's `tracking-widest` (0.1em) on 12px eyebrows is a little shouty. 0.06em at 11px is enough.
- **Every number gets `tnum`.** Columns of salary ranges and day counts should line up without a table.

---

## 5. Shape, space, density, elevation, icons, motion

### Shape
- **Radii: 4 / 6 / 10, and full for dots only.** 4px for buttons, inputs, chips and tags. 6px for cards and rows. 10px for side panels, modals and the chat sheet. `rounded-full` is only for status dots, graph nodes and avatars.
- **Kill the pills.** The company filter chips and the Queue/Pipeline count badges are pills today. Pills look friendly. Rectangles with a 4px radius look like keys on an instrument. Filter chips become 24px-high, 4px-radius toggles: `line-2` border at rest, `bg-3` fill with `text-1` when on.
- Logo tiles stay as they are (rounded-square, white or brand plate). They're content.

### Spacing and density
- **4px base.** Scale: 2, 4, 8, 12, 16, 24, 32, 48. Nothing in between.
- **Two densities, chosen per surface, never per user:**
  - *Comfortable* (the queue, Home): 16px card padding, 12px gutters. Triage is a decision and needs room around it.
  - *Compact* (pipeline rows, network list, history, Insights tables): 36px rows, 12px horizontal padding, 8px between rows. These are lists you scan, not read.
- The network list in the screenshot spends 110px per person (an eyebrow, then a card). In compact density, a person is one 44px row, and the stage eyebrow becomes a sticky group header. You see about 12 people above the fold instead of 5.
- Page gutter 24px. Max content width 1280px. The contact and role panels are fixed at 480px.

### Borders and elevation
- **Structure comes from 1px hairlines, not shadows.** Cards are `bg-1` with `line-2`. Hover moves the border to `line-3`. There's no lift and no glow.
- **Elevation is lightness:** canvas `bg-0` → card `bg-1` → panel `bg-2` → hover `bg-3`.
- **Shadows are only for things that float over other content:** popovers, menus, the command palette, the chat sheet. One shadow token: `0 12px 32px -8px rgb(0 0 0 / 0.6), 0 0 0 1px #2F3033`.
- **Drop the background dot grid from content pages.** It's on every page in the current screenshots and adds texture behind data, which is exactly where texture shouldn't be. It moves to the network graph canvas, where it actually means something: the field the graph is plotted on.
- Drop the nav's `backdrop-blur`. The nav becomes solid `bg-0` with a `line-1` bottom rule. A frosted glass effect is decoration.

### Iconography
- **Lucide**, which the app already uses (`Mail`, `Search`, `Plus`). 1.5px stroke, 16px in buttons and 14px in dense rows. Always `currentColor`.
- An icon only appears when it makes scanning faster: the mutuals glyph on a queue card, the external-link glyph, the search field. Header buttons can drop the icon once the label is clear ("Scan now" doesn't need an envelope).
- Status is a **6px filled dot**, the only filled icon in the system.
- No emoji in the UI, ever.

### Motion
- **Motion confirms. It doesn't perform.**
- Durations: **90ms** for hover and press, **140ms** for chips, toggles and tab changes, **200ms** for panels sliding in, **240ms** maximum for anything.
- Easing: `cubic-bezier(0.2, 0, 0, 1)` (fast out, long settle) for entering, `cubic-bezier(0.4, 0, 1, 1)` for exiting. Exits are about 30% shorter than entrances.
- No springs, no overshoot, no bounce. Instruments don't wobble.
- Accept and Pass in the queue: the card slides 8px and fades in 140ms, and the next pair is already there. Speed is the feature, because you triage 30 of these.
- `prefers-reduced-motion`: every duration drops to 0 except opacity fades, which go to 80ms.

### The network graph: the one expressive surface

All the restraint elsewhere is so the graph can carry the visual identity. It's the image that goes in the portfolio, the README hero, and the GitHub social card.

- **The field:** `bg-0` with a 24px dot grid in `line-1`, plus a soft radial lift to `bg-1` at the centre (already sketched in `NetworkGraph.tsx`). Think of a plotter or a radar scope.
- **You:** a chalk-white (`text-1`) node, 10px, at the centre. The only white node.
- **People:** 6px nodes in `text-3` grey. When attached to a company, they take that company's brand colour mixed 40% toward grey, as the code does now. **Drop the ten-colour categorical fallback** (clay, sage, sand…). A company with no detectable brand colour is just grey. Made-up colours for companies are noise pretending to be data.
- **Companies:** rendered as their logo tile (16px, 4px radius), not a dot. This is where brand colour lives at full strength.
- **Edges:** 1px `line-3` at about 60% opacity. Stronger ties (chatted, mutual) get 1.5px. No curves, no arrowheads.
- **The rope:** select a target company and the shortest warm path from you to it lights up in **Rope orange**, 2px, with the nodes on it ringed in orange. That's the brand in a single gesture: the rope that holds you, drawn as a real line through real people. It's also the only place orange appears inside the graph.
- **Labels:** Plex Mono 10px `text-2`, shown on hover, on selection, and above 1.5× zoom. Never all at once.
- **Motion:** the simulation settles within about 1.2s and then **stops**. No idle drift, no breathing. A graph that never stops moving is a screensaver, not an instrument.

---

## 6. Logo

### Concept: the top-rope

A top-rope belay is three points and one line: an **anchor** at the top, the rope running over it, the **climber** on one end and the **belayer** on the other. Drawn as a diagram, it's an arch with a dot at each foot.

- It's literally what the product is named after, without a mountain or a carabiner in sight.
- It's also a graph fragment: three nodes and the path between them. That's the network half of the product, and the "warm path" in the graph uses the same drawing.
- It works as a lowercase **n**, or an arch, at favicon size.

### Construction
- A 24×24 grid. A monoline stroke **2 units** wide with round caps.
- The top is a semicircle with a radius of 6 units centred at (12, 8): the anchor.
- Two vertical legs drop from the arch. **The legs are unequal.** The left leg (the climber) ends at y = 13. The right leg (the belayer) ends at y = 20. The climber is partway up the wall, and the belayer is on the ground. That asymmetry is the whole idea: one person climbing, one holding.
- Each leg ends in a filled dot 4 units in diameter.
- **Colour:** the stroke and the belayer's dot are chalk `#EDEEF0`. **The climber's dot is Rope orange `#F57F3A`.** The climber is you. In one-colour contexts (favicon at 16px, emboss, monochrome print), everything goes to one colour and the asymmetry carries the meaning.
- **Lockup:** the mark plus "BELAY" in Plex Mono 500, uppercase, +0.18em tracking, cap height equal to the arch radius. The nav uses the wordmark alone.

### Must avoid
Mountains and peaks. Carabiners (every climbing gym has used one). Human figures or hands. Rope texture or braids. Knots that only climbers can read, like the figure-eight, which turns into a squiggle at 16px. Gradients. Shields and checkmarks ("safety"). Generic node-and-edge blobs that look like any other networking startup. Upward-arrow growth clichés.

### Gemini image prompts

**Prompt 1: the primary mark**
> Minimal flat vector logo mark on a solid near-black background (#0C0C0D). A single monoline stroke of uniform weight with rounded caps forms a semicircular arch at the top, like a lowercase letter n. Two straight vertical legs drop from the arch. The left leg is short and ends about halfway down. The right leg is long and ends near the bottom. Each leg ends in a solid filled circle slightly wider than the stroke. The stroke and the right circle are off-white (#EDEEF0). The left circle is a vivid safety orange (#F57F3A). Geometric, built on a strict square grid, centred with generous empty space around it. Flat vector, no text, no gradients, no shadows, no texture, no 3D, no mountains, no climbing figures, no carabiner.

**Prompt 2: app icon tile**
> Flat vector app icon: a rounded square tile in dark graphite (#1B1C1E) with a subtle 1px lighter border (#2F3033). Centred inside is a minimal monoline symbol: an arch whose two legs are different lengths, the left leg short and the right leg long. Each leg ends in a small solid dot. The line is off-white with rounded ends, and the dot on the short left leg is bright orange (#F57F3A). Precise, engineered, like a symbol printed on scientific equipment or a field instrument. Lots of negative space. Flat vector, no text, no lettering, no gradient, no glow, no shadow, no photorealism.

**Prompt 3: monochrome and favicon study**
> A sheet of four small flat vector logo variations side by side on a plain off-white background (#FAFAF9), all in a single near-black colour (#1A1B1C). Each is the same abstract mark: one continuous line of even thickness bending over a semicircular top like an inverted U, with a short left leg and a long right leg, each ending in a solid round dot. Show it at four sizes, from large down to tiny favicon scale, with the stroke thickening slightly at the smaller sizes to stay legible. Swiss modernist, geometric, technical-drawing precision. Flat vector, no text, no labels, no colour fills other than the single dark colour, no decoration.

---

## 7. Voice and microcopy

Belay's copy is already close to this direction: plain, second person, honest about what the tool will do. The comments in `ContactPanel.tsx` ("Generic thanks is worse than none") show the right instinct. This section turns it into rules and tightens a few lapses.

**Principles**
1. **Say the thing, then stop.** One sentence. Cut "please", "simply" and "just".
2. **Numbers beat adjectives.** "12 of 34 boards" rather than "Scouring…". "9 days" rather than "a while".
3. **Verbs on buttons, nouns on headers.** A button says what happens when you press it. A header names what's below it.
4. **Use the user's words, not the system's.** "Scan" rather than "ingest". "People" rather than "contacts". "Role" rather than "job".
5. **One name per thing.** If the nav says Home, the page says Home.
6. **Empty states say how the space fills, in one line.** No illustrations and no encouragement.
7. **Digits, not words, for quantities** ("2–3 sentences"), and `tnum` wherever numbers stack.
8. **No exclamation marks. No "AI" or "magic". Claude is named only where it's literally Claude.**

**Before and after (from the current app)**

| Where | Before | After | Why |
|---|---|---|---|
| Applications header button and its loading state (`app/applications/page.tsx`) | **Run ingest** → *Scouring…* | **Scan now** → *Scanning · 12 of 34 sources* | "Ingest" is pipeline jargon. "Scouring" is personality where you need progress. An instrument reads out. |
| Home page title vs nav tab (`app/page.tsx`, `Nav.tsx`) | Nav: **Home**. Page h1: **Dashboard** | **Home** in both places, with the date as the `display` line underneath | One name per thing. Two names for one place make it look like two places. |
| Add-summary placeholder (`ContactPanel.tsx`) | *Paste their LinkedIn About section and current role. Call notes or a message thread work too. Belay writes a two or three sentence summary of who they are.* | *Paste their About section, call notes or a thread. Belay writes a 2–3 sentence summary.* | 37 words down to 15. Same information. Digits for quantities. |

Two more, briefly:
- Network empty state: *"Nobody here yet. Add someone from the queue and they land here."* → *"No people yet. Accept someone in the queue to add them."* (Name the actual action, which is Accept.)
- Home chat: *"Chat with Claude" / "What should I focus on today?"* → *"Ask" / "What needs you today, who's due a follow-up, how the week is going."* (The panel is a tool, not a character.)

---

## 8. Weaknesses, honestly

1. **It can look like a Linear clone.** Dark graphite, hairlines, one accent and a mono font is the house style of 2020s developer tools. Without the graph and the logo, a screenshot of Belay could be any SaaS settings page. For a portfolio piece, *recognisable at a glance* matters, and this direction gives up some of that on purpose. Everything distinctive has to come from the graph, the rope path and the copy.
2. **It underplays the "partner" half of the name.** A belay is a device, but it's also a person who has chosen to hold your weight. Job searching is lonely and hard on morale. A quiet instrument is respectful but cold. A warmer, more human direction would do better at being *company* during a stressful search, and at making the network side feel like relationships rather than records.
3. **Losing pink and blue costs a real cue.** The owner chose those accents on purpose and has built a lot of reasoning around them. Monochrome stage ramps carry less meaning per pixel than a hue does, and at 11px a grey "Sent" chip is easier to misread than a blue one. The 2px section-tick fallback is a patch, not a full answer.
4. **Orange is close to Figma, Airbnb and Anthropic's clay, and to alarm red.** Rule 3 (orange never on identity surfaces) and the dot-plus-words rule for semantics reduce this, but in a role panel with an orange-ish brand header, the primary button will sit closer to the header than ideal.
5. **IBM Plex brings associations.** It's well made, but it's also IBM's corporate voice and appears in a lot of enterprise software. Geist is the fallback, and it's more generic.
6. **Restraint needs constant enforcement.** Every new feature will push for its own colour (a tier colour, a source colour, a "hot" badge). This direction only works if someone keeps saying no. For a solo, AI-assisted codebase that grows by accretion, that's a real ongoing cost, and the colour count in `globals.css` shows the drift has already started.
7. **It doesn't tell a story on its own.** A more expressive, climbing-native direction (terrain, topo lines, route grades, the vertical metaphor of progress) would give the portfolio case study a much stronger narrative and more images to show. This direction's story is a design argument about restraint, which persuades designers more than it delights anyone else.

**What the rivals would do better:** a warm, human direction would win on emotional support and on making the network feel like people. An expressive, climbing-themed direction would win on memorability, on the README hero and on case-study narrative.

**What this direction does better than either:** it's the one you'll still want to open on a bad Tuesday in month four of a search, with 34 roles waiting. The colour you see is the company's, not the app's. The only orange on the screen is the next thing to do.
