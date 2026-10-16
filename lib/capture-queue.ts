import { compactPaste, normalizeLinkedInUrl } from "@/lib/people-import";
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
};

type Payload = { text: string; mutual: string | null; tags: string[] };

const jobs: CaptureJob[] = [];
const payloads = new Map<string, Payload>();
let workers = 0;
const CONCURRENCY = 2;

export function enqueueCapture(input: {
  html?: string | null;
  url?: string | null;
  title?: string | null;
  mutual?: string | null;
  tags?: string[];
}): CaptureJob {
  const url = input.url ?? "";
  // A single profile is one person: send its link, which the import treats as one.
  const profile = normalizeLinkedInUrl(url);
  const text = profile && !input.html ? profile : compactPaste({ html: input.html ?? "" });
  const job: CaptureJob = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    url,
    title: (input.title ?? "").replace(/\s*\|\s*LinkedIn\s*$/i, "").slice(0, 80) || "LinkedIn page",
    status: "waiting",
    sentAt: new Date().toISOString(),
  };
  jobs.unshift(job);
  jobs.splice(50);
  payloads.set(job.id, { text, mutual: input.mutual ?? null, tags: input.tags ?? [] });
  pump();
  return job;
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
          job.status = "failed";
          job.error = d.error ?? `HTTP ${res.status}`;
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
