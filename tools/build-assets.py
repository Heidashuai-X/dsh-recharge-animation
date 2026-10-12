#!/usr/bin/env python3
"""Rebuild the shipped logo assets from the master artwork.

`assets/logo.png` is the master: an RGBA cut-out whose background is genuinely
transparent. Every shipped asset is derived here, because flattening it through
a plain PNG palette quantisation silently turns that transparency into opaque
black — which shows up as a black tile behind the mark on every surface.

    python tools/build-assets.py

Outputs (both 384x384, both keeping the alpha channel):
    assets/logo-384.png   inlined into lib/client.js by tools/prepare.py
    assets/icon.png       shown by the plugin manager
"""

import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "assets", "logo.png")
LOGO = os.path.join(ROOT, "assets", "logo-384.png")
ICON = os.path.join(ROOT, "assets", "icon.png")

SIZE = 384
PADDING = 8  # transparent breathing room on each side, in output pixels


def main():
    master = Image.open(MASTER).convert("RGBA")
    print("master  : %s %s" % (master.mode, master.size))

    # Trim the fully transparent margin so the character, not the canvas, fills
    # the mark. getbbox() reads the alpha channel only.
    box = master.getchannel("A").getbbox()
    if box:
        master = master.crop(box)
    width, height = master.size
    print("content : %dx%d (trimmed %s)" % (width, height, box))

    inner = SIZE - PADDING * 2
    scale = min(inner / width, inner / height)
    resized = master.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.LANCZOS,
    )
    print("resized : %dx%d" % resized.size)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
    canvas.save(LOGO, "PNG", optimize=True)
    canvas.save(ICON, "PNG", optimize=True)

    for path in (LOGO, ICON):
        saved = Image.open(path)
        hist = saved.getchannel("A").histogram()
        total = saved.size[0] * saved.size[1]
        print("%-16s %s %s %6d bytes  transparent=%5.1f%%  opaque=%5.1f%%" % (
            os.path.basename(path), saved.mode, saved.size, os.path.getsize(path),
            hist[0] * 100.0 / total, hist[255] * 100.0 / total,
        ))


if __name__ == "__main__":
    main()
