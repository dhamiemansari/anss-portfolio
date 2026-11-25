#!/usr/bin/env python3
"""Stamp every local CSS/JS link in the HTML pages with a content hash
(/css/site.css?v=1a2b3c4d) so browsers fetch the new file right after a deploy
instead of reusing an old cached copy. Run after editing any CSS or JS:

    python3 scripts/version-assets.py
"""
import hashlib, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
pattern = re.compile(r'((?:href|src)=")(/(?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')

def stamp(match):
    path = root / match.group(2).lstrip("/")
    if not path.exists():
        return match.group(0)
    digest = hashlib.sha1(path.read_bytes()).hexdigest()[:8]
    return f"{match.group(1)}{match.group(2)}?v={digest}{match.group(3)}"

for page in sorted(root.glob("*.html")):
    text = page.read_text()
    new = pattern.sub(stamp, text)
    if new != text:
        page.write_text(new)
        print("stamped", page.name)
