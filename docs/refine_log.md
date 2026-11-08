| time | mode | result | detail | judges |
|---|---|---|---|---|
| 2026-11-08 03:35 | council score | 7.7 | split: - | Pega-Vision=7.5, Pega-Thinking=7.7, GLM-5.3-Flash=8.8 |

## Round 0 - baseline (frozen rubric v1)
- Council (Pega-Vision, Pega-Thinking, GLM-5.3-Flash): **7.7** (C1 7, C2 7, C3 8, C4 9, C5 8). Gates: all pass except G8 (keyboard chop: knife pinned at the left edge after a stray click; test also clicked the canvas).
- Top judge fixes: visible physical feedback (slices, sizzle, steam, plate settle); phone HUD truncation and caption/hint overlap at 390 px; sparse third-person restaurant floor; flat steak art.
- Own review: duplicate "Oil sizzling" captions; order rail overlapping the recipe ticket while cooking in the restaurant.

## Round 1 - changes
- Particle layer in every cooking action (juice on each cut, oil spatter scaled by heat, flip burst, steam puffs, shell flecks on crack, settle rings when plating and when a yolk lands).
- Slices loosen after the first cut; steak drawn with fat cap, marbling, crust gradient.
- Keyboard chop: arrow tap snaps to the next uncut guide, hold glides; G8 test no longer clicks the canvas.
- Captions de-duplicated, one at a time on phones, placed above the instruction bar; instruction bar full width on phones; HUD title wraps to two lines, kicker ellipsis.
- Restaurant cooking: recipe ticket sits below the order rail (rail hidden on phones while cooking).
- Third-person floor: small rooms centre their tables, rug fits the tables, pendant light pools, plants, banquette, host stand, heat lamps and ticket rail on the pass.
| 2026-11-08 03:52 | council score | 7.75 | split: - | Pega-Vision=7.75, Pega-Thinking=7.2, GLM-5.3-Flash=8.5 |
| 2026-11-08 04:13 | council score | 8.45 | split: - | Pega-Vision=7.95, Pega-Thinking=8.45, GLM-5.3-Flash=9.3 |


## Round 1 - decision
- Council 7.75 (+0.05 over r0, below the +0.3 keep bar) but pairwise r1 beat r0 3-0 and r0 failed gate G8. Adopted r1 as best on the gate rule; counted as a stall on score (stalls = 1).

## Round 2 - changes
- Slices cut free on both sides tip over and lie flat in a row at the front of the board; plate glaze rim.
- Fry: ring of popping oil bubbles that scales with heat, smoke wisps on Medium/High.
- Shop: Pantry stock bars per category (terracotta under 4); shorter role cards; phone HUD kicker reads "DAY 1".
- Checker: all gates G1-G11 pass (G5 min quality 0.96, G6 six days, G8 step 1).
- Council **8.45** (C1 8, C2 9, C3 8, C4 9, C5 8; judges 7.95 / 8.45 / 9.3). Pairwise vs r1: B wins 2-0-1. **Kept** (+0.70). Stalls reset to 0.
- Fixes for r3: "tamagoyki" typo on cookbook CTA; generic sliders/checkboxes in settings; third-person whisk close-up is a sparse box; empty wood area and plain Pass strip on the top-down floor; jargon "Hands 0/2" / "Pass"; food texture (cucumber seeds, steak grain/char, soup gloss).

| round | change | gates | score | pairwise | kept? | note |
|---|---|---|---|---|---|---|
| r0 | baseline | G8 fail | 7.7 | - | best | |
| r1 | particles, keyboard snap, phone HUD, TP decor | all pass | 7.75 | 3-0 vs r0 | yes (gate rule) | stall 1 on score |
| r2 | fallen slices, oil bubbles, pantry bars, DAY kicker | all pass | 8.45 | 2-0-1 vs r1 | yes | |
| 2026-11-08 09:51 | council score | 8.3 | split: - | Pega-Vision=8.3, Pega-Thinking=7.2, GLM-5.3-Flash=8.3 |

## Round 3 - changes
- Cookbook button names the dish as on its card ("Cook the rolled omelette"); custom terracotta range sliders and checkboxes; plain words ("Pickup counter", "Ready to serve", "Carrying 1 of 2").
- Third-person whisk close-up: flour lumps and milk streak fade, swirls and bubbles build with progress, drips on the rim.
- Top-down floor: sideboard, window light, waiting bench, doormat; pickup counter with brushed steel, lamp glow, plate-spot outlines, plate stack.
- Food texture: cucumber seed ring and chambers; steak grain.
- Checker: all gates pass. Council **8.3** (C1 8, C2 8, C3 8, C4 9, C5 9; judges 8.3 / 7.2 / 8.3). Pairwise vs r2 (best): **B wins 3-0**.
- Decision: score 8.3 < keep bar 8.75 -> **not kept** by the frozen rule (stalls = 1). Note: the pairwise was unanimous for r3 and one judge's total dropped 1.25 between rounds, so the absolute score is noisy here. Round 4 is built on the r3 code (pairwise winner, all gates pass) and is judged against best r2 (score bar 8.75 + pairwise).
- r3 fixes: plating looks flat next to slicing and frying; phone floor too small to read; management state invisible during service; more physical feedback in every action.

