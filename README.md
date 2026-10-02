# Belay

*The rope that holds you while you climb.*

A job search that runs on your own machine. It finds the roles, helps you send the
applications, tracks what happens next, and works the people around the companies you
care about. One local SQLite file. No account, no server, nothing leaves your laptop.

![The dashboard](docs/dash.png)

---

## The queue

Roles arrive from the career pages of companies you track, from LinkedIn, from VC job
boards and from Gmail alerts. Each one is scored against criteria you write, compressed
to a headline and five tags, and handed to you two at a time.

Accept or pass with one key. When you pass, write why: those reasons feed back into the
scoring, so the queue gets quieter over time about the things you keep turning down.
Add a role the scan missed by pasting its URL.

![The queue](docs/queue.png)

## The pipeline

Every accepted role, grouped by stage. Move the chip to move the role.

![The pipeline, with a role open](docs/panel.png)

Each role opens a panel holding its history with the gap in days between stages, who
could refer you, scheduled interviews, the files you sent, your notes, and a chat that
already knows the posting, your profile and your past verdicts.

## The network

The same shape, for people. Find designers at a company you track, record them, and
move them from identified through connected, replied and chatted. The chat drafts the
connect note, the follow-up, the scheduling message and the referral ask, with the
roles you are applying to already in context.

![The network queue](docs/network.png)

## The profile

Forty-one prompts: the durable answers every application form asks for, plus the
positioning, voice and search criteria that everything else reads. Filling these in is
what makes the scoring and the drafts useful, so start here.

---

## Running it

You need Node 20+, and either [Claude Code](https://claude.com/claude-code) installed
(`claude` on your PATH) or an Anthropic API key.

```bash
git clone https://github.com/colebiehle/belay
cd belay
npm install
npx prisma db push          # creates belay.db
npx tsx scripts/seed.ts     # the questions, blank
npm run dev                 # http://localhost:3001
```

Open `/profile` and answer what you can. Then add the companies you care about on the
dashboard, and press **Run ingest** on the Applications page to fill the queue.

### Try it with example data first

```bash
DATABASE_URL=file:./demo.db npx prisma db push
DATABASE_URL=file:./demo.db npx tsx scripts/seed.ts
DATABASE_URL=file:./demo.db npx tsx scripts/demo.ts
DATABASE_URL=file:./demo.db npm run dev
```

That writes a plausible search into a throwaway database, which is what the screenshots
above show. Everything in it is invented, the people especially.

### Configuration

Copy `.env.example` to `.env`. Everything in it is optional.

The ingest arms need credentials only if you want them: a LinkedIn session cookie for
the LinkedIn scan, Google credentials for the Gmail alert parser. The app runs fine
without either; those arms just stay quiet.

The search filters all ship **off**, so a fresh install shows you everything. Set
`SEARCH_COMP_FLOOR_USD`, `SEARCH_MAX_YOE`, `SEARCH_LEVEL_EXCLUDE` and the rest to
narrow what reaches your queue. See `lib/search-config.ts` for what each one does.

## Your data

`belay.db` and `.env` are gitignored. That holds if you fork this and make your fork
public, but it only covers those files — if you keep your resume or your notes as
markdown inside the repo, they go up with your next push. There is a `private/`
directory in `.gitignore` for exactly that.

## Caveats

The ingest arms scrape job boards that change shape without notice, and a broken one
stays broken until somebody fixes it. Every model call costs you, against a Claude Code
subscription or your own API key, and the research runs are long. There is no auth,
because it is meant to run on your laptop: do not put it on the open internet without
something in front of it.

Issues and pull requests are welcome, and may sit for a while.

## Licence

MIT. Built by [Cole Biehle](https://colebiehle.com).
