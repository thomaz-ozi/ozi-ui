/**
 *
 * ------------------------------------------
 * ozi
 * ------------------------------------------
 * Ver: 1.0.0
 * 2026-05-30
 *
 *
 * Ponto de entrada único do OZI-UI.
 *
 * O dev coloca apenas:
 *   <script src="./plugins/ozi-ui/ozi.js"></script>
 *
 * Com customização (opcional, sempre depois):
 *   <script src="./plugins/ozi-ui/ozi.js"></script>
 *   <script>
 *       oziConf({ lang: 'pt-BR', theme: 'bootstrap5' });
 *   </script>
 *
 * Sequência interna de boot:
 *   1. Cria window.OZI e window.oziConf (imediato)
 *   2. Detecta urlBase pelo próprio src
 *   3. Aguarda DOM pronto
 *   4. Carrega subsistemas do core (ozi-conf, ozi-hooks, ozi-lang, ozi-helpers, ozi-integrations)
 *   5. Aplica oziConf() pendente se houver
 *   6. Carrega plugins declarados (default: todos)
 *   7. Instala ponte de hooks (zldConf ↔ OZI.hooks) — unidirecional com flag de reentrada
 *   8. OZI.isReady = true → dispara callbacks OZI.ready()
 *
 * Changelog v1.0.0:
 *   - [FIX-D] Versao alinhada para 1.0.0 — release oficial.
 *     A versao anterior (1.0.1) estava dessincronizada com os demais arquivos do ecossistema.
 *   - [FIX] _bridgeHooks — adicionada flag de reentrada __oziRunning
 *     para evitar loop: zldConf.afterRender → OZI.hooks.run() → zldConf.afterRender.
 *     O compat:zld-hooks foi removido do ozi-hooks.js — a ponte e unidirecional.
 */

