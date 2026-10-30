/**
 * Which companies the ingest can reach on its own.
 *
 * This lives outside the ingest route because two surfaces need the same
 * answer: the scan, to pick a fetcher, and the dashboard grid, to mark which
 * logos are worth clicking. When those two drifted apart, the grid showed
 * thirty-odd companies all looking equally in need of a manual check, which is
 * the opposite of the point.
 *
 * Many target companies publish every open role through a public,
 * unauthenticated JSON endpoint on their applicant tracking system. When one
 * exists it beats the HTML+Claude path on every axis: it's free, it's
 * structured, it never misses a listing the way HTML scraping does on
 * JS-rendered pages, and it can't hallucinate. Companies without a known ATS
 * fall through to the Claude path.
 *
 * To add a company: find its board token and confirm the endpoint returns 200
 * with a populated jobs array. An unverified guess is worse than nothing,
 * because it falls through to the (failing) HTML path silently.
 *   Greenhouse  https://boards-api.greenhouse.io/v1/boards/<token>/jobs
 *   Ashby       https://api.ashbyhq.com/posting-api/job-board/<token>
 *   Lever       https://api.lever.co/v0/postings/<token>
 *   Eightfold   https://<careers-host>/api/apply/v2/jobs?domain=<domain>
 *
 * Entries here are only read for companies that exist in TargetCompany, so a
 * token for a company since dropped from the list is dead weight. The batch for
 * companies rejected in Sep 2026 (Cohere, Decagon, Abridge, Suno, Writer, Attio,
 * Glean, Webflow and others) was removed rather than left to rot. Perplexity,
 * ElevenLabs, Sierra and Scale AI came back onto the list in Oct 2026,
 * with verified tokens below.
 */
export type AtsProvider = "greenhouse" | "ashby" | "lever" | "amazon" | "workday" | "eightfold" | "apple" | "google";

export const ATS_BOARDS: Record<string, { provider: AtsProvider; token: string }> = {
  figma: { provider: "greenhouse", token: "figma" },
  anthropic: { provider: "greenhouse", token: "anthropic" },
  stripe: { provider: "greenhouse", token: "stripe" },
  airbnb: { provider: "greenhouse", token: "airbnb" },
  duolingo: { provider: "greenhouse", token: "duolingo" },
  notion: { provider: "ashby", token: "notion" },
  openai: { provider: "ashby", token: "openai" },
  spotify: { provider: "lever", token: "spotify" },
  cursor: { provider: "ashby", token: "cursor" },
  linear: { provider: "ashby", token: "linear" },
  airtable: { provider: "greenhouse", token: "airtable" },
  // Tracked targets that were falling through to the HTML path and failing
  // there. Every token here was verified against a populated jobs array.
  discord: { provider: "greenhouse", token: "discord" },
  ramp: { provider: "ashby", token: "ramp" },
  // Games and entertainment. Riot was left out for a client-side page, but it runs
  // a Greenhouse board behind it (182 roles on 2026-10-29). Valve has no feed.
  "riot games": { provider: "greenhouse", token: "riotgames" },
  // Sony Interactive's global board. The first-party studios run their own
  // (naughtydog, insomniac, firesprite, housemarque, haven, pdi) — worth adding
  // individually if the global board proves thin on design.
  playstation: { provider: "greenhouse", token: "sonyinteractiveentertainmentglobal" },
  disney: { provider: "workday", token: "disney.wd5|disney|disneycareer" },
  // Consumer brands and incumbents. Most of these run Workday, which has no public
  // search endpoint, so only the few on a fetchable ATS are listed.
  asana: { provider: "greenhouse", token: "asana" },
  // Big-tech targets with public search APIs. None is an ATS in the sense
  // above, but all return structured JSON, which beats scraping a JS-rendered
  // careers page (which is why these used to fail on every scan).
  amazon: { provider: "amazon", token: "product designer" },
  adobe: { provider: "workday", token: "adobe.wd5|adobe|external_experienced" },
  netflix: { provider: "eightfold", token: "explore.jobs.netflix.net|netflix.com" },
  // No API it will serve a script; read from its search page (fetchAppleListings).
  apple: { provider: "apple", token: "en-us" },
  // Its search page carries the results as JSON (fetchGoogleListings).
  google: { provider: "google", token: "product designer|ux designer|interaction designer" },
  // Added with the Oct 2026 list changes; each answered with a populated jobs
  // array on 2026-10-29.
  waymo: { provider: "greenhouse", token: "waymo" },
  robinhood: { provider: "greenhouse", token: "robinhood" },
  perplexity: { provider: "ashby", token: "perplexity" },
  "scale ai": { provider: "greenhouse", token: "scaleai" },
  elevenlabs: { provider: "ashby", token: "elevenlabs" },
  sierra: { provider: "ashby", token: "sierra" },
  roblox: { provider: "greenhouse", token: "roblox" },
  databricks: { provider: "greenhouse", token: "databricks" },
  nvidia: { provider: "workday", token: "nvidia.wd5|nvidia|NVIDIAExternalCareerSite" },
  nike: { provider: "workday", token: "nike.wd1|nike|nke" },
  // Promoted from the retired watch list, Oct 2026; tokens verified there on
  // 2026-10-20.
  vercel: { provider: "greenhouse", token: "vercel" },
  granola: { provider: "ashby", token: "granola" },
  runway: { provider: "ashby", token: "runway-ml" },
  gamma: { provider: "ashby", token: "gamma" },
};

