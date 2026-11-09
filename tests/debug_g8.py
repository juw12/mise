"""Repro of check.py G8 (keyboard-only chop) with per-press logging of focus, cuts and knife position."""
import functools
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
STALL = "--stall" in sys.argv
TAPS = "--taps" in sys.argv
THROTTLE = int(sys.argv[sys.argv.index("--throttle") + 1]) if "--throttle" in sys.argv else 1
SITE = Path(sys.argv[sys.argv.index("--root") + 1]) if "--root" in sys.argv else ROOT

PROBE = """(() => {
  const s = window.Mise.game.session;
  const mg = s && s.mg;
  return {
    focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null,
    tabNav: window.Mise.game.tabNav,
    paused: window.Mise.game.paused,
    overlay: window.__mise.state().overlay,
    step: window.__mise.state().step,
    cuts: mg && mg.cuts ? mg.cuts.length : null,
    knife: mg && Math.round(mg.knifeX), ideal: mg && mg.ideal.map(Math.round).join(' '), cutsAt: mg && mg.cuts.map(Math.round).join(' '), hold: mg && mg.keyHold, dir: mg && mg.keyDir,
    
  };
})()"""


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SITE))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/index.html"


def main():
    httpd, url = serve()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, channel="msedge", args=["--autoplay-policy=no-user-gesture-required"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        if THROTTLE > 1:
            cdp = page.context.new_cdp_session(page)
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": THROTTLE})
        page.on("pageerror", lambda err: print("   pageerror:", str(err)[:200], flush=True))
        page.goto(url)
        page.wait_for_function("window.Mise && window.Mise.ui && window.__mise")
        page.evaluate("window.Mise.resetProfile(); window.__mise.startHome('salad','first')")
        page.wait_for_timeout(900)
        print("start", page.evaluate(PROBE), flush=True)
        for index in range(7):
            if STALL:
                # a 350 ms main-thread stall lands while the key is down (a slow frame on a weak phone)
                page.evaluate("setTimeout(() => { const t = performance.now(); while (performance.now() - t < 350) {} }, 60)")
            if TAPS:
                page.keyboard.press("ArrowLeft")
            else:
                page.keyboard.down("ArrowLeft")
                page.wait_for_timeout(180)
                page.keyboard.up("ArrowLeft")
            page.keyboard.press("Space")
            page.wait_for_timeout(120)
            print(index, page.evaluate(PROBE), flush=True)
        page.wait_for_timeout(3000)
        print("end", page.evaluate(PROBE), flush=True)
        # a real hold still glides: hold ArrowRight 700 ms on the next chop step
        before = page.evaluate("Math.round(window.Mise.game.session.mg.knifeX || 0)")
        page.keyboard.down("ArrowRight")
        page.wait_for_timeout(700)
        page.keyboard.up("ArrowRight")
        after = page.evaluate("Math.round(window.Mise.game.session.mg.knifeX || 0)")
        print("long hold knife", before, "->", after, flush=True)
        browser.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()

