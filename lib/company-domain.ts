import { prisma } from "@/lib/prisma";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { canonicalCompany } from "@/lib/role-filter";
import { logoUrl } from "@/lib/logo";

/**
 * A company's website, for its logo.
 *
 * The logo used to be guessed from the name alone, "<name>.com", which fails for
 * anything whose domain is not its name: Scale AI is scale.com, Columbia
 * University is columbia.edu, X, The Moonshot Factory is x.company. Fifteen of
 * the hundred companies in the Network showed a blank tile that way (2026-10-29).
 *
 * Cheapest source first. The target list and scored roles already hold verified
 * domains, so a contact at a company you track resolves without a model call.
 */
export async function knownCompanyDomain(company: string): Promise<string | null> {
  const name = canonicalCompany(company).toLowerCase();
  if (!name) return null;
  const targets = await prisma.targetCompany.findMany({ select: { name: true, domain: true } });
  const target = targets.find((t) => canonicalCompany(t.name).toLowerCase() === name && t.domain);
  if (target) return target.domain;
  const jobs = await prisma.job.findMany({
    where: { company: canonicalCompany(company), queueEnrichment: { contains: "companyDomain" } },
    select: { queueEnrichment: true },
    take: 5,
  });
  for (const j of jobs) {
    try {
      const d = JSON.parse(j.queueEnrichment ?? "{}").companyDomain;
      if (typeof d === "string" && d.includes(".")) return d;
    } catch {}
  }
  return null;
}

/** Ask the model, then keep its answer only if a logo actually loads for it. */
export async function lookUpCompanyDomain(company: string): Promise<string | null> {
  const prompt = `What is the official website domain of the organization "${company}"? Answer for the organization itself: a university's lab or school uses the university's domain, a product team uses its parent company's domain.

Return ONLY JSON: {"domain": "example.com"}. Use {"domain": ""} if you are not sure which organization this is.`;
  const { text } = await callClaudeDetailed(prompt, 60_000, "haiku");
  const domain = (extractJson<{ domain?: string }>(text, "object")?.domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!domain.includes(".")) return null;
  const res = await fetch(logoUrl(domain)).catch(() => null);
  return res?.ok ? domain : null;
}

export async function resolveCompanyDomain(company: string): Promise<string | null> {
  return (await knownCompanyDomain(company)) ?? (await lookUpCompanyDomain(company));
}
