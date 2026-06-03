/**
 *
 * ------------------------------------------
 * ozi-suggest
 * ------------------------------------------
 * Ver: 1.0.1
 * 2026-04-27
 *
 * * Responsabilidade:
 *   - Prover logica de busca local e remota compartilhada
 *   - Normalizar opcoes via aliasMap (value=id, label=nome)
 *   - Carregar opcoes via <script type="application/json">
 *   - Criar instancias de busca remota com AbortController e seq guard
 *   - Filtrar opcoes por query com suporte a multiplos campos
 *
 * O que NAO faz:
 *   - Nao renderiza UI — responsabilidade de oziSelect e oziAutocomplete
 *   - Nao conhece DOM de componentes especificos
 *   - Nao acessa OZI.components.*
 *
 * Dependencias: ozi.js (OZI.helpers para normalize)
 * Expoe: OZI.modules.suggest, window.OziSuggest (compat)
 *
 * Changelog:
 *   - Corrigido: guard singleton adicionado
 *   - Corrigido: registro no namespace dentro do $(function) — garante OZI bootado
 *   - Corrigido: Object.assign substituido por merge ES5 em normalizeOptions
 *   - Corrigido: get isLoading() ES6 substituido por isLoading() function ES5
 *   - Adicionado: hook OZI.hooks.afterRender registrado como 'module:suggest'
 *   - Adicionado: window.OziSuggest alias para consistencia com outros modulos
 */

