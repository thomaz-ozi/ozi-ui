/* ───────────────────────────────────────────── */

/**
 * components/ozi-editor/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        editor: {
            bold:        'Negrita',
            italic:      'Cursiva',
            underline:   'Subrayado',
            ul:          'Lista',
            ol:          'Lista numerada',
            codeblock:   'Bloque de código',
            source:      'HTML',
            table:       'Tabla',
            alignLeft:   'Alinear a la izquierda',
            alignCenter: 'Centrar',
            alignRight:  'Alinear a la derecha',
            clearFormat: 'Limpiar formato',
            placeholder: 'Escriba aquí...'
        }
    });
})(window);