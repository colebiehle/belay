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
  // A list of entries rather than one answer (education, shipped work): each entry
  // has these fields, and the answer is stored as a JSON array of them.
  fields?: ListField[];
};

export type ListField = { key: string; label: string; example?: string; wide?: boolean };
export type ListEntry = Record<string, string>;

/** A list question's stored answer, read leniently: anything that is not a JSON array is no entries. */
export function parseEntries(raw: string | null | undefined): ListEntry[] {
  try {
    const v = JSON.parse(raw ?? "");
    return Array.isArray(v) ? v.filter((e) => e && typeof e === "object") : [];
  } catch {
    return [];
  }
}

/** One entry as a line, for the fill's review and for prompts. */
export const entryLine = (fields: ListField[], e: ListEntry) =>
  fields
    .map((f) => e[f.key]?.trim())
    .filter(Boolean)
    .join(", ");

export const EDUCATION_FIELDS: ListField[] = [
  { key: "school", label: "School", example: "Carnegie Mellon University" },
  { key: "degree", label: "Degree", example: "Master of Human-Computer Interaction" },
  { key: "date", label: "Graduated", example: "Aug 2026" },
  { key: "gpa", label: "GPA", example: "4.0 / 4.0" },
];

export const SHIPPED_FIELDS: ListField[] = [
  { key: "title", label: "What it is", example: "Belay, a job-search tool" },
  { key: "url", label: "Link", example: "https://…" },
  { key: "note", label: "One line", example: "Designed and built it; used daily", wide: true },
];

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
      answer("full_name", "Full name", { hint: "Your legal name, as forms want it.", example: "Alex Rivera" }),
      answer("preferred_name", "Preferred name", { hint: "What you go by, if different.", example: "Alex" }),
      answer("headline", "Headline", { hint: "One line: who you are professionally.", example: "Product designer working on AI tools" }),
      answer("pronouns", "Pronouns", { example: "they/them", noFill: true }),
      answer("email", "Email", { example: "you@example.com" }),
      answer("phone", "Phone", { example: "(555) 555-5555", noFill: true }),
      answer("location", "Location", { example: "Pittsburgh, PA" }),
      answer("address", "Mailing address", { hint: "Some forms ask for a full address.", example: "Street, city, state, ZIP", noFill: true }),
      answer("current_role", "Current title and company", { example: "Adjunct Design Instructor, Carnegie Mellon University" }),
      answer("years_experience", "Years of experience", { example: "4" }),
      answer("education", "Education", {
        hint: "Most recent first. Forms get the first entry's school, degree and date.",
        fields: EDUCATION_FIELDS,
      }),
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
      answer("shipped_work", "Shipped work", {
        hint: "Live things people can open: an app, an extension, a product site. For \"link something you've shipped\".",
        fields: SHIPPED_FIELDS,
      }),
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
      answer("preferred_locations", "Cities you'd work in", { example: "SF Bay Area, New York, Seattle, Pittsburgh, remote" }),
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
    id: "writein",
    title: "For app questions",
    usedFor:
      "Raw material for \"why us\" and \"tell us about\" questions. A sentence or two each, in your own words: Belay builds answers from these, so they sound like you and say something no one else could.",
    questions: [
      answer("design_belief", "Something you believe", { hint: "About design, or AI in design, that not everyone would agree with.", long: true, noFill: true }),
      answer("ai_in_your_work", "How you actually use AI", { hint: "In your own design process, concretely: tools, where it helps, where it doesn't.", long: true, noFill: true }),
      answer("teaching_insight", "What teaching has shown you", { hint: "Something you've seen teaching design right now that surprised you.", long: true, noFill: true }),
      answer("product_admired", "A product you admire", { hint: "And one thing you'd change about it. Shows your taste.", long: true, noFill: true }),
      answer("hardest_decision", "Your hardest design decision", { hint: "What you traded off, what happened, what you'd do again.", long: true, noFill: true }),
      answer("setback", "A project that didn't go to plan", { hint: "What went wrong and what you changed after.", long: true, noFill: true }),
      answer("next_growth", "What you want to get better at", { hint: "In your next role, specifically.", long: true, noFill: true }),
      answer("beyond_resume", "Something a resume can't show", { hint: "A side project, a habit, how you work with people.", long: true, noFill: true }),
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
