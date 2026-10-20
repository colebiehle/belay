/**
 * Companies the job scan watches without them being on your target list: the AI
 * product companies Belay already holds research on, scanned through their public
 * job feeds so their design roles reach the queue, but never shown in the target
 * list, its tiers or Home's company grid (the owner's call, Oct 2026: "implicitly
 * searching, not cluttering my list").
 *
 * Each feed token was checked against a populated jobs array on 2026-10-20. The
 * companies rejected in Sep 2026 (ElevenLabs, Sierra, Perplexity, Harvey, Cohere,
 * Decagon, Glean, Scale AI and others, see lib/ats-boards) stay out.
 *
 * Their roles pass the same company gate as a tracked employer's, and are scored
 * and expired like any other.
 */
import type { AtsProvider } from "@/lib/ats-boards";

export const WATCH_COMPANIES: { name: string; domain: string; careersUrl: string; board: { provider: AtsProvider; token: string } }[] = [
  { name: "Vercel", domain: "vercel.com", careersUrl: "https://vercel.com/careers", board: { provider: "greenhouse", token: "vercel" } },
  { name: "Replit", domain: "replit.com", careersUrl: "https://replit.com/careers", board: { provider: "ashby", token: "replit" } },
  { name: "Granola", domain: "granola.ai", careersUrl: "https://www.granola.ai/careers", board: { provider: "ashby", token: "granola" } },
  { name: "Gamma", domain: "gamma.app", careersUrl: "https://gamma.app/careers", board: { provider: "ashby", token: "gamma" } },
  { name: "Photoroom", domain: "photoroom.com", careersUrl: "https://www.photoroom.com/company/careers", board: { provider: "ashby", token: "photoroom" } },
  { name: "Descript", domain: "descript.com", careersUrl: "https://www.descript.com/careers", board: { provider: "greenhouse", token: "descript" } },
  { name: "Runway", domain: "runwayml.com", careersUrl: "https://runwayml.com/careers", board: { provider: "ashby", token: "runway" } },
  { name: "Brex", domain: "brex.com", careersUrl: "https://www.brex.com/careers", board: { provider: "greenhouse", token: "brex" } },
];

const WATCHED = new Set(WATCH_COMPANIES.map((c) => c.name.toLowerCase()));

export function isWatchedCompany(company: string): boolean {
  return WATCHED.has((company || "").toLowerCase().trim());
}
