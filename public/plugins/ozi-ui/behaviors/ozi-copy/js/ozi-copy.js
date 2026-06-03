/**
 * ------------------------------------------
 * ozi-copy
 * ------------------------------------------
 * Ver: 3.1.0
 * 2026-05-31
 *
 * Responsabilidade:
 *   - Copiar texto para o clipboard via delegação de eventos
 *   - Modo 1: valor direto via data-ozi-copy-value
 *   - Modo 2: trigger + content via data-ozi-copy / data-ozi-copy-content
 *   - Modo html-decode: decodifica entidades HTML antes de copiar
 *   - navigator.clipboard com fallback execCommand('copy')
 *   - Retorno visual: tooltip lateral com fadeOut jQuery
 *   - Eventos: ozi:copied, ozi:copy-error
 *
 * Atributos:
 *   data-ozi-copy-value   <- texto a copiar (modo direto)
 *   data-ozi-copy         <- id do trigger (modo referencia)
 *   data-ozi-copy-content <- id do elemento cujo conteudo sera copiado
 *   data-ozi-copy-mode    <- 'html-decode' para decodificar entidades HTML
 *
 * Dependencias: ozi.js (OZI.lang)
 * Expoe: OZI.behaviors.copy, window.OziCopy (compat)
 *
 * Changelog v3.1.0:
 *   - Removido: classe Bootstrap 'position-absolute' hardcoded no _showFeedback
 *   - Removido: classe Bootstrap 'm-r-5' hardcoded no icone
 *   - position: absolute agora responsabilidade exclusiva do CSS (.ozi-copy-feedback)
 *   - Icone com margin via classe ozi-copy-icon (sem dependencia Bootstrap)
 *   - Dívida #11 mantida: fa fa-check / fa fa-times (Font Awesome 4)
 *
 * Changelog v3.0.1:
 *   - Preservado: feedback visual tooltip lateral da v2.3.1
 *   - Corrigido: removeDelay era 92200ms -> 2200ms
 *   - Corrigido: fallback execCommand retorna Promise consistente
 *   - Adicionado: modo html-decode
 *   - Adicionado: eventos ozi:copied e ozi:copy-error
 *   - Adicionado: event.preventDefault() no handler de click
 *   - Adicionado: OZI.lang.t() com fallback PT-BR
 *   - Adicionado: hook OZI.hooks.afterRender registrado como 'behavior:copy'
 */

