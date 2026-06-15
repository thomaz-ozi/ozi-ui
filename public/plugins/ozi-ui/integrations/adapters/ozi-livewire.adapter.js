/**
 *
 * ------------------------------------------
 * ozi-livewire.adapter
 * ------------------------------------------
 * Ver: 1.0.0
 * 2026-05-27
 *
 *
 * Responsabilidade:
 *   - Adaptar plugins OZI ao Livewire 3 e 4 (auto-detect)
 *   - Binding bidirecional: ozi:change → component.set()
 *   - Receber opções atualizadas via Livewire.on() / dispatch
 *   - Sincronizar valor inicial via data-ozi-livewire-value
 *   - Eventos DOM imperativos: ozi:set-value, ozi:set-options
 *
 * Atributos HTML reconhecidos:
 *   data-ozi-livewire-model         → propriedade Livewire (valor)
 *   data-ozi-livewire-text-model    → propriedade Livewire (texto, opcional)
 *   data-ozi-livewire-options-event → evento que atualiza opções
 *   data-ozi-livewire-value         → valor inicial (sobrescreve opções)
 *
 * Dependências:
 *   - ozi-integrations.js (OZI.integrations.registerAdapter)
 *   - Livewire 3 ou 4 (detectado automaticamente)
 *
 * Baseado em: ozi-livewire.adapter.js real (código analisado)
 * Resolve:
 *   - ozi-autocomplete.livewire.js obsoleto → absorvido aqui
 *   - Rescan via eventos DOM próprios → OZI.hooks.afterRender
 */

