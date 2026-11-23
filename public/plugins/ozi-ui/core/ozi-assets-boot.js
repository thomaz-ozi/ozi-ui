/**
 *  ------------------------------------------
 *  ozi-assets-boot
 *  ------------------------------------------
 *  Ver: 1.1.0
 *  2026-11-22
 *
 *  v1.1.0 — lê `data-ozi-debug` da própria tag (o OziAssets.php emite "1"/"0" a partir do
 *    APP_DEBUG) e grava em OZI.appDebug: o aviso OZI-W001 do core/ozi-attrs.js segue o APP_DEBUG
 *    no caminho Laravel (decisão #25). Sem o atributo (pacote antigo), OZI.appDebug fica indefinido.
 *
 *  v1.0.0 — boot do caminho @oziScripts (Laravel), que até o pacote 2.7.2 era um
 *    <script> INLINE emitido pelo OziAssets.php. Virou arquivo por causa do [OZI-11] do
 *    SNDESK: no `wire:navigate` o Livewire reinsere os scripts do <body> de uma vez, e o
 *    navegador executa os inline NA HORA e os externos DEPOIS, em ordem. O boot inline
 *    rodava antes de qualquer arquivo do core e gravava OZI.hooks = {}, OZI.helpers = {},
 *    deixava OZI.conf nulo e descartava o oziConf() do blade. Como arquivo externo, ele
 *    entra na fila dos externos e roda depois do core em qualquer cenário.
 *
 * Responsabilidade (o que o ozi.js faz no boot standalone, para o caminho @oziScripts):
 *   - inicializa OZI.conf (base e locale vêm dos data-* da própria tag, ver OziAssets.php)
 *   - liga OZI.helpers / OZI.lang / OZI.theme / OZI.hooks / OZI.integrations
 *   - instala o oziConf() de verdade e aplica a fila de chamadas feitas antes dele
 *     (a ponte inline do OziAssets enfileira em window.__oziConfQueue)
 *
 * Par: core/ozi-assets-ready.js (sobe OZI.isReady depois dos plugins).
 * Carregado SÓ pelo @oziScripts; o boot standalone é o ozi.js.
 */

(function (window, document) {
    'use strict';

    var me     = document.currentScript;
    var base   = (me && me.getAttribute('data-ozi-base')) || '';
    var locale = (me && me.getAttribute('data-ozi-locale')) || 'en';
    var debug  = me ? me.getAttribute('data-ozi-debug') : null;

    var OZI = window.OZI = window.OZI ||
        { components: {}, behaviors: {}, modules: {}, helpers: {}, conf: null, lang: null };

    OZI.helpers = window.OziHelpers || OZI.helpers || {};

    // v1.1.0: APP_DEBUG do Laravel → aviso de atributo desconhecido (core/ozi-attrs.js, #25)
    if (debug === '1' || debug === '0') OZI.appDebug = (debug === '1');
    if (window.OziAttrs) OZI.attrs = window.OziAttrs;

    // OziConf.init() recomeça do zero: numa navegação SPA entre duas telas com ozi-ui, a
    // configuração da tela anterior não vaza para esta (a fila abaixo traz a desta)
    if (window.OziConf) {
        window.OziConf.init();
        window.OziConf.apply({ core: { urlBase: base }, lang: locale });
        OZI.conf = window.OziConf.get();
    }

    function initLang() {
        if (!window.OziLang) return;
        OZI.lang = window.OziLang;
        if (typeof window.OziLang.init === 'function') {
            var c = OZI.conf || {};
            window.OziLang.init(c.lang || locale, c.fallbackLang || 'en');
        }
    }
    initLang();

    OZI.theme        = window.OziTheme || {};
    OZI.hooks        = window.OziHooks || {};
    OZI.integrations = window.OziIntegrations || {};
    if (window.OziIntegrations && typeof window.OziIntegrations._boot === 'function') {
        window.OziIntegrations._boot([]);
    }

    // oziConf() de verdade. Re-inicializa o lang quando o host passa lang/fallbackLang
    // depois do boot (o blade costuma chamar oziConf({lang}) logo após o @oziScripts).
    function oziConf(c) {
        if (!window.OziConf || !c || typeof c !== 'object') return;
        window.OziConf.apply(c);
        OZI.conf = window.OziConf.get();
        if (c.lang || c.fallbackLang) initLang();
    }
    window.oziConf = oziConf;

    var queue = window.__oziConfQueue || [];
    window.__oziConfQueue = null;
    queue.forEach(oziConf);

})(window, document);
