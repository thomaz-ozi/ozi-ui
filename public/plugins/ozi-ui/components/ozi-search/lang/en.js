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
            pagination:       'Pagination',
            prev:             'Previous',
            next:             'Next',
            page:             'Page'
        }
    });
})(window);