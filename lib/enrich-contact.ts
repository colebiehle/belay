import { prisma } from "@/lib/prisma";
import { callClaudeWithToolsDetailed, extractJson } from "@/lib/claude";

/**
 * Fill in a person from the open web: their current job title, employer and a short
 * summary, for people added from a LinkedIn paste.
 *
 * The paste only ever has a one-line headline, and LinkedIn blocks the server from
 * reading a profile, so a person arrived with "Design @ something | ex-Figma" as a
 * title, often no company and no summary, and each one was filled in by hand. The
 * profile link pins down which person it is: a search for the link's slug and the
 * name finds the profile's search snippet, a personal site, a company page or a talk,
 * and the headline is there to check the match against.
 *
 * It only fills what is empty (the summary, the company) and only replaces the title
 * when the title is still the pasted headline. Nothing you have written is touched.
 * When it cannot be sure it is the same person it writes nothing.
 *
 * Contacts one at a time, in the background: a thirty-person "Add all" is thirty
 * searches, and thirty claude processes at once would starve the machine. Queue
 * cards are looked up earlier, at paste time, two at a time (below). The queue lives in this
 * process, so a restart drops what was waiting; `enrichMissing` picks those up again.
 */

type Found = {
  samePerson?: boolean;
  title?: string | null;
  company?: string | null;
  summary?: string | null;
};

const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim() : "";

const waiting: string[] = [];
const pending = new Set<string>();
let running = false;

/** Queue people to look up. Already-queued ids are skipped. */
export function enqueueEnrich(ids: string[]): void {
  for (const id of ids) {
    if (pending.has(id)) continue;
    pending.add(id);
    waiting.push(id);
  }
  if (!running) void drain();
}

/** Whether a person is waiting or being looked up, for the panel's "Looking them up". */
export function isEnriching(id: string): boolean {
  return pending.has(id);
}

/**
 * Everyone with a profile link and no summary, queued. For the people added before
 * this existed, and anyone a restart dropped.
 */
export async function enrichMissing(): Promise<number> {
  const rows = await prisma.contact.findMany({
    where: { linkedinUrl: { not: null }, OR: [{ profileText: null }, { profileText: "" }] },
    select: { id: true },
  });
  enqueueEnrich(rows.map((r) => r.id));
  return rows.length;
}

async function drain() {
  running = true;
  try {
    while (waiting.length) {
      const id = waiting.shift()!;
      try {
        await enrichContact(id);
      } catch {
        // One failed lookup leaves that person as they were; the rest still run.
      } finally {
        pending.delete(id);
      }
    }
  } finally {
    running = false;
  }
}

/**
 * The search itself, for anyone with a profile link: a queue card or a contact.
 * Null when it could not be sure it was the same person.
 */
export async function lookupPerson(p: {
  name: string;
  linkedinUrl: string;
  headline: string;
  company: string;
}): Promise<{ title: string; company: string; summary: string } | null> {
  const slug = p.linkedinUrl.replace(/\/$/, "").split("/").pop();
  const prompt = `Find out who this person is and what they do now, from public sources.

- Name: ${p.name}
- LinkedIn profile: ${p.linkedinUrl}
- LinkedIn headline: ${p.headline || "(none)"}
- Company, if known: ${p.company || "(unknown)"}

Search the web for them. Start with the profile link's slug and their name (for example "${slug}" and "${p.name}" together, or "${p.name}" with "linkedin"), then their name with their company or headline. Search results for LinkedIn profiles usually show the current role in the snippet. A personal site, company team page, conference talk or interview is also fine. Do not try to fetch linkedin.com itself; it is blocked.

Be sure it is the same person: the LinkedIn link, or the name together with the headline or company, must match. Many people share a name. If you cannot be sure, set samePerson to false and leave everything else null.

Return ONLY valid JSON, no preamble, no code fences:

{ "samePerson": true, "title": "...", "company": "...", "summary": "..." }

- title: their current job title only, short ("Senior Product Designer", "Head of Design"), not the whole headline. null if unclear.
- company: their current employer's usual name ("Figma", not "Figma, Inc."). null if unclear.
- summary: two or three plain sentences, under 70 words, for the top of their record: what they do now and where, what they did before, and what they focus on. Third person, by name or "they"; use he or she only if a source states their pronouns. Facts from what you found only; never invent a role, a company or a history. No marketing language, no em dashes. null if you found too little.`;

  const { text } = await callClaudeWithToolsDetailed(prompt, ["WebSearch", "WebFetch"], 240_000, 12);
  const found = extractJson<Found>(text, "object");
  if (!found?.samePerson) return null;
  return { title: clean(found.title), company: clean(found.company), summary: clean(found.summary) };
}

