#!/usr/bin/env bash
# Downloads every image the site still loads from Framer's CDN into assets/img/
# and rewrites the HTML/CSS to use the local copies.
# Run from the project root:  bash scripts/localize-assets.sh
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p assets/img

files=$(find . -type f \( -name "*.html" -o -name "*.css" \) -not -path "./node_modules/*")
urls=$(grep -ohE "https://framerusercontent\.com/images/[A-Za-z0-9]+\.(png|jpe?g|webp|svg|gif)" $files | sort -u)

if [ -z "$urls" ]; then
  echo "Nothing to localize — all images are already local."
  exit 0
fi

for url in $urls; do
  name=$(basename "$url")
  if [ ! -s "assets/img/$name" ]; then
    echo "↓ $name"
    curl -fsSL "$url" -o "assets/img/$name"
  fi
  for f in $files; do
    sed -i.bak "s#${url}#/assets/img/${name}#g" "$f" && rm -f "$f.bak"
  done
done

echo "Done. $(echo "$urls" | wc -l | tr -d ' ') images saved to assets/img/ and references updated."
