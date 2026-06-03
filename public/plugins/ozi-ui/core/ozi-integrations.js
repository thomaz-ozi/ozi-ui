/**
 * ozi-integrations.js
 * Versão: 1.0.1
 * 2026-05-30
 *
 * Responsabilidade:
 *   - Manter registry de plugins e adapters de framework
 *   - Casar automaticamente plugin ↔ adapter quando ambos estiverem presentes
 *   - Expor helpers compartilhados para adapters reutilizarem
 *   - Disparar rescan automático via OZI.hooks.afterRender
 *
 * NÃO faz:
 *   - Não conhece Livewire, Alpine ou qualquer framework diretamente
 *   - Não inicializa plugins (responsabilidade do ozi-hooks)
 *   - Não contém lógica de binding bidirecional (responsabilidade dos adapters)
 *
 * Dependências: ozi-conf.js, ozi-hooks.js
 * Consumido por: ozi-core.js (window.OziIntegrations)
 *
 * Changelog:
 *   - v1.0.1: [FIX-C] Removido Object.defineProperty(window, 'OziFrameworks') deste arquivo.
 *     O ozi.js ja define OziFrameworks com guard (if !getOwnPropertyDescriptor).
 *     A definicao aqui era sem guard — sobrescrevia silenciosamente a do ozi.js
 *     se ozi-integrations carregasse depois. O alias deprecado continua funcionando
 *     via ozi.js.
 */

