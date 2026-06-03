/**
 * ------------------------------------------
 * ozi-loaddata-collector
 * ------------------------------------------
 * Ver: 1.0.1
 * 2026-05-27
 *
 *
 * Responsabilidade:
 *   - Orquestrador de coleta exclusivo do ozi-loaddata
 *   - Traduz o vocabulario do loadData (zldCatchGroupId, zldCatchItemName)
 *     para containers que o ozi-validate entende
 *   - Separa injecao direta (campo:valor) da validacao real
 *   - Agrega resultados de multiplos containers em um unico retorno
 *   - Expoe oziValidateContainer como alias de compat legado
 *
 * O que NAO faz:
 *   - Nao valida — delega para OZI.modules.validate.container()
 *   - Nao conhece fetch, progress bar, busy state
 *   - Nao conhece adapters — o validate resolve
 *
 * Dependencias: ozi-validate.js (OZI.modules.validate)
 * Carregado por: ozi-loaddata.js (auto-carrega antes de iniciar)
 * Expoe: window.OziCollector, window.oziValidateContainer (compat)
 *
 * Retorno padrao (compativel com oziLoadData v1.0.1):
 * {
 *   formData:        FormData,
 *   data:            object,
 *   isValid:         boolean,
 *   invalidFields:   Array,
 *   ldValidate:      number,   — compat v0.x
 *   zldValidateName: string    — compat v0.x (nomes separados por virgula)
 * }
 */

