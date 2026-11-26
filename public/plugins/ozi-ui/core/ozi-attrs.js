/**
 * ------------------------------------------
 * ozi-attrs
 * ------------------------------------------
 * Ver: 1.1.1
 * 2026-11-26
 *
 * Responsabilidade:
 *   - Registro dos atributos `data-ozi-*` que o ozi-ui conhece (todos os plugins, num lugar só).
 *   - Aviso OZI-W001: atributo `data-ozi-*` desconhecido no DOM, com sugestão do nome certo
 *     ("você quis dizer data-ozi-select-required?"). É o erro mais comum de quem escreve o markup
 *     sem conhecer o plugin, humano ou IA: o código parece certo e nada acontece.
 *
 * Quando avisa (decisão #25 — só em desenvolvimento):
 *   1. `oziConf({ warnUnknown: true | false })` explícito vence sempre;
 *   2. senão, com `@oziScripts`, segue o APP_DEBUG do Laravel (boot tag `data-ozi-debug`,
 *      gravado em `OZI.appDebug` pelo core/ozi-assets-boot.js);
 *   3. senão (ozi.js standalone), liga em localhost, 127.0.0.1, ::1, *.localhost, *.test,
 *      *.local e file://. Visitante de site em produção nunca vê o aviso.
 *
 * Como varre:
 *   - Registra `core:attrs` no OZI.hooks.afterRender: roda no boot (fonte `dom`), a cada commit do
 *     Livewire e no `wire:navigate`, sempre no escopo que mudou. Sem OZI.hooks, varre no
 *     DOMContentLoaded.
 *   - Uma vez por elemento e atributo (WeakMap, regra R9): re-render não repete o aviso.
 *   - Varre o DOM inteiro do escopo, não só a raiz de cada componente: pega também erro no NOME do
 *     plugin (`data-ozi-selcet`) e atributo de plugin que nem foi carregado.
 *
 * O registro de um plugin COM manifesto ({tipo}/ozi-{nome}/ozi-{nome}.manifest.json, roadmap
 * ozi-ui-pronto-para-ia.md, N3) é gerado por `node tools/build-manifest.mjs` entre os marcadores
 * `// >>> manifest:{ns}` e `// <<< manifest:{ns}`: não editar à mão, editar o manifesto. O mesmo
 * script confere a deriva código × manifesto e roda no CI com `--check`. Desde a 2.11: select.
 * Os demais plugins seguem escritos à mão aqui até ganharem manifesto. Atributo novo num plugin
 * sem manifesto = entrada aqui, senão o aviso acusa o próprio ozi-ui (o aceite `aceite-attrs.html`
 * e a bateria inteira, que roda com o aviso ligado por estar em 127.0.0.1, pegam isso).
 *
 * Expõe: window.OziAttrs e OZI.attrs — { scan(root?), isKnown(name), suggest(name), enabled(),
 *        known() }.
 *
 * Changelog:
 *   - v1.1.1: registros do autocomplete (2.11.2) e do editor (2.11.3) gerados dos manifestos. No
 *       editor, duas correções de classificação: `data-ozi-editor-counter` (escrito por quem usa,
 *       liga o contador) passa de interno a autor e entra nas sugestões; `data-ozi-editor-type` (o
 *       plugin grava no wrapper) passa de autor a interno e deixa de ser sugerido. Sai a constante
 *       BREAKPOINTS (o manifesto declara a família `tools-{bp}`).
 *   - v1.1.0: [FEAT] registro do select gerado do ozi-select.manifest.json (ozi-ui/core 2.11.0,
 *       N3). Única mudança de comportamento: `data-ozi-select-footer` (o `<template>` do rodapé,
 *       escrito por quem usa o plugin) passa de interno a atributo de autor e entra nas sugestões.
 *   - v1.0.0: [FEAT] criado (ozi-ui/core 2.10.0, N1 do roadmap "pronto para IA").
 */