(function ($, window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziSuggest) return;


    // ---------------------------------------------
    // [2] HELPERS INTERNOS
    // ---------------------------------------------

    function _normalize(str) {
        // delega para OZI.helpers se disponivel
        var h = window.OZI && window.OZI.helpers;
        if (h && h.normalize) return h.normalize(str);
        // fallback local
        if (!str) return '';
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function _log(msg) {
        var conf = window.OZI && window.OZI.conf;
        if (!(conf && conf.core && conf.core.log)) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[OZI:suggest]');
        console.log.apply(console, args);
    }

    // merge raso ES5 — substitui Object.assign
    function _extend(target, source) {
        if (!source || typeof source !== 'object') return target;
        Object.keys(source).forEach(function (key) {
            target[key] = source[key];
        });
        return target;
    }

    function _clone(source) {
        return _extend({}, source);
    }


    // ---------------------------------------------
    // [3] CARREGAMENTO DE OPCOES VIA SCRIPT TAG
    // Padrao do projeto: <script type="application/json" data-X-options="key">
    // ---------------------------------------------

    /**
     * loadFromScriptTag(key, attrName)
     * Le opcoes de uma tag <script type="application/json">.
     *
     * @param {string} key      — valor do atributo (chave da instancia)
     * @param {string} attrName — nome do atributo data-* no script tag
     *                            ex: 'data-ozi-select-options'
     * @returns {Option[]}
     *
     * @example
     * // HTML:
     * // <script type="application/json" data-ozi-select-options="meu-select">
     * //   [{"value": 1, "label": "Opcao 1"}, ...]
     * // </script>
     *
     * OZI.modules.suggest.loadFromScriptTag('meu-select', 'data-ozi-select-options');
     * // → [{ value: 1, label: 'Opcao 1' }, ...]
     */
    function loadFromScriptTag(key, attrName) {
        if (!key || !attrName) return [];

        var selector = 'script[type="application/json"][' + attrName + '="' + key + '"]';
        var $script  = $(selector);
        if (!$script.length) return [];

        try {
            var raw = $script.text().trim();
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            // aceita array direto ou { options: [...] }
            return Array.isArray(parsed) ? parsed : (parsed.options || []);
        } catch (e) {
            _log('loadFromScriptTag: JSON invalido para "' + key + '":', e.message);
            return [];
        }
    }


    // ---------------------------------------------
    // [4] ALIAS MAP
    // Normaliza nomes de campos das opcoes.
    // Ex: "value=id, label=nome" → { value: 'id', label: 'nome' }
    // ---------------------------------------------

    /**
     * parseAliasMap(rawString)
     * Parseia string de alias de campo.
     *
     * @param {string} rawString — ex: 'value=id, label=nome, image=avatar'
     * @returns {object}         — { canonical: original }
     *
     * @example
     * parseAliasMap('value=id, label=estado')
     * // → { value: 'id', label: 'estado' }
     */
    function parseAliasMap(rawString) {
        if (!rawString || typeof rawString !== 'string') return {};

        var map = {};
        rawString.split(',').forEach(function (pair) {
            var parts = pair.trim().split('=');
            if (parts.length === 2) {
                var canonical = parts[0].trim().toLowerCase();
                var original  = parts[1].trim();
                if (canonical && original) {
                    map[canonical] = original;
                }
            }
        });
        return map;
    }


    /**
     * normalizeOptions(options, aliasMap)
     * Aplica aliasMap nas opcoes — remapeia campos para nomes canonicos.
     * Preserva campos originais para nao perder dados.
     *
     * @param {Option[]} options  — array de opcoes brutas
     * @param {object}   aliasMap — { canonical: original } de parseAliasMap
     * @returns {Option[]}        — opcoes com campos normalizados
     *
     * @example
     * normalizeOptions(
     *   [{ id: 1, estado: 'Sao Paulo' }],
     *   { value: 'id', label: 'estado' }
     * )
     * // → [{ value: 1, label: 'Sao Paulo', id: 1, estado: 'Sao Paulo' }]
     */
    function normalizeOptions(options, aliasMap) {
        if (!Array.isArray(options) || !options.length) return [];
        if (!aliasMap || !Object.keys(aliasMap).length) return options;

        return options.map(function (item) {
            if (!item || typeof item !== 'object') return item;

            // clone raso ES5 — sem Object.assign
            var normalized = _clone(item);

            Object.keys(aliasMap).forEach(function (canonical) {
                var original = aliasMap[canonical];
                if (item[original] !== undefined && item[canonical] === undefined) {
                    normalized[canonical] = item[original];
                }
            });

            return normalized;
        });
    }


    // ---------------------------------------------
    // [5] FILTRO LOCAL
    // Busca por query em multiplos campos.
    // ---------------------------------------------

    /**
     * normalize(str)
     * NFD + remove diacriticos + lowercase.
     * Delegado para OZI.helpers.normalize se disponivel.
     *
     * @param {string} str
     * @returns {string}
     */
    function normalize(str) {
        return _normalize(str);
    }


    /**
     * filterByQuery(options, query, fields?)
     * Filtra opcoes por query normalizada em multiplos campos.
     *
     * @param {Option[]} options — opcoes a filtrar
     * @param {string}   query  — termo de busca
     * @param {string[]} [fields=['label', 'value', 'group']] — campos a buscar
     * @returns {Option[]}
     *
     * @example
     * filterByQuery(options, 'paulo')
     * // retorna opcoes onde label/value/group contem 'paulo' (sem acento)
     */
    function filterByQuery(options, query, fields) {
        if (!Array.isArray(options)) return [];
        if (!query || query.trim() === '') return options;

        fields = fields || ['label', 'value', 'group'];
        var q  = _normalize(query);

        return options.filter(function (item) {
            if (!item || typeof item !== 'object') return false;
            return fields.some(function (field) {
                var val = item[field];
                if (val === null || val === undefined) return false;
                return _normalize(String(val)).indexOf(q) > -1;
            });
        });
    }


    // ---------------------------------------------
    // [6] BUSCA REMOTA — createRemoteSearcher
    // Instancia de busca com AbortController e seq guard.
    // Elimina ~150 linhas duplicadas entre oziSelect e oziAutocomplete.
    // ---------------------------------------------

    /**
     * createRemoteSearcher(config)
     * Cria instancia de busca remota reutilizavel.
     *
     * @param {object} config
     * @param {string}   config.url        — URL do endpoint
     * @param {string}   [config.method]   — 'POST' | 'GET' (default: 'POST')
     * @param {string}   [config.param]    — nome do parametro de busca (default: 'search')
     * @param {string}   [config.itemName] — chave do array no JSON de resposta
     * @param {number}   [config.min]      — minimo de chars para disparar (default: 1)
     * @param {number}   [config.delay]    — debounce em ms (default: 300)
     * @param {boolean}  [config.log]      — log de debug
     * @param {object}   [config.aliasMap] — aliasMap para normalizar resposta
     *
     * @returns {RemoteSearcher}
     * RemoteSearcher: {
     *   fetch(query)         → Promise<Option[]>
     *   abort()              → void
     *   setLoading(bool)     → void
     *   onLoadingChange(fn)  → void  — fn(isLoading)
     *   isLoading()          → bool  — ES5: funcao em vez de getter
     * }
     */
    function createRemoteSearcher(config) {
        config = config || {};

        var _url      = config.url       || '';
        var _method   = (config.method   || 'POST').toUpperCase();
        var _param    = config.param     || 'search';
        var _itemName = config.itemName  || '';
        var _min      = window.parseInt(config.min   || '1',   10);
        var _delay    = window.parseInt(config.delay || '300', 10);
        var _aliasMap = config.aliasMap  || {};
        var _doLog    = config.log || false;

        var _controller  = null;   // AbortController atual
        var _seq         = 0;      // contador de sequencia
        var _timer       = null;   // debounce timer
        var _isLoading   = false;
        var _onLoadingCb = null;

        function _setLoading(state) {
            _isLoading = !!state;
            if (typeof _onLoadingCb === 'function') {
                try { _onLoadingCb(_isLoading); } catch (e) {}
            }
        }

        function _abort() {
            if (_controller) {
                try { _controller.abort(); } catch (e) {}
                _controller = null;
            }
            if (_timer) {
                clearTimeout(_timer);
                _timer = null;
            }
        }

        function _parseResponse(data) {
            // aceita:
            // - array direto: [{ value, label }, ...]
            // - { options: [...] }
            // - { items: [...] }
            // - { [itemName]: [...] }
            if (Array.isArray(data)) return data;
            if (_itemName && Array.isArray(data[_itemName])) return data[_itemName];
            if (Array.isArray(data.options)) return data.options;
            if (Array.isArray(data.items))   return data.items;
            return [];
        }

        function _doFetch(query) {
            _abort();
            _setLoading(true);

            var seq = ++_seq;
            _controller = typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;

            var token   = $('meta[name="csrf-token"]').attr('content');
            var headers = { 'Accept': 'application/json' };
            if (token) headers['X-CSRF-TOKEN'] = token;

            var fetchOptions = {
                method:  _method,
                headers: headers,
                signal:  _controller ? _controller.signal : undefined
            };

            var url = _url;

            if (_method === 'GET') {
                url += (url.indexOf('?') > -1 ? '&' : '?') +
                    encodeURIComponent(_param) + '=' + encodeURIComponent(query);
            } else {
                var body = new FormData();
                body.append(_param, query);
                fetchOptions.body = body;
            }

            if (_doLog) console.log('[OZI:suggest] fetch seq=' + seq, url, query);

            return fetch(url, fetchOptions)
                .then(function (res) {
                    // resposta fora de ordem — descarta
                    if (seq !== _seq) {
                        if (_doLog) console.log('[OZI:suggest] descartando seq=' + seq + ' (atual=' + _seq + ')');
                        return [];
                    }
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(function (data) {
                    if (seq !== _seq) return [];
                    _setLoading(false);

                    var raw  = _parseResponse(data);
                    var opts = Object.keys(_aliasMap).length
                        ? normalizeOptions(raw, _aliasMap)
                        : raw;

                    if (_doLog) console.log('[OZI:suggest] resultado seq=' + seq + ':', opts.length, 'opcoes');
                    return opts;
                })
                .catch(function (err) {
                    if (err && err.name === 'AbortError') return [];
                    _setLoading(false);
                    if (_doLog) console.warn('[OZI:suggest] erro fetch:', err.message);
                    return [];
                });
        }

        // API publica do searcher
        return {

            /**
             * fetch(query)
             * Busca com debounce. Respeita min e delay.
             * @returns {Promise<Option[]>}
             */
            fetch: function (query) {
                query = String(query || '').trim();

                if (query.length < _min) {
                    _abort();
                    _setLoading(false);
                    return Promise.resolve([]);
                }

                // debounce
                return new Promise(function (resolve) {
                    _abort();
                    _timer = setTimeout(function () {
                        _doFetch(query).then(resolve);
                    }, _delay);
                });
            },

            /**
             * abort()
             * Cancela requisicao e debounce em andamento.
             */
            abort: _abort,

            /**
             * setLoading(state)
             * Define estado de loading manualmente.
             */
            setLoading: _setLoading,

            /**
             * onLoadingChange(callback)
             * Registra callback chamado ao mudar estado de loading.
             * fn(isLoading: boolean)
             */
            onLoadingChange: function (callback) {
                _onLoadingCb = callback;
            },

            /**
             * isLoading()
             * Retorna estado atual de loading.
             * ES5 — funcao em vez de getter (era get isLoading() ES6)
             *
             * @returns {boolean}
             */
            isLoading: function () {
                return _isLoading;
            }
        };
    }


    // ---------------------------------------------
    // [7] API PUBLICA — OZI.modules.suggest
    // ---------------------------------------------

    var suggest = {
        loadFromScriptTag:    loadFromScriptTag,
        parseAliasMap:        parseAliasMap,
        normalizeOptions:     normalizeOptions,
        normalize:            normalize,
        filterByQuery:        filterByQuery,
        createRemoteSearcher: createRemoteSearcher
    };


    // ---------------------------------------------
    // [8] EXPOSICAO
    // Namespace registrado dentro do DOMReady
    // para garantir que OZI ja bootou.
    // ---------------------------------------------

    // alias objeto — imediato (sem depender do OZI)
    window.OziSuggest = suggest;

    $(function () {
        // namespace OZI
        if (window.OZI && window.OZI.modules) {
            window.OZI.modules.suggest = suggest;
        }

        // hook OZI — sem reinit necessario, registro para consistencia
        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('module:suggest', function () {
                // sem acao necessaria — suggest e stateless
            });
        }

        _log('ozi-suggest v1.0.1 pronto.');
    });

})(jQuery, window, document);