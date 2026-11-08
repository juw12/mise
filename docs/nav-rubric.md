# Mise navigation rubric v1 (frozen 2026-11-08)

Goal: the player can always get back, the way they expect, without losing work by accident.
Trigger: user report "dont have back button".

## Hard gates (tool-checked by tests/nav_check.py and tests/check.py; any fail = not done)
- N1 A visible back control (at least 40 x 40 px, in the top bar) on the cookbook, the restaurant screen, while cooking and during restaurant service, at 1440 px and 390 px wide.
- N2 Browser / phone Back never leaves the game: from the cookbook or restaurant screen it returns to the title, with a dialog open it closes the dialog, on a dish with no progress yet it returns to the cookbook.
- N3 Leaving mid-dish or mid-service asks first (a confirm dialog); "Stay" keeps the dish or service exactly where it was; "Leave" returns to the cookbook (home) or the restaurant screen (service).
- N4 Escape acts as Back on the cookbook and restaurant screens and closes dialogs.
- N5 Works from file:// (double-clicked index.html) with no errors; Back from the cookbook returns to the title.
- N6 No JS errors during navigation.
- N7 tests/check.py G1-G11 all pass (no regressions: recipes, restaurant days, keyboard play, overflow, contrast, no emoji, no purple, saves, file://).

## Soft criteria (0-10, anchors at 4 / 7 / 10)
- B1 Findability (weight 0.30): 4 = exit hidden behind another menu; 7 = visible back icon on every screen; 10 = same icon, same corner, same meaning everywhere, labelled for screen readers, obvious on a phone at first glance.
- B2 Safety (0.25): 4 = one tap loses a half-cooked dish or a service day; 7 = confirm before losing progress; 10 = confirm only when something would be lost, says exactly what is lost, the safe choice is the default, nothing is lost on Stay.
- B3 Consistency of destinations (0.20): 4 = Back goes to different places from the same screen depending on the route; 7 = one level up everywhere; 10 = a clear, predictable hierarchy (title > cookbook / restaurant > kitchen > dialog) shared by the on-screen button, Escape and system Back.
- B4 Phone and system Back (0.15): 4 = system Back exits the site; 7 = system Back moves within the game; 10 = system Back mirrors the on-screen back exactly, including dialogs, and never traps the player on the title screen.
- B5 Visual fit (0.10): 4 = cluttered or off-style; 7 = uses the existing icon buttons and tokens; 10 = calm, consistent with the HUD, no extra clutter, works at 320-1440 px.

Done = all gates pass AND weighted score >= 8.5.
