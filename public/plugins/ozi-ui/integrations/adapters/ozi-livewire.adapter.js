/**
 *
 * ------------------------------------------
 * ozi-livewire.adapter
 * ------------------------------------------
 * Ver: 2.1.0
 * 2026-08-20
 *
 *
 * Responsabilidade:
 *   - Adaptar plugins OZI ao Livewire 3 e 4 (auto-detect)
 *   - Propagar ozi:change (CustomEvent, contrato v2) → Livewire
 *   - Receber opções atualizadas via Livewire.on() / dispatch
 *   - Sincronizar valor inicial via data-ozi-livewire-value
 *   - Eventos DOM imperativos: ozi:set-value, ozi:set-options
 *
 * Dois modos de propagação (o adapter escolhe automaticamente):
 *   A) wire:model NATIVO (preferido) — data-ozi-livewire-native aponta o input
 *      wire:model; no ozi:change o adapter faz dispatch de `input`+`change`
 *      nativos nele → o Livewire trata pela própria máquina de wire:model
 *      (respeita .live/.debounce/.lazy). É o caminho robusto para timing.
 *   B) component.set() (compat) — data-ozi-livewire-model + component.set(prop).
 *
 * Atributos HTML reconhecidos:
 *   data-ozi-livewire-model         → propriedade Livewire (modo B)
 *   data-ozi-livewire-text-model    → propriedade Livewire (texto, opcional; modo B)
 *   data-ozi-livewire-native        → modo A: ''/'true' = o próprio el é o input
 *                                     wire:model; ou um seletor CSS p/ o input
 *   data-ozi-livewire-options-event → evento que atualiza opções
 *   data-ozi-livewire-value         → valor inicial (sobrescreve opções)
 *   data-ozi-select-footer-call     → método Livewire chamado no clique do rodapé do
 *                                     ozi-select (via evento ozi:select-footer)
 *
 * Dependências:
 *   - ozi-integrations.js (OZI.integrations.registerAdapter)
 *   - Livewire 3 ou 4 (detectado automaticamente)
 *   - Re-init pós-morph: papel do OZI.hooks (fontes livewire3/livewire4) — o
 *     adapter NÃO instala hooks de render próprios.
 *
 * Changelog:
 *   - v2.1.0: [FEAT] Modo `-footer-call` do rodapé do ozi-select. No evento
 *     `ozi:select-footer` (emitido pelo botão de rodapé, ozi-select v6.2.0), lê
 *     `data-ozi-select-footer-call` no root do select e chama `component.call(metodo)`
 *     no componente Livewire ancestral. Extensão dos modos A/B: agora um `component.call()`
 *     p/ ação (não só `set`). Mantém o framework isolado no adapter — o componente ozi-select
 *     só emite o evento neutro (R6). Aditivo → MINOR.
 *   - v2.0.0: [V2-F4] Contrato v2. Guard por `e.detail.source === 'api'`:
 *     mudanças programáticas (setValue, tipicamente originadas do próprio
 *     Livewire) não repropagam — elimina o loop wire:model→setValue→ozi:change→
 *     set de forma alinhada ao contrato (§1.3), além do guard secundário por
 *     valor. Novo modo A (dispatch nativo em wire:model) via
 *     data-ozi-livewire-native; component.set() vira fallback. Zero jQuery
 *     (sempre foi). Header alinhado ao boot nativo do core.
 *   - v1.0.0: binding ozi:change → component.set(); options via Livewire.on();
 *     eventos imperativos ozi:set-value/ozi:set-options; valor inicial.
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
        native:       'data-ozi-livewire-native',
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
    // [3b] PROPAGAÇÃO v2 — modo A (wire:model nativo) | modo B (component.set)
    // ─────────────────────────────────────────────

    // Resolve o alvo de dispatch nativo:
    //   ''/'true'  → o próprio elemento é o input wire:model
    //   '<seletor>'→ aponta para o input wire:model (ex: '#uf-hidden')
    function _nativeTarget(el) {
        var sel = el.getAttribute(ATTR.native);
        if (sel === null) return null;
        if (sel === '' || sel === 'true') return el;
        try { return document.querySelector(sel); } catch (e) { return null; }
    }

    // Modo A: seta o valor e dispara input+change nativos (bubbling) — o Livewire
    // trata pela própria máquina de wire:model (respeita .live/.debounce/.lazy).
    function _dispatchNative(target, value) {
        var v = (value === null || value === undefined) ? ''
              : (typeof value === 'object' ? JSON.stringify(value) : value);
        if ('value' in target) target.value = v;
        target.dispatchEvent(new Event('input',  { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Propaga o valor do componente OZI para o Livewire.
    // Preferência v2: modo A (wire:model nativo). Fallback: modo B (component.set).
    function _propagate(el, modelProp, textProp, value, detail) {
        var target = _nativeTarget(el);
        if (target) { _dispatchNative(target, value); return; }

        if (!modelProp) return;
        var comp = _getComponent(el);
        if (!comp) return;
        try {
            comp.set(modelProp, value);
            // text-model (autocomplete — label além do value)
            if (textProp && detail && detail.label !== undefined) {
                comp.set(textProp, detail.label || '');
            }
        } catch (err) {
            console.warn('[OZI:livewire] component.set falhou:', err.message);
        }
    }


    // ─────────────────────────────────────────────
    // [4] BIND DE UM ELEMENTO
    // Amarra ozi:change → Livewire (componente OZI é a fonte da verdade)
    // ─────────────────────────────────────────────

    function _bindElement(el, plugin) {
        if (!el || el.getAttribute(ATTR.bound)) return;
        el.setAttribute(ATTR.bound, '1');

        var modelProp  = el.getAttribute(ATTR.model);
        var textProp   = el.getAttribute(ATTR.textModel);
        var optEvent   = el.getAttribute(ATTR.optionsEvent);
        var initValue  = el.getAttribute(ATTR.value);
        var nativeAttr = el.getAttribute(ATTR.native);   // v2 — modo wire:model nativo

        // suporta: optionsEvent sem model (ex: ozi-search recebe itens sem sync de valor);
        // e modo nativo (wire:model) sem model.
        if (!modelProp && !optEvent && nativeAttr === null) return;

        // — valor inicial — (só quando há model)
        if (modelProp && !_isBlank(initValue)) {
            var parsed = _parseJsonSafe(initValue, initValue);
            setTimeout(function () {
                try { plugin.setValue(el, parsed); } catch (e) {}
            }, 0);
        }

        // — ozi:change → Livewire — (modo A nativo e/ou modo B component.set)
        if (modelProp || nativeAttr !== null) {
            el.addEventListener(plugin.changeEvent || 'ozi:change', function (e) {
                // v2 (contrato §1.3): source:'api' = mudança programática (setValue,
                // tipicamente originada do próprio Livewire) — não repropaga, senão
                // vira loop wire:model → setValue → ozi:change → set.
                if (e.detail && e.detail.source === 'api') return;

                var inst = plugin.getInstance(el);
                if (!inst) return;

                var value    = plugin.getValue(inst);
                var valueStr = _stableStr(value);

                // guard secundário: só propaga se o valor realmente mudou
                if (el.getAttribute(ATTR.lastValue) === valueStr) return;
                el.setAttribute(ATTR.lastValue, valueStr);

                _propagate(el, modelProp, textProp, value, e.detail);
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
                      plugin.selector + '[' + ATTR.optionsEvent + '],' +
                      plugin.selector + '[' + ATTR.native + ']';
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
    // [6b] RODAPÉ DO OZI-SELECT — data-ozi-select-footer-call → component.call()
    // O botão de rodapé (ozi-select v6.2.0) emite `ozi:select-footer` (bubbles). Se o root do
    // select declarar `data-ozi-select-footer-call="metodo"`, chamamos o método no componente
    // Livewire ancestral. Framework isolado aqui — o componente só emite o evento neutro (R6).
    // ─────────────────────────────────────────────

    document.addEventListener('ozi:select-footer', function (e) {
        var el = e.target;
        if (!el || !el.getAttribute) return;
        var method = el.getAttribute('data-ozi-select-footer-call');
        if (!method) return;
        var comp = _getComponent(el);
        if (!comp || typeof comp.call !== 'function') return;
        try { comp.call(method); }
        catch (err) { console.warn('[OZI:livewire] footer-call falhou:', err.message); }
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
