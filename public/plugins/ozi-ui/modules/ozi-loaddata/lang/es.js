/**
 * modules/ozi-loaddata/lang/es.js
 */

(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;

    lang.register('es', {
        loadData: {
            sending: 'Enviando...',
            error:   'Error al cargar',
            success: 'Completado'
        }
    });
})(window);