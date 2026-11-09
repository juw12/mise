"""Build the navigation review sheet (hone/<round>/sheet-nav.png) from nav_check.py and hud_shots.py screenshots.

Run:  python tests/make_nav_sheet.py hone/nav3
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROUND = Path(sys.argv[1])
SHEET_W = 1600
PAD = 20
LABEL_H = 30
BG = (244, 238, 228)
INK = (40, 34, 28)

try:
    FONT = ImageFont.truetype("segoeui.ttf", 20)
except OSError:
    FONT = ImageFont.load_default()


def load(name):
    return Image.open(ROUND / f"{name}.png").convert("RGB")


def fit(img, width):
    ratio = width / img.width
    return img.resize((width, round(img.height * ratio)), Image.LANCZOS)


def main():
    half = (SHEET_W - 3 * PAD) // 2
    third = (SHEET_W - 4 * PAD) // 3
    hud = {}
    for width in (320, 390):
        for label in ("cooking", "restaurant"):
            hud[(label, width)] = Image.open(ROUND / "hud" / f"hud-{label}-{width}.png").convert("RGB")

    rows = [
        ([fit(load("cooking-1440"), SHEET_W - 2 * PAD)],
         ["Kitchen top bar, 1440 px: Back pill (arrow + word Back) left of Pause"]),
        ([fit(load("leave-confirm-day3"), half), fit(load("leave-confirm-cooking"), half)],
         ["Leave a Day 3 service: exact loss list, reputation undone, hint note", "Leave mid-dish (Esc or Back)"]),
        ([fit(load("result-dialog"), half), fit(load("day-dialog"), half)],
         ["Dish result: Back or Esc goes to the cookbook (stated)", "Day summary: Back or Esc opens Manage (stated)"]),
        ([fit(hud[("cooking", 320)], third), fit(hud[("restaurant", 320)], third), fit(load("cooking-320"), 220)],
         ["Top bar at 320 px, cooking", "Top bar at 320 px, service", "Cooking, 320 px"]),
        ([fit(hud[("cooking", 390)], third), fit(hud[("restaurant", 390)], third), fit(load("restaurant-390"), 220)],
         ["Top bar at 390 px, cooking", "Top bar at 390 px, service", "Service, 390 px"]),
    ]

    height = PAD + sum(LABEL_H + max(i.height for i in imgs) + PAD for imgs, _ in rows)
    sheet = Image.new("RGB", (SHEET_W, height), BG)
    draw = ImageDraw.Draw(sheet)
    y = PAD
    for imgs, captions in rows:
        x = PAD
        for img, caption in zip(imgs, captions):
            draw.text((x, y), caption, fill=INK, font=FONT)
            sheet.paste(img, (x, y + LABEL_H))
            x += img.width + PAD
        y += LABEL_H + max(i.height for i in imgs) + PAD
    out = ROUND / "sheet-nav.png"
    sheet.save(out)
    print(out, sheet.size)


main()
