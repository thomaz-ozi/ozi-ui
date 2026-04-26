// ozi-collapse v1
// Alterna sempre entre dois conteúdos do mesmo grupo.
// Compatível com jQuery 3.x e preparado para jQuery 4.x.
(function ($) {
    'use strict';

    var SELECTORS = {
        trigger: '[data-ozi-collapse-trigger]',
        content: '[data-ozi-collapse-content]',
        open: '[data-ozi-collapse-open]',
        close: '[data-ozi-collapse-close]'
    };

    var ATTRS = {
        trigger: 'data-ozi-collapse-trigger',
        content: 'data-ozi-collapse-content',
        options: 'data-ozi-collapse-options'
    };

    var DEFAULTS = {
        effect: 'none',
        slideTime: 600,
        fadeTime: 600
    };

    function getIdFromTrigger($trigger) {
        return String($trigger.attr(ATTRS.trigger) || '').trim();
    }

    function getTriggersById(id) {
        id = String(id || '').trim();

        return $(SELECTORS.trigger).filter(function () {
            return String($(this).attr(ATTRS.trigger) || '').trim() === id;
        });
    }

    function getContentsById(id) {
        id = String(id || '').trim();

        return $(SELECTORS.content).filter(function () {
            return String($(this).attr(ATTRS.content) || '').trim() === id;
        });
    }

    function warnInvalidGroup(id, count) {
        if (window.console && typeof window.console.warn === 'function') {
            window.console.warn(
                'oziCollapse: o grupo "' + id + '" precisa ter exatamente 2 conteúdos, mas encontrou ' + count + '. Grupo ignorado.'
            );
        }
    }

    function validateGroup(id) {
        var $contents = getContentsById(id);

        if ($contents.length !== 2) {
            warnInvalidGroup(id, $contents.length);
            return false;
        }

        return true;
    }

    function normalizeGroupState(id) {
        var $contents = getContentsById(id);
        var visibleCount = 0;

        if ($contents.length !== 2) {
            return false;
        }

        $contents.each(function () {
            if ($(this).is(':visible')) {
                visibleCount++;
            }
        });

        if (visibleCount !== 1) {
            $($contents[0]).stop(true, true).show();
            $($contents[1]).stop(true, true).hide();
        }

        return true;
    }

    function getVisibleIndex($contents) {
        var visibleIndex = -1;

        $contents.each(function (index) {
            if ($(this).is(':visible')) {
                visibleIndex = index;
                return false;
            }
        });

        return visibleIndex;
    }

    function getCurrentAndNext(id) {
        var $contents = getContentsById(id);
        var visibleIndex;

        if ($contents.length !== 2) {
            return null;
        }

        normalizeGroupState(id);
        visibleIndex = getVisibleIndex($contents);

        if (visibleIndex === -1) {
            visibleIndex = 0;
        }

        return {
            $contents: $contents,
            currentIndex: visibleIndex,
            nextIndex: visibleIndex === 0 ? 1 : 0,
            $current: $contents.eq(visibleIndex),
            $next: $contents.eq(visibleIndex === 0 ? 1 : 0)
        };
    }

    function parseOptions(rawOptions) {
        var options = {};

        if (!rawOptions) {
            return options;
        }

        String(rawOptions)
            .split(';')
            .forEach(function (part) {
                var item = String(part || '').trim();
                var separatorIndex;
                var key;
                var value;

                if (!item) {
                    return;
                }

                separatorIndex = item.indexOf(':');

                if (separatorIndex === -1) {
                    return;
                }

                key = String(item.slice(0, separatorIndex) || '').trim();
                value = String(item.slice(separatorIndex + 1) || '').trim();

                if (!key) {
                    return;
                }

                options[key] = value;
            });

        return options;
    }

    function resolveOptions($content) {
        var rawOptions = $content.attr(ATTRS.options);
        var parsed = parseOptions(rawOptions);
        var hasOptions = !!String(rawOptions || '').trim();
        var effect = String(parsed.effect || DEFAULTS.effect).trim().toLowerCase();
        var slideTime = parseInt(parsed['effect-slide-time'], 10);
        var fadeTime = parseInt(parsed['effect-fade-time'], 10);

        if (isNaN(slideTime)) {
            slideTime = DEFAULTS.slideTime;
        }

        if (isNaN(fadeTime)) {
            fadeTime = DEFAULTS.fadeTime;
        }

        return {
            hasOptions: hasOptions,
            effect: effect,
            slideTime: slideTime,
            fadeTime: fadeTime
        };
    }

    function syncIndicators(id) {
        var $triggers = getTriggersById(id);
        var state = getCurrentAndNext(id);
        var isInitialState;

        if (!state) {
            return;
        }

        isInitialState = state.currentIndex === 0;

        $triggers.each(function () {
            var $trigger = $(this);
            var $open = $trigger.find(SELECTORS.open);
            var $close = $trigger.find(SELECTORS.close);

            if ($open.length) {
                $open.toggle(isInitialState);
            }

            if ($close.length) {
                $close.toggle(!isInitialState);
            }
        });
    }

    function applyTransition($current, $next, options, done) {
        var finish = typeof done === 'function' ? done : function () {};

        $current.stop(true, true);
        $next.stop(true, true);

        if (!options.hasOptions || !options.effect || options.effect === 'none') {
            $current.hide();
            $next.show();
            finish();
            return;
        }

        if (options.effect === 'slide') {
            $current.slideUp(options.slideTime, function () {
                $next.slideDown(options.slideTime, function () {
                    finish();
                });
            });
            return;
        }

        if (options.effect === 'fade') {
            $current.fadeOut(options.fadeTime, function () {
                $next.fadeIn(options.fadeTime, function () {
                    finish();
                });
            });
            return;
        }

        if (options.effect === 'slidefade') {
            $current.fadeOut(options.fadeTime, function () {
                $next
                    .stop(true, true)
                    .hide()
                    .css('opacity', 0)
                    .slideDown(options.slideTime, function () {
                        $(this).animate({ opacity: 1 }, options.fadeTime, function () {
                            finish();
                        });
                    });
            });
            return;
        }

        $current.hide();
        $next.show();
        finish();
    }

    function toggleGroup(id) {
        var state;
        var options;

        id = String(id || '').trim();

        if (!id) {
            return;
        }

        if (!validateGroup(id)) {
            return;
        }

        state = getCurrentAndNext(id);

        if (!state) {
            return;
        }

        options = resolveOptions(state.$next);

        applyTransition(state.$current, state.$next, options, function () {
            syncIndicators(id);
        });
    }

    function syncAllGroups() {
        var processed = {};

        $(SELECTORS.trigger).each(function () {
            var id = String($(this).attr(ATTRS.trigger) || '').trim();

            if (!id || processed[id]) {
                return;
            }

            processed[id] = true;

            if (!validateGroup(id)) {
                return;
            }

            normalizeGroupState(id);
            syncIndicators(id);
        });

        $(SELECTORS.content).each(function () {
            var id = String($(this).attr(ATTRS.content) || '').trim();

            if (!id || processed[id]) {
                return;
            }

            processed[id] = true;

            if (!validateGroup(id)) {
                return;
            }

            normalizeGroupState(id);
            syncIndicators(id);
        });
    }

    $(document)
        .off('click.oziCollapse', SELECTORS.trigger)
        .on('click.oziCollapse', SELECTORS.trigger, function (event) {
            var id = getIdFromTrigger($(this));

            event.preventDefault();

            if (!id) {
                return;
            }

            toggleGroup(id);
        });

    window.oziCollapseSync = function (id) {
        if (typeof id === 'undefined' || id === null || String(id).trim() === '') {
            syncAllGroups();
            return;
        }

        id = String(id).trim();

        if (!validateGroup(id)) {
            return;
        }

        normalizeGroupState(id);
        syncIndicators(id);
    };

    window.oziCollapseToggle = function (id) {
        id = String(id || '').trim();

        if (!id) {
            return;
        }

        toggleGroup(id);
    };

    $(function () {
        syncAllGroups();
    });

})(jQuery);

/*
Exemplo mínimo de HTML:

<div data-ozi-collapse-trigger="idConexao">
    <span data-ozi-collapse-open>+ Abrir</span>
    <span data-ozi-collapse-close style="display:none;">- Fechar</span>
</div>

<div
    data-ozi-collapse-content="idConexao"
    data-ozi-collapse-options="
        effect:slidefade;
        effect-slide-time:1200;
        effect-fade-time:1200;"
    style="display:block;">
    ConteúdoA conteúdo longo
</div>

<div
    data-ozi-collapse-content="idConexao"
    data-ozi-collapse-options="effect:slidefade;"
    style="display:none;">
    ConteúdoB conteúdo curto
</div>
*/