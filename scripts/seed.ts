/**
 * First-run seed: the questions, not the answers.
 *
 * Everything here is generic. The answer bank gets the questions application forms
 * actually ask, blank; the profile cells get their headings with no content; and the
 * company and site lists get a short starter set so the first screen shows what the
 * grid does. Those fourteen companies are a placeholder, not a recommendation: drag
 * them, re-tier them, delete the ones you do not care about.
 *
 *   npx tsx scripts/seed.ts
 *
 * Safe to re-run. Existing rows are left alone.
 */
// The app's client, so the seed uses the same libsql adapter and the same
// DATABASE_URL resolution rather than a second definition that can drift.
import { prisma } from "../lib/prisma";

const QUESTIONS: { key: string; q: string; tags: string }[] = [
  { key: "full_name", q: "Your full name", tags: "background,critical" },
  { key: "headline", q: "One line: who you are professionally", tags: "background,critical" },
  { key: "pronouns", q: "Pronouns", tags: "background" },
  { key: "portfolio_url", q: "Portfolio URL", tags: "links" },
  { key: "linkedin_url", q: "LinkedIn URL", tags: "links" },
  { key: "github_url", q: "GitHub URL", tags: "links" },
  { key: "portfolio_password", q: "Portfolio password (if any)", tags: "links" },
  { key: "work_authorization", q: "Are you legally authorized to work in the US?", tags: "eligibility,critical" },
  { key: "sponsorship", q: "Will you now or in the future require sponsorship?", tags: "eligibility,critical" },
  { key: "visa_status", q: "Visa status / work permit details", tags: "eligibility" },
  { key: "salary_expectation", q: "Salary expectations", tags: "comp,critical" },
  { key: "salary_current", q: "Current compensation (if asked, and if you choose to answer)", tags: "comp" },
  { key: "start_date", q: "Earliest start date / notice period", tags: "logistics" },
  { key: "location", q: "Current location", tags: "logistics" },
  { key: "relocation", q: "Are you willing to relocate?", tags: "logistics" },
  { key: "onsite_pref", q: "Remote / hybrid / onsite preference", tags: "logistics" },
  { key: "years_experience", q: "Years of professional experience", tags: "background" },
  { key: "education", q: "Education", tags: "background" },
  { key: "how_heard", q: "How did you hear about this role?", tags: "written" },
  { key: "referral", q: "Were you referred? By whom?", tags: "written" },
  { key: "why_this_company", q: "Why do you want to work here? (adapt per company)", tags: "written" },
  { key: "why_leaving", q: "Why are you looking to leave your current role?", tags: "written" },
  { key: "about_me", q: "Tell us about yourself / short bio", tags: "written" },
  { key: "proudest_work", q: "What work are you proudest of, and why?", tags: "written" },
  { key: "booking_link", q: "Booking link (cal.com, Calendly) for scheduling chats", tags: "links" },
  { key: "demographics", q: "Demographic questions, what you choose to disclose", tags: "voluntary" },
  { key: "veteran_disability", q: "Veteran / disability status", tags: "voluntary" },
];

// The cells every prompt reads. Seeded empty, with the question in the title, so the
// first visit to Settings reads as something to fill in rather than a blank grid.
const CELLS: { kind: string; title: string }[] = [
  { kind: "positioning", title: "Positioning: what you do and who for, in your own words" },
  { kind: "personality", title: "Personality: how you work, and what you are like to work with" },
  { kind: "career_arc", title: "Career arc: the throughline of what you have built" },
  { kind: "voice", title: "Voice: how you write, and what you never want to sound like" },
  { kind: "anti_patterns", title: "Anti-patterns: the roles and places that are not for you" },
  { kind: "search_target_roles", title: "Target roles: the titles worth your time" },
  { kind: "search_target_problems", title: "Target problems: the work you want to be doing" },
  { kind: "search_target_companies", title: "Target companies: what makes one worth applying to" },
  { kind: "search_work_environment", title: "Work environment: what you need to do your best work" },
  { kind: "search_positive_signals", title: "Green flags: what makes a posting worth a yes" },
  { kind: "search_negative_signals", title: "Red flags: what makes a posting a no" },
  { kind: "search_hard_skips", title: "Hard skips: what you will never apply to" },
  { kind: "search_skills_to_learn", title: "Skills to learn: what you want the next role to teach you" },
];

