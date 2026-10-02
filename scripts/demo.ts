/**
 * Fill a database with example data so you can see what the app looks like in use.
 *
 * A job tracker is impossible to evaluate empty: the queue, the scoring, the stage
 * ramp and the activity chart all only mean something once there is something in
 * them. This writes a plausible search — a dozen roles waiting on a verdict, a few
 * applications at different stages, some people in the network, and enough history
 * for the chart to have a shape.
 *
 *   npx tsx scripts/demo.ts
 *
 * Everything in here is invented. The companies are real because their names are
 * public and a demo full of "Acme Corp" tells you nothing about how the thing reads,
 * but the role titles, salary bands, scores and every single person are made up. The
 * people in particular are fictional: do not take them for anyone.
 *
 * Run it against a throwaway database, not the one you are using:
 *
 *   DATABASE_URL=file:./demo.db npx prisma db push
 *   DATABASE_URL=file:./demo.db npx tsx scripts/seed.ts
 *   DATABASE_URL=file:./demo.db npx tsx scripts/demo.ts
 *   DATABASE_URL=file:./demo.db npm run dev
 */
import { prisma } from "../lib/prisma";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const QUEUE: {
  company: string; roleTitle: string; location: string; comp: string; exp: string;
  score: number; posted: number; headline: string; tags: string[];
}[] = [
  { company: "Figma", roleTitle: "Product Designer, AI", location: "San Francisco, CA", comp: "$170k-$230k", exp: "4+ yrs", score: 9, posted: 2,
    headline: "Design surfaces where generative tools sit inside the canvas, from first sketch to shipped feature.", tags: ["ai is the product", "design tools", "0-to-1", "prototyping"] },
  { company: "Anthropic", roleTitle: "Product Designer, Developer Platform", location: "San Francisco, CA", comp: "$200k-$275k", exp: "5+ yrs", score: 9, posted: 4,
    headline: "API and developer tooling surfaces: defining primitives for new model capabilities.", tags: ["ai is the product", "developer tools", "ships code"] },
  { company: "Notion", roleTitle: "Product Designer, Automations", location: "New York, NY", comp: "$165k-$215k", exp: "4+ yrs", score: 8, posted: 6,
    headline: "Workflow automation inside the editor, aimed at teams who have outgrown manual process.", tags: ["knowledge work", "workflow design", "research included"] },
  { company: "Stripe", roleTitle: "Product Designer, Dashboard", location: "Seattle, WA", comp: "$175k-$240k", exp: "5+ yrs", score: 7, posted: 3,
    headline: "The core merchant dashboard: concept, prototype and ship the surfaces operators live in.", tags: ["b2b fintech", "core surface", "prototyping named"] },
  { company: "Airbnb", roleTitle: "Interaction Designer, Guest", location: "San Francisco, CA", comp: "$160k-$210k", exp: "4+ yrs", score: 7, posted: 9,
    headline: "Booking and trip-planning flows across web and mobile, with heavy visual craft expectations.", tags: ["consumer", "visual craft", "motion"] },
  { company: "Perplexity", roleTitle: "Founding Product Designer", location: "San Francisco, CA", comp: "$180k-$250k", exp: "Not specified", score: 8, posted: 1,
    headline: "First design hire on a small team: scope is open and the work is defining what gets built.", tags: ["ai is the product", "0-to-1", "early-stage team"] },
  { company: "Adobe", roleTitle: "Senior Product Designer, Document Cloud", location: "San Jose, CA", comp: "$150k-$205k", exp: "6+ yrs", score: 5, posted: 21,
    headline: "Document workflows for enterprise customers, inside an established design system.", tags: ["enterprise", "design systems"] },
  { company: "Microsoft", roleTitle: "Product Designer, Copilot", location: "Redmond, WA", comp: "$145k-$195k", exp: "4+ yrs", score: 7, posted: 11,
    headline: "Assistant surfaces across Office, working alongside research and applied science.", tags: ["ai as a feature", "research included", "enterprise"] },
  { company: "Canva", roleTitle: "Product Designer, Creator Tools", location: "Remote, US", comp: "Not disclosed", exp: "3+ yrs", score: 6, posted: 14,
    headline: "Tools for people who make things for a living, on a team that ships weekly.", tags: ["creativity tools", "consumer"] },
  { company: "Miro", roleTitle: "Product Designer, Canvas", location: "Remote, US", comp: "$140k-$185k", exp: "4+ yrs", score: 6, posted: 34,
    headline: "Core canvas interactions for distributed teams: the primitives everything else sits on.", tags: ["collaboration", "core surface"] },
  { company: "Meta", roleTitle: "Product Designer, Generative Media", location: "Menlo Park, CA", comp: "$170k-$245k", exp: "5+ yrs", score: 7, posted: 7,
    headline: "Creation tools built on generative models, shipping to consumer surfaces at scale.", tags: ["ai is the product", "consumer", "scale"] },
  { company: "Apple", roleTitle: "Product Designer, Platform Experience", location: "Cupertino, CA", comp: "Not disclosed", exp: "5+ yrs", score: 6, posted: 17,
    headline: "System-level experiences across platforms, with an unusually high bar on visual detail.", tags: ["visual craft", "platform", "design systems"] },
];

