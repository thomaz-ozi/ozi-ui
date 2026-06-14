/**
 * ------------------------------------------
 * ozi-autocomplete
 * ------------------------------------------
 * Ver: 3.0.0
 * 2026-05-27
 *
 *
 * Uso Livewire:
 *   <div wire:ignore>
 *     <div data-ozi-autocomplete="cliente_token"
 *          data-ozi-livewire-model="cliente_token"
 *          data-ozi-livewire-text-model="cliente_nome"
 *          data-ozi-livewire-options-event="clientes-updated"
 *          data-ozi-livewire-value="{{ $cliente_token }}">
 *     </div>
 *   </div>
 *
 * PHP:
 *   public function updatedCategoria($value): void {
 *       $this->clientesOptions = Cliente::doCategoria($value)->get()->all();
 *       $this->dispatch('clientes-updated', options: $this->clientesOptions);
 *   }
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations   = window.OZI && window.OZI.integrations;
        var autocomplete   = (window.OZI && window.OZI.components && window.OZI.components.autocomplete)
                          || window.OziAutocomplete;

        if (!integrations || !integrations.registerPlugin) return;
        if (!autocomplete) {
            console.warn('[OZI] ozi-autocomplete.plugin.js: ozi-autocomplete.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'autocomplete',
            selector:     '[data-ozi-autocomplete]',
            keyAttribute: 'data-ozi-autocomplete',
            changeEvent:  'ozi:change',

            getInstance: function (root) {
                return autocomplete.get(root);
            },
            getValue: function (instance) {
                return instance ? instance.getValue() : null;
            },
            setValue: function (root, value) {
                autocomplete.value(root, value);
            },
            setOptions: function (root, options) {
                autocomplete.setOptions(root, options);
            },
            destroy: function (instance) {
                if (instance) instance.destroy();
            },
            reinit: function (root) {
                autocomplete.init(root);
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
