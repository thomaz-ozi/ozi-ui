/**
 * ------------------------------------------
 * oziAddons
 * ------------------------------------------
 * Ver: (1.2.0)
 * 2026-04-25
 * ------------------------------------------
 */
(function (window, document) {
    'use strict';

    // ------------------------------------------
    // [1] VERIFICA SE ELEMENTO EXISTE POR ID
    // ------------------------------------------
    function zldGetElementById(elmId) {
        return document.getElementById(elmId) !== null;
    }

    // ------------------------------------------
    // [2] CAPTURA ELEMENTO CLICADO
    // ------------------------------------------
    function zldClickCatch(e) {
        if (!e) return null;
        return e.target || null;
    }

    // ------------------------------------------
    // [3] ENVIA DADOS VIA FORM POST + REDIRECT
    // ------------------------------------------
    function zldSendRedirectForm(destiny, data) {
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = destiny;
        form.style.display = 'none';

        for (var chave in data) {
            if (Object.prototype.hasOwnProperty.call(data, chave)) {
                var input = document.createElement('input');
                input.type = 'hidden';
                input.name = chave;
                input.value = data[chave];
                form.appendChild(input);
            }
        }

        document.body.appendChild(form);
        form.submit();
    }

    // ------------------------------------------
    // [4] ABRE JANELA OU ABA
    // ------------------------------------------
    function zldWindow(theURL, winName, features) {
        winName  = winName  || '_blank';
        features = features || 'toolbar=no,scrollbars=yes,resizable=yes,top=150,left=150,width=960,height=640';
        window.open(theURL, winName, features);
    }

    // ------------------------------------------
    // [5] REDIRECT
    // ------------------------------------------
    function zldRedirectUrl(url) {
        window.location.href = url;
    }

    // ------------------------------------------
    // [6] CARREGA SCRIPT EXTERNO SOB DEMANDA
    // ------------------------------------------
    function oziLoadExternalScript(config) {
        config = config || {};

        var script = document.createElement(config.tagName || 'script');

        if (!config.src) {
            console.warn('oziLoadExternalScript: config.src é obrigatório.');
            return;
        }

        script.src = config.src;

        if (config.integrity)   script.integrity   = config.integrity;
        if (config.crossOrigin) script.crossOrigin = config.crossOrigin;

        var resourceName     = config.resourceName     || config.src;
        var startAfterEvent  = config.startAfterEvent  || false;
        var onLoad           = config.onLoad;

        script.onload = function () {
            console.log('oziAddons| carregado:', resourceName);

            if (typeof onLoad === 'function') {
                onLoad();
            }

            if (startAfterEvent) {
                if (typeof window.startEvent === 'function') {
                    window.startEvent();
                } else {
                    console.warn('oziLoadExternalScript: startEvent não encontrado.');
                }
            }
        };

        script.onerror = function () {
            console.error('oziAddons| erro ao carregar:', resourceName);
        };

        document.head.appendChild(script);
    }

    // ------------------------------------------
    // EXPORTS
    // ------------------------------------------
    window.zldGetElementById    = zldGetElementById;
    window.zldClickCatch        = zldClickCatch;
    window.zldSendRedirectForm  = zldSendRedirectForm;
    window.zldWindow            = zldWindow;
    window.zldRedirectUrl       = zldRedirectUrl;
    window.oziLoadExternalScript = oziLoadExternalScript;

})(window, document);