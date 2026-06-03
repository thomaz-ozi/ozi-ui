/**
 *  ------------------------------------------
 *  ozi-helpers
 *  ------------------------------------------
 *  Ver: 1.0.2
 *  2026-05-27
 *
 *
 *
 * Responsabilidade:
 *   - Prover funcoes puras e reutilizaveis para todos os plugins
 *   - Sem estado proprio, sem DOM persistente, sem dependencia de outros modules
 *   - Consolidar helpers duplicados de oziLoadData, oziAudio e oziEditor (v0.x)
 *
 * NAO faz:
 *   - Nao acessa OZI.modules.* nem OZI.components.*
 *   - Nao depende de OZI.conf (recebe o que precisa por parametro)
 *   - Nao manipula DOM de forma persistente
 *
 * Dependencias: jQuery (opcional — apenas runBatch)
 * Consumido por: ozi.js (window.OziHelpers → OZI.helpers)
 * Usado por: todos os plugins
 *
 * Changelog:
 *   - Corrigido: guard singleton adicionado
 *   - Corrigido: parseInt interno renomeado para parseIntAttr
 *     evita mascarar window.parseInt dentro do modulo
 *   - Corrigido: runBatch documentado como dependente de jQuery
 *     com guard graceful se jQuery nao disponivel
 *   - Adicionado: guard typeof fetch no icon() — ambientes sem fetch
 */