export async function enrichContact(id: string): Promise<boolean> {
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c?.linkedinUrl) return false;
  // The headline as pasted is what the title held on arrival. Kept to check the
  // match against, and replaced by the real title only while it is still that.
  const headline = c.title ?? c.role ?? "";
  const found = await lookupPerson({ name: c.name, linkedinUrl: c.linkedinUrl, headline, company: c.company });
  if (!found) return false;
  const { title, company, summary } = found;

  // Re-read: the person may have been edited while the search ran.
  const now = await prisma.contact.findUnique({ where: { id } });
  if (!now) return false;
  const data: { title?: string; company?: string; profileText?: string } = {};
  if (title && (!now.title || now.title === headline)) data.title = title;
  if (company && !now.company) data.company = company;
  if (summary && !now.profileText?.trim()) data.profileText = summary;
  if (!Object.keys(data).length) return false;
  await prisma.contact.update({ where: { id }, data });
  return true;
}

// ---- The People queue ------------------------------------------------------
//
// Cards are looked up right after the paste, in the background, two at a time and
// in paste order, so the cards you reach first fill first. The paste itself is not
// slowed: it answers as soon as the page is read. The headline stays the card's
// title (it is what the fit was judged on); the lookup sets the company and the
// summary, and both move to the Contact on Add.

const cardWaiting: string[] = [];
const cardPending = new Set<string>();
let cardWorkers = 0;
const CARD_CONCURRENCY = 2;

export function enqueueCandidates(ids: string[]): void {
  for (const id of ids) {
    if (cardPending.has(id)) continue;
    cardPending.add(id);
    cardWaiting.push(id);
  }
  while (cardWorkers < CARD_CONCURRENCY && cardWaiting.length) {
    cardWorkers++;
    void cardWorker();
  }
}

async function cardWorker() {
  try {
    while (cardWaiting.length) {
      const id = cardWaiting.shift()!;
      try {
        await enrichCandidate(id);
      } catch {
        // Marked as looked up regardless, below, so a failure is not retried forever.
      } finally {
        await prisma.personCandidate.update({ where: { id }, data: { lookedUpAt: new Date() } }).catch(() => {});
        cardPending.delete(id);
      }
    }
  } finally {
    cardWorkers--;
  }
}

async function enrichCandidate(id: string): Promise<void> {
  const c = await prisma.personCandidate.findUnique({ where: { id } });
  // Decided while it waited: a passed card needs nothing, and an added one is now a
  // Contact, which the Add queued for its own lookup.
  if (!c?.linkedinUrl || c.status !== "pending" || c.lookedUpAt) return;
  const found = await lookupPerson({ name: c.name, linkedinUrl: c.linkedinUrl, headline: c.title ?? "", company: c.company ?? "" });
  if (!found) return;
  const data: { company?: string; summary?: string } = {};
  // The lookup's company wins on a card: the card's came from the paste, which
  // often reads a location or a school into it ("Carnegie Mellon University - San
  // Francisco Bay Area"), and nothing on a card has been typed by you yet.
  if (found.company && found.company !== c.company) data.company = found.company;
  if (found.summary) data.summary = found.summary;
  if (Object.keys(data).length) await prisma.personCandidate.update({ where: { id }, data });
}

/**
 * Pending cards still waiting for a lookup that nothing is running (a restart drops
 * the queue), put back in line. Called whenever the queue is read.
 */
export async function resumeCandidateLookups(): Promise<void> {
  const rows = await prisma.personCandidate.findMany({
    where: { status: "pending", lookedUpAt: null, linkedinUrl: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const missing = rows.map((r) => r.id).filter((id) => !cardPending.has(id));
  if (missing.length) enqueueCandidates(missing);
}
