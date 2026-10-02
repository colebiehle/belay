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

/**
 * The stage chip's colour, as one ramp, the blue twin of STATUS_COLORS on the
 * applications page.
 *
 * The chip was a flat zinc at every stage while its identical twin on the pipeline
 * row was graded by depth. Same control, same row shape, half the information: at a
 * glance you could not tell a name you had only identified from one you had already
 * talked to.
 */
export const CONTACT_STAGE_COLORS: Record<string, string> = {
  Identified: "bg-zinc-800 text-zinc-300",
  Drafted: "bg-accent-blue/15 text-accent-blue",
  Sent: "bg-accent-blue/30 text-accent-blue",
  Connected: "bg-accent-blue/45 text-black",
  Replied: "bg-accent-blue/65 text-black",
  Scheduled: "bg-accent-blue/85 text-black",
  // The point of the whole surface: a conversation that actually happened.
  Chatted: "bg-accent-blue text-black",
  // Not a failure, just over. Same treatment as a rejection on the pipeline.
  "No response": "bg-zinc-900 text-zinc-600",
};

/** Sent, and the ball is with them. Used to decide who needs a nudge. */
/** Sent, and the ball is with them. */
export const WAITING_STAGES: string[] = ["Sent", "Connected"];

/**
 * How long to wait before a nudge is worth sending. A single follow-up around this
 * mark is where most replies to cold outreach come from, which is the lever nothing
 * in the old surface tracked.
 */
export const NUDGE_AFTER_DAYS = 8;

/**
 * LinkedIn's connection-note limit. Hard, not advisory: the draft is useless if it
 * does not fit, so the prompt is given the number and the UI counts against it.
 */
export const CONNECT_NOTE_LIMIT = 300;
