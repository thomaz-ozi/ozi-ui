
/**
 * modules/ozi-loaddata/lang/en.js
 */

(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;

    lang.register('en', {
        loadData: {
            sending: 'Sending...',
            error:   'Error loading',
            success: 'Done'
        }
    });
})(window);
