#!/usr/bin/env bash
# Aceites JS headless — roda cada página de tests/aceites/ contra os assets DO PACOTE.
#
# Monta um site temporário com o mesmo layout do ozi-ui-dev-hard (plugins/ozi-ui + teste-v2/),
# então as páginas são cópia fiel das do dev-hard, sem edição. Cada página escreve o veredito
# em #veredito; qualquer uma sem "PASSOU" falha o script.
#
# Uso:   bash tests/aceites/run.sh [pagina.html ...]
# Env:   BROWSER=/caminho/do/chrome-ou-edge   PORT=8765   PAGE_TIMEOUT=90 (segundos por página)
#
# ⚠️ Aceite headless mede estado (classList, valor, eventos), não pintura: verde aqui não prova
# que o visual está certo. Ver ozi-ui-ai/logs/lessons-learned.md (2026-09-14 e 2026-08-31).

set -u

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PAGES_DIR="$ROOT/tests/aceites"
PORT=${PORT:-8765}
BROWSER=${BROWSER:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}

if [ -z "$BROWSER" ]; then
    echo "Nenhum Chrome/Chromium encontrado. Defina BROWSER=/caminho/do/navegador." >&2
    exit 2
fi

SITE=$(mktemp -d)
mkdir -p "$SITE/plugins" "$SITE/teste-v2"
cp -r "$ROOT/public/plugins/ozi-ui" "$SITE/plugins/"
cp "$PAGES_DIR"/*.html "$SITE/teste-v2/"

php -S "127.0.0.1:$PORT" -t "$SITE" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf "$SITE"' EXIT
sleep 1

if [ $# -gt 0 ]; then
    PAGES=("$@")
else
    PAGES=()
    for f in "$PAGES_DIR"/*.html; do PAGES+=("$(basename "$f")"); done
fi

failed=0
passed=0

for page in "${PAGES[@]}"; do
    # timeout: uma página que nunca fica ociosa pendura o --dump-dom; vira falha, não trava o job
    dom=$(timeout "${PAGE_TIMEOUT:-90}" "$BROWSER" --headless=new --disable-gpu --no-sandbox --no-first-run \
          --user-data-dir="$SITE/.profile-$page" \
          --virtual-time-budget=15000 --dump-dom "http://127.0.0.1:$PORT/teste-v2/$page" 2>/dev/null)
    verdict=$(printf '%s' "$dom" | tr '\n' ' ' | grep -oE 'id="veredito"[^>]*>[^<]*' | sed 's/.*>//')

    if printf '%s' "$verdict" | grep -q 'PASSOU'; then
        echo "✔ $page — $verdict"
        passed=$((passed + 1))
    else
        echo "✘ $page — ${verdict:-sem veredito}"
        details=$(printf '%s' "$dom" | tr '\n' ' ' | grep -oE '<li class="fail">[^<]*' | sed 's/<li class="fail">/    · /')
        [ -n "$details" ] && echo "$details"
        # no GitHub Actions, vira anotação no run (visível sem abrir o log)
        if [ -n "${GITHUB_ACTIONS:-}" ]; then
            echo "::error title=aceite $page::${verdict:-sem veredito (timeout ou página não carregou)} $(echo "$details" | tr '\n' ' ' | cut -c1-400)"
        fi
        failed=$((failed + 1))
    fi
done

echo
echo "Aceites: $passed passaram, $failed falharam."
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::notice title=aceites::$passed passaram, $failed falharam"
[ "$failed" -eq 0 ]
