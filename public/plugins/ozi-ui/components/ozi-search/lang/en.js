/* ───────────────────────────────────────────── */

/**
 * components/ozi-search/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        search: {
            minCharsMessage:  'Type at least {min} characters',
            noResultsMessage: 'No results found'
        }
    });
})(window);