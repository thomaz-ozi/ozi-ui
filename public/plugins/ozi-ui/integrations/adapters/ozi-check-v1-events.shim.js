/**
 * ------------------------------------------
 * ozi-check-v1-events.shim
 * ------------------------------------------
 * Ver: 1.0.0
 * 2026-07-04
 *
 * Responsabilidade:
 *   - Ponte de compatibilidade v1: escuta o evento jQuery customizado
 *     'oziCheck:initFetched' (integração legada, pre-OZI.hooks) e delega
 *     para OZI.components.check.refresh(). Documentado em
 *     ozi-ui-docs/dev/components/ozi-check/description.md.
 *
 * O que NAO faz:
 *   - Nao roda se jQuery nao estiver presente na pagina (no-op)
 *   - Nao substitui o contrato v2 (OZI.hooks.afterRender / zldConf.zldHooks) —
 *     esses continuam ativos direto no ozi-check.js, sem jQuery
 *
 * Camada: integrations/ — UNICA camada autorizada a referenciar jQuery
 * (contrato de camadas v2 §2). O componente ozi-check.js e 100% zero-jQuery;
 * este listener so existe aqui porque 'oziCheck:initFetched' e um evento
 * jQuery puro (nao um CustomEvent DOM) — so pode ser escutado com jQuery.
 *
 * Uso: incluir manualmente nas paginas cujo host ainda dispara
 * $(document).trigger('oziCheck:initFetched', [root]) apos renderizar
 * conteudo dinamico. Nao e carregado automaticamente pelo boot do ozi.js.
 *
 * Dependencias: jQuery (opcional — sem efeito se ausente)
 */

(function (window, document) {
    'use strict';

    if (typeof window.jQuery === 'undefined') return;
    var $ = window.jQuery;

    $(document).on('oziCheck:initFetched', function (e, root) {
        var check = window.OZI && window.OZI.components && window.OZI.components.check;
        if (!check) return;
        var target = (root && root.jquery) ? root[0] : root;
        check.refresh(target || document);
    });

})(window, document);
