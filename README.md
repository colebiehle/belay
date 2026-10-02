# Belay

*The rope that holds you while you climb.*

A job search that runs on your own machine. It finds the roles, helps you send the
applications, tracks what happens next, and works the people around the companies you
care about. One local SQLite file. No account, no server, nothing leaves your laptop.

![The dashboard](docs/dash.png)

Built by [Cole Biehle](https://colebiehle.com) for their own search, then stripped of
the personal half so anyone can run it. The commentary in the source explains why
things are the way they are, including the parts that failed first.

---

## The queue

Roles arrive from the career pages of companies you track, from LinkedIn, from VC job
boards and from Gmail alerts. Each one is scored against criteria you wrote, compressed
to a headline and five tags, and handed to you two at a time.

Accept or pass with one key. **The reason you type when you pass is the point** — it
goes back into the scoring, so the queue gets quieter about the things you keep saying
no to. Six of the first eleven passes in the original search turned out to be
restatements of two rules, and those rules now stop the roles arriving at all.

![The queue](docs/queue.png)

## The pipeline

Every accepted role, grouped by stage. Open the form, move the chip, and the row moves
itself.

![The pipeline, with a role open](docs/panel.png)

A panel per role holds the history with the gap in days between each stage, who could
refer you, the interviews, the files you actually sent, your notes, and a chat that
already knows the posting, your positioning and every verdict you have given.

## The network

The same shape, for people. Find designers at a company you track, record them, and
move them from identified through connected, replied and chatted. The chat drafts the
connect note, the follow-up, the scheduling message and the referral ask, with the
roles you are actually applying to already in context.

![The network queue](docs/network.png)

## The profile

Forty-one prompts: the durable answers every application form asks for, and the
positioning, voice and search criteria that every other surface reads. Ten minutes here
is what makes the scoring and the drafts worth anything.

---

## Running it

You need Node 20+, and either [Claude Code](https://claude.com/claude-code) installed
(`claude` on your PATH) or an Anthropic API key.

```bash
git clone <your fork>
cd belay
npm install
npx prisma db push          # creates belay.db
npx tsx scripts/seed.ts     # the questions, blank
npm run dev                 # http://localhost:3001
```

Want to see it full before you fill anything in? There is a demo seed that writes a
plausible search into a throwaway database:

```bash
DATABASE_URL=file:./demo.db npx prisma db push
DATABASE_URL=file:./demo.db npx tsx scripts/seed.ts
DATABASE_URL=file:./demo.db npx tsx scripts/demo.ts
DATABASE_URL=file:./demo.db npm run dev
```

Everything in it is invented, the people especially. The screenshots above are that
demo.

Copy `.env.example` to `.env` if you want the LinkedIn or Gmail ingest arms, or to
narrow what reaches your queue. Every filter ships off by default: no pay floor, no
seniority band, no location rules. A filter you chose is useful; a filter you inherited
from someone else's career is a mystery.

## Your data

`belay.db` is gitignored and so is `.env`. That stays true if you fork this and make
your fork public, but it only covers those files: if you start keeping your resume or
your notes as markdown inside the repo, they go up with your next push. There is a
`private/` directory in `.gitignore` for exactly that.

## Fair warning

Built for one person's search and shared as-is. The ingest arms scrape job boards that
change shape without notice, and when one breaks it stays broken until somebody fixes
it. Every model call costs you, against a Claude Code subscription or your own API key,
and the research runs are long. There is no auth, because it is meant to run on your
laptop — do not put it on the open internet without something in front of it.

Issues and pull requests are welcome, and may sit for a while.

## Licence

MIT. Do what you like with it.