/**
 * Sources with no structured feed whose pages are JS-rendered or login-walled.
 * Each one costs ~90s of Claude extraction and has never produced a listing, so
 * the scan skips them outright and reports them as manual checks.
 *
 * Netflix is deliberately absent: its careers site runs on Eightfold,
 * whose search API is public. The rest were re-probed the same day and stay —
 * Apple's search API 401s without a CSRF token (it is read from its search page
 * instead, see ATS_BOARDS), Microsoft's
 * gcsservices host refuses a plain client, and Meta/Uber/TikTok render
 * results client-side. They are not invisible, though: the LinkedIn arm finds
 * them by title, which is where the Google, Microsoft, Meta and Apple rows in
 * the queue actually came from.
 */
export const MANUAL_ONLY = new Set([
  "microsoft", "meta", "uber", "tiktok", "linkedin",
  // Wellfound and YC's public board (ycombinator.com/jobs) render their listings
  // server-side and are read like any site. Work at a Startup blocks scripts.
  "handshake", "workatastartup",
  // Consider-powered VC boards: React apps that keep both the job data and the
  // filter state off the URL, so there is nothing to fetch or deep-link.
  "a16z portfolio", "lightspeed", "sequoia", "levels.fyi jobs",
]);

/**
 * How a company's roles reach the queue, for the dashboard grid.
 *
 * "board"    — a dedicated ATS arm pulls it every scan.
 * "search"   — no feed of its own, but the LinkedIn title search finds it.
 * "manual"   — nothing automated reaches it; the logo is the only route in.
 *
 * The middle case is the one worth being precise about. Those companies look
 * uncovered and aren't: eight of the Google/Microsoft/Meta/Apple rows sitting
 * in the queue right now arrived through the LinkedIn arm.
 */
export type Coverage = "board" | "search" | "manual";

// Employers large enough that a LinkedIn title search reliably returns their
// postings. A small company can go weeks without appearing in one, so calling
// it "covered" would be a promise the scan can't keep.
const SEARCH_COVERED = new Set([
  "google", "microsoft", "meta", "uber", "tiktok", "linkedin",
]);

// Every ingest scans every tracked company with a board, whatever its tier, so
// tier no longer decides coverage.
export function coverageFor(companyName: string): Coverage {
  const key = companyName.toLowerCase();
  if (ATS_BOARDS[key]) return "board";
  if (SEARCH_COVERED.has(key)) return "search";
  return "manual";
}
