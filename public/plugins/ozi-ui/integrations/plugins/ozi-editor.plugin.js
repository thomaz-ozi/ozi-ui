/**
 * ------------------------------------------
 * ozi-editor
 * ------------------------------------------
 * Ver: 2.0.2
 * 2026-05-27
 *
 *
 * Uso Livewire:
 *   <div wire:ignore>
 *     <textarea data-ozi-editor="conteudo"
 *               data-ozi-livewire-model="conteudo">
 *     </textarea>
 *   </div>
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var editor       = window.OZI && window.OZI.components && window.OZI.components.editor;
        if (!integrations || !editor) return;

        integrations.registerPlugin({
            name:         'editor',
            selector:     '[data-ozi-editor]',
            keyAttribute: 'data-ozi-editor',
            changeEvent:  'ozi:change',

            getInstance: function (root) { return editor.get(root); },
            getValue:    function (instance) { return instance ? instance.getValue() : ''; },
            setValue:    function (root, value) { editor.value(root, value); },
            destroy:     function (instance) { if (instance) instance.destroy(); },
            reinit:      function (root) { editor.init(root); }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
