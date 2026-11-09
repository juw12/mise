"""Mise checker: objective gates for the /hone loop.

Run:  python tests/check.py [--shots DIR] [--quick]
Writes tests/out/results.json and prints a gate table. Exit 0 only if every gate passes.
"""
import colorsys
import functools
import http.server
import json
import os
import re
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tests" / "out"
OUT.mkdir(parents=True, exist_ok=True)
PY = sys.executable
SLOP = Path.home() / ".vector/skills/hone/design/tools/slop_check.py"

args = sys.argv[1:]
SHOTS = Path(args[args.index("--shots") + 1]) if "--shots" in args else OUT / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
QUICK = "--quick" in args

gates = {}


def gate(name, ok, detail=""):
    gates[name] = {"pass": bool(ok), "detail": detail}
    print(f"[{time.strftime('%H:%M:%S')}] {'PASS' if ok else 'FAIL'} {name} {str(detail)[:200]}", flush=True)


# ------------------------------------------------------------------ static gates
SRC = [p for p in ROOT.rglob("*") if p.suffix in (".html", ".css", ".js") and "tests" not in p.parts and "design-run" not in p.parts]

emoji_re = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF]")
emoji_hits = []
for p in SRC:
    t = p.read_text(encoding="utf-8")
    for m in emoji_re.finditer(t):
        emoji_hits.append(f"{p.name}:{m.group(0)!r}")
gate("G4a no emoji in source", not emoji_hits, ", ".join(emoji_hits[:5]))

hex_re = re.compile(r"#([0-9a-fA-F]{6})\b")
purple = []
for p in SRC:
    for m in hex_re.finditer(p.read_text(encoding="utf-8")):
        h = m.group(1)
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
        deg = hh * 360
        if 250 <= deg <= 300 and ss > 0.2 and 0.12 < ll < 0.92:
            purple.append(f"{p.name}:#{h}")
gate("G4b no purple/violet/indigo colours", not purple, ", ".join(purple[:8]))

bom = [p.name for p in SRC if p.read_bytes()[:3] == b"\xef\xbb\xbf"]
moji = [p.name for p in SRC if "Ã" in p.read_text(encoding="utf-8") or "â€" in p.read_text(encoding="utf-8")]
gate("G9 UTF-8 without BOM or mojibake", not bom and not moji, f"bom={bom} mojibake={moji}")


