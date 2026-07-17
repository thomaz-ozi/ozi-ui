/**
 *  ------------------------------------------
 *  ozi-helpers
 *  ------------------------------------------
 *  Ver: 1.1.0
 *  2026-07-03
 *
 *
 *
 * Responsabilidade:
 *   - Prover funcoes puras e reutilizaveis para todos os plugins
 *   - Sem estado proprio, sem DOM persistente, sem dependencia de outros modules
 *   - Ponto unico de emissao de eventos do contrato v2 (emit)
 *
 * NAO faz:
 *   - Nao acessa OZI.modules.* nem OZI.components.*
 *   - Nao depende de OZI.conf (recebe o que precisa por parametro)
 *   - Nao manipula DOM de forma persistente
 *
 * Dependencias: NENHUMA — zero jQuery (contrato de camadas v2).
 *   Funcoes que recebem elemento aceitam Element nativo OU objeto jQuery
 *   (normalizacao interna via toElement) para conviver com plugins v1
 *   durante a migracao F2.
 * Consumido por: ozi.js (window.OziHelpers → OZI.helpers)
 * Usado por: todos os plugins
 *
 * Changelog:
 *   - v1.1.0: [V2-F1] Dependencia de jQuery removida por completo:
 *       - toElement(x) — normaliza Element | jQuery | seletor string
 *       - parseBool/parseInt/icon aceitam Element ou jQuery
 *       - emit(el, name, detail) — ponto unico de CustomEvent do contrato v2
 *         (bubbles: true, payload em detail; ver docs/ozi-ui-v2-contratos.md)
 *       - runBatch DEPRECIADO para v2 (mantido funcional p/ plugins v1;
 *         agora aceita tambem NodeList/Array sem jQuery)
 *   - v1.0.2: guard singleton; parseInt renomeado internamente p/ parseIntAttr;
 *     runBatch com guard graceful; guard typeof fetch no icon()
 */

