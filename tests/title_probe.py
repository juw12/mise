"""Measure the HUD title box for each service role at a given width (debug helper for nav_check N1b)."""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
WIDTH = int(sys.argv[1]) if len(sys.argv) > 1 else 390

PROBE = """
() => {
  const s = document.querySelector('#screen-game .hud-title strong');
  const cs = getComputedStyle(s);
  return { text: s.textContent, sh: s.scrollHeight, ch: s.clientHeight, sw: s.scrollWidth, cw: s.clientWidth,
           font: cs.fontSize, lh: cs.lineHeight, clamp: cs.webkitLineClamp, rect: s.getBoundingClientRect().height };
}
"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, channel="msedge")
    page = browser.new_page(viewport={"width": WIDTH, "height": 844})
    page.goto((ROOT / "index.html").as_uri())
    page.wait_for_function("window.Mise && window.Mise.ui && window.__mise", timeout=15000)
    for role in ("chef", "server", "owner"):
        page.evaluate(f"window.__mise.startDay('{role}','third')")
        page.wait_for_timeout(300)
        print(role, json.dumps(page.evaluate(PROBE)))
        page.evaluate("window.Mise.game.cleanup()")
    page.evaluate("window.__mise.startHome('pancakes','first')")
    page.wait_for_timeout(300)
    print("pancakes", json.dumps(page.evaluate(PROBE)))
    browser.close()
