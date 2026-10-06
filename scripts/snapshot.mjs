#!/usr/bin/env node
// Screenshot every page of Belay as it looks right now, so each design iteration
// has a record to compare against.
//
//   npm run snapshot -- before-rebrand
//
// Writes to private/snapshots/<date>-<label>/ (gitignored, because the shots show
// your real data). The dev server must be running. Every write the pages attempt
// is blocked, so taking a snapshot never changes anything.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BELAY_URL ?? "http://localhost:3001";
const label = (process.argv[2] ?? "snapshot").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
const day = new Date().toISOString().slice(0, 10);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "private", "snapshots", `${day}-${label}`);
mkdirSync(out, { recursive: true });

// One real role and one real person, so the panels are captured with content.
const one = (sql) => {
  try {
    return execFileSync("sqlite3", [path.join(root, "belay.db"), sql], { encoding: "utf8" }).trim().split("\n")[0] || null;
  } catch {
    return null;
  }
};
const appId = one("SELECT a.id FROM Application a JOIN Job j ON j.id = a.jobId WHERE j.verdict = 'Apply' ORDER BY a.rowid DESC LIMIT 1;");
const contactId = one("SELECT id FROM Contact WHERE profileText IS NOT NULL OR notes IS NOT NULL LIMIT 1;");

const pages = [
  ["home", "/"],
  ["insights", "/insights"],
  ["applications-queue", "/applications"],
  ["applications-pipeline", "/applications?tab=pipeline"],
  ["applications-passed", "/applications?tab=passed"],
  ...(appId ? [["role-panel", `/applications?app=${appId}`]] : []),
  ["network-people", "/networking?tab=people"],
  ["network-queue", "/networking?tab=queue"],
  ...(contactId ? [["person-panel", `/networking?contact=${contactId}`]] : []),
  ["profile", "/profile"],
];

const browser = await chromium.launch();
for (const [width, suffix] of [
  [1440, ""],
  [390, "-mobile"],
]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route("**/api/**", (r) =>
    ["PATCH", "POST", "DELETE", "PUT"].includes(r.request().method()) ? r.abort() : r.continue(),
  );
  for (const [name, url] of pages) {
    await page.goto(BASE + url, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1200); // panels slide in, the graph settles
    await page.screenshot({ path: path.join(out, `${name}${suffix}.png`), fullPage: true });
  }
  await page.close();
}
await browser.close();
console.log(`Saved ${pages.length * 2} screenshots to ${path.relative(root, out)}/`);
