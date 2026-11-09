"""Device-emulated run of tests/DEVICE_CHECKLIST.md (steps 1-8) for Mise.

Run:  python tests/device_emul.py [OUT_DIR]
Plays each checklist step with touch taps on an emulated iPhone 13 (WebKit, the Safari engine) and
Pixel 7 (Chromium), portrait and landscape. System Back is history.back(): the real hardware / edge-swipe
gesture cannot be driven here, so tests/DEVICE_CHECKLIST.md on real phones stays the final word.
Exit 0 only if every step passes on every device.
"""
import functools
import http.server
import json
import os
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests" / "out" / "device_emul"
OUT.mkdir(parents=True, exist_ok=True)

# the local server is on 127.0.0.1: keep it off any system proxy (WebKit honours HTTP(S)_PROXY)
for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
    os.environ.pop(key, None)
os.environ["NO_PROXY"] = os.environ.get("NO_PROXY", "") + ",127.0.0.1,localhost"

DEVICES = [("iPhone 13", "webkit"), ("Pixel 7", "chromium")]
results = {}
failures = []


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/index.html"


def state(page):
    return page.evaluate("window.__mise.state()")


def fresh(page, url):
    page.goto("about:blank")
    page.goto(url)
    page.wait_for_function("window.Mise && window.Mise.ui && window.__mise", timeout=15000)
    page.wait_for_timeout(200)
    page.evaluate("window.Mise.resetProfile()")
    page.evaluate("window.Mise.ui.show('title')")
    page.wait_for_timeout(150)


def tap(page, selector):
    page.locator(selector).first.tap()
    page.wait_for_timeout(300)


def back(page):
    page.evaluate("history.back()")
    page.wait_for_timeout(500)


def in_game(page, url):
    return page.url.startswith(url.split("index.html")[0])


def cook_until(page, test, limit=200):
    page.evaluate("window.__mise.autoplay(true); window.__mise.speed(6)")
    for _ in range(limit):
        page.wait_for_timeout(150)
        if test(state(page)):
            break
    page.evaluate("window.__mise.autoplay(false); window.__mise.speed(1)")


def check(label, ok, detail):
    results[label] = {"pass": bool(ok), "detail": detail}
    print(("PASS " if ok else "FAIL ") + label + "  " + str(detail)[:240], flush=True)
    if not ok:
        failures.append(label)


def run_steps(page, url, tag):
    # 1. Title > Cook at home > Back returns to the title
    fresh(page, url)
    tap(page, "#screen-title [data-go=home]")
    back(page)
    s = state(page)
    check(f"{tag} 1 cookbook > Back = title", s["screen"] == "title", s["screen"])

    # 2. Back on the title leaves the site normally (no trap)
    back(page)
    check(f"{tag} 2 title > Back leaves the game", page.url == "about:blank", page.url)

    # 3. Untouched dish > Back = cookbook, no question
    fresh(page, url)
    tap(page, "#screen-title [data-go=home]")
    tap(page, "#btn-cook")
    back(page)
    s = state(page)
    check(f"{tag} 3 untouched dish > Back = cookbook", s["screen"] == "home" and not s["overlay"], f"{s['screen']}/{s['overlay']}")

    # 4. Dish with work > Back asks; Back again keeps cooking with the work kept
    fresh(page, url)
    tap(page, "#screen-title [data-go=home]")
    tap(page, "#btn-cook")
    cook_until(page, lambda st: (st["step"] or 0) >= 1, limit=60)
    step_before = state(page)["step"]
    back(page)
    asked = state(page)
    back(page)
    kept = state(page)
    ok = asked["overlay"] == "leave" and not kept["overlay"] and kept["screen"] == "game" and kept["step"] == step_before
    check(f"{tag} 4 dish with work > Back asks, Back again keeps cooking", ok,
          f"asked={asked['overlay']} then {kept['screen']}/{kept['overlay']} step {kept['step']} vs {step_before}")

    # 5. Finished dish: Back closes the result card, Back again opens the cookbook
    fresh(page, url)
    page.evaluate("window.__mise.startHome('salad','first')")
    page.wait_for_timeout(300)
    cook_until(page, lambda st: st["overlay"] == "result")
    shown = state(page)["overlay"]
    back(page)
    closed = state(page)
    back(page)
    after = state(page)
    ok = shown == "result" and closed["screen"] == "game" and not closed["overlay"] and after["screen"] == "home"
    check(f"{tag} 5 result > Back closes card, Back again = cookbook", ok,
          f"{shown} -> {closed['screen']}/{closed['overlay']} -> {after['screen']}")


