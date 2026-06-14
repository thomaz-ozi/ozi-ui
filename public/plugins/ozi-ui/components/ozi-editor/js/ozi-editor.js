/**
 * ------------------------------------------
 * ozi-editor
 * ------------------------------------------
 * Ver: 3.1.1
 * 2026-06-01
 *
 * [3.1.0] FEAT-7  Atributo unificado — type integrado ao identificador
 *                 data-ozi-editor-html="key" → type=html, key=value
 *                 data-ozi-editor-md="key"   → type=md,   key=value
 *                 - data-ozi-editor + data-ozi-editor-type REMOVIDOS
 *                 - RULE-1 desnecessária — type é estrutural
 *                 - Zero ambiguidade: type visível de relance no template
 *                 - Dois editores na mesma página sem nenhuma configuração extra
 *                 - _resolve, init, _registerAdapter atualizados
 *
 * [2.5.1] FIX-TIMING  editorAPI.init(root, type) — aceita filtro por type
 *                     _boot → init(null, 'html') — só html no boot
 *                     registerConverters → init(null, 'md') — md após conversores
 *                     Elementos md sem conversores aguardam silenciosamente
 *
 * [2.5.0] RULE-1  data-ozi-editor-type OBRIGATÓRIO (substituído por FEAT-7)
 *
 * [2.4.0] FEAT-6  data-ozi-editor-type="html|md"
 *                 - DEFAULT_TOOLS_HTML / DEFAULT_TOOLS_MD por type
 *                 - BUILT_IN_THEMES_HTML / BUILT_IN_THEMES_MD por type
 *                 - BLOCKED_IN_MD — ferramentas sem equivalente Markdown
 *                 - Botão incompatível → ícone ? (inerte, title explicativo)
 *                 - _convertIn / _convertOut — hooks preenchidos por ozi-editor-md.js
 *                 - _converters — contrato público para ozi-editor-md.js
 *                 - source mode exibe no formato nativo do type
 *
 * [2.3.0] FEAT-5  data-ozi-editor-theme + oziConf themes — presets de toolbar
 * [2.2.0] FEAT-4  Headings movidos para dropdown separado
 * [2.1.0] FEAT-3  data-ozi-editor-class — dropdown de classes customizadas
 * [2.1.0] FEAT-2  Headings h1–h6 como ferramenta de toolbar
 * [2.1.0] FEAT-1  DEFAULT_TOOLS — constante editável; prioridade: atributo → oziConf → DEFAULT_TOOLS
 * [2.0.2] FIX-A/B/C/D  Correções CSS var, seletor init, textAlign, bindEvents
 */

