/**
 * The Profile page's structure: which questions there are, in which section, and
 * what each section is for. Shared by the page and by /api/profile/fill, so the
 * fill only ever proposes answers to questions the page shows.
 *
 * Two stores sit behind it. A `cell` is a Material row by kind (the long context
 * every prompt reads: positioning, voice, what you are looking for). An `answer` is
 * an AnswerBank row by questionKey (the short facts forms ask for). The page treats
 * them the same; only the write goes to a different table.
 *
 * Sections are by what the answers are for, not by which table they live in. The
 * old page was the answer bank's tags (Background, Written prompts, Voluntary...)
 * under the context cells, 41 questions in one column with no way to tell where to
 * start or what any of it did.
 */

export type Question = {
  store: "cell" | "answer";
  key: string;
  // Short, for the field's label and the fill's review rows.
  label: string;
  // A line under the label: what to put, when the label alone does not say.
  hint?: string;
  // An example answer, as the field's placeholder.
  example?: string;
  // Long answers get a taller field.
  long?: boolean;
  // Never proposed by the fill from a resume: eligibility, comp and disclosure are
  // yours to state, and a wrong guess there is the kind that matters.
  noFill?: boolean;
};

export type Section = { id: string; title: string; usedFor: string; questions: Question[] };

const cell = (key: string, label: string, rest: Omit<Question, "store" | "key" | "label"> = {}): Question => ({
  store: "cell",
  key,
  label,
  long: true,
  ...rest,
});
const answer = (key: string, label: string, rest: Omit<Question, "store" | "key" | "label"> = {}): Question => ({
  store: "answer",
  key,
  label,
  ...rest,
});

export const SECTIONS: Section[] = [
  {
    id: "basics",
    title: "Basics",
    usedFor: "How Belay introduces you, and the first lines of every form.",
    questions: [
      answer("full_name", "Full name", { example: "Alex Rivera" }),
      answer("headline", "Headline", { hint: "One line: who you are professionally.", example: "Product designer working on AI tools" }),
      answer("pronouns", "Pronouns", { example: "they/them", noFill: true }),
      answer("location", "Location", { example: "Pittsburgh, PA" }),
      answer("years_experience", "Years of experience", { example: "4" }),
      answer("education", "Education", { example: "MHCI, Carnegie Mellon, 2024" }),
    ],
  },
  {
    id: "links",
    title: "Links",
    usedFor: "Pasted into almost every form, and into outreach drafts.",
    questions: [
      answer("linkedin_url", "LinkedIn", { example: "https://www.linkedin.com/in/…" }),
      answer("portfolio_url", "Portfolio", { example: "https://…" }),
      answer("portfolio_password", "Portfolio password", { noFill: true }),
      answer("github_url", "GitHub"),
      answer("booking_link", "Booking link", { hint: "Calendly or cal.com, for scheduling calls.", example: "https://calendly.com/…" }),
    ],
  },
  {
    id: "story",
    title: "Your story",
    usedFor: "Quoted in every draft: cover letters, form answers and outreach. Worth doing properly once.",
    questions: [
      cell("positioning", "Positioning", {
        hint: "What you do and who for, in your own words.",
        example: "I design AI products that people can trust, from research through shipped UI…",
      }),
      cell("career_arc", "Career arc", {
        hint: "The throughline of what you have built, and where it is going.",
        example: "Research at a lab, then founding designer at a startup, now looking for…",
      }),
      cell("personality", "How you work", { hint: "What you are like to work with." }),
      answer("proudest_work", "Proudest work", { hint: "What you are proudest of, and why.", long: true }),
      answer("ai_experience", "Designing with AI", { hint: "Your experience designing AI products or with AI tools.", long: true }),
      cell("voice", "Voice", {
        hint: "How you write, and what you never want to sound like.",
        example: "Plain and specific. Never 'passionate', never 'leverage'…",
      }),
    ],
  },
  {
    id: "looking",
    title: "What you're looking for",
    usedFor: "The queue scores every role against these. Vague answers make a vague queue.",
    questions: [
      cell("search_target_roles", "Target roles", { hint: "The titles worth your time.", example: "Product Designer, Senior Product Designer, Design Engineer…" }),
      cell("search_target_problems", "Problems", { hint: "The work you actually want to be doing." }),
      cell("search_target_companies", "Companies", { hint: "What makes a company worth applying to." }),
      cell("search_work_environment", "Environment", { hint: "What you need around you to do your best work." }),
      cell("search_skills_to_learn", "To learn", { hint: "What you want the next role to teach you." }),
      cell("anti_patterns", "Not for you", { hint: "The kinds of roles and places that are not a fit." }),
    ],
  },
  {
    id: "flags",
    title: "Green and red flags",
    usedFor: "Decide what reaches your queue: hard skips are filtered out before you see them.",
    questions: [
      cell("search_positive_signals", "Green flags", { hint: "What in a posting makes it a yes.", example: "Design works with research; ships weekly; AI is the product…" }),
      cell("search_negative_signals", "Red flags", { hint: "What in a posting makes it a no." }),
      cell("search_hard_skips", "Hard skips", { hint: "What you would never apply to, whatever else it offered.", example: "Principal or Staff titles; 8+ years required; crypto…" }),
    ],
  },
  {
    id: "logistics",
    title: "Logistics and pay",
    usedFor: "The questions every form asks. Decide once, then reuse.",
    questions: [
      answer("onsite_pref", "Remote or onsite", { example: "Hybrid or onsite in SF, NYC or Pittsburgh" }),
      answer("relocation", "Relocation", { example: "Yes, for the right role" }),
      answer("start_date", "Start date", { example: "Two weeks' notice" }),
      answer("salary_expectation", "Salary expectation", { hint: "A negotiating position, not a fact.", noFill: true }),
      answer("salary_current", "Current pay", { hint: "Only if asked, and only if you choose to share.", noFill: true }),
      answer("work_authorization", "Authorized in the US", { hint: "Fill these yourself: a wrong answer here is the kind that matters.", noFill: true }),
      answer("sponsorship", "Needs sponsorship", { noFill: true }),
      answer("visa_status", "Visa status", { noFill: true }),
    ],
  },
  {
    id: "answers",
    title: "Form answers",
    usedFor: "Reusable answers to the questions forms keep asking. Copy one, adapt the first line.",
    questions: [
      answer("about_me", "About you", { hint: "The short bio forms ask for.", long: true }),
      answer("why_leaving", "Why you're looking", { long: true }),
      answer("why_this_company", "Why this company", { hint: "A reusable spine; the company-specific line goes on top.", long: true }),
      answer("how_heard", "How you heard", { noFill: true }),
      answer("referral", "Referred by", { noFill: true }),
      answer("demographics", "Demographics", { hint: "What you choose to disclose. Blank means you skip it.", noFill: true }),
      answer("veteran_disability", "Veteran or disability", { hint: "Blank means you skip it.", noFill: true }),
    ],
  },
];

export const KNOWN_ANSWER_KEYS = new Set(
  SECTIONS.flatMap((s) => s.questions.filter((q) => q.store === "answer").map((q) => q.key)),
);

/** A question's id across both stores, for the fill's proposal and the page's drafts. */
export const qid = (q: Pick<Question, "store" | "key">) => `${q.store}:${q.key}`;
