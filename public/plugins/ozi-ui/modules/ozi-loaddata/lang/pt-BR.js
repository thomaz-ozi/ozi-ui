/**
 * modules/ozi-loaddata/lang/pt-BR.js
 */

(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;

    lang.register('pt-BR', {
        loadData: {
            sending: 'Enviando...',
            error:   'Erro ao carregar',
            success: 'Concluído'
        }
    });
})(window);
