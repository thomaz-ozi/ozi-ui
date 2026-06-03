/* ───────────────────────────────────────────── */

/**
 * components/ozi-audio/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        audio: {
            ready:          'Listo',
            recording:      'Grabando...',
            processing:     'Procesando...',
            micUnavailable: 'Micrófono no disponible',
            player:         'Reproductor de audio',
            recorder:       'Grabador de audio'
        }
    });
})(window);