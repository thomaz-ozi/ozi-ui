/**
 * modules/ozi-loaddata/lang/es.js
 */

(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;

    lang.register('es', {
        loadData: {
            error:           'Error al cargar.',
            processError:    'Error al procesar.',
            invalidJson:     'Respuesta JSON inválida.',
            invalidJsonHint: 'Verifique lo que devuelve la ruta.',
            network:         'No se pudo cargar.',
            networkHint:     'Verifique su conexión.',
            status:          'Estado {status}'
        }
    });
})(window);