(function ($, window, document) {
    'use strict';

    if (typeof $ === 'undefined') {
        console.error('[OZI:editor] jQuery não encontrado.');
        return;
    }

    /* ─────────────────────────────────────────────
     * [1] REGISTRY E CONTADOR
     * ───────────────────────────────────────────── */

    var _instances = {};
    var _counter   = 0;

    /* ─────────────────────────────────────────────
     * [2] HELPERS INTERNOS
     * ───────────────────────────────────────────── */

    function _h() { return (window.OZI && window.OZI.helpers) || {}; }

    function _trim(s) { return String(s || '').replace(/^\s+|\s+$/g, ''); }

    function _t(key) {
        var lang = window.OZI && window.OZI.lang;
        if (lang && lang.t) { var v = lang.t(key); if (v && v !== key) return v; }
        var fb = {
            'editor.bold':           'Bold',
            'editor.italic':         'Italic',
            'editor.underline':      'Underline',
            'editor.ul':             'List',
            'editor.ol':             'Numbered list',
            'editor.codeblock':      'Code',
            'editor.source':         'HTML source',
            'editor.source.md':      'Markdown source',
            'editor.table':          'Table',
            'editor.clear':          'Clear format',
            'editor.alignLeft':      'Align left',
            'editor.alignCenter':    'Center',
            'editor.alignRight':     'Align right',
            'editor.h1':             'Heading 1',
            'editor.h2':             'Heading 2',
            'editor.h3':             'Heading 3',
            'editor.h4':             'Heading 4',
            'editor.h5':             'Heading 5',
            'editor.h6':             'Heading 6',
            'editor.heading':        'Heading',
            'editor.classes':        'Styles',
            'editor.placeholder':    'Type here...',
            'editor.incompatible':   'Not available in this mode',
            'editor.unknown':        'Unknown tool',
            'common.required':       'Required field'
        };
        return fb[key] || key;
    }

    function _classMap(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        return (conf && conf.classMap && conf.classMap[key]) || fallback || '';
    }

    function _parseBool($el, attr, fallback) {
        var h = _h();
        if (h.parseBool) return h.parseBool($el, attr, fallback);
        var raw = $el.attr(attr);
        if (raw === undefined || raw === null) return !!fallback;
        var val = String(raw).trim().toLowerCase();
        if (val === 'true'  || val === '1' || val === 'yes' || val === 'on')  return true;
        if (val === 'false' || val === '0' || val === 'no'  || val === 'off') return false;
        return !!fallback;
    }

    function _splitTopLevel(raw, sep) {
        var h = _h();
        if (h.splitTopLevel) return h.splitTopLevel(raw, sep, '[', ']');
        var results = [], depth = 0, current = '';
        for (var i = 0; i < raw.length; i++) {
            var ch = raw[i];
            if (ch === '[') depth++;
            if (ch === ']') depth--;
            if (ch === sep && depth === 0) {
                if (current.trim()) results.push(current.trim());
                current = '';
            } else { current += ch; }
        }
        if (current.trim()) results.push(current.trim());
        return results;
    }

    /* ─────────────────────────────────────────────
     * [3] DEFAULT_TOOLS — padrão do autor por type
     *
     * Prioridade de resolução (para ambos os types):
     *   1. data-ozi-editor-theme  → nome de theme → string
     *   2. data-ozi-editor-tools  → string direta
     *   3. oziConf defaultTheme   → nome de theme → string
     *   4. oziConf defaultTools   → string direta (compat)
     *   5. DEFAULT_TOOLS_HTML / DEFAULT_TOOLS_MD   ← fallback do autor
     * ───────────────────────────────────────────── */

    var DEFAULT_TOOLS_HTML = '[bold,italic,underline], [ul,ol], [left,center,right]; [heading,classes], table, clear, codeblock, source';
    var DEFAULT_TOOLS_MD   = '[bold,italic], [ul,ol]; heading; codeblock, table; source';

    /* ─────────────────────────────────────────────
     * FERRAMENTAS BLOQUEADAS EM MD
     *
     * Sem equivalente Markdown direto.
     * Se declaradas em data-ozi-editor-tools com type=md,
     * o botão aparece como ? (inerte, com title explicativo).
     * 'classes' não está bloqueado — dev decide conscientemente.
     * ───────────────────────────────────────────── */

    var BLOCKED_IN_MD = {
        left:   true,
        center: true,
        right:  true,
        clear:  true
    };

    /* ─────────────────────────────────────────────
     * THEMES BUILT-IN POR TYPE
     *
     * Dois dicionários independentes.
     * Dev estende via oziConf:
     *   components.editor.themes.html / .md
     * ───────────────────────────────────────────── */

    var BUILT_IN_THEMES_HTML = {
        minimal:  '[bold,italic,underline]; source',
        standard: '[bold,italic,underline]; heading; [ul,ol]; codeblock,clear; source',
        full:     '[bold,italic,underline], [ul,ol], [left,center,right]; [heading,classes], table, clear, codeblock, source',
        blog:     '[bold,italic,underline]; heading; [ul,ol]; table,clear; classes,source',
        code:     '[bold,italic,underline]; codeblock,source'
    };

    var BUILT_IN_THEMES_MD = {
        minimal:  '[bold,italic]; source',
        standard: '[bold,italic], [ul,ol]; heading; codeblock; source',
        full:     '[bold,italic], [ul,ol]; heading; codeblock, table; source'
    };

    function _resolveTheme(name, devThemes, builtIn) {
        if (!name) return null;
        name = _trim(String(name));
        if (devThemes && devThemes[name]) return String(devThemes[name]);
        if (builtIn && builtIn[name])     return String(builtIn[name]);
        return null;
    }

    /* ─────────────────────────────────────────────
     * CONTRATO DE CONVERSORES — preenchido por ozi-editor-md.js
     *
     * OZI.components.editor.registerConverters({
     *     mdToHtml: fn,
     *     htmlToMd:  fn
     * });
     *
     * Se não registrado e type=md: passthrough sem conversão.
     * ───────────────────────────────────────────── */

    var _converters = {
        mdToHtml: null,
        htmlToMd:  null
    };

    /* ─────────────────────────────────────────────
     * [3.1.0] SELETOR ÚNICO
     *
     * Centralizado — usado em init(), _resolve() e _registerAdapter().
     * ───────────────────────────────────────────── */

    var SELECTOR = '[data-ozi-editor-html], [data-ozi-editor-md]';

    /* ─────────────────────────────────────────────
     * [4] METADADOS DAS FERRAMENTAS
     * ───────────────────────────────────────────── */

    var TOOL_META = {
        bold:      { labelKey: 'editor.bold',        icon: 'bold',      execCmd: 'bold' },
        italic:    { labelKey: 'editor.italic',       icon: 'italic',    execCmd: 'italic' },
        underline: { labelKey: 'editor.underline',    icon: 'underline', execCmd: 'underline' },
        ul:        { labelKey: 'editor.ul',           icon: 'ul',        execCmd: 'insertUnorderedList' },
        ol:        { labelKey: 'editor.ol',           icon: 'ol',        execCmd: 'insertOrderedList' },
        codeblock: { labelKey: 'editor.codeblock',    icon: 'codeblock', execCmd: null },
        source:    { labelKey: 'editor.source',       icon: 'source',    execCmd: null },
        table:     { labelKey: 'editor.table',        icon: 'table',     execCmd: null },
        clear:     { labelKey: 'editor.clear',        icon: 'clear',     execCmd: null },
        left:      { labelKey: 'editor.alignLeft',    icon: 'left',      execCmd: null },
        center:    { labelKey: 'editor.alignCenter',  icon: 'center',    execCmd: null },
        right:     { labelKey: 'editor.alignRight',   icon: 'right',     execCmd: null },
        h1:        { labelKey: 'editor.h1',           icon: 'h1',        execCmd: null },
        h2:        { labelKey: 'editor.h2',           icon: 'h2',        execCmd: null },
        h3:        { labelKey: 'editor.h3',           icon: 'h3',        execCmd: null },
        h4:        { labelKey: 'editor.h4',           icon: 'h4',        execCmd: null },
        h5:        { labelKey: 'editor.h5',           icon: 'h5',        execCmd: null },
        h6:        { labelKey: 'editor.h6',           icon: 'h6',        execCmd: null },
        heading:   { labelKey: 'editor.heading',      icon: 'heading',   execCmd: null },
        classes:   { labelKey: 'editor.classes',      icon: 'classes',   execCmd: null }
    };

    /* ─────────────────────────────────────────────
     * [5] PARSER DE LAYOUT DA TOOLBAR
     * ───────────────────────────────────────────── */

    function _parseToolsLayout(raw) {
        if (!raw) return [];
        return _splitTopLevel(raw, ';').map(function (row) {
            return { type: 'row', items: _parseToolsRow(row.trim()) };
        });
    }

    function _parseToolsRow(raw) {
        return _splitTopLevel(raw, ',').map(function (item) {
            item = item.trim();
            if (item.charAt(0) === '[' && item.charAt(item.length - 1) === ']') {
                var tools = item.slice(1, -1).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
                return { type: 'group', tools: tools };
            }
            return { type: 'tool', tool: item };
        });
    }

    /* ─────────────────────────────────────────────
     * [6] PARSER DE CLASSES CUSTOMIZADAS
     * ───────────────────────────────────────────── */

    function _parseClassDefs(raw) {
        if (!raw) return [];
        return String(raw).split(',').map(function (part) {
            part = part.trim();
            if (!part) return null;
            var idx = part.indexOf(':');
            if (idx > -1) {
                return { cls: part.slice(0, idx).trim(), label: part.slice(idx + 1).trim() };
            }
            return { cls: part, label: part };
        }).filter(Boolean);
    }

    /* ─────────────────────────────────────────────
     * [7] SANITIZAÇÃO DE HTML
     * ───────────────────────────────────────────── */

    var ALLOWED_TAGS = {
        'P': true, 'BR': true, 'STRONG': true, 'EM': true, 'U': true,
        'UL': true, 'OL': true, 'LI': true,
        'PRE': true, 'CODE': true, 'SPAN': true,
        'TABLE': true, 'TBODY': true, 'THEAD': true, 'TR': true, 'TD': true, 'TH': true,
        'H1': true, 'H2': true, 'H3': true, 'H4': true, 'H5': true, 'H6': true
    };

    var TAG_REPLACE = { 'DIV': 'P', 'B': 'STRONG', 'I': 'EM' };

    function _sanitizeHtml(html) {
        if (!html) return '';
        var $tmp = $('<div>').html(html);
        _cleanNode($tmp[0]);
        return $tmp.html();
    }

    function _cleanNode(node) {
        var children = Array.prototype.slice.call(node.childNodes);

        children.forEach(function (child) {
            if (child.nodeType === 3) return;
            if (child.nodeType !== 1) { node.removeChild(child); return; }

            var tag = child.tagName.toUpperCase();

            if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON'].indexOf(tag) > -1) {
                node.removeChild(child); return;
            }

            if (TAG_REPLACE[tag]) {
                var rep = document.createElement(TAG_REPLACE[tag]);
                while (child.firstChild) rep.appendChild(child.firstChild);
                var align = child.style && child.style.textAlign;
                if (align && ['left','center','right','justify'].indexOf(align) > -1) rep.style.textAlign = align;
                node.replaceChild(rep, child);
                _cleanNode(rep); return;
            }

            if (!ALLOWED_TAGS[tag]) {
                var frag = document.createDocumentFragment();
                while (child.firstChild) frag.appendChild(child.firstChild);
                node.replaceChild(frag, child); return;
            }

            var savedAlign = child.style && child.style.textAlign;
            var savedClass = child.getAttribute('class') || '';

            Array.prototype.slice.call(child.attributes).forEach(function (attr) {
                child.removeAttribute(attr.name);
            });

            if (savedAlign && ['left','center','right','justify'].indexOf(savedAlign) > -1) {
                child.style.textAlign = savedAlign;
            }
            if (savedClass) child.setAttribute('class', savedClass);

            _cleanNode(child);
        });
    }

    /* ─────────────────────────────────────────────
     * [8] CONSTRUCTOR
     *
     * [3.1.0] FEAT-7 — type integrado ao atributo identificador:
     *
     *   data-ozi-editor-html="descricao"  →  type=html, key='descricao'
     *   data-ozi-editor-md="descricao"    →  type=md,   key='descricao'
     *
     * Regras:
     *   - Nenhum dos dois presentes → throw (mensagem clara)
     *   - key vazio → throw
     *   - Os dois presentes → html vence (primeiro detectado)
     * ───────────────────────────────────────────── */

    function OziEditor(element) {
        this.$textarea = $(element);

        /* [FEAT-7] detecta type pelo atributo presente */
        var keyHtml = this.$textarea.attr('data-ozi-editor-html');
        var keyMd   = this.$textarea.attr('data-ozi-editor-md');

        if (keyHtml !== undefined) {
            this.editorType = 'html';
            this.key        = _trim(String(keyHtml));
        } else if (keyMd !== undefined) {
            this.editorType = 'md';
            this.key        = _trim(String(keyMd));
        } else {
            throw new Error(
                '[OZI:editor] Atributo obrigatório ausente.\n' +
                'Use data-ozi-editor-html="key" ou data-ozi-editor-md="key"'
            );
        }

        if (!this.key) {
            throw new Error(
                '[OZI:editor] Chave obrigatória.\n' +
                'Exemplo: data-ozi-editor-html="descricao"'
            );
        }

        this.uid = 'ozi-editor-' + (++_counter);
        this.ns  = '.oziEditor.' + this.uid;

        var pluginConf = window.OZI && window.OZI.conf &&
            window.OZI.conf.components && window.OZI.conf.components.editor;

        /* temas do dev separados por type */
        var _devThemesByType = pluginConf && pluginConf.themes;
        var _devThemes       = _devThemesByType && _devThemesByType[this.editorType];

        /* dicionário built-in correto para o type */
        var _builtIn = this.editorType === 'md' ? BUILT_IN_THEMES_MD : BUILT_IN_THEMES_HTML;

        /* prioridade de resolução da toolbar */
        var _themeName   = this.$textarea.attr('data-ozi-editor-theme');
        var _themeStr    = _resolveTheme(_themeName, _devThemes, _builtIn);

        var _defTheme    = pluginConf && pluginConf.defaultTheme;
        var _defThemeStr = _resolveTheme(_defTheme, _devThemes, _builtIn);

        var _defaultTools = this.editorType === 'md' ? DEFAULT_TOOLS_MD : DEFAULT_TOOLS_HTML;

        this.toolsRaw =
            _themeStr                                    ||  /* 1. theme no elemento */
            this.$textarea.attr('data-ozi-editor-tools') ||  /* 2. tools direto */
            _defThemeStr                                 ||  /* 3. defaultTheme do conf */
            (pluginConf && pluginConf.defaultTools)      ||  /* 4. defaultTools (compat) */
            _defaultTools;                                   /* 5. fallback por type */

        this.height      = this.$textarea.attr('data-ozi-editor-height') || '200px';
        this.placeholder = this.$textarea.attr('data-ozi-editor-placeholder') || _t('editor.placeholder');
        this.uicolor     = this.$textarea.attr('data-ozi-editor-uicolor')
            || (pluginConf && pluginConf.uicolor)
            || 'var(--ozi-color-primary)';

        this.isDisabled      = _parseBool(this.$textarea, 'data-ozi-editor-disabled', false);
        this.isRequired      = _parseBool(this.$textarea, 'data-ozi-editor-required', false);
        this.requiredMessage = this.$textarea.attr('data-ozi-editor-required-message') || _t('common.required');

        this.classDefs = _parseClassDefs(this.$textarea.attr('data-ozi-editor-class') || '');

        this.toolsLayout  = _parseToolsLayout(this.toolsRaw);
        this.isSourceMode = false;
        this._savedRange  = null;

        this.$wrap            = null;
        this.$toolbar         = null;
        this.$content         = null;
        this.$source          = null;
        this.$feedback        = null;
        this.$headingDropdown = null;
        this.$classDropdown   = null;
    }

    /* ─────────────────────────────────────────────
     * [9] LIFECYCLE
     * ───────────────────────────────────────────── */

    OziEditor.prototype.init = function () {
        var initFlag = 'ozi-editor-' + this.editorType + '-initialized';
        if (this.$textarea.data(initFlag)) return;
        this.$textarea.data(initFlag, true);

        this._buildUI();
        this._loadIcons();
        this._syncFromTextarea();
        this._bindEvents();
        this._updateToolbarState();

        if (this.isDisabled) this._setDisabled(true);

        _instances[this.key] = this;
    };

    OziEditor.prototype.destroy = function () {
        this.$textarea.off(this.ns);
        $(document).off(this.ns);
        if (this.$wrap) this.$wrap.remove();
        var initFlag = 'ozi-editor-' + this.editorType + '-initialized';
        this.$textarea.show().removeData(initFlag);
        delete _instances[this.key];
    };

    OziEditor.prototype.reload = function () {
        var el = this.$textarea[0];
        this.destroy();
        var fresh = new OziEditor(el);
        fresh.init();
        return fresh;
    };

    /* ─────────────────────────────────────────────
     * [10] BUILD UI
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildUI = function () {
        var self = this;

        /* [3.1.0] $wrap recebe data-ozi-editor-type para CSS e debug
         * (atributo do wrapper gerado — não do textarea original) */
        self.$wrap = $('<div class="ozi-editor-wrap"></div>')
            .css('--ozi-editor-uicolor', self.uicolor)
            .attr('data-ozi-editor-type', self.editorType);

        self.$toolbar = $('<div class="ozi-editor-toolbar"></div>');
        self._buildToolbarButtons();

        self.$content = $('<div class="ozi-editor-content" contenteditable="true" role="textbox" aria-multiline="true"></div>')
            .css('min-height', self.height)
            .attr('data-placeholder', self.placeholder);

        var sourcePlaceholder = self.editorType === 'md'
            ? _t('editor.source.md')
            : _t('editor.source');

        self.$source = $('<textarea class="ozi-editor-source"></textarea>')
            .css('min-height', self.height)
            .attr('placeholder', sourcePlaceholder)
            .hide();

        var feedbackClass = _classMap('feedback', 'ozi-feedback');
        self.$feedback = $('<div class="' + feedbackClass + ' ozi-editor-feedback"></div>').hide();

        self.$wrap
            .append(self.$toolbar)
            .append(self.$content)
            .append(self.$source)
            .append(self.$feedback);

        self.$textarea.hide().after(self.$wrap);
    };

    /* ─────────────────────────────────────────────
     * [11] TOOLBAR BUTTONS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildToolbarButtons = function () {
        var self = this;

        self.toolsLayout.forEach(function (row) {
            var $row = $('<div class="ozi-editor-toolbar-row"></div>');

            row.items.forEach(function (item) {
                if (item.type === 'group') {
                    var $group = $('<div class="ozi-editor-toolbar-group"></div>');
                    item.tools.forEach(function (tool) {
                        var $btn = self._buildToolButton(tool);
                        if ($btn && $btn.length) $group.append($btn);
                    });
                    if ($group.children().length) $row.append($group);
                } else if (item.type === 'tool') {
                    var $btn = self._buildToolButton(item.tool);
                    if ($btn && $btn.length) $row.append($btn);
                }
            });

            if ($row.children().length) self.$toolbar.append($row);
        });
    };

    /*
     * Resultado por cenário:
     *
     *   tool desconhecida (typo: "bild")
     *     → botão ? | title: "Unknown tool: bild"
     *
     *   tool bloqueada em MD (left/center/right/clear) com type=md
     *     → botão ? | title: "Not available in this mode: left"
     *
     *   tool válida para o type
     *     → botão normal
     */
    OziEditor.prototype._buildToolButton = function (tool) {
        var self = this;

        if (!TOOL_META[tool]) {
            return self._buildIncompatibleButton(tool, _t('editor.unknown') + ': ' + tool);
        }

        if (self.editorType === 'md' && BLOCKED_IN_MD[tool]) {
            return self._buildIncompatibleButton(tool, _t('editor.incompatible') + ': ' + tool);
        }

        var meta  = TOOL_META[tool];
        var label = _t(meta.labelKey);

        if (tool === 'source' && self.editorType === 'md') {
            label = _t('editor.source.md');
        }

        if (tool === 'heading') return self._buildHeadingButton(label);
        if (tool === 'classes') return self._buildClassesButton(label);

        var $btn = $('<button type="button" class="ozi-editor-btn"></button>')
            .attr('data-ozi-editor-tool', tool)
            .attr('title', label)
            .attr('aria-label', label)
            .append($('<span class="ozi-editor-btn-icon" aria-hidden="true"></span>'));

        return $btn;
    };

    /* Botão ? — inerte, visível, title explicativo */
    OziEditor.prototype._buildIncompatibleButton = function (tool, titleMsg) {
        return $('<button type="button" class="ozi-editor-btn ozi-editor-btn--incompatible"></button>')
            .attr('disabled', true)
            .attr('data-ozi-editor-tool-blocked', tool)
            .attr('title', titleMsg)
            .attr('aria-label', titleMsg)
            .attr('aria-disabled', 'true')
            .append($('<span class="ozi-editor-btn-icon" aria-hidden="true">?</span>'));
    };

    /* ─────────────────────────────────────────────
     * [12] DROPDOWN DE HEADINGS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildHeadingButton = function (label) {
        var self = this;

        var $wrap = $('<div class="ozi-editor-heading-wrap"></div>');

        var $btn = $('<button type="button" class="ozi-editor-btn ozi-editor-btn--heading"></button>')
            .attr('data-ozi-editor-tool', 'heading')
            .attr('title', label)
            .attr('aria-label', label)
            .attr('aria-haspopup', 'true')
            .attr('aria-expanded', 'false')
            .append($('<span class="ozi-editor-btn-icon" aria-hidden="true"></span>'));

        var $dropdown = $('<div class="ozi-editor-heading-dropdown" role="menu"></div>').hide();

        ['h1','h2','h3','h4','h5','h6'].forEach(function (level) {
            var levelLabel = _t('editor.' + level);
            var $item = $('<button type="button" class="ozi-editor-heading-item" role="menuitem"></button>')
                .attr('data-ozi-heading', level)
                .append($('<span class="ozi-editor-heading-check" aria-hidden="true">&#10003;</span>'))
                .append($('<span class="ozi-editor-heading-tag"></span>').text(level.toUpperCase()))
                .append($('<span class="ozi-editor-heading-label"></span>').text(levelLabel));
            $dropdown.append($item);
        });

        self.$headingDropdown = $dropdown;
        $wrap.append($btn).append($dropdown);
        return $wrap;
    };

    OziEditor.prototype._toggleHeadingDropdown = function (forceClose) {
        var self = this;
        if (!self.$headingDropdown) return;

        var isOpen = self.$headingDropdown.is(':visible');

        if (forceClose || isOpen) {
            self.$headingDropdown.hide();
            self.$wrap.find('.ozi-editor-btn--heading').attr('aria-expanded', 'false');
            return;
        }

        self._updateHeadingDropdownChecks();
        self.$headingDropdown.show();
        self.$wrap.find('.ozi-editor-btn--heading').attr('aria-expanded', 'true');
    };

    OziEditor.prototype._updateHeadingDropdownChecks = function () {
        var self = this;
        if (!self.$headingDropdown) return;

        var block      = self._getClosestBlockElement();
        var currentTag = block ? String(block.tagName || '').toLowerCase() : '';

        self.$headingDropdown.find('[data-ozi-heading]').each(function () {
            var level = $(this).attr('data-ozi-heading');
            $(this).toggleClass('ozi-editor-heading-item--active', level === currentTag);
        });
    };

    /* ─────────────────────────────────────────────
     * [13] DROPDOWN DE CLASSES CUSTOMIZADAS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildClassesButton = function (label) {
        var self = this;

        if (!self.classDefs || !self.classDefs.length) return $();

        var $wrap = $('<div class="ozi-editor-classes-wrap"></div>');

        var $btn = $('<button type="button" class="ozi-editor-btn ozi-editor-btn--classes"></button>')
            .attr('data-ozi-editor-tool', 'classes')
            .attr('title', label)
            .attr('aria-label', label)
            .attr('aria-haspopup', 'true')
            .attr('aria-expanded', 'false')
            .append($('<span class="ozi-editor-btn-icon" aria-hidden="true"></span>'));

        var $dropdown = $('<div class="ozi-editor-classes-dropdown" role="menu"></div>').hide();

        self.classDefs.forEach(function (def) {
            var $item = $('<button type="button" class="ozi-editor-classes-item" role="menuitem"></button>')
                .attr('data-ozi-class', def.cls)
                .append($('<span class="ozi-editor-classes-check" aria-hidden="true"></span>'))
                .append($('<span class="ozi-editor-classes-label"></span>').text(def.label));
            $dropdown.append($item);
        });

        self.$classDropdown = $dropdown;
        $wrap.append($btn).append($dropdown);
        return $wrap;
    };

    OziEditor.prototype._toggleClassDropdown = function (forceClose) {
        var self = this;
        if (!self.$classDropdown) return;

        var isOpen = self.$classDropdown.is(':visible');

        if (forceClose || isOpen) {
            self.$classDropdown.hide();
            self.$wrap.find('.ozi-editor-btn--classes').attr('aria-expanded', 'false');
            return;
        }

        self._updateClassDropdownChecks();
        self.$classDropdown.show();
        self.$wrap.find('.ozi-editor-btn--classes').attr('aria-expanded', 'true');
    };

    OziEditor.prototype._updateClassDropdownChecks = function () {
        var self = this;
        if (!self.$classDropdown) return;

        var activeClasses = self._getActiveClasses();

        self.$classDropdown.find('[data-ozi-class]').each(function () {
            var cls = $(this).attr('data-ozi-class');
            $(this).toggleClass('ozi-editor-classes-item--active', activeClasses.indexOf(cls) > -1);
        });
    };

    OziEditor.prototype._getActiveClasses = function () {
        var self   = this;
        var active = [];
        var allCls = self.classDefs.map(function (d) { return d.cls; });

        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return active;

        var node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;

        while (node && node !== self.$content[0]) {
            var cls = String(node.className || '');
            cls.split(/\s+/).forEach(function (c) {
                c = c.trim();
                if (c && allCls.indexOf(c) > -1 && active.indexOf(c) === -1) active.push(c);
            });
            node = node.parentNode;
        }

        return active;
    };

    OziEditor.prototype._applyClass = function (cls) {
        var self = this;
        var sel  = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        var range = sel.getRangeAt(0);

        if (range.collapsed) {
            var block = self._getClosestBlockElement();
            if (!block) return;
            self._toggleClassOnElement(block, cls);
            self._saveSelection();
            self._syncToTextarea();
            self.emitChange();
            return;
        }

        var blocks = self._getBlocksInRange(range);

        if (blocks.length > 1) {
            blocks.forEach(function (b) { self._toggleClassOnElement(b, cls); });
            self._syncToTextarea();
            self.emitChange();
            return;
        }

        var ancestor = range.commonAncestorContainer;
        if (ancestor.nodeType === 3) ancestor = ancestor.parentNode;
        var $existingSpan = $(ancestor).closest('span.' + cls, self.$content[0]);

        if ($existingSpan.length) {
            var $parent = $existingSpan.parent();
            $existingSpan.replaceWith($existingSpan.contents());
            $parent[0] && $parent[0].normalize();
        } else {
            try {
                var span = document.createElement('span');
                span.className = cls;
                range.surroundContents(span);
            } catch (e) {
                var frag   = range.extractContents();
                var spanFb = document.createElement('span');
                spanFb.className = cls;
                spanFb.appendChild(frag);
                range.insertNode(spanFb);
            }
        }

        self._saveSelection();
        self._syncToTextarea();
        self.emitChange();
    };

    OziEditor.prototype._toggleClassOnElement = function (el, cls) {
        var classes = String(el.className || '').split(/\s+/).filter(Boolean);
        var idx = classes.indexOf(cls);
        if (idx > -1) { classes.splice(idx, 1); } else { classes.push(cls); }
        el.className = classes.join(' ').trim();
    };

    OziEditor.prototype._getBlocksInRange = function (range) {
        var self    = this;
        var results = [];
        var BLOCK   = ['P','H1','H2','H3','H4','H5','H6','LI','TD','TH','PRE','BLOCKQUOTE'];

        $(self.$content[0]).find(BLOCK.join(',').toLowerCase()).each(function () {
            var node      = this;
            var nodeRange = document.createRange();
            nodeRange.selectNode(node);
            if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 1 &&
                range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > -1) {
                results.push(node);
            }
        });

        return results;
    };

    /* ─────────────────────────────────────────────
     * [14] CARREGAMENTO DE ÍCONES SVG
     * ───────────────────────────────────────────── */

    OziEditor.prototype._loadIcons = function () {
        var self = this;
        var h    = _h();

        var _textFallback = function ($iconEl, tool) {
            if (/^h[1-6]$/.test(tool))  { $iconEl.html('<strong>' + tool.toUpperCase() + '</strong>'); }
            else if (tool === 'heading') { $iconEl.html('H'); }
            else if (tool === 'classes') { $iconEl.html('&#127991;'); }
            else                         { $iconEl.text(tool); }
        };

        self.$toolbar.find('[data-ozi-editor-tool]').each(function () {
            var tool    = $(this).attr('data-ozi-editor-tool');
            var meta    = TOOL_META[tool];
            if (!meta) return;

            var $iconEl = $(this).find('.ozi-editor-btn-icon');

            if (!h.icon) { _textFallback($iconEl, tool); return; }

            h.icon($iconEl, meta.icon, {
                plugin:   'editor',
                fallback: meta.labelKey.split('.').pop()
            });
        });
    };

    /* ─────────────────────────────────────────────
     * [15] CONVERSORES — hooks para ozi-editor-md.js
     * ───────────────────────────────────────────── */

    OziEditor.prototype._convertIn = function (raw) {
        if (this.editorType === 'md' && _converters.mdToHtml) {
            return _converters.mdToHtml(raw);
        }
        return raw;
    };

    OziEditor.prototype._convertOut = function (html) {
        if (this.editorType === 'md' && _converters.htmlToMd) {
            return _converters.htmlToMd(html);
        }
        return html;
    };

    /* ─────────────────────────────────────────────
     * [16] SINCRONIZAÇÃO TEXTAREA ↔ CONTENT
     * ───────────────────────────────────────────── */

    OziEditor.prototype._syncFromTextarea = function () {
        var raw  = this.$textarea.val() || '';
        var html = this._convertIn(raw);
        this.$content.html(_sanitizeHtml(html));
    };

    OziEditor.prototype._syncToTextarea = function () {
        if (this.isSourceMode) {
            this.$textarea.val(this.$source.val());
            return;
        }
        var html = this.$content.html();
        this.$textarea.val(this._convertOut(html));
    };

    /* ─────────────────────────────────────────────
     * [17] HELPERS DE SELEÇÃO E PARÁGRAFO
     * ───────────────────────────────────────────── */

    OziEditor.prototype._saveSelection = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        var range = sel.getRangeAt(0);
        if (!this.$content[0].contains(range.commonAncestorContainer)) return;
        this._savedRange = range.cloneRange();
    };

    OziEditor.prototype._restoreSelection = function () {
        if (!this._savedRange) return;
        var sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(this._savedRange);
    };

    OziEditor.prototype._getClosestSelectionNode = function (tagNames) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        var node = sel.anchorNode;
        if (!node) return null;
        if (node.nodeType === 3) node = node.parentNode;
        tagNames = tagNames.map(function (t) { return t.toUpperCase(); });
        while (node && node !== this.$content[0]) {
            if (tagNames.indexOf(String(node.tagName || '').toUpperCase()) !== -1) return node;
            node = node.parentNode;
        }
        return null;
    };

    OziEditor.prototype._getClosestBlockElement = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        var node = sel.anchorNode;
        if (!node) return null;
        if (node.nodeType === 3) node = node.parentNode;
        var blockTags = ['P','H1','H2','H3','H4','H5','H6','DIV','LI','TD','TH','PRE','BLOCKQUOTE'];
        while (node && node !== this.$content[0]) {
            if (blockTags.indexOf(String(node.tagName || '').toUpperCase()) !== -1) return node;
            node = node.parentNode;
        }
        return null;
    };

    OziEditor.prototype._getRootInlineNodes = function () {
        var result    = [];
        var root      = this.$content[0];
        if (!root) return result;
        var blockTags = ['P','H1','H2','H3','H4','H5','H6','DIV','UL','OL','LI','PRE','TABLE','TBODY','THEAD','TR','TD','TH','BLOCKQUOTE'];
        Array.prototype.slice.call(root.childNodes || []).forEach(function (node) {
            if (node.nodeType === 3) {
                if (String(node.nodeValue || '').trim() !== '') result.push(node);
                return;
            }
            if (node.nodeType !== 1) return;
            if (blockTags.indexOf(String(node.tagName || '').toUpperCase()) !== -1) return;
            result.push(node);
        });
        return result;
    };

    OziEditor.prototype._wrapRootInlineContentInParagraph = function () {
        var root = this.$content[0];
        if (!root) return null;
        var inlineNodes = this._getRootInlineNodes();
        if (!inlineNodes.length) return null;
        var p = document.createElement('p');
        inlineNodes.forEach(function (node) { p.appendChild(node); });
        root.insertBefore(p, root.firstChild);
        return p;
    };

    OziEditor.prototype._insertHtmlAtCursor = function (html) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) { this.$content.append(html); return; }
        var range = sel.getRangeAt(0);
        range.deleteContents();
        var temp = document.createElement('div');
        temp.innerHTML = html;
        var frag = document.createDocumentFragment();
        var lastNode = null, node;
        while ((node = temp.firstChild)) { lastNode = frag.appendChild(node); }
        range.insertNode(frag);
        if (lastNode) {
            range = range.cloneRange();
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    };

    OziEditor.prototype._ensureBlockForAlignment = function () {
        var block = this._getClosestBlockElement();
        if (block) return block;
        block = this._wrapRootInlineContentInParagraph();
        if (block) return block;
        this._insertHtmlAtCursor('<p><br></p>');
        return this._getClosestBlockElement();
    };

    /* ─────────────────────────────────────────────
     * [18] EXECUÇÃO DE FERRAMENTAS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._runTool = function (tool) {
        var meta = TOOL_META[tool];
        if (!meta) return;

        if (tool === 'classes') return;
        if (tool === 'heading') return;

        this.$content.focus();

        if (meta.execCmd) {
            document.execCommand(meta.execCmd, false, null);
            this._saveSelection();
            this._syncToTextarea();
            this._updateToolbarState();
            this.emitChange();
            return;
        }

        switch (tool) {
            case 'codeblock': this._toggleCodeBlock();         break;
            case 'source':    this._toggleSourceMode();        break;
            case 'table':     this._insertTable();             break;
            case 'clear':     this._clearFormat();             break;
            case 'left':      this._applyTextAlign('left');    break;
            case 'center':    this._applyTextAlign('center');  break;
            case 'right':     this._applyTextAlign('right');   break;
            case 'h1': case 'h2': case 'h3':
            case 'h4': case 'h5': case 'h6':
                this._toggleHeading(tool); break;
        }

        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    /* ─────────────────────────────────────────────
     * [19] HEADING / CODEBLOCK / TABLE / CLEAR / ALIGN
     * ───────────────────────────────────────────── */

    OziEditor.prototype._toggleHeading = function (level) {
        var block = this._getClosestBlockElement();
        if (!block) {
            block = this._wrapRootInlineContentInParagraph();
            if (!block) { this._insertHtmlAtCursor('<p><br></p>'); block = this._getClosestBlockElement(); }
        }
        if (!block) return;

        var currentTag = String(block.tagName || '').toLowerCase();
        var targetTag  = currentTag === level ? 'p' : level;
        var newBlock   = document.createElement(targetTag);

        if (block.className)                      newBlock.className = block.className;
        if (block.style && block.style.textAlign) newBlock.style.textAlign = block.style.textAlign;

        while (block.firstChild) newBlock.appendChild(block.firstChild);
        block.parentNode.replaceChild(newBlock, block);

        var sel = window.getSelection();
        if (sel) {
            var range = document.createRange();
            range.selectNodeContents(newBlock);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        this._saveSelection();
    };

    OziEditor.prototype._toggleCodeBlock = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        var node = sel.getRangeAt(0).commonAncestorContainer;
        var $pre = $(node).closest('pre', this.$content[0]);
        if ($pre.length) {
            $pre.replaceWith($pre.html());
        } else {
            var range = sel.getRangeAt(0);
            var pre   = document.createElement('pre');
            var code  = document.createElement('code');
            try { code.appendChild(range.extractContents()); }
            catch (e) { code.textContent = sel.toString(); }
            pre.appendChild(code);
            range.insertNode(pre);
        }
    };

    OziEditor.prototype._insertTable = function () {
        document.execCommand('insertHTML', false,
            '<table><tbody>' +
            '<tr><td><br></td><td><br></td></tr>' +
            '<tr><td><br></td><td><br></td></tr>' +
            '</tbody></table><p><br></p>'
        );
    };

    OziEditor.prototype._clearFormat = function () {
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
        var sel = window.getSelection();
        if (sel && sel.rangeCount) {
            var node = sel.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === 3) node = node.parentNode;
            $(node).removeAttr('style');
        }
    };

    OziEditor.prototype._applyTextAlign = function (align) {
        this._restoreSelection();
        var block = this._ensureBlockForAlignment();
        if (!block) return;
        block.style.textAlign = align;
        this._saveSelection();
    };

    /* ─────────────────────────────────────────────
     * [20] MODO SOURCE
     * Source exibe no formato nativo do type:
     *   type=html → HTML bruto
     *   type=md   → Markdown
     * ───────────────────────────────────────────── */

    OziEditor.prototype._toggleSourceMode = function () {
        this.isSourceMode ? this._exitSourceMode() : this._enterSourceMode();
    };

    OziEditor.prototype._enterSourceMode = function () {
        this._syncToTextarea();
        this.$source.val(this.$textarea.val()).show();
        this.$content.hide();
        this.$toolbar.find('[data-ozi-editor-tool="source"]').addClass('ozi-editor-btn--active');
        this.isSourceMode = true;
    };

    OziEditor.prototype._exitSourceMode = function () {
        var raw  = this.$source.val();
        var html = this._convertIn(raw);
        this.$content.html(_sanitizeHtml(html)).show();
        this.$source.hide();
        this.$toolbar.find('[data-ozi-editor-tool="source"]').removeClass('ozi-editor-btn--active');
        this.isSourceMode = false;
        this._syncToTextarea();
    };

    /* ─────────────────────────────────────────────
     * [21] ESTADO DA TOOLBAR
     * ───────────────────────────────────────────── */

    OziEditor.prototype._updateToolbarState = function () {
        var self = this;

        ['bold', 'italic', 'underline'].forEach(function (cmd) {
            var active = false;
            try { active = document.queryCommandState(cmd); } catch (e) {}
            self.$toolbar.find('[data-ozi-editor-tool="' + cmd + '"]').toggleClass('ozi-editor-btn--active', active);
        });

        var inCode = false;
        var sel = window.getSelection();
        if (sel && sel.rangeCount) {
            var node = sel.getRangeAt(0).commonAncestorContainer;
            inCode = !!($(node).closest('pre, code', self.$content[0]).length);
        }
        self.$toolbar.find('[data-ozi-editor-tool="codeblock"]').toggleClass('ozi-editor-btn--active', inCode);

        ['left', 'center', 'right'].forEach(function (align) {
            var active = false;
            try { active = document.queryCommandState('justify' + align.charAt(0).toUpperCase() + align.slice(1)); } catch (e) {}
            self.$toolbar.find('[data-ozi-editor-tool="' + align + '"]').toggleClass('ozi-editor-btn--active', active);
        });

        var block      = self._getClosestBlockElement();
        var currentTag = block ? String(block.tagName || '').toLowerCase() : '';
        self.$toolbar.find('.ozi-editor-btn--heading').toggleClass('ozi-editor-btn--active', /^h[1-6]$/.test(currentTag));

        if (self.$headingDropdown && self.$headingDropdown.is(':visible')) {
            self._updateHeadingDropdownChecks();
        }
        if (self.$classDropdown && self.$classDropdown.is(':visible')) {
            self._updateClassDropdownChecks();
        }
    };

    /* ─────────────────────────────────────────────
     * [22] EVENTOS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._bindEvents = function () {
        var self = this;

        self.$wrap.on('mousedown' + self.ns,
            '.ozi-editor-btn:not(.ozi-editor-btn--classes):not(.ozi-editor-btn--incompatible)',
            function (e) {
                e.preventDefault();
                if (!self.isDisabled) {
                    self._restoreSelection();
                    self._runTool($(this).attr('data-ozi-editor-tool'));
                }
            }
        );

        self.$wrap.on('mousedown' + self.ns, '.ozi-editor-btn--heading', function (e) {
            e.preventDefault();
            if (!self.isDisabled) {
                self._toggleClassDropdown(true);
                self._toggleHeadingDropdown();
            }
        });

        self.$wrap.on('mousedown' + self.ns, '.ozi-editor-heading-item', function (e) {
            e.preventDefault();
            if (self.isDisabled) return;
            var level = $(this).attr('data-ozi-heading');
            self._toggleHeadingDropdown(true);
            self._restoreSelection();
            self._toggleHeading(level);
            self._syncToTextarea();
            self._updateToolbarState();
            self.emitChange();
        });

        self.$wrap.on('mousedown' + self.ns, '.ozi-editor-btn--classes', function (e) {
            e.preventDefault();
            if (!self.isDisabled) {
                self._toggleHeadingDropdown(true);
                self._toggleClassDropdown();
            }
        });

        self.$wrap.on('mousedown' + self.ns, '.ozi-editor-classes-item', function (e) {
            e.preventDefault();
            if (self.isDisabled) return;
            var cls = $(this).attr('data-ozi-class');
            self._toggleClassDropdown(true);
            self._restoreSelection();
            self._applyClass(cls);
            self._updateToolbarState();
        });

        $(document).on('mousedown' + self.ns, function (e) {
            if (self.$headingDropdown && self.$headingDropdown.is(':visible')) {
                if (!$(e.target).closest('.ozi-editor-heading-wrap').length) {
                    self._toggleHeadingDropdown(true);
                }
            }
            if (self.$classDropdown && self.$classDropdown.is(':visible')) {
                if (!$(e.target).closest('.ozi-editor-classes-wrap').length) {
                    self._toggleClassDropdown(true);
                }
            }
        });

        self.$wrap.on('keyup' + self.ns + ' mouseup' + self.ns, '.ozi-editor-content', function () {
            self._saveSelection();
            self._updateToolbarState();
        });

        self.$wrap.on('focus' + self.ns, '.ozi-editor-content', function () {
            self._saveSelection();
        });

        self.$wrap.on('input' + self.ns, '.ozi-editor-content', function () {
            self._saveSelection();
            self._syncToTextarea();
            self.emitChange();
        });

        self.$wrap.on('keydown' + self.ns, '.ozi-editor-content', function (e) {
            if (self.isDisabled || self.isSourceMode) return;
            if (e.key === 'Enter' && !e.shiftKey) {
                var inCode  = self._getClosestSelectionNode(['PRE', 'CODE']);
                var inList  = self._getClosestSelectionNode(['UL', 'OL', 'LI']);
                var inTable = self._getClosestSelectionNode(['TD', 'TH']);
                if (!inCode && !inList && !inTable) {
                    e.preventDefault();
                    try { document.execCommand('insertParagraph', false, null); }
                    catch (err) { self._insertHtmlAtCursor('<p><br></p>'); }
                    setTimeout(function () {
                        self._saveSelection();
                        self._syncToTextarea();
                        self._updateToolbarState();
                    }, 0);
                }
            }
        });

        self.$wrap.on('paste' + self.ns, '.ozi-editor-content', function (e) {
            e.preventDefault();
            var clip = e.originalEvent.clipboardData || window.clipboardData;
            var html = clip.getData('text/html');
            var text = clip.getData('text/plain');
            if (html)      { document.execCommand('insertHTML', false, _sanitizeHtml(html)); }
            else if (text) { document.execCommand('insertText', false, text); }
            self._saveSelection();
            self._syncToTextarea();
            self.emitChange();
        });

        self.$wrap.on('input' + self.ns, '.ozi-editor-source', function () {
            self._syncToTextarea();
            self.emitChange();
        });

        self.$textarea.closest('form').on('submit' + self.ns, function () {
            self._syncToTextarea();
        });
    };

    /* ─────────────────────────────────────────────
     * [23] VALIDAÇÃO
     * ───────────────────────────────────────────── */

    OziEditor.prototype.isValid = function () {
        if (!this.isRequired) return true;
        var text = $('<div>').html(this.$textarea.val() || '').text().trim();
        return text.length > 0;
    };

    OziEditor.prototype._markInvalid = function () {
        this.$wrap.addClass(_classMap('invalid', 'ozi-invalid'));
        this.$feedback.text(this.requiredMessage).show();
    };

    OziEditor.prototype._clearInvalid = function () {
        this.$wrap
            .removeClass(_classMap('invalid', 'ozi-invalid'))
            .removeClass(_classMap('valid',   'ozi-valid'));
        this.$feedback.hide();
    };

    OziEditor.prototype.validate = function (focusOnError) {
        var valid = this.isValid();
        if (!valid) {
            this._markInvalid();
            if (focusOnError) this.$content.focus();
        } else {
            this._clearInvalid();
            if (this.isRequired) this.$wrap.addClass(_classMap('valid', 'ozi-valid'));
        }
        return valid;
    };

    OziEditor.prototype.setState = function (state) {
        this._clearInvalid();
        if (state === 'invalid') this._markInvalid();
        if (state === 'valid')   this.$wrap.addClass(_classMap('valid', 'ozi-valid'));
    };

    /* ─────────────────────────────────────────────
     * [24] DISABLED
     * ───────────────────────────────────────────── */

    OziEditor.prototype._setDisabled = function (state) {
        this.isDisabled = !!state;
        this.$content.attr('contenteditable', state ? 'false' : 'true');
        this.$toolbar.find('.ozi-editor-btn').prop('disabled', state);
        this.$wrap.toggleClass('ozi-editor--disabled', state);
    };

    /* ─────────────────────────────────────────────
     * [25] I/O PÚBLICO
     *
     * getValue → retorna no formato nativo do type
     * setValue → recebe no formato nativo do type
     * emitChange → inclui type no payload
     * ───────────────────────────────────────────── */

    OziEditor.prototype.getValue = function () {
        this._syncToTextarea();
        return this.$textarea.val() || '';
    };

    OziEditor.prototype.setValue = function (v) {
        var html      = this._convertIn(v || '');
        var sanitized = _sanitizeHtml(html);
        this.$content.html(sanitized);
        this.$textarea.val(v || '');
        if (this.isSourceMode) this.$source.val(v || '');
        this.emitChange();
    };

    OziEditor.prototype.emitChange = function () {
        var payload = { key: this.key, value: this.$textarea.val(), type: this.editorType };
        this.$textarea.trigger('ozi:change', [payload, this]);
        if (typeof CustomEvent === 'function') {
            this.$textarea[0].dispatchEvent(new CustomEvent('ozi:change', { bubbles: true, detail: payload }));
        }
    };

    /* ─────────────────────────────────────────────
     * [26] API ESTÁTICA — OZI.components.editor
     *
     * [3.1.0] _resolve — busca key nos dois atributos
     * [3.1.0] init     — seletor SELECTOR cobre os dois tipos
     * [3.1.0] init     — type detectado pelo atributo presente
     * ───────────────────────────────────────────── */

    function _resolve(selectorOrKey) {
        if (!selectorOrKey) return null;

        /* busca direta por key no registry */
        if (typeof selectorOrKey === 'string' && _instances[selectorOrKey]) {
            return _instances[selectorOrKey];
        }

        /* busca por elemento DOM */
        var el  = selectorOrKey instanceof $ ? selectorOrKey[0] : selectorOrKey;
        if (!el) return null;

        /* [3.1.0] lê key dos dois atributos possíveis */
        var key = $(el).attr('data-ozi-editor-html') || $(el).attr('data-ozi-editor-md');
        return key ? (_instances[_trim(String(key))] || null) : null;
    }

    var editorAPI = {

        /*
         * init(root, type)
         *
         * root — elemento raiz de busca (null = body inteiro)
         * type — 'html' | 'md' | undefined (undefined = todos permitidos)
         *
         * [3.1.0] Seletor: SELECTOR = '[data-ozi-editor-html], [data-ozi-editor-md]'
         * [3.1.0] Type detectado pelo atributo presente no elemento
         *
         * No boot: init(null, 'html') — só html
         * Após registerConverters: init(null, 'md') — só md
         * afterRender: init(root) — sem filtro, guarda interna protege md sem conversores
         */
        init: function (root, type) {
            var $targets;
            if (root) {
                var $root = $(root);
                $targets  = $root.find(SELECTOR);
                if ($root.is(SELECTOR)) $targets = $targets.add($root);
            } else {
                $targets = $('body').find(SELECTOR);
            }

            $targets.each(function () {
                /* [3.1.0] type detectado pelo atributo presente */
                var $el    = $(this);
                var elType = $el.attr('data-ozi-editor-md') !== undefined ? 'md' : 'html';

                /* flag de inicialização por type — permite html e md no mesmo elemento
                 * (caso raro mas não quebra) */
                var initFlag = 'ozi-editor-' + elType + '-initialized';
                if ($el.data(initFlag)) return;

                /* filtra por type quando solicitado */
                if (type && elType !== type) return;

                /* elementos md sem conversores aguardam silenciosamente */
                if (elType === 'md' && !_converters.mdToHtml) return;

                try {
                    var inst = new OziEditor(this);
                    inst.init();
                } catch (e) {
                    console.warn('[OZI:editor] init erro:', e.message);
                }
            });
        },

        get:     function (k) { return _resolve(k); },
        getAll:  function ()  { return Object.values(_instances); },
        destroy: function (k) { var i = _resolve(k); if (i) i.destroy(); },
        reload:  function (k) { var i = _resolve(k); return i ? i.reload() : null; },

        value: function (k, v) {
            var i = _resolve(k);
            if (!i) return undefined;
            if (v === undefined) return i.getValue();
            i.setValue(v);
        },

        disable: function (k) { var i = _resolve(k); if (i) i._setDisabled(true); },
        enable:  function (k) { var i = _resolve(k); if (i) i._setDisabled(false); },

        /*
         * registerConverters — chamado por ozi-editor-md.js
         * Após registro inicializa todos os [data-ozi-editor-md] pendentes.
         */
        registerConverters: function (converters) {
            if (typeof converters.mdToHtml === 'function') _converters.mdToHtml = converters.mdToHtml;
            if (typeof converters.htmlToMd  === 'function') _converters.htmlToMd  = converters.htmlToMd;
            editorAPI.init(null, 'md');
        },

        /* constantes para inspeção/debug */
        DEFAULT_TOOLS_HTML:   DEFAULT_TOOLS_HTML,
        DEFAULT_TOOLS_MD:     DEFAULT_TOOLS_MD,
        BUILT_IN_THEMES_HTML: BUILT_IN_THEMES_HTML,
        BUILT_IN_THEMES_MD:   BUILT_IN_THEMES_MD,
        BLOCKED_IN_MD:        BLOCKED_IN_MD
    };

    /* ─────────────────────────────────────────────
     * [27] BOOT
     * ───────────────────────────────────────────── */

    function _registerAdapter() {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate || typeof validate.registerAdapter !== 'function') return;

        /* [3.1.0] match cobre os dois atributos */
        validate.registerAdapter({
            name:     'ozi-editor',
            match:    function ($el) { return $el.is(SELECTOR); },
            isValid:  function ($el) { var i = _resolve($el[0]); return i ? i.isValid()  : true; },
            getValue: function ($el) { var i = _resolve($el[0]); return i ? i.getValue() : ''; },
            setState: function ($el, state) { var i = _resolve($el[0]); if (i) i.setState(state); }
        });
    }

    function _boot() {
        /* inicializa apenas html — md aguarda ozi-editor-md.js */
        editorAPI.init(null, 'html');
        _registerAdapter();

        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.editor = editorAPI;
        }

        if (OZI && OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:editor', function (root) {
                editorAPI.init(root);
            });
        }
    }

    /* namespace legado — compatibilidade */
    window.OziEditor = {
        init:    function (root) { editorAPI.init(root); },
        get:     editorAPI.get,
        value:   editorAPI.value,
        destroy: editorAPI.destroy,
        reload:  editorAPI.reload
    };

    /* expoe OZI.components.editor sincronamente — ozi-editor.plugin.js e ozi-editor-md.js
     * podem ser executados via OZI.ready() antes de $(fn){_boot()} rodar (jQuery 3.x async) */
    (function () {
        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.editor = editorAPI;
        }
    }());

    $(function () { _boot(); });

})(jQuery, window, document);