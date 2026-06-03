/* ───────────────────────────────────────────── */

/**
 * components/ozi-audio/lang/pt-BR.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('pt-BR', {
        audio: {
            ready:          'Pronto',
            recording:      'Gravando...',
            processing:     'Processando...',
            micUnavailable: 'Microfone indisponível',
            player:         'Player de áudio',
            recorder:       'Gravador de áudio'
        }
    });
})(window);