(function (window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziHelpers) return;


    // ---------------------------------------------
    // [2] NORMALIZACAO DE ELEMENTO
    // Ponte de transicao v1/v2: toda funcao que recebe
    // elemento aceita Element nativo, objeto jQuery ou
    // seletor string.
    // ---------------------------------------------

    /**
     * toElement(x)
     * Normaliza para Element nativo.
     *
     * @param {Element|jQuery|string|null} x
     * @returns {Element|null}
     *
     * @example
     * toElement(document.getElementById('a')) // Element
     * toElement($('#a'))                      // Element (primeiro do set)
     * toElement('#a')                         // Element via querySelector
     */
    function toElement(x) {
        if (!x) return null;
        if (x.nodeType === 1 || x.nodeType === 9) return x;          // Element | Document
        if (typeof x === 'string') return document.querySelector(x); // seletor
        if (typeof x.jquery === 'string' || (x.length !== undefined && x[0] && x[0].nodeType === 1)) {
            return x[0] || null;                                     // jQuery / array-like
        }
        return null;
    }


    /**
     * toElements(x)
     * Normaliza para Array<Element>.
     * Aceita Element, NodeList, Array, jQuery, seletor string.
     *
     * @param {*} x
     * @returns {Element[]}
     */
    function toElements(x) {
        if (!x) return [];
        if (x.nodeType === 1) return [x];
        if (typeof x === 'string') return Array.prototype.slice.call(document.querySelectorAll(x));
        if (x.length !== undefined) {
            return Array.prototype.slice.call(x).filter(function (el) {
                return el && el.nodeType === 1;
            });
        }
        return [];
    }


    // ---------------------------------------------
    // [3] PARSERS DE ATRIBUTO HTML
    // Leitura segura de atributos com fallback.
    // ---------------------------------------------

    function _attr(el, attrName) {
        el = toElement(el);
        if (!el || typeof el.getAttribute !== 'function') return null;
        return el.getAttribute(attrName);
    }

    /**
     * parseBool(el, attrName, fallback?)
     * Le atributo HTML e converte para boolean.
     * Aceita: 'true'|'1'|'yes'|'on' -> true
     *         'false'|'0'|'no'|'off' -> false
     *
     * @param {Element|jQuery} el
     * @param {string} attrName
     * @param {boolean} [fallback=false]
     * @returns {boolean}
     */
    function parseBool(el, attrName, fallback) {
        if (fallback === undefined) fallback = false;
        var raw = _attr(el, attrName);
        if (raw === undefined || raw === null) return fallback;
        var val = String(raw).trim().toLowerCase();
        if (val === 'true'  || val === '1' || val === 'yes' || val === 'on')  return true;
        if (val === 'false' || val === '0' || val === 'no'  || val === 'off') return false;
        return fallback;
    }


    /**
     * parseIntAttr(el, attrName, fallback?)
     * Le atributo HTML e converte para inteiro.
     *
     * @param {Element|jQuery} el
     * @param {string} attrName
     * @param {number} [fallback=0]
     * @returns {number}
     */
    function parseIntAttr(el, attrName, fallback) {
        if (fallback === undefined) fallback = 0;
        var raw = _attr(el, attrName);
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
    // [4] IDENTIFICADORES
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
    // [5] STRING
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
            .replace(/[0300-036f]/g, '')
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
    // [6] EVENTOS — contrato v2
    // Ponto UNICO de emissao de CustomEvent.
    // Ver docs/ozi-ui-v2-contratos.md §1.
    // ---------------------------------------------

    /**
     * emit(el, name, detail?, options?)
     * Emite CustomEvent nativo conforme o contrato v2:
     * bubbles: true, payload exclusivamente em detail.
     *
     * detail padrao do contrato:
     *   { component, name, value, items?, source: 'user'|'api' }
     *
     * @param {Element|jQuery} el       — elemento de origem
     * @param {string}         name     — ex: 'ozi:change'
     * @param {object}         [detail] — payload (contrato §1.3)
     * @param {object}         [options]
     * @param {boolean}        [options.bubbles=true]
     * @param {boolean}        [options.cancelable=false]
     * @returns {boolean} — false se preventDefault() foi chamado
     *
     * @example
     * OZI.helpers.emit(root, 'ozi:change', {
     *     component: 'ozi-select',
     *     name:      'uf',
     *     value:     'SP',
     *     source:    'user'
     * });
     */
    function emit(el, name, detail, options) {
        el = toElement(el);
        if (!el || !name) return true;

        options = options || {};
        detail  = detail  || {};

        // aviso de contrato — apenas com log ativo, nunca bloqueia
        if (window.OZI && window.OZI.conf && window.OZI.conf.core && window.OZI.conf.core.log) {
            if (name.indexOf('ozi:') === 0 && !detail.component) {
                console.warn('[OZI:helpers] emit(' + name + '): detail.component ausente (contrato v2 §1.3).');
            }
        }

        var event = new CustomEvent(name, {
            bubbles:    options.bubbles !== false,
            cancelable: options.cancelable === true,
            detail:     detail
        });

        return el.dispatchEvent(event);
    }


    // ---------------------------------------------
    // [7] ICONES — sistema unificado
    // Resolve icones SVG inline conforme urlBase.
    // ---------------------------------------------

    /**
     * icon(el, name, options?)
     * Insere icone SVG no elemento via fetch.
     *
     * @param {Element|jQuery} el
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
     * OZI.helpers.icon(btn, 'close')
     * OZI.helpers.icon(btn, 'bold', { plugin: 'editor' })
     * OZI.helpers.icon(btn, 'play', { plugin: 'audio', fallback: '▶' })
     */
    function icon(el, name, options) {
        options = options || {};
        el = toElement(el);
        if (!el) return Promise.resolve();

        // guard — fetch pode nao estar disponivel em ambientes antigos
        if (typeof fetch === 'undefined') {
            if (options.fallback) el.textContent = options.fallback;
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
                el.innerHTML = svg;
            })
            .catch(function () {
                if (options.fallback) el.textContent = options.fallback;
            });
    }


    // ---------------------------------------------
    // [8] ASYNC — DEPRECIADO para v2
    // ---------------------------------------------

    /**
     * runBatch(items, callbackItem, callbackEnd?)
     * DEPRECIADO (v2): use toElements(x).forEach().
     * Mantido funcional para plugins v1 durante a F2.
     *
     * Se jQuery estiver presente e items for jQuery, o callback recebe
     * $(item) como na v1. Caso contrario recebe Element nativo.
     *
     * @param {jQuery|NodeList|Element[]} items
     * @param {function} callbackItem  — fn(item, index)
     * @param {function} [callbackEnd] — fn(total)
     */
    function runBatch(items, callbackItem, callbackEnd) {
        var isJq = items && typeof items.jquery === 'string';
        var els  = toElements(items);

        if (!els.length) {
            if (typeof callbackEnd === 'function') callbackEnd(0);
            return;
        }

        var wrap = (isJq && typeof window.jQuery !== 'undefined') // guard-ok: compat v1, sem dependência
            ? function (el) { return window.jQuery(el); }         // guard-ok: compat v1, sem dependência
            : function (el) { return el; };

        els.forEach(function (el, i) {
            try {
                callbackItem(wrap(el), i);
            } catch (e) {
                console.warn('[OZI:helpers] runBatch: erro no item ' + i + ':', e);
            }
        });

        if (typeof callbackEnd === 'function') callbackEnd(els.length);
    }


    // ---------------------------------------------
    // [9] CONTROLE DE CONCORRENCIA
    // Garante instancia unica ativa por escopo.
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
     * var previous = OZI.helpers.exclusiveActor('audio-player', newInstance);
     * if (previous && previous.pause) previous.pause();
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
    // [10] COMPAT RETROATIVA — aliases v0.x
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
    // [11] EXPOSICAO — window.OziHelpers
    // Contrato interno para ozi.js.
    // Apos boot, disponivel em OZI.helpers.
    // ---------------------------------------------

    window.OziHelpers = {

        // [2] normalizacao de elemento
        toElement:      toElement,
        toElements:     toElements,

        // [3] parsers de atributo
        parseBool:      parseBool,
        parseInt:       parseIntAttr,    // exposto como parseInt na API publica
        parseList:      parseList,

        // [4] identificadores
        generateId:     generateId,
        normalizeDomId: normalizeDomId,
        safeById:       safeById,

        // [5] string
        normalize:      normalize,
        escapeRegExp:   escapeRegExp,
        splitTopLevel:  splitTopLevel,
        classNames:     classNames,

        // [6] eventos — contrato v2
        emit:           emit,

        // [7] visual
        icon:           icon,

        // [8] async (depreciado p/ v2)
        runBatch:       runBatch,

        // [9] concorrencia
        exclusiveActor: exclusiveActor
    };

})(window, document);
