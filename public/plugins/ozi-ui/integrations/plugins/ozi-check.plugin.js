/**
 * ------------------------------------------
 * ozi-check
 * ------------------------------------------
 * Ver: 2.0.0
 * 2026-05-27
 *
 *
 * Ficha declarativa do ozi-check para OZI.integrations.
 *
 * Uso:
 *   <input type="checkbox" data-ozi-check-enabled="grupo"> Habilitar
 *   <input type="checkbox" data-ozi-check-all="grupo"> Todos
 *   <input type="checkbox" data-ozi-check-item="grupo" value="1"> Item 1
 *   <input type="checkbox" data-ozi-check-item="grupo" value="2"> Item 2
 *
 *   // escutar mudança:
 *   document.addEventListener('ozi:check-change', function(e) {
 *       console.log(e.detail.group, e.detail.checked);
 *   });
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var check        = window.OZI && window.OZI.components && window.OZI.components.check;

        if (!integrations || !integrations.registerPlugin) return;
        if (!check) {
            console.warn('[OZI] ozi-check.plugin.js: ozi-check.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'check',
            selector:     '[data-ozi-check-item]',
            keyAttribute: 'data-ozi-check-item',
            changeEvent:  'ozi:check-change',

            getInstance: function () {
                return check; // singleton — sem instância por elemento
            },
            getValue: function (instance, root) {
                if (!root) return [];
                var group = root.getAttribute
                    ? root.getAttribute('data-ozi-check-item')
                    : '';
                if (!group) return [];
                var els = check.getGroupElements(group);
                return els.$items.filter(':checked').map(function () {
                    return this.value;
                }).get();
            },
            setValue: function (root, value) {
                var group = root && root.getAttribute
                    ? root.getAttribute('data-ozi-check-item')
                    : '';
                if (group) check.setAllItems(group, !!value);
            },
            destroy: function () {
                // singleton — sem destroy individual
            },
            reinit: function () {
                check.refresh();
            }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