def run_service_steps(page, url, tag):
    # 6. Serve a table, Back: the dialog lists what is lost; Leave keeps reputation and day unchanged
    fresh(page, url)
    before = page.evaluate("({rep: window.__mise.M.profile.shop.reputation, day: window.__mise.M.profile.shop.day})")
    page.evaluate("window.__mise.startDay('server','third')")
    page.wait_for_timeout(300)
    cook_until(page, lambda st: (st.get("day") or {}).get("served", 0) >= 1, limit=400)
    served = (state(page).get("day") or {}).get("served", 0)
    back(page)
    asked = state(page)
    text = page.evaluate("(document.getElementById('leave-h')?.textContent || '') + ' ' + (document.getElementById('ov-leave')?.textContent || '')")
    tap(page, "#btn-leave")
    page.wait_for_timeout(300)
    after = page.evaluate("({rep: window.__mise.M.profile.shop.reputation, day: window.__mise.M.profile.shop.day, screen: window.__mise.state().screen})")
    ok = served >= 1 and asked["overlay"] == "leave" and "serv" in text.lower() and after["screen"] == "shop" \
        and abs(after["rep"] - before["rep"]) < 1e-9 and after["day"] == before["day"]
    check(f"{tag} 6 service > Back asks with losses, Leave keeps reputation/day", ok,
          f"served={served} overlay={asked['overlay']} after={after} before={before}")

    # 7. Finish a day: Back closes the summary, Back again opens Manage (the restaurant screen)
    fresh(page, url)
    page.evaluate("window.__mise.startDay('server','third')")
    page.wait_for_timeout(300)
    cook_until(page, lambda st: (st.get("day") or {}).get("served", 0) >= 1, limit=400)
    page.evaluate("window.Mise.game.restaurant.endDay()")
    page.wait_for_timeout(600)
    shown = state(page)["overlay"]
    back(page)
    closed = state(page)
    back(page)
    after = state(page)
    ok = bool(shown) and not closed["overlay"] and closed["screen"] == "game" and after["screen"] == "shop"
    check(f"{tag} 7 day summary > Back closes, Back again = Manage", ok,
          f"{shown} -> {closed['screen']}/{closed['overlay']} -> {after['screen']}")


def main():
    httpd, url = serve()
    with sync_playwright() as pw:
        for device_name, engine in DEVICES:
            descriptor = dict(pw.devices[device_name])
            descriptor.pop("default_browser_type", None)
            browser = getattr(pw, engine).launch(headless=True)
            context = browser.new_context(**descriptor)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            tag = device_name
            run_steps(page, url, f"{tag} portrait")
            run_service_steps(page, url, f"{tag} portrait")
            # 8. rotate: repeat steps 1-5 in landscape
            w, h = descriptor["viewport"]["width"], descriptor["viewport"]["height"]
            page.set_viewport_size({"width": h, "height": w})
            run_steps(page, url, f"{tag} landscape")
            overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"{tag} landscape no sideways overflow", overflow <= 0, overflow)
            page.set_viewport_size({"width": w, "height": h})
            fresh(page, url)
            page.screenshot(path=str(OUT / f"{device_name.replace(' ', '_')}-title.png"))
            check(f"{tag} no JS errors", not errors, errors[:2])
            browser.close()
    httpd.shutdown()
    (OUT / "device_emul.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    print(f"{len(results) - len(failures)}/{len(results)} pass")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
