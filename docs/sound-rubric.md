# Mise - sound /hone rubric v1 (frozen 2026-11-08, do not edit mid-run)

Artifact: the synthesised ASMR sound of the Mise web game, judged from a factual sound sheet (what each
action plays, how it is built, measured loudness/stereo/spectral metrics) plus spectrogram sheets of every
offline-rendered sound. Done = every hard gate passes AND weighted council score >= 8.5.

## Hard gates (code: tests/audio_probe.py + tests/check.py, override the judges)

- S1 audio starts on the very first click or key press anywhere (AudioContext created and running)
- S2 no silent sound: every catalogue sound peaks above -30 dBFS; none clips (peak <= -1 dBFS)
- S3 loudness consistency: one-shot peaks within a 14 dB window
- S4 distinctness: no two sounds in the same group closer than 0.08 (spectral-envelope distance)
- S5 every existing game gate G1-G11 in tests/check.py still passes (no JS errors, no emoji/purple, file://)

## Soft criteria (council)

- A1 ASMR texture and realism (w=0.30): 4 = beeps and filtered noise bursts, reads as a retro game; 7 = each sound is recognisable (knife, egg, oil, water) with some body; 10 = layered close-mic textures (blade bite, crunch, board resonance, fat pops, glugs) a player would put on headphones for.
- A2 Variety and responsiveness (w=0.25): 4 = one sample per action regardless of food or tool; 7 = sounds follow player input (speed, heat, fill) and differ between key actions; 10 = per-ingredient and per-tool sounds (crisp cucumber vs soft tomato vs steak, whisk vs spoon), randomised so repeats never sound identical.
- A3 Space and intimacy (w=0.20): 4 = dry mono; 7 = stereo placement by station; 10 = close-mic intimacy with a small wooden-kitchen room, stereo width on every hit, foreground versus background depth.
- A4 Mix comfort (w=0.15): 4 = harsh peaks, some sounds inaudible next to others; 7 = balanced, nothing harsh; 10 = soothing, consistent loudness, soft high end, room beds and radio sit under the foreground.
- A5 Discoverability and control (w=0.10): 4 = sound may silently fail to start, no hint; 7 = starts on first interaction with volume controls; 10 = clear headphones hint, per-bus volumes, captions, a way to preview sounds.
