/**
 * ------------------------------------------
 * ozi-toggle
 * ------------------------------------------
 * Ver: 3.0.0
 * 2026-07-03
 *
 *
 *
 * Responsabilidade:
 *   - Show/hide declarativo de conteúdo via trigger
 *   - Indicadores visuais de estado no trigger (show/hide elements)
 *   - Animação de ícone coordenada com fade na troca de estado
 *   - Slide animado opcional via data-ozi-toggle-options no content
 *   - ARIA: aria-expanded, aria-hidden, aria-controls
 *   - Eventos: ozi:toggle-open, ozi:toggle-close, ozi:toggle-change
 *
 * Atributos [1] Estrutura:
 *   data-ozi-toggle-trigger="id"   <- gatilho do toggle
 *   data-ozi-toggle-content="id"   <- conteudo a alternar
 *
 * Atributos [2] Indicadores visuais no trigger:
 *   data-ozi-toggle-show           <- visivel quando content esta OCULTO
 *   data-ozi-toggle-hide           <- visivel quando content esta VISIVEL
 *   data-ozi-toggle-icon           <- anima com fade na troca de estado
 *
 * Atributos [3] Animação — colocado no CONTENT:
 *   data-ozi-toggle-options="slide-time:600;"  <- ativa slide animado
 *
 * Dependencias: ozi.js (OZI.hooks, OZI.helpers) — zero jQuery (contrato de camadas v2).
 * Expoe: OZI.behaviors.toggle, window.OziToggle (compat)
 *        window.oziToggleToggle/Open/Close/Sync (compat v0.x)
 *
 * Changelog:
 *   - v3.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Coleta/estado via querySelectorAll, closest, classList, style.display —
 *         zero jQuery no motor.
 *       - Slide (slideDown/slideUp) e fade de icone reimplementados com a Web
 *         Animations API (Element.animate) — mede scrollHeight/opacity atual e
 *         anima entre valores explicitos; substitui $.animate/slideDown/slideUp.
 *       - ':visible' do jQuery substituido por isVisible() (offsetWidth/Height/
 *         getClientRects — mesma heuristica usada internamente pelo jQuery).
 *       - Fim do dual-dispatch: _emit() usa somente OZI.helpers.emit() (CustomEvent
 *         nativo com bubbles+detail no contrato v2). Nomes ozi:toggle-* preservados;
 *         nenhum shim necessario (inventario F0: ozi:toggle-* nao e consumido no
 *         Central RH).
 *       - Delegacao de clique nativa em document (closest() no lugar de $.on
 *         delegado).
 *       - API publica inalterada: OZI.behaviors.toggle.{open,close,toggle,sync,
 *         syncAll} + aliases globais de compat v0.x.
 *   - v2.0.1: Corrigido: resolveOptions restaurado da v1.2.0 — le do $content com flag hasOptions
 *     (v1.0.0 lia do trigger primeiro, perdendo o atributo no content)
 *   - Corrigido: $content.stop(true,true) restaurado antes de slideDown/slideUp
 *   - Corrigido: runBatch restaurado para coordenar multiplos contents
 *   - Corrigido: animacao de icone coordenada restaurada da v1.2.0
 *     (fade-out icone atual -> troca estado -> fade-in icone novo)
 *   - Mantido: aria-controls, aria-expanded, aria-hidden da v1.0.0
 *   - Mantido: eventos ozi:toggle-open, ozi:toggle-close, ozi:toggle-change
 *   - Mantido: hook OZI.hooks.afterRender com root scoped
 *   - Mantido: aliases oziToggleToggle/Open/Close/Sync
 */

