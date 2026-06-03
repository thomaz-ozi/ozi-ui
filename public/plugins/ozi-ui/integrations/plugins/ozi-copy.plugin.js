/**

 * ------------------------------------------
 * ozi-copy
 * ------------------------------------------
 * Ver: 3.0.0
 * 2026-05-27
 *
 *
 * Ficha declarativa do ozi-copy para OZI.integrations.
 *
 * Uso (modo direto):
 *   <button data-ozi-copy-value="texto a copiar">Copiar</button>
 *
 * Uso (modo referência):
 *   <code data-ozi-copy-content="meu-codigo">npm install ozi-ui</code>
 *   <button data-ozi-copy="meu-codigo">Copiar código</button>
 *
 * Uso (html-decode — entidades HTML):
 *   <div data-ozi-copy-content="html-ref" data-ozi-copy-mode="html-decode">
 *     &lt;div&gt;Hello&lt;/div&gt;
 *   </div>
 *   <button data-ozi-copy="html-ref">Copiar HTML</button>
 *
 * Eventos:
 *   ozi:copied      → { text }
 *   ozi:copy-error  → { error }
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var copy         = window.OZI && window.OZI.behaviors && window.OZI.behaviors.copy;

        if (!integrations || !integrations.registerPlugin) return;
        if (!copy) {
            console.warn('[OZI] ozi-copy.plugin.js: ozi-copy.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'copy',
            selector:     '[data-ozi-copy-value], [data-ozi-copy]',
            keyAttribute: 'data-ozi-copy',
            changeEvent:  'ozi:copied',

            getInstance: function () {
                return copy; // singleton
            },
            getValue: function (instance, root) {
                // retorna o texto que seria copiado
                if (!root) return null;
                var val = root.getAttribute('data-ozi-copy-value');
                return val !== null ? val : null;
            },
            setValue: function (root, value) {
                // atualiza o valor a copiar programaticamente
                if (root) root.setAttribute('data-ozi-copy-value', value);
            },
            destroy: function () {
                // behavior — sem destroy
            },
            reinit: function () {
                // behavior com delegação — não precisa de reinit
            }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