| r3 | plain words, custom controls, whisk batter, floor decor, food texture | all pass | 8.3 | 3-0 vs r2 | no (score) | stall 1 |
| 2026-11-08 10:08 | council score | 8.55 | split: - | Pega-Vision=8.55, Pega-Thinking=7.4, GLM-5.3-Flash=9.28 |

## Round 4 - changes (built on r3 code, judged against best r2)
- Plating with weight: components on wooden prep boards in the tray, lifted with a shadow while dragged, ghost silhouettes at their spots, squash-and-settle bounce, crumbs and a settle ring on landing.
- Management during service: "<category> running low" at 3 portions and "<category> is out" at 0 float over the table when an order is taken.
- Phone floor plan: guests and server drawn about 25 percent larger in portrait.
- Checker: ALL GATES PASS (G1-G11; G5 min quality 0.96; G6 all six role/view days).
- Council **8.55** (C1 9, C2 8, C3 8, C4 9, C5 9; judges 8.55 / 7.4 / 9.28). Pairwise vs r2 (best): **B wins 3-0**.
- Decision: +0.10 over r2 is below the +0.3 keep margin, but r4 meets the rubric's **done** criterion (all gates pass and weighted >= 8.5), has the higher score and won the pairwise unanimously. r4 (code in hone/snap-r4, identical to the live files) is the delivered version.
- Stop reason: **done** (all gates + 8.55 >= 8.5) after 4 of 5 allowed rounds. Without the done bar this would also be the plateau point (two rounds without a +0.3 kept gain).

| r4 | weighted plating, in-service stock warnings, larger phone floor | all pass | 8.55 | 3-0 vs r2 | delivered (done bar) | stop: done |

### Final
Meets rubric v1 at 8.55 (3-judge council: Pega-Vision 8.55, Pega-Thinking 7.4, GLM-5.3-Flash 9.28), all gates pass. Baseline r0 was 7.7 with gate G8 failing.
| 2026-11-08 10:55 | council score | 4.45 | split: A3 | Pega-Vision=4.7, Pega-Thinking=3.8, GLM-5.3-Flash=4.95 |
| 2026-11-08 12:00 | council score | 8.3 | split: - | Pega-Vision=8.0, Pega-Thinking=8.8, GLM-5.3-Flash=8.45 |


## Sound hone (rubric hone/sound-rubric.md, frozen)
| round | change | gates S1-S5 | council | pairwise | kept | note |
|---|---|---|---|---|---|---|
| snd0 | baseline: one generic chop, mono hits, no room, audio starts only on some buttons | S1 fail, S2 fail, S4 fail | 4.45 | - | baseline | |

### Sound round 1 - changes
- Per-ingredient knife cuts (9 distinct), tool-specific stir loops (whisk, chopsticks, spatula, tongs, ladle), stereo decorrelated noise, small wooden-room reverb, high-shelf softening, master compressor, per-sound trims.
- First-gesture unlock anywhere + title hint "Best with headphones"; Settings "Listen" sampler.
- Gates S1-S5 all pass (S1-S4 on 5 independent renders; check.py G1-G11 pass).
- Council **8.30** (A1 8, A2 9, A3 8, A4 7, A5 10). Pairwise vs snd0: **B wins 3-0**. Kept (+3.85).
- r1 fixes: loop beds too loud vs one-shots, hot peaks near ceiling, narrow bells/coins/plate, randomise all one-shots, cucumber crunch buried under knock, chopsticks~ladle closest pair.

| snd1 | per-ingredient cuts, tool loops, room, unlock + sampler | all pass | 8.30 | 3-0 vs snd0 | yes | |
| 2026-11-08 12:15 | council score | 8.35 | split: - | Pega-Vision=8.35, Pega-Thinking=8.35, GLM-5.3-Flash=8.45 |
| 2026-11-08 12:28 | council score | 8.8 | split: - | Pega-Vision=8.65, Pega-Thinking=9.1, GLM-5.3-Flash=8.8 |

