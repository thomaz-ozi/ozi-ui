/* ───────────────────────────────────────────── */

/**
 * components/ozi-select/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        select: {
            searchPlaceholder: 'Buscar...',
            valuePlaceholder:  'Seleccione...',
            empty:             'No se encontraron opciones',
            requiredMessage:   'Seleccione una opción.'
        }
    });
})(window);