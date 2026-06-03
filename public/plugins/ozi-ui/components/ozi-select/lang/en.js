
/* ───────────────────────────────────────────── */

/**
 * components/ozi-select/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        select: {
            searchPlaceholder: 'Search...',
            valuePlaceholder:  'Select...',
            empty:             'No options found',
            requiredMessage:   'Please select an option.'
        }
    });
})(window);