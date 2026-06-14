/**
 * ------------------------------------------
 * ozi-select
 * ------------------------------------------
 * Ver: 5.0.0
 * 2026-05-27
 *
 *
 *
 * Ficha declarativa do ozi-select para o sistema de integrations.
 * Registra o plugin em OZI.integrations para que adapters
 * (Livewire, Alpine, Vue, HTMX) possam interagir com ele.
 *
 * Dependências:
 *   - ozi-integrations.js
 *   - ozi-select.js
 *
 * Uso Livewire:
 *   <div wire:ignore>
 *     <div data-ozi-select="estado"
 *          data-ozi-livewire-model="estado"
 *          data-ozi-livewire-options-event="estados-updated">
 *     </div>
 *     <script type="application/json" data-ozi-select-options="estado">
 *       @json($estadosOptions ?? [])
 *     </script>
 *   </div>
 *
 * PHP dispatch:
 *   $this->dispatch('estados-updated', options: $this->estadosOptions);
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var select       = (window.OZI && window.OZI.components && window.OZI.components.select)
                        || window.OziSelect;

        if (!integrations || !integrations.registerPlugin) return;
        if (!select) {
            console.warn('[OZI] ozi-select.plugin.js: ozi-select.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'select',
            selector:     '[data-ozi-select]',
            keyAttribute: 'data-ozi-select',
            changeEvent:  'ozi:change',

            getInstance: function (root) {
                return select.get(root);
            },
            getValue: function (instance) {
                return instance ? instance.getValue() : null;
            },
            setValue: function (root, value) {
                select.value(root, value);
            },
            setOptions: function (root, options) {
                select.setOptions(root, options);
            },
            destroy: function (instance) {
                if (instance) instance.destroy();
            },
            reinit: function (root) {
                select.init(root);
            }
        });
    }

    if (window.OZI && window.OZI.isReady) {
        _register();
    } else if (window.OZI && window.OZI.ready) {
        window.OZI.ready(_register);
    } else {
        document.addEventListener('DOMContentLoaded', _register);
    }

})(window);
