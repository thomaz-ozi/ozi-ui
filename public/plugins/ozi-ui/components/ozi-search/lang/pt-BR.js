/* ───────────────────────────────────────────── */

/**
 * components/ozi-search/lang/pt-BR.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('pt-BR', {
        search: {
            minCharsMessage:  'Digite ao menos {min} caracteres',
            noResultsMessage: 'Nenhum resultado encontrado'
        }
    });
})(window);