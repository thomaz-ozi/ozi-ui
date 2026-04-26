// OZI TOGGLE
// VERSAO: 1.1.1
// DATA: 2026-04-12
// DESCRICAO:
// Plugin de alternancia de visibilidade por grupo.
// Regra padrao: show()/hide()
// Regra opcional por content: slideDown()/slideUp() quando existir
// data-ozi-toggle-options="slide-time:...;"

(function ($) {
    'use strict';

    if (!$) {
        console.error('oziToggle: jQuery nao encontrado.');
        return;
    }

    var SELECTORS = {
        trigger: '[data-ozi-toggle-trigger]',
        content: '[data-ozi-toggle-content]',
        show: '[data-ozi-toggle-show]',
        hide: '[data-ozi-toggle-hide]'
    };

    var ATTRS = {
        trigger: 'data-ozi-toggle-trigger',
        content: 'data-ozi-toggle-content',
        options: 'data-ozi-toggle-options'
    };

    var DEFAULTS = {
        slideTime: 600
    };

    function str(value) {
        return String(value == null ? '' : value).trim();
    }

    function getIdFromTrigger($trigger) {
        return str($trigger.attr(ATTRS.trigger));
    }

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

    function parseOptions(rawOptions) {
        var options = {};

        if (!rawOptions) {
            return options;
        }

        String(rawOptions)
            .split(';')
            .forEach(function (part) {
                var item = str(part);
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

                key = str(item.slice(0, separatorIndex)).toLowerCase();
                value = str(item.slice(separatorIndex + 1));

                if (!key) {
                    return;
                }

                options[key] = value;
            });

        return options;
    }

    function resolveOptions($content) {
        var rawOptions = str($content.attr(ATTRS.options));
        var parsed;
        var slideTime;

        if (!rawOptions) {
            return {
                hasOptions: false,
                slideTime: DEFAULTS.slideTime
            };
        }

        parsed = parseOptions(rawOptions);
        slideTime = parseInt(parsed['slide-time'], 10);

        if (isNaN(slideTime)) {
            slideTime = DEFAULTS.slideTime;
        }

        return {
            hasOptions: true,
            slideTime: slideTime
        };
    }

    function syncContentAria(id) {
        getContentsById(id).each(function () {
            var $content = $(this);
            $content.attr('aria-hidden', $content.is(':visible') ? 'false' : 'true');
        });
    }

    function getTriggerIndicatorState($trigger) {
        var $show = $trigger.find(SELECTORS.show).first();
        var $hide = $trigger.find(SELECTORS.hide).first();
        var showVisible = $show.length ? $show.is(':visible') : false;
        var hideVisible = $hide.length ? $hide.is(':visible') : false;

        if (showVisible && !hideVisible) {
            return 'show';
        }

        if (hideVisible && !showVisible) {
            return 'hide';
        }

        if ($show.length && !$hide.length) {
            return 'show';
        }

        if ($hide.length && !$show.length) {
            return 'hide';
        }

        return 'show';
    }

    function applyTriggerIndicatorState($trigger, state) {
        var $show = $trigger.find(SELECTORS.show);
        var $hide = $trigger.find(SELECTORS.hide);

        if ($show.length) {
            $show.toggle(state === 'show');
        }

        if ($hide.length) {
            $hide.toggle(state === 'hide');
        }

        $trigger.attr('aria-expanded', state === 'hide' ? 'true' : 'false');
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
            applyTriggerIndicatorState($(this), state);
        });

        syncContentAria(id);
    }

    function toggleIndicators(id) {
        var $triggers = getTriggersById(id);
        var currentState = 'show';

        if ($triggers.length) {
            currentState = getTriggerIndicatorState($triggers.first());
        }

        updateIndicators(id, currentState === 'show' ? 'hide' : 'show');
    }

    function applyShow($content, done) {
        var options = resolveOptions($content);

        $content.stop(true, true);

        if (options.hasOptions) {
            $content.slideDown(options.slideTime, function () {
                if (typeof done === 'function') {
                    done();
                }
            });
            return;
        }

        $content.show();

        if (typeof done === 'function') {
            done();
        }
    }

    function applyHide($content, done) {
        var options = resolveOptions($content);

        $content.stop(true, true);

        if (options.hasOptions) {
            $content.slideUp(options.slideTime, function () {
                if (typeof done === 'function') {
                    done();
                }
            });
            return;
        }

        $content.hide();

        if (typeof done === 'function') {
            done();
        }
    }

    function invertContentState($content, done) {
        if ($content.is(':visible')) {
            applyHide($content, done);
            return;
        }

        applyShow($content, done);
    }

    function runBatch($items, callbackItem, callbackEnd) {
        var total = $items.length;
        var doneCount = 0;

        if (!total) {
            if (typeof callbackEnd === 'function') {
                callbackEnd();
            }
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

    function toggleGroup(id) {
        var $contents;

        id = str(id);

        if (!id) {
            return;
        }

        $contents = getContentsById(id);

        if (!$contents.length) {
            return;
        }

        runBatch(
            $contents,
            function ($content, next) {
                invertContentState($content, next);
            },
            function () {
                toggleIndicators(id);
            }
        );
    }

    function openGroup(id) {
        var $contents;

        id = str(id);

        if (!id) {
            return;
        }

        $contents = getContentsById(id);

        if (!$contents.length) {
            return;
        }

        runBatch(
            $contents,
            function ($content, next) {
                if ($content.is(':visible')) {
                    next();
                    return;
                }

                applyShow($content, next);
            },
            function () {
                updateIndicators(id, 'hide');
            }
        );
    }

    function closeGroup(id) {
        var $contents;

        id = str(id);

        if (!id) {
            return;
        }

        $contents = getContentsById(id);

        if (!$contents.length) {
            return;
        }

        runBatch(
            $contents,
            function ($content, next) {
                if (!$content.is(':visible')) {
                    next();
                    return;
                }

                applyHide($content, next);
            },
            function () {
                updateIndicators(id, 'show');
            }
        );
    }

    function syncGroup(id) {
        var $triggers;

        id = str(id);

        if (!id) {
            return;
        }

        if (!getContentsById(id).length) {
            return;
        }

        $triggers = getTriggersById(id);

        if ($triggers.length) {
            updateIndicators(id, getTriggerIndicatorState($triggers.first()));
            return;
        }

        syncContentAria(id);
    }

    function syncAllGroups() {
        var processed = {};

        $(SELECTORS.trigger + ', ' + SELECTORS.content).each(function () {
            var $element = $(this);
            var id = str($element.attr(ATTRS.trigger) || $element.attr(ATTRS.content));

            if (!id || processed[id]) {
                return;
            }

            processed[id] = true;
            syncGroup(id);
        });
    }

    $(document)
        .off('click.oziToggle', SELECTORS.trigger)
        .on('click.oziToggle', SELECTORS.trigger, function (event) {
            var id = getIdFromTrigger($(this));

            event.preventDefault();

            if (!id) {
                return;
            }

            toggleGroup(id);
        });

    window.oziToggleSync = function (id) {
        if (typeof id === 'undefined' || id === null || str(id) === '') {
            syncAllGroups();
            return;
        }

        syncGroup(id);
    };

    window.oziToggleToggle = function (id) {
        id = str(id);

        if (!id) {
            return;
        }

        toggleGroup(id);
    };

    window.oziToggleOpen = function (id) {
        id = str(id);

        if (!id) {
            return;
        }

        openGroup(id);
    };

    window.oziToggleClose = function (id) {
        id = str(id);

        if (!id) {
            return;
        }

        closeGroup(id);
    };

    $(function () {
        syncAllGroups();
    });

})(jQuery);