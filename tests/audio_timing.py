"""Quick CPU-cost check: offline render time of selected sounds versus their duration.

Usage: python tests/audio_timing.py [id ...]
A realtime factor well below 1.0 means the sound is cheap enough to play live.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IDS = sys.argv[1:] or ["chop-cucumber", "loop-sizzle", "loop-stir-tongs", "loop-stir-spatula"]

JS = """async (id) => {
  const A = window.Mise.audio;
  const item = A.catalog.find((c) => c.id === id);
  const t0 = performance.now();
  const d = await A.renderOffline(id);
  const ms = performance.now() - t0;
  let peak = 0;
  for (const v of d.l) peak = Math.max(peak, Math.abs(v));
  return { id, ms: Math.round(ms), dur_ms: item.ms + 400, factor: +(ms / (item.ms + 400)).toFixed(3), peak: +peak.toFixed(3) };
}"""


def main():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, channel="msedge")
        page = browser.new_page()
        page.goto((ROOT / "index.html").as_uri())
        page.wait_for_timeout(600)
        for sid in IDS:
            print(json.dumps(page.evaluate(JS, sid)), flush=True)
        browser.close()


if __name__ == "__main__":
    main()
