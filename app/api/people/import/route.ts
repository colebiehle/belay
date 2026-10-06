import { NextRequest, NextResponse } from "next/server";
import { lookupProfile } from "@/lib/linkedin-profile";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { prisma } from "@/lib/prisma";
import { identity } from "@/lib/identity";
import { IMPORT_MAX_CHARS, normalizeLinkedInUrl, personKey } from "@/lib/people-import";
import { contextBlock } from "@/lib/foundation";
import { peopleSignalBlock } from "@/lib/people-signal";

export const dynamic = "force-dynamic";
// A scrolled connections page can hold a hundred people, and the CLI writes every
// one of them back out as JSON. Two minutes was not always enough for that.
export const maxDuration = 300;

/**
 * Paste a LinkedIn page of people, get a queue of cards.
 *
 * The page is whatever you were looking at: someone's connections, a company's
 * People tab filtered by school, a search, "people also viewed". The prompt does
 * not ask which. Every one of those is the same thing underneath (a list of people,
 * each with a name, a headline and usually a profile link, wrapped in LinkedIn's
 * nav), so one extraction reads them all, and a new kind of page needs no new code.
 *
 * It only queues. Nothing becomes a Contact until you press Add on its card,
 * because a page of 40 strangers is a list to read, not 40 people you know.
 *
 * Dedupe is here rather than in the prompt, against both tables: anyone already in
 * the network, and anyone ever queued in any status. The second one matters most:
 * a person you skipped must not come back the next time the same page is pasted.
 */

type Extracted = {
  source?: string | null;
  people?: {
    name?: string | null;
    title?: string | null;
    company?: string | null;
    location?: string | null;
    linkedinUrl?: string | null;
    fit?: number | string | null;
    fitReason?: string | null;
  }[];
};

// Who you are and what you are looking for, for the fit ranking: the same criteria
// the job enrich route reads, plus positioning and career arc so "someone a step
// ahead of you on the same path" is something the model can actually recognise.
const FIT_KINDS = [
  "positioning",
  "career_arc",
  "search_target_companies",
  "search_target_roles",
  "search_target_problems",
  "search_positive_signals",
  "search_negative_signals",
  "search_hard_skips",
] as const;

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t && !/^(null|n\/a|unknown|none)$/i.test(t) ? t : null;
};