(function (window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD - Singleton
    // ---------------------------------------------

    if (window.OziToggle) return;


    // ---------------------------------------------
    // [2] SELETORES E ATTRS
    // ---------------------------------------------

    var SELECTORS = {
        trigger: '[data-ozi-toggle-trigger]',
        content: '[data-ozi-toggle-content]',
        show:    '[data-ozi-toggle-show]',
        hide:    '[data-ozi-toggle-hide]',
        icon:    '[data-ozi-toggle-icon]'
    };

    var ATTRS = {
        trigger: 'data-ozi-toggle-trigger',
        content: 'data-ozi-toggle-content',
        options: 'data-ozi-toggle-options'
    };

    var DEFAULTS = {
        slideTime:    600,
        iconFadeTime: 280
    };


    // ---------------------------------------------
    // [3] UTILITARIO
    // ---------------------------------------------

    function str(value) {
        return String(value == null ? '' : value).trim();
    }

    // heuristica equivalente ao jQuery :visible — sem depender de layout forçado extra
    function isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
    }


    // ---------------------------------------------
    // [4] COLETA DE ELEMENTOS
    // ---------------------------------------------

    function getTriggersById(id) {
        id = str(id);
        return Array.prototype.filter.call(
            document.querySelectorAll(SELECTORS.trigger),
            function (el) { return str(el.getAttribute(ATTRS.trigger)) === id; }
        );
    }

    function getContentsById(id) {
        id = str(id);
        return Array.prototype.filter.call(
            document.querySelectorAll(SELECTORS.content),
            function (el) { return str(el.getAttribute(ATTRS.content)) === id; }
        );
    }


    // ---------------------------------------------
    // [5] PARSE DE OPCOES
    // Le do content com flag hasOptions.
    // ---------------------------------------------

    function parseOptions(rawOptions) {
        var options = {};
        if (!rawOptions) return options;

        String(rawOptions).split(';').forEach(function (part) {
            var item = str(part);
            if (!item) return;

            var sep = item.indexOf(':');
            if (sep === -1) return;

            var key = str(item.slice(0, sep)).toLowerCase();
            var val = str(item.slice(sep + 1));
            if (key) options[key] = val;
        });

        return options;
    }

    function resolveOptions(content) {
        var rawOptions = str(content.getAttribute(ATTRS.options));

        if (!rawOptions) {
            return { hasOptions: false, slideTime: DEFAULTS.slideTime };
        }

        var parsed    = parseOptions(rawOptions);
        var slideTime = parseInt(parsed['slide-time'], 10);

        if (isNaN(slideTime)) slideTime = DEFAULTS.slideTime;

        return { hasOptions: true, slideTime: slideTime };
    }


    // ---------------------------------------------
    // [6] RUNBATCH
    // Coordena callbacks em colecoes de Elements.
    // ---------------------------------------------

    function runBatch(items, callbackItem, callbackEnd) {
        var total     = items.length;
        var doneCount = 0;

        if (!total) {
            if (typeof callbackEnd === 'function') callbackEnd();
            return;
        }

        Array.prototype.forEach.call(items, function (item) {
            callbackItem(item, function () {
                doneCount++;
                if (doneCount >= total && typeof callbackEnd === 'function') {
                    callbackEnd();
                }
            });
        });
    }


    // ---------------------------------------------
    // [7] ARIA
    // ---------------------------------------------

    function syncContentAria(id) {
        getContentsById(id).forEach(function (el) {
            el.setAttribute('aria-hidden', isVisible(el) ? 'false' : 'true');
        });
    }


    // ---------------------------------------------
    // [8] INDICADORES VISUAIS DO TRIGGER
    // ---------------------------------------------

    function getTriggerIndicatorState(trigger) {
        var showEl = trigger.querySelector(SELECTORS.show);
        var hideEl = trigger.querySelector(SELECTORS.hide);

        var showVisible = showEl ? isVisible(showEl) : false;
        var hideVisible = hideEl ? isVisible(hideEl) : false;

        if (showVisible && !hideVisible) return 'show';
        if (hideVisible && !showVisible) return 'hide';
        if (showEl && !hideEl) return 'show';
        if (hideEl && !showEl) return 'hide';
        return 'show';
    }

    function applyTriggerIndicatorState(trigger, id, state) {
        var showEls = trigger.querySelectorAll(SELECTORS.show);
        var hideEls = trigger.querySelectorAll(SELECTORS.hide);

        Array.prototype.forEach.call(showEls, function (el) { el.style.display = (state === 'show') ? '' : 'none'; });
        Array.prototype.forEach.call(hideEls, function (el) { el.style.display = (state === 'hide') ? '' : 'none'; });

        // aria-expanded e aria-controls (adicionado v1.0.0)
        trigger.setAttribute('aria-expanded', state === 'hide' ? 'true' : 'false');
        trigger.setAttribute('aria-controls', id);
    }

    function updateIndicators(id, state) {
        var triggers = getTriggersById(id);

        if (!triggers.length) {
            syncContentAria(id);
            return;
        }

        if (state !== 'show' && state !== 'hide') {
            state = getTriggerIndicatorState(triggers[0]);
        }

        triggers.forEach(function (trigger) {
            applyTriggerIndicatorState(trigger, id, state);
        });

        syncContentAria(id);
    }


    // ---------------------------------------------
    // [9] ANIMACAO — Web Animations API
    // Mede o valor atual (scrollHeight/opacity) e anima
    // entre valores explicitos; substitui $.animate/slideDown/slideUp.
    // ---------------------------------------------

    var _slideAnimations = new WeakMap();
    var _fadeAnimations   = new WeakMap();

    function _runAnimation(registry, el, keyframes, duration, onFinish) {
        var prev = registry.get(el);
        if (prev) { try { prev.cancel(); } catch (e) {} }

        if (typeof el.animate !== 'function') {
            onFinish();
            return;
        }

        var anim = el.animate(keyframes, { duration: duration, easing: 'ease', fill: 'none' });
        registry.set(el, anim);
        anim.onfinish = function () {
            registry.delete(el);
            onFinish();
        };
    }

    function _slideDown(el, duration, done) {
        el.style.display  = '';
        el.style.overflow = 'hidden';
        var target = el.scrollHeight;

        _runAnimation(_slideAnimations, el, [{ height: '0px' }, { height: target + 'px' }], duration, function () {
            el.style.overflow = '';
            el.style.height   = '';
            if (typeof done === 'function') done();
        });
    }

    function _slideUp(el, duration, done) {
        el.style.overflow = 'hidden';
        var start = el.scrollHeight;

        _runAnimation(_slideAnimations, el, [{ height: start + 'px' }, { height: '0px' }], duration, function () {
            el.style.display = 'none';
            el.style.overflow = '';
            el.style.height   = '';
            if (typeof done === 'function') done();
        });
    }

    function _fade(el, fromOpacity, toOpacity, duration, done) {
        if (typeof fromOpacity === 'number') el.style.opacity = String(fromOpacity);
        var from = (typeof fromOpacity === 'number')
            ? fromOpacity
            : parseFloat(window.getComputedStyle(el).opacity || '1');

        _runAnimation(_fadeAnimations, el, [{ opacity: from }, { opacity: toOpacity }], duration, function () {
            el.style.opacity = (toOpacity === 1) ? '' : String(toOpacity);
            if (typeof done === 'function') done();
        });
    }


    // ---------------------------------------------
    // [10] ANIMACAO DE ICONE
    // fade-out icone atual -> troca estado -> fade-in icone novo
    // ---------------------------------------------

    function getTriggerStateElement(trigger, state) {
        return state === 'hide'
            ? trigger.querySelector(SELECTORS.hide)
            : trigger.querySelector(SELECTORS.show);
    }

    function animateOpacityBatch(elements, fromOpacity, toOpacity, done) {
        var els = elements ? Array.prototype.slice.call(elements) : [];

        if (!els.length) {
            if (typeof done === 'function') done();
            return;
        }

        runBatch(
            els,
            function (el, next) {
                _fade(el, fromOpacity, toOpacity, DEFAULTS.iconFadeTime, next);
            },
            done
        );
    }

    function animateTriggerIndicatorState(trigger, id, state, done) {
        var currentState = getTriggerIndicatorState(trigger);

        if (state !== 'show' && state !== 'hide') {
            state = currentState === 'show' ? 'hide' : 'show';
        }

        // ja esta no estado correto
        if (currentState === state) {
            applyTriggerIndicatorState(trigger, id, state);
            if (typeof done === 'function') done();
            return;
        }

        var currentEl    = getTriggerStateElement(trigger, currentState);
        var nextEl       = getTriggerStateElement(trigger, state);
        var currentIcons = currentEl ? currentEl.querySelectorAll(SELECTORS.icon) : [];
        var nextIcons    = nextEl    ? nextEl.querySelectorAll(SELECTORS.icon)    : [];

        // sem icones — aplica direto
        if (!currentIcons.length && !nextIcons.length) {
            applyTriggerIndicatorState(trigger, id, state);
            if (typeof done === 'function') done();
            return;
        }

        // fade-out icone atual -> troca -> fade-in icone novo
        animateOpacityBatch(currentIcons, null, 0, function () {
            applyTriggerIndicatorState(trigger, id, state);
            animateOpacityBatch(nextIcons, 0, 1, function () {
                if (typeof done === 'function') done();
            });
        });
    }

    function animateIndicators(id, state) {
        var triggers = getTriggersById(id);

        if (!triggers.length) {
            syncContentAria(id);
            return;
        }

        if (state !== 'show' && state !== 'hide') {
            state = getTriggerIndicatorState(triggers[0]) === 'show' ? 'hide' : 'show';
        }

        runBatch(
            triggers,
            function (trigger, next) {
                animateTriggerIndicatorState(trigger, id, state, next);
            },
            function () {
                syncContentAria(id);
            }
        );
    }


    // ---------------------------------------------
    // [11] SHOW / HIDE DO CONTENT
    // ---------------------------------------------

    function applyShow(content, done) {
        var opts = resolveOptions(content);

        if (opts.hasOptions) {
            _slideDown(content, opts.slideTime, done);
            return;
        }

        content.style.display = '';
        if (typeof done === 'function') done();
    }

    function applyHide(content, done) {
        var opts = resolveOptions(content);

        if (opts.hasOptions) {
            _slideUp(content, opts.slideTime, done);
            return;
        }

        content.style.display = 'none';
        if (typeof done === 'function') done();
    }

    function invertContentState(content, done) {
        if (isVisible(content)) {
            applyHide(content, done);
        } else {
            applyShow(content, done);
        }
    }


    // ---------------------------------------------
    // [12] OPEN / CLOSE / TOGGLE
    // ---------------------------------------------

    function open(id) {
        id = str(id);
        if (!id) return;

        var contents = getContentsById(id);
        if (!contents.length) return;

        runBatch(
            contents,
            function (content, next) {
                if (isVisible(content)) { next(); return; }
                applyShow(content, next);
            },
            function () {
                animateIndicators(id, 'hide');
                _emit(id, 'ozi:toggle-open', { open: true });
                _emit(id, 'ozi:toggle-change', { open: true });
            }
        );
    }

    function close(id) {
        id = str(id);
        if (!id) return;

        var contents = getContentsById(id);
        if (!contents.length) return;

        runBatch(
            contents,
            function (content, next) {
                if (!isVisible(content)) { next(); return; }
                applyHide(content, next);
            },
            function () {
                animateIndicators(id, 'show');
                _emit(id, 'ozi:toggle-close', { open: false });
                _emit(id, 'ozi:toggle-change', { open: false });
            }
        );
    }

    function toggle(id) {
        id = str(id);
        if (!id) return;

        var contents = getContentsById(id);
        if (!contents.length) return;

        runBatch(
            contents,
            function (content, next) {
                invertContentState(content, next);
            },
            function () {
                animateIndicators(id);
                // estado final lido do DOM apos animacao
                var isOpen = isVisible(getContentsById(id)[0]);
                _emit(id, isOpen ? 'ozi:toggle-open' : 'ozi:toggle-close', { open: isOpen });
                _emit(id, 'ozi:toggle-change', { open: isOpen });
            }
        );
    }


    // ---------------------------------------------
    // [13] SYNC
    // ---------------------------------------------

    function syncGroup(id) {
        id = str(id);
        if (!id) return;
        if (!getContentsById(id).length) return;

        var triggers = getTriggersById(id);

        if (triggers.length) {
            updateIndicators(id, getTriggerIndicatorState(triggers[0]));
            return;
        }

        syncContentAria(id);
    }

    function syncAllGroups(root) {
        var scope     = root || document;
        var processed = {};

        var all = scope.querySelectorAll(SELECTORS.trigger + ', ' + SELECTORS.content);
        Array.prototype.forEach.call(all, function (el) {
            var id = str(el.getAttribute(ATTRS.trigger) || el.getAttribute(ATTRS.content));
            if (!id || processed[id]) return;
            processed[id] = true;
            syncGroup(id);
        });
    }


    // ---------------------------------------------
    // [14] EMIT — contrato v2, sem dual-dispatch
    // Nomes ozi:toggle-* preservados; inventario F0 confirma
    // que nenhum consumidor escuta ozi:toggle-* — sem shim.
    // ---------------------------------------------

    function _emit(id, eventName, extra) {
        extra = extra || {};

        var triggers = getTriggersById(id);
        var contents = getContentsById(id);
        var origin   = triggers[0] || contents[0] || document;

        var detail = {
            component: 'ozi-toggle',
            name:      id,
            value:     ('open' in extra) ? extra.open : null,
            source:    'user',
            id:        id
        };
        if ('open' in extra) detail.open = extra.open;

        var helpers = window.OZI && window.OZI.helpers;
        if (helpers && typeof helpers.emit === 'function') {
            helpers.emit(origin, eventName, detail);
        } else if (typeof CustomEvent === 'function') {
            origin.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: detail }));
        }
    }


    // ---------------------------------------------
    // [15] BIND - delegacao nativa no document
    // ---------------------------------------------

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest(SELECTORS.trigger);
        if (!trigger) return;
        var id = str(trigger.getAttribute(ATTRS.trigger));
        if (!id) return;
        e.preventDefault();
        toggle(id);
    });


    // ---------------------------------------------
    // [16] API PUBLICA - OZI.behaviors.toggle
    // ---------------------------------------------

    var toggleBehavior = {
        open:    open,
        close:   close,
        toggle:  toggle,
        sync:    syncGroup,
        syncAll: syncAllGroups
    };


    // alias objeto v0.x — exposto imediatamente (sem depender do OZI)
    window.OziToggle = toggleBehavior;

    // aliases funcoes soltas v0.x
    window.oziToggleToggle = toggle;
    window.oziToggleOpen   = open;
    window.oziToggleClose  = close;
    window.oziToggleSync   = function (id) {
        if (typeof id === 'undefined' || id === null || str(id) === '') {
            syncAllGroups();
        } else {
            syncGroup(id);
        }
    };


    // ---------------------------------------------
    // [17] AUTO-INIT E HOOKS
    // ---------------------------------------------

    // registro de namespace e hook — feito direto (core zero-jQuery ja garante
    // DOM parseado ao carregar este script depois de ozi.js).
    // syncAllGroups nao e chamado aqui — a fonte 'dom' do ozi-hooks ja dispara
    // afterRender no DOMContentLoaded, evitando chamada dupla no carregamento inicial.
    function _expose() {
        if (window.OZI && window.OZI.behaviors) {
            window.OZI.behaviors.toggle = toggleBehavior;
        }

        // hook registrado apos o boot — garante que ozi.js ja bootou
        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('behavior:toggle', function (root) {
                syncAllGroups(root);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _expose);
    } else {
        _expose();
    }

})(window, document);
