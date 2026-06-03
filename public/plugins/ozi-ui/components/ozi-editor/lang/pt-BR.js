
/* ───────────────────────────────────────────── */

/**
 * components/ozi-editor/lang/pt-BR.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('pt-BR', {
        editor: {
            bold:        'Negrito',
            italic:      'Itálico',
            underline:   'Sublinhado',
            ul:          'Lista',
            ol:          'Lista numerada',
            codeblock:   'Bloco de código',
            source:      'HTML',
            table:       'Tabela',
            alignLeft:   'Alinhar à esquerda',
            alignCenter: 'Centralizar',
            alignRight:  'Alinhar à direita',
            clearFormat: 'Limpar formatação',
            placeholder: 'Digite aqui...'
        }
    });
})(window);
