/**
 * ------------------------------------------
 * oziCopy
 * ------------------------------------------
 * Ver: (2.3.1)
 * 2026-04-25
 * ------------------------------------------
 */
(function ($) {
    'use strict';

    if (!$) {
        console.error('oziCopy: jQuery nao encontrado.');
        return;
    }

    var SELECTORS = {
        value: '[data-ozi-copy-value]',
        trigger: '[data-ozi-copy]',
        content: '[data-ozi-copy-content]'
    };

    var ATTRS = {
        value: 'data-ozi-copy-value',
        trigger: 'data-ozi-copy',
        content: 'data-ozi-copy-content'
    };

    var DEFAULTS = {
        successText: 'Copiado!',
        errorText: 'Erro ao copiar!',
        fadeOutTime: 1000,
        removeDelay: 2200
    };

    function str(value) {
        return String(value == null ? '' : value).trim();
    }

    function getContentById(id) {
        id = str(id);

        return $(SELECTORS.content).filter(function () {
            return str($(this).attr(ATTRS.content)) === id;
        }).first();
    }

    function getElementCopyText($element) {
        var tagName = (($element.prop('tagName') || '') + '').toLowerCase();

        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            return str($element.val());
        }

        return str($element.text());
    }

    function getTextToCopy($trigger) {
        var value = str($trigger.attr(ATTRS.value));
        var id;
        var $content;

        if (value) {
            return value;
        }

        id = str($trigger.attr(ATTRS.trigger));

        if (!id) {
            return '';
        }

        $content = getContentById(id);

        if (!$content.length) {
            return '';
        }

        return getElementCopyText($content);
    }

    function removeFeedback($trigger) {
        $trigger.find('.ozi-copy-feedback').remove();
    }

    function showFeedback($trigger, type) {
        var isSuccess = type === 'success';
        var text = isSuccess ? DEFAULTS.successText : DEFAULTS.errorText;

        removeFeedback($trigger);

        var $feedback = $('<span>', {
            class: [
                'ozi-copy-feedback',
                isSuccess ? 'ozi-copy-feedback-success' : 'ozi-copy-feedback-error',
                'position-absolute'
            ].join(' '),
            style: 'width: 95px',
            html: isSuccess
                ? '<span class="fa fa-check m-r-5"></span>' + text
                : '<span class="fa fa-times m-r-5"></span>' + text
        });

        $trigger.append($feedback);

        $feedback.fadeOut(DEFAULTS.fadeOutTime);
        setTimeout(function () {
            $feedback.remove();
        }, DEFAULTS.removeDelay);
    }

    function fallbackCopy(text) {
        var $temp = $('<textarea>', {
            text: text,
            readonly: 'readonly'
        }).css({
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            opacity: 0
        });

        $('body').append($temp);
        $temp[0].focus();
        $temp[0].select();

        var success = false;

        try {
            success = document.execCommand('copy');
        } catch (error) {
            success = false;
        }

        $temp.remove();

        return success;
    }

    function copyText(text) {
        if (!str(text)) {
            return Promise.resolve(false);
        }

        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text)
                .then(function () {
                    return true;
                })
                .catch(function () {
                    return fallbackCopy(text);
                });
        }

        return Promise.resolve(fallbackCopy(text));
    }

    function handleCopy($trigger) {
        var text = getTextToCopy($trigger);

        copyText(text).then(function (success) {
            showFeedback($trigger, success ? 'success' : 'error');
        });
    }

    $(document)
        .off('click.oziCopy', SELECTORS.value + ', ' + SELECTORS.trigger)
        .on('click.oziCopy', SELECTORS.value + ', ' + SELECTORS.trigger, function (event) {
            event.preventDefault();
            handleCopy($(this));
        });

})(jQuery);