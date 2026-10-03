import {
  COMPANY_LEVEL_EXCLUDE,
  LEVEL_EXCLUDE,
  LOCATION_EXCLUDE,
  MAX_POSTING_AGE_DAYS,
  MAX_YOE,
  TITLE_EXCLUDE_EXTRA,
} from "@/lib/search-config";

export { MAX_POSTING_AGE_DAYS, MAX_YOE };
export { isFreshPosting } from "@/lib/search-config";
// Shared role filter.
//
// Both intake paths use this: the career-page scanner and the LinkedIn alert
// reader. They used to diverge, which meant roles arriving by email skipped
// every rule the scanner applied.
//
// The rules: any product, UX, interaction,
// experience, design-engineering or model-design title; nothing that requires
// zero experience; nothing above senior. The company list does the heavy
// filtering, so this stays deliberately wide and the scorer ranks the rest.

// Title-level filter. Raw substring matching on "design" or "research" is far too
// loose: it pulls in ASIC Design Verification Engineer, Research Scientist, and
// Engineering Manager, Research Platform. Exclusions run first, then inclusions,
// with "design engineer" whitelisted because it IS a design role despite the noun.
export const TITLE_EXCLUDE = [
  "asic", "verification", "validation", "hardware", "mechanical", "electrical",
  "silicon", "chip", "firmware", "research engineer", "research scientist",
  "research manager", "engineering manager", "software engineer", "data scientist",
  "machine learning", "recruiter", "sourcer", "accountant", "counsel", "salesforce",
  // Physical/infra engineering that uses "design" in the mechanical sense. Without
  // these, the design-engineer whitelist below pulls in actuators and data centres.
  "actuator", "data center", "datacenter", "thermal", "optical", "robotics",
  "structural", "civil", "manufacturing", "physical security", "codesign",
  "soc ", "gpu", "cpu", "semiconductor", "pcb", "rtl", "analog", "circuit",
  // More of the same, found when the portfolio-board scan returned a SpaceX
  // Raptor engine role and a "Construction Design Engineer". The design-engineer
  // whitelist below is broad on purpose, so this list has to carry the weight.
  "propulsion", "electronics", "construction", "aerospace", "avionics",
  "powertrain", "battery", "chassis", "tooling", "fixture", "weld", "hvac",
  "piping", "drafting", "cad ", "plant ", "substation", "turbine",
  // "Physical design" is the VLSI layout discipline — floorplanning, placement
  // and routing. Two OpenAI "Physical Design Engineer" reqs reached the queue
  // because the "design engineer" whitelist below fires before any of the
  // silicon terms appear, and the title contains none of them.
  "physical design",
];
// Narrowed to your actual discipline. The wider set (brand, visual, content,
// research, design systems) was pulling roles you are not targeting and, in the
// case of research and visual craft, actively works against your positioning.
export const TITLE_INCLUDE = [
  "product design", "product designer",
  "ux design", "ux designer", "ux/ui", "ui/ux",
  "interaction design", "interaction designer",
  "experience designer", "human interface",
  "design engineer", "design technologist", "ux engineer",
  "model designer", "conversation designer", "prototyper",
  // Startup titles for the first design hire. "Founding Designer" names no
  // discipline, so without these it read as off-discipline and never arrived.
  "founding designer", "founding design", "first designer",
  // Titles that name the work rather than a ladder, common at startups and AI
  // companies.
  "ui designer", "ai designer", "creative technologist", "software designer",
  "design generalist", "generalist designer", "mobile designer", "app designer",
  "design systems designer", "design lead",
];
// Off-discipline titles that would otherwise slip through on a substring match
// (e.g. "Senior Brand Designer" contains neither, but "Product Design Manager"
// would have). Runs after TITLE_INCLUDE.
export const DISCIPLINE_EXCLUDE = [
  "brand", "visual", "content design", "ux writer", "writer",
  "communication", "marketing", "motion", "industrial",
  // Instructional design / L&D. "Learning Experience Designer" matches the
  // "experience designer" whitelist but is a different discipline entirely —
  // a Spotify "Digital Learning Experience Designer" req got in this way.
  "learning experience", "instructional",
];
// Research titles are off-discipline at most companies, but at the labs you
// actually wants (tier 1) a research-flavoured design role is one you'd take —
// you marked exactly such a role "Apply" before these filters existed. So the
// exclusion is tier-dependent rather than absolute. Research *engineering* and
// research *science* stay excluded everywhere via TITLE_EXCLUDE.
export const RESEARCH_TERMS = ["researcher", "research"];

