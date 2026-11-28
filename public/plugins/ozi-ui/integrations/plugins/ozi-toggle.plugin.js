/**

 * ------------------------------------------
 * ozi-toggle
 * ------------------------------------------
 * Ver: 3.0.1
 * 2026-11-27
 *
 * Ficha declarativa do ozi-toggle para OZI.integrations.
 *
 * Changelog:
 *   - v3.0.1 (2.11.6): getInstance devolve o trigger. O adapter Livewire chama
 *     getValue(inst) sem o elemento, e com o singleton o valor era sempre false.
 *     setValue aceita "false"/"0" como fechado (antes qualquer texto abria).
 *     Exemplo do slide corrigido: data-ozi-toggle-options vai no CONTENT.
 *
 * Uso:
 *   <button data-ozi-toggle-trigger="filtros">
 *     <span data-ozi-toggle-show>Mostrar filtros</span>
 *     <span data-ozi-toggle-hide>Ocultar filtros</span>
 *   </button>
 *   <div data-ozi-toggle-content="filtros" style="display:none">
 *     Conteúdo
 *   </div>
 *
 * Com slide:
 *   <button data-ozi-toggle-trigger="menu">Menu</button>
 *   <nav data-ozi-toggle-content="menu"
 *        data-ozi-toggle-options="slide-time:400;" style="display:none">...</nav>
 *
 * API programática:
 *   OZI.behaviors.toggle.open('filtros');
 *   OZI.behaviors.toggle.close('filtros');
 *   OZI.behaviors.toggle.toggle('filtros');
 *
 * Eventos:
 *   ozi:toggle-open    → { id }
 *   ozi:toggle-close   → { id }
 *   ozi:toggle-change  → { id, open }
 */

(function (window) {
    'use strict';

    function _idOf(root) {
        return root && root.getAttribute
            ? String(root.getAttribute('data-ozi-toggle-trigger') || '').trim()
            : '';
    }

    // compara o atributo em vez de montar seletor (aspas no nome nao quebram)
    function _contentOf(id) {
        var all = document.querySelectorAll('[data-ozi-toggle-content]');
        for (var i = 0; i < all.length; i++) {
            if (String(all[i].getAttribute('data-ozi-toggle-content') || '').trim() === id) return all[i];
        }
        return null;
    }

    // valor do Livewire: true/1/"true"/"1" abre; o resto ("false", "0", null) fecha
    function _truthy(v) {
        if (v === true || v === 1) return true;
        var s = String(v == null ? '' : v).trim().toLowerCase();
        return s === 'true' || s === '1';
    }

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var toggle       = (window.OZI && window.OZI.behaviors && window.OZI.behaviors.toggle)
                        || window.OziToggle;

        if (!integrations || !integrations.registerPlugin) return;
        if (!toggle) {
            console.warn('[OZI] ozi-toggle.plugin.js: ozi-toggle.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'toggle',
            selector:     '[data-ozi-toggle-trigger]',
            keyAttribute: 'data-ozi-toggle-trigger',
            changeEvent:  'ozi:toggle-change',

            // [3.0.1] a instancia e o proprio trigger: o adapter chama getValue(inst)
            // sem o elemento, e com o singleton aqui o valor saia sempre false
            getInstance: function (root) {
                return root || null;
            },
            getValue: function (root) {
                var id = _idOf(root);
                if (!id) return false;
                var content = _contentOf(id);
                return content
                    ? window.getComputedStyle(content).display !== 'none'
                    : false;
            },
            // open/close da API emitem source 'api': o adapter nao repropaga (sem loop)
            setValue: function (root, value) {
                var id = _idOf(root);
                if (!id) return;
                _truthy(value) ? toggle.open(id) : toggle.close(id);
            },
            destroy: function () {
                // behavior — sem destroy
            },
            reinit: function () {
                toggle.syncAll();
            }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
