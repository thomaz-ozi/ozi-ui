
/* ───────────────────────────────────────────── */

/**
 * components/ozi-autocomplete/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        autocomplete: {
            searchPlaceholder: 'Search...',
            empty:             'No results found',
            uniqueMessage:     'This item is already selected.'
        }
    });
})(window);