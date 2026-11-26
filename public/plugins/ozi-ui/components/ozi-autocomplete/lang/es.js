/* ───────────────────────────────────────────── */

/**
 * components/ozi-autocomplete/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        autocomplete: {
            searching:         'Buscando...',
            empty:             'No se encontraron resultados',
            uniqueMessage:     'Este elemento ya fue seleccionado.'
        }
    });
})(window);