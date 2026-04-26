/**
 * ------------------------------------------
 * oziEditor
 * ------------------------------------------
 * Ver: (1.5.1)
 * 2026-04-25
 * ------------------------------------------
 */

(function ($) {
    'use strict';

    var instances = {};
    var instanceCounter = 0;

    var LANGS = {
        'pt-br': {
            bold: 'Negrito',
            italic: 'Itálico',
            underline: 'Sublinhado',
            ul: 'Lista',
            ol: 'Lista ordenada',
            codeblock: 'Bloco de código',
            source: 'Editar HTML',
            table: 'Tabela',
            clear: 'Limpar formatação',
            left: 'Alinhar à esquerda',
            center: 'Centralizar',
            right: 'Alinhar à direita',
            requiredMessage: 'Campo obrigatório.'
        },
        'en': {
            bold: 'Bold',
            italic: 'Italic',
            underline: 'Underline',
            ul: 'List',
            ol: 'Ordered list',
            codeblock: 'Code block',
            source: 'Edit HTML',
            table: 'Table',
            clear: 'Clear formatting',
            left: 'Align left',
            center: 'Align center',
            right: 'Align right',
            requiredMessage: 'Required field.'
        }
    };

    var OZI_EDITOR_ICON_BASE = '/plugins/ozi-ui/ozi-editor/icon/';
    var oziEditorIconCache = {};
    var oziEditorIconPending = {};

    function oziEditorFetchIcon(iconFile) {
        if (!iconFile) {
            return Promise.resolve('');
        }

        if (oziEditorIconCache[iconFile]) {
            return Promise.resolve(oziEditorIconCache[iconFile]);
        }

        if (oziEditorIconPending[iconFile]) {
            return oziEditorIconPending[iconFile];
        }

        oziEditorIconPending[iconFile] = fetch(OZI_EDITOR_ICON_BASE + iconFile, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Ícone não encontrado: ' + iconFile);
                }
                return response.text();
            })
            .then(function (svgText) {
                var clean = normalizeOziEditorSvg(svgText);
                oziEditorIconCache[iconFile] = clean;
                delete oziEditorIconPending[iconFile];
                return clean;
            })
            .catch(function (error) {
                console.warn('oziEditor| erro ao carregar ícone:', iconFile, error);
                delete oziEditorIconPending[iconFile];
                return '';
            });

        return oziEditorIconPending[iconFile];
    }

    function normalizeOziEditorSvg(svgText) {
        var raw = String(svgText || '').trim();
        if (!raw) return '';

        var parser = new DOMParser();
        var doc = parser.parseFromString(raw, 'image/svg+xml');
        var svg = doc.querySelector('svg');

        if (!svg) {
            return '';
        }

        var cls = String(svg.getAttribute('class') || '').trim();
        var classes = cls ? cls.split(/\s+/) : [];

        if (classes.indexOf('ozi-icon-svg') === -1) {
            classes.push('ozi-icon-svg');
        }

        svg.setAttribute('class', classes.join(' ').trim());
        svg.setAttribute('aria-hidden', 'true');
        svg.removeAttribute('width');
        svg.removeAttribute('height');

        return svg.outerHTML;
    }

    var TOOL_META = {
        bold: { short: '<strong>B</strong>', showLabel: false },
        italic: { short: '<em>I</em>', showLabel: false },
        underline: { short: '<u>U</u>', showLabel: false },
        ul: { short: '&#8226; Lista', showLabel: false },
        ol: { short: '1. Lista', showLabel: false },
        codeblock: { short: '&lt;/&gt;', showLabel: false },
        table: { short: '&#9638;', showLabel: false },
        clear: { short: 'Tx', showLabel: false },
        left: { short: '&#8676;', showLabel: false },
        center: { short: '&#8596;', showLabel: false },
        right: { short: '&#8677;', showLabel: false },
        source: { short: '&lt;HTML&gt;', showLabel: false }
    };

    function oziEditorToolIconFile(tool) {
        tool = String(tool || '').trim().toLowerCase();
        if (!tool) return '';
        return tool + '.svg';
    }

    function oziEditorResolveToolMeta(tool) {
        var base = TOOL_META[tool] || {};
        return {
            short: base.short || tool,
            showLabel: !!base.showLabel,
            iconFile: base.iconFile || oziEditorToolIconFile(tool)
        };
    }

    function OziEditor(element) {
        this.$textarea = $(element);
        this.key = String(this.$textarea.attr('data-ozi-editor') || '').trim();

        if (!this.key) {
            throw new Error('OziEditor 1.4.1: data-ozi-editor é obrigatório.');
        }

        this.uid = 'ozi-editor-' + (++instanceCounter);
        this.ns = '.oziEditor.' + this.uid;

        this.lang = String(this.$textarea.attr('data-ozi-editor-lang') || 'pt-br').trim().toLowerCase();
        this.texts = LANGS[this.lang] || LANGS['pt-br'];

        this.toolsRaw = String(
            this.$textarea.attr('data-ozi-editor-tools') ||
            'bold,italic,underline,ul,ol,codeblock,table,clear,left,center,right,source'
        ).trim();

        this.toolsLayout = this.parseToolsLayout(this.toolsRaw);

        this.uiColor = String(this.$textarea.attr('data-ozi-editor-uicolor') || '#9AB8F3').trim();
        this.placeholder = String(this.$textarea.attr('data-ozi-editor-placeholder') || 'Digite aqui...').trim();
        this.height = String(this.$textarea.attr('data-ozi-editor-height') || '220px').trim();

        this.isDisabledConfig = this.parseBooleanAttr('data-ozi-editor-disabled');
        this.isRequiredConfig = this.parseBooleanAttr('data-ozi-editor-required');
        this.requiredMessage = String(
            this.$textarea.attr('data-ozi-editor-required-message') || this.texts.requiredMessage
        ).trim();

        this.$wrap = null;
        this.$toolbar = null;
        this.$content = null;
        this.$source = null;
        this.$feedback = null;

        this.mode = 'visual';
        this.savedRange = null;
        this.isReady = false;

        this.init();
    }

    OziEditor.prototype.parseBooleanAttr = function (attrName) {
        if (!this.$textarea.is('[' + attrName + ']')) return false;

        var raw = this.$textarea.attr(attrName);

        if (raw === undefined || raw === '') return true;

        raw = String(raw).trim().toLowerCase();

        if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') {
            return false;
        }

        return true;
    };

    OziEditor.prototype.splitTopLevel = function (raw, separator) {
        var result = [];
        var current = '';
        var depth = 0;
        var i;
        var ch;

        raw = String(raw || '');

        for (i = 0; i < raw.length; i++) {
            ch = raw.charAt(i);

            if (ch === '[') {
                depth++;
                current += ch;
                continue;
            }

            if (ch === ']') {
                depth = Math.max(0, depth - 1);
                current += ch;
                continue;
            }

            if (ch === separator && depth === 0) {
                result.push(current.trim());
                current = '';
                continue;
            }

            current += ch;
        }

        if (current.trim() !== '') {
            result.push(current.trim());
        }

        return result;
    };

    OziEditor.prototype.parseToolsRow = function (rowRaw) {
        var self = this;
        var items = [];
        var parts = this.splitTopLevel(rowRaw, ',');

        parts.forEach(function (part) {
            var value = String(part || '').trim();
            if (!value) return;

            if (value.charAt(0) === '[' && value.charAt(value.length - 1) === ']') {
                var inner = value.slice(1, -1).trim();
                var groupTools = self.splitTopLevel(inner, ',')
                    .map(function (tool) {
                        return String(tool || '').trim().toLowerCase();
                    })
                    .filter(Boolean);

                if (groupTools.length) {
                    items.push({
                        type: 'group',
                        tools: groupTools
                    });
                }

                return;
            }

            items.push({
                type: 'tool',
                tool: value.toLowerCase()
            });
        });

        return items;
    };

    OziEditor.prototype.parseToolsLayout = function (raw) {
        var self = this;
        var rows = this.splitTopLevel(raw, ';');

        return rows
            .map(function (rowRaw) {
                var items = self.parseToolsRow(rowRaw);

                if (!items.length) return null;

                return {
                    type: 'row',
                    items: items
                };
            })
            .filter(Boolean);
    };

    OziEditor.prototype.isDisabled = function () {
        return !!this.isDisabledConfig;
    };

    OziEditor.prototype.isRequired = function () {
        return !this.isDisabled() && !!this.isRequiredConfig;
    };

    OziEditor.prototype.init = function () {
        if (this.$textarea.data('ozi-editor-initialized')) return;
        this.$textarea.data('ozi-editor-initialized', true);

        this.buildUI();
        this.applyTheme();
        this.applyStateStyles();
        this.syncFromTextarea(false);
        this.bindEvents();
        this.updateToolbarState();
        this.isReady = true;
    };

    OziEditor.prototype.buildUI = function () {
        this.$textarea.addClass('ozi-editor-source').hide();

        this.$wrap = $('<div>', {
            class: 'ozi-editor-wrap',
            'data-ozi-editor-wrap': this.key
        });

        this.$toolbar = $('<div>', {
            class: 'ozi-editor-toolbar',
            role: 'toolbar',
            'aria-label': 'Editor'
        });

        this.buildToolbarButtons();

        this.$content = $('<div>', {
            class: 'ozi-editor-content',
            contenteditable: this.isDisabled() ? 'false' : 'true',
            'data-placeholder': this.placeholder
        }).css({
            height: this.height,
            overflowY: 'auto'
        });

        this.$source = $('<textarea>', {
            class: 'ozi-editor-source-area',
            spellcheck: 'false'
        }).css({
            height: this.height
        }).hide();

        this.$feedback = $('<div>', {
            class: 'invalid-feedback ozi-editor-feedback'
        }).text(this.requiredMessage);

        this.$wrap.append(this.$toolbar, this.$content, this.$source, this.$feedback);
        this.$textarea.after(this.$wrap);
    };

    OziEditor.prototype.buildToolbarButtons = function () {
        var self = this;

        this.$toolbar.empty();

        (this.toolsLayout || []).forEach(function (row) {
            var $row = $('<div>', {
                class: 'ozi-editor-toolbar-row'
            });

            row.items.forEach(function (item) {
                if (item.type === 'tool') {
                    var $btn = self.buildToolButton(item.tool);
                    if ($btn) {
                        $row.append($btn);
                    }
                    return;
                }

                if (item.type === 'group') {
                    var $group = $('<div>', {
                        class: 'ozi-editor-toolbar-group'
                    });

                    item.tools.forEach(function (tool) {
                        var $btn = self.buildToolButton(tool);
                        if ($btn) {
                            $group.append($btn);
                        }
                    });

                    if ($group.children().length) {
                        $row.append($group);
                    }
                }
            });

            if ($row.children().length) {
                self.$toolbar.append($row);
            }
        });
    };

    OziEditor.prototype.loadToolIcon = function (tool, $icon) {
        if (!$icon || !$icon.length) return;

        var meta = oziEditorResolveToolMeta(tool);
        if (!meta.iconFile) return;

        oziEditorFetchIcon(meta.iconFile).then(function (svgHtml) {
            if (!svgHtml) return;
            $icon.html(svgHtml);
        });
    };

    OziEditor.prototype.buildToolButton = function (tool) {
        if (!TOOL_META[tool]) {
            return null;
        }

        var meta = oziEditorResolveToolMeta(tool);
        var label = this.texts[tool] || tool;

        var $btn = $('<button>', {
            type: 'button',
            class: 'ozi-editor-btn',
            'data-ozi-editor-tool': tool,
            title: label,
            'aria-label': label
        });

        var $icon = $('<span>', {
            class: 'ozi-editor-btn-icon',
            'aria-hidden': 'true'
        }).html(meta.short || tool);

        var $label = $('<span>', {
            class: 'ozi-editor-btn-label' + (meta.showLabel ? '' : ' ozi-visually-hidden')
        }).text(label);

        $btn.append($icon, $label);

        this.loadToolIcon(tool, $icon);

        return $btn;
    };

    OziEditor.prototype.applyTheme = function () {
        this.$wrap.css('--ozi-editor-uicolor', this.uiColor || '#9AB8F3');
    };

    OziEditor.prototype.applyStateStyles = function () {
        var disabled = this.isDisabled();

        this.$wrap.toggleClass('is-disabled', disabled);

        this.$content
            .attr('contenteditable', disabled ? 'false' : 'true')
            .attr('aria-disabled', disabled ? 'true' : 'false');

        this.$source.prop('disabled', disabled);
        this.$toolbar.find('.ozi-editor-btn').prop('disabled', disabled);

        if (disabled) {
            this.clearInvalid();
        }
    };

    OziEditor.prototype.bindEvents = function () {
        var self = this;

        this.$toolbar.on('mousedown', '.ozi-editor-btn', function (e) {
            e.preventDefault();
            if (self.isDisabled()) return;

            var tool = String($(this).attr('data-ozi-editor-tool') || '').trim();
            if (!tool) return;

            if (tool === 'source') {
                self.toggleSourceMode();
                self.updateToolbarState();
                return;
            }

            if (self.mode !== 'visual') {
                return;
            }

            self.restoreSelection();
            self.focusContent();
            self.runTool(tool);
            self.saveSelection();
            self.syncToTextarea(true);
            self.updateToolbarState();
        });

        this.$content.on('focus' + this.ns, function () {
            if (self.mode !== 'visual' || self.isDisabled()) return;
            self.saveSelection();
        });

        this.$content.on('mouseup' + this.ns + ' keyup' + this.ns, function () {
            if (self.mode !== 'visual' || self.isDisabled()) return;
            self.saveSelection();
            self.updateToolbarState();
        });

        this.$content.on('input' + this.ns, function () {
            if (self.mode !== 'visual' || self.isDisabled()) return;

            self.saveSelection();
            self.syncToTextarea(true);
            self.updateToolbarState();

            if (self.$content.hasClass('is-invalid') || self.$textarea.closest('form').hasClass('was-validated')) {
                self.validate(false);
            }
        });

        this.$content.on('keydown' + this.ns, function (e) {
            if (self.mode !== 'visual' || self.isDisabled()) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                var inCode = self.getClosestSelectionNode(['PRE', 'CODE']);
                var inList = self.getClosestSelectionNode(['UL', 'OL', 'LI']);
                var inTable = self.getClosestSelectionNode(['TD', 'TH']);

                if (!inCode && !inList && !inTable) {
                    e.preventDefault();

                    try {
                        document.execCommand('insertParagraph', false, null);
                    } catch (err) {
                        self.insertHtmlAtCursor('<p><br></p>');
                    }

                    setTimeout(function () {
                        self.saveSelection();
                        self.syncToTextarea(true);
                        self.updateToolbarState();
                    }, 0);
                }
            }
        });

        this.$content.on('blur' + this.ns, function () {
            if (self.mode !== 'visual' || self.isDisabled()) return;

            setTimeout(function () {
                self.normalizeEditorHtml();
                self.syncToTextarea(true);
                self.validate(false);
                self.updateToolbarState();
            }, 0);
        });

        this.$content.on('paste' + this.ns, function (e) {
            if (self.mode !== 'visual' || self.isDisabled()) return;

            self.handlePaste(e);

            setTimeout(function () {
                self.saveSelection();
                self.syncToTextarea(true);
                self.updateToolbarState();
            }, 0);
        });

        this.$source.on('input' + this.ns, function () {
            if (self.mode !== 'source' || self.isDisabled()) return;

            self.$textarea.val($(this).val()).trigger('input');

            if (self.$source.hasClass('is-invalid') || self.$textarea.closest('form').hasClass('was-validated')) {
                self.validate(false);
            }
        });

        var $form = this.$textarea.closest('form');
        if ($form.length) {
            $form.on('submit' + this.ns, function (e) {
                if (self.mode === 'source') {
                    self.exitSourceMode(false);
                }

                self.normalizeEditorHtml();
                self.syncToTextarea(false);

                if (!self.validate(true)) {
                    e.preventDefault();
                    $form.addClass('was-validated');
                }
            });

            $form.on('reset' + this.ns, function () {
                setTimeout(function () {
                    self.mode = 'visual';
                    self.$wrap.removeClass('is-source-mode');
                    self.$source.hide();
                    self.$content.show();
                    self.syncFromTextarea(false);
                    self.clearInvalid();
                    self.updateToolbarState();
                }, 0);
            });
        }
    };

    OziEditor.prototype.focusContent = function () {
        if (!this.isDisabled()) {
            this.$content.trigger('focus');
        }
    };

    OziEditor.prototype.saveSelection = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        var range = sel.getRangeAt(0);
        if (!this.$content[0].contains(range.commonAncestorContainer)) return;

        this.savedRange = range.cloneRange();
    };

    OziEditor.prototype.restoreSelection = function () {
        if (!this.savedRange) return;

        var sel = window.getSelection();
        if (!sel) return;

        sel.removeAllRanges();
        sel.addRange(this.savedRange);
    };

    OziEditor.prototype.runTool = function (tool) {
        if (this.mode !== 'visual') return;

        switch (tool) {
            case 'bold':
                document.execCommand('bold', false, null);
                break;

            case 'italic':
                document.execCommand('italic', false, null);
                break;

            case 'underline':
                document.execCommand('underline', false, null);
                break;

            case 'ul':
                document.execCommand('insertUnorderedList', false, null);
                break;

            case 'ol':
                document.execCommand('insertOrderedList', false, null);
                break;

            case 'codeblock':
                this.toggleCodeBlock();
                break;

            case 'table':
                this.insertTable();
                break;

            case 'clear':
                this.clearFormatting();
                break;

            case 'left':
                this.applyTextAlign('left');
                break;

            case 'center':
                this.applyTextAlign('center');
                break;

            case 'right':
                this.applyTextAlign('right');
                break;
        }
    };

    OziEditor.prototype.toggleSourceMode = function () {
        if (this.mode === 'visual') {
            this.enterSourceMode();
            return;
        }

        this.exitSourceMode(true);
    };

    OziEditor.prototype.enterSourceMode = function () {
        var html = this.getSanitizedEditorHtml();

        this.mode = 'source';
        this.$wrap.addClass('is-source-mode');

        this.$source.val(html).show().trigger('focus');
        this.$content.hide();

        this.$toolbar.find('[data-ozi-editor-tool]').each(function () {
            var tool = String($(this).attr('data-ozi-editor-tool') || '').trim();
            if (tool !== 'source') {
                $(this).prop('disabled', true);
            }
        });
    };

    OziEditor.prototype.exitSourceMode = function (emitChange) {
        var html = String(this.$source.val() || '').trim();

        this.mode = 'visual';
        this.$wrap.removeClass('is-source-mode');

        if (!html) {
            this.$content.html('');
            this.$textarea.val('');
        } else {
            html = this.sanitizeHtml(html);
            this.$content.html(html);
            this.$textarea.val(html);
        }

        this.$source.hide();
        this.$content.show();

        this.$toolbar.find('[data-ozi-editor-tool]').prop('disabled', false);

        this.normalizeEditorHtml();
        this.syncToTextarea(emitChange !== false);
        this.updateToolbarState();
    };

    OziEditor.prototype.handlePaste = function (e) {
        e.preventDefault();

        var clipboard = e.originalEvent && e.originalEvent.clipboardData
            ? e.originalEvent.clipboardData
            : window.clipboardData;

        var html = clipboard ? clipboard.getData('text/html') : '';
        var text = clipboard ? clipboard.getData('text/plain') : '';

        if (html) {
            this.insertHtmlAtCursor(this.sanitizeHtml(html));
            return;
        }

        if (text) {
            this.insertHtmlAtCursor(this.escapeHtml(text).replace(/\n/g, '<br>'));
        }
    };

    OziEditor.prototype.insertHtmlAtCursor = function (html) {
        var sel = window.getSelection();

        if (!sel || !sel.rangeCount) {
            this.$content.append(html);
            return;
        }

        var range = sel.getRangeAt(0);
        range.deleteContents();

        var temp = document.createElement('div');
        temp.innerHTML = html;

        var frag = document.createDocumentFragment();
        var node;
        var lastNode = null;

        while ((node = temp.firstChild)) {
            lastNode = frag.appendChild(node);
        }

        range.insertNode(frag);

        if (lastNode) {
            range = range.cloneRange();
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    };

    OziEditor.prototype.toggleCodeBlock = function () {
        var node = this.getClosestSelectionNode(['PRE', 'CODE']);

        if (node) {
            var $pre = $(node).closest('pre');
            if ($pre.length) {
                var text = $pre.text();
                $pre.replaceWith('<p>' + this.escapeHtml(text) + '</p>');
                return;
            }
        }

        var selectedText = this.getSelectedText();

        if (!selectedText) {
            this.insertHtmlAtCursor('<pre><code>Seu código aqui</code></pre><p><br></p>');
            return;
        }

        this.insertHtmlAtCursor(
            '<pre><code>' + this.escapeHtml(selectedText) + '</code></pre>'
        );
    };

    OziEditor.prototype.insertTable = function () {
        var html =
            '<table>' +
            '<tbody>' +
            '<tr><td><br></td><td><br></td></tr>' +
            '<tr><td><br></td><td><br></td></tr>' +
            '</tbody>' +
            '</table>' +
            '<p><br></p>';

        this.insertHtmlAtCursor(html);
    };

    OziEditor.prototype.getSelectedText = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return '';
        return String(sel.toString() || '').trim();
    };

    OziEditor.prototype.getClosestSelectionNode = function (tagNames) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        var node = sel.anchorNode;
        if (!node) return null;

        if (node.nodeType === 3) {
            node = node.parentNode;
        }

        tagNames = (tagNames || []).map(function (tag) {
            return String(tag || '').toUpperCase();
        });

        while (node && node !== this.$content[0]) {
            if (tagNames.indexOf(String(node.tagName || '').toUpperCase()) !== -1) {
                return node;
            }
            node = node.parentNode;
        }

        return null;
    };

    OziEditor.prototype.getClosestBlockElement = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;

        var node = sel.anchorNode;
        if (!node) return null;

        if (node.nodeType === 3) {
            node = node.parentNode;
        }

        var blockTags = ['P', 'DIV', 'LI', 'TD', 'TH', 'PRE', 'BLOCKQUOTE'];

        while (node && node !== this.$content[0]) {
            if (blockTags.indexOf(String(node.tagName || '').toUpperCase()) !== -1) {
                return node;
            }
            node = node.parentNode;
        }

        return null;
    };

    OziEditor.prototype.getRootInlineNodes = function () {
        var result = [];
        var root = this.$content[0];

        if (!root) return result;

        Array.prototype.slice.call(root.childNodes || []).forEach(function (node) {
            if (node.nodeType === 3) {
                if (String(node.nodeValue || '').trim() !== '') {
                    result.push(node);
                }
                return;
            }

            if (node.nodeType !== 1) return;

            var tag = String(node.tagName || '').toUpperCase();

            if (['P', 'DIV', 'UL', 'OL', 'LI', 'PRE', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'BLOCKQUOTE'].indexOf(tag) !== -1) {
                return;
            }

            result.push(node);
        });

        return result;
    };

    OziEditor.prototype.wrapRootInlineContentInParagraph = function () {
        var root = this.$content[0];
        if (!root) return null;

        var inlineNodes = this.getRootInlineNodes();
        if (!inlineNodes.length) return null;

        var p = document.createElement('p');

        inlineNodes.forEach(function (node) {
            p.appendChild(node);
        });

        root.insertBefore(p, root.firstChild);

        return p;
    };

    OziEditor.prototype.ensureBlockForAlignment = function () {
        var block = this.getClosestBlockElement();
        if (block) return block;

        block = this.wrapRootInlineContentInParagraph();
        if (block) return block;

        this.insertHtmlAtCursor('<p><br></p>');
        return this.getClosestBlockElement();
    };

    OziEditor.prototype.applyTextAlign = function (align) {
        if (this.mode !== 'visual') return;

        this.restoreSelection();

        var block = this.ensureBlockForAlignment();
        if (!block) return;

        block.style.textAlign = align;
        this.saveSelection();
    };

    OziEditor.prototype.clearFormatting = function () {
        try {
            document.execCommand('removeFormat', false, null);
            document.execCommand('unlink', false, null);
        } catch (e) {}

        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        var node = sel.anchorNode;
        if (!node) return;

        if (node.nodeType === 3) {
            node = node.parentNode;
        }

        var $closestBlock = $(node).closest('p, div, li, pre, code, td, th', this.$content);

        if ($closestBlock.length) {
            $closestBlock.removeAttr('style');
        }
    };

    OziEditor.prototype.escapeHtml = function (value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    OziEditor.prototype.sanitizeHtml = function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString('<div>' + html + '</div>', 'text/html');
        var container = doc.body.firstChild;

        this.cleanNode(container);

        return container.innerHTML;
    };

    OziEditor.prototype.cleanNode = function (root) {
        var self = this;
        var allowed = {
            P: true,
            DIV: true,
            BR: true,
            STRONG: true,
            B: true,
            EM: true,
            I: true,
            U: true,
            UL: true,
            OL: true,
            LI: true,
            PRE: true,
            CODE: true,
            TABLE: true,
            TBODY: true,
            THEAD: true,
            TR: true,
            TD: true,
            TH: true
        };

        var children = Array.prototype.slice.call(root.childNodes || []);

        children.forEach(function (node) {
            if (node.nodeType === 3) {
                return;
            }

            if (node.nodeType !== 1) {
                node.parentNode.removeChild(node);
                return;
            }

            var tag = String(node.tagName || '').toUpperCase();

            if (!allowed[tag]) {
                var fragment = document.createDocumentFragment();

                while (node.firstChild) {
                    fragment.appendChild(node.firstChild);
                }

                node.parentNode.replaceChild(fragment, node);
                return;
            }

            if (tag === 'B') {
                self.replaceTag(node, 'strong');
                return;
            }

            if (tag === 'I') {
                self.replaceTag(node, 'em');
                return;
            }

            if (tag === 'DIV') {
                self.replaceTag(node, 'p');
                return;
            }

            var textAlign = node.style && node.style.textAlign
                ? String(node.style.textAlign).trim().toLowerCase()
                : '';

            Array.prototype.slice.call(node.attributes || []).forEach(function (attr) {
                node.removeAttribute(attr.name);
            });

            if (['left', 'center', 'right', 'justify'].indexOf(textAlign) !== -1) {
                node.style.textAlign = textAlign;
            }

            self.cleanNode(node);
        });
    };

    OziEditor.prototype.replaceTag = function (node, newTag) {
        var replacement = document.createElement(newTag);

        while (node.firstChild) {
            replacement.appendChild(node.firstChild);
        }

        node.parentNode.replaceChild(replacement, node);
        this.cleanNode(replacement);
    };

    OziEditor.prototype.isHtmlEffectivelyEmpty = function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString('<div>' + (html || '') + '</div>', 'text/html');
        var container = doc.body.firstChild;

        if (!container) return true;

        var text = String(container.textContent || '')
            .replace(/\u00A0/g, ' ')
            .trim();

        var hasTable = container.querySelector('table');
        var hasList = container.querySelector('ul li, ol li');

        if (hasTable || hasList) return false;

        return text === '';
    };

    OziEditor.prototype.getSanitizedEditorHtml = function () {
        var html = this.$content.html() || '';
        html = this.sanitizeHtml(html);

        if (this.isHtmlEffectivelyEmpty(html)) {
            return '';
        }

        return html;
    };

    OziEditor.prototype.normalizeEditorHtml = function () {
        var html = this.getSanitizedEditorHtml();

        if (!html) {
            this.$content.html('');
            return;
        }

        this.$content.html(html);
    };

    OziEditor.prototype.syncFromTextarea = function (emitChange) {
        var html = String(this.$textarea.val() || '').trim();

        if (this.mode === 'source') {
            this.$source.val(html);
        }

        if (!html) {
            this.$content.html('');
        } else {
            this.$content.html(this.sanitizeHtml(html));
        }

        this.saveSelection();

        if (emitChange) {
            this.emitChange();
        }
    };

    OziEditor.prototype.syncToTextarea = function (emitChange) {
        var html = '';

        if (this.mode === 'source') {
            html = String(this.$source.val() || '').trim();
            html = html ? this.sanitizeHtml(html) : '';
        } else {
            html = this.getSanitizedEditorHtml();
        }

        this.$textarea.val(html).trigger('input');

        if (emitChange) {
            this.emitChange();
        }
    };

    OziEditor.prototype.markInvalid = function (focusEditor) {
        if (this.mode === 'source') {
            this.$source.addClass('is-invalid');
        } else {
            this.$content.addClass('is-invalid');
        }

        this.$feedback.addClass('is-visible').text(this.requiredMessage);

        if (focusEditor !== false) {
            if (this.mode === 'source') {
                this.$source.trigger('focus');
            } else {
                this.focusContent();
            }
        }
    };

    OziEditor.prototype.clearInvalid = function () {
        this.$content.removeClass('is-invalid');
        if (this.$source) {
            this.$source.removeClass('is-invalid');
        }
        this.$feedback.removeClass('is-visible');
    };

    OziEditor.prototype.validate = function (focusEditor) {
        if (!this.isRequired()) {
            this.clearInvalid();
            return true;
        }

        this.syncToTextarea(false);

        var value = String(this.$textarea.val() || '').trim();

        if (value) {
            this.clearInvalid();
            return true;
        }

        this.markInvalid(focusEditor !== false);
        return false;
    };

    OziEditor.prototype.updateToolbarState = function () {
        var self = this;

        this.$toolbar.find('.ozi-editor-btn').removeClass('is-active');

        if (this.mode === 'source') {
            this.$toolbar.find('[data-ozi-editor-tool="source"]').addClass('is-active');
            return;
        }

        var stateMap = {
            bold: 'bold',
            italic: 'italic',
            underline: 'underline',
            ul: 'insertUnorderedList',
            ol: 'insertOrderedList'
        };

        Object.keys(stateMap).forEach(function (tool) {
            try {
                if (document.queryCommandState(stateMap[tool])) {
                    self.$toolbar.find('[data-ozi-editor-tool="' + tool + '"]').addClass('is-active');
                }
            } catch (e) {}
        });

        var currentBlock = this.getClosestBlockElement();
        if (currentBlock) {
            var align = String(currentBlock.style.textAlign || '').trim().toLowerCase();

            if (align === 'left') {
                this.$toolbar.find('[data-ozi-editor-tool="left"]').addClass('is-active');
            } else if (align === 'center') {
                this.$toolbar.find('[data-ozi-editor-tool="center"]').addClass('is-active');
            } else if (align === 'right') {
                this.$toolbar.find('[data-ozi-editor-tool="right"]').addClass('is-active');
            }
        }

        var inCode = this.getClosestSelectionNode(['PRE', 'CODE']);
        if (inCode) {
            this.$toolbar.find('[data-ozi-editor-tool="codeblock"]').addClass('is-active');
        }
    };

    OziEditor.prototype.getValue = function () {
        return String(this.$textarea.val() || '');
    };

    OziEditor.prototype.setValue = function (html) {
        this.$textarea.val(String(html || ''));
        this.syncFromTextarea(false);
        this.emitChange();
        return this.getValue();
    };

    OziEditor.prototype.emitChange = function () {
        var detail = {
            key: this.key,
            value: this.getValue(),
            instance: this
        };

        this.$textarea.trigger('ozi:change', [detail.value, this, detail]);

        if (this.$textarea[0] && typeof CustomEvent === 'function') {
            this.$textarea[0].dispatchEvent(new CustomEvent('ozi:change', {
                bubbles: true,
                detail: detail
            }));
        }
    };

    OziEditor.prototype.destroy = function () {
        $(document).off(this.ns);
        this.$textarea.off(this.ns);

        var $form = this.$textarea.closest('form');
        if ($form.length) {
            $form.off(this.ns);
        }

        if (this.$wrap) {
            this.$wrap.remove();
        }

        this.$textarea
            .removeData('ozi-editor-initialized')
            .show();

        delete instances[this.key];
    };

    OziEditor.prototype.reload = function () {
        var textarea = this.$textarea[0];
        this.destroy();
        instances[this.key] = new OziEditor(textarea);
        return instances[this.key];
    };

    window.OziEditor = {
        init: function (selector) {
            var $elements = selector ? $(selector) : $('[data-ozi-editor]');
            var $targets = $elements.filter('[data-ozi-editor]').add($elements.find('[data-ozi-editor]'));

            $targets.each(function () {
                var $el = $(this);
                var key = String($el.attr('data-ozi-editor') || '').trim();

                if (!key) return;

                var existing = instances[key];

                if (existing) {
                    var sameElement = existing.$textarea && existing.$textarea[0] === this;
                    var oldStillInDom = existing.$textarea && document.contains(existing.$textarea[0]);

                    if (sameElement && $el.data('ozi-editor-initialized')) {
                        return;
                    }

                    if (!sameElement && !oldStillInDom) {
                        existing.destroy();
                    } else if (!sameElement && oldStillInDom) {
                        return;
                    }
                }

                instances[key] = new OziEditor(this);
            });

            return this;
        },

        observe: function () {
            if (window.__oziEditorObserverInited) return;
            window.__oziEditorObserverInited = true;

            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
                        if (!node || node.nodeType !== 1) return;

                        var $node = $(node);

                        if ($node.is('[data-ozi-editor]')) {
                            window.OziEditor.init($node);
                            return;
                        }

                        var $children = $node.find('[data-ozi-editor]');
                        if ($children.length) {
                            window.OziEditor.init($node);
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            window.__oziEditorObserver = observer;
        },

        get: function (selectorOrKey) {
            if (!selectorOrKey) return null;

            if (
                typeof selectorOrKey === 'string' &&
                !selectorOrKey.startsWith('#') &&
                !selectorOrKey.startsWith('.')
            ) {
                return instances[selectorOrKey] || null;
            }

            var $el = $(selectorOrKey).first();
            if (!$el.length) return null;

            var key = String($el.attr('data-ozi-editor') || '').trim();
            return instances[key] || null;
        },

        value: function (selectorOrKey, newValue) {
            var instance = this.get(selectorOrKey);
            if (!instance) return null;

            if (newValue === undefined) {
                return instance.getValue();
            }

            return instance.setValue(newValue);
        },

        destroy: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            instance.destroy();
        },

        reload: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return null;
            return instance.reload();
        },
        setIconBase: function (path) {
            OZI_EDITOR_ICON_BASE = String(path || '').trim();
            if (OZI_EDITOR_ICON_BASE && !OZI_EDITOR_ICON_BASE.endsWith('/')) {
                OZI_EDITOR_ICON_BASE += '/';
            }
            oziEditorIconCache   = {};
            oziEditorIconPending = {};
        }

    };

    function oziEditorInitFetched(root) {
        window.OziEditor.init(root || document);
    }

    $(function () {
        window.OziEditor.init();
        window.OziEditor.observe();
    });

    window.oziEditorInitFetched = oziEditorInitFetched;


})(jQuery);