// Clamped and rounded, because the model sometimes answers "8" or 7.5. Anything
// else is no score, which the queue sorts last rather than reading as a 0.
const fitOf = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw: string = typeof body.text === "string" ? body.text.trim() : "";
  if (!raw) return NextResponse.json({ error: "Paste a page of people first." }, { status: 400 });
  const text = raw.slice(0, IMPORT_MAX_CHARS);
  const mutual = str(body.mutual);
  const batchNote = str(body.batchNote);

  // The logged-in user's own card is on every LinkedIn page (the nav's "Me", the
  // left rail's profile card), so name them to the prompt and drop them again below
  // in case it misses.
  const me = await identity();
  const myName = me.name === "the person using this tool" ? null : me.name;

  // Ranking rides on the extraction call rather than a second one: the model has
  // already read every headline to pull the names out, and a second pass over the
  // same page would double the wait on an import that can already take a minute.
  const [profile, signal] = await Promise.all([
    contextBlock({ include: [...FIT_KINDS], maxCharsPerKind: 1200 }),
    peopleSignalBlock(),
  ]);

  const prompt = `Below is the text of a LinkedIn page that lists people, copied with select-all and paste. It could be someone's connections, a company's People tab, a people search, "people also viewed" or similar. Profile links appear in square brackets after the text they were attached to, like "Jane Doe [https://www.linkedin.com/in/jane-doe/]".

Extract every distinct person the page LISTS.

Ignore:
- ${myName ? `The logged-in user, ${myName}, and their own profile card.` : "The logged-in user's own profile card (the nav's \"Me\", the left-rail profile)."}
- LinkedIn chrome: nav, notifications, messaging, footer, ads, Premium upsells, filters, "Try Premium", job suggestions.
- Side-rail suggestions ("People you may know", "Pages you may like") when they are clearly separate from the main list. If the page IS a "people also viewed" or suggestion list, those are the list.
- Mutual-connection lines ("Sam Lee and 3 other mutual connections"): Sam Lee is not a listed person unless they also have their own card.

For each person:
- name: their name as shown, without degree markers ("· 2nd", "3rd+"), pronouns or credentials suffixes like ", MBA".
- title: their headline or job title, verbatim but trimmed.
- company: the current employer, only when the headline says so ("Product Designer at Figma" -> Figma; "Design @ Stripe" -> Stripe; "Designer | Airbnb" -> Airbnb) or a "Current:" line names it. null if unclear. Never guess from a school.
- location: as shown, or null.
- linkedinUrl: the /in/ link attached to their name, or null if none.
- fit: an integer 1 to 10, how worth adding this person is to ${myName ?? "the user"}'s network for their job search, judged from the headline against their profile and criteria below. High: works at a target company, does the kind of design work they want or leads the people who do, or is a step or two ahead on the same path. Middle: adjacent (a nearby discipline, a company that is not a target but is the right kind). Low: unrelated field, recruiters for unrelated roles, students, or anything their criteria or past passes rule out. Use the whole range; a page where everyone is a 7 is not ranked.
- fitReason: one short line, under 12 words, the fact the score turns on ("Design lead at a target company", "Engineer, not design"). Facts from the headline, no advocacy.

Also give "source": a 2 to 5 word label for what this page is, e.g. "Figma People tab", "Search: product designer", "Jane Doe's connections".

Return ONLY valid JSON, no preamble, no code fences:

{ "source": "...", "people": [ { "name": "...", "title": "...", "company": "...", "location": "...", "linkedinUrl": "...", "fit": 7, "fitReason": "..." } ] }

Never invent a person, a title or a link that is not on the page. An empty list is a valid answer.
${profile ? `\nTheir profile and search criteria, for the fit score only:\n${profile}\n` : ""}${signal ? `\n${signal}\n` : ""}

The page:
"""
${text}
"""`;

  const { text: out, timedOut } = await callClaudeDetailed(prompt, 280_000);
  const parsed = extractJson<Extracted>(out, "object");
  if (!parsed || !Array.isArray(parsed.people)) {
    return NextResponse.json(
      {
        error: timedOut
          ? "That took too long. Try a shorter paste (one screen of results)."
          : "Could not read any people from that. Try copying the page again.",
      },
      { status: 502 },
    );
  }

  // Clean, then dedupe inside the paste itself: a card's name and its "View Jane's
  // profile" link can come back as two entries.
  const seenInPaste = new Set<string>();
  const people = parsed.people
    .map((p) => ({
      name: str(p.name)?.replace(/\s*·\s*(1st|2nd|3rd\+?)\s*$/i, "") ?? null,
      title: str(p.title),
      company: str(p.company),
      location: str(p.location),
      linkedinUrl: normalizeLinkedInUrl(str(p.linkedinUrl)),
      fit: fitOf(p.fit),
      fitReason: str(p.fitReason)?.slice(0, 120) ?? null,
    }))
    .filter((p): p is typeof p & { name: string } => !!p.name)
    .filter((p) => !(myName && p.name.toLowerCase() === myName.toLowerCase()))
    .filter((p) => {
      const keys = [p.linkedinUrl, personKey(p.name, p.company)].filter((k): k is string => !!k);
      if (keys.some((k) => seenInPaste.has(k))) return false;
      keys.forEach((k) => seenInPaste.add(k));
      return true;
    });

  // Both tables are small (hundreds of rows), so read them whole and match in memory:
  // the URL needs normalising on the stored side too, and older contacts were saved
  // with whatever link was pasted.
  const [contacts, candidates] = await Promise.all([
    prisma.contact.findMany({ select: { name: true, company: true, linkedinUrl: true } }),
    prisma.personCandidate.findMany({ select: { name: true, company: true, linkedinUrl: true } }),
  ]);
  const index = (rows: { name: string; company: string | null; linkedinUrl: string | null }[]) => ({
    urls: new Set(rows.map((r) => normalizeLinkedInUrl(r.linkedinUrl)).filter((u): u is string => !!u)),
    keys: new Set(rows.map((r) => personKey(r.name, r.company))),
  });
  const known = index(contacts);
  const queued = index(candidates);
  // A link wins when both sides have one, so a person whose headline company changed
  // since they were added still matches. Name and company is the fallback only when
  // either side has no link.
  const matches = (p: (typeof people)[number], idx: ReturnType<typeof index>) =>
    p.linkedinUrl && idx.urls.has(p.linkedinUrl) ? true : idx.keys.has(personKey(p.name, p.company));

  let alreadyInNetwork = 0;
  let alreadyQueued = 0;
  const fresh = people.filter((p) => {
    if (matches(p, known)) {
      alreadyInNetwork++;
      return false;
    }
    if (matches(p, queued)) {
      alreadyQueued++;
      return false;
    }
    return true;
  });

  // What the page was, as the batch's heading. The batch note is separate on purpose:
  // it is what Add writes onto each person, and using it as the heading too put the
  // same words on the screen three times.
  const source = str(parsed.source)?.slice(0, 60) ?? batchNote ?? "Pasted page";
  const batchId = `b${Date.now().toString(36)}`;
  if (fresh.length) {
    await prisma.personCandidate.createMany({
      data: fresh.map((p) => ({ ...p, batchNote, mutual, source, batchId, status: "pending" })),
    });
  }

  // Some headlines name no company ("Designer, building things"), so the card had
  // none and showed no logo. The profile's public page usually names the current
  // company, so look those up after the import answers, one at a time and paced,
  // because LinkedIn blocks bursts. Cards fill in as the queue refreshes.
  const missing = fresh.filter((p) => !p.company && p.linkedinUrl);
  if (missing.length) void fillCompanies(batchId, missing.map((p) => p.linkedinUrl!));

  return NextResponse.json({
    found: people.length,
    added: fresh.length,
    alreadyInNetwork,
    alreadyQueued,
    source,
    truncated: raw.length > IMPORT_MAX_CHARS,
  });
}

async function fillCompanies(batchId: string, urls: string[]) {
  for (const url of urls.slice(0, 25)) {
    const { company } = await lookupProfile(url);
    if (company) {
      await prisma.personCandidate
        .updateMany({ where: { batchId, linkedinUrl: url, company: null }, data: { company } })
        .catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
}
