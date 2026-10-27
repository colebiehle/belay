// "Fill application": the standard fields of a job application, filled from your
// Belay Profile. Runs inside the page (chrome.scripting, every frame); everything it
// needs is in this one function, because that is how injected functions work.
//
// It fills only empty fields, only from facts you wrote in Profile, and never
// submits. It returns what it filled, the fields it could not match, and the
// write-in questions it found, for the popup to show.
export function fillForm(profile) {
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
  const clean = (t) => (t || "").replace(/\s+/g, " ").replace(/\*/g, "").trim();

  // A field's label: its <label>, aria-label(ledby), placeholder, or the nearest
  // question text around it. Greenhouse, Lever and Ashby all put the question in a
  // label or a heading next to the field.
  const labelOf = (el) => {
    const root = el.getRootNode();
    const bits = [];
    if (el.id) {
      const l = root.querySelector?.(`label[for="${CSS.escape(el.id)}"]`);
      if (l) bits.push(l.innerText);
    }
    const wrap = el.closest("label");
    if (wrap) bits.push(wrap.innerText);
    const by = el.getAttribute("aria-labelledby");
    if (by) for (const id of by.split(/\s+/)) bits.push(root.getElementById?.(id)?.innerText || "");
    bits.push(el.getAttribute("aria-label") || "", el.getAttribute("placeholder") || "");
    if (!clean(bits.join(" "))) {
      // The question sits in a container above the field.
      let box = el.parentElement;
      for (let i = 0; i < 4 && box; i++, box = box.parentElement) {
        const q = box.querySelector("label, legend, [class*=label], [class*=question], h3, h4");
        if (q && !q.contains(el)) {
          bits.push(q.innerText);
          break;
        }
      }
    }
    bits.push(el.getAttribute("name") || "");
    return clean(bits.join(" ")).slice(0, 300);
  };

  // Label patterns to Profile keys, most specific first.
  const RULES = [
    [/preferred (first )?name|nickname|name you go by/i, "preferred_name"],
    [/middle\s*name/i, "middle_name"],
    [/first\s*name|given name/i, "first_name"],
    [/last\s*name|surname|family name/i, "last_name"],
    [/full\s*name|^name\b|your name|legal name/i, "full_name"],
    [/e-?mail/i, "email"],
    [/phone|mobile|cell/i, "phone"],
    [/linkedin/i, "linkedin_url"],
    [/github/i, "github_url"],
    [/portfolio.*password|password.*portfolio/i, "portfolio_password"],
    [/portfolio|personal (web)?site|website|other (link|url)/i, "portfolio_url"],
    [/pronoun/i, "pronouns"],
    [/(street|mailing|home)?\s*address/i, "address"],
    [/current location|location|city|where (are you|do you) (based|live|located)/i, "location"],
    [/school|university|college|institution/i, "edu_school"],
    [/degree/i, "edu_degree"],
    [/graduat|grad(uation)? (date|year)/i, "edu_grad_date"],
    [/current (company|employer)|^company$|employer/i, "current_company"],
    [/current (title|role|position)|job title|^title$/i, "current_title"],
    [/authori[sz]ed to work|legally (authori[sz]ed|eligible)|eligible to work|right to work/i, "work_authorization"],
    [/sponsor/i, "sponsorship"],
    [/start date|available to start|earliest.*start|notice period/i, "start_date"],
    [/salary|compensation|pay (range|expectation)|expected (pay|comp)/i, "salary_expectation"],
    [/relocat/i, "relocation"],
    [/remote|hybrid|on-?site|in[- ]office/i, "onsite_pref"],
    [/years of (relevant |professional |design )?experience/i, "years_experience"],
    [/how did you hear|hear about (us|this)|referr(al|ed) source/i, "how_heard"],
  ];
  const keyFor = (label) => RULES.find(([re]) => re.test(label))?.[1] ?? null;
  // Your settled answers to this form's write-in questions, from the role in Belay.
  const norm = (t) => (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const saved = (profile.__answers || []).map((a) => ({ q: norm(a.question), a: a.answer }));
  const savedFor = (label) => {
    const l = norm(label);
    return saved.find((s) => s.q && (l === s.q || l.includes(s.q) || s.q.includes(l)))?.a ?? null;
  };

  // Set a value the way typing does, so React-controlled fields (Ashby, Greenhouse's
  // new forms) keep it instead of reverting.
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };
  // "Yes" or "No" out of a free-text answer ("Yes, US citizen", "No sponsorship needed").
  const yesNo = (answer) => {
    const t = (answer || "").toLowerCase();
    if (/^\s*(yes|y\b|true)/.test(t)) return "yes";
    if (/^\s*(no|n\b|false|none|not)/.test(t)) return "no";
    return null;
  };
  const pickOption = (options, answer) => {
    const yn = yesNo(answer);
    const a = (answer || "").toLowerCase();
    return (
      options.find((o) => yn && o.text.toLowerCase().trim().startsWith(yn)) ||
      options.find((o) => o.text && a && o.text.toLowerCase().includes(a)) ||
      options.find((o) => o.text && a && a.includes(o.text.toLowerCase().trim()) && o.text.trim().length > 2)
    );
  };

  const filled = [];
  const missing = [];
  const questions = [];
  const seenRadio = new Set();

  for (const el of deepAll("input, textarea, select")) {
    if (!visible(el) || el.disabled || el.readOnly) continue;
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "checkbox", "search", "image", "reset"].includes(type)) continue;
    const label = labelOf(el);
    if (!label) continue;

    if (type === "radio") {
      if (!el.name || seenRadio.has(el.name)) continue;
      seenRadio.add(el.name);
      const group = deepAll(`input[type=radio][name="${CSS.escape(el.name)}"]`);
      if (group.some((r) => r.checked)) continue;
      // The question is the group's legend or the text above the first option.
      const fs = el.closest("fieldset");
      const q = clean(fs?.querySelector("legend")?.innerText || "") || label;
      const key = keyFor(q);
      const answer = key && profile[key];
      if (!answer) {
        if (key) missing.push(q);
        continue;
      }
      const opts = group.map((r) => ({ el: r, text: labelOf(r) }));
      const pick = pickOption(opts, answer);
      if (pick) {
        pick.el.click();
        filled.push(q);
      }
      continue;
    }

    if ((el.value || "").trim()) continue;
    const key = keyFor(label);
    // A write-in is an open-ended answer: a text area, or a text field with a long
    // question that is not a yes/no one ("Are you authorized…", "Do you have…").
    // Dropdowns never are; their answers are chosen, not written.
    const yesNo = /^\s*(are|do|did|does|have|has|will|would|can|could|is|were|was)\b/i;
    const isWriteIn =
      el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && label.length > 60 && !yesNo.test(label));
    if (!key) {
      // Long questions without a Profile match are the write-ins: filled from your
      // saved answer when there is one, otherwise listed for the role chat.
      if (isWriteIn && /\?|why|describe|tell us|share|explain|what|how/i.test(label)) {
        const answer = savedFor(label);
        if (answer) {
          setValue(el, answer);
          filled.push(label);
        } else questions.push(label);
      }
      continue;
    }
    const answer = profile[key];
    if (!answer) {
      missing.push(label);
      continue;
    }
    if (el.tagName === "SELECT") {
      const opts = [...el.options].map((o) => ({ el: o, text: o.textContent || "" }));
      const pick = pickOption(opts, answer);
      if (pick) {
        el.value = pick.el.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filled.push(label);
      } else missing.push(label);
      continue;
    }
    setValue(el, answer);
    filled.push(label);
  }

  return { url: location.href, title: document.title, filled, missing, questions };
}
