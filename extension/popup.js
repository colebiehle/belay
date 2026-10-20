import { BELAY, getSettings, networkFilter, sendTab } from "./shared.js";

const $ = (id) => document.getElementById(id);
const STARTERS = ["mentor", "peer"];
let known = [];
let names = [];

// The starter tags first, then the rest alphabetically, as Belay orders them.
const order = (list) => {
  const all = [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  return [...STARTERS.filter((t) => all.includes(t)), ...all.filter((t) => !STARTERS.includes(t)).sort()];
};

async function save(patch) {
  await chrome.storage.local.set(patch);
  render();
}

async function render() {
  const { mutual, tags } = await getSettings();
  if (document.activeElement !== $("mutual")) $("mutual").value = mutual;

  const box = $("tags");
  box.replaceChildren();
  for (const t of order([...STARTERS, ...known, ...tags])) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = t;
    b.setAttribute("aria-pressed", String(tags.includes(t)));
    b.onclick = () => save({ tags: tags.includes(t) ? tags.filter((x) => x !== t) : order([...tags, t]) });
    box.append(b);
  }
  const add = document.createElement("button");
  add.className = "chip new";
  add.textContent = "+ tag";
  add.onclick = () => {
    const input = document.createElement("input");
    input.className = "chip-input";
    input.placeholder = "new tag";
    input.maxLength = 28;
    const commit = () => {
      const t = input.value.trim().toLowerCase();
      if (t) save({ tags: order([...tags, t]) });
      else render();
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") render();
    };
    input.onblur = commit;
    add.replaceWith(input);
    input.focus();
  };
  box.append(add);

  // A mutual on a 3rd+ search is a contradiction: those people are not anyone you
  // know's connections. Say so before it tags a page of strangers with their name.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const net = tab?.url ? networkFilter(tab.url) : [];
  const warn = $("warn");
  warn.hidden = !(mutual && net.includes("O"));
  warn.textContent = "This search includes 3rd+, who can't be your mutual's connections. Use 2nd only, or clear the mutual.";
  $("send").disabled = !tab?.url?.startsWith("https://www.linkedin.com/");
  if ($("send").disabled) $("send").textContent = "Open a LinkedIn page";
}

async function loadBelay() {
  try {
    const contacts = await fetch(`${BELAY}/api/contacts`).then((r) => r.json());
    names = contacts.map((c) => c.name).sort();
    known = contacts.flatMap((c) => {
      try {
        return JSON.parse(c.relationship || "[]");
      } catch {
        return [];
      }
    });
    $("people").replaceChildren(
      ...contacts.map((c) => {
        const o = document.createElement("option");
        o.value = c.name;
        o.label = c.company || "";
        return o;
      }),
    );
    $("conn").textContent = "";
  } catch {
    $("conn").textContent = "Belay isn't running";
  }
  render();
}

async function loadJobs() {
  try {
    const { jobs } = await fetch(`${BELAY}/api/people/capture`).then((r) => r.json());
    const list = $("jobs");
    list.replaceChildren(
      ...(jobs.length ? jobs.slice(0, 6) : [null]).map((j) => {
        const li = document.createElement("li");
        if (!j) {
          li.innerHTML = '<span class="t">Nothing sent yet</span>';
          return li;
        }
        const t = document.createElement("span");
        t.className = "t";
        t.textContent = j.source || j.title;
        const s = document.createElement("span");
        s.className = "s" + (j.status === "failed" ? " fail" : "");
        s.textContent =
          j.status === "done"
            ? `${j.added} new${j.updated ? ` · ${j.updated} updated` : ""}`
            : j.status === "failed"
              ? "failed"
              : j.status === "reading"
                ? "reading…"
                : "waiting";
        if (j.error) s.title = j.error;
        li.append(t, s);
        return li;
      }),
    );
  } catch {
    // Belay not running; the header already says so.
  }
}

$("mutual").addEventListener("change", (e) => {
  const v = e.target.value.trim();
  // Only a name from your network, so the mutual matches a real contact.
  save({ mutual: names.includes(v) ? v : "" });
});
$("clear-mutual").onclick = () => save({ mutual: "" });

$("send").onclick = async () => {
  const btn = $("send");
  btn.disabled = true;
  btn.textContent = "Scrolling and capturing…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const job = await sendTab(tab);
    btn.textContent = job.people ? `Sent ${job.people} people ✓` : "Sent ✓";
    loadJobs();
  } catch (e) {
    btn.textContent = e.message || "Could not send";
  }
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = "Send this page";
  }, 2500);
};

loadBelay();
loadJobs();
setInterval(loadJobs, 3000);
