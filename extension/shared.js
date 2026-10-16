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
    return { url: location.href.split("?")[0], title: document.title, html: null };
  }
  let lastHeight = 0;
  for (let i = 0; i < 25; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await wait(700);
    const more = [...document.querySelectorAll("button")].find((b) =>
      /show more results/i.test(b.textContent || ""),
    );
    if (more && !more.disabled) {
      more.click();
      await wait(1200);
      continue;
    }
    const h = document.body.scrollHeight;
    if (h === lastHeight) break;
    lastHeight = h;
  }
  const main = document.querySelector("main") || document.body;
  return { url: location.href, title: document.title, html: main.outerHTML };
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
  return d.job;
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
