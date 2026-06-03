/**
 * ------------------------------------------
 * ozi-auth
 * ------------------------------------------
 * Ver: 3.0.0
 * 2026-05-27
 *
 *
 * Ficha declarativa do ozi-auth para OZI.integrations.
 *
 * Uso:
 *   <form>
 *     <input data-ozi-auth-user data-ozi-auth-user-caracter="4">
 *     <input data-ozi-auth-mail>
 *     <input data-ozi-auth-pass>
 *     <input data-ozi-auth-confirm>
 *     <button data-ozi-auth-submit
 *             data-ozi-auth-pass-min="12"
 *             data-ozi-auth-pass-max="64"
 *             data-ozi-auth-list-id="regras-senha"
 *             type="submit">Cadastrar</button>
 *   </form>
 *   <ul id="regras-senha"></ul>
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var auth         = window.OZI && window.OZI.components && window.OZI.components.auth;

        if (!integrations || !integrations.registerPlugin) return;
        if (!auth) {
            console.warn('[OZI] ozi-auth.plugin.js: ozi-auth.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'auth',
            selector:     '[data-ozi-auth-submit]',
            keyAttribute: 'data-ozi-auth-submit',
            changeEvent:  'ozi:auth-change',

            getInstance: function (root) {
                return auth.get(root);
            },
            getValue: function (instance) {
                return instance ? instance._lastResult : null;
            },
            setValue: function () {
                // auth não tem setValue — controlado por inputs
            },
            destroy: function (instance) {
                if (instance) instance.destroy();
            },
            reinit: function (root) {
                auth.init(root);
            }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
