/**
 *
 *  ------------------------------------------
 *  ozi-lang-template
 *  ------------------------------------------
 *  Ver: 1.0.0
 *  2026-05-27
 *
 *
 *
 *
 * core/lang/_template.js
 * Template para criação de novos idiomas no OZI-UI.
 *
 * Instruções:
 *   1. Copie este arquivo para core/lang/XX.js (ex: es.js, fr.js)
 *   2. Traduza todos os valores mantendo as chaves intactas
 *   3. Copie para cada plugin/lang/XX.js e traduza as seções correspondentes
 *   4. Carregue via OZI.loader.load() antes de chamar OZI.lang.use('XX')
 *
 * Interpolação: use {param} nas strings que recebem valores dinâmicos
 */

OZI.lang.register('XX', {

    // ─── GLOBAL (core/lang/XX.js) ────────────────
    common: {
        loading:  '',
        saving:   '',
        save:     '',
        cancel:   '',
        confirm:  '',
        close:    '',
        clear:    '',
        search:   '',
        empty:    '',
        error:    '',
        success:  '',
        required: '',
        yes:      '',
        no:       '',
        add:      '',
        remove:   '',
        edit:     '',
        back:     ''
    },

    // ─── OZI-LOADDATA (ozi-loaddata/lang/XX.js) ──
    loadData: {
        sending: '',
        error:   '',
        success: ''
    },

    // ─── OZI-SELECT (ozi-select/lang/XX.js) ──────
    select: {
        searchPlaceholder: '',
        valuePlaceholder:  '',
        empty:             ''
    },

    // ─── OZI-AUTOCOMPLETE (ozi-autocomplete/lang/XX.js) ──
    autocomplete: {
        searchPlaceholder: '',
        empty:             '',
        uniqueMessage:     ''
    },

    // ─── OZI-SEARCH (ozi-search/lang/XX.js) ──────
    search: {
        minCharsMessage:  '',   // ex: 'Digite ao menos {min} caracteres'
        noResultsMessage: ''
    },

    // ─── OZI-EDITOR (ozi-editor/lang/XX.js) ──────
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
    },

    // ─── OZI-AUDIO (ozi-audio/lang/XX.js) ────────
    audio: {
        ready:          '',
        recording:      '',
        processing:     '',
        micUnavailable: '',
        player:         '',
        recorder:       ''
    },

    // ─── OZI-AUTH (ozi-auth/lang/XX.js) ──────────
    auth: {
        showPassword: '',
        hidePassword: '',
        rulesTitle:   '',
        minChars:     '',   // interpolação: {min}
        maxChars:     '',   // interpolação: {max}
        uppercase:    '',
        lowercase:    '',
        number:       '',
        special:      '',
        noSpace:      '',
        confirm:      ''
    },

    // ─── OZI-COPY (ozi-copy/lang/XX.js) ──────────
    copy: {
        success: '',
        error:   ''
    }

});
