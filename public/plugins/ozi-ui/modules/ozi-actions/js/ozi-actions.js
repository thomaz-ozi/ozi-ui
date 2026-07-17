/**
 * ------------------------------------------
 * ozi-actions
 * ------------------------------------------
 * Ver: 2.0.0
 * 2026-07-04
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
 * Dependencias: ozi.js (OZI.conf, OZI.lang) — zero jQuery (contrato de camadas
 *   v2 §2). Modulo interno consumido por ozi-loaddata (ja migrado). Integra com
 *   Bootstrap 5 via API NATIVA (window.bootstrap.Modal/Offcanvas/Toast), nunca jQuery.
 * Expoe: OZI.modules.actions, window.OziActions, window.zldActions (compat)
 *
 * Changelog:
 *   - v2.0.0: [V2-F2] Zero jQuery. Adapters de tema (bootstrap5/default/tailwind)
 *       reescritos em DOM nativo (createElement/querySelector/classList/style).
 *       Toast BS5 via document.body.appendChild; toast default troca $.fadeOut por
 *       transicao de opacidade. **Removido o fallback `$.fn.modal('show'|'hide')`**
 *       (plugin jQuery estilo BS4 — morto no BS5): modal/offcanvas usam SOMENTE a
 *       API nativa `window.bootstrap.*`. Boot $(fn) -> readyState/DOMContentLoaded.
 *       Nucleo (registry, run, handlers universais, set-value/set-options via
 *       CustomEvent) ja era vanilla.
 *   - v1.0.1: guard singleton; registro no $(function); _extend ES5;
 *       hook module:actions.
 */

(function (window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziActions) return;


    // ---------------------------------------------
    // [2] REGISTRY DE HANDLERS E ADAPTERS
    // handlers: { type -> fn(action, ctx) }
    // themeAdapters: { theme -> { type -> fn } }
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

    // resolve id (com ou sem '#') para Element
    function _byId(id) {
        if (!id) return null;
        return document.querySelector(id.charAt(0) === '#' ? id : '#' + id);
    }

    function _all(selector) {
        return Array.prototype.slice.call(document.querySelectorAll(selector));
    }


    // ---------------------------------------------
    // [4] ADAPTERS DE TEMA — BUILT-IN
    //
    // Handler recebe (action, ctx):
    //   action: { type, payload, ... }
    //   ctx:    { trigger, result }
    // ---------------------------------------------

    // ── bootstrap5 (API NATIVA — sem jQuery) ──────

    _themeAdapters['bootstrap5'] = {

        'toast': function (action) {
            var p       = action.payload || action;
            var message = p.message || p.msg || '';
            var level   = p.level || p.type || 'info';
            var delay   = p.delay || 4000;

            // UIToast (tema Up-Bond)
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
                var toast = document.createElement('div');
                toast.className = 'toast align-items-center text-bg-' + level +
                    ' border-0 position-fixed bottom-0 end-0 m-3';
                toast.setAttribute('role', 'alert');
                toast.innerHTML =
                    '<div class="d-flex">' +
                    '<div class="toast-body">' + message + '</div>' +
                    '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
                    '</div>';
                document.body.appendChild(toast);
                var t = new window.bootstrap.Toast(toast, { delay: delay });
                t.show();
                toast.addEventListener('hidden.bs.toast', function () {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                });
                return;
            }
            // fallback: console
            console.info('[OZI:actions] toast:', level, message);
        },

        'modal-open': function (action) {
            var p  = action.payload || action;
            var el = _byId(p.id || p.target || p.selector || '');
            if (!el) return;
            if (window.bootstrap && window.bootstrap.Modal) {
                window.bootstrap.Modal.getOrCreateInstance(el).show();
            }
        },

        'modal-close': function (action) {
            if (!(window.bootstrap && window.bootstrap.Modal)) return;
            var p  = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) {
                var el = _byId(id);
                if (el) { var inst = window.bootstrap.Modal.getInstance(el); if (inst) inst.hide(); }
            } else {
                // fecha todos os modais abertos
                _all('.modal.show').forEach(function (m) {
                    var inst = window.bootstrap.Modal.getInstance(m);
                    if (inst) inst.hide();
                });
            }
        },

        'offcanvas-open': function (action) {
            var p  = action.payload || action;
            var el = _byId(p.id || p.target || p.selector || '');
            if (!el) return;
            if (window.bootstrap && window.bootstrap.Offcanvas) {
                window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
            }
        },

        'offcanvas-close': function (action) {
            if (!(window.bootstrap && window.bootstrap.Offcanvas)) return;
            var p    = action.payload || action;
            var id   = p.id || p.target || p.selector || '';
            var list = id ? [_byId(id)] : _all('.offcanvas.show');
            list.forEach(function (el) {
                if (!el) return;
                var inst = window.bootstrap.Offcanvas.getInstance(el);
                if (inst) inst.hide();
            });
        }
    };

    // ── default (sem framework UI) ─────────────────

    _themeAdapters['default'] = {

        'toast': function (action) {
            var p       = action.payload || action;
            var message = p.message || p.msg || '';
            var level   = p.level || 'info';
            var toast   = document.createElement('div');
            toast.className = 'ozi-toast ozi-toast-' + level;
            toast.innerHTML = message;
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.style.transition = 'opacity 300ms';
                toast.style.opacity    = '0';
                setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
            }, 3500);
        },

        'modal-open': function (action) {
            var p  = action.payload || action;
            var el = _byId(p.id || p.target || p.selector || '');
            if (el) el.style.display = 'block';
        },

        'modal-close': function (action) {
            var p  = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) {
                var el = _byId(id);
                if (el) el.style.display = 'none';
            } else {
                _all('.ozi-modal').forEach(function (m) { m.style.display = 'none'; });
            }
        },

        'offcanvas-open': function (action) {
            var p  = action.payload || action;
            var el = _byId(p.id || p.target || p.selector || '');
            if (el) el.classList.add('ozi-open');
        },

        'offcanvas-close': function (action) {
            var p  = action.payload || action;
            var id = p.id || p.target || p.selector || '';
            if (id) {
                var el = _byId(id);
                if (el) el.classList.remove('ozi-open');
            } else {
                _all('.ozi-offcanvas').forEach(function (el) { el.classList.remove('ozi-open'); });
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

        run: function (actionsArr, ctx) {
            if (!Array.isArray(actionsArr) || !actionsArr.length) return;
            ctx = ctx || {};
            actionsArr.forEach(function (action) {
                _runOne(action, ctx);
            });
        },

        registerHandler: function (type, fn) {
            if (!type || typeof fn !== 'function') {
                _log('registerHandler: type e fn sao obrigatorios.');
                return;
            }
            _handlers[String(type).toLowerCase()] = fn;
            _log('handler registrado:', type);
        },

        registerThemeAdapter: function (theme, handlers) {
            if (!theme || !handlers || typeof handlers !== 'object') {
                _log('registerThemeAdapter: theme e handlers sao obrigatorios.');
                return;
            }
            _themeAdapters[theme] = _extend(_themeAdapters[theme] || {}, handlers);
            _log('theme adapter registrado:', theme);
        },

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
    // ---------------------------------------------

    // alias objeto — imediato (sem depender do OZI)
    window.OziActions = actions;

    function _boot() {
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

        _log('ozi-actions v2.0.0 pronto. tema:', _theme());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})(window, document);