(function (window, document) {
    'use strict';

    /* ─────────────────────────────────────────────
     * [1] GUARD — idempotência
     * ───────────────────────────────────────────── */

    if (window.OZI) {
        console.warn('[OZI] já inicializado. Ignorando.');
        return;
    }

    /* ─────────────────────────────────────────────
     * [2] AUTO-DETECÇÃO DO urlBase
     * ───────────────────────────────────────────── */

    var _urlBase = (function () {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src || '';
            if (/\/(ozi\.js|ozi-core\.js)(\?|$)/.test(src)) {
                return src.replace(/\/(ozi\.js|ozi-core\.js)(\?.*)?$/, '/');
            }
        }
        return './plugins/ozi-ui/';
    })();

    /* ─────────────────────────────────────────────
     * [3] NAMESPACE GLOBAL — slots vazios
     * ───────────────────────────────────────────── */

    var OZI = {
        version: '1.0.0',

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
     * [4] oziConf() GLOBAL
     * Ponto único de configuração — tema, lang, plugins.
     * Chamadas antes do boot são enfileiradas e aplicadas
     * após OziConf.init() na sequência de boot.
     * ───────────────────────────────────────────── */

    var _pendingConf = null;

    window.oziConf = function (userConfig) {
        if (!userConfig || typeof userConfig !== 'object') return;

        if (!OZI.isReady) {
            _pendingConf = _pendingConf || {};
            _deepMerge(_pendingConf, userConfig);
            return;
        }

        if (window.OziConf && typeof window.OziConf.apply === 'function') {
            window.OziConf.apply(userConfig);
            OZI.conf = window.OziConf.get();
        }
    };

    /* ─────────────────────────────────────────────
     * [5] READY — callbacks pós-boot
     * ───────────────────────────────────────────── */

    OZI.ready = function (callback) {
        if (typeof callback !== 'function') return this;
        if (this.isReady) { callback(this); }
        else              { this._readyCallbacks.push(callback); }
        return this;
    };

    /* ─────────────────────────────────────────────
     * [6] MERGE PROFUNDO
     * ───────────────────────────────────────────── */

    function _deepMerge(target, source) {
        if (!source || typeof source !== 'object') return target;
        Object.keys(source).forEach(function (key) {
            var s = source[key], t = target[key];
            if (s && typeof s === 'object' && !Array.isArray(s) &&
                t && typeof t === 'object' && !Array.isArray(t)) {
                _deepMerge(t, s);
            } else {
                target[key] = s;
            }
        });
        return target;
    }

    /* ─────────────────────────────────────────────
     * [7] LOG INTERNO
     * ───────────────────────────────────────────── */

    function _log(level, msg) {
        var active = OZI.conf && OZI.conf.core && OZI.conf.core.log;
        if (!active && level === 'info') return;
        var args = ['[OZI v' + OZI.version + ']'].concat(
            Array.prototype.slice.call(arguments, 1)
        );
        if (level === 'warn')  console.warn.apply(console, args);
        if (level === 'error') console.error.apply(console, args);
        if (level === 'info')  console.log.apply(console, args);
    }

    OZI._log = _log;

    /* ─────────────────────────────────────────────
     * [8] CARREGAMENTO INLINE DOS SUBSISTEMAS DO CORE
     * ───────────────────────────────────────────── */

    function _loadScript(url, optional) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + url + '"]')) {
                resolve(); return;
            }
            var s    = document.createElement('script');
            s.type   = 'text/javascript';
            s.src    = url;
            s.async  = false;
            s.onload  = function () { resolve(); };
            s.onerror = function () {
                if (optional) { resolve(); }
                else { reject(new Error('[OZI] falha ao carregar subsistema: ' + url)); }
            };
            document.head.appendChild(s);
        });
    }

    function _loadCoreSystems() {
        var base = _urlBase.replace(/\/$/, '') + '/';

        var systems = [
            { url: base + 'core/ozi-conf.js',             optional: false },
            { url: base + 'core/ozi-hooks.js',             optional: true  },
            { url: base + 'core/ozi-lang.js',              optional: true  },
            { url: base + 'core/helpers/ozi-helpers.js',   optional: true  },
            { url: base + 'core/ozi-loader.js',            optional: false },
            { url: base + 'core/ozi-integrations.js',      optional: true  }
        ];

        return systems.reduce(function (chain, item) {
            return chain.then(function () {
                return _loadScript(item.url, item.optional);
            });
        }, Promise.resolve());
    }

    /* ─────────────────────────────────────────────
     * [9] PONTE DE HOOKS
     *
     * Direção: zldConf.zldHooks.afterRender → OZI.hooks.afterRender
     * UNIDIRECIONAL — nunca o contrário.
     *
     * Flag _running previne reentrada:
     *   zldConf.afterRender (relay)
     *     → OZI.hooks.afterRender.run()
     *       → (sem compat:zld-hooks — removido do ozi-hooks.js)
     * ───────────────────────────────────────────── */

    function _bridgeHooks() {
        var zldInternals = window.__zldConf;
        if (!zldInternals ||
            !zldInternals.zldHooks ||
            !Array.isArray(zldInternals.zldHooks.afterRender)) {
            return;
        }

        var already = zldInternals.zldHooks.afterRender.some(function (fn) {
            return fn && fn.__oziBridge === true;
        });
        if (already) return;

        var _running = false;

        var relay = function (root, ctx) {
            if (_running) return;

            if (OZI.hooks &&
                OZI.hooks.afterRender &&
                typeof OZI.hooks.afterRender.run === 'function') {
                _running = true;
                try {
                    OZI.hooks.afterRender.run(root, ctx);
                } finally {
                    _running = false;
                }
            }
        };

        relay.__oziBridge = true;
        zldInternals.zldHooks.afterRender.push(relay);

        _log('info', 'bridge hooks: zldConf.zldHooks -> OZI.hooks (unidirecional, reentrada protegida)');
    }

    /* ─────────────────────────────────────────────
     * [10] COMPAT RETROATIVA — aliases v0.x
     * ───────────────────────────────────────────── */

    function _installAliases() {

        if (!Object.getOwnPropertyDescriptor(window, 'oziCore')) {
            Object.defineProperty(window, 'oziCore', {
                get: function () {
                    _log('warn', 'window.oziCore depreciado → use window.OZI');
                    return OZI;
                },
                configurable: true
            });
        }

        if (!Object.getOwnPropertyDescriptor(window, 'zldConf')) {
            Object.defineProperty(window, 'zldConf', {
                get: function () {
                    _log('warn', 'window.zldConf depreciado → use oziConf({ pluginConf: { loaddata: {} } })');
                    return window.__zldConf ||
                        (OZI.conf && OZI.conf.pluginConf && OZI.conf.pluginConf.loaddata) ||
                        {};
                },
                configurable: true
            });
        }

        if (!Object.getOwnPropertyDescriptor(window, 'oziLoaddata')) {
            Object.defineProperty(window, 'oziLoaddata', {
                get: function () {
                    _log('warn', 'window.oziLoaddata depreciado → use window.oziLoadData');
                    return window.oziLoadData || null;
                },
                configurable: true
            });
        }

        if (!Object.getOwnPropertyDescriptor(window, 'OziFrameworks')) {
            Object.defineProperty(window, 'OziFrameworks', {
                get: function () {
                    _log('warn', 'window.OziFrameworks depreciado → use OZI.integrations');
                    return OZI.integrations || null;
                },
                configurable: true
            });
        }
    }

    /* ─────────────────────────────────────────────
     * [11] BOOTSTRAP PRINCIPAL
     * ───────────────────────────────────────────── */

    function _bootstrap() {
        _log('info', 'iniciando boot...');

        _loadCoreSystems()
            .then(function () {

                if (typeof window.OziConf === 'undefined') {
                    throw new Error('ozi-conf.js não carregou corretamente.');
                }

                if (window.OziConf._setUrlBase) {
                    window.OziConf._setUrlBase(_urlBase);
                }

                var conf = window.OziConf.init();

                if (_pendingConf) {
                    window.OziConf.apply(_pendingConf);
                    conf = window.OziConf.get();
                    _pendingConf = null;
                }

                if (!conf.core || !conf.core.urlBase || conf.core.urlBase === './plugins/ozi-ui/') {
                    if (!conf.core) conf.core = {};
                    conf.core.urlBase = _urlBase;
                }

                OZI.conf = conf;

                if (typeof window.OziHooks !== 'undefined') {
                    OZI.hooks = window.OziHooks;
                    if (typeof OZI.hooks._boot === 'function') OZI.hooks._boot();
                    _log('info', 'hooks: ok');
                } else {
                    _log('warn', 'ozi-hooks.js não carregado.');
                }

                if (typeof window.OziLang !== 'undefined') {
                    OZI.lang = window.OziLang;
                    if (typeof OZI.lang.init === 'function') {
                        OZI.lang.init(conf.lang || 'en', conf.fallbackLang || 'en');
                    }
                    _log('info', 'lang: ok —', OZI.lang.current || conf.lang);
                } else {
                    _log('warn', 'ozi-lang.js não carregado.');
                }

                if (typeof window.OziHelpers !== 'undefined') {
                    OZI.helpers = window.OziHelpers;
                    _log('info', 'helpers: ok');
                }

                if (typeof window.OziIntegrations !== 'undefined') {
                    OZI.integrations = window.OziIntegrations;
                    if (typeof OZI.integrations._boot === 'function') {
                        OZI.integrations._boot(conf.integrations || []);
                    }
                    _log('info', 'integrations: ok');
                }

                if (typeof window.OziLoader !== 'undefined') {
                    OZI.loader = window.OziLoader;
                    _log('info', 'loader: ok');
                } else {
                    throw new Error('ozi-loader.js não carregou corretamente.');
                }

                _installAliases();

                var loadList = window.OziConf.getLoadList();
                _log('info', 'plugins a carregar:', loadList.map(function (p) { return p.name; }).join(', '));

                return OZI.loader.loadPlugins(loadList, conf.core && conf.core.log, _urlBase);
            })
            .then(function () {

                // ponte instalada APÓS plugins carregarem
                // garante que __zldConf do ozi-loaddata já existe
                _bridgeHooks();

                // isReady sobe apenas aqui — depois de todos os plugins prontos
                OZI.isReady = true;

                OZI._readyCallbacks.forEach(function (fn) {
                    try { fn(OZI); } catch (e) { _log('warn', 'erro em OZI.ready() callback:', e); }
                });
                OZI._readyCallbacks = [];

                _log('info', 'OZI v' + OZI.version + ' pronto ✓');
            })
            .catch(function (err) {
                console.error('[OZI] boot falhou:', err.message);
                if (OZI.conf && OZI.conf.core && OZI.conf.core.failFast) throw err;
            });
    }

    /* ─────────────────────────────────────────────
     * [12] AUTO-BOOT
     * ───────────────────────────────────────────── */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bootstrap);
    } else {
        setTimeout(_bootstrap, 0);
    }

})(window, document);