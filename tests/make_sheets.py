"""Build the three judge contact sheets from tests/out/shots into a hone round folder.

Run:  python tests/make_sheets.py hone/r2
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "tests" / "out" / "shots"
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "hone/rN")
OUT.mkdir(parents=True, exist_ok=True)
GAP = 8
BG = (255, 255, 255)


def grid(names, cols, tile_w, tile_h, out_name):
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGB", (GAP + cols * (tile_w + GAP), GAP + rows * (tile_h + GAP)), BG)
    for index, name in enumerate(names):
        shot = Image.open(SHOTS / f"{name}.png").convert("RGB").resize((tile_w, tile_h), Image.LANCZOS)
        col = index % cols
        row = index // cols
        sheet.paste(shot, (GAP + col * (tile_w + GAP), GAP + row * (tile_h + GAP)))
    sheet.save(OUT / out_name)
    print(out_name, sheet.size)


grid(
    ["cook-fp-chop-1440", "cook-fp-fry-1440", "cook-tp-1440", "serve-tp-1440", "serve-fp-1440", "chef-fp-1440"],
    2, 720, 450, "sheet-game.png",
)
grid(["title-1440", "home-1440", "result-1440", "shop-menu-1440"], 2, 720, 450, "sheet-ui.png")
grid(
    ["title-390", "home-390", "shop-390", "cook-fp-chop-390", "cook-tp-390", "serve-tp-390"],
    6, 300, 649, "sheet-mobile.png",
)
