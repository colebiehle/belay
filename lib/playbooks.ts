import { prisma } from "@/lib/prisma";

// Map of Profile/Application material kinds to the playbook kind(s) most
// relevant to refining or generating content for that surface. When a prompt
// builder asks for playbooks relevant to a given Material kind, we pull the
// matching playbook content and inject it as context.
const KIND_TO_PLAYBOOKS: Record<string, string[]> = {
  // Resume cells
  resume_strategy: ["playbook_resume_strategy"],
  resume_header: ["playbook_resume_strategy"],
  resume_summary: ["playbook_resume_strategy"],
  resume_experience: ["playbook_resume_strategy"],
  resume_education: ["playbook_resume_strategy"],
  resume_skills: ["playbook_resume_strategy"],
  resume_projects: ["playbook_resume_strategy", "playbook_portfolio_strategy"],
  // Portfolio cells
  portfolio_strategy: ["playbook_portfolio_strategy"],
  portfolio_hook: ["playbook_portfolio_strategy"],
  portfolio_case_studies: ["playbook_portfolio_strategy"],
  portfolio_about: ["playbook_portfolio_strategy"],
  // LinkedIn cells — content here often touches recruiter outreach
  linkedin_headline: ["playbook_recruiter_outreach", "playbook_resume_strategy"],
  linkedin_about: ["playbook_recruiter_outreach", "playbook_resume_strategy"],
  linkedin_post_templates: ["playbook_recruiter_outreach"],
  // Interview-adjacent cells
  behavioral_story: ["playbook_interview_prep"],
  interview_questions: ["playbook_interview_prep"],
  interview_notes: ["playbook_interview_prep"],
  thank_you_template: ["playbook_interview_prep"],
  // Application-cell kinds
  app_resume: ["playbook_resume_strategy"],
  app_coverLetter: ["playbook_recruiter_outreach"],
  app_qa: ["playbook_interview_prep"],
};

// Always-included playbooks — these get attached to every relevant prompt
// regardless of the specific material kind, because they're foundational.
const FOUNDATIONAL_PLAYBOOKS = ["playbook_ai_design_hiring"];

// All playbook kinds — used when a caller wants the whole hub of industry
// knowledge (not scoped to a specific material kind).
const ALL_PLAYBOOK_KINDS = [
  "playbook_resume_strategy",
  "playbook_portfolio_strategy",
  "playbook_recruiter_outreach",
  "playbook_networking",
  "playbook_interview_prep",
  "playbook_negotiation",
  "playbook_ai_design_hiring",
  "playbook_application_cadence",
  "playbook_market_state",
];

/**
 * Returns playbook content relevant to a given material kind, formatted as a
 * prompt block. Returns empty string if no playbooks exist yet (so the prompt
 * stays clean before the deep dive has been run).
 */
export async function playbookBlock(materialKind: string | undefined): Promise<string> {
  const targeted = materialKind ? (KIND_TO_PLAYBOOKS[materialKind] ?? []) : [];
  const wanted = Array.from(new Set([...targeted, ...FOUNDATIONAL_PLAYBOOKS]));
  if (wanted.length === 0) return "";

  const rows = await prisma.material.findMany({
    where: { kind: { in: wanted } },
    select: { kind: true, content: true },
  });
  if (rows.length === 0) return "";

  const sections = rows
    .filter((r) => r.content && r.content.trim().length > 0)
    .map((r) => `[${r.kind}]\n${r.content!.slice(0, 4000)}`);
  if (sections.length === 0) return "";

  return `Industry knowledge hub (their playbooks — durable synthesized wisdom from deep research; these are the authoritative source on what's happening in their field):\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Returns ALL non-empty playbooks formatted as a prompt block. Use this for
 * surfaces that aren't scoped to a single material kind (Content topic
 * surfacer, Visual strategy, Opportunities discover) where the agent needs
 * broad industry awareness rather than topic-specific advice. Each playbook
 * is truncated more aggressively here since we're pulling many at once.
 */
export async function fullPlaybookBlock(maxPerPlaybook = 1500): Promise<string> {
  const rows = await prisma.material.findMany({
    where: { kind: { in: ALL_PLAYBOOK_KINDS } },
    select: { kind: true, content: true },
  });
  if (rows.length === 0) return "";

  const sections = rows
    .filter((r) => r.content && r.content.trim().length > 0)
    .map((r) => `[${r.kind}]\n${r.content!.slice(0, maxPerPlaybook)}`);
  if (sections.length === 0) return "";

  return `Industry knowledge hub (full playbook set — their synthesized read on the field, drawn from deep research across senior recruiters, design leadership writing, recent landing-AI-role retros, and market reporting. The authoritative source on what's happening, how people are thinking, and what's working. Let this inform your reasoning):\n\n${sections.join("\n\n---\n\n")}`;
}
