/**
 * modules/ozi-loaddata/lang/pt-BR.js
 */

(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;

    lang.register('pt-BR', {
        loadData: {
            error:           'Erro ao carregar.',
            processError:    'Erro ao processar.',
            invalidJson:     'Resposta JSON inválida.',
            invalidJsonHint: 'Verifique o retorno da rota.',
            network:         'Não foi possível carregar.',
            networkHint:     'Verifique sua conexão.',
            status:          'Status {status}'
        }
    });
})(window);
