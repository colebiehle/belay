import { IMPORT_MAX_CHARS, compactPaste, normalizeLinkedInUrl } from "@/lib/people-import";
import { runImport } from "@/lib/people-import-run";

/**
 * The browser extension's backlog. Each "Send to Belay" click drops a page here and
 * returns at once, so you can keep moving through LinkedIn; pages are read two at a
 * time in the order sent, through the same import as the paste box, and the cards
 * (and their lookups) arrive as each one finishes.
 *
 * In memory: a restart drops pages still waiting. The last 50 jobs are kept so the
 * popup and the queue page can say what happened.
 */

export type CaptureJob = {
  id: string;
  url: string;
  title: string;
  status: "waiting" | "reading" | "done" | "failed";
  sentAt: string;
  found?: number;
  added?: number;
  updated?: number;
  source?: string;
  error?: string;
  debug?: unknown;
};

type Payload = { text: string; mutual: string | null; tags: string[] };

const jobs: CaptureJob[] = [];
const PART_CHARS = Math.min(15_000, IMPORT_MAX_CHARS - 5_000);
const payloads = new Map<string, Payload>();
let workers = 0;
const CONCURRENCY = 2;

export function enqueueCapture(input: {
  html?: string | null;
  // Already-compacted text, from the paste box when a paste is too long for one read.
  text?: string | null;
  // What the extension saw on the page, for diagnosing a short capture.
  debug?: unknown;
  url?: string | null;
  title?: string | null;
  mutual?: string | null;
  tags?: string[];
}): CaptureJob {
  const url = input.url ?? "";
  // A single profile is one person: send its link, which the import treats as one.
  const profile = normalizeLinkedInUrl(url);
  const text = input.text ?? (profile && !input.html ? profile : compactPaste({ html: input.html ?? "" }));
  const title = (input.title ?? "").replace(/\s*\|\s*LinkedIn\s*$/i, "").slice(0, 80) || "LinkedIn page";
  // A long list (a group's 2,000 members) is more than one read can take, so it is
  // split at line breaks into parts. Small ones: the read writes every person back
  // out with a fit score, and ~275 people a part (55,000 characters) ran past its
  // four-and-a-half minutes. ~75 a part finishes in about one.
  const parts = splitText(text, PART_CHARS);
  const made = parts.map((part, i) => {
    const job: CaptureJob = {
      id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      url,
      title: parts.length > 1 ? `${title} (part ${i + 1} of ${parts.length})` : title,
      status: "waiting",
      sentAt: new Date().toISOString(),
      debug: input.debug,
    };
    jobs.unshift(job);
    payloads.set(job.id, { text: part, mutual: input.mutual ?? null, tags: input.tags ?? [] });
    return job;
  });
  jobs.splice(60);
  pump();
  return made[0];
}

function splitText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if (cur.length + line.length + 1 > max && cur) {
      out.push(cur);
      cur = "";
    }
    cur += (cur ? "\n" : "") + line;
  }
  if (cur) out.push(cur);
  return out;
}

export function captureJobs(): CaptureJob[] {
  return jobs;
}

function pump() {
  while (workers < CONCURRENCY && jobs.some((j) => j.status === "waiting")) {
    workers++;
    void work();
  }
}

async function work() {
  try {
    for (;;) {
      // Oldest waiting first: the order you sent them.
      const job = [...jobs].reverse().find((j) => j.status === "waiting");
      if (!job) break;
      job.status = "reading";
      const p = payloads.get(job.id);
      try {
        const res = await runImport({ text: p?.text ?? "", mutual: p?.mutual, tags: p?.tags });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d.error) {
          // A part that ran out of time is split in half and both halves go back in
          // line, rather than losing those people.
          const text = p?.text ?? "";
          if (/too long/i.test(d.error ?? "") && text.length > 3_000) {
            const half = splitText(text, Math.ceil(text.length / 2) + 200);
            half.forEach((h, i) => {
              const retry: CaptureJob = {
                id: `${job.id}${i ? "b" : "a"}`,
                url: job.url,
                title: `${job.title} (retry ${i + 1} of ${half.length})`,
                status: "waiting",
                sentAt: new Date().toISOString(),
              };
              jobs.unshift(retry);
              payloads.set(retry.id, { ...(p as Payload), text: h });
            });
            job.status = "failed";
            job.error = "Too long; split in half and retried";
          } else {
            job.status = "failed";
            job.error = d.error ?? `HTTP ${res.status}`;
          }
        } else {
          job.status = "done";
          job.found = d.found;
          job.added = d.added;
          job.updated = d.updated;
          job.source = d.source;
        }
      } catch (e) {
        job.status = "failed";
        job.error = e instanceof Error ? e.message : String(e);
      } finally {
        payloads.delete(job.id);
      }
    }
  } finally {
    workers--;
  }
}
