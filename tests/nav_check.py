"""Navigation gates for Mise: a visible way back on every screen, browser/phone Back, Escape, no lost progress.

Run:  python tests/nav_check.py [OUT_DIR]
Prints one PASS/FAIL line per gate and writes OUT_DIR/nav.json plus a few screenshots.
Exit 0 only if every gate passes.
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests" / "out" / "nav"
OUT.mkdir(parents=True, exist_ok=True)

gates = {}
notes = []


def gate(name, ok, detail=""):
    gates[name] = {"pass": bool(ok), "detail": str(detail)[:300]}
    print(("PASS " if ok else "FAIL ") + name + "  " + str(detail)[:300], flush=True)


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/index.html"


BACK_JS = """
() => {
  const scr = document.querySelector('.screen.is-active');
  if (!scr) return null;
  const cands = [...scr.querySelectorAll('[data-back], button[aria-label^="Back"], button[aria-label^="Leave"]')];
  for (const b of cands) {
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.top < 140) {
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), label: b.getAttribute('aria-label') || b.textContent.trim() };
    }
  }
  return null;
}
"""


def state(page):
    return page.evaluate("window.__mise.state()")


def fresh(page, url):
    page.goto(url)
    page.wait_for_function("window.Mise && window.Mise.ui && window.__mise", timeout=15000)
    page.wait_for_timeout(200)
    page.evaluate("window.Mise.resetProfile()")
    page.evaluate("window.Mise.ui.show('title')")
    page.wait_for_timeout(100)


def click(page, selector):
    page.locator(selector).first.click()
    page.wait_for_timeout(250)


def back(page):
    page.evaluate("history.back()")
    page.wait_for_timeout(450)


def main():
    httpd, url = serve()
    results = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, channel="msedge", args=["--autoplay-policy=no-user-gesture-required"])
        errors = []

        # ---- N1 visible back control on every non-title screen, desktop and phone
        missing = []
        sizes = {}
        for w, h in [(1440, 900), (390, 844)]:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.on("pageerror", lambda e: errors.append(str(e)))
            fresh(page, url)
            for label, js in [
                ("home", "window.Mise.ui.show('home')"),
                ("shop", "window.Mise.ui.show('shop')"),
                ("cooking", "window.__mise.startHome('salad','first')"),
                ("restaurant", "window.__mise.startDay('server','third')"),
            ]:
                page.evaluate(js)
                page.wait_for_timeout(500)
                b = page.evaluate(BACK_JS)
                sizes[f"{label}@{w}"] = b
                if not b or b["w"] < 40 or b["h"] < 40:
                    missing.append(f"{label}@{w}")
                if label in ("cooking", "restaurant"):
                    page.screenshot(path=str(OUT / f"{label}-{w}.png"))
                page.evaluate("window.Mise.game.cleanup && window.Mise.game.cleanup()")
            page.close()
        results["back_controls"] = sizes
        gate("N1 visible back control (>=40 px, top bar) on home, shop, cooking, restaurant at 1440 and 390 px", not missing, "missing: " + ", ".join(missing) if missing else "all present")

        # ---- N2 browser / phone Back never leaves the game and goes one level up
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda e: errors.append(str(e)))
        bad = []
        fresh(page, url)
        click(page, "#screen-title [data-go=home]")
        back(page)
        s = state(page) if "index.html" in page.url else {"screen": "LEFT THE GAME"}
        if s["screen"] != "title":
            bad.append(f"home->Back gave {s['screen']}")
        fresh(page, url)
        click(page, "#screen-title [data-go=shop]")
        back(page)
        s = state(page) if "index.html" in page.url else {"screen": "LEFT THE GAME"}
        if s["screen"] != "title":
            bad.append(f"shop->Back gave {s['screen']}")
        # overlay closes first
        fresh(page, url)
        click(page, "#screen-title [data-go=home]")
        page.evaluate("window.Mise.ui.open('settings')")
        page.wait_for_timeout(200)
        back(page)
        s = state(page) if "index.html" in page.url else {"screen": "LEFT THE GAME", "overlay": None}
        if s["screen"] != "home" or s["overlay"]:
            bad.append(f"settings overlay->Back gave {s['screen']}/{s.get('overlay')}")
        # cooking with no progress: leaves to the cookbook
        fresh(page, url)
        click(page, "#screen-title [data-go=home]")
        click(page, "#btn-cook")
        page.wait_for_timeout(300)
        back(page)
        s = state(page) if "index.html" in page.url else {"screen": "LEFT THE GAME", "overlay": None}
        if s["screen"] != "home":
            bad.append(f"cooking(no progress)->Back gave {s['screen']}/{s.get('overlay')}")
        results["n2_bad"] = bad
        gate("N2 browser/phone Back stays in the game and goes one level up (home, shop, overlay, fresh dish)", not bad, "; ".join(bad) or "ok")

        # ---- N3 progress is protected: Back mid-dish or mid-service asks first, Stay keeps everything
        bad3 = []
        fresh(page, url)
        click(page, "#screen-title [data-go=home]")
        click(page, "#btn-cook")
        page.evaluate("window.__mise.autoplay(true); window.__mise.speed(4)")
        for _ in range(40):
            page.wait_for_timeout(150)
            if (state(page)["step"] or 0) >= 1:
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        step_before = state(page)["step"]
        back(page)
        s = state(page) if "index.html" in page.url else {"screen": "LEFT THE GAME", "overlay": None, "step": None}
        page.screenshot(path=str(OUT / "leave-confirm-cooking.png"))
        if s["screen"] != "game" or s["overlay"] != "leave":
            bad3.append(f"cooking(step {step_before})->Back gave {s['screen']}/{s.get('overlay')}")
        else:
            stay = page.locator("#ov-leave [data-act=stay]")
            if stay.count():
                stay.first.click()
                page.wait_for_timeout(250)
            s2 = state(page)
            if s2["overlay"] or s2["step"] != step_before or s2["screen"] != "game":
                bad3.append(f"Stay did not restore the dish: {s2}")
        # restaurant with nothing at stake yet: back leaves straight to the restaurant screen
        fresh(page, url)
        page.evaluate("window.__mise.startDay('server','third')")
        page.wait_for_timeout(400)
        s0 = state(page)
        page.locator("#screen-game [data-back]").first.click()
        page.wait_for_timeout(300)
        s = state(page)
        if s0["day"]["tickets"] == 0 and s0["day"]["served"] == 0 and s["screen"] != "shop":
            bad3.append(f"fresh service back gave {s['screen']}/{s['overlay']} (nothing to lose)")
        # restaurant with orders in: visible back asks, Leave goes to the restaurant screen
        fresh(page, url)
        page.evaluate("window.__mise.startDay('server','third'); window.__mise.autoplay(true); window.__mise.speed(6)")
        for _ in range(60):
            page.wait_for_timeout(150)
            d = state(page)["day"]
            if d["tickets"] > 0 or d["served"] > 0:
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        b = page.locator("#screen-game [data-back]")
        if b.count():
            b.first.click()
            page.wait_for_timeout(300)
            s = state(page)
            if s["overlay"] != "leave":
                bad3.append(f"restaurant back button gave overlay {s['overlay']}")
            else:
                page.screenshot(path=str(OUT / "leave-confirm-restaurant.png"))
                page.locator("#ov-leave [data-act=quit]").first.click()
                page.wait_for_timeout(300)
                s = state(page)
                if s["screen"] != "shop":
                    bad3.append(f"Leave from restaurant went to {s['screen']}")
        else:
            bad3.append("no back button in the restaurant")
        # visible back on a fresh dish leaves straight away
        fresh(page, url)
        page.evaluate("window.__mise.startHome('salad','first')")
        page.wait_for_timeout(400)
        b = page.locator("#screen-game [data-back]")
        if b.count():
            b.first.click()
            page.wait_for_timeout(300)
            s = state(page)
            if s["screen"] != "home":
                bad3.append(f"fresh dish back button gave {s['screen']}/{s['overlay']}")
        else:
            bad3.append("no back button while cooking")
        results["n3_bad"] = bad3
        gate("N3 leaving mid-dish or mid-service asks first; Stay keeps progress; Leave returns to the right screen", not bad3, "; ".join(bad3) or "ok")

        # ---- N4 Escape is Back on menu screens and closes overlays
        bad4 = []
        for target in ("home", "shop"):
            fresh(page, url)
            click(page, f"#screen-title [data-go={target}]")
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)
            s = state(page)
            if s["screen"] != "title":
                bad4.append(f"Escape on {target} gave {s['screen']}")
        fresh(page, url)
        click(page, "#screen-title [data-go=home]")
        page.evaluate("window.Mise.ui.open('settings')")
        page.wait_for_timeout(150)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        s = state(page)
        if s["overlay"] or s["screen"] != "home":
            bad4.append(f"Escape on settings gave {s['screen']}/{s['overlay']}")
        # Escape in a kitchen with work in it opens the same leave dialog; Escape again keeps cooking
        fresh(page, url)
        click(page, "#screen-title [data-go=home]")
        click(page, "#btn-cook")
        page.evaluate("window.__mise.autoplay(true); window.__mise.speed(4)")
        for _ in range(40):
            page.wait_for_timeout(150)
            if (state(page)["step"] or 0) >= 1:
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        step_before = state(page)["step"]
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        s = state(page)
        if s["overlay"] != "leave":
            bad4.append(f"Escape mid-dish gave overlay {s['overlay']}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        s = state(page)
        if s["overlay"] or s["screen"] != "game" or s["step"] != step_before:
            bad4.append(f"second Escape did not keep cooking: {s['screen']}/{s['overlay']} step {s['step']} vs {step_before}")
        gate("N4 Escape is Back: menus go up, dialogs close, a kitchen with work in it asks first", not bad4, "; ".join(bad4) or "ok")

        # ---- N5 file:// still works with history (no SecurityError) and Back from home stays in the game
        fpage = browser.new_page(viewport={"width": 1280, "height": 800})
        ferr = []
        fpage.on("pageerror", lambda e: ferr.append(str(e)))
        fpage.goto((ROOT / "index.html").as_uri())
        fpage.wait_for_function("window.Mise && window.Mise.ui && window.__mise", timeout=15000)
        fpage.wait_for_timeout(200)
        fpage.locator("#screen-title [data-go=home]").first.click()
        fpage.wait_for_timeout(250)
        fpage.evaluate("history.back()")
        fpage.wait_for_timeout(450)
        fs = fpage.evaluate("window.__mise ? window.__mise.state().screen : 'LEFT'") if fpage.url.startswith("file:") else "LEFT THE GAME"
        gate("N5 from file:// Back on home returns to title without errors", fs == "title" and not ferr, f"screen={fs} errors={ferr[:2]}")
        gate("N6 no JS errors during navigation tests", not errors, "; ".join(errors[:3]))
        browser.close()
    httpd.shutdown()
    (OUT / "nav.json").write_text(json.dumps({"gates": gates, "results": results}, indent=1), encoding="utf-8")
    ok = all(g["pass"] for g in gates.values())
    print("ALL NAV GATES PASS" if ok else "NAV GATES FAILING", flush=True)
    os._exit(0 if ok else 1)


main()