const PIPELINE: { company: string; roleTitle: string; location: string; comp: string; status: string; applied: number; note?: string }[] = [
  { company: "Figma", roleTitle: "Product Designer, Design Systems", location: "San Francisco, CA", comp: "$170k-$225k", status: "Interviewing", applied: 18,
    note: "Portfolio review booked. They asked for the systems case study specifically." },
  { company: "Anthropic", roleTitle: "Product Designer, Claude", location: "San Francisco, CA", comp: "$205k-$280k", status: "Screen", applied: 9 },
  { company: "Stripe", roleTitle: "Product Designer, Growth", location: "New York, NY", comp: "$165k-$220k", status: "Applied", applied: 4 },
  { company: "Notion", roleTitle: "Product Designer, Mobile", location: "New York, NY", comp: "$160k-$210k", status: "Applying", applied: 1 },
  { company: "Airbnb", roleTitle: "Product Designer, Host Tools", location: "San Francisco, CA", comp: "$155k-$205k", status: "Rejected", applied: 31 },
];

// Entirely fictional people. Any resemblance to a real designer is accidental.
const PEOPLE: { name: string; company: string; title: string; stage: string; days: number; via?: string }[] = [
  { name: "Priya Raman", company: "Figma", title: "Design Manager", stage: "Chatted", days: 24 },
  { name: "Daniel Okafor", company: "Figma", title: "Product Designer", stage: "Replied", days: 11, via: "Priya Raman" },
  { name: "Mei Lindqvist", company: "Anthropic", title: "Design Lead", stage: "Sent", days: 12 },
  { name: "Tomas Herrera", company: "Notion", title: "Product Designer", stage: "Drafted", days: 3 },
  { name: "Aisha Bello", company: "Stripe", title: "Recruiter", stage: "Identified", days: 1 },
  { name: "Jonas Vrieze", company: "Perplexity", title: "Founding Engineer", stage: "No response", days: 40 },
];

