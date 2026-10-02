/**
 * What a job site is *for*, not how good it is.
 *
 * Companies carry S through D because they genuinely rank against each other, and the
 * tier changes what the tool does: it gates what enters the queue. Sites gate nothing,
 * and the tracked ones do different jobs, so a quality tier would assert a ranking
 * that does not exist. Broad is not better than Startups, it is a different question.
 *
 * The hints are written for the classifier as much as for the UI: they are what a
 * model is given when it has to place a site from nothing but its URL.
 */
export const SITE_CATEGORIES: { key: string; hint: string }[] = [
  {
    key: "Broad",
    hint: "A general job search across most employers and industries. You go here to search, not to browse one slice.",
  },
  {
    key: "Aggregators",
    hint: "Indexes other boards and applicant tracking systems rather than hosting its own listings. Coverage is the selling point.",
  },
  {
    key: "Startups",
    hint: "Early-stage and venture-backed companies specifically, including accelerator and VC portfolio boards.",
  },
  {
    key: "Design",
    hint: "Design, UX and creative roles specifically, including portfolio communities and professional design bodies.",
  },
  {
    key: "Fellowships",
    hint: "Fellowships, residencies and programs you apply to with a deadline rather than a rolling job posting.",
  },
  {
    key: "Accelerators",
    hint: "Accelerators, incubators and grant programs for people starting something, such as Y Combinator or an open grant round.",
  },
  {
    key: "University",
    hint: "University or alumni recruiting, credential-gated to students and graduates of a school.",
  },
];

export const SITE_CATEGORY_KEYS = SITE_CATEGORIES.map((c) => c.key);
