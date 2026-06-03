/**
 * behaviors/ozi-copy/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        copy: {
            success: '¡Copiado!',
            error:   'Error al copiar'
        }
    });
})(window);