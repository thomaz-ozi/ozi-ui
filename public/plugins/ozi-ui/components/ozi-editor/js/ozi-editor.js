/**
 * ------------------------------------------
 * ozi-editor
 * ------------------------------------------
 * Ver: 4.0.0
 * 2026-07-04
 *
 * Editor WYSIWYG (contenteditable) com toolbar declarativa, modos html/md,
 * dropdowns de heading/classes, source view, sanitizacao e validacao.
 * Instance-based (registry por key). Conversores MD via ozi-editor-md.js.
 *
 * Dependencias: ozi.js (OZI.helpers, OZI.lang, OZI.hooks, OZI.modules.validate) —
 *   zero jQuery (contrato de camadas v2 §2). O motor (Selection/Range/execCommand/
 *   contentEditable) sempre foi nativo; a migracao trocou o encanamento de DOM/eventos.
 * Expoe: OZI.components.editor, window.OziEditor (compat)
 * Eventos: ozi:init, ozi:change, ozi:destroy (CustomEvent nativos, contrato v2)
 *
 * Changelog:
 *   - v4.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Zero jQuery. Build de UI via createElement; delegacao de eventos nativa
 *         em cada wrap (addEventListener + e.target.closest), rastreada por
 *         instancia para o destroy(). ':visible' -> checagem de style.display.
 *       - `.closest(sel, context)` 2-arg do jQuery -> Element.closest() nativo +
 *         guard content.contains() + normalizacao de text-node (nodeType 3).
 *       - Estado de init por-elemento migrado de $.data() para WeakMap (por type).
 *       - Fim do dual-dispatch: emitChange() emite SOMENTE CustomEvent via
 *         OZI.helpers.emit(). Payload passa a aderir ao contrato:
 *         { component:'ozi-editor', name:key, value, type, source }. Sem shim —
 *         nenhum consumidor jQuery-posicional de ozi:change do editor no Central RH
 *         (verificado: unico listener generico e nativo e filtra o editor fora).
 *       - Adicionados ozi:init (pos-init da instancia) e ozi:destroy (no destroy()).
 *         source: 'user' na interacao, 'api' em setValue/destroy.
 *       - Adapter ozi-validate: declara nativeElement:true e recebe Element nativo
 *         (padrao do ozi-select F2#4). registerConverters/init(md) deferido via
 *         flag _booted (sem a fila $(fn)); ozi-editor-md.js migrado em separado.
 *
 *   Historico anterior (jQuery):
 *   - v3.1.1 FIX-MD-BOOT; v3.1.0 FEAT-7 (data-ozi-editor-html/md); v2.5.x timing;
 *     v2.4 type html|md; v2.3 themes; v2.1 headings/classes/tools; v2.0.2 fixes.
 */

