/**
 * themes/default/classmap.js
 * Versão: 1.0.0
 *
 * ClassMap do tema default (classes ozi-* neutras).
 * Aplicado automaticamente quando theme: 'default' no oziConf.
 * Dev pode sobrescrever pontualmente via oziConf({ classMap: {} }).
 */

(function (window) {
    'use strict';

    if (!window.oziConf) {
        console.warn('[OZI] classmap.js: oziConf não encontrado. Carregue ozi-core.js antes.');
        return;
    }

    window.oziConf({
        classMap: {
            // — validação —
            invalid:        'ozi-invalid',
            valid:          'ozi-valid',
            formValidated:  'ozi-validated',
            feedback:       'ozi-feedback',

            // — botões —
            button:          'ozi-btn',
            buttonPrimary:   'ozi-btn-primary',
            buttonSecondary: 'ozi-btn-secondary',
            buttonDanger:    'ozi-btn-danger',

            // — utilitários —
            hidden:   'ozi-hidden',
            loading:  'ozi-loading',
            disabled: 'ozi-disabled',
            active:   'ozi-active',
            badge:    'ozi-badge'
        }
    });

})(window);
