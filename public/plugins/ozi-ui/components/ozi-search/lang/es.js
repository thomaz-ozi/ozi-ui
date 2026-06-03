/* ───────────────────────────────────────────── */

/**
 * components/ozi-search/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        search: {
            minCharsMessage:  'Escriba al menos {min} caracteres',
            noResultsMessage: 'No se encontraron resultados'
        }
    });
})(window);