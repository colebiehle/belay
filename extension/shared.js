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
  // LinkedIn can keep an earlier view's <main> in the page, hidden, while it shows
  // the new one, so pick the visible candidate holding the most profile links.
  // LinkedIn's newer pages render inside a shadow root, which querySelectorAll does
  // not enter: everything below searches through shadow roots too.
  const deepAll = (sel, start = document) => {
    const out = [];
    const walk = (node) => {
      out.push(...node.querySelectorAll(sel));
      for (const el of node.querySelectorAll("*")) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(start);
    return out;
  };
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  // Some lists (a group's members) have no profile links at all, only rows, so the
  // score counts rows as well as links.
  const root = () => {
    const candidates = deepAll('[role="dialog"], .artdeco-modal, main, [role="main"]').filter(visible);
    const best = candidates
      .map((el) => [el, deepAll('a[href*="/in/"]', el).length * 10 + deepAll("li", el).length])
      .sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : document.body;
  };
  // Row text, for lists whose rows carry no profile link: each row's visible text
  // ("Reed Warner · 2nd / Economics and HOD Major @ Vanderbilt University"), kept
  // as it scrolls past.
  const texts = new Map();
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const rows = new Map();
  const collect = () => {
    for (const a of deepAll('a[href*="/in/"]', root())) {
      const href = (a.getAttribute("href") || "").split("?")[0];
      if (!href || rows.has(href)) continue;
      const row = a.closest("li") || a.parentElement?.parentElement?.parentElement || a;
      rows.set(href, row.outerHTML);
    }
    for (const li of deepAll("li", root())) {
      if (li.querySelector('a[href*="/in/"]')) continue;
      const t = (li.innerText || "").replace(/\n{2,}/g, "\n").trim();
      if (t.length < 12 || t.length > 600) continue;
      const key = t.slice(0, 120);
      if (!texts.has(key)) texts.set(key, `<li>${esc(t).replace(/\n/g, "<br>")}</li>`);
    }
  };
  const count = () => rows.size + texts.size;
  let still = 0;
  let lastCount = -1;
  for (let i = 0; i < 200 && still < 4; i++) {
    collect();
    const more = deepAll("button", root()).find((b) =>
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
    const links = deepAll('a[href*="/in/"]', root());
    const items = deepAll("li", root());
    const last = links[links.length - 1] || items[items.length - 1];
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
    still = count() === lastCount ? still + 1 : 0;
    lastCount = count();
  }
  collect();
  // What the page looked like, so a short capture can be diagnosed from Belay.
  const r = root();
  const anchors = deepAll("a[href]", r);
  const debug = {
    root: r === document.body ? "body" : r.tagName.toLowerCase() + (r.getAttribute("role") ? `[${r.getAttribute("role")}]` : ""),
    anchors: anchors.length,
    profileLinks: deepAll('a[href*="/in/"]', r).length,
    docProfileLinks: deepAll('a[href*="/in/"]').length,
    sampleHrefs: [...new Set(anchors.map((a) => (a.getAttribute("href") || "").split("?")[0]))].slice(0, 40),
    listItems: deepAll("li", r).length,
    textLength: (r.innerText || "").length,
    sampleText: (r.innerText || "").slice(0, 1500),
    href: location.href,
    topFrame: window === window.top,
    version: "1.6.0",
    mains: document.querySelectorAll("main").length,
    visibleMains: [...document.querySelectorAll("main")].filter(visible).length,
    iframes: [...document.querySelectorAll("iframe")].map((f) => (f.src || "(no src)").slice(0, 120)).slice(0, 10),
    shadowHosts: [...document.querySelectorAll("*")].filter((el) => el.shadowRoot).length,
    bodyText: (document.body.innerText || "").length,
    bodySample: (document.body.innerText || "").slice(0, 600),
  };
  const html =
    count() > 0 ? `<main>${[...rows.values()].join("\n")}<ul>${[...texts.values()].join("\n")}</ul></main>` : root().outerHTML;
  return { url: location.href, title: document.title, html, people: count(), debug };
}

export async function getSettings() {
  const { mutual = "", tags = [] } = await chrome.storage.local.get(["mutual", "tags"]);
  return { mutual, tags };
}

export async function sendTab(tab) {
  if (!tab?.url?.startsWith("https://www.linkedin.com/")) {
    throw new Error("Open a LinkedIn page first.");
  }
  // Every frame, not just the top page: LinkedIn's newer pages (a group's members)
  // draw inside an embedded frame, and the top page holds only a shell around it.
  // The frame that found the most people wins.
  const runs = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: capturePage });
  const results = runs.map((r) => r.result).filter(Boolean);
  const result = results.sort((a, b) => (b.people || 0) - (a.people || 0))[0];
  if (!result) throw new Error("Could not read this page.");
  result.debug = { ...(result.debug || {}), frames: results.map((r) => ({ url: (r.debug?.href || "").slice(0, 100), people: r.people })) };
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
