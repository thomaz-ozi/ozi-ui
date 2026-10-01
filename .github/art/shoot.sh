#!/usr/bin/env bash
# Regenera as imagens do README a partir de .github/art/src/*.html, com os assets DO PACOTE.
#
# Uso:  bash .github/art/shoot.sh
# Env:  BROWSER=/caminho/do/chrome-ou-edge   PORT=8790
#
# Mesmo layout do runner de aceites: site temporário com plugins/ozi-ui + s/<página>.html.
# As páginas desligam transições (screenshot headless não espera `transition` terminar).

set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ART="$ROOT/.github/art"
PORT=${PORT:-8790}
BROWSER=${BROWSER:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}
[ -n "$BROWSER" ] || { echo "Defina BROWSER=/caminho/do/navegador." >&2; exit 2; }

SITE=$(mktemp -d)
mkdir -p "$SITE/plugins" "$SITE/s"
cp -r "$ROOT/public/plugins/ozi-ui" "$SITE/plugins/"
cp "$ART"/src/*.html "$SITE/s/"

php -S "127.0.0.1:$PORT" -t "$SITE" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf "$SITE"' EXIT
sleep 1

# página  largura,altura (px CSS; a imagem sai em 2x)
for spec in "select 900,395" "editor 900,345" "validate 900,290"; do
    set -- $spec
    out="$ART/$1.png"
    command -v cygpath >/dev/null && out=$(cygpath -w "$out")
    "$BROWSER" --headless=new --disable-gpu --no-sandbox --no-first-run --hide-scrollbars \
        --user-data-dir="$SITE/.profile-$1" --window-size="$2" --force-device-scale-factor=2 \
        --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1" --virtual-time-budget=4000 \
        --screenshot="$out" "http://127.0.0.1:$PORT/s/$1.html" 2>/dev/null
    echo "✔ $1.png"
done
