/* ───────────────────────────────────────────── */

/**
 * components/ozi-autocomplete/lang/pt-BR.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('pt-BR', {
        autocomplete: {
            searchPlaceholder: 'Pesquisar...',
            empty:             'Nenhum resultado encontrado',
            uniqueMessage:     'Este item já foi selecionado.'
        }
    });
})(window);