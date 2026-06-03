/**
 * ------------------------------------------
 * ozi-validate
 * ------------------------------------------
 * Ver: 1.0.2
 * 2026-05-30
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
 * Dependencias: ozi.js (OZI.conf, OZI.helpers, OZI.lang)
 * Consumido por: ozi-loaddata-collector.js, qualquer plugin OZI
 * Expoe: OZI.modules.validate, window.oziValidateContainer (compat)
 *
 * Changelog:
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

(function ($, window, document) {
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

    function _parseBool($el, attr, fallback) {
        var nativeBool = ['required', 'disabled', 'checked', 'multiple', 'readonly'];
        if (nativeBool.indexOf(attr) !== -1) {
            return $el.prop(attr) === true;
        }

        var val = $el.attr(attr);
        if (val === undefined || val === null) return fallback || false;
        return val === 'true' || val === '1' || val === 'required' || val === attr;
    }

    function _isDisabled($el) {
        return $el.prop('disabled') === true;
    }


    // ---------------------------------------------
    // [4] APLICACAO DE ESTADO VISUAL
    // Classes via classMap — sem Bootstrap hardcoded.
    // ---------------------------------------------

    function _applyState($el, state) {
        var clsInvalid  = _classMap('invalid',  'ozi-invalid');
        var clsValid    = _classMap('valid',     'ozi-valid');
        var clsFeedback = _classMap('feedback',  'ozi-feedback');

        $el.removeClass(clsInvalid + ' ' + clsValid);

        if (state === 'invalid') {
            $el.addClass(clsInvalid);
            var msg = $el.attr('data-ozi-required-message')
                || $el.attr('data-zld-required-message')
                || _t('common.required');
            var $feedback = $el.siblings('.' + clsFeedback);
            if ($feedback.length) $feedback.text(msg).show();

        } else if (state === 'valid') {
            $el.addClass(clsValid);
            var $fb = $el.siblings('.' + clsFeedback);
            if ($fb.length) $fb.hide();

        } else {
            // reset
            var $fbReset = $el.siblings('.' + clsFeedback);
            if ($fbReset.length) $fbReset.hide();
        }
    }


    // ---------------------------------------------
    // [5] ADAPTER PADRAO — campos nativos HTML
    // ---------------------------------------------

    var _nativeAdapter = {
        name: 'native',

        match: function ($el) {
            return $el.is('input, select, textarea');
        },

        isValid: function ($el) {
            var type     = ($el.attr('type') || 'text').toLowerCase();
            var required = _parseBool($el, 'required', false)
                || _parseBool($el, 'data-ozi-required', false);

            if (_isDisabled($el)) return true;
            if (!required) return true;

            var val = $el.val();

            if (type === 'checkbox') return $el.prop('checked');

            if (type === 'radio') {
                var name = $el.attr('name');
                return name ? $('[name="' + name + '"]:checked').length > 0 : $el.prop('checked');
            }

            if (type === 'file') {
                return $el[0] && $el[0].files && $el[0].files.length > 0;
            }

            if (type === 'email') {
                if (!val || val.trim() === '') return false;
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
            }

            var minLen = parseInt($el.attr('minlength') || '0', 10);
            if (minLen > 0 && (!val || val.length < minLen)) return false;

            var maxLen = parseInt($el.attr('maxlength') || '0', 10);
            if (maxLen > 0 && val && val.length > maxLen) return false;

            var min = $el.attr('min');
            var max = $el.attr('max');
            if (min !== undefined && val !== '' && parseFloat(val) < parseFloat(min)) return false;
            if (max !== undefined && val !== '' && parseFloat(val) > parseFloat(max)) return false;

            return val !== null && val !== undefined && String(val).trim() !== '';
        },

        getValue: function ($el) {
            var type = ($el.attr('type') || 'text').toLowerCase();

            if (type === 'checkbox') {
                return $el.prop('checked') ? ($el.val() || '1') : null;
            }

            if (type === 'radio') {
                var checked = $('[name="' + $el.attr('name') + '"]:checked');
                return checked.length ? checked.val() : null;
            }

            if (type === 'file') {
                return ($el[0] && $el[0].files) ? $el[0].files : null;
            }

            if ($el.is('select[multiple]')) {
                var selected = [];
                $el.find('option:selected').each(function () {
                    selected.push($(this).val());
                });
                return selected.length ? selected : null;
            }

            return $el.val();
        },

        setState: function ($el, state) {
            _applyState($el, state);
        }
    };


    // ---------------------------------------------
    // [6] SELECAO DE ADAPTER PARA ELEMENTO
    // ---------------------------------------------

    function _getAdapter($el) {
        for (var i = 0; i < _adapters.length; i++) {
            try {
                if (_adapters[i].match($el)) return _adapters[i];
            } catch (e) {}
        }
        return _nativeAdapter;
    }


    // ---------------------------------------------
    // [7] COLETA DE CAMPOS DO CONTAINER
    // ---------------------------------------------

    function _collectFields($scope) {
        return $scope
            .find('input, select, textarea, [data-ozi-required]')
            .not('[type="hidden"]')
            .not('.select2-search__field');
    }


    // ---------------------------------------------
    // [8] VALIDACAO DE CONTAINER — funcao principal
    // ---------------------------------------------

    function _container(config) {
        config = config || {};

        var silent        = config.silent      === true;
        var focusOnError  = config.focusOnError === true;

        var formData      = config.formData || new FormData();
        var data          = {};
        var invalidFields = [];
        var $firstInvalid = null;
        var _radioSeen    = {};
        var _selectSeen   = {};

        var $fields;
        if (config.$elements && config.$elements.length) {
            $fields = config.$elements.filter('input, select, textarea, [data-ozi-required]')
                .not('[type="hidden"]')
                .not('.select2-search__field');
        } else {
            var $scope = config.$container ? $(config.$container) : $(document);
            $fields = _collectFields($scope);
        }

        $fields.each(function () {
            var $el      = $(this);
            var adapter  = _getAdapter($el);
            var type     = ($el.attr('type') || '').toLowerCase();
            var name     = $el.attr('name') || $el.attr('id') || '';
            var required = _parseBool($el, 'required', false)
                || _parseBool($el, 'data-ozi-required', false);

            if (!name) return;

            if (type === 'radio') {
                if (_radioSeen[name]) return;
                _radioSeen[name] = true;
            }

            if ($el.is('select[multiple]')) {
                if (_selectSeen[name]) return;
                _selectSeen[name] = true;
            }

            var valid = adapter.isValid($el);
            var value = adapter.getValue($el);

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
                adapter.setState($el, valid ? 'valid' : 'invalid');
            } else if (!silent && !required) {
                adapter.setState($el, 'reset');
            }

            if (required && !valid) {
                invalidFields.push({ $el: $el, name: name, adapter: adapter.name });
                if (!$firstInvalid) $firstInvalid = $el;
            }
        });

        if (focusOnError && $firstInvalid) {
            try { $firstInvalid.focus(); } catch (e) {}
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

    function _initInteractive() {
        if (_interactiveBound) return;
        _interactiveBound = true;

        var events = 'input.oziValidate change.oziValidate blur.oziValidate';

        $(document).on(
            events,
            '[data-ozi-validate] input, [data-ozi-validate] select, [data-ozi-validate] textarea',
            function () {
                var $el     = $(this);
                var adapter = _getAdapter($el);
                var required = _parseBool($el, 'required', false)
                    || _parseBool($el, 'data-ozi-required', false);
                if (!required) return;
                var valid = adapter.isValid($el);
                adapter.setState($el, valid ? 'valid' : 'invalid');
            }
        );
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

        applyState: function ($el, state) {
            var adapter = _getAdapter($el);
            adapter.setState($el, state);
        },

        initInteractive: _initInteractive,

        field: function ($el) {
            $el = $($el);
            if (!$el.length) return { valid: true, value: null };

            var adapter  = _getAdapter($el);
            var required = _parseBool($el, 'required', false)
                || _parseBool($el, 'data-ozi-required', false);
            var valid    = adapter.isValid($el);
            var value    = adapter.getValue($el);

            if (required) {
                adapter.setState($el, valid ? 'valid' : 'invalid');
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

    $(function () {
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
    });

})(jQuery, window, document);