(function (window, document) {
    'use strict';

    // ─────────────────────────────────────────────
    // [0] GUARD — singleton
    // ─────────────────────────────────────────────

    if (window.OziEditor) return;

    /* ─────────────────────────────────────────────
     * [1] REGISTRY E CONTADOR
     * ───────────────────────────────────────────── */

    var _instances = {};
    var _counter   = 0;

    /* estado de init por-elemento (substitui $.data), por type */
    var _initState = new WeakMap();
    function _isInited(el, type)      { var s = _initState.get(el); return !!(s && s[type]); }
    function _setInited(el, type, on) { var s = _initState.get(el); if (!s) { s = {}; _initState.set(el, s); } s[type] = !!on; }

    var _booted       = false;
    var _pendingMdInit = false;

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

    /* classList.add/remove aceitando string com multiplas classes (ex.: tailwind) */
    function _classListOp(el, classString, method) {
        if (!el || !classString) return;
        String(classString).trim().split(/\s+/).forEach(function (c) { if (c) el.classList[method](c); });
    }

    /* equivalente a $('<tag class>').attr({...}) */
    function _el(tag, className, attrs) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (attrs) Object.keys(attrs).forEach(function (k) {
            if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
        });
        return e;
    }

    /* jQuery :visible dos dropdowns — controlados por style.display inline */
    function _isShown(el) { return !!el && el.style.display !== 'none'; }

    function _emitEvent(el, name, detail) {
        var h = _h();
        if (h && typeof h.emit === 'function') { h.emit(el, name, detail); return; }
        if (typeof CustomEvent === 'function') el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
    }

    function _parseBool(el, attr, fallback) {
        var h = _h();
        if (h.parseBool) return h.parseBool(el, attr, fallback);
        var raw = el ? el.getAttribute(attr) : null;
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
     * [3] DEFAULT_TOOLS — padrao do autor por type
     * ───────────────────────────────────────────── */

    var DEFAULT_TOOLS_HTML = '[bold,italic,underline], [ul,ol], [left,center,right]; [heading,classes], table, clear, codeblock, source';
    var DEFAULT_TOOLS_MD   = '[bold,italic], [ul,ol]; heading; codeblock, table; source';

    var BLOCKED_IN_MD = { left: true, center: true, right: true, clear: true };

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

    /* CONTRATO DE CONVERSORES — preenchido por ozi-editor-md.js */
    var _converters = { mdToHtml: null, htmlToMd: null };

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
            if (idx > -1) return { cls: part.slice(0, idx).trim(), label: part.slice(idx + 1).trim() };
            return { cls: part, label: part };
        }).filter(Boolean);
    }

    /* ─────────────────────────────────────────────
     * [7] SANITIZACAO DE HTML
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
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        _cleanNode(tmp);
        return tmp.innerHTML;
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
     * ───────────────────────────────────────────── */

    function OziEditor(element) {
        this.textarea = element;

        /* [FEAT-7] detecta type pelo atributo presente */
        var keyHtml = this.textarea.getAttribute('data-ozi-editor-html');
        var keyMd   = this.textarea.getAttribute('data-ozi-editor-md');

        if (keyHtml !== null) {
            this.editorType = 'html';
            this.key        = _trim(String(keyHtml));
        } else if (keyMd !== null) {
            this.editorType = 'md';
            this.key        = _trim(String(keyMd));
        } else {
            throw new Error(
                '[OZI:editor] Atributo obrigatório ausente.\n' +
                'Use data-ozi-editor-html="key" ou data-ozi-editor-md="key"'
            );
        }

        if (!this.key) {
            throw new Error('[OZI:editor] Chave obrigatória.\nExemplo: data-ozi-editor-html="descricao"');
        }

        this.uid = 'ozi-editor-' + (++_counter);

        var pluginConf = window.OZI && window.OZI.conf &&
            window.OZI.conf.components && window.OZI.conf.components.editor;

        var _devThemesByType = pluginConf && pluginConf.themes;
        var _devThemes       = _devThemesByType && _devThemesByType[this.editorType];
        var _builtIn         = this.editorType === 'md' ? BUILT_IN_THEMES_MD : BUILT_IN_THEMES_HTML;

        var _themeName   = this.textarea.getAttribute('data-ozi-editor-theme');
        var _themeStr    = _resolveTheme(_themeName, _devThemes, _builtIn);
        var _defTheme    = pluginConf && pluginConf.defaultTheme;
        var _defThemeStr = _resolveTheme(_defTheme, _devThemes, _builtIn);
        var _defaultTools = this.editorType === 'md' ? DEFAULT_TOOLS_MD : DEFAULT_TOOLS_HTML;

        this.toolsRaw =
            _themeStr                                          ||  /* 1. theme no elemento */
            this.textarea.getAttribute('data-ozi-editor-tools') ||  /* 2. tools direto */
            _defThemeStr                                       ||  /* 3. defaultTheme do conf */
            (pluginConf && pluginConf.defaultTools)            ||  /* 4. defaultTools (compat) */
            _defaultTools;                                          /* 5. fallback por type */

        this.height      = this.textarea.getAttribute('data-ozi-editor-height') || '200px';
        this.placeholder = this.textarea.getAttribute('data-ozi-editor-placeholder') || _t('editor.placeholder');
        this.uicolor     = this.textarea.getAttribute('data-ozi-editor-uicolor')
            || (pluginConf && pluginConf.uicolor)
            || 'var(--ozi-color-primary)';

        this.isDisabled      = _parseBool(this.textarea, 'data-ozi-editor-disabled', false);
        this.isRequired      = _parseBool(this.textarea, 'data-ozi-editor-required', false);
        this.requiredMessage = this.textarea.getAttribute('data-ozi-editor-required-message') || _t('common.required');

        this.classDefs = _parseClassDefs(this.textarea.getAttribute('data-ozi-editor-class') || '');

        this.toolsLayout  = _parseToolsLayout(this.toolsRaw);
        this.isSourceMode = false;
        this._savedRange  = null;
        this._listeners   = [];

        this.wrap            = null;
        this.toolbar         = null;
        this.content         = null;
        this.source          = null;
        this.feedback        = null;
        this.headingDropdown = null;
        this.classDropdown   = null;
    }

    /* rastreia listeners para remocao no destroy */
    OziEditor.prototype._on = function (target, type, handler) {
        target.addEventListener(type, handler);
        this._listeners.push({ target: target, type: type, handler: handler });
    };

    /* ─────────────────────────────────────────────
     * [9] LIFECYCLE
     * ───────────────────────────────────────────── */

    OziEditor.prototype.init = function () {
        if (_isInited(this.textarea, this.editorType)) return;
        _setInited(this.textarea, this.editorType, true);

        this._buildUI();
        this._loadIcons();
        this._syncFromTextarea();
        this._bindEvents();
        this._updateToolbarState();

        if (this.isDisabled) this._setDisabled(true);

        _instances[this.key] = this;

        _emitEvent(this.textarea, 'ozi:init', {
            component: 'ozi-editor', name: this.key,
            value: this.textarea.value, type: this.editorType, source: 'api'
        });
    };

    OziEditor.prototype.destroy = function () {
        (this._listeners || []).forEach(function (l) { l.target.removeEventListener(l.type, l.handler); });
        this._listeners = [];
        if (this.wrap && this.wrap.parentNode) this.wrap.parentNode.removeChild(this.wrap);
        this.textarea.style.display = '';
        _setInited(this.textarea, this.editorType, false);
        delete _instances[this.key];
        _emitEvent(this.textarea, 'ozi:destroy', {
            component: 'ozi-editor', name: this.key,
            value: null, type: this.editorType, source: 'api'
        });
    };

    OziEditor.prototype.reload = function () {
        var el = this.textarea;
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

        self.wrap = _el('div', 'ozi-editor-wrap', { 'data-ozi-editor-type': self.editorType });
        self.wrap.style.setProperty('--ozi-editor-uicolor', self.uicolor);

        self.toolbar = _el('div', 'ozi-editor-toolbar');
        self._buildToolbarButtons();

        self.content = _el('div', 'ozi-editor-content', {
            contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true',
            'data-placeholder': self.placeholder
        });
        self.content.style.minHeight = self.height;

        var sourcePlaceholder = self.editorType === 'md' ? _t('editor.source.md') : _t('editor.source');
        self.source = _el('textarea', 'ozi-editor-source', { placeholder: sourcePlaceholder });
        self.source.style.minHeight = self.height;
        self.source.style.display = 'none';

        var feedbackClass = _classMap('feedback', 'ozi-feedback');
        self.feedback = _el('div', feedbackClass + ' ozi-editor-feedback');
        self.feedback.style.display = 'none';

        self.wrap.appendChild(self.toolbar);
        self.wrap.appendChild(self.content);
        self.wrap.appendChild(self.source);
        self.wrap.appendChild(self.feedback);

        self.textarea.style.display = 'none';
        self.textarea.insertAdjacentElement('afterend', self.wrap);
    };

    /* ─────────────────────────────────────────────
     * [11] TOOLBAR BUTTONS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildToolbarButtons = function () {
        var self = this;

        self.toolsLayout.forEach(function (row) {
            var rowEl = _el('div', 'ozi-editor-toolbar-row');

            row.items.forEach(function (item) {
                if (item.type === 'group') {
                    var groupEl = _el('div', 'ozi-editor-toolbar-group');
                    item.tools.forEach(function (tool) {
                        var btn = self._buildToolButton(tool);
                        if (btn) groupEl.appendChild(btn);
                    });
                    if (groupEl.children.length) rowEl.appendChild(groupEl);
                } else if (item.type === 'tool') {
                    var btn = self._buildToolButton(item.tool);
                    if (btn) rowEl.appendChild(btn);
                }
            });

            if (rowEl.children.length) self.toolbar.appendChild(rowEl);
        });
    };

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
        if (tool === 'source' && self.editorType === 'md') label = _t('editor.source.md');

        if (tool === 'heading') return self._buildHeadingButton(label);
        if (tool === 'classes') return self._buildClassesButton(label);

        var btn = _el('button', 'ozi-editor-btn', {
            type: 'button', 'data-ozi-editor-tool': tool, title: label, 'aria-label': label
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' }));
        return btn;
    };

    OziEditor.prototype._buildIncompatibleButton = function (tool, titleMsg) {
        var btn = _el('button', 'ozi-editor-btn ozi-editor-btn--incompatible', {
            type: 'button', 'data-ozi-editor-tool-blocked': tool,
            title: titleMsg, 'aria-label': titleMsg, 'aria-disabled': 'true'
        });
        btn.disabled = true;
        var span = _el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' });
        span.textContent = '?';
        btn.appendChild(span);
        return btn;
    };

    /* ─────────────────────────────────────────────
     * [12] DROPDOWN DE HEADINGS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildHeadingButton = function (label) {
        var self = this;

        var wrap = _el('div', 'ozi-editor-heading-wrap');
        var btn  = _el('button', 'ozi-editor-btn ozi-editor-btn--heading', {
            type: 'button', 'data-ozi-editor-tool': 'heading',
            title: label, 'aria-label': label, 'aria-haspopup': 'true', 'aria-expanded': 'false'
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' }));

        var dropdown = _el('div', 'ozi-editor-heading-dropdown', { role: 'menu' });
        dropdown.style.display = 'none';

        ['h1','h2','h3','h4','h5','h6'].forEach(function (level) {
            var item  = _el('button', 'ozi-editor-heading-item', { type: 'button', 'data-ozi-heading': level, role: 'menuitem' });
            var check = _el('span', 'ozi-editor-heading-check', { 'aria-hidden': 'true' });
            check.innerHTML = '&#10003;';
            var tagEl = _el('span', 'ozi-editor-heading-tag');   tagEl.textContent = level.toUpperCase();
            var lblEl = _el('span', 'ozi-editor-heading-label'); lblEl.textContent = _t('editor.' + level);
            item.appendChild(check); item.appendChild(tagEl); item.appendChild(lblEl);
            dropdown.appendChild(item);
        });

        self.headingDropdown = dropdown;
        wrap.appendChild(btn); wrap.appendChild(dropdown);
        return wrap;
    };

    OziEditor.prototype._toggleHeadingDropdown = function (forceClose) {
        var self = this;
        if (!self.headingDropdown) return;

        var isOpen = _isShown(self.headingDropdown);
        var hb     = self.wrap.querySelector('.ozi-editor-btn--heading');

        if (forceClose || isOpen) {
            self.headingDropdown.style.display = 'none';
            if (hb) hb.setAttribute('aria-expanded', 'false');
            return;
        }

        self._updateHeadingDropdownChecks();
        self.headingDropdown.style.display = '';
        if (hb) hb.setAttribute('aria-expanded', 'true');
    };

    OziEditor.prototype._updateHeadingDropdownChecks = function () {
        var self = this;
        if (!self.headingDropdown) return;

        var block      = self._getClosestBlockElement();
        var currentTag = block ? String(block.tagName || '').toLowerCase() : '';

        Array.prototype.forEach.call(self.headingDropdown.querySelectorAll('[data-ozi-heading]'), function (it) {
            it.classList.toggle('ozi-editor-heading-item--active', it.getAttribute('data-ozi-heading') === currentTag);
        });
    };

    /* ─────────────────────────────────────────────
     * [13] DROPDOWN DE CLASSES CUSTOMIZADAS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildClassesButton = function (label) {
        var self = this;
        if (!self.classDefs || !self.classDefs.length) return null;

        var wrap = _el('div', 'ozi-editor-classes-wrap');
        var btn  = _el('button', 'ozi-editor-btn ozi-editor-btn--classes', {
            type: 'button', 'data-ozi-editor-tool': 'classes',
            title: label, 'aria-label': label, 'aria-haspopup': 'true', 'aria-expanded': 'false'
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' }));

        var dropdown = _el('div', 'ozi-editor-classes-dropdown', { role: 'menu' });
        dropdown.style.display = 'none';

        self.classDefs.forEach(function (def) {
            var item = _el('button', 'ozi-editor-classes-item', { type: 'button', 'data-ozi-class': def.cls, role: 'menuitem' });
            item.appendChild(_el('span', 'ozi-editor-classes-check', { 'aria-hidden': 'true' }));
            var lblEl = _el('span', 'ozi-editor-classes-label'); lblEl.textContent = def.label;
            item.appendChild(lblEl);
            dropdown.appendChild(item);
        });

        self.classDropdown = dropdown;
        wrap.appendChild(btn); wrap.appendChild(dropdown);
        return wrap;
    };

    OziEditor.prototype._toggleClassDropdown = function (forceClose) {
        var self = this;
        if (!self.classDropdown) return;

        var isOpen = _isShown(self.classDropdown);
        var cb     = self.wrap.querySelector('.ozi-editor-btn--classes');

        if (forceClose || isOpen) {
            self.classDropdown.style.display = 'none';
            if (cb) cb.setAttribute('aria-expanded', 'false');
            return;
        }

        self._updateClassDropdownChecks();
        self.classDropdown.style.display = '';
        if (cb) cb.setAttribute('aria-expanded', 'true');
    };

    OziEditor.prototype._updateClassDropdownChecks = function () {
        var self = this;
        if (!self.classDropdown) return;

        var activeClasses = self._getActiveClasses();

        Array.prototype.forEach.call(self.classDropdown.querySelectorAll('[data-ozi-class]'), function (it) {
            it.classList.toggle('ozi-editor-classes-item--active', activeClasses.indexOf(it.getAttribute('data-ozi-class')) > -1);
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

        while (node && node !== self.content) {
            String(node.className || '').split(/\s+/).forEach(function (c) {
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
        var existingSpan = (ancestor && ancestor.closest) ? ancestor.closest('span.' + cls) : null;

        if (existingSpan && self.content.contains(existingSpan)) {
            var parent = existingSpan.parentNode;
            while (existingSpan.firstChild) parent.insertBefore(existingSpan.firstChild, existingSpan);
            parent.removeChild(existingSpan);
            if (parent) parent.normalize();
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

        Array.prototype.forEach.call(self.content.querySelectorAll(BLOCK.join(',').toLowerCase()), function (node) {
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
     * [14] CARREGAMENTO DE ICONES SVG
     * ───────────────────────────────────────────── */

    OziEditor.prototype._loadIcons = function () {
        var self = this;
        var h    = _h();

        var _textFallback = function (iconEl, tool) {
            if (/^h[1-6]$/.test(tool))    { iconEl.innerHTML = '<strong>' + tool.toUpperCase() + '</strong>'; }
            else if (tool === 'heading')  { iconEl.innerHTML = 'H'; }
            else if (tool === 'classes')  { iconEl.innerHTML = '&#127991;'; }
            else                          { iconEl.textContent = tool; }
        };

        Array.prototype.forEach.call(self.toolbar.querySelectorAll('[data-ozi-editor-tool]'), function (btn) {
            var tool = btn.getAttribute('data-ozi-editor-tool');
            var meta = TOOL_META[tool];
            if (!meta) return;

            var iconEl = btn.querySelector('.ozi-editor-btn-icon');
            if (!iconEl) return;

            if (!h.icon) { _textFallback(iconEl, tool); return; }

            h.icon(iconEl, meta.icon, { plugin: 'editor', fallback: meta.labelKey.split('.').pop() });
        });
    };

    /* ─────────────────────────────────────────────
     * [15] CONVERSORES — hooks para ozi-editor-md.js
     * ───────────────────────────────────────────── */

    OziEditor.prototype._convertIn = function (raw) {
        if (this.editorType === 'md' && _converters.mdToHtml) return _converters.mdToHtml(raw);
        return raw;
    };

    OziEditor.prototype._convertOut = function (html) {
        if (this.editorType === 'md' && _converters.htmlToMd) return _converters.htmlToMd(html);
        return html;
    };

    /* ─────────────────────────────────────────────
     * [16] SINCRONIZACAO TEXTAREA <-> CONTENT
     * ───────────────────────────────────────────── */

    OziEditor.prototype._syncFromTextarea = function () {
        var raw  = this.textarea.value || '';
        var html = this._convertIn(raw);
        this.content.innerHTML = _sanitizeHtml(html);
    };

    OziEditor.prototype._syncToTextarea = function () {
        if (this.isSourceMode) { this.textarea.value = this.source.value; return; }
        this.textarea.value = this._convertOut(this.content.innerHTML);
    };

    /* ─────────────────────────────────────────────
     * [17] HELPERS DE SELECAO E PARAGRAFO
     * ───────────────────────────────────────────── */

    OziEditor.prototype._saveSelection = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        var range = sel.getRangeAt(0);
        if (!this.content.contains(range.commonAncestorContainer)) return;
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
        while (node && node !== this.content) {
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
        while (node && node !== this.content) {
            if (blockTags.indexOf(String(node.tagName || '').toUpperCase()) !== -1) return node;
            node = node.parentNode;
        }
        return null;
    };

    OziEditor.prototype._getRootInlineNodes = function () {
        var result    = [];
        var root      = this.content;
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
        var root = this.content;
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
        if (!sel || !sel.rangeCount) { this.content.insertAdjacentHTML('beforeend', html); return; }
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
     * [18] EXECUCAO DE FERRAMENTAS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._runTool = function (tool) {
        var meta = TOOL_META[tool];
        if (!meta) return;
        if (tool === 'classes') return;
        if (tool === 'heading') return;

        this.content.focus();

        if (meta.execCmd) {
            document.execCommand(meta.execCmd, false, null);
            this._saveSelection();
            this._syncToTextarea();
            this._updateToolbarState();
            this.emitChange();
            return;
        }

        switch (tool) {
            case 'codeblock': this._toggleCodeBlock();        break;
            case 'source':    this._toggleSourceMode();       break;
            case 'table':     this._insertTable();            break;
            case 'clear':     this._clearFormat();            break;
            case 'left':      this._applyTextAlign('left');   break;
            case 'center':    this._applyTextAlign('center'); break;
            case 'right':     this._applyTextAlign('right');  break;
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
        var node  = sel.getRangeAt(0).commonAncestorContainer;
        var start = node.nodeType === 3 ? node.parentElement : node;
        var pre   = (start && start.closest) ? start.closest('pre') : null;

        if (pre && this.content.contains(pre)) {
            var parent = pre.parentNode;
            while (pre.firstChild) parent.insertBefore(pre.firstChild, pre);
            parent.removeChild(pre);
        } else {
            var range = sel.getRangeAt(0);
            var preEl = document.createElement('pre');
            var code  = document.createElement('code');
            try { code.appendChild(range.extractContents()); }
            catch (e) { code.textContent = sel.toString(); }
            preEl.appendChild(code);
            range.insertNode(preEl);
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
            if (node && node.removeAttribute) node.removeAttribute('style');
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
     * ───────────────────────────────────────────── */

    OziEditor.prototype._toggleSourceMode = function () {
        this.isSourceMode ? this._exitSourceMode() : this._enterSourceMode();
    };

    OziEditor.prototype._enterSourceMode = function () {
        this._syncToTextarea();
        this.source.value = this.textarea.value;
        this.source.style.display = 'block';
        this.content.style.display = 'none';
        this._setToolActive('source', true);
        this.isSourceMode = true;
    };

    OziEditor.prototype._exitSourceMode = function () {
        var raw  = this.source.value;
        var html = this._convertIn(raw);
        this.content.innerHTML = _sanitizeHtml(html);
        this.content.style.display = '';
        this.source.style.display = 'none';
        this._setToolActive('source', false);
        this.isSourceMode = false;
        this._syncToTextarea();
    };

    /* ─────────────────────────────────────────────
     * [21] ESTADO DA TOOLBAR
     * ───────────────────────────────────────────── */

    OziEditor.prototype._setToolActive = function (tool, active) {
        Array.prototype.forEach.call(this.toolbar.querySelectorAll('[data-ozi-editor-tool="' + tool + '"]'), function (b) {
            b.classList.toggle('ozi-editor-btn--active', !!active);
        });
    };

    OziEditor.prototype._updateToolbarState = function () {
        var self = this;

        ['bold', 'italic', 'underline'].forEach(function (cmd) {
            var active = false;
            try { active = document.queryCommandState(cmd); } catch (e) {}
            self._setToolActive(cmd, active);
        });

        var inCode = false;
        var sel = window.getSelection();
        if (sel && sel.rangeCount) {
            var node  = sel.getRangeAt(0).commonAncestorContainer;
            var start = node.nodeType === 3 ? node.parentElement : node;
            var pc    = (start && start.closest) ? start.closest('pre, code') : null;
            inCode = !!(pc && self.content.contains(pc));
        }
        self._setToolActive('codeblock', inCode);

        ['left', 'center', 'right'].forEach(function (align) {
            var active = false;
            try { active = document.queryCommandState('justify' + align.charAt(0).toUpperCase() + align.slice(1)); } catch (e) {}
            self._setToolActive(align, active);
        });

        var block      = self._getClosestBlockElement();
        var currentTag = block ? String(block.tagName || '').toLowerCase() : '';
        Array.prototype.forEach.call(self.toolbar.querySelectorAll('.ozi-editor-btn--heading'), function (b) {
            b.classList.toggle('ozi-editor-btn--active', /^h[1-6]$/.test(currentTag));
        });

        if (self.headingDropdown && _isShown(self.headingDropdown)) self._updateHeadingDropdownChecks();
        if (self.classDropdown && _isShown(self.classDropdown))     self._updateClassDropdownChecks();
    };

    /* ─────────────────────────────────────────────
     * [22] EVENTOS — delegacao nativa por wrap (rastreada p/ destroy)
     * ───────────────────────────────────────────── */

    OziEditor.prototype._closestIn = function (target, selector) {
        var found = target && target.closest ? target.closest(selector) : null;
        return (found && this.wrap.contains(found)) ? found : null;
    };

    OziEditor.prototype._bindEvents = function () {
        var self = this;

        /* botao de ferramenta (exclui classes e incompativel) */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn:not(.ozi-editor-btn--classes):not(.ozi-editor-btn--incompatible)');
            if (!btn) return;
            e.preventDefault();
            if (!self.isDisabled) {
                self._restoreSelection();
                self._runTool(btn.getAttribute('data-ozi-editor-tool'));
            }
        });

        /* botao heading — abre/fecha dropdown */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn--heading');
            if (!btn) return;
            e.preventDefault();
            if (!self.isDisabled) { self._toggleClassDropdown(true); self._toggleHeadingDropdown(); }
        });

        /* item de heading */
        self._on(self.wrap, 'mousedown', function (e) {
            var it = self._closestIn(e.target, '.ozi-editor-heading-item');
            if (!it) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var level = it.getAttribute('data-ozi-heading');
            self._toggleHeadingDropdown(true);
            self._restoreSelection();
            self._toggleHeading(level);
            self._syncToTextarea();
            self._updateToolbarState();
            self.emitChange();
        });

        /* botao classes — abre/fecha dropdown */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn--classes');
            if (!btn) return;
            e.preventDefault();
            if (!self.isDisabled) { self._toggleHeadingDropdown(true); self._toggleClassDropdown(); }
        });

        /* item de classe */
        self._on(self.wrap, 'mousedown', function (e) {
            var it = self._closestIn(e.target, '.ozi-editor-classes-item');
            if (!it) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var cls = it.getAttribute('data-ozi-class');
            self._toggleClassDropdown(true);
            self._restoreSelection();
            self._applyClass(cls);
            self._updateToolbarState();
        });

        /* clique fora — fecha dropdowns abertos */
        self._on(document, 'mousedown', function (e) {
            if (self.headingDropdown && _isShown(self.headingDropdown)) {
                if (!(e.target.closest && e.target.closest('.ozi-editor-heading-wrap'))) self._toggleHeadingDropdown(true);
            }
            if (self.classDropdown && _isShown(self.classDropdown)) {
                if (!(e.target.closest && e.target.closest('.ozi-editor-classes-wrap'))) self._toggleClassDropdown(true);
            }
        });

        /* selecao no content */
        var onContentSel = function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            self._saveSelection();
            self._updateToolbarState();
        };
        self._on(self.wrap, 'keyup', onContentSel);
        self._on(self.wrap, 'mouseup', onContentSel);

        /* focus (delegado via focusin, que borbulha) */
        self._on(self.wrap, 'focusin', function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            self._saveSelection();
        });

        /* input — content ou source */
        self._on(self.wrap, 'input', function (e) {
            if (self._closestIn(e.target, '.ozi-editor-content')) {
                self._saveSelection();
                self._syncToTextarea();
                self.emitChange();
            } else if (self._closestIn(e.target, '.ozi-editor-source')) {
                self._syncToTextarea();
                self.emitChange();
            }
        });

        /* Enter no content — insere paragrafo fora de code/list/table */
        self._on(self.wrap, 'keydown', function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
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

        /* paste — sanitiza */
        self._on(self.wrap, 'paste', function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            e.preventDefault();
            var clip = e.clipboardData || window.clipboardData;
            var html = clip ? clip.getData('text/html') : '';
            var text = clip ? clip.getData('text/plain') : '';
            if (html)      { document.execCommand('insertHTML', false, _sanitizeHtml(html)); }
            else if (text) { document.execCommand('insertText', false, text); }
            self._saveSelection();
            self._syncToTextarea();
            self.emitChange();
        });

        /* submit do form — garante sync final */
        var form = self.textarea.closest('form');
        if (form) self._on(form, 'submit', function () { self._syncToTextarea(); });
    };

    /* ─────────────────────────────────────────────
     * [23] VALIDACAO
     * ───────────────────────────────────────────── */

    OziEditor.prototype.isValid = function () {
        if (!this.isRequired) return true;
        var tmp = document.createElement('div');
        tmp.innerHTML = this.textarea.value || '';
        return (tmp.textContent || '').trim().length > 0;
    };

    OziEditor.prototype._markInvalid = function () {
        _classListOp(this.wrap, _classMap('invalid', 'ozi-invalid'), 'add');
        this.feedback.textContent = this.requiredMessage;
        this.feedback.style.display = 'block';
    };

    OziEditor.prototype._clearInvalid = function () {
        _classListOp(this.wrap, _classMap('invalid', 'ozi-invalid'), 'remove');
        _classListOp(this.wrap, _classMap('valid',   'ozi-valid'),   'remove');
        this.feedback.style.display = 'none';
    };

    OziEditor.prototype.validate = function (focusOnError) {
        var valid = this.isValid();
        if (!valid) {
            this._markInvalid();
            if (focusOnError) this.content.focus();
        } else {
            this._clearInvalid();
            if (this.isRequired) _classListOp(this.wrap, _classMap('valid', 'ozi-valid'), 'add');
        }
        return valid;
    };

    OziEditor.prototype.setState = function (state) {
        this._clearInvalid();
        if (state === 'invalid') this._markInvalid();
        if (state === 'valid')   _classListOp(this.wrap, _classMap('valid', 'ozi-valid'), 'add');
    };

    /* ─────────────────────────────────────────────
     * [24] DISABLED
     * ───────────────────────────────────────────── */

    OziEditor.prototype._setDisabled = function (state) {
        this.isDisabled = !!state;
        this.content.setAttribute('contenteditable', state ? 'false' : 'true');
        Array.prototype.forEach.call(this.toolbar.querySelectorAll('.ozi-editor-btn'), function (b) { b.disabled = !!state; });
        this.wrap.classList.toggle('ozi-editor--disabled', !!state);
    };

    /* ─────────────────────────────────────────────
     * [25] I/O PUBLICO
     * ───────────────────────────────────────────── */

    OziEditor.prototype.getValue = function () {
        this._syncToTextarea();
        return this.textarea.value || '';
    };

    OziEditor.prototype.setValue = function (v) {
        var html      = this._convertIn(v || '');
        var sanitized = _sanitizeHtml(html);
        this.content.innerHTML = sanitized;
        this.textarea.value = v || '';
        if (this.isSourceMode) this.source.value = v || '';
        this.emitChange('api');
    };

    OziEditor.prototype.emitChange = function (source) {
        _emitEvent(this.textarea, 'ozi:change', {
            component: 'ozi-editor',
            name:      this.key,
            value:     this.textarea.value,
            type:      this.editorType,
            source:    source || 'user'
        });
    };

    /* ─────────────────────────────────────────────
     * [26] API ESTATICA — OZI.components.editor
     * ───────────────────────────────────────────── */

    function _resolve(selectorOrKey) {
        if (!selectorOrKey) return null;

        if (typeof selectorOrKey === 'string' && _instances[selectorOrKey]) return _instances[selectorOrKey];

        var el = (selectorOrKey && selectorOrKey.jquery) ? selectorOrKey[0] : selectorOrKey;
        if (!el || el.nodeType !== 1) return null;

        var key = el.getAttribute('data-ozi-editor-html') || el.getAttribute('data-ozi-editor-md');
        return key ? (_instances[_trim(String(key))] || null) : null;
    }

    var editorAPI = {

        init: function (root, type) {
            var targets;
            if (root) {
                var rootEl = (root && root.jquery) ? root[0] : root;
                if (!rootEl || !rootEl.querySelectorAll) return;
                targets = Array.prototype.slice.call(rootEl.querySelectorAll(SELECTOR));
                if (rootEl.matches && rootEl.matches(SELECTOR) && targets.indexOf(rootEl) === -1) targets.push(rootEl);
            } else {
                targets = Array.prototype.slice.call((document.body || document).querySelectorAll(SELECTOR));
            }

            targets.forEach(function (el) {
                var elType = el.getAttribute('data-ozi-editor-md') !== null ? 'md' : 'html';

                if (_isInited(el, elType)) return;
                if (type && elType !== type) return;
                if (elType === 'md' && !_converters.mdToHtml) return;

                try {
                    var inst = new OziEditor(el);
                    inst.init();
                } catch (e) {
                    console.warn('[OZI:editor] init erro:', e.message);
                }
            });
        },

        get:     function (k) { return _resolve(k); },
        getAll:  function ()  { return Object.keys(_instances).map(function (k) { return _instances[k]; }); },
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

        registerConverters: function (converters) {
            if (typeof converters.mdToHtml === 'function') _converters.mdToHtml = converters.mdToHtml;
            if (typeof converters.htmlToMd === 'function') _converters.htmlToMd = converters.htmlToMd;
            /* garante init(md) APOS o _boot() (sem a fila $(fn) do jQuery) */
            if (_booted) editorAPI.init(null, 'md');
            else _pendingMdInit = true;
        },

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

        validate.registerAdapter({
            name:         'ozi-editor',
            nativeElement: true,
            match:    function (el) { return !!(el && el.matches && el.matches(SELECTOR)); },
            isValid:  function (el) { var i = _resolve(el); return i ? i.isValid()  : true; },
            getValue: function (el) { var i = _resolve(el); return i ? i.getValue() : ''; },
            setState: function (el, state) { var i = _resolve(el); if (i) i.setState(state); }
        });
    }

    function _boot() {
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

        _booted = true;
        if (_pendingMdInit) editorAPI.init(null, 'md');
    }

    /* namespace legado — compatibilidade */
    window.OziEditor = {
        init:    function (root) { editorAPI.init(root); },
        get:     editorAPI.get,
        value:   editorAPI.value,
        destroy: editorAPI.destroy,
        reload:  editorAPI.reload
    };

    /* expõe a API sincronamente — ozi-editor-md.js encontra OZI.components.editor
     * imediatamente, independente de quando OZI.ready dispara. */
    (function () {
        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.editor = editorAPI;
        }
    }());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})(window, document);