(function ($, window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD - Singleton
    // ---------------------------------------------

    if (window.OziCopy) return;


    // ---------------------------------------------
    // [2] CONSTANTES
    // ---------------------------------------------

    var SELECTORS = {
        value:   '[data-ozi-copy-value]',
        trigger: '[data-ozi-copy]',
        content: '[data-ozi-copy-content]'
    };

    var ATTRS = {
        value:   'data-ozi-copy-value',
        trigger: 'data-ozi-copy',
        content: 'data-ozi-copy-content',
        mode:    'data-ozi-copy-mode'
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
        return key === 'copy.success' ? 'Copiado!' : 'Erro ao copiar!';
    }


    // ---------------------------------------------
    // [4] UTILITARIO
    // ---------------------------------------------

    function str(value) {
        return String(value == null ? '' : value).trim();
    }


    // ---------------------------------------------
    // [5] COLETA DO TEXTO A COPIAR
    // ---------------------------------------------

    function _getContentById(id) {
        id = str(id);
        return $(SELECTORS.content).filter(function () {
            return str($(this).attr(ATTRS.content)) === id;
        }).first();
    }

    function _getElementText($el) {
        var tag = str($el.prop('tagName') || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
            return str($el.val());
        }
        return str($el.text());
    }

    function _getText($trigger) {
        // modo 1: valor direto
        var value = str($trigger.attr(ATTRS.value));
        if (value) return value;

        // modo 2: referencia por id
        var id = str($trigger.attr(ATTRS.trigger));
        if (!id) return '';

        var $content = _getContentById(id);
        if (!$content.length) return '';

        // html-decode - decodifica entidades HTML
        var mode = str($content.attr(ATTRS.mode) || '').toLowerCase();
        if (mode === 'html-decode') {
            return $('<textarea>').html($content.html()).val();
        }

        return _getElementText($content);
    }


    // ---------------------------------------------
    // [6] COPIA PARA CLIPBOARD
    // navigator.clipboard com fallback execCommand
    // ---------------------------------------------

    function _fallbackCopy(text) {
        try {
            var $tmp = $('<textarea>')
                .val(text)
                .attr('readonly', 'readonly')
                .css({ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0 });

            $('body').append($tmp);
            $tmp[0].focus();
            $tmp[0].select();

            var ok = document.execCommand('copy');
            $tmp.remove();
            return ok;
        } catch (e) {
            return false;
        }
    }

    function _copyToClipboard(text) {
        if (!str(text)) return Promise.resolve(false);

        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text)
                .then(function () { return true; })
                .catch(function () { return _fallbackCopy(text); });
        }

        return Promise.resolve(_fallbackCopy(text));
    }


    // ---------------------------------------------
    // [7] FEEDBACK VISUAL
    // Tooltip lateral — position absolute via CSS.
    // fadeOut jQuery controla saída.
    // Sem classes Bootstrap hardcoded.
    // ---------------------------------------------

    function _showFeedback($trigger, success) {
        var text = success ? _t('copy.success') : _t('copy.error');
        var cls  = success
            ? 'ozi-copy-feedback ozi-copy-feedback-success'
            : 'ozi-copy-feedback ozi-copy-feedback-error';

        // dívida #11: fa fa-check / fa fa-times (Font Awesome 4)
        var icon = success
            ? '<span class="fa fa-check ozi-copy-icon"></span>'
            : '<span class="fa fa-times ozi-copy-icon"></span>';

        // remove feedback anterior se existir
        $trigger.find('.ozi-copy-feedback').remove();

        var $feedback = $('<span>', {
            'class': cls,
            'html':  icon + text
        });

        $trigger.append($feedback);

        // fadeOut inicia imediatamente
        $feedback.fadeOut(DEFAULTS.fadeOutTime);

        // remove do DOM apos removeDelay ms
        setTimeout(function () {
            $feedback.remove();
        }, DEFAULTS.removeDelay);
    }


    // ---------------------------------------------
    // [8] EMIT
    // ---------------------------------------------

    function _emit(el, eventName, payload) {
        $(el).trigger(eventName, [payload]);
        if (typeof CustomEvent === 'function') {
            el.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: payload }));
        }
    }


    // ---------------------------------------------
    // [9] HANDLER PRINCIPAL
    // ---------------------------------------------

    function _handleCopy(e) {
        e.preventDefault();

        var $trigger = $(this);
        var text     = _getText($trigger);

        _copyToClipboard(text).then(function (success) {
            _showFeedback($trigger, success);

            if (success) {
                _emit($trigger[0], 'ozi:copied',     { text: text });
            } else {
                _emit($trigger[0], 'ozi:copy-error', { error: 'execCommand falhou' });
            }
        });
    }


    // ---------------------------------------------
    // [10] BIND - delegacao no document
    // ---------------------------------------------

    $(document)
        .off('click.oziCopy', SELECTORS.value + ', ' + SELECTORS.trigger)
        .on( 'click.oziCopy', SELECTORS.value + ', ' + SELECTORS.trigger, _handleCopy);


    // ---------------------------------------------
    // [11] API PUBLICA - OZI.behaviors.copy
    // ---------------------------------------------

    var copy = {

        /**
         * trigger(selectorOrEl)
         * Dispara copia programaticamente em um elemento.
         */
        trigger: function (selectorOrEl) {
            var $el = $(selectorOrEl);
            if ($el.length) $el.trigger('click');
        },

        /**
         * copy(text)
         * Copia texto arbitrario para o clipboard.
         * @returns {Promise<boolean>}
         */
        copy: function (text) {
            return _copyToClipboard(str(text));
        }
    };


    // ---------------------------------------------
    // [12] EXPOSICAO
    // ---------------------------------------------

    window.OziCopy = copy;

    $(function () {
        if (window.OZI && window.OZI.behaviors) {
            window.OZI.behaviors.copy = copy;
        }

        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('behavior:copy', function () {
                // bind delegado no document — sem acao necessaria
            });
        }
    });

})(jQuery, window, document);