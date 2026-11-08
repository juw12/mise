"""Quick visual shots for one hone round (not a gate)."""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests" / "out" / "quick"
OUT.mkdir(parents=True, exist_ok=True)

SHOTS = [
    ("cook-fp-chop-1440", 1440, 900, "window.__mise.startHome('salad','first')", 800,
     "(()=>{const m=window.Mise.game.session.mg; m.aim(m.ideal[6]); m.cut(); m.aim(m.ideal[5]); m.cut(); m.aim(m.ideal[4]+6); m.cut(); m.aim(m.ideal[3]); m.cut(); m.aim(m.ideal[2]);})()", 120),
    ("cook-fp-fry-1440", 1440, 900, "window.__mise.startHome('steak','first'); window.__mise.autoplay(true); window.__mise.speed(3)", 2400,
     "window.__mise.autoplay(false); window.__mise.speed(1); window.__mise.state()", 500),
    ("serve-tp-1440", 1440, 900, "window.__mise.startDay('server','third'); window.__mise.autoplay(true); window.__mise.speed(5)", 6000,
     "window.__mise.autoplay(false); window.__mise.speed(1)", 600),
    ("chef-fp-1440", 1440, 900, "window.__mise.startDay('chef','first'); window.__mise.speed(6)", 5000,
     "(()=>{window.__mise.speed(1); const r=window.Mise.game.restaurant; const t=r.pendingTickets()[0]; if(t) r.openCook(t.id);})()", 900),
    ("cook-fp-chop-390", 390, 844, "window.__mise.startHome('salad','first')", 800,
     "(()=>{const m=window.Mise.game.session.mg; m.aim(m.ideal[6]); m.cut(); m.aim(m.ideal[5]); m.cut(); m.aim(m.ideal[3]);})()", 150),
    ("shop-1440", 1440, 900, "window.Mise.profile.shop.coins=300; window.Mise.ui.show('shop'); window.Mise.ui.renderTab('menu')", 600,
     "0", 100),
    ("shop-390", 390, 844, "window.Mise.profile.shop.coins=60; window.Mise.ui.show('shop')", 600,
     "0", 100),
    ("home-1440", 1440, 900, "window.Mise.ui.show('home')", 600, "0", 100),
    ("serve-tp-390", 390, 844, "window.__mise.startDay('server','third'); window.__mise.autoplay(true); window.__mise.speed(5)", 6000,
     "window.__mise.autoplay(false); window.__mise.speed(1)", 600),
]

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, channel="msedge", args=["--autoplay-policy=no-user-gesture-required"])
    errors = []
    for name, w, h, js, wait, after, settle in SHOTS:
        page = browser.new_page(viewport={"width": w, "height": h})
        page.on("pageerror", lambda e: errors.append(name + ": " + str(e)))
        page.goto((ROOT / "index.html").as_uri())
        page.wait_for_timeout(400)
        page.evaluate("window.Mise.resetProfile()")
        page.evaluate(js)
        page.wait_for_timeout(wait)
        page.evaluate(after)
        page.wait_for_timeout(settle)
        page.screenshot(path=str(OUT / (name + ".png")))
        page.goto("about:blank")
    print("errors:", errors)
os._exit(0)
