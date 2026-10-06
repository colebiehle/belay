/**
 * Where a person sits in the outreach process.
 *
 * Networking turned out to have the same shape as an application: a stage, a history
 * of how it got there, dated events, accumulating notes. So it gets the same
 * treatment — a queue grouped by stage rather than a directory to browse.
 *
 * The ordering matters for the same reason it does on the pipeline: the work is at
 * the top and the finished rows sink. "To reach out" is first because it is the only
 * group that needs an action from you today, and the state the whole thing exists to
 * empty — ten contacts added in May with zero messages ever marked sent is what this
 * replaces.
 */
export const CONTACT_STAGES = [
  "Identified",
  // "Drafted" exists because it is the exact state your search kept dying in: four
  // AI-written messages sat in the database for months, finished and unsent. A stage
  // that means "written, not sent" is the one that makes that visible.
  "Drafted",
  "Sent",
  // On LinkedIn, sending and being able to talk are two different events: the note
  // goes out with a connection request, and nothing else can happen until they
  // accept. Without this stage, everyone who accepted but has not written back looked
  // identical to everyone who ignored the request.
  "Connected",
  // A reply that never becomes a call is still a result, and the old set had nowhere
  // to put it. "Scheduling" is deliberately not a stage: three states for one
  // transition is too fine, and a booking link removes the back-and-forth anyway.
  "Replied",
  "Scheduled",
  "Chatted",
  "No response",
] as const;

export type ContactStage = (typeof CONTACT_STAGES)[number];

export const DEFAULT_STAGE = "Identified";

// The stage chip's look lives in components/StageChip.tsx, one neutral ramp shared
// with the pipeline's status chip. It used to be a blue ramp here and a pink twin
// on the applications page: the same control said "how far along" twice in two hues.

/**
 * Stages where a conversation is open but no call is booked: they have accepted,
 * so a follow-up is possible, and nothing is on the calendar yet. Sent is not one
 * of them, because until a request is accepted there is no one to follow up with.
 */
export const FOLLOW_UP_STAGES: string[] = ["Connected", "Replied"];

/**
 * The networking funnel's two to-do counts, shared by Home (via computeInsights) and
 * the Network page's header line, so "12 to message" on one is 12 on the other.
 * To message: found, not yet contacted. To schedule: talking, no call booked.
 */
export const TO_MESSAGE_STAGES: string[] = ["Identified", "Drafted"];
export const TO_SCHEDULE_STAGES: string[] = ["Connected", "Replied"];

/**
 * Days without a stage change or a recorded nudge before a row asks for another
 * message.
 */
export const NUDGE_AFTER_DAYS = 7;

/**
 * LinkedIn's connection-note limit. Hard, not advisory: the draft is useless if it
 * does not fit, so the prompt is given the number and the UI counts against it.
 */
export const CONNECT_NOTE_LIMIT = 300;

/**
 * What a person is to you, as tags rather than one rating.
 *
 * A single "strength" score answers none of the questions that come up later. Those
 * questions are always about a use: "who could refer me at Figma", "who do I ask
 * about craft", "who will tell me the portfolio is not working". One person can be
 * several of these at once, and a mentor who is no use for a referral is still a
 * mentor, so the tags are a set and the Network page filters on them.
 *
 * Only two starters. A longer fixed list was a guess at your categories; the rest
 * you add as they come up ("could refer", "figma alum"), and orderTags keeps the
 * starters first.
 */
export const RELATIONSHIP_TAGS = ["mentor", "peer"] as const;

export type RelationshipTag = (typeof RELATIONSHIP_TAGS)[number];

/**
 * Any set of tags in one stable order: the starter tags first, in their own order,
 * then your own tags alphabetically. The starters are a beginning, not a schema,
 * so a tag you add ("figma alum", "portfolio review") is as real as "mentor".
 */
export function orderTags(tags: Iterable<string>): string[] {
  const all = [...new Set([...tags].map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const starters = (RELATIONSHIP_TAGS as readonly string[]).filter((t) => all.includes(t));
  const own = all.filter((t) => !starters.includes(t)).sort();
  return [...starters, ...own];
}

/**
 * How close you are, which decides what you can ask. Three steps, not a scale:
 * cold means a stranger (no referral asks), warm means you have talked, close means
 * they would pick up the phone.
 */
export const WARMTH_LEVELS = ["cold", "warm", "close"] as const;

export type Warmth = (typeof WARMTH_LEVELS)[number];
