/**
 * The pipeline stages, in one place.
 *
 * This list was declared five times — the applications page, RoleWorkspace, the
 * detail page, the export route and the funnel route — and they had drifted. Three
 * of the five omitted "Final round", which is where the most advanced application
 * in the search currently sits, so the dashboard undercounted it, the export left
 * it out, and the funnel could not see it. One of them filtered on "Deciding",
 * which no longer exists in any list and can never be selected.
 */
// Not `as const`: callers index into it with a status read back from the database,
// which is a plain string, and a literal union there costs a cast at every call site
// for no safety this app can use.
export const STATUSES: string[] = [
  "Applying",
  "Applied",
  "Screen",
  "Interviewing",
  "Final round",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
];

export type Status = string;

/** Sent and still alive: everything between the form going in and a decision. */
export const ACTIVE_STATUSES: string[] = [
  "Applied",
  "Screen",
  "Interviewing",
  "Final round",
  "Offer",
];

/** Reached at least a first conversation. Used to learn what produces traction. */
export const INTERVIEWING_STATUSES: string[] = [
  "Screen",
  "Interviewing",
  "Final round",
  "Offer",
  "Accepted",
];

/** Over, either way. */
export const CLOSED_STATUSES: string[] = ["Rejected", "Withdrawn", "Accepted"];

/**
 * Still open: accepted but not sent, plus everything sent and undecided.
 *
 * One definition for "how many roles am I actually running". The dashboard tile and
 * the Pipeline tab badge used to disagree — the tile counted ACTIVE_STATUSES while
 * the badge counted every row in the list, including a rejection — so the same list
 * reported two numbers depending on which page you were on.
 */
export const OPEN_STATUSES: string[] = ["Applying", ...ACTIVE_STATUSES];