// A starter tier list, not a recommendation. Fourteen companies a product designer
// would plausibly look at, there so the first screen shows what the grid does rather
// than asking you to type 36 names before anything works. Drag them, re-tier them,
// delete the ones you do not care about. The ordering is what drives the queue, so it
// is worth making it yours early.
const COMPANIES: { name: string; tier: number; domain: string; careersUrl: string }[] = [
  { name: "Figma", tier: 1, domain: "figma.com", careersUrl: "https://www.figma.com/careers/" },
  { name: "Anthropic", tier: 1, domain: "anthropic.com", careersUrl: "https://www.anthropic.com/jobs" },
  { name: "Apple", tier: 1, domain: "apple.com", careersUrl: "https://jobs.apple.com/en-us/search?team=design-DESGN" },
  { name: "OpenAI", tier: 1, domain: "openai.com", careersUrl: "https://openai.com/careers/search/?l=design" },
  { name: "Google", tier: 1, domain: "google.com", careersUrl: "https://www.google.com/about/careers/applications/jobs/results/?q=designer" },
  { name: "Notion", tier: 2, domain: "notion.so", careersUrl: "https://www.notion.com/careers" },
  { name: "Adobe", tier: 2, domain: "adobe.com", careersUrl: "https://careers.adobe.com/us/en/c/design-jobs" },
  { name: "Microsoft", tier: 2, domain: "microsoft.com", careersUrl: "https://careers.microsoft.com/v2/global/en/search?keywords=designer" },
  { name: "Meta", tier: 2, domain: "meta.com", careersUrl: "https://www.metacareers.com/jobs?roles[0]=Design" },
  { name: "Airbnb", tier: 2, domain: "airbnb.com", careersUrl: "https://careers.airbnb.com/" },
  { name: "Stripe", tier: 2, domain: "stripe.com", careersUrl: "https://stripe.com/jobs/search?query=design" },
  { name: "Perplexity", tier: 3, domain: "perplexity.ai", careersUrl: "https://www.perplexity.ai/hub/careers" },
  { name: "Miro", tier: 3, domain: "miro.com", careersUrl: "https://miro.com/careers/open-positions/" },
  { name: "Canva", tier: 3, domain: "canva.com", careersUrl: "https://www.lifeatcanva.com/en/jobs/" },
];

// Four boards that do four different jobs. The LinkedIn URL is a plain search on
// purpose: yours should be a saved one with your own titles, location and date
// filters baked in, which is the whole point of tracking a site rather than a domain.
const SITES: { name: string; url: string; domain: string; category: string }[] = [
  { name: "LinkedIn", url: "https://www.linkedin.com/jobs/", domain: "linkedin.com", category: "Broad" },
  { name: "Hiring Cafe", url: "https://hiring.cafe", domain: "hiring.cafe", category: "Aggregators" },
  { name: "Wellfound", url: "https://wellfound.com/jobs", domain: "wellfound.com", category: "Startups" },
  { name: "Y Combinator", url: "https://www.workatastartup.com", domain: "ycombinator.com", category: "Startups" },
];

async function main() {
  let added = 0;
  for (const q of QUESTIONS) {
    const existing = await prisma.answerBank.findUnique({ where: { questionKey: q.key } });
    if (existing) continue;
    await prisma.answerBank.create({
      data: { questionKey: q.key, question: q.q, answer: "", tags: q.tags },
    });
    added++;
  }

  let cells = 0;
  for (const [i, c] of CELLS.entries()) {
    const existing = await prisma.material.findFirst({ where: { kind: c.kind } });
    if (existing) continue;
    await prisma.material.create({ data: { kind: c.kind, title: c.title, content: "", position: i } });
    cells++;
  }

  let companies = 0;
  if ((await prisma.targetCompany.count()) === 0) {
    for (const [i, c] of COMPANIES.entries()) {
      await prisma.targetCompany.create({ data: { ...c, position: i } });
      companies++;
    }
  }

  let sites = 0;
  if ((await prisma.huntSite.count()) === 0) {
    for (const [i, s] of SITES.entries()) {
      await prisma.huntSite.create({ data: { ...s, position: i } });
      sites++;
    }
  }

  console.log(
    `Seeded ${added} question(s), ${cells} profile cell(s), ${companies} compan(ies) and ${sites} site(s).`,
  );
  console.log("Open /profile to fill in your name and headline, then Settings for the rest.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
