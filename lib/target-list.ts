import { prisma } from "@/lib/prisma";

/** "Their target companies: Anthropic, Apple, Figma, …", for prompts that judge fit. */
export async function targetCompaniesLine(): Promise<string> {
  const rows = await prisma.targetCompany.findMany({ select: { name: true }, orderBy: [{ tier: "asc" }, { name: "asc" }] });
  return rows.length ? `Their target companies: ${rows.map((r) => r.name).join(", ")}.` : "";
}
