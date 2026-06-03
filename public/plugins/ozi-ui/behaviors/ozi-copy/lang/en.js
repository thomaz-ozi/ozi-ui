/* ───────────────────────────────────────────── */

/**
 * behaviors/ozi-copy/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        copy: {
            success: 'Copied!',
            error:   'Failed to copy'
        }
    });
})(window);