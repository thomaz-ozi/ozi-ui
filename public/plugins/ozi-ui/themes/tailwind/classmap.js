/**
 * themes/tailwind/classmap.js
 * Versão: 1.0.0
 *
 * ClassMap do tema Tailwind CSS.
 * Aplica classes utilitárias do Tailwind nos tokens semânticos do OZI.
 *
 * IMPORTANTE: estas classes precisam estar no safelist do Tailwind
 * ou geradas via PurgeCSS/content scan para não serem removidas.
 *
 * Aplicado automaticamente quando theme: 'tailwind' no oziConf.
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
            invalid:        'border-red-500 text-red-600 ring-1 ring-red-500',
            valid:          'border-green-500 text-green-600',
            formValidated:  'ozi-validated',
            feedback:       'text-red-500 text-sm mt-1',

            // — botões —
            button:          'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors',
            buttonPrimary:   'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors',
            buttonSecondary: 'px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors',
            buttonDanger:    'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors',

            // — utilitários —
            hidden:   'hidden',
            loading:  'opacity-50 pointer-events-none',
            disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
            active:   'ring-2 ring-blue-500',
            badge:    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
        }
    });

})(window);
