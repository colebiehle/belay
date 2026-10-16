import { sendTab } from "./shared.js";

// Alt+Shift+B: send the page without opening the popup, with whatever mutual and
// tags are set. The badge says it went (or did not).
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "send-page") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await sendTab(tab);
    flash(tab.id, "✓", "#3a3d42");
  } catch {
    flash(tab.id, "!", "#c4473a");
  }
});

function flash(tabId, text, color) {
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  chrome.action.setBadgeText({ text, tabId });
  setTimeout(() => chrome.action.setBadgeText({ text: "", tabId }), 2500);
}