(function (window, document) {
    'use strict';

    // ─────────────────────────────────────────────
    // [1] REGISTRIES
    // ─────────────────────────────────────────────

    var _pluginRegistry  = {};
    var _adapterRegistry = {};


    // ─────────────────────────────────────────────
    // [2] REGISTRO DE PLUGIN
    // ─────────────────────────────────────────────

    function _registerPlugin(plugin) {
        if (!plugin || !plugin.name) {
            _log('warn', 'registerPlugin: plugin inválido (sem name).');
            return;
        }
        if (_pluginRegistry[plugin.name]) {
            _log('warn', 'registerPlugin: "' + plugin.name + '" já registrado.');
            return;
        }

        _pluginRegistry[plugin.name] = plugin;
        _log('info', 'plugin registrado: "' + plugin.name + '"');

        Object.keys(_adapterRegistry).forEach(function (adapterName) {
            var adapter = _adapterRegistry[adapterName];
            if (adapter && typeof adapter.scan === 'function') {
                _safeCall(function () {
                    adapter.scan(plugin, document);
                }, 'adapter "' + adapterName + '" ao registrar plugin "' + plugin.name + '"');
            }
        });
    }


    // ─────────────────────────────────────────────
    // [3] REGISTRO DE ADAPTER
    // ─────────────────────────────────────────────

    function _registerAdapter(adapter) {
        if (!adapter || !adapter.name) {
            _log('warn', 'registerAdapter: adapter inválido (sem name).');
            return;
        }
        if (_adapterRegistry[adapter.name]) {
            _log('warn', 'registerAdapter: "' + adapter.name + '" já registrado.');
            return;
        }

        _adapterRegistry[adapter.name] = adapter;
        _log('info', 'adapter registrado: "' + adapter.name + '"');

        if (typeof adapter.scan === 'function') {
            Object.keys(_pluginRegistry).forEach(function (pluginName) {
                _safeCall(function () {
                    adapter.scan(_pluginRegistry[pluginName], document);
                }, 'adapter "' + adapter.name + '" ao escanear "' + pluginName + '"');
            });
        }
    }


    // ─────────────────────────────────────────────
    // [4] RESCAN
    // ─────────────────────────────────────────────

    function _rescan(scope) {
        scope = scope || document;

        Object.keys(_adapterRegistry).forEach(function (adapterName) {
            var adapter = _adapterRegistry[adapterName];
            if (!adapter || typeof adapter.scan !== 'function') return;

            Object.keys(_pluginRegistry).forEach(function (pluginName) {
                _safeCall(function () {
                    adapter.scan(_pluginRegistry[pluginName], scope);
                }, 'rescan — adapter "' + adapterName + '" / plugin "' + pluginName + '"');
            });
        });
    }


    // ─────────────────────────────────────────────
    // [5] HELPERS COMPARTILHADOS
    // ─────────────────────────────────────────────

    var _helpers = {

        isBlank: function (value) {
            if (value === null || value === undefined) return true;
            if (typeof value === 'string') return value.trim() === '';
            if (Array.isArray(value)) return value.length === 0;
            if (typeof value === 'object') return Object.keys(value).length === 0;
            return false;
        },

        parseJsonSafe: function (value, fallback) {
            if (fallback === undefined) fallback = null;
            if (value === null || value === undefined) return fallback;
            if (typeof value === 'object') return value;
            try {
                return JSON.parse(value);
            } catch (e) {
                return fallback;
            }
        },

        stableStringify: function (value) {
            if (value === null || value === undefined) return String(value);
            if (typeof value !== 'object') return String(value);
            try {
                return JSON.stringify(value, Object.keys(value).sort());
            } catch (e) {
                return String(value);
            }
        },

        escapeAttrValue: function (str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        ensureSingleScript: function (id, src) {
            if (document.getElementById(id)) return;
            var script  = document.createElement('script');
            script.id   = id;
            script.src  = src;
            script.async = true;
            document.head.appendChild(script);
        },

        parseIntegrationEntry: function (entry) {
            if (!entry || typeof entry !== 'string') return null;
            var parts   = entry.split(':');
            return {
                name:    parts[0].trim(),
                version: parts[1] ? parts[1].trim() : 'auto'
            };
        }
    };


    // ─────────────────────────────────────────────
    // [6] EXECUCAO SEGURA
    // ─────────────────────────────────────────────

    function _safeCall(fn, context) {
        try {
            fn();
        } catch (e) {
            _log('warn', 'erro em ' + (context || 'integrations') + ':', e);
        }
    }


    // ─────────────────────────────────────────────
    // [7] LOG INTERNO
    // ─────────────────────────────────────────────

    function _log(level, msg) {
        var conf   = window.OZI && window.OZI.conf;
        var active = conf && conf.core && conf.core.log;
        if (!active && level === 'info') return;
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift('[OZI:integrations]');
        if (level === 'warn')  console.warn.apply(console, args);
        if (level === 'error') console.error.apply(console, args);
        if (level === 'info')  console.log.apply(console, args);
    }


    // ─────────────────────────────────────────────
    // [8] API — window.OziIntegrations
    // ─────────────────────────────────────────────

    window.OziIntegrations = {

        _boot: function (integrationsList) {
            if (window.OZI && window.OZI.hooks) {
                window.OZI.hooks.afterRender.register(
                    'integration:rescan',
                    function (root) {
                        _rescan(root);
                    }
                );
            }

            if (Array.isArray(integrationsList) && integrationsList.length) {
                integrationsList.forEach(function (entry) {
                    var parsed = _helpers.parseIntegrationEntry(entry);
                    if (parsed) {
                        _log('info', 'integração declarada: "' + parsed.name + '" v' + parsed.version);
                    }
                });
            }

            _log('info', 'integrations prontos.');
        },

        registerPlugin:  _registerPlugin,
        registerAdapter: _registerAdapter,
        rescan:          _rescan,

        getPlugin:   function (name) { return _pluginRegistry[name]  || null; },
        getAdapter:  function (name) { return _adapterRegistry[name] || null; },
        getPlugins:  function () { return Object.keys(_pluginRegistry).slice(); },
        getAdapters: function () { return Object.keys(_adapterRegistry).slice(); },

        helpers: _helpers
    };

    // [FIX-C] Object.defineProperty(window, 'OziFrameworks') REMOVIDO deste arquivo.
    // O alias deprecado window.OziFrameworks e definido pelo ozi.js com guard
    // (if !Object.getOwnPropertyDescriptor). A definicao aqui era sem guard e
    // sobrescrevia silenciosamente a do ozi.js quando ozi-integrations carregava
    // depois (via loadPlugins). O alias continua funcionando via ozi.js.

})(window, document);