import { prisma } from "@/lib/prisma";
import { orderTags } from "@/lib/contact-stages";

/**
 * What a paste adds to someone who is already known: the mutual and the tags it
 * came with. A person met twice (through Nicole on one paste, tagged "cmu" on
 * another) keeps both, so the overlap shows instead of the second paste being
 * dropped as a duplicate.
 *
 * Contacts keep mutuals in introVias (JSON names, introVia the first) and tags in
 * relationship; queue cards keep them in mutuals and tags. Names match without
 * regard to case. Returns whether anything was added.
 */

export function parseList(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  } catch {
    return [];
  }
}

/** The tags a request sent, cleaned the way the panel cleans them. */
export function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return orderTags(v.filter((t): t is string => typeof t === "string").map((t) => t.trim().toLowerCase().slice(0, 28)));
}

function addName(list: string[], name: string | null): string[] {
  if (!name || list.some((n) => n.toLowerCase() === name.toLowerCase())) return list;
  return [...list, name];
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export async function mergeIntoContact(id: string, mutual: string | null, tags: string[]): Promise<boolean> {
  const c = await prisma.contact.findUnique({ where: { id }, select: { introVia: true, introVias: true, relationship: true } });
  if (!c) return false;
  const before = parseList(c.introVias);
  const vias = addName(before.length ? before : c.introVia ? [c.introVia] : [], mutual);
  const oldTags = parseList(c.relationship);
  const newTags = orderTags([...oldTags, ...tags]);
  if (same(vias, before) && same(newTags, oldTags) && (c.introVia || !vias[0])) return false;
  await prisma.contact.update({
    where: { id },
    data: {
      introVias: vias.length ? JSON.stringify(vias) : null,
      introVia: c.introVia ?? vias[0] ?? null,
      relationship: newTags.length ? JSON.stringify(newTags) : null,
    },
  });
  return true;
}

export async function mergeIntoCandidate(id: string, mutual: string | null, tags: string[]): Promise<boolean> {
  const c = await prisma.personCandidate.findUnique({ where: { id }, select: { mutual: true, mutuals: true, tags: true } });
  if (!c) return false;
  const before = parseList(c.mutuals);
  const mutuals = addName(before.length ? before : c.mutual ? [c.mutual] : [], mutual);
  const oldTags = parseList(c.tags);
  const newTags = orderTags([...oldTags, ...tags]);
  if (same(mutuals, before) && same(newTags, oldTags)) return false;
  await prisma.personCandidate.update({
    where: { id },
    data: {
      mutuals: mutuals.length ? JSON.stringify(mutuals) : null,
      mutual: c.mutual ?? mutuals[0] ?? null,
      tags: newTags.length ? JSON.stringify(newTags) : null,
    },
  });
  return true;
}
