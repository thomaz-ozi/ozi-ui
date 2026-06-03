/**
 * shared/lang/en.js
 *
 * Dicionário global en (inglês) do OZI-UI.
 * Usado como fallbackLang quando string não existe no idioma ativo.
 *
 * Carregue após ozi-en.js e antes dos plugins.
 */

(function (window) {
    'use strict';

    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) {
        console.warn('[OZI] shared/lang/en.js: OZI.lang not found. Load ozi-en.js first.');
        return;
    }

    lang.register('en', {
        common: {
            // — actions —
            loading:  'Loading...',
            saving:   'Saving...',
            save:     'Save',
            cancel:   'Cancel',
            confirm:  'Confirm',
            close:    'Close',
            clear:    'Clear',
            search:   'Search',
            add:      'Add',
            remove:   'Remove',
            edit:     'Edit',
            back:     'Back',
            send:     'Send',
            apply:    'Apply',
            reset:    'Reset',

            // — states —
            empty:    'No results',
            error:    'Error',
            success:  'Done',
            required: 'Required field',
            optional: 'Optional',

            // — confirmations —
            yes:      'Yes',
            no:       'No',
            ok:       'OK'
        }
    });

})(window);