(function ($, window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziCollector) return;


    // ---------------------------------------------
    // [2] HELPERS INTERNOS
    // ---------------------------------------------

    function _str(value) {
        return String(value == null ? '' : value).trim();
    }

    function _parseList(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        var s = _str(raw);
        if (!s) return [];

        if (s.charAt(0) === '[' && s.charAt(s.length - 1) === ']') {
            try {
                var arr = JSON.parse(s.replace(/'/g, '"'));
                return Array.isArray(arr) ? arr : [];
            } catch (e) {
                return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
            }
        }

        return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    }

    function _normalizeDomId(v) {
        if (v === undefined || v === null) return '';
        var s = _str(v);
        if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
            (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
            s = s.slice(1, -1).trim();
        }
        if (s.charAt(0) === '#') s = s.slice(1).trim();
        return s;
    }

    // acessa o motor de validacao — OZI.modules.validate ou fallback nulo
    function _getValidate() {
        return window.OZI && window.OZI.modules && window.OZI.modules.validate
            ? window.OZI.modules.validate
            : null;
    }

    // agrega dois resultados de validacao em um unico
    function _mergeResult(base, next) {
        // merge formData
        if (next.formData) {
            next.formData.forEach(function (value, key) {
                base.formData.append(key, value);
            });
        }

        // merge data
        if (next.data) {
            Object.keys(next.data).forEach(function (key) {
                if (Object.prototype.hasOwnProperty.call(base.data, key)) {
                    if (!Array.isArray(base.data[key])) base.data[key] = [base.data[key]];
                    base.data[key].push(next.data[key]);
                } else {
                    base.data[key] = next.data[key];
                }
            });
        }

        // merge invalidos
        if (Array.isArray(next.invalidFields)) {
            base.invalidFields = base.invalidFields.concat(next.invalidFields);
        }

        return base;
    }

    // normaliza retorno final no formato que o loadData espera
    function _normalize(result) {
        var names = result.invalidFields.map(function (f) { return f.name || ''; }).join(',');
        return {
            formData:        result.formData,
            data:            result.data,
            isValid:         result.invalidFields.length === 0,
            invalidFields:   result.invalidFields,
            ldValidate:      result.invalidFields.length,
            zldValidateName: names.replace(/,+$/, '')
        };
    }


    // ---------------------------------------------
    // [3] FUNCAO PRINCIPAL — collect
    //
    // @param {object} config
    //   zldCatchGroupId  {Array|string} — IDs de containers a validar
    //   zldCatchItemName {Array|string} — nomes de campos (ou campo:valor)
    //   formData         {FormData}     — formData existente para agregar (opcional)
    //   silent           {boolean}      — nao aplica classes visual
    //   log              {boolean}      — ativa logs internos
    //
    // @returns retorno padrao (ver header)
    // ---------------------------------------------

    function collect(config) {
        config = config || {};

        var groupIds   = _parseList(config.zldCatchGroupId);
        var itemNames  = _parseList(config.zldCatchItemName);
        var silent     = config.silent  === true;
        var log        = config.log     === true;

        var validate = _getValidate();

        // resultado agregado
        var result = {
            formData:      config.formData || new FormData(),
            data:          {},
            invalidFields: []
        };

        // ── processa grupos (zldCatchGroupId) ──────────────────
        groupIds.forEach(function (rawId) {
            var id = _normalizeDomId(rawId);
            if (!id) return;

            var container = document.getElementById(id);
            if (!container) {
                if (log) console.warn('[OziCollector] groupId nao encontrado:', rawId);
                return;
            }

            if (!validate) {
                if (log) console.warn('[OziCollector] OZI.modules.validate indisponivel — groupId ignorado:', id);
                return;
            }

            var partial = validate.container({
                $container:  $(container),
                formData:    new FormData(),
                silent:      silent
            });

            result = _mergeResult(result, partial);

            if (log) console.log('[OziCollector] groupId "' + id + '":', partial);
        });

        // ── processa itens (zldCatchItemName) ──────────────────
        itemNames.forEach(function (item) {
            if (!item) return;

            // injecao direta — campo:valor (nao passa pelo validate)
            if (String(item).indexOf(':') !== -1) {
                var parts = String(item).split(':');
                var key   = _str(parts[0]);
                var val   = parts.slice(1).join(':').trim();
                if (key) {
                    result.formData.append(key, val);
                    result.data[key] = val;
                    if (log) console.log('[OziCollector] injecao direta:', key, '=', val);
                }
                return;
            }

            // campo por name — busca no DOM e valida
            // IMPORTANTE: nao clona os elementos — passa direto via $elements
            // Clone causava loop de eventos (event listeners copiados + HTMLCollection viva)
            var $elements = $(document.getElementsByName(_str(item)));
            if (!$elements.length) {
                if (log) console.warn('[OziCollector] campo nao encontrado pelo name:', item);
                return;
            }

            if (!validate) {
                if (log) console.warn('[OziCollector] OZI.modules.validate indisponivel — item ignorado:', item);
                return;
            }

            // passa $elements direto — validate usa .filter() em vez de .find()
            // elementos permanecem no DOM original sem clonar
            var partial = validate.container({
                $elements: $elements,
                formData:  new FormData(),
                silent:    silent
            });

            result = _mergeResult(result, partial);

            if (log) console.log('[OziCollector] item "' + item + '":', partial);
        });

        return _normalize(result);
    }


    // ---------------------------------------------
    // [4] API PUBLICA — window.OziCollector
    // ---------------------------------------------

    var collector = {
        collect:         collect,
        parseList:       _parseList,
        normalizeDomId:  _normalizeDomId
    };

    window.OziCollector = collector;


    // ---------------------------------------------
    // [5] COMPAT — oziValidateContainer
    // Alias legado permanente — o loadData e codigo
    // externo que usa oziValidateContainer continua
    // funcionando sem alteracao.
    // ---------------------------------------------

    window.oziValidateContainer = function (config) {
        var conf = window.OZI && window.OZI.conf;
        if (conf && conf.core && conf.core.log) {
            console.warn('[OZI] oziValidateContainer depreciado. Use OZI.modules.validate.container() ou OziCollector.collect().');
        }

        // compat: aceita config no formato antigo do loadData
        return collect({
            zldCatchGroupId:  config.zldCatchGroupId  || config.container || [],
            zldCatchItemName: config.zldCatchItemName || config.zldCatchItemName || [],
            formData:         config.formData,
            silent:           config.applyUi === false,
            log:              config.loadData && config.loadData.zldLog
        });
    };

})(jQuery, window, document);