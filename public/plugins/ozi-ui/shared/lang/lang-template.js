/**
 * shared/lang/_template.js
 * Template para criação de novos idiomas no OZI-UI.
 *
 * Instruções:
 *   1. Copie este arquivo para shared/lang/XX.js (ex: es.js, fr.js, de.js)
 *   2. Substitua 'XX' pelo código BCP 47 do idioma (ex: 'es', 'fr', 'de')
 *   3. Traduza todos os valores mantendo as chaves intactas
 *   4. Copie o template de cada plugin para component/lang/XX.js
 *   5. Carregue via OZI.loader.load() ou <script> antes de OZI.lang.use('XX')
 *
 * Interpolação: use {param} nas strings com valores dinâmicos.
 * Ex: 'Mínimo de {min} caracteres' → OZI.lang.t('auth.minChars', { min: 12 })
 */

(function (window) {
    'use strict';

    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;

    // ─── GLOBAL (shared/lang/XX.js) ──────────────────
    lang.register('XX', {
        common: {
            loading:  '',
            saving:   '',
            save:     '',
            cancel:   '',
            confirm:  '',
            close:    '',
            clear:    '',
            search:   '',
            add:      '',
            remove:   '',
            edit:     '',
            back:     '',
            send:     '',
            apply:    '',
            reset:    '',
            empty:    '',
            error:    '',
            success:  '',
            required: '',
            optional: '',
            yes:      '',
            no:       '',
            ok:       ''
        }
    });

    // ─── OZI-LOADDATA (modules/ozi-loaddata/lang/XX.js) ──
    lang.register('XX', {
        loadData: {
            sending: '',
            error:   '',
            success: ''
        }
    });

    // ─── OZI-SELECT (components/ozi-select/lang/XX.js) ───
    lang.register('XX', {
        select: {
            searchPlaceholder: '',
            valuePlaceholder:  '',
            empty:             '',
            requiredMessage:   ''
        }
    });

    // ─── OZI-AUTOCOMPLETE ────────────────────────────────
    lang.register('XX', {
        autocomplete: {
            searchPlaceholder: '',
            empty:             '',
            uniqueMessage:     ''
        }
    });

    // ─── OZI-SEARCH ──────────────────────────────────────
    lang.register('XX', {
        search: {
            minCharsMessage:  '',   // {min} disponível
            noResultsMessage: ''
        }
    });

    // ─── OZI-EDITOR ──────────────────────────────────────
    lang.register('XX', {
        editor: {
            bold:        '',
            italic:      '',
            underline:   '',
            ul:          '',
            ol:          '',
            codeblock:   '',
            source:      '',
            table:       '',
            alignLeft:   '',
            alignCenter: '',
            alignRight:  '',
            clearFormat: '',
            placeholder: ''
        }
    });

    // ─── OZI-AUDIO ───────────────────────────────────────
    lang.register('XX', {
        audio: {
            ready:          '',
            recording:      '',
            processing:     '',
            micUnavailable: '',
            player:         '',
            recorder:       ''
        }
    });

    // ─── OZI-AUTH ────────────────────────────────────────
    lang.register('XX', {
        auth: {
            showPassword:  '',
            hidePassword:  '',
            rulesTitle:    '',
            passLength:    '',   // {min} e {max} disponíveis
            uppercase:     '',
            lowercase:     '',
            number:        '',
            special:       '',
            noSpace:       '',
            noEmailParts:  '',
            confirm:       '',
            userMin:       ''    // {min} disponível
        }
    });

    // ─── OZI-COPY ────────────────────────────────────────
    lang.register('XX', {
        copy: {
            success: '',
            error:   ''
        }
    });

})(window);
