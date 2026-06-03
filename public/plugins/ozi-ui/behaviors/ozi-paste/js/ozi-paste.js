/**
 * ------------------------------------------
 * ozi-paste
 * ------------------------------------------
 * Ver: 1.0.0
 * 2026-06-01
 *
 * Responsabilidade:
 *   - Colar texto em elemento destino via delegação de eventos
 *   - Destino: input, textarea ou contenteditable
 *   - Retorno visual: tooltip lateral com fadeOut jQuery (padrão ozi-copy)
 *   - Eventos: ozi:pasted, ozi:paste-error
 *
 * Atributos:
 *   data-ozi-paste-value   <- texto a colar
 *   data-ozi-paste-destiny <- seletor CSS do destino (#id ou .classe)
 *
 * Dependencias: ozi.js (OZI.lang)
 * Expoe: OZI.behaviors.paste, window.OziPaste (compat)
 */

(function ($, window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD - Singleton
    // ---------------------------------------------

    if (window.OziPaste) return;


    // ---------------------------------------------
    // [2] CONSTANTES
    // ---------------------------------------------

    var SELECTORS = {
        trigger: '[data-ozi-paste-value]'
    };

    var ATTRS = {
        value:   'data-ozi-paste-value',
        destiny: 'data-ozi-paste-destiny'
    };

    var DEFAULTS = {
        fadeOutTime: 1000,  // ms - duracao do fadeOut
        removeDelay: 2200   // ms - delay para remover do DOM
    };


    // ---------------------------------------------
    // [3] I18N - OZI.lang com fallback PT-BR
    // ---------------------------------------------

    function _t(key) {
        var lang = window.OZI && window.OZI.lang;
        if (lang && typeof lang.t === 'function') return lang.t(key);
        var fallback = {
            'paste.success': 'Colado!',
            'paste.error':   'Destino não encontrado.'
        };
        return fallback[key] || key;
    }


    // ---------------------------------------------
    // [4] UTILITARIO
    // ---------------------------------------------

    function str(value) {
        return String(value == null ? '' : value).trim();
    }


    // ---------------------------------------------
    // [5] COLAR NO DESTINO
    // Suporta input, textarea, contenteditable
    // ---------------------------------------------

    function _pasteInto($target, value) {
        var tag = str($target.prop('tagName') || '').toLowerCase();

        if (tag === 'input' || tag === 'textarea') {
            $target.val(value).trigger('input').trigger('change');
            return true;
        }

        if ($target.attr('contenteditable') !== undefined) {
            $target.text(value).trigger('input');
            return true;
        }

        return false;
    }


    // ---------------------------------------------
    // [6] FEEDBACK VISUAL
    // Tooltip lateral — mesmo padrão do ozi-copy
    // ---------------------------------------------

    function _showFeedback($trigger, success) {
        var text = success ? _t('paste.success') : _t('paste.error');
        var cls  = success
            ? 'ozi-paste-feedback ozi-paste-feedback-success'
            : 'ozi-paste-feedback ozi-paste-feedback-error';

        $trigger.find('.ozi-paste-feedback').remove();

        var $feedback = $('<span>', {
            'class': cls,
            'text':  text
        });

        $trigger.append($feedback);

        $feedback.fadeOut(DEFAULTS.fadeOutTime);

        setTimeout(function () {
            $feedback.remove();
        }, DEFAULTS.removeDelay);
    }


    // ---------------------------------------------
    // [7] EMIT
    // Mesmo padrão do ozi-copy: el nativo, borbulha
    // ---------------------------------------------

    function _emit(el, eventName, payload) {
        $(el).trigger(eventName, [payload]);
        if (typeof CustomEvent === 'function') {
            el.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: payload }));
        }
    }


    // ---------------------------------------------
    // [8] HANDLER PRINCIPAL
    // ---------------------------------------------

    function _handlePaste(e) {
        e.preventDefault();

        var $trigger  = $(this);
        var value     = str($trigger.attr(ATTRS.value));
        var destSel   = str($trigger.attr(ATTRS.destiny));
        var $target   = destSel ? $(destSel).first() : $();

        if (!$target.length) {
            _showFeedback($trigger, false);
            _emit($trigger[0], 'ozi:paste-error', {
                value:   value,
                destiny: destSel,
                error:   'Destino não encontrado: ' + destSel
            });
            return;
        }

        var ok = _pasteInto($target, value);

        _showFeedback($trigger, ok);

        if (ok) {
            _emit($trigger[0], 'ozi:pasted', {
                value:   value,
                destiny: $target[0]
            });
        } else {
            _emit($trigger[0], 'ozi:paste-error', {
                value:   value,
                destiny: $target[0],
                error:   'Elemento destino não suporta paste (não é input, textarea ou contenteditable).'
            });
        }
    }


    // ---------------------------------------------
    // [9] BIND - delegacao no document
    // ---------------------------------------------

    $(document)
        .off('click.oziPaste', SELECTORS.trigger)
        .on( 'click.oziPaste', SELECTORS.trigger, _handlePaste);


    // ---------------------------------------------
    // [10] API PUBLICA - OZI.behaviors.paste
    // ---------------------------------------------

    var paste = {

        /**
         * trigger(selectorOrEl)
         * Dispara paste programaticamente em um trigger.
         */
        trigger: function (selectorOrEl) {
            var $el = $(selectorOrEl);
            if ($el.length) $el.trigger('click');
        },

        /**
         * paste(destSel, value)
         * Cola texto arbitrario em elemento destino.
         * @returns {boolean}
         */
        paste: function (destSel, value) {
            var $target = $(destSel).first();
            if (!$target.length) return false;
            return _pasteInto($target, str(value));
        }
    };


    // ---------------------------------------------
    // [11] EXPOSICAO
    // ---------------------------------------------

    window.OziPaste = paste;

    $(function () {
        if (window.OZI && window.OZI.behaviors) {
            window.OZI.behaviors.paste = paste;
        }

        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('behavior:paste', function () {
                // bind delegado no document — sem acao necessaria
            });
        }
    });

})(jQuery, window, document);