/**
 * Which rungs are yours. Empty by default: the same "Senior" title is a stretch at
 * one company and a step down at another, and guessing on someone's behalf is how a
 * queue quietly stops showing them the job they wanted.
 */
export function isReachableLevel(title: string): boolean {
  const t = title.toLowerCase();
  // A founding role is titled by what it will become ("Founding Design Lead"),
  // not by the seniority it screens for. The years gate still applies to it.
  if (t.includes("founding") || t.includes("first designer")) return true;
  // "Member of Technical Staff" is a flat title, not the Staff rung.
  if (t.includes("member of technical staff")) return !LEVEL_EXCLUDE.some((x) => x !== "staff" && t.includes(x));
  return !LEVEL_EXCLUDE.some((x) => t.includes(x));
}

/**
 * Rules you have stated yourself, promoted from scorer hints to intake filters. The
 * scorer already reads your pass notes and nudges a number, but a rule you have
 * written down more than once should stop the role arriving rather than arrive with a
 * low score for you to re-decide every week.
 *
 * Empty until you set them, because this is the most personal part of the filter:
 * "I am not cleared for an engineer role" is a real rule for one person and nonsense
 * for the next.
 */
export function passesStatedRules(title: string, company: string): boolean {
  const t = (title || "").toLowerCase();
  const c = (company || "").toLowerCase();
  if (TITLE_EXCLUDE_EXTRA.some((x) => t.includes(x))) return false;
  if (
    COMPANY_LEVEL_EXCLUDE.some((x) => c.includes(x)) &&
    /\b(senior|sr\.?|staff|principal|lead)\b/.test(t)
  )
    return false;
  return true;
}

/**
 * Location filter. The boards return global listings, and which of them are
 * irrelevant to you depends on where you can work, so the list is yours to set and
 * empty until you do.
 */
export function isUsLocation(loc: string): boolean {
  if (LOCATION_EXCLUDE.length === 0) return true;
  const l = (loc || "").toLowerCase();
  return !LOCATION_EXCLUDE.some((x) => l.includes(x));
}

// Minimum years of experience, pulled from the job description. This is the
// single most reliable level signal a posting carries — titles lie, "4 years"
// does not. Returns the LOWEST year figure stated near "experience", since
// postings often list several ("4 years of X, 2 years of Y").
export function extractMinYoe(text: string): number | null {
  if (!text) return null;
  const plain = text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  const hits: number[] = [];
  const re = /(\d{1,2})\+?\s*(?:\+)?\s*years?(?:\s+of)?\s+(?:[a-z,\- ]{0,40})?experience/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 20) hits.push(n);
  }
  return hits.length ? Math.min(...hits) : null;
}

// Pull a salary range out of whatever the extractor returned for comp. It answers
// in prose as often as in figures ("Not disclosed. The posting includes a pay
// transparency block…"), and storing that prose in compRange would put a
// paragraph on the queue card. Only a real figure counts, so the card can keep
// saying nothing when the posting genuinely says nothing.
const COMP_RANGE =
  /\$\s?(?:[\d,]{5,}|\d{2,3}(?:\.\d)?\s?k)(?:\s*(?:-|–|—|to)\s*\$?\s?(?:[\d,]{5,}|\d{2,3}(?:\.\d)?\s?k))?/gi;

export function extractCompRange(text: unknown): string | null {
  if (!text) return null;
  const t = String(text);
  const hits = t.match(COMP_RANGE);
  if (!hits) return null;
  const best = hits.reduce((a, b) => (b.length > a.length ? b : a)).trim();
  // Guard against picking up equity figures or stray numbers: a real base
  // salary reads as six figures with a thousands separator, or as "$180k".
  if (!/\d{2,3},\d{3}|\d{2,3}(?:\.\d)?\s?k/i.test(best)) return null;
  return best.replace(/\s+/g, " ");
}

// LinkedIn writes the employer's legal or divisional name ("Amazon Web Services
// (AWS)", "Google LLC", "Meta Platforms"), while the boards write the plain one.
// Dedupe, the company filter chips, contact matching and the portal-limit lookup
// all key on an exact company string, so an un-normalised variant silently
// fragments every one of them — an AWS role would not dedupe against the same
// role from Amazon's board, and would miss Amazon's reapplication cooldown.
const COMPANY_ALIASES: [RegExp, string][] = [
  [/^amazon\b.*|^aws\b.*/i, "Amazon"],
  [/^alphabet\b.*|^google\b.*/i, "Google"],
  [/^meta\b.*|^facebook\b.*/i, "Meta"],
  [/^microsoft\b.*/i, "Microsoft"],
  [/^apple\b.*/i, "Apple"],
  [/^netflix\b.*/i, "Netflix"],
  [/^bytedance\b.*|^tiktok\b.*/i, "TikTok"],
  [/^uber\b.*/i, "Uber"],
  [/^linkedin\b.*/i, "LinkedIn"],
  [/^adobe\b.*/i, "Adobe"],
];

