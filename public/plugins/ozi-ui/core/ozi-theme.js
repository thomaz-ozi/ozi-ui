/**
 *  ------------------------------------------
 *  ozi-theme
 *  ------------------------------------------
 *  Ver: 1.0.0
 *  2026-10-29
 *
 *  v1.0.0 — subsistema novo (pacote 2.8.0). Dá vida ao `themeMode` do ozi-conf, que existia
 *    desde a v2 mas nada lia, e acrescenta o modo 'app': o ozi-ui segue o tema DO APP, não o
 *    do sistema operacional. Origem: [OZI-09]/[OZI-10] do SNDESK, app com tema escuro próprio
 *    (`body.dark-mode`) — a lista do select ficava branca no app escuro e o editor escurecia
 *    pelo Windows com o app claro.
 *
 * Responsabilidade:
 *   - Escreve `data-ozi-theme="light|dark"` no <html> conforme o modo. Todo o CSS do ozi-ui
 *     (componentes e themes/*\/dark.css) já reage a esse atributo; nenhum CSS muda de contrato.
 *
 * Modos (oziConf({ themeMode }) ou <html data-ozi-theme-mode="...">; o oziConf vence):
 *   'auto'  — padrão. Não toca no <html>: o CSS segue o sistema (@media prefers-color-scheme).
 *             Mesmo comportamento de antes desta versão.
 *   'light' — força claro.   'dark' — força escuro.
 *   'app'   — detecta o tema do app, em camadas, da mais explícita para a mais genérica:
 *               1. `data-bs-theme` no <html>/<body> (Bootstrap 5.3)
 *               2. classe `dark` no <html> (convenção do Tailwind)
 *               3. luminância do fundo calculado do <body>, depois do <html>
 *               4. fundo transparente → a tela é o canvas do navegador: branco, salvo
 *                  `color-scheme` escuro no <html> ('light dark' consulta o sistema)
 *             e reavalia quando o app troca de tema (atributos de <html>/<body>, fim de
 *             transição do fundo, `load`, mudança do tema do sistema).
 *
 * Expõe: window.OziTheme (o boot liga em OZI.theme)
 *
 * ⚠️ MutationObserver aqui é exceção consciente à R5 (que veta observer para RE-INIT pós-morph,
 * papel do ozi-hooks): este observa só ATRIBUTOS de 2 nós (<html>, <body>), com filtro, e só
 * existe no modo 'app'. O filtro NÃO inclui `data-ozi-theme` — é o atributo que este arquivo
 * escreve; incluí-lo faria o observer reagir à própria escrita.
 *
 * NÃO depende de nenhum outro subsistema OZI (o ozi-conf o chama se ele existir).
 */