(function (window, document) {
    'use strict';

    // ─────────────────────────────────────────────
    // [1] GUARD
    // ─────────────────────────────────────────────

    if (window.__oziLivewireAdapterInited) return;
    window.__oziLivewireAdapterInited = true;


    // ─────────────────────────────────────────────
    // [2] ATRIBUTOS RECONHECIDOS
    // ─────────────────────────────────────────────

    var ATTR = {
        model:        'data-ozi-livewire-model',
        textModel:    'data-ozi-livewire-text-model',
        optionsEvent: 'data-ozi-livewire-options-event',
        value:        'data-ozi-livewire-value',
        bound:        'data-ozi-livewire-bound',
        lastValue:    'data-ozi-livewire-last-value'
    };


    // ─────────────────────────────────────────────
    // [3] HELPERS INTERNOS
    // ─────────────────────────────────────────────

    var _H = (window.OZI && window.OZI.integrations && window.OZI.integrations.helpers) || {};

    function _hasLivewire() { return !!window.Livewire; }

    function _getComponent(el) {
        if (!_hasLivewire() || !el) return null;
        var host = el.closest ? el.closest('[wire\\:id]') : null;
        if (!host) return null;
        var id = host.getAttribute('wire:id');
        return id ? window.Livewire.find(id) : null;
    }

    function _parseJsonSafe(val, fallback) {
        return _H.parseJsonSafe ? _H.parseJsonSafe(val, fallback) : (function () {
            try { return JSON.parse(val); } catch (e) { return fallback; }
        })();
    }

    function _isBlank(val) {
        return _H.isBlank ? _H.isBlank(val) : (val === null || val === undefined || val === '');
    }

    function _stableStr(val) {
        return _H.stableStringify ? _H.stableStringify(val) : JSON.stringify(val);
    }

    // Registry de eventos Livewire já registrados — evita duplicatas
    var _registeredEvents = {};

    function _registerLivewireEvent(eventName, handler) {
        if (_registeredEvents[eventName]) return;
        _registeredEvents[eventName] = true;
        if (!_hasLivewire()) return;
        try {
            window.Livewire.on(eventName, handler);
        } catch (e) {
            // Livewire 4 pode ter API diferente — tenta via document
            document.addEventListener('livewire:' + eventName, function (ev) {
                handler(ev.detail || {});
            });
        }
    }


    // ─────────────────────────────────────────────
    // [4] BIND DE UM ELEMENTO
    // Amarra ozi:change → component.set()
    // ─────────────────────────────────────────────

    function _bindElement(el, plugin) {
        if (!el || el.getAttribute(ATTR.bound)) return;
        el.setAttribute(ATTR.bound, '1');

        var modelProp  = el.getAttribute(ATTR.model);
        var textProp   = el.getAttribute(ATTR.textModel);
        var optEvent   = el.getAttribute(ATTR.optionsEvent);
        var initValue  = el.getAttribute(ATTR.value);

        // suporta optionsEvent sem model (ex: ozi-search recebe novos itens sem sync de valor)
        if (!modelProp && !optEvent) return;

        // — valor inicial — (só quando há model)
        if (modelProp && !_isBlank(initValue)) {
            var parsed = _parseJsonSafe(initValue, initValue);
            setTimeout(function () {
                try { plugin.setValue(el, parsed); } catch (e) {}
            }, 0);
        }

        // — ozi:change → Livewire component.set() — (só quando há model)
        if (modelProp) {
            el.addEventListener(plugin.changeEvent || 'ozi:change', function (e) {
                var inst = plugin.getInstance(el);
                if (!inst) return;

                var value    = plugin.getValue(inst);
                var valueStr = _stableStr(value);

                // evita loop: só propaga se valor realmente mudou
                if (el.getAttribute(ATTR.lastValue) === valueStr) return;
                el.setAttribute(ATTR.lastValue, valueStr);

                var comp = _getComponent(el);
                if (!comp) return;

                try {
                    comp.set(modelProp, value);

                    // text-model (autocomplete — label além do value)
                    if (textProp && e.detail && e.detail.label !== undefined) {
                        comp.set(textProp, e.detail.label || '');
                    }
                } catch (err) {
                    console.warn('[OZI:livewire] component.set falhou:', err.message);
                }
            });
        }

        // — Livewire.on(optionsEvent) → atualiza opções —
        if (optEvent) {
            _registerLivewireEvent(optEvent, function (payload) {
                var options = Array.isArray(payload)
                    ? payload
                    : (payload.options || payload.data || []);

                var inst = plugin.getInstance(el);
                if (inst && typeof plugin.setOptions === 'function') {
                    plugin.setOptions(el, options);
                }
            });
        }
    }


    // ─────────────────────────────────────────────
    // [5] SCAN — percorre DOM por elementos do plugin
    // ─────────────────────────────────────────────

    function _scan(plugin, scope) {
        if (!plugin || !plugin.selector) return;
        scope = scope || document;

        var elements = [];
        if (scope.querySelectorAll) {
            var sel = plugin.selector + '[' + ATTR.model + '],' +
                      plugin.selector + '[' + ATTR.optionsEvent + ']';
            elements = scope.querySelectorAll(sel);
        }

        Array.prototype.forEach.call(elements, function (el) {
            _bindElement(el, plugin);
        });
    }


    // ─────────────────────────────────────────────
    // [6] EVENTOS DOM IMPERATIVOS
    // Permitem controle sem depender de Livewire diretamente.
    // Disparados por ozi-actions (set-value, set-options).
    // ─────────────────────────────────────────────

    document.addEventListener('ozi:set-value', function (e) {
        var detail  = e.detail || {};
        var plugins = window.OZI && window.OZI.integrations;
        if (!plugins) return;

        var plugin = plugins.getPlugin(detail.plugin);
        if (!plugin) return;

        var el = document.querySelector(plugin.selector + '[' + plugin.keyAttribute + '="' + detail.key + '"]');
        if (!el) return;

        try { plugin.setValue(el, detail.value); } catch (err) {}
    });

    document.addEventListener('ozi:set-options', function (e) {
        var detail  = e.detail || {};
        var plugins = window.OZI && window.OZI.integrations;
        if (!plugins) return;

        var plugin = plugins.getPlugin(detail.plugin);
        if (!plugin || typeof plugin.setOptions !== 'function') return;

        var el = document.querySelector(plugin.selector + '[' + plugin.keyAttribute + '="' + detail.key + '"]');
        if (!el) return;

        try { plugin.setOptions(el, detail.options || []); } catch (err) {}
    });


    // ─────────────────────────────────────────────
    // [7] REGISTRO NO OZI.integrations
    // ─────────────────────────────────────────────

    function _boot() {
        var integrations = window.OZI && window.OZI.integrations;
        if (!integrations || !integrations.registerAdapter) {
            console.warn('[OZI:livewire] OZI.integrations não encontrado.');
            return;
        }

        integrations.registerAdapter({
            name:       'livewire',
            attrPrefix: 'data-ozi-livewire-',
            scan:       _scan
        });
    }

    // boot imediato ou após OZI ready
    if (window.OZI && window.OZI.isReady) {
        _boot();
    } else if (window.OZI && window.OZI.ready) {
        window.OZI.ready(function () { _boot(); });
    } else {
        document.addEventListener('DOMContentLoaded', _boot);
    }

})(window, document);
