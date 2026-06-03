/**
 ------------------------------------------
 ozi-core
 ------------------------------------------
 Ver: 2.0.1
 2026-05-27


 *
 * [FIX-1] Ponte entre OZI.hooks.afterRender e zldConf.zldHooks.afterRender
 *
 *   Problema:
 *   - ozi-loaddata.js mantém seu próprio zldConf interno com zldHooks
 *   - ozi-core.js define window.zldConf como getter → OZI.conf.plugins.loadData (objeto diferente)
 *   - Plugins registram em OZI.hooks.afterRender
 *   - ozi-loaddata chama zldConf.zldHooks.afterRender após renderizar HTML
 *   - Os dois sistemas nunca se encontravam → plugins não reinicializavam
 *
 *   Solução:
 *   - ozi-loaddata.js expõe window.__zldConf (referência ao zldConf interno real)
 *   - ozi-core.js registra um relay em __zldConf.zldHooks.afterRender que
 *     propaga para OZI.hooks.afterRender.run()
 *   - Sentido único: zldConf → OZI.hooks (loaddata dispara, core repassa para plugins)
 *
 * [FIX-2] window.zldConf getter retorna __zldConf quando disponível
 *   para que código legado que acessa window.zldConf.zldHooks ainda funcione
 */

(function (window, document) {
    'use strict';

    if (window.OZI) {
        console.warn('[OZI] já inicializado. Ignorando.');
        return;
    }

    /* ─────────────────────────────────────────────
     * [1] NAMESPACE GLOBAL
     * ───────────────────────────────────────────── */

    var OZI = {
        version: '2.0.1',

        conf:         {},
        helpers:      {},
        modules:      {},
        components:   {},
        behaviors:    {},
        lang:         {},
        hooks:        {},
        integrations: {},
        loader:       {},

        isReady:         false,
        _readyCallbacks: []
    };

    window.OZI = OZI;

    /* ─────────────────────────────────────────────
     * [2] READY
     * ───────────────────────────────────────────── */

    OZI.ready = function (callback) {
        if (typeof callback !== 'function') return this;
        if (this.isReady) { callback(this); }
        else              { this._readyCallbacks.push(callback); }
        return this;
    };

    /* ─────────────────────────────────────────────
     * [3] LOG INTERNO
     * ───────────────────────────────────────────── */

    function _log(level, msg) {
        var active = OZI.conf && OZI.conf.core && OZI.conf.core.log;
        if (!active && level === 'info') return;
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift('[OZI v' + OZI.version + ']');
        if (level === 'warn')  console.warn.apply(console, args);
        if (level === 'error') console.error.apply(console, args);
        if (level === 'info')  console.log.apply(console, args);
    }

    OZI._log = _log;

    /* ─────────────────────────────────────────────
     * [4] PONTE DE HOOKS
     *
     * Conecta o sistema de hooks do ozi-loaddata
     * (zldConf.zldHooks.afterRender) ao sistema
     * unificado (OZI.hooks.afterRender).
     *
     * Direção: zldConf → OZI.hooks
     *   ozi-loaddata dispara zldConf.zldHooks.afterRender
     *   → relay propaga para OZI.hooks.afterRender.run()
     *   → todos os plugins registrados em OZI.hooks reinicializam
     *
     * Chamado após o boot, quando __zldConf já está disponível.
     * ───────────────────────────────────────────── */

    function _bridgeHooks() {
        // __zldConf é exposto pelo ozi-loaddata.js com os hooks reais
        var zldInternals = window.__zldConf;

        if (!zldInternals || !zldInternals.zldHooks) {
            _log('warn', 'bridge hooks: __zldConf não disponível — ozi-loaddata carregado?');
            return;
        }

        if (!Array.isArray(zldInternals.zldHooks.afterRender)) {
            _log('warn', 'bridge hooks: zldHooks.afterRender não é array');
            return;
        }

        // Evita duplicata se bridge já foi instalado
        var alreadyBridged = zldInternals.zldHooks.afterRender.some(function (fn) {
            return fn.__oziBridge === true;
        });

        if (alreadyBridged) return;

        // Relay: quando ozi-loaddata chama seus hooks após render,
        // propaga para OZI.hooks.afterRender (onde plugins se registram)
        var relay = function (root, loadData) {
            if (OZI.hooks && typeof OZI.hooks.afterRender === 'object' &&
                typeof OZI.hooks.afterRender.run === 'function') {
                OZI.hooks.afterRender.run(root, loadData);
            }
        };
        relay.__oziBridge = true;

        zldInternals.zldHooks.afterRender.push(relay);

        // Sentido inverso: quando OZI.hooks.afterRender.run() for chamado
        // diretamente (Livewire, etc.), propaga para zldConf também
        if (OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.registerSource === 'function') {
            OZI.hooks.afterRender.registerSource('zld', function (register) {
                register(relay);
            });
        }

        _log('info', 'bridge hooks: zldConf.zldHooks ↔ OZI.hooks conectados');
    }

    /* ─────────────────────────────────────────────
     * [5] BOOTSTRAP
     * ───────────────────────────────────────────── */

    function _bootstrap() {
        try {

            // ── conf ────────────────────────────────────
            if (typeof window.OziConf === 'undefined') {
                throw new Error('ozi-conf.js não foi carregado antes do ozi-core.js.');
            }
            OZI.conf = window.OziConf.init();
            _log('info', 'conf: ok — tema:', OZI.conf.theme, '| lang:', OZI.conf.lang);

            // ── helpers ─────────────────────────────────
            if (typeof window.OziHelpers !== 'undefined') {
                OZI.helpers = window.OziHelpers;
                _log('info', 'helpers: ok');
            } else {
                _log('warn', 'ozi-helpers.js não carregado.');
            }

            // ── lang ────────────────────────────────────
            if (typeof window.OziLang !== 'undefined') {
                OZI.lang = window.OziLang;
                OZI.lang.init(OZI.conf.lang || 'pt-BR', OZI.conf.fallbackLang || 'en');
                _log('info', 'lang: ok —', OZI.lang.current);
            } else {
                _log('warn', 'ozi-en.js não carregado — i18n indisponível.');
            }

            // ── hooks ───────────────────────────────────
            if (typeof window.OziHooks === 'undefined') {
                throw new Error('ozi-hooks.js não foi carregado antes do ozi-core.js.');
            }
            OZI.hooks = window.OziHooks;
            OZI.hooks._boot();
            _log('info', 'hooks: ok');

            // ── integrations ────────────────────────────
            if (typeof window.OziIntegrations !== 'undefined') {
                OZI.integrations = window.OziIntegrations;
                OZI.integrations._boot(OZI.conf.integrations || []);
                _log('info', 'integrations: ok');
            } else {
                _log('info', 'ozi-integrations.js não carregado.');
            }

            // ── loader ──────────────────────────────────
            if (typeof window.OziLoader !== 'undefined') {
                OZI.loader = window.OziLoader;
                _log('info', 'loader: ok');
            }

            // ── [FIX-1] ponte de hooks ──────────────────
            // Tenta agora — funciona se ozi-loaddata já carregou
            _bridgeHooks();

            // Se ozi-loaddata carregar depois (ordem de script no HTML),
            // instala a ponte no DOMContentLoaded também
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () {
                    _bridgeHooks();
                });
            } else {
                // DOM pronto — tenta mais uma vez (cobre script no fim do body)
                setTimeout(_bridgeHooks, 0);
            }

            // ── pronto ──────────────────────────────────
            OZI.isReady = true;

            OZI._readyCallbacks.forEach(function (fn) {
                try { fn(OZI); } catch (e) { _log('warn', 'erro em OZI.ready() callback:', e); }
            });
            OZI._readyCallbacks = [];

            _log('info', 'OZI v' + OZI.version + ' pronto ✓');

        } catch (err) {
            console.error('[OZI] bootstrap falhou:', err.message);
            if (OZI.conf && OZI.conf.core && OZI.conf.core.failFast) throw err;
        }
    }

    /* ─────────────────────────────────────────────
     * [6] oziConf() — ponto único de configuração
     * ───────────────────────────────────────────── */

    window.oziConf = function (userConfig) {
        if (typeof window.OziConf === 'undefined') {
            console.warn('[OZI] oziConf() chamado antes de ozi-conf.js carregar.');
            return;
        }
        window.OziConf.apply(userConfig);
        if (OZI.isReady) OZI.conf = window.OziConf.get();
    };

    /* ─────────────────────────────────────────────
     * [7] COMPAT RETROATIVA — aliases v0.x
     * ───────────────────────────────────────────── */

    Object.defineProperty(window, 'oziCore', {
        get: function () {
            _log('warn', 'window.oziCore depreciado → use window.OZI');
            return OZI;
        },
        configurable: true
    });

    // [FIX-2] window.zldConf retorna __zldConf (hooks reais do ozi-loaddata)
    // quando disponível, em vez do OZI.conf.plugins.loadData vazio
    Object.defineProperty(window, 'zldConf', {
        get: function () {
            if (OZI.isReady) {
                _log('warn', 'window.zldConf depreciado → use oziConf({ plugins: { loadData: {} } })');
            }
            // retorna o zldConf real do ozi-loaddata se disponível
            return window.__zldConf ||
                (OZI.conf && OZI.conf.plugins && OZI.conf.plugins.loadData) ||
                {};
        },
        configurable: true
    });

    Object.defineProperty(window, 'oziLoaddata', {
        get: function () {
            _log('warn', 'window.oziLoaddata depreciado (d minúsculo) → use window.oziLoadData');
            return window.oziLoadData || null;
        },
        configurable: true
    });

    if (!Object.getOwnPropertyDescriptor(window, 'OziFrameworks')) {
        Object.defineProperty(window, 'OziFrameworks', {
            get: function () {
                _log('warn', 'window.OziFrameworks depreciado → use OZI.integrations');
                return OZI.integrations || null;
            },
            configurable: true
        });
    }

    /* ─────────────────────────────────────────────
     * [8] AUTO-BOOT
     * ───────────────────────────────────────────── */

    if (typeof window.OziConf !== 'undefined' && typeof window.OziHooks !== 'undefined') {
        _bootstrap();
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bootstrap);
    } else {
        _bootstrap();
    }

})(window, document);