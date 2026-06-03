/**
 * ozi-audio.plugin.js | ozi-auth.plugin.js | ozi-check.plugin.js
 * ozi-search.plugin.js | ozi-copy.plugin.js | ozi-toggle.plugin.js
 * Versão: 1.0.0
 *
 * Fichas individuais — cada uma registra seu plugin em OZI.integrations.
 * Separadas aqui em um único arquivo para economia de tokens.
 * Em produção, cada plugin tem seu próprio arquivo em /integrations/plugins/.
 */

(function (window) {
    'use strict';

    function _boot(fn) {
        if (window.OZI && window.OZI.isReady) { fn(); }
        else if (window.OZI && window.OZI.ready) { window.OZI.ready(fn); }
        else { document.addEventListener('DOMContentLoaded', fn); }
    }

    // ─────────────────────────────────────────────
    // ozi-audio.plugin.js
    // ─────────────────────────────────────────────
    _boot(function () {
        var integrations = window.OZI && window.OZI.integrations;
        var audio        = window.OZI && window.OZI.components && window.OZI.components.audio;
        if (!integrations || !audio) return;

        integrations.registerPlugin({
            name:         'audio',
            selector:     '[data-ozi-audio]',
            keyAttribute: 'id',
            changeEvent:  'ozi:audio-saved',

            getInstance: function (root) { return audio.get(root); },
            getValue:    function (instance) { return instance ? instance.recordedFile : null; },
            setValue:    function () { /* audio não tem setValue externo */ },
            destroy:     function (instance) { if (instance) instance.destroy(); },
            reinit:      function (root) { audio.init(root); }
        });
    });

    // ─────────────────────────────────────────────
    // ozi-auth.plugin.js
    // ─────────────────────────────────────────────
    _boot(function () {
        var integrations = window.OZI && window.OZI.integrations;
        var auth         = window.OZI && window.OZI.components && window.OZI.components.auth;
        if (!integrations || !auth) return;

        integrations.registerPlugin({
            name:         'auth',
            selector:     '[data-ozi-auth-submit]',
            keyAttribute: 'data-ozi-auth-submit',
            changeEvent:  'ozi:auth-change',

            getInstance: function (root) { return auth.get(root); },
            getValue:    function (instance) { return instance ? instance._lastResult : null; },
            setValue:    function () { /* auth não tem setValue */ },
            destroy:     function (instance) { if (instance) instance.destroy(); },
            reinit:      function (root) { auth.init(root); }
        });
    });

    // ─────────────────────────────────────────────
    // ozi-check.plugin.js
    // ─────────────────────────────────────────────
    _boot(function () {
        var integrations = window.OZI && window.OZI.integrations;
        var check        = window.OZI && window.OZI.components && window.OZI.components.check;
        if (!integrations || !check) return;

        integrations.registerPlugin({
            name:         'check',
            selector:     '[data-ozi-check-item]',
            keyAttribute: 'data-ozi-check-item',
            changeEvent:  'ozi:check-change',

            getInstance: function () { return check; },
            getValue:    function (instance, root) {
                if (!root) return [];
                var group = root.getAttribute ? root.getAttribute('data-ozi-check-item') : '';
                var els   = check.getGroupElements(group);
                return els.$items.filter(':checked').map(function () { return this.value; }).get();
            },
            setValue:    function (root, value) {
                var group = root && root.getAttribute('data-ozi-check-item');
                if (group) check.setAllItems(group, !!value);
            },
            destroy:     function () {},
            reinit:      function () { check.refresh(); }
        });
    });

    // ─────────────────────────────────────────────
    // ozi-search.plugin.js
    // ─────────────────────────────────────────────
    _boot(function () {
        var integrations = window.OZI && window.OZI.integrations;
        var search       = window.OZI && window.OZI.components && window.OZI.components.search;
        if (!integrations || !search) return;

        integrations.registerPlugin({
            name:         'search',
            selector:     '[data-ozi-search]',
            keyAttribute: 'id',
            changeEvent:  'ozi:search-filtered',

            getInstance: function (root) { return root; },
            getValue:    function (root) { return root ? root.value : ''; },
            setValue:    function (root, value) { search.trigger(root, value); },
            destroy:     function () {},
            reinit:      function (root) { search.init(root); }
        });
    });

    // ─────────────────────────────────────────────
    // ozi-copy.plugin.js
    // ─────────────────────────────────────────────
    _boot(function () {
        var integrations = window.OZI && window.OZI.integrations;
        var copy         = window.OZI && window.OZI.behaviors && window.OZI.behaviors.copy;
        if (!integrations || !copy) return;

        integrations.registerPlugin({
            name:         'copy',
            selector:     '[data-ozi-copy-value], [data-ozi-copy]',
            keyAttribute: 'data-ozi-copy',
            changeEvent:  'ozi:copied',

            getInstance: function () { return copy; },
            getValue:    function () { return null; },
            setValue:    function (root, value) {
                if (root) root.setAttribute('data-ozi-copy-value', value);
            },
            destroy:     function () {},
            reinit:      function () {}
        });
    });

    // ─────────────────────────────────────────────
    // ozi-toggle.plugin.js
    // ─────────────────────────────────────────────
    _boot(function () {
        var integrations = window.OZI && window.OZI.integrations;
        var toggle       = window.OZI && window.OZI.behaviors && window.OZI.behaviors.toggle;
        if (!integrations || !toggle) return;

        integrations.registerPlugin({
            name:         'toggle',
            selector:     '[data-ozi-toggle-trigger]',
            keyAttribute: 'data-ozi-toggle-trigger',
            changeEvent:  'ozi:toggle-change',

            getInstance: function () { return toggle; },
            getValue:    function (instance, root) {
                if (!root) return false;
                var id = root.getAttribute('data-ozi-toggle-trigger');
                if (!id) return false;
                var content = document.querySelector('[data-ozi-toggle-content="' + id + '"]');
                return content ? content.style.display !== 'none' : false;
            },
            setValue: function (root, value) {
                var id = root && root.getAttribute('data-ozi-toggle-trigger');
                if (!id) return;
                value ? toggle.open(id) : toggle.close(id);
            },
            destroy:  function () {},
            reinit:   function () { toggle.syncAll(); }
        });
    });

})(window);
