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
    # threaded: an idle keep-alive socket from a closed page must not block the next page load
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
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
      const word = b.querySelector('.back-label');
      const wr = word ? word.getBoundingClientRect() : null;
      const arrow = b.querySelector('.ico');
      const arrowShown = !!(arrow && arrow.getBoundingClientRect().width >= 12);
      const wordShown = !!(arrowShown && word && wr.width > 8 && getComputedStyle(word).display !== 'none' && word.textContent.trim() === 'Back');
      let overlap = null;
      const bar = b.parentElement;
      for (const o of bar ? [...bar.parentElement.querySelectorAll('button, .hud-title, h1, h2')] : []) {
        if (o === b || b.contains(o) || o.contains(b)) continue;
        const q = o.getBoundingClientRect();
        if (q.width === 0 || q.height === 0) continue;
        const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left);
        const iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (ix > 1 && iy > 1) {
          overlap = (o.id || o.className || o.tagName).toString().slice(0, 40);
          break;
        }
      }
      if (r.right > window.innerWidth) overlap = 'viewport edge';
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), label: b.getAttribute('aria-label') || b.textContent.trim(), word: wordShown, overlap };
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
        for w, h in [(1440, 900), (390, 844), (320, 640)]:
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
                elif not b.get("word"):
                    missing.append(f"{label}@{w} (arrow or word Back hidden)")
                elif b.get("overlap"):
                    missing.append(f"{label}@{w} (overlaps {b['overlap']})")
                if label in ("cooking", "restaurant") or w == 320:
                    page.screenshot(path=str(OUT / f"{label}-{w}.png"))
                page.evaluate("window.Mise.game.cleanup && window.Mise.game.cleanup()")
            page.close()
        results["back_controls"] = sizes
        gate("N1 visible back control (>=40 px, top bar, word Back shown, no overlap) on home, shop, cooking, restaurant at 1440, 390 and 320 px", not missing, "missing: " + ", ".join(missing) if missing else "all present")

        # ---- N1b every dish and service title fits next to the Back pill on small phones (no ellipsis, no clipped lines)
        TITLE_JS = """
        () => {
          const t = document.querySelector('#screen-game .hud-title');
          const k = t.querySelector('.kicker');
          const s = t.querySelector('strong');
          return {
            kicker: k.textContent.trim(),
            title: s.textContent.trim(),
            kickerCut: k.scrollWidth > k.clientWidth + 1,
            // a title is cut when a whole line is hidden by the 2-line clamp or it overflows sideways
            titleCut: s.scrollHeight > s.clientHeight + parseFloat(getComputedStyle(s).lineHeight) * 0.5 || s.scrollWidth > s.clientWidth + 1,
            descender: s.scrollHeight - s.clientHeight,
            overflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        }
        """
        cut = []
        titles = {}
        recipes = ["tamagoyaki", "fried_rice", "salad", "ramen", "pancakes", "steak", "tomato_soup", "miso"]
        for w, h in [(320, 640), (390, 844)]:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.on("pageerror", lambda e: errors.append(str(e)))
            fresh(page, url)
            runs = [("cook", r, f"window.__mise.startHome('{r}','first')") for r in recipes]
            runs += [("serve", role, f"window.__mise.startDay('{role}','third')") for role in ("chef", "server", "owner")]
            for kind, key, js in runs:
                page.evaluate(js)
                page.wait_for_timeout(250)
                info = page.evaluate(TITLE_JS)
                titles[f"{key}@{w}"] = info["kicker"] + " / " + info["title"]
                if info["kickerCut"] or info["titleCut"] or info["overflow"]:
                    cut.append(f"{key}@{w}: kicker cut={info['kickerCut']} title cut={info['titleCut']} overflow={info['overflow']}")
                page.evaluate("window.Mise.game.cleanup && window.Mise.game.cleanup()")
            page.close()
        results["titles_small"] = titles
        gate("N1b every dish (8) and service (3) title and its kicker show in full beside the Back pill at 320 and 390 px", not cut, "; ".join(cut) or "all 22 fit")

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
        # a later day with served AND lost tables: the text names exactly what is lost, and leaving undoes it
        fresh(page, url)
        page.evaluate("window.__mise.M.profile.shop.day = 3; window.__mise.M.saveProfile()")
        history_before = page.evaluate("window.__mise.M.profile.shop.history.length")
        page.evaluate("window.__mise.startDay('server','third'); window.__mise.autoplay(true); window.__mise.speed(6)")
        for _ in range(120):
            page.wait_for_timeout(150)
            if state(page)["day"]["served"] >= 1:
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        # one guest walks out the way the game does it (-0.08 reputation)
        page.evaluate("""() => {
          const r = window.Mise.game.restaurant;
          r.lost += 1;
          const s = window.__mise.M.profile.shop;
          s.reputation = Math.max(0, s.reputation - 0.08);
        }""")
        info = page.evaluate("""() => {
          const r = window.Mise.game.restaurant;
          return { repStart: r.repStart, repNow: window.__mise.M.profile.shop.reputation, served: r.served, lost: r.lost, earned: r.earned, used: r.stockUsed };
        }""")
        page.locator("#screen-game [data-back]").first.click()
        page.wait_for_timeout(300)
        leave_text = page.evaluate("document.getElementById('leave-sub').textContent")
        results["n3_service_text"] = leave_text
        page.screenshot(path=str(OUT / "leave-confirm-day3.png"))
        expect = ["You can play Day 3 again", "Day 3 does not count", "reputation change is undone", "guest left"]
        if info["served"] >= 1:
            expect.append("served")
        if info["earned"] > 0:
            expect.append("is not paid")
        if info["used"] > 0:
            expect.append("already used stay used")
        missing_words = [w for w in expect if w not in leave_text]
        if missing_words:
            bad3.append(f"day-3 leave text misses {missing_words}: {leave_text!r}")
        page.locator("#ov-leave [data-act=quit]").first.click()
        page.wait_for_timeout(300)
        after = page.evaluate("""() => {
          const s = window.__mise.M.profile.shop;
          return { rep: s.reputation, day: s.day, history: s.history.length };
        }""")
        results["n3_service_after"] = {"before": info, "after": after}
        if abs(after["rep"] - info["repStart"]) > 1e-9:
            bad3.append(f"reputation not restored: {after['rep']} vs start {info['repStart']} (was {info['repNow']})")
        if after["day"] != 3 or after["history"] != history_before:
            bad3.append(f"day/history changed after leaving: {after}")
        results["n3_bad"] = bad3
        gate("N3 leaving mid-dish or mid-service asks first with exact loss text (any day, served/lost tables); Stay keeps progress; Leave returns to the right screen and the service does not count", not bad3, "; ".join(bad3) or "ok")

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

        # ---- N4b result and day-summary dialogs: on-screen Back button equivalents (Esc, system Back) take the same default step
        bad5 = []
        for how in ("escape", "system"):
            fresh(page, url)
            page.evaluate("window.__mise.startHome('salad','first'); window.__mise.autoplay(true); window.__mise.speed(6)")
            for _ in range(200):
                page.wait_for_timeout(150)
                if state(page)["overlay"] == "result":
                    break
            page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
            if state(page)["overlay"] != "result":
                bad5.append(f"dish result never appeared ({how})")
                continue
            if how == "escape":
                page.screenshot(path=str(OUT / "result-dialog.png"))
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                back(page)
            s = state(page)
            if s["screen"] != "game" or s["overlay"]:
                bad5.append(f"result + {how} gave {s['screen']}/{s['overlay']} (want the dialog closed over the finished kitchen)")
                continue
            if how == "escape":
                page.screenshot(path=str(OUT / "result-closed.png"))
            # one more Back: the finished dish has nothing to lose, so it goes straight to the cookbook
            if how == "escape":
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                back(page)
            s = state(page)
            if s["screen"] != "home" or s["overlay"]:
                bad5.append(f"finished kitchen + {how} gave {s['screen']}/{s['overlay']} (want cookbook, no question)")
        for how in ("escape", "system"):
            fresh(page, url)
            page.evaluate("window.__mise.startDay('server','third')")
            page.wait_for_timeout(400)
            page.evaluate("window.Mise.game.restaurant.endDay()")
            for _ in range(20):
                page.wait_for_timeout(150)
                if state(page)["overlay"] == "day":
                    break
            if state(page)["overlay"] != "day":
                bad5.append(f"day summary never appeared ({how})")
                continue
            if how == "escape":
                page.screenshot(path=str(OUT / "day-dialog.png"))
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                back(page)
            s = state(page)
            if s["screen"] != "game" or s["overlay"]:
                bad5.append(f"day summary + {how} gave {s['screen']}/{s['overlay']} (want the dialog closed over the closed floor)")
                continue
            if how == "escape":
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                back(page)
            s = state(page)
            if s["screen"] != "shop" or s["overlay"]:
                bad5.append(f"closed floor + {how} gave {s['screen']}/{s['overlay']} (want restaurant, no question)")
        results["n4b_bad"] = bad5
        gate("N4b dish result and day summary: Esc and system Back go one level up (close the dialog), then once more to the cookbook / restaurant", not bad5, "; ".join(bad5) or "ok")

        # ---- N4c one-time Back tip: shown on the first kitchen only, never again, never blocks input
        bad6 = []
        fresh(page, url)
        page.evaluate("window.__mise.startHome('salad','first')")
        page.wait_for_timeout(400)
        tip = page.evaluate("(() => { const t = document.getElementById('back-tip'); return t ? { shown: !t.hidden, text: t.textContent, pe: getComputedStyle(t).pointerEvents } : null; })()")
        if not tip or not tip["shown"] or "Back" not in tip["text"]:
            bad6.append(f"tip not shown on the first kitchen: {tip}")
        elif tip["pe"] != "none":
            bad6.append("tip intercepts taps")
        else:
            page.screenshot(path=str(OUT / "back-tip.png"))
        page.keyboard.press("Space")
        page.wait_for_timeout(200)
        if page.evaluate("!document.getElementById('back-tip').hidden"):
            bad6.append("tip did not hide on the first key press")
        page.evaluate("window.Mise.game.cleanup(); window.__mise.startHome('salad','first')")
        page.wait_for_timeout(300)
        if page.evaluate("!document.getElementById('back-tip').hidden"):
            bad6.append("tip shown a second time")
        results["n4c_bad"] = bad6
        gate("N4c one-time Back tip on the first kitchen, hides on first touch, not shown again", not bad6, "; ".join(bad6) or "ok")

        # ---- N4d dialogs own the input: the screen behind is inert, Tab stays inside, a stray tap keeps the result open,
        #      and the dish leave headline names work inside the current step
        bad7 = []
        fresh(page, url)
        page.evaluate("window.Mise.profile.tips = { back: true }; window.__mise.startHome('salad','first')")
        page.wait_for_timeout(400)
        page.mouse.click(640, 420)
        page.wait_for_timeout(150)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        probe = page.evaluate("""() => ({
          overlay: window.__mise.state().overlay,
          gameInert: document.getElementById('screen-game').inert,
          lead: document.getElementById('leave-lead').textContent,
        })""")
        if probe["overlay"] != "leave":
            bad7.append(f"leave dialog did not open after a cut: {probe}")
        else:
            if not probe["gameInert"]:
                bad7.append("kitchen behind the leave dialog is not inert")
            if "step 1" not in probe["lead"]:
                bad7.append(f"leave headline does not name the started step: {probe['lead']!r}")
            outside = False
            for _ in range(6):
                page.keyboard.press("Tab")
                inside = page.evaluate("!!document.activeElement.closest('#ov-leave')")
                if not inside:
                    outside = True
            if outside:
                bad7.append("Tab moved focus out of the leave dialog")
            back_clicked = page.evaluate("""() => {
              const b = document.querySelector('#screen-game [data-back]');
              const r = b.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return !!(hit && hit.closest && hit.closest('[data-back]'));
            }""")
            if back_clicked:
                bad7.append("the Back pill behind the dialog can still be hit")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        # result card: a tap outside keeps it open (and nudges)
        fresh(page, url)
        page.evaluate("window.Mise.profile.tips = { back: true }; window.__mise.startHome('salad','first'); window.__mise.autoplay(true); window.__mise.speed(6)")
        for _ in range(200):
            page.wait_for_timeout(150)
            if state(page)["overlay"] == "result":
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        if state(page)["overlay"] == "result":
            page.mouse.click(8, 300)
            page.wait_for_timeout(120)
            nudged = page.evaluate("document.querySelector('#ov-result .sheet').classList.contains('is-nudge')")
            page.wait_for_timeout(250)
            if state(page)["overlay"] != "result":
                bad7.append("a tap outside closed the dish result")
            if not nudged:
                bad7.append("no nudge feedback on an ignored outside tap")
            if not page.evaluate("document.getElementById('screen-game').inert"):
                bad7.append("kitchen behind the dish result is not inert")
        else:
            bad7.append("dish result never appeared for N4d")
        results["n4d_bad"] = bad7
        gate("N4d dialogs own the input: background inert, Tab stays inside, outside tap keeps results open with a nudge, in-step work named", not bad7, "; ".join(bad7) or "ok")

        # ---- N2b history guard under stress: fast title <-> cookbook cycles never trap the player or leave the site early
        bad8 = []
        fresh(page, url)
        for cycle in range(5):
            page.evaluate("window.Mise.ui.show('home')")
            page.wait_for_timeout(30)
            page.locator("#screen-home [data-back]").first.click()
            # start again before the game's own history.back() has landed
            page.evaluate("window.Mise.ui.show('home')")
            page.wait_for_timeout(400)
            back(page)
            s = state(page)
            if s["screen"] != "title":
                bad8.append(f"cycle {cycle}: system Back from the cookbook gave {s['screen']} (want title)")
                break
        # rapid double system Back from the restaurant: one level per press, never past the title
        page.evaluate("window.Mise.ui.show('shop')")
        page.wait_for_timeout(300)
        page.evaluate("history.back(); history.back()")
        page.wait_for_timeout(700)
        s = state(page)
        if s["screen"] != "title":
            bad8.append(f"double system Back from the restaurant gave {s['screen']}")
        if not page.url.startswith(url.rstrip("/")):
            bad8.append(f"left the game: {page.url}")
        results["n2b_bad"] = bad8
        gate("N2b history guard holds under fast title/cookbook cycles and a double Back (no trap, never leaves early)", not bad8, "; ".join(bad8) or "ok")

        # ---- N3b Pause > Restart day keeps the same loss accounting as leaving
        bad9 = []
        fresh(page, url)
        page.evaluate("window.Mise.profile.tips = { back: true }; window.__mise.M.profile.shop.day = 3; window.__mise.M.saveProfile()")
        before = page.evaluate("""() => {
          const s = window.__mise.M.profile.shop;
          return { coins: s.coins, history: s.history.length, day: s.day };
        }""")
        page.evaluate("window.__mise.startDay('server','third'); window.__mise.autoplay(true); window.__mise.speed(6)")
        for _ in range(120):
            page.wait_for_timeout(150)
            if state(page)["day"]["served"] >= 1:
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        mid = page.evaluate("""() => {
          const r = window.Mise.game.restaurant;
          const s = window.__mise.M.profile.shop;
          r.lost += 1;
          s.reputation = Math.max(0, s.reputation - 0.08);
          const stock = Object.values(s.stock).reduce((a, b) => a + b, 0);
          return { repStart: r.repStart, used: r.stockUsed, stock };
        }""")
        page.evaluate("window.Mise.game.pause(); window.Mise.game.action('restart')")
        page.wait_for_timeout(300)
        ask = page.evaluate("[window.__mise.state().overlay, document.getElementById('leave-h').textContent, document.getElementById('btn-leave').textContent]")
        if ask[0] != "leave" or "over" not in ask[1]:
            bad9.append(f"Start over with a served table did not ask first: {ask}")
        else:
            click(page, "#btn-leave")
        page.wait_for_timeout(300)
        after = page.evaluate("""() => {
          const s = window.__mise.M.profile.shop;
          const r = window.Mise.game.restaurant;
          return {
            rep: s.reputation, day: s.day, coins: s.coins, history: s.history.length,
            stock: Object.values(s.stock).reduce((a, b) => a + b, 0),
            fresh: !!r && r.served === 0 && r.lost === 0 && r.earned === 0,
          };
        }""")
        if abs(after["rep"] - mid["repStart"]) > 1e-9:
            bad9.append(f"reputation not restored on restart: {after['rep']} vs {mid['repStart']}")
        if after["day"] != 3 or after["history"] != before["history"] or after["coins"] != before["coins"]:
            bad9.append(f"day/history/coins changed on restart: before {before}, after {after}")
        if mid["used"] > 0 and after["stock"] != mid["stock"]:
            bad9.append(f"used ingredients changed on restart: {mid['stock']} -> {after['stock']}")
        if not after["fresh"]:
            bad9.append("restarted service did not start fresh")
        results["n3b"] = {"before": before, "mid": mid, "after": after, "bad": bad9}
        gate("N3b Pause > Restart day: same accounting as leaving (reputation restored, day/coins/history kept, used ingredients stay used)", not bad9, "; ".join(bad9) or "ok")

        # ---- N3c leaving mid-dish keeps the promise in the dialog: no coins, ingredients or journal entry change
        bad11 = []
        fresh(page, url)
        page.evaluate("window.Mise.profile.tips = { back: true }; window.__mise.M.saveProfile()")
        snap_js = """() => {
          const p = window.__mise.M.profile;
          return {
            coins: p.shop.coins,
            stock: Object.values(p.shop.stock).reduce((a, b) => a + b, 0),
            journal: p.home.journal.length,
            cooked: JSON.stringify(p.home.cooked),
          };
        }"""
        before_dish = page.evaluate(snap_js)
        page.evaluate("window.__mise.startHome('salad','first'); window.__mise.autoplay(true); window.__mise.speed(6)")
        for _ in range(120):
            page.wait_for_timeout(150)
            if state(page)["step"] >= 1:
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        if state(page)["step"] < 1:
            bad11.append("could not finish a step before leaving")
        click(page, "#screen-game [data-back]")
        if state(page)["overlay"] != "leave":
            bad11.append(f"Back mid-dish gave overlay {state(page)['overlay']} (want the leave question)")
        else:
            click(page, "#btn-leave")
        s = state(page)
        after_dish = page.evaluate(snap_js)
        if s["screen"] != "home" or s["overlay"]:
            bad11.append(f"Leave gave {s['screen']}/{s['overlay']} (want the cookbook)")
        if after_dish != before_dish:
            bad11.append(f"profile changed by leaving mid-dish: {before_dish} -> {after_dish}")
        results["n3c"] = {"before": before_dish, "after": after_dish, "bad": bad11}
        gate("N3c leaving mid-dish changes nothing the dialog promises to keep (coins, ingredients, journal, cooked counts)", not bad11, "; ".join(bad11) or "ok")

        # ---- N4f a visible Back inside the dish result and day summary (touch screens without a Back key)
        bad12 = []
        for kind in ("result", "day"):
            fresh(page, url)
            page.evaluate("window.Mise.profile.tips = { back: true }; window.__mise.M.saveProfile()")
            if kind == "result":
                page.evaluate("window.__mise.startHome('salad','first'); window.__mise.autoplay(true); window.__mise.speed(6)")
                for _ in range(240):
                    page.wait_for_timeout(150)
                    if state(page)["overlay"] == "result":
                        break
                page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
            else:
                page.evaluate("window.__mise.startDay('server','third')")
                page.wait_for_timeout(400)
                page.evaluate("window.Mise.game.restaurant.endDay()")
                for _ in range(20):
                    page.wait_for_timeout(150)
                    if state(page)["overlay"] == "day":
                        break
            if state(page)["overlay"] != kind:
                bad12.append(f"{kind} dialog never appeared")
                continue
            page.wait_for_timeout(300)
            info = page.evaluate("""(kind) => {
              const ov = document.getElementById('ov-' + kind);
              const b = ov.querySelector('.sheet-back');
              const sheet = ov.querySelector('.sheet');
              if (!b) return null;
              const r = b.getBoundingClientRect();
              const s = sheet.getBoundingClientRect();
              const st = getComputedStyle(b);
              return {
                h: r.height, w: r.width, top: r.top - s.top,
                text: b.textContent.trim(), label: b.getAttribute('aria-label') || '',
                visible: st.visibility !== 'hidden' && st.display !== 'none' && r.width > 0,
                focusIsBack: document.activeElement === b,
                focusAct: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.act : null,
              };
            }""", kind)
            if not info:
                bad12.append(f"no Back button inside the {kind} dialog")
                continue
            if not info["visible"] or info["h"] < 44 or info["text"] != "Back" or info["w"] > 140 or not info["label"].startswith("Back to "):
                bad12.append(f"{kind} Back not a visible 40 px pill reading Back: {info}")
            if info["top"] > 90:
                bad12.append(f"{kind} Back not at the top of the sheet (top offset {info['top']:.0f} px)")
            if info["focusIsBack"]:
                bad12.append(f"{kind} dialog opened with focus on Back instead of its main choice")
            page.locator(f"#ov-{kind} .sheet-back").click()
            page.wait_for_timeout(350)
            s = state(page)
            if s["screen"] != "game" or s["overlay"]:
                bad12.append(f"{kind} Back gave {s['screen']}/{s['overlay']} (want the dialog closed over the finished kitchen)")
            if kind == "result":
                page.screenshot(path=str(OUT / "result-back-closed.png"))
        results["n4f_bad"] = bad12
        gate("N4f the dish result and day summary carry their own Back pill (44 px like the top bar, label 'Back to ...', top of the sheet, not the default focus) that closes the dialog one level up", not bad12, "; ".join(bad12) or "ok")

        # ---- N3d Pause > Start over asks first when work would be lost (same dialog, safe choice focused)
        bad13 = []
        fresh(page, url)
        page.evaluate("window.Mise.profile.tips = { back: true }; window.__mise.M.saveProfile()")
        page.evaluate("window.__mise.startHome('salad','first')")
        page.wait_for_timeout(600)
        page.evaluate("window.Mise.game.pause(); window.Mise.game.action('restart')")
        page.wait_for_timeout(300)
        if state(page)["overlay"]:
            bad13.append(f"Start over on an untouched dish asked anyway (overlay {state(page)['overlay']})")
        page.evaluate("window.__mise.autoplay(true); window.__mise.speed(6)")
        for _ in range(120):
            page.wait_for_timeout(150)
            if state(page)["step"] >= 1:
                break
        page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")
        step_before = state(page)["step"]
        page.evaluate("window.Mise.game.pause(); window.Mise.game.action('restart')")
        page.wait_for_timeout(300)
        ask = page.evaluate("""() => ({
          overlay: window.__mise.state().overlay,
          head: document.getElementById('leave-h').textContent,
          detail: document.getElementById('leave-detail').textContent,
          go: document.getElementById('btn-leave').textContent,
          focus: document.activeElement && document.activeElement.id,
        })""")
        if ask["overlay"] != "leave" or ask["head"] != "Start this dish over?":
            bad13.append(f"Start over mid-dish did not ask first: {ask}")
        if "starts again from step 1" not in ask["detail"] or ask["go"] != "Start the dish over":
            bad13.append(f"restart wording wrong: {ask}")
        if ask["focus"] != "btn-stay":
            bad13.append(f"restart question opened on {ask['focus']} (want Keep cooking)")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        s = state(page)
        if s["overlay"] or s["step"] != step_before:
            bad13.append(f"Esc on the restart question lost progress: overlay={s['overlay']} step {step_before}->{s['step']}")
        page.evaluate("window.Mise.game.pause(); window.Mise.game.action('restart')")
        page.wait_for_timeout(300)
        if state(page)["overlay"] == "leave":
            click(page, "#btn-leave")
        page.wait_for_timeout(400)
        s = state(page)
        if s["screen"] != "game" or s["overlay"] or s["step"] != 0:
            bad13.append(f"Start the dish over gave {s['screen']}/{s['overlay']} step {s['step']} (want the same dish at step 1)")
        results["n3d_bad"] = bad13
        gate("N3d Pause > Start over asks first when work would be lost (exact words, safe choice focused, Esc keeps progress), restarts at once when nothing would be lost", not bad13, "; ".join(bad13) or "ok")

        # ---- N4e focus returns to the control that opened a dialog
        bad10 = []
        fresh(page, url)
        page.evaluate("window.Mise.profile.tips = { back: true }; window.__mise.startHome('salad','first')")
        page.wait_for_timeout(400)
        page.mouse.click(640, 420)
        page.wait_for_timeout(150)
        # reach the Back pill the way a keyboard user does: Tab from the page
        reached = False
        for _ in range(12):
            page.keyboard.press("Tab")
            if page.evaluate("document.activeElement && document.activeElement.id") == "btn-back":
                reached = True
                break
        if not reached:
            bad10.append("Back pill cannot be reached with Tab in the kitchen")
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        if state(page)["overlay"] != "leave":
            bad10.append("Back pill (Tab + Enter) did not open the leave dialog")
        else:
            focused_in = page.evaluate("document.activeElement && document.activeElement.id")
            if focused_in != "btn-stay":
                bad10.append(f"leave dialog did not focus Keep cooking first (focus on {focused_in!r})")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            back_to = page.evaluate("document.activeElement && document.activeElement.id")
            if back_to != "btn-back":
                bad10.append(f"focus did not return to the Back pill after Keep cooking (on {back_to!r})")
        # Space on a Tab-focused Pause pauses; Space after a mouse click on the board still cooks
        for _ in range(12):
            if page.evaluate("document.activeElement && document.activeElement.id") == "btn-pause":
                break
            page.keyboard.press("Tab")
        page.keyboard.press("Space")
        page.wait_for_timeout(300)
        if state(page)["overlay"] != "pause":
            bad10.append("Space on a Tab-focused Pause did not pause")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        results["n4e_bad"] = bad10
        gate("N4e keyboard focus: the leave dialog opens on the safe choice and focus returns to Back when it closes", not bad10, "; ".join(bad10) or "ok")

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
