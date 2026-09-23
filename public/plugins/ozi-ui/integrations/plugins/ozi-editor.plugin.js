/**
 * ------------------------------------------
 * ozi-editor
 * ------------------------------------------
 * Ver: 2.1.0
 * 2026-09-23
 *
 *
 * Uso Livewire:
 *   <div wire:ignore>
 *     <textarea data-ozi-editor-html="conteudo"
 *               data-ozi-livewire-model="conteudo">
 *     </textarea>
 *   </div>
 *
 * A chave pode vir em `data-ozi-editor-html` (editor HTML) ou
 * `data-ozi-editor-md` (editor Markdown) — os dois atributos que o
 * `ozi-editor.js` de fato lê (SELECTOR do componente).
 *
 * Changelog:
 *   - v2.1.0: [FIX] Seletor/keyAttribute alinhados ao componente. O `ozi-editor.js`
 *     trocou o atributo de chave na 3.1.0 (FEAT-7: `data-ozi-editor-html` /
 *     `data-ozi-editor-md`) e este adapter seguiu em `[data-ozi-editor]` — seletor
 *     que não casa com elemento nenhum desde então. A falha era TOTALMENTE
 *     SILENCIOSA: o plugin registrava normal, nada no console, e
 *     `data-ozi-livewire-model` simplesmente não tinha efeito no editor (relatado
 *     por projeto consumidor, que precisou ligar os dois sentidos à mão).
 *     Usa `keyAttributes` (lista), contrato novo do ozi-livewire.adapter 2.2.0 —
 *     a chave pode estar em qualquer um dos dois atributos.
 *     ⚠️ `data-ozi-editor` (sem sufixo) NÃO é aceito como alias: o componente não
 *     inicializa editor nesse atributo desde a 3.1.0, então aceitá-lo aqui só
 *     criaria um binding sobre um elemento que nunca vira editor.
 *     Nota: este arquivo ficou fora do "major +1 por plugin" do corte v2 (os outros
 *     adapters foram a 3.0.0 em 2026-07/08; este seguiu em 2.0.2, de 2026-05-27) —
 *     provável causa da defasagem passar despercebida. Mantida a linha 2.x, já que
 *     a mudança é correção, não quebra.
 *   - v2.0.2: contrato v2 (getInstance/getValue/setValue/destroy/reinit).
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var editor       = window.OZI && window.OZI.components && window.OZI.components.editor;
        if (!integrations || !editor) return;

        integrations.registerPlugin({
            name:         'editor',
            selector:     '[data-ozi-editor-html], [data-ozi-editor-md]',
            keyAttribute: 'data-ozi-editor-html',
            keyAttributes: ['data-ozi-editor-html', 'data-ozi-editor-md'],
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
