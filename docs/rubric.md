# Mise - /hone rubric v1 (frozen 2026-11-07, do not edit mid-run)

Artifact: the playable web game in `mise/` judged from real in-game screenshots (desktop 1440 and phone 390)
plus a factual feature sheet. Done = every hard gate passes AND weighted council score >= 8.5.

## Hard gates (code checker `tests/check.py`, overrides the judges)

- G1 no JS errors across all flows
- G2 slop_check 0 blockers
- G3 no horizontal overflow at 320/390/768/1024/1440 (menus and game HUD)
- G4 no emoji in source; no purple/violet/indigo colours
- G5 all 8 recipes completable in first person and third person; auto-play quality >= 0.8
- G6 a restaurant day finishes with guests served for chef, server and owner, in both views
- G7 AA contrast for every token text pair
- G8 keyboard-only play advances a cooking step
- G9 UTF-8 without BOM or mojibake
- G10 progress saves and reloads
- G11 runs from file:// with storage blocked

## Soft criteria (council)

- C1 Cooking feel and ASMR craft (w=0.25): 4 = flat icons and progress bars, no sense of food or hands; 7 = recognisable food, tools and hands, clear tactile actions; 10 = every action reads as a physical, satisfying moment (slices separate, sizzle, steam, plating) a player would describe to a friend.
- C2 Visual design and polish (w=0.25): 4 = generic template UI or inconsistent palette; 7 = clean, consistent, restrained palette with one accent, deliberate type; 10 = professional, distinctive, every screen aligned and calm, nothing clipped, no AI-template look.
- C3 Usability and clarity (w=0.20): 4 = unclear what to do next, cramped phone layout; 7 = current step and next action obvious on desktop and phone; 10 = a stranger knows the goal, the input and their progress in 3 seconds on every screen.
- C4 Depth versus genre (w=0.20): 4 = one mode, shallow loop; 7 = home and restaurant modes, roles, upgrades; 10 = clearly broader than Cooking Mama plus Diner Dash: two views, three roles, management (menu, prices, stock, staff, upgrades) all visible and coherent.
- C5 Chill vibe (w=0.10): 4 = stressful or noisy; 7 = calm palette and pacing; 10 = cozy atmosphere (light, weather, room details) that invites slow play.
