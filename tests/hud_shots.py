"""Screenshot the cooking and restaurant top bars at a given width (quick visual check of the HUD)."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests" / "out" / "hud"
OUT.mkdir(parents=True, exist_ok=True)
WIDTHS = [int(w) for w in sys.argv[2:]] or [320, 360, 390]

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, channel="msedge")
    for width in WIDTHS:
        page = browser.new_page(viewport={"width": width, "height": 700})
        page.goto((ROOT / "index.html").as_uri())
        page.wait_for_function("window.Mise && window.Mise.ui && window.__mise", timeout=15000)
        for label, js in [
            ("cooking", "window.__mise.startHome('tamagoyaki','first')"),
            ("restaurant", "window.__mise.startDay('server','third')"),
        ]:
            page.evaluate(js)
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / f"hud-{label}-{width}.png"), clip={"x": 0, "y": 0, "width": width, "height": 80})
            overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
            print(label, width, "overflow" if overflow else "ok")
            page.evaluate("window.Mise.game.cleanup()")
        page.close()
    browser.close()
