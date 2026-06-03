
/* ───────────────────────────────────────────── */

/**
 * components/ozi-auth/lang/pt-BR.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('pt-BR', {
        auth: {
            showPassword:  'Mostrar senha',
            hidePassword:  'Ocultar senha',
            rulesTitle:    'Regras da senha',
            passLength:    'Entre {min} e {max} caracteres',
            uppercase:     'Pelo menos uma letra maiúscula',
            lowercase:     'Pelo menos uma letra minúscula',
            number:        'Pelo menos um número',
            special:       'Pelo menos um caractere especial (!@#$%...)',
            noSpace:       'Sem espaços',
            noEmailParts:  'Senha não pode conter partes do email',
            confirm:       'Senhas coincidem',
            userMin:       'Usuário: mínimo {min} caracteres'
        }
    });
})(window);
