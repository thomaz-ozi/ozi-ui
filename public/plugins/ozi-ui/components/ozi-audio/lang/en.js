/* ───────────────────────────────────────────── */

/**
 * components/ozi-audio/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        audio: {
            ready:          'Ready',
            recording:      'Recording...',
            processing:     'Processing...',
            micUnavailable: 'Microphone unavailable',
            player:         'Audio player',
            recorder:       'Audio recorder'
        }
    });
})(window);
