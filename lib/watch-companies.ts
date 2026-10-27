/**
 * Companies the job scan watches without them being on your target list: the AI
 * product companies Belay already holds research on, scanned through their public
 * job feeds so their design roles reach the queue, but never shown in the target
 * list, its tiers or Home's company grid (the owner's call, Oct 2026: "implicitly
 * searching, not cluttering my list").
 *
 * Each feed token was checked against a populated jobs array on 2026-10-20 (the
 * AI startup block below on 2026-10-26). The
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
  { name: "Runway", domain: "runwayml.com", careersUrl: "https://runwayml.com/careers", board: { provider: "ashby", token: "runway-ml" } },
  { name: "Brex", domain: "brex.com", careersUrl: "https://www.brex.com/careers", board: { provider: "greenhouse", token: "brex" } },
  // AI product companies that post only on their own board, so the YC and VC feeds
  // never saw them. Found by a full sweep on 2026-10-26 (about 45 live roles the
  // queue had missed); every token answered with a populated jobs array that day.
  { name: "Stability AI", domain: "stability.ai", careersUrl: "https://stability.ai/careers", board: { provider: "greenhouse", token: "stabilityai" } },
  { name: "Greptile", domain: "greptile.com", careersUrl: "https://greptile.com/careers", board: { provider: "ashby", token: "greptile" } },
  { name: "LangChain", domain: "langchain.com", careersUrl: "https://langchain.com/careers", board: { provider: "ashby", token: "langchain" } },
  { name: "CodeRabbit", domain: "coderabbit.ai", careersUrl: "https://coderabbit.ai/careers", board: { provider: "ashby", token: "coderabbit" } },
  { name: "Pika", domain: "pika.art", careersUrl: "https://pika.art/careers", board: { provider: "ashby", token: "pika" } },
  { name: "Midjourney", domain: "midjourney.com", careersUrl: "https://midjourney.com/careers", board: { provider: "ashby", token: "midjourney" } },
  { name: "Writer", domain: "writer.com", careersUrl: "https://writer.com/careers", board: { provider: "ashby", token: "writer" } },
  { name: "Sigma Computing", domain: "sigmacomputing.com", careersUrl: "https://sigmacomputing.com/careers", board: { provider: "greenhouse", token: "sigmacomputing" } },
  { name: "Exa", domain: "exa.ai", careersUrl: "https://exa.ai/careers", board: { provider: "ashby", token: "exa" } },
  { name: "Parallel", domain: "parallel.ai", careersUrl: "https://parallel.ai/careers", board: { provider: "ashby", token: "parallel" } },
  { name: "Circleback", domain: "circleback.ai", careersUrl: "https://circleback.ai/careers", board: { provider: "ashby", token: "circleback" } },
  { name: "Wispr Flow", domain: "wisprflow.ai", careersUrl: "https://wisprflow.ai/careers", board: { provider: "ashby", token: "wispr-flow" } },
  { name: "Gumloop", domain: "gumloop.com", careersUrl: "https://gumloop.com/careers", board: { provider: "ashby", token: "gumloop" } },
  { name: "Magic Patterns", domain: "magicpatterns.com", careersUrl: "https://magicpatterns.com/careers", board: { provider: "ashby", token: "magicpatterns" } },
  { name: "Baseten", domain: "baseten.co", careersUrl: "https://baseten.co/careers", board: { provider: "ashby", token: "baseten" } },
  { name: "Factory", domain: "factory.ai", careersUrl: "https://factory.ai/careers", board: { provider: "ashby", token: "factory" } },
  { name: "Warp", domain: "warp.dev", careersUrl: "https://warp.dev/careers", board: { provider: "ashby", token: "warp" } },
  { name: "Read AI", domain: "read.ai", careersUrl: "https://read.ai/careers", board: { provider: "ashby", token: "read-ai" } },
  { name: "Zip", domain: "ziphq.com", careersUrl: "https://ziphq.com/careers", board: { provider: "ashby", token: "zip" } },
  { name: "Udio", domain: "udio.com", careersUrl: "https://udio.com/careers", board: { provider: "greenhouse", token: "udio" } },
  { name: "Rogo", domain: "rogo.ai", careersUrl: "https://rogo.ai/careers", board: { provider: "ashby", token: "rogo" } },
  { name: "Zed", domain: "zed.dev", careersUrl: "https://zed.dev/careers", board: { provider: "ashby", token: "zed" } },
  { name: "Garage", domain: "garage.com", careersUrl: "https://garage.com/careers", board: { provider: "ashby", token: "garage" } },
  { name: "Fireworks AI", domain: "fireworks.ai", careersUrl: "https://fireworks.ai/careers", board: { provider: "ashby", token: "fireworks" } },
  { name: "Playground", domain: "playground.com", careersUrl: "https://playground.com/careers", board: { provider: "ashby", token: "playground" } },
  { name: "Retell AI", domain: "retellai.com", careersUrl: "https://retellai.com/careers", board: { provider: "ashby", token: "retell-ai" } },
  { name: "Braintrust", domain: "braintrust.dev", careersUrl: "https://braintrust.dev/careers", board: { provider: "ashby", token: "braintrust" } },
  { name: "August", domain: "august.law", careersUrl: "https://august.law/careers", board: { provider: "ashby", token: "august" } },
  { name: "Phoebe", domain: "phoebe.work", careersUrl: "https://phoebe.work/careers", board: { provider: "ashby", token: "phoebe-work" } },
  { name: "Glide", domain: "glideapps.com", careersUrl: "https://glideapps.com/careers", board: { provider: "ashby", token: "glide" } },
  { name: "Eudia", domain: "eudia.com", careersUrl: "https://eudia.com/careers", board: { provider: "greenhouse", token: "eudia" } },
];

const WATCHED = new Set(WATCH_COMPANIES.map((c) => c.name.toLowerCase()));

export function isWatchedCompany(company: string): boolean {
  return WATCHED.has((company || "").toLowerCase().trim());
}