(function (window, document) {
    'use strict';

    // [1] GUARD singleton
    if (window.OziTheme) return;

    /* ─────────────────────────────────────────────
     * [2] CONSTANTES
     * ───────────────────────────────────────────── */

    var MODES = ['auto', 'light', 'dark', 'app'];

    // atributos que o app usa para trocar de tema (ver camadas no cabeçalho)
    var WATCHED_ATTRS = ['class', 'style', 'data-bs-theme', 'data-theme', 'data-ozi-theme-mode'];

    // luminância relativa (WCAG) abaixo disto = fundo escuro. 0.18 ≈ cinza médio
    // perceptual (L* 50): #1f2937 dá 0.02, #f3f4f6 dá 0.90 — sobra margem dos dois lados.
    var DARK_LUMINANCE = 0.18;

    /* ─────────────────────────────────────────────
     * [3] ESTADO
     * ───────────────────────────────────────────── */

    var root = document.documentElement;

    var _mode     = 'auto';
    var _owned    = false;   // o data-ozi-theme atual foi escrito por este arquivo
    var _hostAttr = null;    // valor que o host tinha antes de assumirmos (restaurado no 'auto')
    var _observer = null;
    var _mql      = null;
    var _canvas   = null;

    /* ─────────────────────────────────────────────
     * [4] LEITURA DE COR
     * ───────────────────────────────────────────── */

    // → [r, g, b, a] (0–255, alpha 0–1) ou null
    function _parseColor(value) {
        if (!value) return null;
        var m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(value.trim());
        if (m) {
            var a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
            return [+m[1], +m[2], +m[3], a];
        }
        // oklch()/color()/lab() — o computed style de cores modernas (Tailwind 4 usa oklch)
        // não sai em rgb(). O canvas aceita qualquer cor CSS e devolve sRGB.
        try {
            _canvas = _canvas || document.createElement('canvas');
            _canvas.width = _canvas.height = 1;
            var ctx = _canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return null;
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = '#000';
            ctx.fillStyle = value;
            ctx.fillRect(0, 0, 1, 1);
            var d = ctx.getImageData(0, 0, 1, 1).data;
            return [d[0], d[1], d[2], d[3] / 255];
        } catch (e) {
            return null;
        }
    }

    function _luminance(rgb) {
        var c = rgb.slice(0, 3).map(function (v) {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    /* ─────────────────────────────────────────────
     * [5] DETECÇÃO DO TEMA DO APP (modo 'app')
     * ───────────────────────────────────────────── */

    function _systemDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // → 'light' | 'dark'
    function _detect() {
        var body = document.body;

        // 1. Bootstrap 5.3
        var bs = root.getAttribute('data-bs-theme') || (body && body.getAttribute('data-bs-theme'));
        if (bs === 'dark' || bs === 'light') return bs;

        // 2. Tailwind (darkMode: 'class')
        if (root.classList.contains('dark')) return 'dark';

        // 3. fundo calculado — o primeiro com cor visível
        var els = body ? [body, root] : [root];
        for (var i = 0; i < els.length; i++) {
            var rgba = _parseColor(window.getComputedStyle(els[i]).backgroundColor);
            if (rgba && rgba[3] > 0.5) return _luminance(rgba) < DARK_LUMINANCE ? 'dark' : 'light';
        }

        // 4. tudo transparente: o que aparece é o canvas do navegador
        var scheme = (window.getComputedStyle(root).colorScheme || '').toLowerCase();
        var hasDark = scheme.indexOf('dark') !== -1;
        var hasLight = scheme.indexOf('light') !== -1;
        if (hasDark && !hasLight) return 'dark';
        if (hasDark && hasLight) return _systemDark() ? 'dark' : 'light';
        return 'light';
    }

    /* ─────────────────────────────────────────────
     * [6] ESCRITA NO <html>
     * ───────────────────────────────────────────── */

    function _write(theme) {
        if (!_owned) {
            _hostAttr = root.getAttribute('data-ozi-theme');
            _owned = true;
        }
        if (root.getAttribute('data-ozi-theme') !== theme) root.setAttribute('data-ozi-theme', theme);
    }

    function _release() {
        if (!_owned) return;
        if (_hostAttr === null) root.removeAttribute('data-ozi-theme');
        else root.setAttribute('data-ozi-theme', _hostAttr);
        _owned = false;
        _hostAttr = null;
    }

    function refresh() {
        if (_mode === 'app') _write(_detect());
    }

    /* ─────────────────────────────────────────────
     * [7] OBSERVADORES (só no modo 'app')
     * ───────────────────────────────────────────── */

    function _onMutation(records) {
        for (var i = 0; i < records.length; i++) {
            if (records[i].target === root && records[i].attributeName === 'data-ozi-theme-mode') {
                var attrMode = root.getAttribute('data-ozi-theme-mode');
                if (attrMode && attrMode !== _mode) { setMode(attrMode); return; }
            }
        }
        refresh();
    }

    function _onTransitionEnd(e) {
        if ((e.target === document.body || e.target === root) &&
            /background/.test(e.propertyName || '')) refresh();
    }

    function _observeBody() {
        if (_observer && document.body) {
            _observer.observe(document.body, { attributes: true, attributeFilter: WATCHED_ATTRS });
        }
    }

    function _onDomReady() {
        document.removeEventListener('DOMContentLoaded', _onDomReady);
        if (_mode !== 'app') return;
        _observeBody();
        refresh();
    }

    function _start() {
        if (_observer || typeof MutationObserver === 'undefined') { refresh(); return; }

        _observer = new MutationObserver(_onMutation);
        _observer.observe(root, { attributes: true, attributeFilter: WATCHED_ATTRS });

        document.addEventListener('transitionend', _onTransitionEnd, true);
        window.addEventListener('load', refresh);

        if (window.matchMedia) {
            _mql = window.matchMedia('(prefers-color-scheme: dark)');
            if (_mql.addEventListener) _mql.addEventListener('change', refresh);
        }

        // @oziScripts roda no <head>: o <body> ainda não existe, e é nele que o app costuma
        // pôr o fundo. Até lá, a leitura do <html> já dá um palpite.
        if (document.body) _observeBody();
        else document.addEventListener('DOMContentLoaded', _onDomReady);

        refresh();
    }

    function _stop() {
        if (_observer) { _observer.disconnect(); _observer = null; }
        document.removeEventListener('transitionend', _onTransitionEnd, true);
        document.removeEventListener('DOMContentLoaded', _onDomReady);
        window.removeEventListener('load', refresh);
        if (_mql && _mql.removeEventListener) _mql.removeEventListener('change', refresh);
        _mql = null;
    }

    /* ─────────────────────────────────────────────
     * [8] API PÚBLICA
     * ───────────────────────────────────────────── */

    function setMode(mode) {
        mode = String(mode || '').trim().toLowerCase();
        if (MODES.indexOf(mode) === -1) {
            console.warn('[OZI:theme] themeMode inválido ignorado: "' + mode + '" (use ' + MODES.join(' | ') + ')');
            return;
        }

        var previous = _mode;
        _mode = mode;

        if (mode === 'app') { _start(); return; }
        if (previous === 'app') _stop();

        if (mode === 'auto') _release();
        else _write(mode);
    }

    var OziTheme = {
        setMode: setMode,
        refresh: refresh,

        /** Modo ativo: 'auto' | 'light' | 'dark' | 'app' */
        mode: function () { return _mode; },

        /**
         * Tema efetivo: 'light' | 'dark'. No 'auto' é o do sistema (é o que o CSS aplica);
         * nos outros, o valor escrito no <html>.
         */
        current: function () {
            if (_mode === 'auto') {
                var attr = root.getAttribute('data-ozi-theme');
                if (attr === 'light' || attr === 'dark') return attr;
                return _systemDark() ? 'dark' : 'light';
            }
            return root.getAttribute('data-ozi-theme');
        }
    };

    window.OziTheme = OziTheme;

    // [9] modo declarado no markup — vale até um oziConf({ themeMode }) dizer outra coisa
    var initial = root.getAttribute('data-ozi-theme-mode');
    if (initial) setMode(initial);

})(window, document);
