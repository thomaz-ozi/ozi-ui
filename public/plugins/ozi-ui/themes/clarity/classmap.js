/**
 * themes/clarity/classmap.js
 * Versão: 1.0.0
 *
 * ClassMap do skin clarity. clarity é um SKIN (visual), não uma integração de
 * framework — usa as mesmas classes neutras ozi-* do default. Fica aqui para
 * quem carrega o tema por `<script src=".../clarity/classmap.js">` em vez de
 * `oziConf({ theme: 'default' })`.
 *
 * Dev pode sobrescrever pontualmente via oziConf({ classMap: {} }).
 */

(function (window) {
    'use strict';

    if (!window.oziConf) {
        console.warn('[OZI] clarity/classmap.js: oziConf não encontrado. Carregue ozi-core.js antes.');
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
