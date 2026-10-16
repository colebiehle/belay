# Send to Belay

A Chrome extension that sends the LinkedIn page you are on to Belay's People queue,
with a mutual and tags that stay set until you change them.

## Install (once)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** and pick this `extension/` folder.
4. Pin it: the puzzle-piece icon in the toolbar, then the pin next to Send to Belay.

Belay must be running on http://localhost:3001.

## Use

1. On a LinkedIn page of people, open the popup and set the **mutual** (whose
   connections these are) and any **tags**. They stay set across pages.
2. Press **Send this page**, or **⌥⇧B** without opening the popup.
3. Go to the next page and send again. You don't need to wait: pages queue up in
   Belay and are read two at a time; cards appear in People → Queue as each one
   finishes.

Pages that load more as you scroll (connections, a company's People tab) are
scrolled to the end before sending, so one send takes the whole list. Search results
are one page per send.

It only acts when you press it. It never moves between pages on its own: LinkedIn
restricts accounts that automate browsing, and one click per page reads as normal use.
