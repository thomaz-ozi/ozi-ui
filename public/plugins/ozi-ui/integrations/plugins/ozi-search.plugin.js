/**

 * ------------------------------------------
 * ozi-search
 * ------------------------------------------
 * Ver: 3.0.1
 * 2026-05-27
 *
 *
 * Ficha declarativa do ozi-search para OZI.integrations.
 *
 * Uso:
 *   <input type="text"
 *          data-ozi-search=".meu-item"
 *          data-ozi-search-highlight="true"
 *          data-ozi-search-min="1"
 *          data-ozi-search-pagination="10"
 *          data-ozi-search-pagination-id="nav-paginas"
 *          placeholder="Buscar...">
 *
 *   <div class="meu-item">Item A</div>
 *   <div id="nav-paginas"></div>
 *
 *   // API programática:
 *   OZI.components.search.trigger('#meu-input', 'termo');
 *   OZI.components.search.reset('#meu-input');
 *   OZI.components.search.goToPage('#meu-input', 2);
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var search       = (window.OZI && window.OZI.components && window.OZI.components.search)
                        || window.OziSearch;

        if (!integrations || !integrations.registerPlugin) return;
        if (!search) {
            console.warn('[OZI] ozi-search.plugin.js: ozi-search.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'search',
            selector:     '[data-ozi-search]',
            keyAttribute: 'id',
            changeEvent:  'ozi:search-filtered',

            getInstance: function (root) {
                return root; // funcional — o elemento é a instância
            },
            getValue: function (root) {
                return root ? root.value : '';
            },
            setValue: function (root, value) {
                search.trigger(root, value);
            },
            setOptions: function (el, items) {
                if (typeof search.setItems === 'function') {
                    search.setItems(el, items);
                }
            },
            destroy: function () {
                // behavior funcional — sem destroy
            },
            reinit: function (root) {
                search.init(root);
            }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