### Sound round 2 - changes
- Loop bus ducks to 60 % under every physical one-shot; loops about 3 dB lower; ambience lowpassed at 4.2 kHz.
- Per-hit level/pitch variation on every physical one-shot; knife trims fixed (keyed per ingredient); bells/coins/plate widened; cucumber crunch-forward; tofu squish tail; tamago body; chopsticks bowl clicks.
- Gates S1-S5 all pass (S3 9.1 dB, S4 0.131; 5 renders pass). check.py: first run hung in the headless restaurant-page setup (known WebAudio teardown quirk, no output for 60 min); killed and re-run: G1-G11 all pass.
- Council **8.35** (A1 8, A2 9, A3 8, A4 8, A5 9). Pairwise vs snd1: B wins 3-0.
- Decision: +0.05 is below the +0.3 keep margin and below the 8.5 done bar -> stall 1 of 2; best stays snd1. snd2 code kept as the working candidate for round 3 (it won the pairwise unanimously). Backup hone/snd2/audio.r2.js.

| snd2 | loop ducking, per-hit variation, level/width fixes | all pass | 8.35 | 3-0 vs snd1 | no (stall 1) | |

### Sound round 3 - changes
- osc() can pre-pan a partial; tonal hits rendered as detuned left/right pairs (order up width 0.11 -> 1.175, bubble 0.23 -> 0.446, garlic 0.23 -> 0.275, tomato 0.21 -> 0.405).
- Knife pairs separated: tamago squeak up to 2.3 kHz with spongy body, steak saw down to 1.5 -> 0.95 kHz, garlic crisp 2.2 kHz click + papery 6.5-9.5 kHz skin, tomato low wet body.
- Textures: crack gets variable shell-grain clouds and an egg-white slide; salt shake denser variable grain clouds + hiss swell (+2.3 dB); sizzle hiss band-limited (centroid 10 kHz -> 4918 Hz) with a warm oil body; boil denser stereo bubbles.
- Gates S1-S5 all pass (S3 9.6 dB, S4 0.1222; 4 renders: S4 0.107-0.138, S3 9.2-10.4 dB); check.py G1-G11 all pass.
- Council **8.80** (A1 9, A2 9, A3 8, A4 9, A5 9; judges 8.65 / 9.1 / 8.8). Pairwise vs snd1 (best): **B wins 3-0**; vs snd2: B wins 3-0.
- Decision: 8.80 >= 8.30 + 0.3 and pairwise win -> **kept**; also meets the done bar (all gates + >= 8.5). Backup hone/snd3/audio.r3.js (identical to live js/audio.js).
- Stop reason: **done** after 3 of 5 allowed rounds.
- Open judge notes (not required by the rubric): onion 0.20 and plate 0.24 stereo width still narrow-ish; chopsticks~spatula loops closest pair 0.122.

| snd3 | detuned stereo pairs, knife separation, denser crack/shake/sizzle | all pass | 8.80 | 3-0 vs snd1 | yes (done) | stop: done |

### Sound final
Sound meets the frozen sound rubric at 8.80 (3-judge council), all gates S1-S5 pass. Baseline snd0 4.45 -> snd1 8.30 -> snd2 8.35 (not kept) -> snd3 8.80. Verified through offline renders of the game's own audio code and spectrogram/metric analysis; no human listening test on real speakers or headphones.
| 2026-11-08 19:38 | council score | 3.4 | split: - | Pega-Vision=3.4, Pega-Thinking=2.0, GLM-5.3-Flash=4.3 |
| 2026-11-08 19:56 | council score | 9.55 | split: - | Pega-Vision=9.2, Pega-Thinking=10.0, GLM-5.3-Flash=9.55 |

## Navigation hone (rubric hone/nav-rubric.md, frozen) - trigger: "dont have back button"
| round | change | gates N1-N7 | council | pairwise | kept | note |
|---|---|---|---|---|---|---|
| nav0 | baseline: no back button in the kitchen (only Pause > Leave, no confirm); browser/phone Back leaves the site; Escape does nothing on menus | N1-N5 fail | 3.4 | - | baseline | |
| nav1 | back arrow in the kitchen top bar; leave-confirm only when work would be lost (exact loss text, safe default); browser/phone Back mirrors the button via one history guard entry (released on the title); Escape = Back on menus | all pass (nav_check N1-N6, check.py G1-G11) | 9.55 | 3-0 vs nav0 | yes (done) | stop: done |

- Judges 9.2 / 9.55 / 10.0. Remaining notes (not required by the rubric): Escape in an active kitchen pauses rather than opening the leave dialog; a service that has not taken any order yet still asks before leaving; a short text label on the phone back button.
- Verified by tests/nav_check.py in Edge (headless) over http and file://; not tested on a physical phone's hardware Back button.
