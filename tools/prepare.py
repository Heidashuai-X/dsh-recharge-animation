#!/usr/bin/env python3
"""Inline the brand mark into the client bundle.

`src/client.template.js` is the readable source of `lib/client.js`; the only
generated part is the `__LOGO_DATA_URI__` placeholder, which becomes a base64
data URI of `assets/logo-384.png`. Run this after editing the template:

    python tools/prepare.py
"""

import base64
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "assets", "logo-384.png")
TEMPLATE = os.path.join(ROOT, "src", "client.template.js")
OUTPUT = os.path.join(ROOT, "lib", "client.js")
PLACEHOLDER = "__LOGO_DATA_URI__"


def main():
    with open(LOGO, "rb") as handle:
        raw = handle.read()
    uri = "data:image/png;base64," + base64.b64encode(raw).decode("ascii")

    with open(TEMPLATE, "r", encoding="utf-8") as handle:
        source = handle.read()
    if PLACEHOLDER not in source:
        sys.exit("placeholder %s missing from %s" % (PLACEHOLDER, TEMPLATE))

    source = source.replace(PLACEHOLDER, uri)
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(source)

    print("logo   : %s (%d bytes)" % (LOGO, len(raw)))
    print("output : %s (%d bytes)" % (OUTPUT, len(source)))


if __name__ == "__main__":
    main()
