/**
 *
 * ------------------------------------------
 * ozi-integrations-core
 * ------------------------------------------
 * Ver: 1.0.0
 * 2026-05-27
 *
 *
 * Responsabilidade:
 *   - Ponto de entrada público das integrations
 *   - Alias retroativo de window.OziFrameworks → OZI.integrations
 *   - Re-exporta API de OZI.integrations para compat com v0.x
 *
 * Na v1.0.0 a lógica real está em:
 *   core/ozi-integrations.js → OZI.integrations
 *
 * Este arquivo garante que código que usava:
 *   window.OziFrameworks.registerPlugin(...)
 *   window.OziFrameworks.registerAdapter(...)
 *   window.OziFrameworks.rescan()
 * Continue funcionando com warn de deprecação.
 *
 * Dependências: ozi-core.js (OZI.integrations já populado)
 * Baseado em: ozi-frameworks-core.js (código real v0.x)
 */

(function (window) {
    'use strict';

    // ─────────────────────────────────────────────
    // [1] GUARD
    // ─────────────────────────────────────────────

    if (window.__oziIntegrationsCoreInited) return;
    window.__oziIntegrationsCoreInited = true;


    // ─────────────────────────────────────────────
    // [2] PROXY PARA OZI.integrations
    // Aguarda OZI.ready para garantir que integrations
    // já foi populado pelo ozi-core.js
    // ─────────────────────────────────────────────

    function _boot() {
        var integrations = window.OZI && window.OZI.integrations;

        if (!integrations) {
            console.warn('[OZI] ozi-integrations-core.js: OZI.integrations não encontrado. Verifique a ordem de carregamento.');
            return;
        }

        // ─────────────────────────────────────────
        // [3] COMPAT RETROATIVA — window.OziFrameworks
        // Era o nome público na v0.x.
        // Agora é proxy para OZI.integrations com warn.
        // ─────────────────────────────────────────

        if (!window.OziFrameworks) {
            window.OziFrameworks = {

                registerPlugin: function (plugin) {
                    _warn('OziFrameworks.registerPlugin', 'OZI.integrations.registerPlugin');
                    integrations.registerPlugin(plugin);
                },

                registerAdapter: function (adapter) {
                    _warn('OziFrameworks.registerAdapter', 'OZI.integrations.registerAdapter');
                    integrations.registerAdapter(adapter);
                },

                rescan: function (scope) {
                    _warn('OziFrameworks.rescan', 'OZI.integrations.rescan');
                    integrations.rescan(scope);
                },

                getPlugin: function (name) {
                    return integrations.getPlugin(name);
                },

                getAdapter: function (name) {
                    return integrations.getAdapter(name);
                },

                getPlugins: function () {
                    return integrations.getPlugins();
                },

                getAdapters: function () {
                    return integrations.getAdapters();
                },

                // helpers compartilhados (compat)
                helpers: integrations.helpers || {}
            };
        }
    }

    function _warn(oldApi, newApi) {
        var conf = window.OZI && window.OZI.conf;
        if (conf && conf.core && conf.core.log) {
            console.warn('[OZI] ' + oldApi + ' está depreciado. Use ' + newApi + '.');
        }
    }


    // ─────────────────────────────────────────────
    // [4] BOOT
    // ─────────────────────────────────────────────

    if (window.OZI && window.OZI.isReady) {
        _boot();
    } else if (window.OZI && window.OZI.ready) {
        window.OZI.ready(_boot);
    } else {
        document.addEventListener('DOMContentLoaded', _boot);
    }

})(window);
