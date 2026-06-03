/**
 * ozi-loader.js
 * Versão: 1.0.1
 *
 * 2026-05-30
 *
 * Responsabilidade:
 *   - Carrega arquivos JS em sequência (ordem importa — deps primeiro)
 *   - Injeta CSS via <link> no <head> (não bloqueia sequência JS)
 *   - Carrega lang (.js) como script normal
 *   - Evita carregar o mesmo arquivo duas vezes
 *   - Auto-detecta urlBase pelo path do ozi.js no DOM
 *   - Carrega shared/css/ozi-reset.css e shared/css/ozi-utilities.css
 *     automaticamente antes de qualquer plugin
 *
 * Changelog:
 *   - v1.0.1: [FIX] Adicionado carregamento automático de ozi-reset.css e
 *     ozi-utilities.css no início de loadPlugins(). Esses arquivos definem
 *     classes compartilhadas por todos os plugins (.ozi-disabled, .ozi-loading,
 *     .ozi-feedback, .ozi-hidden, etc.) e precisam estar disponíveis antes
 *     de qualquer componente inicializar.
 *
 * Expõe: window.OziLoader
 *
 * Não depende de jQuery — usa fetch/createElement nativos.
 */

(function (window, document) {
    'use strict';

    /* ─────────────────────────────────────────────
     * [1] CONTROLE DE ARQUIVOS JÁ CARREGADOS
     * ───────────────────────────────────────────── */

    var _loaded = {};

    function _isLoaded(url) {
        return !!_loaded[url];
    }

    function _markLoaded(url) {
        _loaded[url] = true;
    }

    /* ─────────────────────────────────────────────
     * [2] AUTO-DETECÇÃO DO urlBase
     * ───────────────────────────────────────────── */

    function _detectUrlBase() {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src || '';
            if (/\/(ozi\.js|ozi-core\.js)(\?|$)/.test(src)) {
                return src.replace(/\/(ozi\.js|ozi-core\.js)(\?.*)?$/, '/');
            }
        }
        return './plugins/ozi-ui/';
    }

    /* ─────────────────────────────────────────────
     * [3] CARREGAMENTO DE CSS
     * ───────────────────────────────────────────── */

    function _loadCSS(url) {
        return new Promise(function (resolve) {
            if (!url || _isLoaded(url)) { resolve(); return; }

            var existing = document.querySelector('link[href="' + url + '"]');
            if (existing) { _markLoaded(url); resolve(); return; }

            var link    = document.createElement('link');
            link.rel    = 'stylesheet';
            link.type   = 'text/css';
            link.href   = url;

            link.onload = link.onerror = function () {
                _markLoaded(url);
                resolve();
            };

            document.head.appendChild(link);
        });
    }

    /* ─────────────────────────────────────────────
     * [4] CARREGAMENTO DE JS
     * ───────────────────────────────────────────── */

    function _loadJS(url, optional) {
        return new Promise(function (resolve, reject) {
            if (!url || _isLoaded(url)) { resolve(); return; }

            var existing = document.querySelector('script[src="' + url + '"]');
            if (existing) { _markLoaded(url); resolve(); return; }

            var script  = document.createElement('script');
            script.type = 'text/javascript';
            script.src  = url;
            script.async = false;

            script.onload = function () {
                _markLoaded(url);
                resolve();
            };

            script.onerror = function () {
                _markLoaded(url);
                if (optional) {
                    resolve();
                } else {
                    reject(new Error('[OZI:loader] falha ao carregar: ' + url));
                }
            };

            document.head.appendChild(script);
        });
    }

    /* ─────────────────────────────────────────────
     * [5] CARREGAMENTO DE UM PLUGIN COMPLETO
     * ───────────────────────────────────────────── */

    function _loadPlugin(pluginDef, log) {
        var name = pluginDef.name;

        return Promise.resolve()
            .then(function () {
                // CSS em paralelo — não precisa esperar
                if (pluginDef.css) {
                    _loadCSS(pluginDef.css); // intencional: sem await
                }
                return Promise.resolve();
            })
            .then(function () {
                // lang — opcional
                if (pluginDef.lang) {
                    return _loadJS(pluginDef.lang, true);
                }
                return Promise.resolve();
            })
            .then(function () {
                // JS principal — obrigatório
                if (pluginDef.js) {
                    return _loadJS(pluginDef.js, false);
                }
                return Promise.resolve();
            })
            .then(function () {
                if (log) console.log('[OZI:loader] plugin carregado: ' + name);
            })
            .catch(function (err) {
                console.error('[OZI:loader] erro ao carregar plugin "' + name + '":', err.message);
            });
    }

    /* ─────────────────────────────────────────────
     * [6] CARREGAMENTO DOS SUBSISTEMAS DO CORE
     * ───────────────────────────────────────────── */

    function _loadCoreSystems(urlBase, log) {
        var base = String(urlBase || '').replace(/\/$/, '') + '/';

        var systems = [
            base + 'core/ozi-conf.js',
            base + 'core/ozi-hooks.js',
            base + 'core/ozi-en.js',
            base + 'core/helpers/ozi-helpers.js',
            base + 'core/ozi-integrations.js'
        ];

        return systems.reduce(function (chain, url) {
            return chain.then(function () {
                return _loadJS(url, true);
            });
        }, Promise.resolve());
    }

    /* ─────────────────────────────────────────────
     * [7] CARREGAMENTO DOS CSS COMPARTILHADOS
     *
     * ozi-reset.css e ozi-utilities.css devem ser
     * carregados ANTES de qualquer plugin, pois definem
     * classes usadas por todos:
     *   .ozi-disabled, .ozi-loading, .ozi-hidden,
     *   .ozi-feedback, .ozi-invalid, .ozi-valid, etc.
     *
     * Carregados em paralelo — não bloqueiam JS.
     * ───────────────────────────────────────────── */

    function _loadSharedCSS(urlBase, log) {
        var base = String(urlBase || '').replace(/\/$/, '') + '/';

        var files = [
            base + 'shared/css/ozi-reset.css',
            base + 'shared/css/ozi-utilities.css'
        ];

        // paralelo — ambos injetados juntos, sem esperar um pelo outro
        files.forEach(function (url) {
            _loadCSS(url);
            if (log) console.log('[OZI:loader] shared CSS: ' + url);
        });
    }

    /* ─────────────────────────────────────────────
     * [8] CARREGAMENTO DA LISTA DE PLUGINS
     *
     * Carrega shared CSS primeiro (paralelo),
     * depois plugins em sequência estrita.
     * ───────────────────────────────────────────── */

    function _loadPlugins(loadList, log, urlBase) {
        if (!Array.isArray(loadList) || !loadList.length) {
            if (log) console.log('[OZI:loader] nenhum plugin para carregar.');
            return Promise.resolve();
        }

        // [FIX v1.0.1] carrega shared CSS antes dos plugins
        _loadSharedCSS(urlBase, log);

        // sequência estrita — cada plugin após o anterior
        return loadList.reduce(function (chain, pluginDef) {
            return chain.then(function () {
                return _loadPlugin(pluginDef, log);
            });
        }, Promise.resolve());
    }

    /* ─────────────────────────────────────────────
     * [9] API PÚBLICA — OziLoader
     * ───────────────────────────────────────────── */

    var OziLoader = {

        detectUrlBase: _detectUrlBase,

        /**
         * Carrega os subsistemas internos do core.
         */
        loadCore: function (urlBase, log) {
            if (log) console.log('[OZI:loader] carregando subsistemas core...');
            return _loadCoreSystems(urlBase, log);
        },

        /**
         * Carrega shared CSS + todos os plugins declarados no oziConf.
         * Recebe a lista já resolvida de OziConf.getLoadList().
         *
         * @param {Array}   loadList  resultado de OziConf.getLoadList()
         * @param {boolean} log
         * @param {string}  urlBase   base URL para localizar shared/css/
         * @returns Promise
         */
        loadPlugins: function (loadList, log, urlBase) {
            if (log) console.log('[OZI:loader] carregando plugins:', loadList.map(function (p) { return p.name; }).join(', '));
            return _loadPlugins(loadList, log, urlBase);
        },

        /**
         * Carrega um único arquivo JS.
         */
        loadJS: _loadJS,

        /**
         * Injeta um CSS no <head>.
         */
        loadCSS: _loadCSS,

        /**
         * Carrega explicitamente os CSS compartilhados.
         * Útil se o dev quiser forçar o carregamento manualmente.
         */
        loadSharedCSS: function (urlBase, log) {
            _loadSharedCSS(urlBase, log);
        },

        /**
         * Retorna lista de URLs já carregados.
         */
        getLoaded: function () {
            return Object.keys(_loaded);
        }
    };

    window.OziLoader = OziLoader;

})(window, document);