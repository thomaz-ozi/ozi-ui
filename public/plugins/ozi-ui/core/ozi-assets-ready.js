/**
 *  ------------------------------------------
 *  ozi-assets-ready
 *  ------------------------------------------
 *  Ver: 1.0.0
 *  2026-11-16
 *
 *  v1.0.0 — fim do boot do caminho @oziScripts, antes um <script> inline do OziAssets.php.
 *    Mesmo motivo do core/ozi-assets-boot.js ([OZI-11]): no `wire:navigate` o inline rodava
 *    antes dos plugins e do ozi-hooks, então `OZI.hooks._boot()` não era chamado (os hooks do
 *    Livewire ficavam desligados) e OZI.isReady subia cedo demais.
 *
 * Responsabilidade: depois dos plugins, liga os hooks do Livewire (`OZI.hooks._boot()`) e
 * sobe OZI.isReady. Espera o DOMContentLoaded na carga normal (o @livewireScripts costuma vir
 * depois do @oziScripts e o window.Livewire só existe aí).
 *
 * Carregado SÓ pelo @oziScripts, por último.
 */

(function (window, document) {
    'use strict';

    function ready() {
        var OZI = window.OZI;
        if (!OZI) return;
        if (OZI.hooks && typeof OZI.hooks._boot === 'function') OZI.hooks._boot();
        OZI.isReady = true;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
    else setTimeout(ready, 0);

})(window, document);