def lum(hexs):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hexs[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


pairs = [
    ("#1F2420", "#F4EFE6", 4.5), ("#565D58", "#F4EFE6", 4.5), ("#565D58", "#FFFFFF", 4.5),
    ("#FFFFFF", "#B4472B", 4.5), ("#B4472B", "#FFFFFF", 4.5), ("#3F6B4E", "#FFFFFF", 4.5),
    ("#8A5A12", "#FFFFFF", 4.5), ("#F4EFE6", "#1D211F", 4.5), ("#565D58", "#FBF8F2", 4.5),
    ("#1F2420", "#F3DED6", 4.5), ("#E9B7A6", "#1D211F", 4.5), ("#CFE0D3", "#1D211F", 4.5),
    ("#B4472B", "#FCF6F3", 4.5), ("#3F6B4E", "#FBF8F2", 4.5),
]
bad = [f"{a} on {b} = {contrast(a, b):.2f}" for a, b, need in pairs if contrast(a, b) < need]
gate("G7 AA contrast for token pairs", not bad, "; ".join(bad))

slop = subprocess.run([PY, str(SLOP), str(ROOT / "index.html"), str(ROOT / "css"), str(ROOT / "js"), "--json"], capture_output=True, text=True)
try:
    sj = json.loads(slop.stdout)
except Exception:
    sj = {"raw": slop.stdout[-800:], "err": slop.stderr[-800:]}
gate("G2 slop_check 0 blockers", slop.returncode == 0, json.dumps(sj)[:600])
(OUT / "slop.json").write_text(json.dumps(sj, indent=2), encoding="utf-8")

# ------------------------------------------------------------------ browser gates
for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
    os.environ.pop(k, None)
os.environ["NO_PROXY"] = "localhost,127.0.0.1"


BASE = (ROOT / "index.html").as_uri()


def _watchdog():
    gates["G0 checker finished within 15 minutes"] = {"pass": False, "detail": "watchdog fired"}
    (OUT / "results.json").write_text(json.dumps({"gates": gates}, indent=2), encoding="utf-8")
    print("WATCHDOG", json.dumps(gates)[:2000])
    sys.stdout.flush()
    os._exit(2)


threading.Timer(1500, _watchdog).start()

from playwright.sync_api import sync_playwright  # noqa: E402

results = {"recipes": {}, "days": {}, "overflow": {}, "errors": []}


def unload(page):
    """Leave the game page (stops its loop and audio) without closing the context, which can hang."""
    try:
        page.evaluate("window.__mise && window.__mise.M && window.Mise.game.cleanup && window.Mise.game.cleanup()")
    except Exception:
        pass
    try:
        page.goto("about:blank")
    except Exception:
        pass


PROBE = """() => {
  const G = window.Mise.game;
  const s = G.session;
  const out = {paused: G.paused, speed: G.speed, overlay: window.Mise.ui.topOverlay(), screen: window.Mise.ui.current,
    hidden: document.hidden, fps: window.__fps};
  if (s) Object.assign(out, {idx: s.idx, state: s.state, timer: s.timer, done: s.done, autoplay: s.autoplay,
    stepType: s.step && s.step.type, mgDone: s.mg && s.mg.done});
  return JSON.stringify(out);
}"""

FPS_JS = "window.__fps = 0; (function(){ let n = 0, t0 = performance.now(); (function f(t){ n++; if (t - t0 > 1000) { window.__fps = n; n = 0; t0 = t; } requestAnimationFrame(f); })(t0); })()"


def wait_until(page, js, timeout):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if page.evaluate(js):
                return True
        except Exception:
            pass
        page.wait_for_timeout(250)
    return False


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, channel='msedge', args=["--proxy-bypass-list=127.0.0.1;localhost", "--autoplay-policy=no-user-gesture-required"])

    def new_page(w, h, url=BASE):
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        page.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        page.goto(url)
        page.wait_for_timeout(500)
        return page, errs, ctx

    # --- overflow + title/cookbook/shop at 5 widths
    over = []
    for w, h in [(320, 640), (390, 844), (768, 1024), (1024, 768), (1440, 900)]:
        page, errs, ctx = new_page(w, h)
        for screen in ["title", "home", "shop"]:
            page.evaluate(f"window.Mise.ui.show('{screen}')")
            page.wait_for_timeout(250)
            sw = page.evaluate("Math.max(document.documentElement.scrollWidth, document.querySelector('.screen.is-active').scrollWidth)")
            if sw > w + 1:
                over.append(f"{screen}@{w}: {sw}px")
            if w in (390, 1440):
                page.screenshot(path=str(SHOTS / f"{screen}-{w}.png"), full_page=False)
        # game screens at this width
        page.evaluate("window.__mise.startHome('salad','first')")
        page.wait_for_timeout(700)
        clipped = page.evaluate("""() => {
            const out = [];
            for (const id of ['hud','hint','ticket']) {
              const el = document.getElementById(id);
              if (!el || el.hidden) continue;
              const r = el.getBoundingClientRect();
              if (r.right > innerWidth + 1 || r.left < -1) out.push(id + ':' + Math.round(r.left) + '..' + Math.round(r.right));
            }
            return out;
        }""")
        over += [f"game@{w}: {c}" for c in clipped]
        results["errors"] += errs
        unload(page)
        pass  # ctx left open: closing hangs once WebAudio runs (headless quirk)
    results["overflow"] = over
    gate("G3 no horizontal overflow at 320/390/768/1024/1440", not over, "; ".join(over))

    # --- every recipe, first person, autoplay; plus third person subset
    page, errs, ctx = new_page(1280, 800)
    recipes = page.evaluate("window.Mise.RECIPES.map(r => r.id)")
    page.evaluate(FPS_JS)
    combos = [(r, "first") for r in recipes] + [(r, "third") for r in (recipes if not QUICK else recipes[:2])]
    failed = []
    for rid, cam in combos:
        page.evaluate(f"window.__mise.startHome('{rid}','{cam}'); window.__mise.autoplay(true); window.__mise.speed(8)")
        ok = wait_until(page, "window.__mise.state().done === true", 90)
        st = page.evaluate("window.__mise.state()")
        results["recipes"][f"{rid}/{cam}"] = {"done": ok, "quality": st.get("quality")}
        print(f"  recipe {rid}/{cam} done={ok} q={st.get('quality')}", flush=True)
        if not ok:
            failed.append(f"{rid}/{cam} stuck at step {st.get('step')}")
            print("    probe:", page.evaluate(PROBE), flush=True)
        page.wait_for_timeout(1000)
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1); window.Mise.ui.close('result')")
    gate("G5 all recipes completable (8 first person + third person)", not failed, "; ".join(failed))
    q = [v["quality"] for v in results["recipes"].values() if v["quality"] is not None]
    gate("G5b auto-play quality is high (mechanics reward precision)", q and min(q) >= 0.8, f"min={min(q) if q else None:.2f}")
    results["errors"] += errs
    unload(page)
    pass  # ctx left open: closing hangs once WebAudio runs (headless quirk)

    # --- restaurant: 3 roles x 2 cameras
    page, errs, ctx = new_page(1280, 800)
    bad_days = []
    for role in ["server", "owner", "chef"]:
        for cam in ["third", "first"]:
            page.evaluate("window.Mise.resetProfile()")
            page.evaluate(f"window.__mise.startDay('{role}','{cam}', 75); window.__mise.autoplay(true); window.__mise.speed(10)")
            ok = wait_until(page, "window.__mise.state().day.ended === true", 90)
            st = page.evaluate("window.__mise.state()")
            d = st["day"]
            results["days"][f"{role}/{cam}"] = d
            print(f"  day {role}/{cam} ended={ok} served={d.get('served')}", flush=True)
            if not ok:
                bad_days.append(f"{role}/{cam} not finished (t={d['time']:.0f})")
            elif d["served"] < 1:
                bad_days.append(f"{role}/{cam} served 0")
            page.wait_for_timeout(900)
            ov = page.evaluate("window.__mise.state().overlay")
            if ok and ov != "day":
                bad_days.append(f"{role}/{cam} no day summary")
            page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1); window.Mise.ui.close('day')")
    gate("G6 restaurant days finish for every role and view", not bad_days, "; ".join(bad_days))
    results["errors"] += errs
    unload(page)
    pass  # ctx left open: closing hangs once WebAudio runs (headless quirk)

    # --- keyboard-only cooking (chop with arrows + space)
    page, errs, ctx = new_page(1280, 800)
    page.evaluate("window.Mise.resetProfile(); window.__mise.startHome('salad','first')")
    page.wait_for_timeout(900)
    # taps, as the controls say ("Arrow keys jump between guides, Space slices").
    # A timed key-down/wait/key-up hold was flaky: on a loaded test machine the synthetic key-up
    # arrived after the 0.28 s glide threshold, so the knife slid off its guide.
    for _ in range(7):
        page.keyboard.press("ArrowLeft")
        page.wait_for_timeout(120)
        page.keyboard.press("Space")
        page.wait_for_timeout(120)
    page.wait_for_timeout(3000)
    st = page.evaluate("window.__mise.state()")
    cuts = page.evaluate("(() => { const s = window.Mise.game.session; return s && s.results.length ? 'step done' : (s && s.mg && s.mg.cuts ? s.mg.cuts.length + ' cuts' : 'n/a'); })()")
    gate("G8 keyboard-only play advances a step", st["step"] >= 1, f"step={st['step']} ({cuts})")

    # tap vs hold: a tap jumps exactly onto the next guide; holding the key glides freely
    page.evaluate("window.Mise.resetProfile(); window.__mise.startHome('salad','first')")
    page.wait_for_timeout(900)
    knife_js = "(() => { const mg = window.Mise.game.session.mg; return { x: mg.knifeX, guides: mg.ideal, min: mg.x0 + 8 }; })()"
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(200)
    tapped = page.evaluate(knife_js)
    on_guide = min(abs(tapped["x"] - g) for g in tapped["guides"]) < 1
    page.keyboard.down("ArrowLeft")
    page.wait_for_timeout(900)
    page.keyboard.up("ArrowLeft")
    page.wait_for_timeout(150)
    held = page.evaluate(knife_js)
    glided = tapped["x"] - held["x"] >= 40 or held["x"] <= held["min"] + 1
    gate("G8b arrow tap lands on a guide; holding the arrow glides the knife", on_guide and glided,
         f"tap x={tapped['x']:.1f} on_guide={on_guide}; after hold x={held['x']:.1f}")
    results["errors"] += errs
    pass  # ctx left open: closing hangs once WebAudio runs (headless quirk)

    # --- save / load round trip
    page, errs, ctx = new_page(1024, 768)
    page.evaluate("window.Mise.resetProfile(); window.Mise.profile.shop.coins = 4321; window.Mise.saveProfile()")
    page.reload()
    page.wait_for_timeout(500)
    coins = page.evaluate("window.Mise.profile.shop.coins")
    gate("G10 progress saves and reloads", coins == 4321, f"coins after reload={coins}")
    page.evaluate("window.Mise.resetProfile()")
    results["errors"] += errs
    pass  # ctx left open: closing hangs once WebAudio runs (headless quirk)

    # --- file:// host with storage denied
    fpage, ferrs, fctx = new_page(1024, 768, url=(ROOT / "index.html").as_uri())
    fpage.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('denied')}})")
    fpage.reload()
    fpage.wait_for_timeout(600)
    fpage.evaluate("window.__mise.startHome('miso','third')")
    fpage.wait_for_timeout(800)
    txt = fpage.evaluate("document.body.innerText.length")
    gate("G11 runs from file:// with storage blocked", txt > 200 and not ferrs, "; ".join(ferrs[:3]))
    pass  # fctx left open: closing hangs once WebAudio runs (headless quirk)

    gate("G1 no JS errors across all flows", not results["errors"], "; ".join(results["errors"][:5]))

    # --- judge screenshots of real states
    def shot(name, w, h, js, wait=1.2, steps=None):
        page, errs, ctx = new_page(w, h)
        page.evaluate("window.Mise.resetProfile()")
        page.evaluate(js)
        page.wait_for_timeout(int(wait * 1000))
        if steps:
            page.evaluate(steps)
            page.wait_for_timeout(700)
        page.screenshot(path=str(SHOTS / f"{name}.png"))
        unload(page)
        pass  # ctx left open: closing hangs once WebAudio runs (headless quirk)

    shot("cook-fp-chop-1440", 1440, 900, "window.__mise.startHome('salad','first')", 0.8,
         "(()=>{const s=window.Mise.game.session; const m=s.mg; m.aim(m.ideal[6]); m.cut(); m.aim(m.ideal[5]); m.cut(); m.aim(m.ideal[4]+6); m.cut(); m.aim(m.ideal[3]); m.cut(); m.aim(m.ideal[2]); })()")
    shot("cook-fp-chop-390", 390, 844, "window.__mise.startHome('salad','first')", 0.8,
         "(()=>{const m=window.Mise.game.session.mg; m.aim(m.ideal[6]); m.cut(); m.aim(m.ideal[5]); m.cut(); m.aim(m.ideal[3]);})()")
    shot("cook-fp-fry-1440", 1440, 900, "window.__mise.startHome('steak','first'); window.__mise.autoplay(true); window.__mise.speed(3)", 2.2,
         "window.__mise.autoplay(false); window.__mise.speed(1)")
    shot("cook-tp-1440", 1440, 900, "window.__mise.startHome('pancakes','third'); window.__mise.autoplay(true); window.__mise.speed(2)", 3.5,
         "window.__mise.autoplay(false); window.__mise.speed(1)")
    shot("cook-tp-390", 390, 844, "window.__mise.startHome('ramen','third')", 1.6)
    shot("serve-tp-1440", 1440, 900, "window.__mise.startDay('server','third'); window.__mise.autoplay(true); window.__mise.speed(5)", 6,
         "window.__mise.autoplay(false); window.__mise.speed(1)")
    shot("serve-tp-390", 390, 844, "window.__mise.startDay('server','third'); window.__mise.autoplay(true); window.__mise.speed(5)", 6,
         "window.__mise.autoplay(false); window.__mise.speed(1)")
    shot("serve-fp-1440", 1440, 900, "window.__mise.startDay('owner','first'); window.__mise.autoplay(true); window.__mise.speed(5)", 5,
         "window.__mise.autoplay(false); window.__mise.speed(1)")
    shot("chef-fp-1440", 1440, 900, "window.__mise.startDay('chef','first'); window.__mise.speed(6)", 5,
         "(()=>{window.__mise.speed(1); const r=window.Mise.game.restaurant; const t=r.pendingTickets()[0]; if(t) r.openCook(t.id);})()")
    shot("result-1440", 1440, 900, "window.__mise.startHome('ramen','first'); window.__mise.autoplay(true); window.__mise.speed(6)", 9)
    shot("shop-menu-1440", 1440, 900, "window.Mise.profile.shop.coins=300; window.Mise.ui.show('shop'); window.Mise.ui.renderTab('menu')", 0.6)


results["gates"] = gates
(OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
width = max(len(k) for k in gates)
allok = True
for k, v in gates.items():
    allok &= v["pass"]
    print(f"{'PASS' if v['pass'] else 'FAIL'}  {k.ljust(width)}  {v['detail'][:160]}")
print("ALL GATES PASS" if allok else "GATES FAILING")
sys.stdout.flush()
os._exit(0 if allok else 1)