export function canonicalCompany(raw: string): string {
  // Strip the corporate suffixes that only ever appear in alert mail.
  const cleaned = (raw || "")
    .replace(/\s*\((?:aws|inc|llc|ltd|corp)\.?\)\s*$/i, "")
    .replace(/,?\s+(?:inc|llc|ltd|corp|co)\.?\s*$/i, "")
    .trim();
  for (const [pattern, canonical] of COMPANY_ALIASES) {
    if (pattern.test(cleaned)) return canonical;
  }
  return cleaned;
}

// Employer-level exclusions, used only by the company-blind paths: scanning a named
// company's own board cannot surface the wrong employer, but a title search across
// every employer can, and does — one pass returned a defense consultancy, a law firm,
// a hotel group and a paint manufacturer.
//
// These are whole categories that no amount of title filtering catches, because the
// titles are identical to the ones you want. The list below is a starting point, not
// a statement of anyone's values: add to it with SEARCH_COMPANY_EXCLUDE, or empty it
// entirely with SEARCH_COMPANY_EXCLUDE_NONE=1 if you want everything through.
export const COMPANY_EXCLUDE = [
  // Defense and government services.
  "booz allen", "lockheed", "raytheon", "northrop", "leidos", "general dynamics",
  "l3harris", "mitre", "saic", "caci", "peraton", "battelle",
  // Aerospace and launch, which the defense list above does not catch by name.
  "spacex", "space exploration", "relativity space", "blue origin", "anduril",
  "rocket lab", "firefly aerospace", "stoke space", "ursa major",
  // Staffing and outsourcing. Note the distinction: body-shops are blocked, while
  // design-led consultancy arms are not on this list, because those are real design
  // jobs and the objection is to being placed rather than hired.
  "capgemini", "infosys", "cognizant", "wipro",
  "tata consultancy", "kpmg", "pwc", "ernst & young", "mckinsey",
  "insight global", "robert half", "aerotek", "randstad", "kforce", "apex systems",
  "motion recruitment", "staffing", "recruiting", "talent solutions",
  // Law firms. "LLP" is the reliable tell.
  " llp", "llp ", "law firm",
];

// Cheap guard for company-blind sources. Deliberately does NOT judge quality —
// a mid-tier product company is a legitimate result when the whole point is more
// options; this only removes categories you have already ruled out.
export function isExcludedCompany(company: string): boolean {
  const c = ` ${(company || "").toLowerCase()} `;
  return COMPANY_EXCLUDE.some((x) => c.includes(x));
}

// Only these count as a research title you would actually take: the work is
// design research, not research that happens to sit near a product.
export const RESEARCH_ALLOWED = ["design research", "research designer", "design researcher"];

export function isDesignRole(title: string, allowResearch = false): boolean {
  const t = title.toLowerCase();
  if (RESEARCH_TERMS.some((x) => t.includes(x))) {
    // "Research" in a title is a reject unless the title is explicitly design
    // research. A UX Researcher req is a different discipline and a different
    // ladder, and it was getting in on the word "experience".
    if (!allowResearch) return false;
    if (TITLE_EXCLUDE.some((x) => t.includes(x))) return false;
    return RESEARCH_ALLOWED.some((x) => t.includes(x)) && isReachableLevel(t);
  }
  // Exclusions run FIRST. "Design engineer" is a real design title, but it also
  // appears in Mechanical Design Engineer and Actuator Design Engineer, so the
  // whitelist only applies to titles that survive the exclusion pass.
  if (TITLE_EXCLUDE.some((x) => t.includes(x))) return false;
  if (DISCIPLINE_EXCLUDE.some((x) => t.includes(x))) return false;
  if (t.includes("design engineer")) return true;
  // A bare "Designer" or "Senior Designer" is the whole title at many startups.
  if (/^(senior |sr\.? )?designer$/.test(t.replace(/[^a-z. ]/g, "").trim())) return true;
  // AI labs give everyone "Member of Technical Staff"; the discipline follows it.
  if (t.includes("member of technical staff") && t.includes("design")) return true;
  // Founding titles come in any order ("Design Lead (Founding)").
  if (t.includes("founding") && t.includes("design")) return true;
  return TITLE_INCLUDE.some((k) => t.includes(k));
}