(function (window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziHelpers) return;


    // ---------------------------------------------
    // [2] PARSERS DE ATRIBUTO HTML
    // Leitura segura de atributos com fallback.
    // ---------------------------------------------

    /**
     * parseBool($el, attrName, fallback?)
     * Le atributo HTML e converte para boolean.
     * Aceita: 'true'|'1'|'yes'|'on' -> true
     *         'false'|'0'|'no'|'off'|'' -> false
     *
     * @param {jQuery} $el
     * @param {string} attrName
     * @param {boolean} [fallback=false]
     * @returns {boolean}
     */
    function parseBool($el, attrName, fallback) {
        if (fallback === undefined) fallback = false;
        var raw = $el.attr(attrName);
        if (raw === undefined || raw === null) return fallback;
        var val = String(raw).trim().toLowerCase();
        if (val === 'true'  || val === '1' || val === 'yes' || val === 'on')  return true;
        if (val === 'false' || val === '0' || val === 'no'  || val === 'off') return false;
        if (val === '') return fallback;
        return fallback;
    }


    /**
     * parseIntAttr($el, attrName, fallback?)
     * Le atributo HTML e converte para inteiro.
     * Renomeado de parseInt para nao mascarar window.parseInt dentro do modulo.
     *
     * @param {jQuery} $el
     * @param {string} attrName
     * @param {number} [fallback=0]
     * @returns {number}
     */
    function parseIntAttr($el, attrName, fallback) {
        if (fallback === undefined) fallback = 0;
        var raw = $el.attr(attrName);
        if (raw === undefined || raw === null || raw === '') return fallback;
        var parsed = window.parseInt(raw, 10);
        return isNaN(parsed) ? fallback : parsed;
    }


    /**
     * parseList(raw)
     * Converte string separada por virgula em array limpo.
     * Se ja for array, retorna copia.
     *
     * @param {string|Array} raw
     * @returns {string[]}
     *
     * @example
     * parseList('bold, italic, underline') // ['bold', 'italic', 'underline']
     * parseList(['a', 'b'])                // ['a', 'b']
     * parseList('')                        // []
     */
    function parseList(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.slice();
        return String(raw).split(',')
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length > 0; });
    }


    // ---------------------------------------------
    // [3] IDENTIFICADORES
    // ---------------------------------------------

    var _idCounter = 0;

    /**
     * generateId(prefix?)
     * Gera ID unico crescente para uso no DOM.
     *
     * @param {string} [prefix='ozi']
     * @returns {string}
     *
     * @example
     * generateId('select') // 'select-1', 'select-2', ...
     * generateId()         // 'ozi-1'
     */
    function generateId(prefix) {
        return (prefix || 'ozi') + '-' + (++_idCounter);
    }


    /**
     * normalizeDomId(value)
     * Sanitiza string para uso seguro como ID ou seletor CSS.
     *
     * @param {string} value
     * @returns {string}
     *
     * @example
     * normalizeDomId('Meu Campo!')  // 'meu-campo'
     * normalizeDomId('user email')  // 'user-email'
     */
    function normalizeDomId(value) {
        if (!value) return '';
        return String(value)
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }


    /**
     * safeById(id)
     * Retorna elemento por ID de forma segura (null se nao existir).
     *
     * @param {string} id
     * @returns {Element|null}
     */
    function safeById(id) {
        if (!id) return null;
        return document.getElementById(String(id).replace(/^#/, '')) || null;
    }


    // ---------------------------------------------
    // [4] STRING
    // ---------------------------------------------

    /**
     * normalize(str)
     * NFD + remove diacriticos + lowercase.
     * Usado para busca e comparacao sem acentos.
     *
     * @param {string} str
     * @returns {string}
     *
     * @example
     * normalize('Sao Paulo') // 'sao paulo'
     * normalize('Acao')      // 'acao'
     */
    function normalize(str) {
        if (!str) return '';
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }


    /**
     * escapeRegExp(str)
     * Escapa caracteres especiais para uso em RegExp.
     *
     * @param {string} str
     * @returns {string}
     */
    function escapeRegExp(str) {
        if (!str) return '';
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }


    /**
     * splitTopLevel(raw, separator, openChar?, closeChar?)
     * Divide string por separador respeitando delimitadores aninhados.
     * Util para parsear sintaxe de toolbar: "bold; [ul,ol]; codeblock"
     *
     * @param {string} raw
     * @param {string} separator  — ex: ';' ou ','
     * @param {string} [openChar='[']
     * @param {string} [closeChar=']']
     * @returns {string[]}
     *
     * @example
     * splitTopLevel('bold; [ul,ol]; italic', ';')
     * // ['bold', '[ul,ol]', 'italic']
     */
    function splitTopLevel(raw, separator, openChar, closeChar) {
        if (!raw) return [];
        openChar  = openChar  || '[';
        closeChar = closeChar || ']';

        var results = [];
        var depth   = 0;
        var current = '';

        for (var i = 0; i < raw.length; i++) {
            var ch = raw[i];
            if (ch === openChar)  depth++;
            if (ch === closeChar) depth--;

            if (ch === separator && depth === 0) {
                var trimmed = current.trim();
                if (trimmed) results.push(trimmed);
                current = '';
            } else {
                current += ch;
            }
        }

        var last = current.trim();
        if (last) results.push(last);

        return results;
    }


    /**
     * classNames(...args)
     * Junta classes condicionalmente.
     * Aceita strings, arrays e objetos { 'classe': boolean }.
     *
     * @param {...(string|string[]|object)} args
     * @returns {string}
     *
     * @example
     * classNames('btn', { 'btn-primary': true, 'disabled': false })
     * // 'btn btn-primary'
     */
    function classNames() {
        var classes = [];

        Array.prototype.slice.call(arguments).forEach(function (arg) {
            if (!arg) return;

            if (typeof arg === 'string') {
                classes.push(arg);
            } else if (Array.isArray(arg)) {
                arg.forEach(function (cls) { if (cls) classes.push(cls); });
            } else if (typeof arg === 'object') {
                Object.keys(arg).forEach(function (key) {
                    if (arg[key]) classes.push(key);
                });
            }
        });

        return classes.filter(Boolean).join(' ');
    }


    // ---------------------------------------------
    // [5] ICONES — sistema unificado
    // Resolve icones SVG inline conforme urlBase.
    // Substitui sistemas proprios de oziAudio e oziEditor.
    // ---------------------------------------------

    /**
     * icon($el, name, options?)
     * Insere icone SVG no elemento via fetch.
     * Requer jQuery no $el.
     *
     * @param {jQuery}  $el
     * @param {string}  name     — ex: 'close', 'play', 'bold'
     * @param {object}  [options]
     * @param {string}  [options.fallback]  — texto/emoji se icone nao carregar
     * @param {string}  [options.size]      — ex: '16px'
     * @param {string}  [options.color]     — ex: 'var(--ozi-color-primary)'
     * @param {string}  [options.plugin]    — plugin dono do icone (ex: 'editor')
     *                                        null = procura em core/svg/
     * @returns {Promise<void>}
     *
     * @example
     * OZI.helpers.icon($btn, 'close')
     * OZI.helpers.icon($btn, 'bold', { plugin: 'editor' })
     * OZI.helpers.icon($btn, 'play', { plugin: 'audio', fallback: '\u25b6' })
     */
    function icon($el, name, options) {
        options = options || {};

        // guard — fetch pode nao estar disponivel em ambientes antigos
        if (typeof fetch === 'undefined') {
            if (options.fallback) $el.text(options.fallback);
            return Promise.resolve();
        }

        var conf    = window.OZI && window.OZI.conf;
        var urlBase = (conf && conf.core && conf.core.urlBase) || '/plugins/ozi-ui/';
        if (urlBase.charAt(urlBase.length - 1) !== '/') urlBase += '/';

        var path = options.plugin
            ? urlBase + 'components/ozi-' + options.plugin + '/svg/icon-' + name + '.svg'
            : urlBase + 'core/svg/icon-' + name + '.svg';

        return fetch(path)
            .then(function (res) {
                if (!res.ok) throw new Error('icon not found: ' + path);
                return res.text();
            })
            .then(function (svg) {
                if (options.size || options.color) {
                    svg = svg.replace('<svg', '<svg style="' +
                        (options.size  ? 'width:' + options.size + ';height:' + options.size + ';' : '') +
                        (options.color ? 'color:' + options.color + ';fill:currentColor;' : '') +
                        '"');
                }
                $el.html(svg);
            })
            .catch(function () {
                if (options.fallback) $el.text(options.fallback);
            });
    }


    // ---------------------------------------------
    // [6] ASYNC
    // ---------------------------------------------

    /**
     * runBatch($items, callbackItem, callbackEnd?)
     * Executa callbackItem para cada item jQuery em lote.
     * Requer jQuery — verifica disponibilidade gracefully.
     *
     * @param {jQuery}   $items
     * @param {function} callbackItem  — fn($item, index)
     * @param {function} [callbackEnd] — fn(total)
     */
    function runBatch($items, callbackItem, callbackEnd) {
        // guard — requer jQuery
        if (typeof window.jQuery === 'undefined') {
            console.warn('[OZI:helpers] runBatch: jQuery nao disponivel.');
            if (typeof callbackEnd === 'function') callbackEnd(0);
            return;
        }

        if (!$items || !$items.length) {
            if (typeof callbackEnd === 'function') callbackEnd(0);
            return;
        }

        var $ = window.jQuery;
        var total = $items.length;

        $items.each(function (i) {
            try {
                callbackItem($(this), i);
            } catch (e) {
                console.warn('[OZI:helpers] runBatch: erro no item ' + i + ':', e);
            }
        });

        if (typeof callbackEnd === 'function') callbackEnd(total);
    }


    // ---------------------------------------------
    // [7] CONTROLE DE CONCORRENCIA
    // Garante instancia unica ativa por escopo.
    // Baseado no padrao activePlayerInstance do oziAudio.
    // ---------------------------------------------

    var _exclusiveActors = {};

    /**
     * exclusiveActor(scope, instance?)
     * Garante que apenas uma instancia esteja ativa por escopo.
     * Util para players de audio — pausa o anterior ao iniciar novo.
     *
     * @param {string}  scope      — identificador do grupo (ex: 'audio-player')
     * @param {object}  [instance] — nova instancia ativa. Sem instance = retorna atual.
     * @returns {object|null}      — instancia anterior ou atual
     *
     * @example
     * // registrar nova instancia ativa:
     * var previous = OZI.helpers.exclusiveActor('audio-player', newInstance);
     * if (previous && previous.pause) previous.pause();
     *
     * // ler instancia ativa atual:
     * var current = OZI.helpers.exclusiveActor('audio-player');
     */
    function exclusiveActor(scope, instance) {
        if (!scope) return null;

        if (instance === undefined) {
            return _exclusiveActors[scope] || null;
        }

        var previous = _exclusiveActors[scope] || null;
        _exclusiveActors[scope] = instance;
        return previous;
    }


    // ---------------------------------------------
    // [8] COMPAT RETROATIVA — aliases v0.x
    // Funcoes antigas com prefixo zld* continuam
    // funcionando com warn quando log ativo.
    // ---------------------------------------------

    function _makeAlias(newFn, oldName) {
        return function () {
            if (window.OZI && window.OZI.conf && window.OZI.conf.core && window.OZI.conf.core.log) {
                console.warn('[OZI:helpers] ' + oldName + ' depreciado. Use OZI.helpers.*');
            }
            return newFn.apply(this, arguments);
        };
    }

    window.zldParseBool      = _makeAlias(parseBool,      'zldParseBool');
    window.zldParseList      = _makeAlias(parseList,      'zldParseList');
    window.zldGenerateId     = _makeAlias(generateId,     'zldGenerateId');
    window.zldNormalizeDomId = _makeAlias(normalizeDomId, 'zldNormalizeDomId');
    window.zldSafeById       = _makeAlias(safeById,       'zldSafeById');
    window.zldClassNames     = _makeAlias(classNames,     'zldClassNames');
    window.zldGetElementById = _makeAlias(safeById,       'zldGetElementById');


    // ---------------------------------------------
    // [9] EXPOSICAO — window.OziHelpers
    // Contrato interno para ozi.js.
    // Apos boot, disponivel em OZI.helpers.
    // ---------------------------------------------

    window.OziHelpers = {

        // [2] parsers de atributo
        parseBool:      parseBool,
        parseInt:       parseIntAttr,    // exposto como parseInt na API publica
        parseList:      parseList,

        // [3] identificadores
        generateId:     generateId,
        normalizeDomId: normalizeDomId,
        safeById:       safeById,

        // [4] string
        normalize:      normalize,
        escapeRegExp:   escapeRegExp,
        splitTopLevel:  splitTopLevel,
        classNames:     classNames,

        // [5] visual
        icon:           icon,

        // [6] async
        runBatch:       runBatch,

        // [7] concorrencia
        exclusiveActor: exclusiveActor
    };

})(window, document);