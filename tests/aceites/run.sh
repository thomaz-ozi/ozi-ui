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

# Falhas conhecidas e registradas: rodam e aparecem como aviso, mas não derrubam o job.
# Cada entrada precisa de motivo e de onde está registrada. Tire daqui assim que passar.
#   aceite-temas.html — overrides.css do tema tailwind perde a cascata para o CSS do componente,
#     que o loader injeta depois (mesma especificidade): padding do select 6px, não 8px, em
#     janela ≥ 769px. No Windows sem --window-size a janela headless padrão caía no
#     @media (max-width: 768px), que também põe 8px, e mascarava o bug. Ver roadmap
#     lancamento-publico.md (F2, achados).
KNOWN_FAIL=" aceite-temas.html "

failed=0
passed=0
known=0
flaky=0

# Roda uma página e preenche $dom e $verdict.
run_page() {
    # timeout: uma página que nunca fica ociosa pendura o --dump-dom; vira falha, não trava o job.
    # host-resolver-rules: rede externa bloqueada (hermético). Algumas páginas usam URLs de imagem
    # reais (exemplo.com…) como fixture; com --virtual-time-budget o relógio virtual pausa enquanto
    # há requisição pendente, e numa rede lenta a página nunca termina.
    # window-size fixo (= padrão do Chrome headless, onde as páginas foram validadas): sem ele a
    # janela varia por SO/DPI e muda quais @media valem.
    dom=$(timeout "${PAGE_TIMEOUT:-90}" "$BROWSER" --headless=new --disable-gpu --no-sandbox --no-first-run \
          --window-size=800,600 --force-device-scale-factor=1 \
          --user-data-dir="$SITE/.profile-$1-$2" \
          --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1" \
          --virtual-time-budget=15000 --dump-dom "http://127.0.0.1:$PORT/teste-v2/$1" 2>/dev/null)
    verdict=$(printf '%s' "$dom" | tr '\n' ' ' | grep -oE 'id="veredito"[^>]*>[^<]*' | sed 's/.*>//')
}

for page in "${PAGES[@]}"; do
    run_page "$page" 1

    is_known=0
    case "$KNOWN_FAIL" in *" $page "*) is_known=1 ;; esac

    # uma nova tentativa para falha não conhecida: separa instável de quebrado
    retried=0
    if [ "$is_known" -eq 0 ] && ! printf '%s' "$verdict" | grep -q 'PASSOU'; then
        first_verdict=$verdict
        run_page "$page" 2
        retried=1
    fi

    if printf '%s' "$verdict" | grep -q 'PASSOU'; then
        echo "✔ $page — $verdict"
        passed=$((passed + 1))
        if [ "$retried" -eq 1 ]; then
            echo "  ↳ instável: falhou na 1ª tentativa (${first_verdict:-sem veredito}) e passou na 2ª"
            [ -n "${GITHUB_ACTIONS:-}" ] && echo "::warning title=aceite $page (instável)::falhou na 1ª tentativa e passou na 2ª: ${first_verdict:-sem veredito}"
            flaky=$((flaky + 1))
        fi
        if [ "$is_known" -eq 1 ]; then
            echo "  ↳ está em KNOWN_FAIL mas passou: tire da lista"
            [ -n "${GITHUB_ACTIONS:-}" ] && echo "::warning title=aceite $page::passou, mas está em KNOWN_FAIL; tire da lista"
        fi
    elif [ "$is_known" -eq 1 ]; then
        echo "⚠ $page — ${verdict:-sem veredito} (falha conhecida, não conta)"
        [ -n "${GITHUB_ACTIONS:-}" ] && echo "::warning title=aceite $page (falha conhecida)::${verdict:-sem veredito}"
        known=$((known + 1))
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
echo "Aceites: $passed passaram ($flaky na 2ª tentativa), $failed falharam, $known falha(s) conhecida(s)."
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::notice title=aceites::$passed passaram ($flaky na 2ª tentativa), $failed falharam, $known conhecida(s)"
[ "$failed" -eq 0 ]
