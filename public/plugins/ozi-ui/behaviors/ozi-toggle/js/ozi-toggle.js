/**
 * ------------------------------------------
 * ozi-toggle
 * ------------------------------------------
 * Ver: 2.0.1
 * 2026-05-27
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
 *   data-ozi-toggle-options="slide-time:600;"  <- ativa slideDown/slideUp
 *
 * Dependencias: ozi.js (OZI.hooks)
 * Expoe: OZI.behaviors.toggle, window.OziToggle (compat)
 *        window.oziToggleToggle/Open/Close/Sync (compat v0.x)
 *
 * Changelog v1.0.1:
 *   - Corrigido: resolveOptions restaurado da v1.2.0 — le do $content com flag hasOptions
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

(function ($, window, document) {
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


    // ---------------------------------------------
    // [4] COLETA DE ELEMENTOS
    // ---------------------------------------------

    function getTriggersById(id) {
        id = str(id);
        return $(SELECTORS.trigger).filter(function () {
            return str($(this).attr(ATTRS.trigger)) === id;
        });
    }

    function getContentsById(id) {
        id = str(id);
        return $(SELECTORS.content).filter(function () {
            return str($(this).attr(ATTRS.content)) === id;
        });
    }


    // ---------------------------------------------
    // [5] PARSE DE OPCOES
    // Le do $content com flag hasOptions.
    // Restaurado da v1.2.0 — v1.0.0 lia do trigger e perdia o atributo.
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

    function resolveOptions($content) {
        var rawOptions = str($content.attr(ATTRS.options));

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
    // Coordena callbacks em colecoes jQuery.
    // Restaurado da v1.2.0.
    // ---------------------------------------------

    function runBatch($items, callbackItem, callbackEnd) {
        var total     = $items.length;
        var doneCount = 0;

        if (!total) {
            if (typeof callbackEnd === 'function') callbackEnd();
            return;
        }

        $items.each(function () {
            callbackItem($(this), function () {
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
        getContentsById(id).each(function () {
            var $c = $(this);
            $c.attr('aria-hidden', $c.is(':visible') ? 'false' : 'true');
        });
    }


    // ---------------------------------------------
    // [8] INDICADORES VISUAIS DO TRIGGER
    // ---------------------------------------------

    function getTriggerIndicatorState($trigger) {
        var $show = $trigger.find(SELECTORS.show).first();
        var $hide = $trigger.find(SELECTORS.hide).first();

        var showVisible = $show.length ? $show.is(':visible') : false;
        var hideVisible = $hide.length ? $hide.is(':visible') : false;

        if (showVisible && !hideVisible) return 'show';
        if (hideVisible && !showVisible) return 'hide';
        if ($show.length && !$hide.length) return 'show';
        if ($hide.length && !$show.length) return 'hide';
        return 'show';
    }

    function applyTriggerIndicatorState($trigger, id, state) {
        var $show = $trigger.find(SELECTORS.show);
        var $hide = $trigger.find(SELECTORS.hide);

        if ($show.length) $show.toggle(state === 'show');
        if ($hide.length) $hide.toggle(state === 'hide');

        // aria-expanded e aria-controls (adicionado v1.0.0)
        $trigger
            .attr('aria-expanded', state === 'hide' ? 'true' : 'false')
            .attr('aria-controls', id);
    }

    function updateIndicators(id, state) {
        var $triggers = getTriggersById(id);

        if (!$triggers.length) {
            syncContentAria(id);
            return;
        }

        if (state !== 'show' && state !== 'hide') {
            state = getTriggerIndicatorState($triggers.first());
        }

        $triggers.each(function () {
            applyTriggerIndicatorState($(this), id, state);
        });

        syncContentAria(id);
    }


    // ---------------------------------------------
    // [9] ANIMACAO DE ICONE
    // fade-out icone atual -> troca estado -> fade-in icone novo
    // Restaurado da v1.2.0.
    // ---------------------------------------------

    function getTriggerStateElement($trigger, state) {
        return state === 'hide'
            ? $trigger.find(SELECTORS.hide).first()
            : $trigger.find(SELECTORS.show).first();
    }

    function animateOpacityBatch($elements, fromOpacity, toOpacity, done) {
        if (!$elements.length) {
            if (typeof done === 'function') done();
            return;
        }

        if (typeof fromOpacity === 'number') {
            $elements.css('opacity', fromOpacity);
        }

        runBatch(
            $elements,
            function ($el, next) {
                $el.stop(true, true).animate({ opacity: toOpacity }, DEFAULTS.iconFadeTime, function () {
                    if (toOpacity === 1) $el.css('opacity', '');
                    next();
                });
            },
            done
        );
    }

    function animateTriggerIndicatorState($trigger, id, state, done) {
        var currentState   = getTriggerIndicatorState($trigger);
        var $currentEl, $nextEl, $currentIcons, $nextIcons;

        if (state !== 'show' && state !== 'hide') {
            state = currentState === 'show' ? 'hide' : 'show';
        }

        // ja esta no estado correto
        if (currentState === state) {
            applyTriggerIndicatorState($trigger, id, state);
            if (typeof done === 'function') done();
            return;
        }

        $currentEl    = getTriggerStateElement($trigger, currentState);
        $nextEl       = getTriggerStateElement($trigger, state);
        $currentIcons = $currentEl.find(SELECTORS.icon);
        $nextIcons    = $nextEl.find(SELECTORS.icon);

        // sem icones — aplica direto
        if (!$currentIcons.length && !$nextIcons.length) {
            applyTriggerIndicatorState($trigger, id, state);
            if (typeof done === 'function') done();
            return;
        }

        // fade-out icone atual -> troca -> fade-in icone novo
        animateOpacityBatch($currentIcons, null, 0, function () {
            applyTriggerIndicatorState($trigger, id, state);
            animateOpacityBatch($nextIcons, 0, 1, function () {
                if (typeof done === 'function') done();
            });
        });
    }

    function animateIndicators(id, state) {
        var $triggers = getTriggersById(id);

        if (!$triggers.length) {
            syncContentAria(id);
            return;
        }

        if (state !== 'show' && state !== 'hide') {
            state = getTriggerIndicatorState($triggers.first()) === 'show' ? 'hide' : 'show';
        }

        runBatch(
            $triggers,
            function ($trigger, next) {
                animateTriggerIndicatorState($trigger, id, state, next);
            },
            function () {
                syncContentAria(id);
            }
        );
    }


    // ---------------------------------------------
    // [10] SHOW / HIDE DO CONTENT
    // $content.stop(true,true) restaurado da v1.2.0.
    // ---------------------------------------------

    function applyShow($content, done) {
        var opts = resolveOptions($content);

        $content.stop(true, true);

        if (opts.hasOptions) {
            $content.slideDown(opts.slideTime, function () {
                if (typeof done === 'function') done();
            });
            return;
        }

        $content.show();
        if (typeof done === 'function') done();
    }

    function applyHide($content, done) {
        var opts = resolveOptions($content);

        $content.stop(true, true);

        if (opts.hasOptions) {
            $content.slideUp(opts.slideTime, function () {
                if (typeof done === 'function') done();
            });
            return;
        }

        $content.hide();
        if (typeof done === 'function') done();
    }

    function invertContentState($content, done) {
        if ($content.is(':visible')) {
            applyHide($content, done);
        } else {
            applyShow($content, done);
        }
    }


    // ---------------------------------------------
    // [11] OPEN / CLOSE / TOGGLE
    // ---------------------------------------------

    function open(id) {
        id = str(id);
        if (!id) return;

        var $contents = getContentsById(id);
        if (!$contents.length) return;

        runBatch(
            $contents,
            function ($content, next) {
                if ($content.is(':visible')) { next(); return; }
                applyShow($content, next);
            },
            function () {
                animateIndicators(id, 'hide');
                _emit(id, 'ozi:toggle-open');
                _emit(id, 'ozi:toggle-change', { open: true });
            }
        );
    }

    function close(id) {
        id = str(id);
        if (!id) return;

        var $contents = getContentsById(id);
        if (!$contents.length) return;

        runBatch(
            $contents,
            function ($content, next) {
                if (!$content.is(':visible')) { next(); return; }
                applyHide($content, next);
            },
            function () {
                animateIndicators(id, 'show');
                _emit(id, 'ozi:toggle-close');
                _emit(id, 'ozi:toggle-change', { open: false });
            }
        );
    }

    function toggle(id) {
        id = str(id);
        if (!id) return;

        var $contents = getContentsById(id);
        if (!$contents.length) return;

        runBatch(
            $contents,
            function ($content, next) {
                invertContentState($content, next);
            },
            function () {
                animateIndicators(id);
                // estado final lido do DOM apos animacao
                var isOpen = getContentsById(id).first().is(':visible');
                _emit(id, isOpen ? 'ozi:toggle-open'  : 'ozi:toggle-close');
                _emit(id, 'ozi:toggle-change', { open: isOpen });
            }
        );
    }


    // ---------------------------------------------
    // [12] SYNC
    // ---------------------------------------------

    function syncGroup(id) {
        id = str(id);
        if (!id) return;
        if (!getContentsById(id).length) return;

        var $triggers = getTriggersById(id);

        if ($triggers.length) {
            updateIndicators(id, getTriggerIndicatorState($triggers.first()));
            return;
        }

        syncContentAria(id);
    }

    function syncAllGroups(root) {
        var $scope    = root ? $(root) : $(document);
        var processed = {};

        $scope.find(SELECTORS.trigger + ', ' + SELECTORS.content).each(function () {
            var $el = $(this);
            var id  = str($el.attr(ATTRS.trigger) || $el.attr(ATTRS.content));
            if (!id || processed[id]) return;
            processed[id] = true;
            syncGroup(id);
        });
    }


    // ---------------------------------------------
    // [13] EMIT
    // ---------------------------------------------

    function _emit(id, eventName, payload) {
        payload      = payload || {};
        payload.id   = id;

        var $trigger = getTriggersById(id);
        var $content = getContentsById(id);

        $trigger.add($content).first().trigger(eventName, [payload]);

        if (typeof CustomEvent === 'function') {
            document.dispatchEvent(new CustomEvent(eventName, {
                bubbles: true, detail: payload
            }));
        }
    }


    // ---------------------------------------------
    // [14] BIND - delegacao no document
    // ---------------------------------------------

    $(document)
        .off('click.oziToggle', SELECTORS.trigger)
        .on( 'click.oziToggle', SELECTORS.trigger, function (e) {
            var id = str($(this).attr(ATTRS.trigger));
            if (!id) return;
            e.preventDefault();
            toggle(id);
        });


    // ---------------------------------------------
    // [15] API PUBLICA - OZI.behaviors.toggle
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

    // DOMReady: registro de namespace e hook
    // syncAllGroups removido aqui — a fonte 'dom' do ozi-hooks ja dispara afterRender
    // no DOMContentLoaded, evitando chamada dupla no carregamento inicial.
    $(function () {
        if (window.OZI && window.OZI.behaviors) {
            window.OZI.behaviors.toggle = toggleBehavior;
        }

        // hook registrado dentro do DOMReady — garante que ozi.js ja bootou
        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('behavior:toggle', function (root) {
                syncAllGroups(root);
            });
        }
    });

})(jQuery, window, document);