
/**
 * modules/ozi-loaddata/lang/en.js
 */

(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;

    lang.register('en', {
        loadData: {
            error:           'Error loading.',
            processError:    'Error processing the request.',
            invalidJson:     'Invalid JSON response.',
            invalidJsonHint: 'Check what the route returns.',
            network:         'Could not load.',
            networkHint:     'Check your connection.',
            status:          'Status {status}'
        }
    });
})(window);
