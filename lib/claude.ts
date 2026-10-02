import { spawn, spawnSync } from "child_process";
import { jsonrepair } from "jsonrepair";

// Resolved once and cached — `which claude` is a fast sync lookup, but there's
// no reason to pay for it on every call.
let cachedBin: string | null = null;
export function claudeBin(): string {
  if (cachedBin) return cachedBin;
  try {
    const r = spawnSync("which", ["claude"], { encoding: "utf-8" });
    if (r.stdout.trim()) return (cachedBin = r.stdout.trim());
  } catch {}
  return (cachedBin = "/opt/homebrew/bin/claude");
}

// Spawn the claude CLI ASYNCHRONOUSLY and resolve with its stdout. This MUST
// stay async: `next dev` runs as a single Node process with one event loop, so
// the old spawnSync calls blocked the entire server (all navigation + every
// other request) for the full duration of the LLM call — up to 25 minutes for
// the deep dive. spawn() keeps the event loop free so concurrent requests are
// served while Claude runs. On timeout we SIGKILL the child and resolve with
// whatever was captured so far (matching the old "return stdout, never throw"
// contract).
export type ClaudeResult = { text: string; timedOut: boolean };

function runClaude(args: string[], input: string, timeoutMs: number): Promise<ClaudeResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    let timedOut = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ text: stdout.trim(), timedOut });
    };

    const child = spawn(claudeBin(), args, { stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGKILL"); } catch {}
      finish();
    }, timeoutMs);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.on("error", finish);
    child.on("close", finish);

    // The child may exit before we finish writing (e.g. it errors immediately);
    // swallow the resulting EPIPE so it doesn't crash the process.
    child.stdin.on("error", () => {});
    child.stdin.write(input);
    child.stdin.end();
  });
}

export function callClaude(prompt: string, timeoutMs = 120_000): Promise<string> {
  return runClaude(["-p"], prompt, timeoutMs).then((r) => r.text);
}

// Same call, but reports whether the run was killed by the timeout. Callers that
// summarise results for the UI need this: a timed-out run returns partial or empty
// stdout, which is indistinguishable from "the model found nothing" unless asked.
export function callClaudeDetailed(prompt: string, timeoutMs = 120_000): Promise<ClaudeResult> {
  return runClaude(["-p"], prompt, timeoutMs);
}

// Constraint prepended to every callClaudeWithTools invocation. Without this,
// Claude tends to try spawning parallel sub-agents (via the Task tool) to
// parallelize research — but sub-agent dispatch requires an interactive
// permission grant that doesn't exist in non-interactive -p mode. Result:
// Claude builds a workflow, hits the gate, and returns a meta-explanation
// instead of doing the actual research. The constraint here forces direct
// tool calls in the current turn.
const NO_SUBAGENTS_CONSTRAINT = `IMPORTANT EXECUTION CONSTRAINT: You are running in non-interactive mode. Do NOT use the Task tool, the Agent tool, or any sub-agent dispatch mechanism — those require an interactive permission grant that can't happen here, and trying to use them will silently abort the run. Do all work yourself, directly, using only the tools explicitly granted to you below. If parallelism would help, fake it by making multiple tool calls in sequence rather than spawning agents.

`;

// Call Claude with specific built-in tools enabled (e.g. "WebSearch", "WebFetch").
// Tools must be a non-empty list. We use --allowed-tools (not --tools) because
// in non-interactive -p mode, --tools restricts the available set but doesn't
// grant *permission* to call them — Claude declines and returns immediately
// without using any tool. --allowed-tools both restricts AND grants permission,
// which is what we want for unattended agent runs.
export function callClaudeWithTools(
  prompt: string,
  tools: string[],
  timeoutMs = 240_000,
  maxTurns = 5,
): Promise<string> {
  return runClaude(
    ["-p", "--allowed-tools", tools.join(","), "--max-turns", String(maxTurns)],
    NO_SUBAGENTS_CONSTRAINT + prompt,
    timeoutMs,
  ).then((r) => r.text);
}

export function extractJson<T>(raw: string, kind: "object" | "array" = "object"): T | null {
  if (!raw) return null;
  const pattern = kind === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = raw.match(pattern);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Claude occasionally emits malformed JSON (stray braces, trailing commas,
    // unescaped quotes). Fall back to jsonrepair before giving up.
    try {
      return JSON.parse(jsonrepair(match[0])) as T;
    } catch {
      return null;
    }
  }
}
