# Real-device Back checklist (manual)

The automated gates (tests/nav_check.py) run in headless Edge over http and file://. They simulate the
browser Back button with history.back(); they cannot drive a phone's hardware or gesture Back. Run these
by hand on real devices before calling system Back fully verified.

Devices: iPhone (Safari, swipe from the left edge), Android (Chrome, gesture nav and 3-button nav),
desktop Chrome/Firefox/Safari (Back button and Alt+Left / Cmd+[).

For each device, open https://juw12.github.io/mise/ in a fresh tab and check:

1. Title > Cook at home > system Back: returns to the title (not to the previous site).
2. On the title, system Back again: leaves the site normally (no trap, no second press needed).
3. Start a dish, do nothing, system Back: back on the cookbook without a question.
4. Start a dish, make one cut, system Back: the "Leave the kitchen?" dialog opens; system Back again keeps cooking with the cut still there.
5. Finish a dish: on the result card, system Back closes the card (plate visible); system Back again opens the cookbook.
6. Restaurant: serve one table, system Back: "Leave the service?" lists what is lost; Leave goes to the restaurant screen; reputation and day number are unchanged afterwards.
7. Finish a day: on the day summary, system Back closes it (closed floor visible); system Back again opens Manage.
8. Repeat 3-5 after rotating the phone, and once with the page opened from a saved file (file://) on desktop.

Record device, browser version, date and any step that differs in docs/refine_log.md.