(function (window, document) {
    'use strict';

    if (window.OziAttrs) return;

    var DOCS_URL = 'https://oziui.com/docs/warnings#ozi-w001';

    // ─────────────────────────────────────────────
    // [1] REGISTRO
    // author:   o que o desenvolvedor escreve no markup (entra nas sugestões)
    // internal: o que os plugins escrevem no DOM que eles mesmos geram (conhecido, nunca sugerido)
    // Sufixo '' = a chave do próprio plugin (`data-ozi-select="key"`).
    // ─────────────────────────────────────────────

    var REGISTRY = {
        // >>> manifest:select — gerado de components/ozi-select/ozi-select.manifest.json por tools/build-manifest.mjs; não editar à mão
        select: {
            author: ['', 'as', 'check', 'creatable', 'creatable-label', 'creatable-sublabel',
                'disabled', 'footer', 'footer-call', 'footer-icon', 'footer-label',
                'image-dimension', 'list', 'log', 'multiple', 'multiple-count', 'multiple-group',
                'multiple-label', 'options', 'required', 'required-message', 'search-icon',
                'search-placeholder', 'submit-extra', 'submit-fields', 'submit-mode', 'submit-name',
                'value-icon', 'value-placeholder', 'zld-delay', 'zld-item-name', 'zld-log',
                'zld-method', 'zld-min', 'zld-param', 'zld-url'],
            internal: ['action', 'creatable-option', 'generated-hidden']
        },
        // <<< manifest:select
        // >>> manifest:autocomplete — gerado de components/ozi-autocomplete/ozi-autocomplete.manifest.json por tools/build-manifest.mjs; não editar à mão
        autocomplete: {
            author: ['', 'as', 'hidden-name', 'log', 'msg-empty', 'msg-search', 'options',
                'required', 'required-message', 'unique', 'unique-message', 'zld-delay', 'zld-log',
                'zld-method', 'zld-min', 'zld-param', 'zld-url'],
            internal: ['hidden']
        },
        // <<< manifest:autocomplete
        // >>> manifest:editor — gerado de components/ozi-editor/ozi-editor.manifest.json por tools/build-manifest.mjs; não editar à mão
        editor: {
            author: ['class', 'counter', 'disabled', 'height', 'html', 'log', 'md', 'placeholder',
                'required', 'required-message', 'sanitize', 'theme', 'tools', 'tools-lg',
                'tools-md', 'tools-scroll', 'tools-scroll-lg', 'tools-scroll-md', 'tools-scroll-sm',
                'tools-scroll-xl', 'tools-scroll-xxl', 'tools-sm', 'tools-xl', 'tools-xxl',
                'uicolor', 'upload-url'],
            internal: ['collapse-id', 'collapse-panel', 'image-align', 'image-align-icon',
                'image-align-pending', 'image-alt-input', 'image-apply', 'image-file-input',
                'image-filename', 'image-height-input', 'image-remove', 'image-url-input',
                'image-width-input', 'link-apply', 'link-input', 'link-remove', 'popover-id',
                'popover-wrap', 'scroll-dir', 'swatch', 'swatch-custom', 'swatch-none',
                'table-action', 'table-apply', 'table-col', 'table-cols', 'table-grid',
                'table-header', 'table-panel', 'table-row', 'table-rows', 'table-size-label',
                'tool', 'tool-blocked', 'toolbar-bp', 'toolbar-bp-until', 'type']
        },
        // <<< manifest:editor
        audio: {
            author: ['', 'bg', 'log', 'preview', 'save-field', 'save-url', 'saved', 'speed', 'title', 'url',
                'volume'],
            internal: []
        },
        auth: {
            author: ['check', 'class', 'confirm', 'disable', 'dropdown', 'list-id', 'mail', 'pass',
                'pass-max', 'pass-min', 'submit', 'user', 'user-caracter'],
            internal: []
        },
        check: {
            author: ['all', 'enabled', 'group', 'item', 'switch'],
            internal: []
        },
        search: {
            author: ['', 'group', 'highlight', 'min', 'multi', 'no-filter', 'pagination', 'pagination-id',
                'words'],
            internal: []
        },
        toggle: {
            author: ['content', 'hide', 'icon', 'options', 'show', 'trigger'],
            internal: []
        },
        livewire: {
            author: ['args', 'call', 'defer', 'model', 'native', 'options-event', 'text-model', 'value'],
            internal: ['bound', 'last-value']
        },
        validate: {
            author: ['', 'group'],
            internal: []
        }
    };

    // atributos sem namespace de plugin (lidos por mais de um, ou pelo core)
    var SHARED_AUTHOR   = ['data-ozi-required', 'data-ozi-required-message', 'data-ozi-theme',
        'data-ozi-theme-mode', 'data-ozi-skin'];
    var SHARED_INTERNAL = ['data-ozi-base', 'data-ozi-locale', 'data-ozi-debug', 'data-ozi-component-hidden', 'data-ozi-group',
        'data-ozi-group-toggle', 'data-ozi-heading', 'data-ozi-class', 'data-ozi-img-tmp', 'data-ozi-page'];

    // nomes que existiram ou que parecem certos, com a resposta pronta
    var SPECIAL = {
        'data-ozi-editor': { suggest: ['data-ozi-editor-html', 'data-ozi-editor-md'] },
        'data-ozi-search-menu': { gone: '2.0' }
    };
    var GONE_PREFIXES = [
        { prefix: 'data-ozi-copy', since: '2.0', hint: 'receitas Alpine' },
        { prefix: 'data-ozi-paste', since: '2.0', hint: 'receitas Alpine' }
    ];

    var _known  = {};   // nome -> true
    var _author = [];   // pool de sugestões

    Object.keys(REGISTRY).forEach(function (ns) {
        var base = 'data-ozi-' + ns;
        REGISTRY[ns].author.forEach(function (s) {
            var n = s ? base + '-' + s : base;
            _known[n] = true; _author.push(n);
        });
        REGISTRY[ns].internal.forEach(function (s) { _known[base + '-' + s] = true; });
    });
    SHARED_AUTHOR.forEach(function (n) { _known[n] = true; _author.push(n); });
    SHARED_INTERNAL.forEach(function (n) { _known[n] = true; });


    // ─────────────────────────────────────────────
    // [2] MENSAGENS (pt-BR / en / es)
    // Registradas no OZI.lang quando ele existe; sem ele, pt-BR (regra R11).
    // ─────────────────────────────────────────────

    var DICT = {
        'pt-BR': { attrs: {
            unknown:    'OZI-W001 atributo desconhecido "{name}".',
            didYouMean: 'Você quis dizer {list}?',
            or:         ' ou ',
            gone:       'Ele saiu na {since}.',
            goneHint:   'Ele saiu na {since}; use {hint}.',
            more:       'Lista de atributos: {url}'
        } },
        'en': { attrs: {
            unknown:    'OZI-W001 unknown attribute "{name}".',
            didYouMean: 'Did you mean {list}?',
            or:         ' or ',
            gone:       'It was removed in {since}.',
            goneHint:   'It was removed in {since}; use {hint}.',
            more:       'Attribute list: {url}'
        } },
        'es': { attrs: {
            unknown:    'OZI-W001 atributo desconocido "{name}".',
            didYouMean: '¿Quiso decir {list}?',
            or:         ' o ',
            gone:       'Se eliminó en la {since}.',
            goneHint:   'Se eliminó en la {since}; use {hint}.',
            more:       'Lista de atributos: {url}'
        } }
    };

    var _dictRegistered = false;
    function _registerDict() {
        var lang = window.OZI && window.OZI.lang;
        if (_dictRegistered || !lang || typeof lang.register !== 'function') return;
        Object.keys(DICT).forEach(function (l) { lang.register(l, DICT[l]); });
        _dictRegistered = true;
    }

    function _interp(str, p) {
        return String(str).replace(/\{(\w+)\}/g, function (m, k) { return p && p[k] !== undefined ? p[k] : m; });
    }

    function _t(key, params) {
        _registerDict();
        var lang = window.OZI && window.OZI.lang;
        var full = 'attrs.' + key;
        if (lang && typeof lang.t === 'function') {
            var v = lang.t(full, params);
            if (v && v !== full) return v;
        }
        return _interp(DICT['pt-BR'].attrs[key], params);
    }


    // ─────────────────────────────────────────────
    // [3] QUANDO AVISAR (decisão #25)
    // ─────────────────────────────────────────────

    function _isDevHost() {
        var loc = window.location || {};
        if (loc.protocol === 'file:') return true;
        var h = String(loc.hostname || '').toLowerCase();
        if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') return true;
        return /\.(localhost|test|local)$/.test(h);
    }

    function enabled() {
        var OZI  = window.OZI || {};
        var conf = OZI.conf || (window.OziConf && window.OziConf.get && window.OziConf.get()) || {};
        if (conf.warnUnknown === true || conf.warnUnknown === false) return conf.warnUnknown;
        if (OZI.appDebug === true || OZI.appDebug === false) return OZI.appDebug;
        return _isDevHost();
    }


    // ─────────────────────────────────────────────
    // [4] SUGESTÃO
    // ─────────────────────────────────────────────

    function _distance(a, b) {
        if (a === b) return 0;
        var prev = [], cur, i, j;
        for (j = 0; j <= b.length; j++) prev[j] = j;
        for (i = 1; i <= a.length; i++) {
            cur = [i];
            for (j = 1; j <= b.length; j++) {
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                    prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
            }
            prev = cur;
        }
        return prev[b.length];
    }

    function _namespace(name) {
        var rest = name.slice('data-ozi-'.length);
        var ns = rest.split('-')[0];
        return REGISTRY[ns] ? ns : '';
    }

    /** Nomes certos para um nome errado (vazio = sem sugestão). */
    function suggest(name) {
        name = String(name || '').toLowerCase();
        if (SPECIAL[name] && SPECIAL[name].suggest) return SPECIAL[name].suggest.slice();

        // 1. falta ou sobra o `zld-` da busca remota (`data-ozi-autocomplete-url`): regra exata,
        //    vem antes da aproximada (`-url` está a 3 letras de `-as` e de `-log`)
        var ns   = _namespace(name);
        var base = ns ? 'data-ozi-' + ns + '-' : '';
        var tail = ns ? name.slice(base.length) : '';
        if (ns && tail) {
            var alt = tail.indexOf('zld-') === 0 ? base + tail.slice(4) : base + 'zld-' + tail;
            if (_author.indexOf(alt) > -1) return [alt];
        }

        // 2. erro de digitação: distância de edição <= 2, só os mais próximos
        var best = 3, hits = [];
        _author.forEach(function (n) {
            if (Math.abs(n.length - name.length) > 2) return;
            var d = _distance(name, n);
            if (d > 2) return;
            if (d < best) { best = d; hits = [n]; }
            else if (d === best) hits.push(n);
        });
        if (hits.length && hits.length <= 3) return hits;

        if (ns) {
            // 3. o fim do nome bate com um atributo do mesmo plugin (`-placeholder`)
            if (tail) {
                var ends = _author.filter(function (n) {
                    return n.indexOf(base) === 0 && n !== name && (n.slice(-(tail.length + 1)) === '-' + tail);
                });
                if (ends.length && ends.length <= 3) return ends;
            }
        }
        return [];
    }

    function _gone(name) {
        if (SPECIAL[name] && SPECIAL[name].gone) return { since: SPECIAL[name].gone };
        for (var i = 0; i < GONE_PREFIXES.length; i++) {
            var g = GONE_PREFIXES[i];
            if (name === g.prefix || name.indexOf(g.prefix + '-') === 0) return g;
        }
        return null;
    }

    function isKnown(name) { return !!_known[String(name || '').toLowerCase()]; }


    // ─────────────────────────────────────────────
    // [5] VARREDURA
    // ─────────────────────────────────────────────

    var _warned = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var _count  = 0;   // avisos emitidos (o scan() devolve quantos foram novos)

    function _warnOnce(el, name) {
        if (_warned) {
            var seen = _warned.get(el);
            if (!seen) { seen = {}; _warned.set(el, seen); }
            if (seen[name]) return;
            seen[name] = true;
        }
        _count++;

        var ns   = _namespace(name);
        var tag  = ns ? '[OZI:' + ns + ']' : '[OZI]';
        var msg  = tag + ' ' + _t('unknown', { name: name });
        var gone = _gone(name);
        if (gone) {
            msg += ' ' + (gone.hint ? _t('goneHint', { since: gone.since, hint: gone.hint })
                                    : _t('gone', { since: gone.since }));
        } else {
            var s = suggest(name);
            if (s.length) {
                msg += ' ' + _t('didYouMean', {
                    list: s.map(function (n) { return '"' + n + '"'; }).join(_t('or'))
                });
            }
        }
        msg += ' ' + _t('more', { url: DOCS_URL });
        console.warn(msg, el);
    }

    function _checkEl(el) {
        var attrs = el.attributes;
        if (!attrs) return;
        for (var i = 0; i < attrs.length; i++) {
            var name = attrs[i].name;
            if (name.indexOf('data-ozi-') !== 0 || _known[name]) continue;
            _warnOnce(el, name);
        }
    }

    /** Varre `root` (Element ou document; padrão: document). Não faz nada fora de dev. */
    function scan(root) {
        if (!enabled()) return 0;
        root = root && root.nodeType ? root : document;
        var before = _count;
        if (root.nodeType === 1) _checkEl(root);
        var all = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (var i = 0; i < all.length; i++) _checkEl(all[i]);
        return _count - before;
    }


    // ─────────────────────────────────────────────
    // [6] EXPOSIÇÃO + BOOT
    // ─────────────────────────────────────────────

    var api = {
        scan:    scan,
        isKnown: isKnown,
        suggest: suggest,
        enabled: enabled,
        known:   function () { return Object.keys(_known).sort(); }
    };

    window.OziAttrs = api;
    if (window.OZI) window.OZI.attrs = api;

    var hooks = window.OziHooks || (window.OZI && window.OZI.hooks);
    if (hooks && hooks.afterRender && typeof hooks.afterRender.register === 'function') {
        // FIFO: registrado no core, roda antes dos plugins em cada render
        hooks.afterRender.register('core:attrs', function (root) {
            if (window.OZI && !window.OZI.attrs) window.OZI.attrs = api;
            scan(root);
        });
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { scan(document); });
    } else {
        setTimeout(function () { scan(document); }, 0);
    }

})(window, document);
