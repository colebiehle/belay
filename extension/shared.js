// Shared by the popup and the keyboard shortcut. Belay runs locally; nothing here
// talks to anything but localhost:3001 and the LinkedIn tab you are on.
export const BELAY = "http://localhost:3001";

// Runs inside the LinkedIn tab. Pages that load more as you scroll (connections, a
// company's People tab) are scrolled to the end first, pressing "Show more results"
// where LinkedIn shows one, so one send takes the whole list. Search results are
// paginated instead; those are one page per send. A profile page sends only its
// link, which Belay reads as one person.
export async function capturePage() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (/^\/in\/[^/]+\/?$/.test(location.pathname)) {
    return { url: location.href.split("?")[0], title: document.title, html: null, people: 1 };
  }
  // Long lists (group members, connections) keep only the rows near the screen in
  // the page, so capturing at the end gets the last screenful. Each person's row is
  // collected as it goes by instead, keyed by their profile link.
  // Where the list lives: an open dialog first (some group member lists open as an
  // overlay outside <main>), else the page's main area, else the whole body.
  const root = () =>
    [...document.querySelectorAll('[role="dialog"], .artdeco-modal')].find((d) => d.querySelector('a[href*="/in/"]')) ||
    document.querySelector("main") ||
    document.body;
  const rows = new Map();
  const collect = () => {
    for (const a of root().querySelectorAll('a[href*="/in/"]')) {
      const href = (a.getAttribute("href") || "").split("?")[0];
      if (!href || rows.has(href)) continue;
      const row = a.closest("li") || a.parentElement?.parentElement?.parentElement || a;
      rows.set(href, row.outerHTML);
    }
  };
  let still = 0;
  let lastCount = -1;
  for (let i = 0; i < 200 && still < 4; i++) {
    collect();
    const more = [...root().querySelectorAll("button")].find((b) =>
      /^\s*(show more results|show more|load more)\s*$/i.test(b.textContent || ""),
    );
    if (more && !more.disabled) {
      more.click();
      await wait(1500);
      still = 0;
      continue;
    }
    // Scroll the last row into view as well as the window: some lists scroll inside
    // their own container, which window.scrollTo never moves.
    const links = root().querySelectorAll('a[href*="/in/"]');
    const last = links[links.length - 1];
    last?.scrollIntoView({ block: "end" });
    // And the list's own scrolling box to its very bottom: an overlay's list loads
    // more only when that box, not the window, reaches the end.
    for (let el = last?.parentElement; el && el !== document.body; el = el.parentElement) {
      const o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
        break;
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
    await wait(1200);
    still = rows.size === lastCount ? still + 1 : 0;
    lastCount = rows.size;
  }
  collect();
  const html = rows.size > 0 ? `<main>${[...rows.values()].join("\n")}</main>` : root().outerHTML;
  return { url: location.href, title: document.title, html, people: rows.size };
}

export async function getSettings() {
  const { mutual = "", tags = [] } = await chrome.storage.local.get(["mutual", "tags"]);
  return { mutual, tags };
}

export async function sendTab(tab) {
  if (!tab?.url?.startsWith("https://www.linkedin.com/")) {
    throw new Error("Open a LinkedIn page first.");
  }
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: capturePage });
  const { mutual, tags } = await getSettings();
  const res = await fetch(`${BELAY}/api/people/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...result, mutual: mutual || null, tags }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Belay answered ${res.status}`);
  return { ...d.job, people: result.people };
}

// LinkedIn's search network filter: F is 1st, S is 2nd, O is 3rd+. All of it is
// relative to you, so a mutual's connections are never 3rd+.
export function networkFilter(url) {
  try {
    const raw = new URL(url).searchParams.get("network");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
