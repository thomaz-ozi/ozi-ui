/**
 * ------------------------------------------
 * ozi-select
 * ------------------------------------------
 * Ver: 5.0.1
 * 2026-05-30
 *
 * Changelog:
 *   - v5.0.1: [FIX-A] Fallbacks de _classMap corrigidos de BS5 para classes neutras OZI.
 *     Antes: 'invalid-feedback', 'is-invalid', 'is-valid', 'was-validated'
 *     Depois: 'ozi-feedback', 'ozi-invalid', 'ozi-valid', 'ozi-validated'
 *     O dev tem visual funcional por padrão via CSS do tema 'default'.
 *     Para personalizar, basta configurar oziConf({ classMap: { ... } }).
 *   - v5.0.0: Boot seguro — não depende de OZI.isReady/OZI.ready
 *   - v5.0.0: Namespace defensivo — OZI.components criado se não existir
 *   - v5.0.0: observe() exposto na API pública para re-init manual
 *   - v5.0.0: selectAPI.init() — escopo corrigido para aceitar elemento DOM
 */

(function ($) {
    'use strict';

    if (typeof $ === 'undefined') {
        console.error('[OZI:select] jQuery não encontrado.');
        return;
    }

    var instances      = {};
    var instanceCounter = 0;

    /* ─── helpers de lang / classMap com fallback ──────────────────── */

    function _t(key, fallback) {
        var lang = window.OZI && window.OZI.lang;
        if (lang && typeof lang.t === 'function') {
            var v = lang.t(key);
            if (v && v !== key) return v;
        }
        return fallback || key;
    }

    function _classMap(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        return (conf && conf.classMap && conf.classMap[key]) || fallback || '';
    }

    /* ─── construtor ───────────────────────────────────────────────── */

    function OziSelect(element) {
        this.$root = $(element);
        this.key   = String(this.$root.attr('data-ozi-select') || '').trim();
        if (!this.key) throw new Error('[OZI:select] data-ozi-select é obrigatório.');

        this.uid = 'ozi-select-' + (++instanceCounter);
        this.ns  = '.oziSelect.' + this.uid;

        this.isMultiple      = this.parseBooleanAttr('data-ozi-select-multiple');
        this.isMultipleGroup = this.parseBooleanAttr('data-ozi-select-multiple-group');

        if (this.isMultipleGroup)  { this.mode = 'multiple'; this.groupToggleEnabled = true; }
        else if (this.isMultiple)  { this.mode = 'multiple'; this.groupToggleEnabled = false; }
        else                       { this.mode = 'single';   this.groupToggleEnabled = false; }

        this.submitName        = String(this.$root.data('ozi-select-submit-name') || this.key).trim();
        this.valuePlaceholder  = String(this.$root.data('ozi-select-value-placeholder') || _t('select.valuePlaceholder', 'Selecione...'));
        this.searchPlaceholder = String(this.$root.data('ozi-select-search-placeholder') || _t('select.searchPlaceholder', 'Pesquisar...'));
        this.listHeight        = String(this.$root.data('ozi-select-list') || '').trim();
        this.imageDimension    = String(this.$root.data('ozi-select-image-dimension') || '').trim();
        this.valueIcon         = String(this.$root.data('ozi-select-value-icon') || '').trim();
        this.searchIcon        = String(this.$root.data('ozi-select-search-icon') || '').trim();

        this.hasSubmitFieldsConfig = this.$root.is('[data-ozi-select-submit-fields]');
        this.submitFieldsRaw       = String(this.$root.attr('data-ozi-select-submit-fields') || '');

        this.isDisabledConfig = this.parseBooleanAttr('data-ozi-select-disabled');
        this.isRequiredConfig = this.parseBooleanAttr('data-ozi-select-required');
        this.requiredMessage  = String(this.$root.attr('data-ozi-select-required-message') || _t('select.requiredMessage', 'Selecione uma opção.'));

        this.zldUrl      = String(this.$root.data('ozi-select-zld-url')       || '').trim();
        this.zldMethod   = String(this.$root.data('ozi-select-zld-method')    || 'POST').trim().toUpperCase();
        this.zldParam    = String(this.$root.data('ozi-select-zld-param')     || 'search').trim();
        this.zldItemName = String(this.$root.data('ozi-select-zld-item-name') || '').trim();
        this.zldMin      = this.parseIntegerAttr('data-ozi-select-zld-min',   1);
        this.zldDelay    = this.parseIntegerAttr('data-ozi-select-zld-delay', 300);
        this.zldLog      = this.parseBooleanAttr('data-ozi-select-zld-log');

        this.imageWidth  = '24px';
        this.imageHeight = '24px';

        this.options        = [];
        this.initialOptions = [];
        this.selectedItems  = [];
        this.submitFields   = [];
        this.isOpen         = false;
        this.lastSearchQuery = '';

        this.remoteRequestTimer    = null;
        this.remoteAbortController = null;
        this.remoteRequestSeq      = 0;

        this.$form            = null;
        this.$ui              = null;
        this.$control         = null;
        this.$value           = null;
        this.$clear           = null;
        this.$toggle          = null;
        this.$dropdown        = null;
        this.$search          = null;
        this.$list            = null;
        this.$hiddenContainer = null;
        this.$feedback        = null;

        this.init();
    }

    /* ─── helpers de atributo ──────────────────────────────────────── */

    OziSelect.prototype.parseBooleanAttr = function (attrName) {
        if (!this.$root.is('[' + attrName + ']')) return false;
        var raw = this.$root.attr(attrName);
        if (raw === undefined || raw === '') return true;
        raw = String(raw).trim().toLowerCase();
        return !(raw === 'false' || raw === '0' || raw === 'no' || raw === 'off');
    };

    OziSelect.prototype.parseIntegerAttr = function (attrName, fallback) {
        if (!this.$root.is('[' + attrName + ']')) return fallback;
        var parsed = parseInt(String(this.$root.attr(attrName) || '').trim(), 10);
        return isNaN(parsed) ? fallback : parsed;
    };

    /* ─── alias map ────────────────────────────────────────────────── */

    OziSelect.prototype.parseAliasMap = function () {
        var raw = String(this.$root.attr('data-ozi-select-as') || '').trim();
        var map = {};
        if (!raw) return map;
        raw.split(',').forEach(function (chunk) {
            var parts     = chunk.split('=');
            var canonical = String(parts[0] || '').trim();
            var alias     = String(parts[1] || '').trim();
            if (canonical && alias && canonical !== alias) map[canonical] = alias;
        });
        return map;
    };

    OziSelect.prototype.normalizeOptions = function (options) {
        var map = this.aliasMap;
        if (!map || !Object.keys(map).length) return options;
        return (Array.isArray(options) ? options : []).map(function (item) {
            if (!item || typeof item !== 'object') return item;
            var normalized = {};
            Object.keys(item).forEach(function (key) { normalized[key] = item[key]; });
            Object.keys(map).forEach(function (canonical) {
                var alias = map[canonical];
                if (Object.prototype.hasOwnProperty.call(item, alias)) {
                    normalized[canonical] = item[alias];
                    delete normalized[alias];
                }
            });
            return normalized;
        });
    };

    /* ─── estado ───────────────────────────────────────────────────── */

    OziSelect.prototype.isDisabled            = function () { return !!this.isDisabledConfig; };
    OziSelect.prototype.isRequired            = function () { return !this.isDisabled() && !!this.isRequiredConfig; };
    OziSelect.prototype.isSelectionValid      = function () { return this.selectedItems.length > 0; };
    OziSelect.prototype.isRemoteSearchEnabled = function () { return !!this.zldUrl; };

    /* ─── init ─────────────────────────────────────────────────────── */

    OziSelect.prototype.init = function () {
        if (this.$root.data('ozi-select-initialized')) return;
        this.$root.data('ozi-select-initialized', true);

        this.parseImageDimension();

        this.submitMode = this.normalizeSubmitMode(
            this.$root.attr('data-ozi-select-submit-mode') ||
            (this.hasSubmitFieldsConfig ? 'legacy' : 'value-label')
        );

        this.submitExtraFields = this.parseSubmitExtraFields(this.$root.attr('data-ozi-select-submit-extra') || '');
        this.submitFields      = this.hasSubmitFieldsConfig ? this.parseSubmitFields(this.submitFieldsRaw) : [];
        this.aliasMap          = this.parseAliasMap();
        this.options           = this.normalizeOptions(this.loadOptions());
        this.initialOptions    = this.cloneOptions(this.options);

        this.$hiddenContainer = this.resolveHiddenContainer();
        this.$form            = this.$root.closest('form');

        this.buildUI();
        this.writeOptionsScript(this.options);
        this.loadInitialSelection();
        this.syncHiddenInputs();
        this.applyStateStyles();
        this.updateUI();
        this.renderOptions('');
        this.bindEvents();
        this.bindFormEvents();
    };

    OziSelect.prototype.parseImageDimension = function () {
        if (!this.imageDimension) return;
        var dims        = this.imageDimension.split(',');
        this.imageWidth  = (dims[0] || '').trim() || '24px';
        this.imageHeight = (dims[1] || dims[0] || '').trim() || '24px';
    };

    OziSelect.prototype.parseSubmitFields = function (raw) {
        var fields = [];
        String(raw || '').split(',').forEach(function (chunk) {
            var item   = String(chunk || '').trim();
            if (!item) return;
            var parts  = item.split(':');
            var source = String(parts[0] || '').trim();
            var target = String(parts[1] || parts[0] || '').trim();
            if (source && target) fields.push({ source: source, target: target });
        });
        return fields;
    };

    /* ─── opções ───────────────────────────────────────────────────── */

    OziSelect.prototype.loadOptions = function () {
        var key      = this.key;
        var selector = 'script[data-ozi-select-options="' + key + '"]';
        var $script  = this.$root.nextAll(selector).first();
        if (!$script.length) $script = this.$root.parent().find(selector).first();
        if (!$script.length) $script = $(selector).first();
        if (!$script.length) return [];
        try {
            var parsed = JSON.parse($script.text().trim() || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('[OZI:select] Erro ao parsear opções do select "' + key + '":', e.message);
            return [];
        }
    };

    OziSelect.prototype.ensureOptionsScript = function () {
        var selector = 'script[data-ozi-select-options="' + this.key + '"]';
        var $script  = $(selector).first();
        if (!$script.length) {
            $script = $('<script>', { type: 'application/json', 'data-ozi-select-options': this.key });
            this.$root.after($script);
        }
        return $script;
    };

    OziSelect.prototype.writeOptionsScript = function (options) {
        this.ensureOptionsScript().text(JSON.stringify(Array.isArray(options) ? options : [], null, 2));
    };

    OziSelect.prototype.resolveHiddenContainer = function () {
        var $c = $('<div>', {
            id: this.uid + '-hidden',
            class: 'ozi-select-hidden-container',
            'data-ozi-select-generated-hidden': this.key,
            'aria-hidden': 'true'
        });
        this.$root.after($c);
        return $c;
    };

    /* ─── build UI ─────────────────────────────────────────────────── */

    OziSelect.prototype.buildUI = function () {
        var listId = this.uid + '-list';
        this.$root.empty().addClass('ozi-select-root');

        this.$ui = $('<div>', { class: 'ozi-select-ui ozi-select-ui-v400' });

        this.$control = $('<div>', {
            class:            'ozi-select-control',
            tabindex:         this.isDisabled() ? -1 : 0,
            role:             'combobox',
            'aria-haspopup': 'listbox',
            'aria-expanded': 'false',
            'aria-controls':  listId,
            'aria-invalid':  'false'
        });

        this.$value  = $('<div>', { class: 'ozi-select-value' });
        var $actions = $('<div>', { class: 'ozi-select-actions' });
        this.$clear  = $('<button>', { type: 'button', class: 'ozi-select-clear', 'aria-label': 'Limpar seleção' }).html('&times;');
        this.$toggle = $('<button>', { type: 'button', class: 'ozi-select-toggle', 'aria-label': 'Abrir opções' }).html('&#9662;');
        $actions.append(this.$clear, this.$toggle);

        if (this.valueIcon) {
            this.$control.append(
                $('<span>', { class: 'ozi-select-value-icon', 'aria-hidden': 'true' }).append($('<i>', { class: this.valueIcon })),
                this.$value, $actions
            );
        } else {
            this.$control.append(this.$value, $actions);
        }

        this.$dropdown  = $('<div>', { class: 'ozi-select-dropdown' });
        var $searchWrap = $('<div>', { class: 'ozi-select-search-wrap' });
        this.$search    = $('<input>', {
            type:         'text',
            class:        'ozi-select-search',
            name:         this.key + '_select_search',
            placeholder:  this.searchPlaceholder,
            autocomplete: 'off'
        });

        if (this.searchIcon) {
            $searchWrap.append(
                $('<span>', { class: 'ozi-select-search-icon', 'aria-hidden': 'true' }).append($('<i>', { class: this.searchIcon })),
                this.$search
            );
        } else {
            $searchWrap.append(this.$search);
        }

        this.$list = $('<div>', { class: 'ozi-select-list', id: listId, role: 'listbox' });
        if (this.listHeight) this.$list.css('max-height', this.listHeight);

        // [FIX-A] fallback neutro OZI em vez de 'invalid-feedback' (BS5)
        var feedbackClass = _classMap('feedback', 'ozi-feedback');
        this.$feedback = $('<div>', { class: feedbackClass + ' ozi-select-feedback' }).text(this.requiredMessage);

        this.$dropdown.append($searchWrap, this.$list);
        this.$ui.append(this.$control, this.$dropdown);
        this.$root.append(this.$ui, this.$feedback);
    };

    OziSelect.prototype.applyStateStyles = function () {
        var disabled = this.isDisabled();
        this.$control
            .toggleClass('is-disabled', disabled)
            .attr('aria-disabled', disabled ? 'true' : 'false')
            .attr('tabindex', disabled ? -1 : 0);
        this.$search.prop('disabled', disabled);
        this.$clear.prop('disabled', disabled);
        this.$toggle.prop('disabled', disabled);
        if (disabled) { this.clearInvalid(); this.close(); }
    };

    /* ─── eventos ──────────────────────────────────────────────────── */

    OziSelect.prototype.bindEvents = function () {
        var self = this;

        this.$ui.on('click', '.ozi-select-control', function (e) {
            if (self.isDisabled()) return;
            if ($(e.target).closest('.ozi-select-clear, .ozi-select-toggle, .ozi-select-tag-remove').length) return;
            self.toggle();
        });

        this.$ui.on('click', '.ozi-select-group-label[data-ozi-group-toggle]', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (self.isDisabled() || self.mode !== 'multiple') return;
            self.toggleGroup($(this).attr('data-ozi-group-toggle'), true);
        });

        this.$ui.on('click', '.ozi-select-toggle', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (self.isDisabled()) return;
            self.toggle();
        });

        this.$ui.on('click', '.ozi-select-clear', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (self.isDisabled()) return;
            self.clearSelection();
        });

        this.$ui.on('input', '.ozi-select-search', function () {
            if (self.isDisabled()) return;
            self.handleSearchInput($(this).val() || '');
        });

        this.$ui.on('click', '.ozi-select-option', function (e) {
            e.preventDefault();
            if (self.isDisabled()) return;
            var item = self.findOptionByValue($(this).attr('data-value'));
            if (item) self.toggleItem(item);
        });

        this.$ui.on('click', '.ozi-select-tag-remove', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (self.isDisabled()) return;
            self.unselectItem($(this).attr('data-value'));
        });

        this.$ui.on('keydown', '.ozi-select-control, .ozi-select-search', function (e) {
            if (self.isDisabled()) return;
            self.handleKeydown(e);
        });

        $(document).on('click' + this.ns, function (e) {
            if (!self.$ui.is(e.target) && self.$ui.has(e.target).length === 0) self.close();
        });
    };

    OziSelect.prototype.bindFormEvents = function () {
        var self = this;
        if (!this.$form || !this.$form.length) return;
        this.$form.on('submit' + this.ns, function (e) {
            if (!self.validate()) {
                e.preventDefault();
                // [FIX-A] fallback neutro OZI em vez de 'was-validated' (BS5)
                self.$form.addClass(_classMap('formValidated', 'ozi-validated'));
            }
        });
        this.$form.on('reset' + this.ns, function () {
            setTimeout(function () { self.resetToInitial(); }, 0);
        });
    };

    OziSelect.prototype.handleKeydown = function (e) {
        if (!this.isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.open(false); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.open(true); }
            return;
        }
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); this.highlightNext(); break;
            case 'ArrowUp':   e.preventDefault(); this.highlightPrev(); break;
            case 'Enter':
                e.preventDefault();
                var $h = this.getHighlightedOption();
                if ($h.length) { var item = this.findOptionByValue($h.attr('data-value')); if (item) this.toggleItem(item); }
                break;
            case 'Escape': e.preventDefault(); this.close(true); break;
            case 'Tab':    this.close(); break;
            case 'Home':   e.preventDefault(); this.highlightFirstVisible(); break;
            case 'End':    e.preventDefault(); this.highlightLastVisible(); break;
        }
    };

    /* ─── open / close / toggle ────────────────────────────────────── */

    OziSelect.prototype.open = function (preferLast) {
        if (this.isDisabled() || this.isOpen) return;
        this.isOpen = true;
        this.$ui.addClass('is-open');
        this.$control.attr('aria-expanded', 'true');
        this.renderOptions(this.$search.val() || '');
        this.syncHighlightAfterRender(!!preferLast);
        this.$search.trigger('focus');
        this.emit('ozi:open');
    };

    OziSelect.prototype.close = function (focusControl) {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.$ui.removeClass('is-open');
        this.$control.attr('aria-expanded', 'false');
        this.$search.val('');
        this.lastSearchQuery = '';
        this.renderOptions('');
        this.$list.find('.ozi-select-option').removeClass('is-highlighted');
        if (focusControl && !this.isDisabled()) this.$control.trigger('focus');
        this.emit('ozi:close');
    };

    OziSelect.prototype.toggle = function () {
        if (this.isDisabled()) return;
        this.isOpen ? this.close() : this.open(false);
    };

    /* ─── seleção ──────────────────────────────────────────────────── */

    OziSelect.prototype.findOptionInList = function (list, value) {
        var found = null;
        (Array.isArray(list) ? list : []).some(function (item) {
            if (String(item.value) === String(value)) { found = item; return true; }
            return false;
        });
        return found;
    };

    OziSelect.prototype.findOptionByValue = function (value) { return this.findOptionInList(this.options, value); };
    OziSelect.prototype.isSelected        = function (value) { return this.selectedItems.some(function (item) { return String(item.value) === String(value); }); };

    OziSelect.prototype.toggleItem = function (item) {
        var exists = this.isSelected(item.value);
        if (this.mode === 'single') {
            this.selectedItems = [item];
            this.syncHiddenInputs(); this.updateUI(); this.close(true); this.clearInvalid(); this.emitChange();
            return;
        }
        if (exists) { this.unselectItem(item.value); return; }
        this.selectedItems.push(item);
        this.syncHiddenInputs(); this.updateUI();
        this.renderOptions(this.$search.val() || '');
        this.syncHighlightAfterRender(false); this.clearInvalid(); this.emitChange();
    };

    OziSelect.prototype.unselectItem = function (value) {
        var before = this.selectedItems.length;
        this.selectedItems = this.selectedItems.filter(function (item) { return String(item.value) !== String(value); });
        if (this.selectedItems.length !== before) {
            this.syncHiddenInputs(); this.updateUI();
            this.renderOptions(this.$search.val() || '');
            this.syncHighlightAfterRender(false); this.validate(false); this.emitChange();
        }
    };

    OziSelect.prototype.clearSelection = function () {
        if (this.isDisabled() || !this.selectedItems.length) return;
        this.selectedItems = [];
        this.syncHiddenInputs(); this.updateUI();
        this.renderOptions(this.$search.val() || '');
        this.clearInvalid(); this.emitChange();
    };

    OziSelect.prototype.loadInitialSelection = function () {
        var defaults = this.options.filter(function (item) { return item && item.selected === true; });
        this.selectedItems = this.mode === 'single' ? (defaults[0] ? [defaults[0]] : []) : defaults;
    };

    OziSelect.prototype.applySelectedDefaultsFromOptions = function () {
        if (this.selectedItems.length > 0) return;
        var defaults = this.options.filter(function (item) { return item && item.selected === true; });
        if (!defaults.length) return;
        this.selectedItems = this.mode === 'single' ? [defaults[0]] : defaults.slice();
    };

    OziSelect.prototype.resetToInitial = function () {
        this.abortRemoteRequest(); this.lastSearchQuery = '';
        this.options = this.cloneOptions(this.initialOptions);
        this.writeOptionsScript(this.options);
        this.loadInitialSelection();
        this.syncHiddenInputs(); this.updateUI(); this.renderOptions(''); this.clearInvalid();
    };

    /* ─── hidden inputs ────────────────────────────────────────────── */

    OziSelect.prototype.buildInputName = function (base, index, path) {
        var name = String(base) + '[' + index + ']';
        String(path || '').split('.').forEach(function (part) { part = String(part || '').trim(); if (part) name += '[' + part + ']'; });
        return name;
    };

    OziSelect.prototype.appendHiddenInput = function (name, value) {
        var $input = $('<input>', { type: 'hidden', name: name, value: value == null ? '' : String(value) });
        $input.prop('disabled', this.isDisabled());
        this.$hiddenContainer.append($input);
    };

    OziSelect.prototype.shouldSkipAutoSubmitKey = function (key) {
        key = String(key || '');
        if (!key || key.charAt(0) === '_') return true;
        return ['selected', 'optionHtml', 'optionClass'].indexOf(key) !== -1;
    };

    OziSelect.prototype.normalizeSubmitMode = function (raw) {
        var mode = String(raw || '').trim().toLowerCase();
        if (!mode) return 'value-label';
        if (['legacy', 'value', 'value-label'].indexOf(mode) === -1) return 'value-label';
        return mode;
    };

    OziSelect.prototype.parseSubmitExtraFields = function (raw) {
        return this.parseListString(raw)
            .map(function (i) { return String(i || '').trim().toLowerCase(); })
            .filter(Boolean)
            .filter(function (i, idx, arr) { return arr.indexOf(i) === idx && i !== 'value'; });
    };

    OziSelect.prototype.getValueByPath = function (obj, path) {
        var current = obj;
        String(path || '').split('.').forEach(function (key) {
            if (current == null || typeof current !== 'object' || !(key in current)) { current = undefined; return; }
            current = current[key];
        });
        return current;
    };

    OziSelect.prototype.appendStructuredHiddenInputs = function (item) {
        if (!item || typeof item !== 'object') return;
        var self = this;
        Object.keys(item).forEach(function (key) {
            if (self.shouldSkipAutoSubmitKey(key)) return;
            var value = item[key];
            if (value !== null && typeof value === 'object') return;
            var inputName = key === 'value' ? self.submitName : self.submitName + '_' + key;
            if (self.mode === 'multiple') inputName += '[]';
            self.appendHiddenInput(inputName, value == null ? '' : String(value));
        });
    };

    OziSelect.prototype.syncHiddenInputs = function () {
        var self = this;
        this.$hiddenContainer.empty();
        this.selectedItems.forEach(function (item, index) {
            if (self.submitMode === 'legacy' && self.hasSubmitFieldsConfig && self.submitFields.length) {
                self.submitFields.forEach(function (field) {
                    var value = self.getValueByPath(item, field.source);
                    if (value !== undefined && value !== null) self.appendHiddenInput(self.buildInputName(self.submitName, index, field.target), value);
                });
                return;
            }
            self.appendStructuredHiddenInputs(item);
        });
    };

    /* ─── render ───────────────────────────────────────────────────── */

    OziSelect.prototype.stripHtml          = function (v) { return String(v || '').replace(/<[^>]*>/g, ' '); };
    OziSelect.prototype.normalize          = function (v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    OziSelect.prototype.cloneOptions       = function (o) { try { return JSON.parse(JSON.stringify(Array.isArray(o) ? o : [])); } catch (e) { return Array.isArray(o) ? o.slice() : []; } };
    OziSelect.prototype.parseListString    = function (raw) { if (!raw) return []; if (Array.isArray(raw)) return raw; var s = String(raw).trim(); if (!s) return []; return s.split(',').map(function (i) { return String(i || '').trim(); }).filter(Boolean); };
    OziSelect.prototype.renderOptionalHtml = function ($t, html) { if (!html) return false; $t.html(String(html)); return true; };

    OziSelect.prototype.flattenSearchText = function (obj) {
        var parts = []; var self = this;
        function walk(value, keyName) {
            if (value == null) return;
            if (Array.isArray(value)) { value.forEach(function (i) { walk(i, keyName); }); return; }
            if (typeof value === 'object') { Object.keys(value).forEach(function (k) { if (k !== 'selected') walk(value[k], k); }); return; }
            if (typeof value === 'string' || typeof value === 'number') {
                var text = String(value);
                if (keyName === 'optionHtml') text = self.stripHtml(text);
                parts.push(text);
            }
        }
        walk(obj, ''); return parts.join(' ');
    };

    OziSelect.prototype.buildRenderBlocks = function (items) {
        var blocks = []; var groupMap = Object.create(null);
        items.forEach(function (item) {
            var groupName = item && item.group != null ? String(item.group).trim() : '';
            if (!groupName) { blocks.push({ type: 'option', item: item }); return; }
            if (!groupMap[groupName]) { groupMap[groupName] = { type: 'group', group: groupName, options: [] }; blocks.push(groupMap[groupName]); }
            groupMap[groupName].options.push(item);
        });
        return blocks;
    };

    OziSelect.prototype.renderGroupBlock = function (block) {
        var groupSelected = this.groupToggleEnabled && this.mode === 'multiple' ? this.isGroupFullySelected(block.group, true) : false;
        var groupPartial  = this.groupToggleEnabled && this.mode === 'multiple' ? this.isGroupPartiallySelected(block.group, true) : false;
        var $group = $('<div>', { class: 'ozi-select-group', 'data-ozi-group': block.group });
        var $label = $('<div>', {
            class: 'ozi-select-group-label' + (groupSelected ? ' is-group-selected' : '') + (groupPartial ? ' is-group-partial' : ''),
            role: 'presentation'
        }).text(block.group);
        if (this.groupToggleEnabled && this.mode === 'multiple' && !this.isDisabled()) $label.attr('data-ozi-group-toggle', block.group);
        $group.append($label);
        var self = this; block.options.forEach(function (item) { $group.append(self.buildOption(item)); });
        return $group;
    };

    OziSelect.prototype.getGroupVisibleOptions   = function (groupName) { return this.$list.find('.ozi-select-group[data-ozi-group="' + String(groupName).replace(/"/g, '\\"') + '"] .ozi-select-option:visible'); };
    OziSelect.prototype.getItemsByGroup          = function (groupName, onlyVisible) { var group = String(groupName || ''); var values = onlyVisible ? this.getGroupVisibleOptions(group).map(function () { return String($(this).attr('data-value')); }).get() : null; return this.options.filter(function (item) { var same = String(item.group || '') === group; if (!same) return false; if (!onlyVisible) return true; return values.indexOf(String(item.value)) !== -1; }); };
    OziSelect.prototype.isGroupFullySelected     = function (groupName, onlyVisible) { var items = this.getItemsByGroup(groupName, onlyVisible); if (!items.length) return false; var self = this; return items.every(function (item) { return self.isSelected(item.value); }); };
    OziSelect.prototype.isGroupPartiallySelected = function (groupName, onlyVisible) { var items = this.getItemsByGroup(groupName, onlyVisible); if (!items.length) return false; var self = this; var count = items.filter(function (item) { return self.isSelected(item.value); }).length; return count > 0 && count < items.length; };

    OziSelect.prototype.toggleGroup = function (groupName, onlyVisible) {
        if (this.isDisabled() || this.mode !== 'multiple' || !this.groupToggleEnabled) return;
        var items = this.getItemsByGroup(groupName, onlyVisible); if (!items.length) return;
        var shouldSelectAll = !this.isGroupFullySelected(groupName, onlyVisible); var self = this;
        if (shouldSelectAll) { items.forEach(function (item) { if (!self.isSelected(item.value)) self.selectedItems.push(item); }); }
        else { var toRemove = items.map(function (item) { return String(item.value); }); this.selectedItems = this.selectedItems.filter(function (s) { return toRemove.indexOf(String(s.value)) === -1; }); }
        this.syncHiddenInputs(); this.updateUI();
        this.renderOptions(this.$search.val() || '');
        this.syncHighlightAfterRender(false); this.validate(false); this.emitChange();
    };

    OziSelect.prototype.renderOptions = function (query) {
        var self = this; var normalizedQuery = this.normalize(query || '');
        this.$list.empty();
        var filtered = this.options.filter(function (item) {
            if (!normalizedQuery) return true;
            return self.normalize(self.flattenSearchText(item)).indexOf(normalizedQuery) !== -1;
        });
        if (!filtered.length) {
            var msg = this.$ui.hasClass('is-loading')
                ? _t('common.loading', 'Carregando...')
                : _t('select.empty', 'Nenhum resultado encontrado');
            this.$list.append($('<div>', { class: 'ozi-select-empty' }).text(msg));
            return;
        }
        var blocks = this.buildRenderBlocks(filtered);
        blocks.forEach(function (block) {
            if (block.type === 'option') { self.$list.append(self.buildOption(block.item)); return; }
            if (block.type === 'group')  { self.$list.append(self.renderGroupBlock(block)); }
        });
    };

    OziSelect.prototype.buildOption = function (item) {
        var selected = this.isSelected(item.value);
        var $option  = $('<div>', {
            class:         'ozi-select-option' + (selected ? ' is-selected' : ''),
            'data-value':  item.value,
            role:          'option',
            'aria-selected': selected ? 'true' : 'false'
        });
        if (item.optionClass && String(item.optionClass).trim()) $option.addClass(String(item.optionClass).trim());
        if (item.optionHtml && String(item.optionHtml).trim()) {
            var $custom = $('<div>', { class: 'ozi-select-option-custom' });
            this.renderOptionalHtml($custom, item.optionHtml);
            $option.append($custom); return $option;
        }
        var $content = $('<div>', { class: 'ozi-select-option-content' });
        if (item.image) {
            $content.append($('<img>', { class: 'ozi-select-option-image', src: item.image, alt: item.label || '', css: { width: this.imageWidth, height: this.imageHeight } }));
        } else {
            $content.append($('<div>', { class: 'ozi-select-option-image is-no-image', css: { width: this.imageWidth, height: this.imageHeight } }));
        }
        var $texts = $('<div>', { class: 'ozi-select-option-texts' });
        var $label = $('<div>', { class: 'ozi-select-option-label' });
        if (item.label && String(item.label).trim()) { $label.html(String(item.label)); } else { $label.text(String(item.value || '')); }
        $texts.append($label);
        if (item.subLabel && String(item.subLabel).trim()) $texts.append($('<div>', { class: 'ozi-select-option-sublabel' }).html(String(item.subLabel)));
        $content.append($texts); $option.append($content);
        return $option;
    };

    /* ─── updateUI ─────────────────────────────────────────────────── */

    OziSelect.prototype.updateUI = function () {
        this.$value.empty();
        if (!this.selectedItems.length) {
            this.$value.addClass('is-placeholder').append(
                $('<div>', { class: 'ozi-select-value-content' })
                    .append($('<div>', { class: 'ozi-select-value-image is-no-image' }))
                    .append($('<span>', { class: 'ozi-select-value-label' }).text(this.valuePlaceholder))
            );
            this.$clear.hide(); return;
        }
        this.$value.removeClass('is-placeholder');
        if (this.mode === 'single') {
            this.$value.append(this.buildSelectedPreview(this.selectedItems[0]));
        } else {
            var $tags = $('<div>', { class: 'ozi-select-tags' }); var self = this;
            this.selectedItems.forEach(function (item) {
                var $tag = $('<span>', { class: 'ozi-select-tag' });
                if (item.image) $tag.append($('<img>', { class: 'ozi-select-tag-image', src: item.image, alt: item.label || '', css: { width: self.imageWidth, height: self.imageHeight } }));
                var $tagLabel = $('<span>', { class: 'ozi-select-tag-label' });
                if (item.label && String(item.label).trim()) { $tagLabel.html(String(item.label)); } else { $tagLabel.text(String(item.value || '')); }
                $tag.append($tagLabel).append(
                    $('<button>', { type: 'button', class: 'ozi-select-tag-remove', 'data-value': item.value, 'aria-label': 'Remover ' + (item.label || item.value || '') }).html('&times;')
                );
                $tags.append($tag);
            });
            this.$value.append($tags);
        }
        this.$clear.toggle(!this.isDisabled());
    };

    OziSelect.prototype.buildSelectedPreview = function (item) {
        var $content = $('<div>', { class: 'ozi-select-value-content' });
        if (item.image) { $content.append($('<img>', { class: 'ozi-select-value-image', src: item.image, alt: item.label || '', css: { width: this.imageWidth, height: this.imageHeight } })); }
        else            { $content.append($('<div>', { class: 'ozi-select-value-image is-no-image', css: { width: this.imageWidth, height: this.imageHeight } })); }
        var $texts = $('<div>', { class: 'ozi-select-value-texts' });
        var $label = $('<div>', { class: 'ozi-select-value-label' });
        if (item.label && String(item.label).trim()) { $label.html(String(item.label)); } else { $label.text(String(item.value || '')); }
        $texts.append($label);
        if (item.subLabel && String(item.subLabel).trim()) $texts.append($('<div>', { class: 'ozi-select-value-sublabel' }).html(String(item.subLabel)));
        $content.append($texts); return $content;
    };

    /* ─── highlight / teclado ──────────────────────────────────────── */

    OziSelect.prototype.getVisibleOptions        = function () { return this.$list.find('.ozi-select-option:visible'); };
    OziSelect.prototype.getHighlightedOption      = function () { return this.$list.find('.ozi-select-option.is-highlighted').first(); };
    OziSelect.prototype.getSelectedVisibleOption  = function () { var self = this; if (!this.selectedItems.length) return $(); return this.getVisibleOptions().filter(function () { var v = $(this).attr('data-value'); return self.selectedItems.some(function (i) { return String(i.value) === String(v); }); }).first(); };
    OziSelect.prototype.highlightOption           = function ($o) { this.$list.find('.ozi-select-option').removeClass('is-highlighted'); if ($o && $o.length) { $o.addClass('is-highlighted'); this.ensureOptionVisible($o); } };
    OziSelect.prototype.highlightFirstVisible     = function () { this.highlightOption(this.getVisibleOptions().first()); };
    OziSelect.prototype.highlightLastVisible      = function () { this.highlightOption(this.getVisibleOptions().last()); };
    OziSelect.prototype.highlightNext             = function () { var $v = this.getVisibleOptions(); var $c = this.getHighlightedOption(); var i = $c.length ? $v.index($c) : -1; var $n = $v.eq(i + 1); if ($n.length) this.highlightOption($n); else if (!$c.length && $v.length) this.highlightFirstVisible(); };
    OziSelect.prototype.highlightPrev             = function () { var $v = this.getVisibleOptions(); var $c = this.getHighlightedOption(); var i = $c.length ? $v.index($c) : $v.length; var $p = $v.eq(i - 1); if ($p.length) this.highlightOption($p); else if (!$c.length && $v.length) this.highlightLastVisible(); };
    OziSelect.prototype.ensureOptionVisible       = function ($o) { if (!$o || !$o.length) return; var l = this.$list; var oT = $o.position().top + l.scrollTop(); var oB = oT + $o.outerHeight(); var lT = l.scrollTop(); var lB = lT + l.innerHeight(); if (oT < lT) l.scrollTop(oT); else if (oB > lB) l.scrollTop(oB - l.innerHeight()); };
    OziSelect.prototype.syncHighlightAfterRender  = function (preferLast) { var $v = this.getVisibleOptions(); var $s = this.getSelectedVisibleOption(); if (!$v.length) { this.$list.find('.ozi-select-option').removeClass('is-highlighted'); return; } if ($s.length) this.highlightOption($s); else if (preferLast) this.highlightLastVisible(); else this.highlightFirstVisible(); };

    /* ─── validação ────────────────────────────────────────────────── */

    OziSelect.prototype.focusControl = function () { if (!this.isDisabled()) this.$control.trigger('focus'); };

    OziSelect.prototype.markInvalid = function (focusControl) {
        // [FIX-A] fallback neutro OZI em vez de 'is-invalid' (BS5)
        var cls = _classMap('invalid', 'ozi-invalid');
        this.$control.addClass(cls).attr('aria-invalid', 'true');
        this.$feedback.text(this.requiredMessage).addClass('is-visible');
        if (focusControl !== false) this.focusControl();
    };

    OziSelect.prototype.clearInvalid = function () {
        // [FIX-A] fallback neutro OZI em vez de 'is-invalid' (BS5)
        var cls = _classMap('invalid', 'ozi-invalid');
        this.$control.removeClass(cls).attr('aria-invalid', 'false');
        this.$feedback.removeClass('is-visible');
    };

    OziSelect.prototype.validate = function (focusControl) {
        if (!this.isRequired()) { this.clearInvalid(); return true; }
        if (this.isSelectionValid()) { this.clearInvalid(); return true; }
        this.markInvalid(focusControl !== false); return false;
    };

    /* ─── emit ─────────────────────────────────────────────────────── */

    OziSelect.prototype.emit = function (eventName) {
        var detail = { key: this.key, value: this.getValue(), items: this.getSelectedItems(), instance: this };
        this.$root.trigger(eventName, [detail.items, this, detail]);
        if (this.$root && this.$root[0] && typeof CustomEvent === 'function') {
            this.$root[0].dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: detail }));
        }
    };

    OziSelect.prototype.emitChange = function () { this.emit('ozi:change'); };

    /* ─── API de leitura / escrita ─────────────────────────────────── */

    OziSelect.prototype.getSelectedItems = function () { return this.selectedItems.slice(); };
    OziSelect.prototype.getValue         = function () { if (this.mode === 'single') return this.selectedItems[0] ? this.selectedItems[0].value : null; return this.selectedItems.map(function (i) { return i.value; }); };

    OziSelect.prototype.setValue = function (value) {
        var self = this;
        if (this.mode === 'single') {
            var item = this.findOptionByValue(value);
            this.selectedItems = item ? [item] : [];
        } else {
            var values = Array.isArray(value) ? value : [value];
            this.selectedItems = values.map(function (v) { return self.findOptionByValue(v); }).filter(Boolean);
        }
        this.syncHiddenInputs(); this.updateUI();
        this.renderOptions(this.$search ? (this.$search.val() || '') : '');
        this.validate(false); this.emitChange();
    };

    OziSelect.prototype.setDisabled = function (state) {
        this.isDisabledConfig = !!state;
        if (this.isDisabledConfig) { this.$root.attr('data-ozi-select-disabled', 'disabled'); }
        else                       { this.$root.removeAttr('data-ozi-select-disabled'); }
        this.applyStateStyles(); this.syncHiddenInputs(); this.updateUI(); this.validate(false);
    };

    OziSelect.prototype.setRequired = function (state) {
        this.isRequiredConfig = !!state;
        if (this.isRequiredConfig) { this.$root.attr('data-ozi-select-required', 'required'); }
        else                       { this.$root.removeAttr('data-ozi-select-required'); }
        this.validate(false);
    };

    /* ─── busca remota ─────────────────────────────────────────────── */

    OziSelect.prototype.abortRemoteRequest = function () {
        if (this.remoteRequestTimer) { clearTimeout(this.remoteRequestTimer); this.remoteRequestTimer = null; }
        if (this.remoteAbortController) { this.remoteAbortController.abort(); this.remoteAbortController = null; }
    };

    OziSelect.prototype.reconcileSelectedItems = function () {
        var self = this; var next = [];
        this.selectedItems.forEach(function (old) { var fresh = self.findOptionInList(self.options, old.value); next.push(fresh ? fresh : old); });
        var unique = []; var seen = {};
        next.forEach(function (item) { var k = String(item.value); if (seen[k]) return; seen[k] = true; unique.push(item); });
        this.selectedItems = unique;
        this.applySelectedDefaultsFromOptions();
    };

    OziSelect.prototype.extractOptionsFromRemoteResponse = function (json) {
        if (Array.isArray(json)) return json;
        if (json && Array.isArray(json.options)) return json.options;
        return [];
    };

    OziSelect.prototype.resetRemoteOptionsToInitial = function () {
        this.options = this.cloneOptions(this.initialOptions);
        this.writeOptionsScript(this.options); this.reconcileSelectedItems(); this.updateUI();
        this.renderOptions(this.lastSearchQuery || ''); this.syncHighlightAfterRender(false);
    };

    OziSelect.prototype.applyRemoteOptions = function (options, query) {
        this.options = this.cloneOptions(this.normalizeOptions(options));
        this.writeOptionsScript(this.options); this.reconcileSelectedItems(); this.updateUI();
        this.renderOptions(query || ''); this.syncHighlightAfterRender(false);
    };

    OziSelect.prototype.setRemoteLoading = function (state) { this.$ui.toggleClass('is-loading', !!state); };

    OziSelect.prototype.handleSearchInput = function (query) {
        var self = this; var text = String(query || '').trim();
        this.lastSearchQuery = text;
        this.renderOptions(text); this.syncHighlightAfterRender(false);
        if (!this.isRemoteSearchEnabled()) return;
        if (this.remoteRequestTimer) { clearTimeout(this.remoteRequestTimer); this.remoteRequestTimer = null; }
        if (!text.length || text.length < this.zldMin) { this.abortRemoteRequest(); this.resetRemoteOptionsToInitial(); return; }
        this.remoteRequestTimer = setTimeout(function () { self.fetchRemoteOptions(text); }, this.zldDelay);
    };

    OziSelect.prototype.appendRemoteParamsToUrl = function (url, query) {
        var finalUrl = String(url || '');
        var joiner   = finalUrl.indexOf('?') >= 0 ? '&' : '?';
        if (this.zldParam) finalUrl += joiner + encodeURIComponent(this.zldParam) + '=' + encodeURIComponent(query);
        return finalUrl;
    };

    OziSelect.prototype.fetchRemoteOptions = function (query) {
        var self = this;
        if (!this.isRemoteSearchEnabled()) return;
        this.abortRemoteRequest();
        this.remoteRequestSeq += 1;
        var requestId = this.remoteRequestSeq;
        this.remoteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        this.setRemoteLoading(true);

        var csrf   = $('meta[name="csrf-token"]').attr('content');
        var method = this.zldMethod === 'GET' ? 'GET' : 'POST';
        var headers = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
        if (csrf) headers['X-CSRF-TOKEN'] = csrf;

        var url = this.zldUrl;
        var fetchConfig = { method: method, headers: headers };
        if (this.remoteAbortController) fetchConfig.signal = this.remoteAbortController.signal;

        if (method === 'GET') {
            url = this.appendRemoteParamsToUrl(url, query);
        } else {
            var formData = new FormData();
            if (this.zldParam) formData.append(this.zldParam, query);
            if (csrf && !formData.has('_token')) formData.append('_token', csrf);
            fetchConfig.body = formData;
        }

        return fetch(url, fetchConfig)
            .then(function (response) {
                if (requestId !== self.remoteRequestSeq) return null;
                return response.json().then(function (json) {
                    if (requestId !== self.remoteRequestSeq) return null;
                    if (json && Array.isArray(json.actions)) {
                        var actionsModule = window.OZI && window.OZI.modules && window.OZI.modules.actions;
                        if (actionsModule && typeof actionsModule.run === 'function') { actionsModule.run(json.actions); }
                        else if (typeof window.zldActions === 'function') { window.zldActions(json.actions); }
                    }
                    if (!response.ok) return null;
                    var options   = self.extractOptionsFromRemoteResponse(json);
                    var liveQuery = self.$search ? (self.$search.val() || '') : query;
                    self.applyRemoteOptions(options, liveQuery);
                    return options;
                });
            })
            .catch(function (err) { if (err && err.name === 'AbortError') return null; return null; })
            .finally(function () {
                if (requestId !== self.remoteRequestSeq) return;
                self.setRemoteLoading(false);
                self.remoteAbortController = null;
            });
    };

    /* ─── destroy / reload ─────────────────────────────────────────── */

    OziSelect.prototype.destroy = function () {
        this.abortRemoteRequest();
        $(document).off(this.ns);
        if (this.$form && this.$form.length) this.$form.off(this.ns);
        if (this.$ui)             { this.$ui.off(); this.$ui.remove(); }
        if (this.$feedback)       this.$feedback.remove();
        if (this.$hiddenContainer) this.$hiddenContainer.remove();
        this.$root
            .removeData('ozi-select-initialized')
            .removeClass('ozi-select-root')
            .empty();
        delete instances[this.key];
    };

    OziSelect.prototype.reload = function () {
        var root = this.$root[0];
        this.destroy();
        instances[this.key] = new OziSelect(root);
        return instances[this.key];
    };

    /* ─── API pública ──────────────────────────────────────────────── */

    var selectAPI = {

        init: function (scope) {
            var $targets;

            if (!scope) {
                $targets = $('[data-ozi-select]');
            } else {
                var $scope = $(scope);
                $targets = $scope.filter('[data-ozi-select]').add($scope.find('[data-ozi-select]'));
            }

            $targets.each(function () {
                var $el = $(this);
                var key = String($el.attr('data-ozi-select') || '').trim();
                if (!key) return;

                var existing = instances[key];
                if (existing) {
                    var sameEl   = existing.$root && existing.$root[0] === this;
                    var oldInDom = existing.$root && document.contains(existing.$root[0]);
                    if (sameEl && $el.data('ozi-select-initialized')) return;
                    if (!sameEl && !oldInDom) { existing.destroy(); }
                    else if (!sameEl && oldInDom) { return; }
                }

                try {
                    instances[key] = new OziSelect(this);
                } catch (e) {
                    console.warn('[OZI:select] erro init "' + key + '":', e.message);
                }
            });

            return this;
        },

        observe: function () {
            _startObserver();
            return this;
        },

        get:     function (s) { if (!s) return null; if (typeof s === 'string' && !s.startsWith('#') && !s.startsWith('.')) return instances[s] || null; var $el = $(s).first(); if (!$el.length) return null; return instances[String($el.attr('data-ozi-select') || '').trim()] || null; },
        getAll:  function () { return Object.values(instances); },
        destroy: function (s) { var i = this.get(s); if (i) i.destroy(); },
        reload:  function (s) { var i = this.get(s); return i ? i.reload() : null; },
        value:   function (s, v) { var i = this.get(s); if (!i) return null; if (v === undefined) return i.getValue(); i.setValue(v); return i.getValue(); },
        items:   function (s) { var i = this.get(s); return i ? i.getSelectedItems() : []; },
        clear:   function (s) { var i = this.get(s); if (i) i.clearSelection(); },
        open:    function (s) { var i = this.get(s); if (i) i.open(false); },
        close:   function (s) { var i = this.get(s); if (i) i.close(); },
        disable: function (s) { var i = this.get(s); if (i) i.setDisabled(true); },
        enable:  function (s) { var i = this.get(s); if (i) i.setDisabled(false); },
        required: function (s, state) { var i = this.get(s); if (!i) return; if (state === undefined) return i.isRequired(); i.setRequired(!!state); },
        setOptions: function (s, options) {
            var i = this.get(s); if (!i) return;
            i.options = i.normalizeOptions(options);
            i.initialOptions = i.cloneOptions(i.options);
            i.writeOptionsScript(i.options);
            i.reconcileSelectedItems();
            i.updateUI(); i.renderOptions('');
        }
    };

    /* ─── MutationObserver (fallback quando OZI.hooks ausente) ─────── */

    function _startObserver() {
        if (window.__oziSelectObserverInited) return;
        window.__oziSelectObserverInited = true;
        if (typeof MutationObserver === 'undefined') return;
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
                    if (!node || node.nodeType !== 1) return;
                    var $node = $(node);
                    if ($node.is('[data-ozi-select]'))           { selectAPI.init($node); return; }
                    if ($node.find('[data-ozi-select]').length)   { selectAPI.init($node); }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /* ─── adapter de validação ─────────────────────────────────────── */

    function _registerAdapter() {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate || typeof validate.registerAdapter !== 'function') return;
        validate.registerAdapter({
            name:     'ozi-select',
            match:    function ($el) { return $el.is('[data-ozi-select]'); },
            isValid:  function ($el) { var inst = selectAPI.get($el[0]); return inst ? inst.validate(false) : true; },
            getValue: function ($el) { var inst = selectAPI.get($el[0]); return inst ? inst.getValue() : null; },
            setState: function ($el, state) { var inst = selectAPI.get($el[0]); if (!inst) return; if (state === 'invalid') inst.markInvalid(false); else inst.clearInvalid(); }
        });
    }

    /* ─── boot seguro ──────────────────────────────────────────────── */

    function _boot() {
        selectAPI.init();
        _registerAdapter();

        var OZI = window.OZI;

        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.select = selectAPI;
        }

        // Registra no OZI.hooks.afterRender quando disponível
        if (OZI && OZI.hooks && OZI.hooks.afterRender && typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:select', function (root) {
                selectAPI.init(root);
            });
            // [FIX-B] MutationObserver só como fallback quando OZI.hooks ausente
        } else {
            _startObserver();
        }
    }

    window.OziSelect = selectAPI;

    $(function () { _boot(); });

})(jQuery);