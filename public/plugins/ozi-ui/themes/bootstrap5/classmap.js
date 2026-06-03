/**
 * themes/bootstrap5/classmap.js
 * Versão: 1.0.0
 *
 * ClassMap do tema Bootstrap 5.
 * Aplicado automaticamente quando theme: 'bootstrap5' no oziConf.
 */

(function (window) {
    'use strict';

    if (!window.oziConf) {
        console.warn('[OZI] classmap.js: oziConf não encontrado.');
        return;
    }

    window.oziConf({
        classMap: {
            // — validação —
            invalid:        'is-invalid',
            valid:          'is-valid',
            formValidated:  'was-validated',
            feedback:       'invalid-feedback',

            // — botões —
            button:          'btn btn-primary',
            buttonPrimary:   'btn btn-primary',
            buttonSecondary: 'btn btn-secondary',
            buttonDanger:    'btn btn-danger',

            // — utilitários —
            hidden:   'd-none',
            loading:  '',
            disabled: 'disabled',
            active:   'active',
            badge:    'badge'
        }
    });

})(window);
