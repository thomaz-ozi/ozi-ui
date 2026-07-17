/**
 * ------------------------------------------
 * ozi-change-v1-compat.shim
 * ------------------------------------------
 * Ver: 1.0.0
 * 2026-07-03
 *
 * Responsabilidade:
 *   - Ponte de compatibilidade v1: re-emite o CustomEvent nativo `ozi:change`
 *     (contrato v2, payload em detail) como evento jQuery com payload
 *     posicional `(event, items, instance)` — formato consumido hoje em
 *     2 arquivos do Central RH:
 *       - candidate-list.blade.php:754
 *       - profile/edit.blade.php:388
 *     (ver ozi-ui-docs/horizonte/roadmap/ozi-ui-v2-f0-inventario-centralrh.md §2)
 *
 * O que NAO faz:
 *   - Nao substitui o contrato v2 — so espelha para quem ainda nao migrou
 *   - Nao roda se jQuery nao estiver presente na pagina (no-op)
 *
 * Camada: integrations/ — UNICA camada autorizada a referenciar jQuery
 * (contrato de camadas v2 §2). Nenhum componente re-emite via jQuery
 * diretamente; esta e a unica ponte.
 *
 * Uso: incluir manualmente nas paginas que ainda dependem do formato
 * jQuery posicional. Nao e carregado automaticamente pelo boot do ozi.js
 * (jQuery e opcional no contrato v2).
 *
 * Remocao: no corte da v2 (F5), quando os 2 consumidores acima migrarem
 * para `document.addEventListener('ozi:change', e => e.detail...)`.
 *
 * Dependencias: jQuery (opcional — sem efeito se ausente)
 */

(function (window, document) {
    'use strict';

    if (typeof window.jQuery === 'undefined') return;
    var $ = window.jQuery;

    document.addEventListener('ozi:change', function (e) {
        var detail   = e.detail || {};
        var instance = null;

        var select = window.OZI && window.OZI.components && window.OZI.components.select;
        if (select && detail.component === 'ozi-select' && detail.name) {
            instance = select.get(detail.name);
        }

        $(e.target).trigger('ozi:change', [detail.items, instance, detail]);
    });

})(window, document);
