/**
 * ------------------------------------------
 * ozi-validate
 * ------------------------------------------
 * Ver: 2.1.0
 * 2026-07-03
 *
 * Responsabilidade:
 *   - Motor generico de validacao de campos por container
 *   - Adapter pattern para componentes OZI registrarem como ler/setar estado
 *   - Aplicar classes valid/invalid via OZI.conf.classMap
 *   - Retornar formData, data, invalidFields, isValid
 *
 * O que NAO faz:
 *   - Nao valida regras de negocio (senhas, etc.)
 *   - Nao conhece componentes especificos — adapters registram o contrato
 *   - Nao conhece zldCatchGroupId / zldCatchItemName — responsabilidade do collector
 *
 * Dependencias: ozi.js (OZI.conf, OZI.helpers, OZI.lang) — zero jQuery (contrato de camadas v2).
 * Consumido por: ozi-loaddata-collector.js, qualquer plugin OZI
 * Expoe: OZI.modules.validate, window.oziValidateContainer (compat)
 *
 * Changelog:
 *   - v2.1.0: [V2-F2] registerAdapter() aceita flag `nativeElement: true` —
 *     adapters que ja migraram (ex: ozi-select) recebem Element puro em vez
 *     de serem envelopados em jQuery por _wrapLegacy(). Adapters sem a flag
 *     (ainda-v1: autocomplete, editor, audio) continuam recebendo jQuery.
 *   - v2.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Motor interno (coleta, estado visual, validacao interativa) 100% nativo:
 *         querySelectorAll/closest/classList/addEventListener no lugar de jQuery.
 *       - Validacao interativa usa delegacao nativa em document (input/change/focusout —
 *         focusout no lugar de blur porque blur nao faz bubble).
 *       - Adapters registrados por componentes ainda v1 (ozi-select, ozi-autocomplete,
 *         ozi-editor, ozi-audio — pendentes na F2) continuam recebendo o elemento
 *         envelopado em jQuery: ponte de transicao via _wrapLegacy() (guard-ok),
 *         removida quando cada um desses componentes migrar. O adapter nativo passa
 *         a receber sempre Element puro.
 *       - `container()`/`field()` aceitam Element nativo, jQuery ou seletor via
 *         `OZI.helpers.toElement/toElements` (contrato de helpers de transicao).
 *       - `invalidFields[].el` substitui `invalidFields[].$el` (nao ha consumidor
 *         externo do campo — grep confirmou uso só de `.name`).
 *   - v1.0.3: [FIX-P3] Coleta passa a preservar hidden gerado por componentes OZI.
 *     Antes, _collectFields/$elements descartavam TODO [type="hidden"], jogando fora
 *     o valor de componentes que submetem via hidden (ex: ozi-select em form ZLD).
 *     Agora hidden so e descartado se NAO estiver dentro de [data-ozi-component-hidden],
 *     preservando _token/_method/flags de infraestrutura. Ver _isInfraHidden().
 *   - v1.0.2: [FIX-P2] Removido fallback Bootstrap5 hardcoded de _classMap().
 *     O fallback anterior ('is-invalid', 'is-valid', 'invalid-feedback') forcava
 *     classes BS5 em projetos com tema 'default' ou 'tailwind' quando OZI.conf
 *     ainda nao estava disponivel (race condition durante boot).
 *     Agora retorna fallback neutro — classMap do tema correto e aplicado
 *     assim que OZI.conf estiver pronto.
 *   - v1.0.1: guard singleton adicionado
 *   - v1.0.1: _applyState usa classMap do OZI.conf (nao hardcoded)
 *   - v1.0.1: adapter nativo — coleta de FileList alinhada com loadData v1.0.1
 *   - v1.0.1: registro no namespace dentro do DOMReady (garante OZI bootado)
 *   - v1.0.1: focusOnError suportado em _container
 *   - v1.0.1: hook OZI.hooks.afterRender registrado como 'module:validate'
 *   - v1.0.1: Removido acoplamento a Select2/CKEditor (adapter pattern resolve)
 */