async function main() {
  if ((await prisma.job.count()) > 0) {
    console.log("This database already has roles in it. Point DATABASE_URL at an empty one.");
    return;
  }

  for (const [i, q] of QUEUE.entries()) {
    await prisma.job.create({
      data: {
        company: q.company, roleTitle: q.roleTitle, jobUrl: `https://example.com/jobs/${i + 1}`,
        description: q.headline, location: q.location, compRange: q.comp, expRange: q.exp,
        fitScore: q.score, fitRationale: q.headline, greenFlags: "", redFlags: "", priority: "",
        datePosted: daysAgo(q.posted), dateFound: daysAgo(Math.max(0, q.posted - 1)),
        enrichedAt: daysAgo(Math.max(0, q.posted - 1)),
        queueEnrichment: JSON.stringify({ headline: q.headline, tags: q.tags }),
      },
    });
  }

  for (const [i, a] of PIPELINE.entries()) {
    const job = await prisma.job.create({
      data: {
        company: a.company, roleTitle: a.roleTitle, jobUrl: `https://example.com/jobs/p${i + 1}`,
        description: "", location: a.location, compRange: a.comp, expRange: "4+ yrs",
        fitScore: 8, fitRationale: "", greenFlags: "", redFlags: "", priority: "",
        verdict: "Apply", verdictAt: daysAgo(a.applied + 1), dateFound: daysAgo(a.applied + 2),
      },
    });
    const history = [{ status: "Applying", at: daysAgo(a.applied + 1).toISOString() }];
    if (a.status !== "Applying") history.push({ status: "Applied", at: daysAgo(a.applied).toISOString() });
    if (["Screen", "Interviewing", "Rejected"].includes(a.status))
      history.push({ status: "Screen", at: daysAgo(Math.max(1, a.applied - 6)).toISOString() });
    if (a.status === "Interviewing") history.push({ status: "Interviewing", at: daysAgo(3).toISOString() });
    if (a.status === "Rejected") history.push({ status: "Rejected", at: daysAgo(4).toISOString() });

    await prisma.application.create({
      data: {
        jobId: job.id, status: a.status,
        dateApplied: a.status === "Applying" ? null : daysAgo(a.applied),
        statusHistory: JSON.stringify(history),
        notes: a.note ?? null,
        interviewList: a.status === "Interviewing"
          ? JSON.stringify([{ id: "i1", label: "Portfolio review", at: new Date(Date.now() + 3 * 86_400_000).toISOString() }])
          : null,
      },
    });
  }

  for (const p of PEOPLE) {
    await prisma.contact.create({
      data: {
        type: "Target", name: p.name, company: p.company, title: p.title,
        linkedinUrl: `https://www.linkedin.com/in/${p.name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
        stage: p.stage, introVia: p.via ?? null,
        introVias: p.via ? JSON.stringify([p.via]) : null,
        dateAdded: daysAgo(p.days + 2),
        stageHistory: JSON.stringify([
          { stage: "Identified", at: daysAgo(p.days + 2).toISOString() },
          ...(p.stage === "Identified" ? [] : [{ stage: p.stage, at: daysAgo(p.days).toISOString() }]),
        ]),
        lastChat: p.stage === "Chatted" ? daysAgo(p.days) : null,
      },
    });
  }

  // Past outreach, so the chart shows networking days and mixed days rather than one
  // uniform colour. These people are closed out, so they do not clutter the queue.
  for (let d = 2; d < 50; d += 3) {
    await prisma.contact.create({
      data: {
        type: "Target", name: `Example Contact ${d}`, company: QUEUE[d % QUEUE.length].company,
        title: "Product Designer", stage: "No response", dateAdded: daysAgo(d + 1),
        stageHistory: JSON.stringify([
          { stage: "Identified", at: daysAgo(d + 1).toISOString() },
          { stage: "Sent", at: daysAgo(d).toISOString() },
          { stage: "No response", at: daysAgo(Math.max(1, d - 14)).toISOString() },
        ]),
      },
    });
  }

  // A scatter of decided roles so the activity chart has a shape rather than one
  // lonely square. They carry a verdict, so the queue never shows them.
  for (let d = 1; d < 60; d += 1) {
    if (d % 7 === 0 || d % 11 === 0) continue;
    const n = (d % 5) + 1;
    for (let k = 0; k < n; k++) {
      await prisma.job.create({
        data: {
          company: QUEUE[(d + k) % QUEUE.length].company, roleTitle: "Product Designer",
          jobUrl: `https://example.com/jobs/past-${d}-${k}`, description: "", location: "", compRange: "",
          expRange: "", fitScore: 4, fitRationale: "", greenFlags: "", redFlags: "", priority: "",
          verdict: k % 3 === 0 ? "Apply" : "Pass", verdictAt: daysAgo(d),
          dateFound: daysAgo(d + 1),
        },
      });
    }
  }

  console.log(`Demo data written: ${QUEUE.length} roles in the queue, ${PIPELINE.length} applications, ${PEOPLE.length} people.`);
  console.log("Every person in it is invented.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
