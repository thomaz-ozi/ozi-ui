/**
 * ------------------------------------------
 * ozi-actions
 * ------------------------------------------
 * Ver: 1.0.1
 * 2026-05-27
 *
 * Responsabilidade:
 *   - Executar acoes declarativas retornadas pelo backend Laravel
 *   - Adapter pattern por tema: bootstrap5, tailwind, default
 *   - Permitir registro de handlers customizados via registerHandler()
 *   - Permitir registro de adapters de tema via registerThemeAdapter()
 *
 * O que NAO faz:
 *   - Nao conhece Bootstrap, Tailwind ou qualquer UI framework diretamente
 *   - Nao faz requisicoes HTTP — usa OZI.modules.loadData para zld-load
 *
 * Dependencias: ozi.js (OZI.conf, OZI.lang)
 * Expoe: OZI.modules.actions, window.zldActions (compat)
 *
 * Changelog v1.0.1:
 *   - Corrigido: guard singleton adicionado
 *   - Corrigido: registro no namespace dentro do $(function) — garante OZI bootado
 *   - Corrigido: Object.assign substituido por _extend ES5 — consistencia com o projeto
 *   - Adicionado: hook OZI.hooks.afterRender registrado como 'module:actions'
 */

(function ($, window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziActions) return;


    // ---------------------------------------------
    // [2] REGISTRY DE HANDLERS E ADAPTERS
    // handlers: { type -> fn(action, ctx) }
    //   handlers customizados registrados pelo dev
    // themeAdapters: { theme -> { type -> fn } }
    //   handlers por tema (bootstrap5, tailwind, default)
    // ---------------------------------------------

    var _handlers      = {};
    var _themeAdapters = {};


    // ---------------------------------------------
    // [3] HELPERS INTERNOS
    // ---------------------------------------------

    function _conf(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        return (conf && conf[key] !== undefined) ? conf[key] : fallback;
    }

    function _theme() {
        return _conf('theme', 'default');
    }

    function _log(msg) {
        var conf = window.OZI && window.OZI.conf;
        if (!(conf && conf.core && conf.core.log)) return;
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[OZI:actions]');
        console.log.apply(console, args);
    }

    // merge simples ES5 — substitui Object.assign
    function _extend(target, source) {
        if (!source || typeof source !== 'object') return target;
        Object.keys(source).forEach(function (key) {
            target[key] = source[key];
        });
        return target;
    }

    // clone raso ES5 — substitui Object.assign({}, source)
    function _clone(source) {
        return _extend({}, source);
    }


    // ---------------------------------------------
    // [4] ADAPTERS DE TEMA — BUILT-IN
    //
    // Cada tema declara handlers para os tipos padrao.
    // Handler recebe (action, ctx):
    //   action: { type, payload, ... }
    //   ctx:    { trigger, result }
    // ---------------------------------------------

    // ── bootstrap5 ────────────────────────────────

    _themeAdapters['bootstrap5'] = {

        'toast': function (action) {
            var p       = action.payload || action;
            var message = p.message || p.msg || '';
            var level   = p.level || p.type || 'info';
            var delay   = p.delay || 4000;

            // UIToast (Up-Bond theme)
            if (typeof window.UIToast === 'function') {
                window.UIToast({ message: message, type: level, delay: delay });
                return;
            }
            // toastr
            if (window.toastr && typeof window.toastr[level] === 'function') {
                window.toastr[level](message);
                return;
            }
            // bootstrap 5 toast nativo
            if (window.bootstrap && window.bootstrap.Toast) {
                var $toast = $('<div class="toast align-items-center text-bg-' + level + ' border-0 position-fixed bottom-0 end-0 m-3" role="alert">' +
                    '<div class="d-flex">' +
                    '<div class="toast-body">' + message + '</div>' +
                    '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
                    '</div></div>');
                $('body').append($toast);
                var t = new window.bootstrap.Toast($toast[0], { delay: delay });
                t.show();
                $toast[0].addEventListener('hidden.bs.toast', function () { $toast.remove(); });
                return;
            }
            // fallback: console
            console.info('[OZI:actions] toast:', level, message);
        },

        'modal-open': function (action) {
            var p  = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (!id) return;
            var $el = $(id.charAt(0) === '#' ? id : '#' + id);
            if (!$el.length) return;
            if (window.bootstrap && window.bootstrap.Modal) {
                window.bootstrap.Modal.getOrCreateInstance($el[0]).show();
            } else if ($.fn.modal) {
                $el.modal('show');
            }
        },

        'modal-close': function (action) {
            var p  = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) {
                var $el = $(id.charAt(0) === '#' ? id : '#' + id);
                if (window.bootstrap && window.bootstrap.Modal) {
                    var inst = window.bootstrap.Modal.getInstance($el[0]);
                    if (inst) inst.hide();
                } else if ($.fn.modal) {
                    $el.modal('hide');
                }
            } else {
                // fecha todos os modais abertos
                if (window.bootstrap && window.bootstrap.Modal) {
                    $('.modal.show').each(function () {
                        var inst = window.bootstrap.Modal.getInstance(this);
                        if (inst) inst.hide();
                    });
                } else if ($.fn.modal) {
                    $('.modal').modal('hide');
                }
            }
        },

        'offcanvas-open': function (action) {
            var p  = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (!id) return;
            var $el = $(id.charAt(0) === '#' ? id : '#' + id);
            if (!$el.length) return;
            if (window.bootstrap && window.bootstrap.Offcanvas) {
                window.bootstrap.Offcanvas.getOrCreateInstance($el[0]).show();
            }
        },

        'offcanvas-close': function (action) {
            var p  = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            var $el = id
                ? $(id.charAt(0) === '#' ? id : '#' + id)
                : $('.offcanvas.show');
            $el.each(function () {
                if (window.bootstrap && window.bootstrap.Offcanvas) {
                    var inst = window.bootstrap.Offcanvas.getInstance(this);
                    if (inst) inst.hide();
                }
            });
        }
    };

    // ── default (sem framework UI) ─────────────────

    _themeAdapters['default'] = {

        'toast': function (action) {
            var p       = action.payload || action;
            var message = p.message || p.msg || '';
            var level   = p.level || 'info';
            var $toast  = $('<div class="ozi-toast ozi-toast-' + level + '">' + message + '</div>');
            $('body').append($toast);
            setTimeout(function () {
                $toast.fadeOut(300, function () { $(this).remove(); });
            }, 3500);
        },

        'modal-open': function (action) {
            var p = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) $(id.charAt(0) === '#' ? id : '#' + id).show();
        },

        'modal-close': function (action) {
            var p = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) {
                $(id.charAt(0) === '#' ? id : '#' + id).hide();
            } else {
                $('.ozi-modal').hide();
            }
        },

        'offcanvas-open': function (action) {
            var p = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) $(id.charAt(0) === '#' ? id : '#' + id).addClass('ozi-open');
        },

        'offcanvas-close': function (action) {
            var p = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) {
                $(id.charAt(0) === '#' ? id : '#' + id).removeClass('ozi-open');
            } else {
                $('.ozi-offcanvas').removeClass('ozi-open');
            }
        }
    };

    // tailwind — mesmo default por enquanto
    // dev pode sobrescrever via registerThemeAdapter()
    _themeAdapters['tailwind'] = _clone(_themeAdapters['default']);


    // ---------------------------------------------
    // [5] HANDLERS UNIVERSAIS
    // Independentes de tema — sempre iguais.
    // ---------------------------------------------

    var _universalHandlers = {

        'redirect': function (action) {
            var p      = action.payload || action;
            var url    = p.url || p.href || '';
            if (!url) return;
            var target = p.target || '_self';
            if (target === '_blank') {
                window.open(url, '_blank');
            } else {
                window.location.href = url;
            }
        },

        'reload': function (action) {
            var p     = action.payload || action;
            var delay = p.delay || 0;
            setTimeout(function () { window.location.reload(); }, delay);
        },

        'zld-load': function (action, ctx) {
            var p = action.payload || action;
            if (!p) return;
            // delega para OZI.modules.loadData (correto) ou fallback window
            var loadData = window.OZI && window.OZI.modules && window.OZI.modules.loadData;
            if (typeof loadData === 'function') {
                loadData(p, undefined, ctx && ctx.trigger);
            } else if (typeof window.oziLoadData === 'function') {
                window.oziLoadData(p);
            } else {
                _log('zld-load: oziLoadData indisponivel');
            }
        },

        'eval': function (action) {
            var p    = action.payload || action;
            var code = p.code || p.script || (typeof p === 'string' ? p : '');
            if (!code) return;
            try {
                (new Function(code))();
            } catch (e) {
                _log('eval erro:', e);
            }
        },

        'set-value': function (action) {
            var p   = action.payload || action;
            var key = p.key || '';
            var val = p.value;
            if (!key) return;
            document.dispatchEvent(new CustomEvent('ozi:set-value', {
                bubbles: true,
                detail:  { plugin: p.plugin || '', key: key, value: val }
            }));
        },

        'set-options': function (action) {
            var p       = action.payload || action;
            var key     = p.key || '';
            var options = p.options || [];
            if (!key) return;
            document.dispatchEvent(new CustomEvent('ozi:set-options', {
                bubbles: true,
                detail:  { plugin: p.plugin || '', key: key, options: options }
            }));
        }
    };


    // ---------------------------------------------
    // [6] EXECUCAO DE UMA ACAO
    // Prioridade: handler customizado -> tema -> universal -> warn
    // ---------------------------------------------

    function _runOne(action, ctx) {
        if (!action || !action.type) return;

        var type = String(action.type).toLowerCase();
        _log('executando:', type, action);

        // 1. handler customizado (dev registrou via registerHandler)
        if (_handlers[type]) {
            try { _handlers[type](action, ctx); } catch (e) { _log('erro em handler "' + type + '":', e); }
            return;
        }

        // 2. adapter de tema
        var theme   = _theme();
        var adapter = _themeAdapters[theme] || _themeAdapters['default'];
        if (adapter && adapter[type]) {
            try { adapter[type](action, ctx); } catch (e) { _log('erro em adapter "' + theme + '" para "' + type + '":', e); }
            return;
        }

        // 3. handler universal
        if (_universalHandlers[type]) {
            try { _universalHandlers[type](action, ctx); } catch (e) { _log('erro em handler universal "' + type + '":', e); }
            return;
        }

        _log('warn: tipo de action nao reconhecido:', type);
        console.warn('[OZI:actions] action nao mapeada:', type, action);
    }


    // ---------------------------------------------
    // [7] API PUBLICA — OZI.modules.actions
    // ---------------------------------------------

    var actions = {

        /**
         * run(actionsArr, ctx?)
         * Executa lista de acoes retornadas pelo backend.
         *
         * @param {Array}  actionsArr — [{ type, payload, ... }]
         * @param {object} [ctx]      — { trigger, result }
         */
        run: function (actionsArr, ctx) {
            if (!Array.isArray(actionsArr) || !actionsArr.length) return;
            ctx = ctx || {};
            actionsArr.forEach(function (action) {
                _runOne(action, ctx);
            });
        },

        /**
         * registerHandler(type, fn)
         * Registra handler customizado para um tipo de action.
         * Tem prioridade sobre adapters de tema.
         *
         * @param {string}   type — ex: 'minha-action'
         * @param {function} fn   — fn(action, ctx)
         */
        registerHandler: function (type, fn) {
            if (!type || typeof fn !== 'function') {
                _log('registerHandler: type e fn sao obrigatorios.');
                return;
            }
            _handlers[String(type).toLowerCase()] = fn;
            _log('handler registrado:', type);
        },

        /**
         * registerThemeAdapter(theme, handlers)
         * Registra ou sobrescreve handlers de um tema.
         *
         * @param {string} theme    — ex: 'meu-tema'
         * @param {object} handlers — { type: fn(action, ctx) }
         */
        registerThemeAdapter: function (theme, handlers) {
            if (!theme || !handlers || typeof handlers !== 'object') {
                _log('registerThemeAdapter: theme e handlers sao obrigatorios.');
                return;
            }
            _themeAdapters[theme] = _extend(_themeAdapters[theme] || {}, handlers);
            _log('theme adapter registrado:', theme);
        },

        /**
         * getHandlers()
         * Lista handlers e adapters registrados. Util para debug.
         */
        getHandlers: function () {
            return {
                custom:    Object.keys(_handlers),
                themes:    Object.keys(_themeAdapters),
                universal: Object.keys(_universalHandlers)
            };
        }
    };


    // ---------------------------------------------
    // [8] EXPOSICAO
    // Namespace e compat registrados dentro do DOMReady
    // para garantir que OZI ja bootou.
    // ---------------------------------------------

    // alias objeto — imediato (sem depender do OZI)
    window.OziActions = actions;

    $(function () {
        // namespace OZI
        if (window.OZI && window.OZI.modules) {
            window.OZI.modules.actions = actions;
        }

        // compat v0.x — zldActions
        window.zldActions = function (actionsArr, ctx) {
            if (window.OZI && window.OZI.conf && window.OZI.conf.core && window.OZI.conf.core.log) {
                console.warn('[OZI] zldActions depreciado. Use OZI.modules.actions.run().');
            }
            actions.run(actionsArr, ctx);
        };

        // hook OZI — sem acao necessaria, registro para consistencia
        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('module:actions', function () {
                // sem reinit necessario — handlers sao globais
            });
        }

        _log('ozi-actions v1.0.1 pronto. tema:', _theme());
    });

})(jQuery, window, document);