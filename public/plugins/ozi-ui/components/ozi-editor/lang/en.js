/* ───────────────────────────────────────────── */

/**
 * components/ozi-editor/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        editor: {
            bold:        'Bold',
            italic:      'Italic',
            underline:   'Underline',
            ul:          'Bullet list',
            ol:          'Numbered list',
            codeblock:   'Code block',
            source:      'HTML',
            table:       'Table',
            alignLeft:   'Align left',
            alignCenter: 'Center',
            alignRight:  'Align right',
            clearFormat: 'Clear format',
            placeholder: 'Type here...'
        }
    });
})(window);
