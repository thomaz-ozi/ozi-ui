
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
            requiredMessage:   'Please select an option.',
            creatableLabel:    'Add "{query}"',
            selectedCount:     '{count} selected',
            selectAll:         'Select all',
            allCount:          'All',
            allSelected:       'All selected',
            clearSelection: 'Clear selection',
            openOptions:    'Open options',
            removeItem:     'Remove {label}'
        }
    });
})(window);