/**

 * ------------------------------------------
 * ozi-toggle
 * ------------------------------------------
 * Ver: 3.0.0
 * 2026-05-27
 *
 * Ficha declarativa do ozi-toggle para OZI.integrations.
 *
 * Uso:
 *   <button data-ozi-toggle-trigger="filtros">
 *     <span data-ozi-toggle-show>Mostrar filtros</span>
 *     <span data-ozi-toggle-hide>Ocultar filtros</span>
 *   </button>
 *   <div data-ozi-toggle-content="filtros" style="display:none">
 *     Conteúdo
 *   </div>
 *
 * Com slide:
 *   <button data-ozi-toggle-trigger="menu"
 *           data-ozi-toggle-options="slide-time:400;">
 *     Menu
 *   </button>
 *   <nav data-ozi-toggle-content="menu" style="display:none">...</nav>
 *
 * API programática:
 *   OZI.behaviors.toggle.open('filtros');
 *   OZI.behaviors.toggle.close('filtros');
 *   OZI.behaviors.toggle.toggle('filtros');
 *
 * Eventos:
 *   ozi:toggle-open    → { id }
 *   ozi:toggle-close   → { id }
 *   ozi:toggle-change  → { id, open }
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var toggle       = (window.OZI && window.OZI.behaviors && window.OZI.behaviors.toggle)
                        || window.OziToggle;

        if (!integrations || !integrations.registerPlugin) return;
        if (!toggle) {
            console.warn('[OZI] ozi-toggle.plugin.js: ozi-toggle.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'toggle',
            selector:     '[data-ozi-toggle-trigger]',
            keyAttribute: 'data-ozi-toggle-trigger',
            changeEvent:  'ozi:toggle-change',

            getInstance: function () {
                return toggle; // singleton
            },
            getValue: function (instance, root) {
                if (!root) return false;
                var id = root.getAttribute
                    ? root.getAttribute('data-ozi-toggle-trigger')
                    : '';
                if (!id) return false;
                var content = document.querySelector('[data-ozi-toggle-content="' + id + '"]');
                return content
                    ? window.getComputedStyle(content).display !== 'none'
                    : false;
            },
            setValue: function (root, value) {
                var id = root && root.getAttribute
                    ? root.getAttribute('data-ozi-toggle-trigger')
                    : '';
                if (!id) return;
                value ? toggle.open(id) : toggle.close(id);
            },
            destroy: function () {
                // behavior — sem destroy
            },
            reinit: function () {
                toggle.syncAll();
            }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
