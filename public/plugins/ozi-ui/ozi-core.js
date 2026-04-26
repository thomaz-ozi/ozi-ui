(function (window, document) {
    'use strict';

    if (window.oziCore) return;

    var loadedScripts = {};
    var loadingScripts = {};

    /**
     * ------------------------------------------
     * oziCore
     * ------------------------------------------
     * Ver: (1.3.0)
     * 2026-04-26
     * ------------------------------------------
     * @description
     * Orquestrador do ecossistema ozi-ui.
     * Carrega os scripts dos plugins em sequência,
     * garante dependências e registra hooks automáticos.
     *
     * Suporte:
     * - oziLoadData (zldConf.zldHooks.afterRender)
     * - Livewire 3 (Livewire.hook → commit)
     * - Livewire 4 (Livewire.hook → morph.updated)
     *
     * @example
     * oziCore({
     *     urlBase: '/plugins/ozi-ui/',
     *     urlScript: [
     *         'ozi-loaddata/js/ozi-loaddata.js',
     *         'ozi-select/js/ozi-select.js',
     *         'ozi-editor/js/ozi-editor.js'
     *     ],
     *     log: true
     * });
     */

    // ------------------------------------------
    // [1] HELPERS DE URL
    // ------------------------------------------

    function normalizeBase(urlBase) {
        var base = String(urlBase || '').trim();

        if (!base) {
            var current = document.currentScript;

            if (current && current.src) {
                base = current.src.substring(0, current.src.lastIndexOf('/') + 1);
            } else {
                base = '/plugins/ozi-ui/';
            }
        }

        if (!base.endsWith('/')) {
            base += '/';
        }

        return base;
    }

    function resolveUrl(base, path) {
        path = String(path || '').trim();
        if (!path) return '';

        if (/^https?:\/\//i.test(path) || path.startsWith('/')) {
            return path;
        }

        return base + path;
    }

    // ------------------------------------------
    // [2] CARREGAMENTO DE SCRIPTS
    // ------------------------------------------

    function loadScript(src) {
        if (!src) {
            return Promise.reject(new Error('oziCore: src inválido.'));
        }

        if (loadedScripts[src]) {
            return Promise.resolve(src);
        }

        if (loadingScripts[src]) {
            return loadingScripts[src];
        }

        loadingScripts[src] = new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-ozi-core-src="' + src + '"]');

            if (existing) {
                if (existing.dataset.loaded === 'true') {
                    loadedScripts[src] = true;
                    resolve(src);
                    return;
                }

                existing.addEventListener('load', function () {
                    loadedScripts[src] = true;
                    resolve(src);
                });

                existing.addEventListener('error', function () {
                    reject(new Error('oziCore: erro ao carregar ' + src));
                });

                return;
            }

            var script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.dataset.oziCoreSrc = src;

            script.onload = function () {
                script.dataset.loaded = 'true';
                loadedScripts[src] = true;
                delete loadingScripts[src];
                resolve(src);
            };

            script.onerror = function () {
                delete loadingScripts[src];
                reject(new Error('oziCore: erro ao carregar ' + src));
            };

            document.head.appendChild(script);
        });

        return loadingScripts[src];
    }

    function loadMany(urlBase, urlScript) {
        var base = normalizeBase(urlBase);
        var list = Array.isArray(urlScript) ? urlScript : [];

        var queue = Promise.resolve();

        list.forEach(function (item) {
            var src = resolveUrl(base, item);

            queue = queue.then(function () {
                return loadScript(src);
            });
        });

        return queue;
    }

    // ------------------------------------------
    // [3] PLUGINS — candidatos ao afterRender
    // ------------------------------------------

    var hookCandidates = [
        {
            key: 'OziAudio',
            fn: function (root) {
                if (window.OziAudio && typeof window.OziAudio.init === 'function') {
                    window.OziAudio.init(root);
                }
            }
        },
        {
            key: 'OziAutocomplete',
            fn: function (root) {
                if (window.OziAutocomplete && typeof window.OziAutocomplete.init === 'function') {
                    window.OziAutocomplete.init(root);
                }
            }
        },
        {
            key: 'OziEditor',
            fn: function (root) {
                if (window.OziEditor && typeof window.OziEditor.init === 'function') {
                    window.OziEditor.init(root);
                }
            }
        },
        {
            key: 'OziSelect',
            fn: function (root) {
                if (window.OziSelect && typeof window.OziSelect.init === 'function') {
                    window.OziSelect.init(root);
                }
            }
        }
    ];

    function runCandidates(root) {
        hookCandidates.forEach(function (item) {
            if (window[item.key]) {
                item.fn(root);
            }
        });
    }

    // ------------------------------------------
    // [4] HOOK — oziLoadData (zldConf)
    // ------------------------------------------

    function registerZldHooks(log) {
        if (
            !window.zldConf ||
            !window.zldConf.zldHooks ||
            !Array.isArray(window.zldConf.zldHooks.afterRender)
        ) {
            if (log) console.warn('oziCore: zldConf.zldHooks.afterRender não disponível.');
            return false;
        }

        hookCandidates.forEach(function (item) {
            if (!window[item.key]) return;

            var alreadyBound = window.zldConf.zldHooks.afterRender.some(function (fn) {
                return fn && fn.__oziCoreHook === item.key;
            });

            if (alreadyBound) return;

            var hook = function (root) { item.fn(root); };
            hook.__oziCoreHook = item.key;
            window.zldConf.zldHooks.afterRender.push(hook);

            if (log) console.log('oziCore: zldHook registrado →', item.key);
        });

        return true;
    }

    // ------------------------------------------
    // [5] HOOK — Livewire 4 (morph.updated)
    // ------------------------------------------

    function registerLivewire4Hooks(log) {
        if (
            !window.Livewire ||
            typeof window.Livewire.hook !== 'function'
        ) return false;

        // Detecta Livewire 4 pelo hook morph.updated
        try {
            if (window.__oziCoreLw4Registered) return true;
            window.__oziCoreLw4Registered = true;

            window.Livewire.hook('morph.updated', function (el) {
                var root = el && el.el ? el.el : el;
                if (log) console.log('oziCore: Livewire 4 morph.updated →', root);
                runCandidates(root);
            });

            if (log) console.log('oziCore: Livewire 4 hook registrado (morph.updated).');
            return true;
        } catch (e) {
            if (log) console.warn('oziCore: Livewire 4 hook falhou.', e);
            return false;
        }
    }

    // ------------------------------------------
    // [6] HOOK — Livewire 3 (commit)
    // ------------------------------------------

    function registerLivewire3Hooks(log) {
        if (
            !window.Livewire ||
            typeof window.Livewire.hook !== 'function'
        ) return false;

        try {
            if (window.__oziCoreLw3Registered) return true;
            window.__oziCoreLw3Registered = true;

            window.Livewire.hook('commit', function (payload) {
                var succeed = payload && typeof payload.succeed === 'function'
                    ? payload.succeed
                    : null;

                if (!succeed) return;

                succeed(function () {
                    var el = payload.component && payload.component.el
                        ? payload.component.el
                        : document.body;

                    if (log) console.log('oziCore: Livewire 3 commit →', el);
                    runCandidates(el);
                });
            });

            if (log) console.log('oziCore: Livewire 3 hook registrado (commit).');
            return true;
        } catch (e) {
            if (log) console.warn('oziCore: Livewire 3 hook falhou.', e);
            return false;
        }
    }

    // ------------------------------------------
    // [7] REGISTRO AUTOMÁTICO DE HOOKS
    // ------------------------------------------

    function registerAfterRenderHooks(log) {
        // 1. oziLoadData (sempre — funciona em qualquer stack)
        registerZldHooks(log);

        if (!window.Livewire) {
            if (log) console.log('oziCore: Livewire não detectado — apenas zldHooks ativos.');
            return;
        }

        // 2. Detecta versão do Livewire
        var lw = window.Livewire;
        var version = (lw.version || lw.VERSION || '').toString();
        var major = parseInt(version.split('.')[0], 10) || 0;

        if (log) console.log('oziCore: Livewire detectado → v' + (version || '?'));

        if (major >= 4) {
            // Livewire 4 — morph.updated
            var lw4ok = registerLivewire4Hooks(log);

            if (!lw4ok) {
                // fallback para Livewire 3 caso morph.updated falhe
                registerLivewire3Hooks(log);
            }
        } else {
            // Livewire 3 — commit
            registerLivewire3Hooks(log);
        }
    }

    // ------------------------------------------
    // [8] CONFIG
    // ------------------------------------------

    function parseConfig(config) {
        if (typeof config === 'string') {
            return {
                urlBase: config,
                urlScript: [
                    'ozi-loaddata/js/ozi-loaddata.js',  // ← primeiro sempre
                    'ozi-select/js/ozi-select.js',
                    'ozi-audio/js/ozi-audio.js',
                    'ozi-autocomplete/js/ozi-autocomplete.js',
                    'ozi-editor/js/ozi-editor.js',
                    'ozi-search/js/ozi-search.js',
                    'ozi-addons/js/ozi-addons.js',
                    'ozi-addons/js/ozi-auth.js',
                    'ozi-addons/js/ozi-check.js',
                    'ozi-addons/js/ozi-copy.js',
                    'ozi-addons/js/ozi-toggle.js',
                ],
                log: false
            };
        }

        config = config || {};

        return {
            urlBase: config.urlBase || '',
            urlScript: config.urlScript || [],
            log: config.log === true
        };
    }

    // ------------------------------------------
    // [9] FUNÇÃO PRINCIPAL
    // ------------------------------------------

    function oziCore(config) {
        var finalConfig = parseConfig(config);

        if (finalConfig.log) {
            console.log('oziCore: iniciando carregamento...', finalConfig);
        }

        return loadMany(finalConfig.urlBase, finalConfig.urlScript)
            .then(function () {
                registerAfterRenderHooks(finalConfig.log);

                if (finalConfig.log) {
                    console.log('oziCore: scripts carregados com sucesso.');
                }

                return {
                    ok: true,
                    urlBase: normalizeBase(finalConfig.urlBase),
                    urlScript: finalConfig.urlScript
                };
            })
            .catch(function (error) {
                console.error('oziCore: erro ao carregar scripts.', error);
                return {
                    ok: false,
                    error: error
                };
            });
    }

    // ------------------------------------------
    // [10] EXPORTS PÚBLICOS
    // ------------------------------------------

    oziCore.loadScript  = loadScript;
    oziCore.loadMany    = loadMany;
    oziCore.version     = '1.3.0';

    window.oziCore = oziCore;

})(window, document);