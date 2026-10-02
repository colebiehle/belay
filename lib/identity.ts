import { prisma } from "@/lib/prisma";

/**
 * Who is using this.
 *
 * Every prompt in the app needs to name the person it is working for, and for a long
 * time 26 of them carried that name and a one-line bio as string literals — which
 * meant the tool could only ever be used by one person, and that updating the bio
 * meant 26 edits that drifted apart anyway (there were eleven different wordings of
 * the same two facts).
 *
 * It comes out of the profile now: `full_name` and `headline` in the answer bank, the
 * same place every other durable fact about the user lives. The fallback is
 * deliberately generic rather than clever, so a fresh install produces prompts that
 * still make sense before anything has been filled in.
 */

const FALLBACK = "the person using this tool";

export async function identity(): Promise<{ name: string; headline: string; pronouns: string }> {
  const rows = await prisma.answerBank.findMany({
    where: { questionKey: { in: ["full_name", "headline", "pronouns"] } },
    select: { questionKey: true, answer: true },
  });
  const get = (k: string) => rows.find((r) => r.questionKey === k)?.answer?.trim() ?? "";
  return { name: get("full_name") || FALLBACK, headline: get("headline"), pronouns: get("pronouns") };
}

/**
 * The form prompts interpolate: "Name (headline)", or just the name when no headline
 * is set. Matches the shape the hardcoded strings already used, so the prompts read
 * the same as they did.
 */
export async function identityLine(): Promise<string> {
  const { name, headline, pronouns } = await identity();
  // Pronouns ride along with the name because the prompts are written in the third
  // person about the user, so every one of them needs this and asking each prompt to
  // remember is how they end up disagreeing. The answer bank has held "they/them"
  // since the day it was created while 185 lines of prompt said "you".
  const bits = [headline, pronouns && `pronouns ${pronouns}`].filter(Boolean);
  return bits.length > 0 ? `${name} (${bits.join("; ")})` : name;
}

/** Just the name, for prompts that own the rest of the sentence. */
export async function identityName(): Promise<string> {
  return (await identity()).name;
}

/**
 * Possessive, for the handful of prompts phrased as "X's job-search corpus". English
 * needs the apostrophe to land in the right place and the fallback has no 's'.
 */
export async function identityPossessive(): Promise<string> {
  const name = await identityName();
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}