(function (window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziValidate) return;


    // ---------------------------------------------
    // [2] REGISTRY DE ADAPTERS
    // ---------------------------------------------

    var _adapters = [];


    // ---------------------------------------------
    // [3] HELPERS INTERNOS
    // ---------------------------------------------

    function _classMap(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        var mapped = conf && conf.classMap && conf.classMap[key];
        // [FIX-P2] Removido fallback Bootstrap5 hardcoded.
        // Retorna apenas o valor do classMap do tema ativo ou o fallback neutro.
        // O classMap correto e definido pelo tema em OZI.conf (bootstrap5, tailwind, default).
        return mapped || fallback || '';
    }

    function _t(key) {
        var lang = window.OZI && window.OZI.lang;
        return (lang && typeof lang.t === 'function') ? lang.t(key) : key;
    }

    function _parseBool(el, attr, fallback) {
        var nativeBool = ['required', 'disabled', 'checked', 'multiple', 'readonly'];
        if (nativeBool.indexOf(attr) !== -1) {
            return el[attr] === true;
        }

        var val = el.getAttribute(attr);
        if (val === null) return fallback || false;
        return val === 'true' || val === '1' || val === 'required' || val === attr;
    }

    function _isDisabled(el) {
        return el.disabled === true;
    }

    function _classListOp(el, classString, method) {
        if (!classString) return;
        classString.trim().split(/\s+/).forEach(function (c) {
            if (c) el.classList[method](c);
        });
    }

    function _findFeedbackSibling(el, classString) {
        if (!classString || !el.parentNode) return null;
        var selector = '.' + classString.trim().split(/\s+/).join('.');
        var siblings = el.parentNode.children;
        for (var i = 0; i < siblings.length; i++) {
            if (siblings[i] !== el && siblings[i].matches(selector)) return siblings[i];
        }
        return null;
    }

    // ponte de transicao — adapters registrados por componentes ainda v1
    // (ozi-autocomplete, ozi-editor, ozi-audio) esperam objeto jQuery
    // ($el.is/$el[0]); removida quando cada um migrar (F2). Adapters v2
    // (ex: ozi-select) marcam `nativeElement: true` no registerAdapter()
    // para receber Element puro, sem envelopar.
    function _wrapLegacy(el) {
        return (typeof window.jQuery !== 'undefined') ? window.jQuery(el) : el; // guard-ok
    }

    function _adapterArg(adapter, el) {
        return adapter.nativeElement ? el : _wrapLegacy(el);
    }

    function _call(adapter, method, el, extra) {
        var arg = (adapter === _nativeAdapter) ? el : _adapterArg(adapter, el);
        return extra === undefined ? adapter[method](arg) : adapter[method](arg, extra);
    }


    // ---------------------------------------------
    // [4] APLICACAO DE ESTADO VISUAL
    // Classes via classMap — sem Bootstrap hardcoded.
    // ---------------------------------------------

    function _applyState(el, state) {
        var clsInvalid  = _classMap('invalid',  'ozi-invalid');
        var clsValid    = _classMap('valid',     'ozi-valid');
        var clsFeedback = _classMap('feedback',  'ozi-feedback');

        _classListOp(el, clsInvalid, 'remove');
        _classListOp(el, clsValid,   'remove');

        if (state === 'invalid') {
            _classListOp(el, clsInvalid, 'add');
            var msg = el.getAttribute('data-ozi-required-message')
                || el.getAttribute('data-zld-required-message')
                || _t('common.required');
            var feedback = _findFeedbackSibling(el, clsFeedback);
            if (feedback) { feedback.textContent = msg; feedback.style.display = ''; }

        } else if (state === 'valid') {
            _classListOp(el, clsValid, 'add');
            var fb = _findFeedbackSibling(el, clsFeedback);
            if (fb) fb.style.display = 'none';

        } else {
            // reset
            var fbReset = _findFeedbackSibling(el, clsFeedback);
            if (fbReset) fbReset.style.display = 'none';
        }
    }


    // ---------------------------------------------
    // [5] ADAPTER PADRAO — campos nativos HTML
    // ---------------------------------------------

    var _nativeAdapter = {
        name: 'native',

        match: function (el) {
            var tag = el.tagName;
            return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
        },

        isValid: function (el) {
            var type     = (el.getAttribute('type') || 'text').toLowerCase();
            var required = _parseBool(el, 'required', false)
                || _parseBool(el, 'data-ozi-required', false);

            if (_isDisabled(el)) return true;
            if (!required) return true;

            var val = el.value;

            if (type === 'checkbox') return el.checked;

            if (type === 'radio') {
                var name = el.name;
                if (!name) return el.checked;
                return document.querySelector('[name="' + name + '"]:checked') !== null;
            }

            if (type === 'file') {
                return !!(el.files && el.files.length > 0);
            }

            if (type === 'email') {
                if (!val || val.trim() === '') return false;
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
            }

            var minLen = parseInt(el.getAttribute('minlength') || '0', 10);
            if (minLen > 0 && (!val || val.length < minLen)) return false;

            var maxLen = parseInt(el.getAttribute('maxlength') || '0', 10);
            if (maxLen > 0 && val && val.length > maxLen) return false;

            var min = el.getAttribute('min');
            var max = el.getAttribute('max');
            if (min !== null && val !== '' && parseFloat(val) < parseFloat(min)) return false;
            if (max !== null && val !== '' && parseFloat(val) > parseFloat(max)) return false;

            return val !== null && val !== undefined && String(val).trim() !== '';
        },

        getValue: function (el) {
            var type = (el.getAttribute('type') || 'text').toLowerCase();

            if (type === 'checkbox') {
                return el.checked ? (el.value || '1') : null;
            }

            if (type === 'radio') {
                var checked = el.name
                    ? document.querySelector('[name="' + el.name + '"]:checked')
                    : (el.checked ? el : null);
                return checked ? checked.value : null;
            }

            if (type === 'file') {
                return (el.files && el.files.length) ? el.files : null;
            }

            if (el.tagName === 'SELECT' && el.multiple) {
                var selected = [];
                for (var i = 0; i < el.options.length; i++) {
                    if (el.options[i].selected) selected.push(el.options[i].value);
                }
                return selected.length ? selected : null;
            }

            return el.value;
        },

        setState: function (el, state) {
            _applyState(el, state);
        }
    };


    // ---------------------------------------------
    // [6] SELECAO DE ADAPTER PARA ELEMENTO
    // ---------------------------------------------

    function _getAdapter(el) {
        for (var i = 0; i < _adapters.length; i++) {
            try {
                if (_adapters[i].match(_adapterArg(_adapters[i], el))) return _adapters[i];
            } catch (e) {}
        }
        return _nativeAdapter;
    }


    // ---------------------------------------------
    // [7] COLETA DE CAMPOS DO CONTAINER
    // ---------------------------------------------

    // hidden de infraestrutura (_token, _method, flags) deve ser descartado,
    // mas hidden gerado por um componente OZI (ex: ozi-select) carrega o valor
    // real da selecao — esse precisa ser coletado. O componente marca seu
    // container com [data-ozi-component-hidden].
    function _isInfraHidden(el) {
        return el.type === 'hidden' && !el.closest('[data-ozi-component-hidden]');
    }

    function _isCollectible(el) {
        var tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA' && !el.hasAttribute('data-ozi-required')) return false;
        if (el.classList.contains('select2-search__field')) return false;
        if (_isInfraHidden(el)) return false;
        return true;
    }

    function _collectFields(scope) {
        var all = scope.querySelectorAll('input, select, textarea, [data-ozi-required]');
        return Array.prototype.filter.call(all, _isCollectible);
    }


    // ---------------------------------------------
    // [8] VALIDACAO DE CONTAINER — funcao principal
    // ---------------------------------------------

    function _container(config) {
        config = config || {};

        var silent       = config.silent      === true;
        var focusOnError = config.focusOnError === true;

        var formData      = config.formData || new FormData();
        var data          = {};
        var invalidFields = [];
        var firstInvalid  = null;
        var _radioSeen    = {};
        var _selectSeen   = {};

        var helpers = window.OZI && window.OZI.helpers;

        var fields;
        if (config.$elements) {
            var rawEls = helpers.toElements(config.$elements);
            fields = rawEls.filter(_isCollectible);
        } else {
            var scopeEl = config.$container ? helpers.toElement(config.$container) : document;
            fields = _collectFields(scopeEl);
        }

        fields.forEach(function (el) {
            var adapter  = _getAdapter(el);
            var type     = (el.getAttribute('type') || '').toLowerCase();
            var name     = el.getAttribute('name') || el.id || '';
            var required = _parseBool(el, 'required', false)
                || _parseBool(el, 'data-ozi-required', false);

            if (!name) return;

            if (type === 'radio') {
                if (_radioSeen[name]) return;
                _radioSeen[name] = true;
            }

            if (el.tagName === 'SELECT' && el.multiple) {
                if (_selectSeen[name]) return;
                _selectSeen[name] = true;
            }

            var valid = _call(adapter, 'isValid', el);
            var value = _call(adapter, 'getValue', el);

            if (value instanceof FileList) {
                Array.prototype.forEach.call(value, function (f) {
                    formData.append(name, f, f.name);
                });
                data[name] = value;

            } else if (Array.isArray(value)) {
                value.forEach(function (v) {
                    formData.append(name + '[]', v);
                });
                data[name] = value;

            } else if (value !== null && value !== undefined && value !== '') {
                formData.append(name, String(value));
                data[name] = value;
            }

            if (!silent && required) {
                _call(adapter, 'setState', el, valid ? 'valid' : 'invalid');
            } else if (!silent && !required) {
                _call(adapter, 'setState', el, 'reset');
            }

            if (required && !valid) {
                invalidFields.push({ el: el, name: name, adapter: adapter.name });
                if (!firstInvalid) firstInvalid = el;
            }
        });

        if (focusOnError && firstInvalid) {
            try { firstInvalid.focus(); } catch (e) {}
        }

        return {
            formData:        formData,
            data:            data,
            isValid:         invalidFields.length === 0,
            invalidFields:   invalidFields,
            ldValidate:      invalidFields.length,
            zldValidateName: invalidFields.map(function (f) { return f.name; })
        };
    }


    // ---------------------------------------------
    // [9] VALIDACAO INTERATIVA
    // ---------------------------------------------

    var _interactiveBound = false;
    var _interactiveSelector = '[data-ozi-validate] input, [data-ozi-validate] select, [data-ozi-validate] textarea';

    function _onInteractiveEvent(e) {
        var el = e.target.closest(_interactiveSelector);
        if (!el) return;

        var adapter  = _getAdapter(el);
        var required = _parseBool(el, 'required', false)
            || _parseBool(el, 'data-ozi-required', false);
        if (!required) return;

        var valid = _call(adapter, 'isValid', el);
        _call(adapter, 'setState', el, valid ? 'valid' : 'invalid');
    }

    function _initInteractive() {
        if (_interactiveBound) return;
        _interactiveBound = true;

        // 'focusout' no lugar de 'blur' — blur nao faz bubble, delegacao precisa de bubble
        document.addEventListener('input',    _onInteractiveEvent);
        document.addEventListener('change',   _onInteractiveEvent);
        document.addEventListener('focusout', _onInteractiveEvent);
    }


    // ---------------------------------------------
    // [10] API PUBLICA — OZI.modules.validate
    // ---------------------------------------------

    var validate = {

        registerAdapter: function (adapter) {
            if (!adapter || !adapter.name || typeof adapter.match !== 'function') {
                console.warn('[OZI:validate] registerAdapter: adapter invalido.');
                return;
            }
            for (var i = 0; i < _adapters.length; i++) {
                if (_adapters[i].name === adapter.name) {
                    _adapters[i] = adapter;
                    return;
                }
            }
            _adapters.push(adapter);
        },

        container: _container,

        applyState: function (elArg, state) {
            var helpers = window.OZI && window.OZI.helpers;
            var el = helpers.toElement(elArg);
            if (!el) return;
            var adapter = _getAdapter(el);
            _call(adapter, 'setState', el, state);
        },

        initInteractive: _initInteractive,

        field: function (elArg) {
            var helpers = window.OZI && window.OZI.helpers;
            var el = helpers.toElement(elArg);
            if (!el) return { valid: true, value: null };

            var adapter  = _getAdapter(el);
            var required = _parseBool(el, 'required', false)
                || _parseBool(el, 'data-ozi-required', false);
            var valid    = _call(adapter, 'isValid', el);
            var value    = _call(adapter, 'getValue', el);

            if (required) {
                _call(adapter, 'setState', el, valid ? 'valid' : 'invalid');
            }

            return { valid: valid, value: value };
        },

        getAdapters: function () {
            return _adapters.map(function (a) { return a.name; }).concat(['native']);
        }
    };


    // ---------------------------------------------
    // [11] INICIALIZACAO
    // ---------------------------------------------

    var _interactiveConf = (function () {
        var conf = window.OZI && window.OZI.conf;
        return conf && conf.pluginConf && conf.pluginConf.loaddata
            ? conf.pluginConf.loaddata.interactiveValidation !== false
            : true;
    })();

    if (_interactiveConf) {
        _initInteractive();
    }


    // ---------------------------------------------
    // [12] EXPOSICAO
    // ---------------------------------------------

    window.OziValidate = validate;

    function _expose() {
        if (window.OZI && window.OZI.modules) {
            window.OZI.modules.validate = validate;
        }

        window.oziValidateContainer = function (config) {
            if (window.OZI && window.OZI.conf && window.OZI.conf.core && window.OZI.conf.core.log) {
                console.warn('[OZI] oziValidateContainer depreciado. Use OZI.modules.validate.container().');
            }
            return _container(config || {});
        };

        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('module:validate', function (root) {
                _initInteractive();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _expose);
    } else {
        _expose();
    }

})(window, document);
