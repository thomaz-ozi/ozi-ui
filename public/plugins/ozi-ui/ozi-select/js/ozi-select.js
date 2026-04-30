/**
 * ------------------------------------------
 * # oziSelect
 * ------------------------------------------
 * Ver: (4.3.2)
 * 2026-04-29
 * ------------------------------------------
 * [4.3.2] data-ozi-select-as — alias de campos JSON
 *         Normaliza chaves externas para campos canônicos
 *         na entrada (loadOptions + applyRemoteOptions).
 *         Hidden inputs gerados sempre seguem o canônico.
 * ------------------------------------------
 */

(function ($) {
    'use strict';

    var instances = {};
    var instanceCounter = 0;

    function OziSelect(element) {
        this.$root = $(element);
        this.key = String(this.$root.attr('data-ozi-select') || '').trim();
        if (!this.key) {
            throw new Error('OziSelect: data-ozi-select é obrigatório.');
        }

        this.uid = 'ozi-select-' + (++instanceCounter);
        this.ns = '.oziSelect.' + this.uid;

        this.isMultiple = this.parseBooleanAttr('data-ozi-select-multiple');
        this.isMultipleGroup = this.parseBooleanAttr('data-ozi-select-multiple-group');

        if (this.isMultipleGroup) {
            this.mode = 'multiple';
            this.groupToggleEnabled = true;
        } else if (this.isMultiple) {
            this.mode = 'multiple';
            this.groupToggleEnabled = false;
        } else {
            this.mode = 'single';
            this.groupToggleEnabled = false;
        }

        this.submitName = String(this.$root.data('ozi-select-submit-name') || this.key).trim();

        this.valuePlaceholder = String(this.$root.data('ozi-select-value-placeholder') || 'Selecione...');
        this.searchPlaceholder = String(this.$root.data('ozi-select-search-placeholder') || 'Pesquisar...');
        this.listHeight = String(this.$root.data('ozi-select-list') || '').trim();
        this.imageDimension = String(this.$root.data('ozi-select-image-dimension') || '').trim();
        this.valueIcon = String(this.$root.data('ozi-select-value-icon') || '').trim();
        this.searchIcon = String(this.$root.data('ozi-select-search-icon') || '').trim();

        this.hasSubmitFieldsConfig = this.$root.is('[data-ozi-select-submit-fields]');
        this.submitFieldsRaw = String(this.$root.attr('data-ozi-select-submit-fields') || '');

        this.isDisabledConfig = this.parseBooleanAttr('data-ozi-select-disabled');
        this.isRequiredConfig = this.parseBooleanAttr('data-ozi-select-required');

        this.requiredMessage = String(
            this.$root.attr('data-ozi-select-required-message') || 'Selecione uma opção.'
        );

        this.zldUrl = String(this.$root.data('ozi-select-zld-url') || '').trim();
        this.zldMethod = String(this.$root.data('ozi-select-zld-method') || 'POST').trim().toUpperCase();
        this.zldParam = String(this.$root.data('ozi-select-zld-param') || 'search').trim();
        this.zldItemName = String(this.$root.data('ozi-select-zld-item-name') || '').trim();
        this.zldMin = this.parseIntegerAttr('data-ozi-select-zld-min', 1);
        this.zldDelay = this.parseIntegerAttr('data-ozi-select-zld-delay', 300);
        this.zldLog = this.parseBooleanAttr('data-ozi-select-zld-log');

        this.imageWidth = '24px';
        this.imageHeight = '24px';

        this.options = [];
        this.initialOptions = [];
        this.selectedItems = [];
        this.submitFields = [];
        this.isOpen = false;
        this.lastSearchQuery = '';

        this.remoteRequestTimer = null;
        this.remoteAbortController = null;
        this.remoteRequestSeq = 0;

        this.$form = null;
        this.$ui = null;
        this.$control = null;
        this.$value = null;
        this.$clear = null;
        this.$toggle = null;
        this.$dropdown = null;
        this.$search = null;
        this.$list = null;
        this.$hiddenContainer = null;
        this.$feedback = null;

        this.init();
    }

    // ------------------------------------------
    // Helpers de atributo
    // ------------------------------------------

    OziSelect.prototype.parseBooleanAttr = function (attrName) {
        if (!this.$root.is('[' + attrName + ']')) return false;
        var raw = this.$root.attr(attrName);
        if (raw === undefined || raw === '') return true;
        raw = String(raw).trim().toLowerCase();
        if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
        return true;
    };

    OziSelect.prototype.parseIntegerAttr = function (attrName, fallbackValue) {
        if (!this.$root.is('[' + attrName + ']')) return fallbackValue;
        var raw = this.$root.attr(attrName);
        var parsed = parseInt(String(raw || '').trim(), 10);
        return isNaN(parsed) ? fallbackValue : parsed;
    };

    // ------------------------------------------
    // [4.3.2] Alias — data-ozi-select-as
    // ------------------------------------------

    /**
     * Lê data-ozi-select-as e devolve mapa canônico → alias.
     *
     * Formato do atributo:
     *   "value=uf, label=estado, image=bandeira, group=regiao"
     *
     * Resultado:
     *   { value: 'uf', label: 'estado', image: 'bandeira', group: 'regiao' }
     */
    OziSelect.prototype.parseAliasMap = function () {
        var raw = String(this.$root.attr('data-ozi-select-as') || '').trim();
        var map = {};

        if (!raw) return map;

        raw.split(',').forEach(function (chunk) {
            var parts = chunk.split('=');
            var canonical = String(parts[0] || '').trim();
            var alias     = String(parts[1] || '').trim();
            if (canonical && alias && canonical !== alias) {
                map[canonical] = alias;
            }
        });

        return map;
    };

    /**
     * Normaliza um array de opções aplicando o aliasMap.
     *
     * Para cada item:
     *  1. Copia todas as chaves originais.
     *  2. Para cada entrada canônico → alias:
     *     - lê item[alias]
     *     - escreve em item[canonical]
     *     - remove item[alias] (não vaza para hidden inputs)
     *
     * Campos canônicos suportados via alias:
     *   value, label, subLabel, image, group,
     *   optionHtml, optionClass, selected
     */
    OziSelect.prototype.normalizeOptions = function (options) {
        var map = this.aliasMap;
        if (!map || !Object.keys(map).length) return options;

        return (Array.isArray(options) ? options : []).map(function (item) {
            if (!item || typeof item !== 'object') return item;

            var normalized = {};

            Object.keys(item).forEach(function (key) {
                normalized[key] = item[key];
            });

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

    // ------------------------------------------
    // Estado
    // ------------------------------------------

    OziSelect.prototype.isDisabled = function () {
        return !!this.isDisabledConfig;
    };

    OziSelect.prototype.isRequired = function () {
        return !this.isDisabled() && !!this.isRequiredConfig;
    };

    OziSelect.prototype.isSelectionValid = function () {
        return this.selectedItems.length > 0;
    };

    OziSelect.prototype.isRemoteSearchEnabled = function () {
        return !!this.zldUrl;
    };

    // ------------------------------------------
    // Init
    // ------------------------------------------

    OziSelect.prototype.init = function () {
        if (this.$root.data('ozi-select-initialized')) return;
        this.$root.data('ozi-select-initialized', true);

        this.parseImageDimension();

        this.submitMode = this.normalizeSubmitMode(
            this.$root.attr('data-ozi-select-submit-mode') ||
            (this.hasSubmitFieldsConfig ? 'legacy' : 'value-label')
        );

        this.submitExtraFields = this.parseSubmitExtraFields(
            this.$root.attr('data-ozi-select-submit-extra') || ''
        );

        this.submitFields = this.hasSubmitFieldsConfig
            ? this.parseSubmitFields(this.submitFieldsRaw)
            : [];

        // [4.3.2] aliasMap antes de loadOptions
        this.aliasMap       = this.parseAliasMap();
        this.options        = this.normalizeOptions(this.loadOptions());
        this.initialOptions = this.cloneOptions(this.options);

        this.$hiddenContainer = this.resolveHiddenContainer();
        this.$form = this.$root.closest('form');

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
        var dims = this.imageDimension.split(',');
        this.imageWidth  = (dims[0] || '').trim() || '24px';
        this.imageHeight = (dims[1] || dims[0] || '').trim() || '24px';
    };

    OziSelect.prototype.parseSubmitFields = function (raw) {
        var fields = [];
        String(raw || '').split(',').forEach(function (chunk) {
            var item  = String(chunk || '').trim();
            if (!item) return;
            var parts  = item.split(':');
            var source = String(parts[0] || '').trim();
            var target = String(parts[1] || parts[0] || '').trim();
            if (!source || !target) return;
            fields.push({ source: source, target: target });
        });
        return fields;
    };

    // ------------------------------------------
    // Opções — carga e persistência
    // ------------------------------------------

    OziSelect.prototype.loadOptions = function () {
        var selector = 'script[data-ozi-select-options="' + this.key + '"]';
        var $script = this.$root.nextAll(selector).first();
        if (!$script.length) $script = this.$root.parent().find(selector).first();
        if (!$script.length) $script = $(selector).first();

        if (!$script.length) {
            if (this.zldLog) console.warn('OziSelect: JSON não encontrado para "' + this.key + '".');
            return [];
        }

        try {
            var parsed = JSON.parse($script.text().trim() || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('OziSelect: erro ao parsear JSON de "' + this.key + '".', error);
            return [];
        }
    };

    OziSelect.prototype.ensureOptionsScript = function () {
        var selector = 'script[data-ozi-select-options="' + this.key + '"]';
        var $script = $(selector).first();
        if (!$script.length) {
            $script = $('<script>', {
                type: 'application/json',
                'data-ozi-select-options': this.key
            });
            this.$root.after($script);
        }
        return $script;
    };

    OziSelect.prototype.writeOptionsScript = function (options) {
        var $script = this.ensureOptionsScript();
        $script.text(JSON.stringify(Array.isArray(options) ? options : [], null, 2));
    };

    OziSelect.prototype.resolveHiddenContainer = function () {
        var $container = $('<div>', {
            id: this.uid + '-hidden',
            class: 'ozi-select-hidden-container',
            'data-ozi-select-generated-hidden': this.key,
            'aria-hidden': 'true'
        });
        this.$root.after($container);
        return $container;
    };

    // ------------------------------------------
    // Build UI
    // ------------------------------------------

    OziSelect.prototype.buildUI = function () {
        var listId = this.uid + '-list';

        this.$root.empty().addClass('ozi-select-root');

        this.$ui = $('<div>', { class: 'ozi-select-ui ozi-select-ui-v400' });

        this.$control = $('<div>', {
            class: 'ozi-select-control',
            tabindex: this.isDisabled() ? -1 : 0,
            role: 'combobox',
            'aria-haspopup': 'listbox',
            'aria-expanded': 'false',
            'aria-controls': listId,
            'aria-invalid': 'false'
        });

        this.$value = $('<div>', { class: 'ozi-select-value' });

        var $actions = $('<div>', { class: 'ozi-select-actions' });

        this.$clear = $('<button>', {
            type: 'button',
            class: 'ozi-select-clear',
            'aria-label': 'Limpar seleção'
        }).html('&times;');

        this.$toggle = $('<button>', {
            type: 'button',
            class: 'ozi-select-toggle',
            'aria-label': 'Abrir opções'
        }).html('&#9662;');

        $actions.append(this.$clear, this.$toggle);

        if (this.valueIcon) {
            var $valueIcon = $('<span>', {
                class: 'ozi-select-value-icon',
                'aria-hidden': 'true'
            }).append($('<i>', { class: this.valueIcon }));
            this.$control.append($valueIcon, this.$value, $actions);
        } else {
            this.$control.append(this.$value, $actions);
        }

        this.$dropdown = $('<div>', { class: 'ozi-select-dropdown' });

        var $searchWrap = $('<div>', { class: 'ozi-select-search-wrap' });

        this.$search = $('<input>', {
            type: 'text',
            class: 'ozi-select-search',
            name: this.key + '_select_search',
            placeholder: this.searchPlaceholder,
            autocomplete: 'off'
        });

        if (this.searchIcon) {
            var $searchIcon = $('<span>', {
                class: 'ozi-select-search-icon',
                'aria-hidden': 'true'
            }).append($('<i>', { class: this.searchIcon }));
            $searchWrap.append($searchIcon, this.$search);
        } else {
            $searchWrap.append(this.$search);
        }

        this.$list = $('<div>', {
            class: 'ozi-select-list',
            id: listId,
            role: 'listbox'
        });

        if (this.listHeight) {
            this.$list.css('max-height', this.listHeight);
        }

        this.$feedback = $('<div>', {
            class: 'invalid-feedback ozi-select-feedback'
        }).text(this.requiredMessage);

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

        if (disabled) {
            this.clearInvalid();
            this.close();
        }
    };

    // ------------------------------------------
    // Eventos
    // ------------------------------------------

    OziSelect.prototype.bindEvents = function () {
        var self = this;

        this.$ui.on('click', '.ozi-select-control', function (e) {
            if (self.isDisabled()) return;
            if ($(e.target).closest('.ozi-select-clear, .ozi-select-toggle, .ozi-select-tag-remove').length) return;
            self.toggle();
        });

        this.$ui.on('click', '.ozi-select-group-label[data-ozi-group-toggle]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (self.isDisabled()) return;
            if (self.mode !== 'multiple') return;
            var groupName = $(this).attr('data-ozi-group-toggle');
            self.toggleGroup(groupName, true);
        });

        this.$ui.on('click', '.ozi-select-toggle', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (self.isDisabled()) return;
            self.toggle();
        });

        this.$ui.on('click', '.ozi-select-clear', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (self.isDisabled()) return;
            self.clearSelection();
        });

        this.$ui.on('input', '.ozi-select-search', function () {
            if (self.isDisabled()) return;
            var query = $(this).val() || '';
            self.handleSearchInput(query);
        });

        this.$ui.on('click', '.ozi-select-option', function (e) {
            e.preventDefault();
            if (self.isDisabled()) return;
            var value = $(this).attr('data-value');
            var item  = self.findOptionByValue(value);
            if (!item) return;
            self.toggleItem(item);
        });

        this.$ui.on('click', '.ozi-select-tag-remove', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (self.isDisabled()) return;
            self.unselectItem($(this).attr('data-value'));
        });

        this.$ui.on('keydown', '.ozi-select-control, .ozi-select-search', function (e) {
            if (self.isDisabled()) return;
            self.handleKeydown(e);
        });

        $(document).on('click' + this.ns, function (e) {
            if (!self.$ui.is(e.target) && self.$ui.has(e.target).length === 0) {
                self.close();
            }
        });
    };

    OziSelect.prototype.bindFormEvents = function () {
        var self = this;
        if (!this.$form.length) return;

        this.$form.on('submit' + this.ns, function (e) {
            if (!self.validate()) {
                e.preventDefault();
                self.$form.addClass('was-validated');
            }
        });

        this.$form.on('reset' + this.ns, function () {
            setTimeout(function () { self.resetToInitial(); }, 0);
        });
    };

    OziSelect.prototype.handleKeydown = function (e) {
        if (!this.isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.open(false);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.open(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.highlightNext();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.highlightPrev();
                break;
            case 'Enter':
                e.preventDefault();
                var $highlighted = this.getHighlightedOption();
                if ($highlighted.length) {
                    var value = $highlighted.attr('data-value');
                    var item  = this.findOptionByValue(value);
                    if (item) this.toggleItem(item);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.close(true);
                break;
            case 'Tab':
                this.close();
                break;
            case 'Home':
                e.preventDefault();
                this.highlightFirstVisible();
                break;
            case 'End':
                e.preventDefault();
                this.highlightLastVisible();
                break;
        }
    };

    // ------------------------------------------
    // Abrir / Fechar / Toggle
    // ------------------------------------------

    OziSelect.prototype.open = function (preferLast) {
        if (this.isDisabled() || this.isOpen) return;
        this.isOpen = true;
        this.$ui.addClass('is-open');
        this.$control.attr('aria-expanded', 'true');
        var query = this.$search.val() || '';
        this.renderOptions(query);
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
        if (this.isOpen) this.close(); else this.open(false);
    };

    // ------------------------------------------
    // Seleção
    // ------------------------------------------

    OziSelect.prototype.findOptionInList = function (list, value) {
        var found = null;
        (Array.isArray(list) ? list : []).some(function (item) {
            if (String(item.value) === String(value)) { found = item; return true; }
            return false;
        });
        return found;
    };

    OziSelect.prototype.findOptionByValue = function (value) {
        return this.findOptionInList(this.options, value);
    };

    OziSelect.prototype.isSelected = function (value) {
        return this.selectedItems.some(function (item) {
            return String(item.value) === String(value);
        });
    };

    OziSelect.prototype.toggleItem = function (item) {
        var exists = this.isSelected(item.value);

        if (this.mode === 'single') {
            this.selectedItems = [item];
            this.syncHiddenInputs();
            this.updateUI();
            this.close(true);
            this.clearInvalid();
            this.emitChange();
            return;
        }

        if (exists) { this.unselectItem(item.value); return; }

        this.selectedItems.push(item);
        this.syncHiddenInputs();
        this.updateUI();
        this.renderOptions(this.$search.val() || '');
        this.syncHighlightAfterRender(false);
        this.clearInvalid();
        this.emitChange();
    };

    OziSelect.prototype.unselectItem = function (value) {
        var before = this.selectedItems.length;
        this.selectedItems = this.selectedItems.filter(function (item) {
            return String(item.value) !== String(value);
        });
        if (this.selectedItems.length !== before) {
            this.syncHiddenInputs();
            this.updateUI();
            this.renderOptions(this.$search.val() || '');
            this.syncHighlightAfterRender(false);
            if (this.$control.hasClass('is-invalid') || (this.$form.length && this.$form.hasClass('was-validated'))) {
                this.validate(false);
            }
            this.emitChange();
        }
    };

    OziSelect.prototype.clearSelection = function () {
        if (this.isDisabled() || !this.selectedItems.length) return;
        this.selectedItems = [];
        this.syncHiddenInputs();
        this.updateUI();
        this.renderOptions(this.$search.val() || '');
        if (this.$control.hasClass('is-invalid') || (this.$form.length && this.$form.hasClass('was-validated'))) {
            this.validate(false);
        } else {
            this.clearInvalid();
        }
        this.emitChange();
    };

    OziSelect.prototype.loadInitialSelection = function () {
        var defaults = this.options.filter(function (item) {
            return item && item.selected === true;
        });
        this.selectedItems = this.mode === 'single'
            ? (defaults[0] ? [defaults[0]] : [])
            : defaults;
    };

    OziSelect.prototype.applySelectedDefaultsFromOptions = function () {
        if (this.selectedItems.length > 0) return;
        var defaults = this.options.filter(function (item) {
            return item && item.selected === true;
        });
        if (!defaults.length) return;
        this.selectedItems = this.mode === 'single' ? [defaults[0]] : defaults.slice();
    };

    OziSelect.prototype.resetToInitial = function () {
        this.abortRemoteRequest();
        this.lastSearchQuery = '';
        this.options = this.cloneOptions(this.initialOptions);
        this.writeOptionsScript(this.options);
        this.loadInitialSelection();
        this.syncHiddenInputs();
        this.updateUI();
        this.renderOptions('');
        this.clearInvalid();
    };

    // ------------------------------------------
    // Hidden inputs
    // ------------------------------------------

    OziSelect.prototype.buildInputName = function (base, index, path) {
        var name = String(base) + '[' + index + ']';
        String(path || '').split('.').forEach(function (part) {
            part = String(part || '').trim();
            if (part) name += '[' + part + ']';
        });
        return name;
    };

    OziSelect.prototype.buildInputNameFromParts = function (base, index, parts) {
        var name = String(base) + '[' + index + ']';
        (parts || []).forEach(function (part) { name += '[' + String(part) + ']'; });
        return name;
    };

    OziSelect.prototype.appendHiddenInput = function (name, value) {
        var $input = $('<input>', {
            type: 'hidden',
            name: name,
            value: value == null ? '' : String(value)
        });
        $input.prop('disabled', this.isDisabled());
        this.$hiddenContainer.append($input);
    };

    OziSelect.prototype.shouldSkipAutoSubmitKey = function (key) {
        key = String(key || '');
        if (!key) return true;
        if (key.charAt(0) === '_') return true;
        return ['selected', 'optionHtml', 'optionClass'].indexOf(key) !== -1;
    };

    OziSelect.prototype.appendAutoSubmitInputs = function (index, value, pathParts) {
        var self = this;
        pathParts = pathParts || [];
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
            value.forEach(function (item, arrayIndex) {
                self.appendAutoSubmitInputs(index, item, pathParts.concat([arrayIndex]));
            });
            return;
        }
        if (typeof value === 'object') {
            Object.keys(value).forEach(function (key) {
                if (self.shouldSkipAutoSubmitKey(key)) return;
                self.appendAutoSubmitInputs(index, value[key], pathParts.concat([key]));
            });
            return;
        }
        var inputName = this.buildInputNameFromParts(this.submitName, index, pathParts);
        this.appendHiddenInput(inputName, value);
    };

    OziSelect.prototype.normalizeSubmitMode = function (raw) {
        var mode = String(raw || '').trim().toLowerCase();
        if (!mode) return 'value-label';
        if (['legacy', 'value', 'value-label'].indexOf(mode) === -1) return 'value-label';
        return mode;
    };

    OziSelect.prototype.parseSubmitExtraFields = function (raw) {
        return this.parseListString(raw)
            .map(function (item) { return String(item || '').trim().toLowerCase(); })
            .filter(Boolean)
            .filter(function (item, index, arr) { return arr.indexOf(item) === index; })
            .filter(function (item) { return item !== 'value'; });
    };

    OziSelect.prototype.resolveStructuredSubmitValue = function (item, key) {
        var source = String(key || '').trim();
        if (!source) return undefined;
        if (source === 'oziGroup') source = 'group';
        return this.getValueByPath(item, source);
    };

    OziSelect.prototype.buildStructuredInputName = function (suffix) {
        var name = String(this.submitName || '').trim();
        if (suffix) name += '_' + String(suffix).trim();
        if (this.mode === 'multiple') name += '[]';
        return name;
    };

    OziSelect.prototype.appendStructuredHiddenField = function (suffix, value) {
        if (value === undefined || value === null) return;
        this.appendHiddenInput(this.buildStructuredInputName(suffix), value);
    };

    OziSelect.prototype.appendStructuredHiddenInputs = function (item) {
        if (!item || typeof item !== 'object') return;
        var self = this;

        Object.keys(item).forEach(function (key) {
            if (self.shouldSkipAutoSubmitKey(key)) return;
            var value = item[key];
            if (value !== null && typeof value === 'object') return;

            var inputName = key === 'value'
                ? self.submitName
                : self.submitName + '_' + key;

            if (self.mode === 'multiple') inputName += '[]';

            self.appendHiddenInput(inputName, value == null ? '' : String(value));
        });
    };

    OziSelect.prototype.syncHiddenInputs = function () {
        var self = this;
        this.$hiddenContainer.empty();

        this.selectedItems.forEach(function (item, index) {
            if (
                self.submitMode === 'legacy' &&
                self.hasSubmitFieldsConfig &&
                self.submitFields.length
            ) {
                self.submitFields.forEach(function (field) {
                    var value = self.getValueByPath(item, field.source);
                    if (value === undefined || value === null) return;
                    self.appendHiddenInput(
                        self.buildInputName(self.submitName, index, field.target),
                        value
                    );
                });
                return;
            }

            self.appendStructuredHiddenInputs(item);
        });
    };

    OziSelect.prototype.getValueByPath = function (obj, path) {
        var current = obj;
        var parts   = String(path || '').split('.');
        for (var i = 0; i < parts.length; i++) {
            var key = parts[i];
            if (current == null || typeof current !== 'object' || !(key in current)) return undefined;
            current = current[key];
        }
        return current;
    };

    // ------------------------------------------
    // Render
    // ------------------------------------------

    OziSelect.prototype.stripHtml = function (value) {
        return String(value || '').replace(/<[^>]*>/g, ' ');
    };

    OziSelect.prototype.renderOptionalHtml = function ($target, html) {
        if (!html) return false;
        $target.html(String(html));
        return true;
    };

    OziSelect.prototype.flattenSearchText = function (obj) {
        var parts = [];
        var self  = this;

        function walk(value, keyName) {
            if (value == null) return;
            if (Array.isArray(value)) { value.forEach(function (item) { walk(item, keyName); }); return; }
            if (typeof value === 'object') {
                Object.keys(value).forEach(function (key) {
                    if (key === 'selected') return;
                    walk(value[key], key);
                });
                return;
            }
            if (typeof value === 'string' || typeof value === 'number') {
                var text = String(value);
                if (keyName === 'optionHtml') text = self.stripHtml(text);
                parts.push(text);
            }
        }

        walk(obj, '');
        return parts.join(' ');
    };

    OziSelect.prototype.normalize = function (value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };

    OziSelect.prototype.cloneOptions = function (options) {
        try {
            return JSON.parse(JSON.stringify(Array.isArray(options) ? options : []));
        } catch (e) {
            return Array.isArray(options) ? options.slice() : [];
        }
    };

    OziSelect.prototype.buildRenderBlocks = function (items) {
        var blocks   = [];
        var groupMap = Object.create(null);

        items.forEach(function (item) {
            var groupName = item && item.group != null ? String(item.group).trim() : '';
            if (!groupName) { blocks.push({ type: 'option', item: item }); return; }
            if (!groupMap[groupName]) {
                groupMap[groupName] = { type: 'group', group: groupName, options: [] };
                blocks.push(groupMap[groupName]);
            }
            groupMap[groupName].options.push(item);
        });

        return blocks;
    };

    OziSelect.prototype.renderGroupBlock = function (block) {
        var groupSelected = this.groupToggleEnabled && this.mode === 'multiple'
            ? this.isGroupFullySelected(block.group, true) : false;
        var groupPartial = this.groupToggleEnabled && this.mode === 'multiple'
            ? this.isGroupPartiallySelected(block.group, true) : false;

        var $group = $('<div>', { class: 'ozi-select-group', 'data-ozi-group': block.group });
        var $label = $('<div>', {
            class: 'ozi-select-group-label' +
                (groupSelected ? ' is-group-selected' : '') +
                (groupPartial  ? ' is-group-partial'  : ''),
            role: 'presentation'
        }).text(block.group);

        if (this.groupToggleEnabled && this.mode === 'multiple' && !this.isDisabled()) {
            $label.attr('data-ozi-group-toggle', block.group);
        }

        $group.append($label);
        var self = this;
        block.options.forEach(function (item) { $group.append(self.buildOption(item)); });
        return $group;
    };

    OziSelect.prototype.getGroupVisibleOptions = function (groupName) {
        return this.$list.find(
            '.ozi-select-group[data-ozi-group="' + String(groupName).replace(/"/g, '\\"') + '"] .ozi-select-option:visible'
        );
    };

    OziSelect.prototype.getItemsByGroup = function (groupName, onlyVisible) {
        var group  = String(groupName || '');
        var values = null;

        if (onlyVisible) {
            values = this.getGroupVisibleOptions(group).map(function () {
                return String($(this).attr('data-value'));
            }).get();
        }

        return this.options.filter(function (item) {
            var sameGroup = String(item.group || '') === group;
            if (!sameGroup) return false;
            if (!onlyVisible) return true;
            return values.indexOf(String(item.value)) !== -1;
        });
    };

    OziSelect.prototype.isGroupFullySelected = function (groupName, onlyVisible) {
        var items = this.getItemsByGroup(groupName, onlyVisible);
        if (!items.length) return false;
        var self = this;
        return items.every(function (item) { return self.isSelected(item.value); });
    };

    OziSelect.prototype.isGroupPartiallySelected = function (groupName, onlyVisible) {
        var items = this.getItemsByGroup(groupName, onlyVisible);
        if (!items.length) return false;
        var self  = this;
        var count = items.filter(function (item) { return self.isSelected(item.value); }).length;
        return count > 0 && count < items.length;
    };

    OziSelect.prototype.toggleGroup = function (groupName, onlyVisible) {
        if (this.isDisabled() || this.mode !== 'multiple' || !this.groupToggleEnabled) return;
        var items = this.getItemsByGroup(groupName, onlyVisible);
        if (!items.length) return;

        var shouldSelectAll = !this.isGroupFullySelected(groupName, onlyVisible);
        var self = this;

        if (shouldSelectAll) {
            items.forEach(function (item) {
                if (!self.isSelected(item.value)) self.selectedItems.push(item);
            });
        } else {
            var toRemove = items.map(function (item) { return String(item.value); });
            this.selectedItems = this.selectedItems.filter(function (s) {
                return toRemove.indexOf(String(s.value)) === -1;
            });
        }

        this.syncHiddenInputs();
        this.updateUI();
        this.renderOptions(this.$search.val() || '');
        this.syncHighlightAfterRender(false);
        this.validate(false);
        this.emitChange();
    };

    OziSelect.prototype.renderOptions = function (query) {
        var self = this;
        var normalizedQuery = this.normalize(query || '');

        this.$list.empty();

        var filtered = this.options.filter(function (item) {
            if (!normalizedQuery) return true;
            return self.normalize(self.flattenSearchText(item)).indexOf(normalizedQuery) !== -1;
        });

        if (!filtered.length) {
            this.$list.append(
                $('<div>', { class: 'ozi-select-empty' })
                    .text(this.$ui.hasClass('is-loading') ? 'Carregando...' : 'Nenhum resultado encontrado')
            );
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

        var $option = $('<div>', {
            class: 'ozi-select-option' + (selected ? ' is-selected' : ''),
            'data-value': item.value,
            role: 'option',
            'aria-selected': selected ? 'true' : 'false'
        });

        if (item.optionClass && String(item.optionClass).trim() !== '') {
            $option.addClass(String(item.optionClass).trim());
        }

        if (item.optionHtml && String(item.optionHtml).trim() !== '') {
            var $custom = $('<div>', { class: 'ozi-select-option-custom' });
            this.renderOptionalHtml($custom, item.optionHtml);
            $option.append($custom);
            return $option;
        }

        var $content = $('<div>', { class: 'ozi-select-option-content' });

        if (item.image) {
            $content.append($('<img>', {
                class: 'ozi-select-option-image',
                src: item.image,
                alt: item.label || '',
                css: { width: this.imageWidth, height: this.imageHeight }
            }));
        } else {
            $content.append($('<div>', {
                class: 'ozi-select-option-image is-no-image',
                css: { width: this.imageWidth, height: this.imageHeight }
            }));
        }

        var $texts = $('<div>', { class: 'ozi-select-option-texts' });
        var $label = $('<div>', { class: 'ozi-select-option-label' });

        if (item.label && String(item.label).trim() !== '') {
            $label.html(String(item.label));
        } else {
            $label.text(String(item.value || ''));
        }

        $texts.append($label);

        if (item.subLabel && String(item.subLabel).trim() !== '') {
            $texts.append(
                $('<div>', { class: 'ozi-select-option-sublabel' }).html(String(item.subLabel))
            );
        }

        $content.append($texts);
        $option.append($content);
        return $option;
    };

    // ------------------------------------------
    // Update UI (valor selecionado)
    // ------------------------------------------

    OziSelect.prototype.updateUI = function () {
        this.$value.empty();

        if (!this.selectedItems.length) {
            this.$value
                .addClass('is-placeholder')
                .append(
                    $('<div>', { class: 'ozi-select-value-content' })
                        .append($('<div>', { class: 'ozi-select-value-image is-no-image' }))
                        .append($('<span>', { class: 'ozi-select-value-label' }).text(this.valuePlaceholder))
                );
            this.$clear.hide();
            return;
        }

        this.$value.removeClass('is-placeholder');

        if (this.mode === 'single') {
            this.$value.append(this.buildSelectedPreview(this.selectedItems[0]));
        } else {
            var $tags = $('<div>', { class: 'ozi-select-tags' });
            var self  = this;

            this.selectedItems.forEach(function (item) {
                var $tag = $('<span>', { class: 'ozi-select-tag' });

                if (item.image) {
                    $tag.append($('<img>', {
                        class: 'ozi-select-tag-image',
                        src: item.image,
                        alt: item.label || '',
                        css: { width: self.imageWidth, height: self.imageHeight }
                    }));
                }

                var $tagLabel = $('<span>', { class: 'ozi-select-tag-label' });
                if (item.label && String(item.label).trim() !== '') {
                    $tagLabel.html(String(item.label));
                } else {
                    $tagLabel.text(String(item.value || ''));
                }

                $tag.append($tagLabel);
                $tag.append($('<button>', {
                    type: 'button',
                    class: 'ozi-select-tag-remove',
                    'data-value': item.value,
                    'aria-label': 'Remover ' + (item.label || item.value || '')
                }).html('&times;'));

                $tags.append($tag);
            });

            this.$value.append($tags);
        }

        this.$clear.toggle(!this.isDisabled());
    };

    OziSelect.prototype.buildSelectedPreview = function (item) {
        var $content = $('<div>', { class: 'ozi-select-value-content' });

        if (item.image) {
            $content.append($('<img>', {
                class: 'ozi-select-value-image',
                src: item.image,
                alt: item.label || '',
                css: { width: this.imageWidth, height: this.imageHeight }
            }));
        } else {
            $content.append($('<div>', {
                class: 'ozi-select-value-image is-no-image',
                css: { width: this.imageWidth, height: this.imageHeight }
            }));
        }

        var $texts = $('<div>', { class: 'ozi-select-value-texts' });
        var $label = $('<div>', { class: 'ozi-select-value-label' });

        if (item.label && String(item.label).trim() !== '') {
            $label.html(String(item.label));
        } else {
            $label.text(String(item.value || ''));
        }

        $texts.append($label);

        if (item.subLabel && String(item.subLabel).trim() !== '') {
            $texts.append(
                $('<div>', { class: 'ozi-select-value-sublabel' }).html(String(item.subLabel))
            );
        }

        $content.append($texts);
        return $content;
    };

    // ------------------------------------------
    // Highlight / teclado
    // ------------------------------------------

    OziSelect.prototype.getVisibleOptions = function () {
        return this.$list.find('.ozi-select-option:visible');
    };

    OziSelect.prototype.getHighlightedOption = function () {
        return this.$list.find('.ozi-select-option.is-highlighted').first();
    };

    OziSelect.prototype.getSelectedVisibleOption = function () {
        var self = this;
        if (!this.selectedItems.length) return $();
        return this.getVisibleOptions().filter(function () {
            var value = $(this).attr('data-value');
            return self.selectedItems.some(function (item) {
                return String(item.value) === String(value);
            });
        }).first();
    };

    OziSelect.prototype.highlightOption = function ($option) {
        this.$list.find('.ozi-select-option').removeClass('is-highlighted');
        if ($option && $option.length) {
            $option.addClass('is-highlighted');
            this.ensureOptionVisible($option);
        }
    };

    OziSelect.prototype.highlightFirstVisible = function () {
        this.highlightOption(this.getVisibleOptions().first());
    };

    OziSelect.prototype.highlightLastVisible = function () {
        this.highlightOption(this.getVisibleOptions().last());
    };

    OziSelect.prototype.highlightNext = function () {
        var $visible = this.getVisibleOptions();
        var $current = this.getHighlightedOption();
        var index    = $current.length ? $visible.index($current) : -1;
        var $next    = $visible.eq(index + 1);
        if ($next.length) { this.highlightOption($next); }
        else if (!$current.length && $visible.length) { this.highlightFirstVisible(); }
    };

    OziSelect.prototype.highlightPrev = function () {
        var $visible = this.getVisibleOptions();
        var $current = this.getHighlightedOption();
        var index    = $current.length ? $visible.index($current) : $visible.length;
        var $prev    = $visible.eq(index - 1);
        if ($prev.length) { this.highlightOption($prev); }
        else if (!$current.length && $visible.length) { this.highlightLastVisible(); }
    };

    OziSelect.prototype.ensureOptionVisible = function ($option) {
        if (!$option || !$option.length) return;
        var list         = this.$list;
        var optionTop    = $option.position().top + list.scrollTop();
        var optionBottom = optionTop + $option.outerHeight();
        var listTop      = list.scrollTop();
        var listBottom   = listTop + list.innerHeight();
        if (optionTop < listTop)          list.scrollTop(optionTop);
        else if (optionBottom > listBottom) list.scrollTop(optionBottom - list.innerHeight());
    };

    OziSelect.prototype.syncHighlightAfterRender = function (preferLast) {
        var $visible  = this.getVisibleOptions();
        var $selected = this.getSelectedVisibleOption();
        if (!$visible.length) { this.$list.find('.ozi-select-option').removeClass('is-highlighted'); return; }
        if ($selected.length)     { this.highlightOption($selected); }
        else if (preferLast)      { this.highlightLastVisible(); }
        else                      { this.highlightFirstVisible(); }
    };

    // ------------------------------------------
    // Validação
    // ------------------------------------------

    OziSelect.prototype.focusControl = function () {
        if (!this.isDisabled()) this.$control.trigger('focus');
    };

    OziSelect.prototype.markInvalid = function (focusControl) {
        this.$control.addClass('is-invalid').attr('aria-invalid', 'true');
        this.$feedback.text(this.requiredMessage).addClass('is-visible');
        if (focusControl !== false) this.focusControl();
    };

    OziSelect.prototype.clearInvalid = function () {
        this.$control.removeClass('is-invalid').attr('aria-invalid', 'false');
        this.$feedback.removeClass('is-visible');
    };

    OziSelect.prototype.validate = function (focusControl) {
        if (!this.isRequired()) { this.clearInvalid(); return true; }
        if (this.isSelectionValid()) { this.clearInvalid(); return true; }
        this.markInvalid(focusControl !== false);
        return false;
    };

    // ------------------------------------------
    // Eventos customizados
    // ------------------------------------------

    OziSelect.prototype.emit = function (eventName) {
        var detail = {
            key: this.key,
            value: this.getValue(),
            items: this.getSelectedItems(),
            instance: this
        };
        this.$root.trigger(eventName, [detail.items, this, detail]);
        if (this.$root && this.$root[0] && typeof CustomEvent === 'function') {
            this.$root[0].dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: detail }));
        }
    };

    OziSelect.prototype.emitChange = function () { this.emit('ozi:change'); };

    // ------------------------------------------
    // API de leitura / escrita
    // ------------------------------------------

    OziSelect.prototype.getSelectedItems = function () { return this.selectedItems.slice(); };

    OziSelect.prototype.getValue = function () {
        if (this.mode === 'single') return this.selectedItems[0] ? this.selectedItems[0].value : null;
        return this.selectedItems.map(function (item) { return item.value; });
    };

    OziSelect.prototype.setValue = function (value) {
        var self = this;
        if (this.mode === 'single') {
            var item = this.findOptionByValue(value);
            this.selectedItems = item ? [item] : [];
        } else {
            var values = Array.isArray(value) ? value : [value];
            this.selectedItems = values.map(function (v) { return self.findOptionByValue(v); }).filter(Boolean);
        }
        this.syncHiddenInputs();
        this.updateUI();
        this.renderOptions(this.$search ? (this.$search.val() || '') : '');
        this.validate(false);
        this.emitChange();
    };

    OziSelect.prototype.setDisabled = function (state) {
        this.isDisabledConfig = !!state;
        if (this.isDisabledConfig) { this.$root.attr('data-ozi-select-disabled', 'disabled'); }
        else { this.$root.removeAttr('data-ozi-select-disabled'); }
        this.applyStateStyles();
        this.syncHiddenInputs();
        this.updateUI();
        this.validate(false);
    };

    OziSelect.prototype.setRequired = function (state) {
        this.isRequiredConfig = !!state;
        if (this.isRequiredConfig) { this.$root.attr('data-ozi-select-required', 'required'); }
        else { this.$root.removeAttr('data-ozi-select-required'); }
        this.validate(false);
    };

    // ------------------------------------------
    // Helpers
    // ------------------------------------------

    OziSelect.prototype.escapeFieldSelector = function (name) {
        return String(name || '').replace(/([[\].:#])/g, '\\$1');
    };

    OziSelect.prototype.parseListString = function (raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        var s = String(raw).trim();
        if (!s) return [];
        if (s.charAt(0) === '[' && s.charAt(s.length - 1) === ']') {
            try {
                var parsed = JSON.parse(s.replace(/'/g, '"'));
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {}
        }
        return s.split(',').map(function (item) { return String(item || '').trim(); }).filter(Boolean);
    };

    // ------------------------------------------
    // Busca remota
    // ------------------------------------------

    OziSelect.prototype.parseRemoteExtraParams = function () {
        var self  = this;
        var items = this.parseListString(this.zldItemName);

        return items.map(function (entry) {
            var raw = String(entry || '').trim();
            if (!raw) return null;
            var idx = raw.indexOf(':');
            if (idx === -1) return { type: 'field', key: raw, value: null };
            return { type: 'fixed', key: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
        }).filter(function (item) { return item && item.key; });
    };

    OziSelect.prototype.collectNamedFieldValues = function (fieldName) {
        var result   = [];
        var selector = '[name="' + this.escapeFieldSelector(fieldName) + '"]';
        var $scope   = this.$form.length ? this.$form : $(document);
        var $fields  = $scope.find(selector);

        $fields.each(function () {
            var $field = $(this);
            var tag    = String(this.tagName || '').toLowerCase();
            var type   = String(($field.attr('type') || '')).toLowerCase();
            var name   = String($field.attr('name') || '').trim();

            if (!name || $field.prop('disabled')) return;

            if (tag === 'select') {
                if ($field.prop('multiple')) {
                    [].concat($field.val() || []).forEach(function (v) { result.push({ key: fieldName, value: v }); });
                } else {
                    result.push({ key: fieldName, value: $field.val() });
                }
                return;
            }

            if (type === 'checkbox') {
                if ($field.prop('checked')) result.push({ key: fieldName, value: $field.val() });
                return;
            }

            if (type === 'radio') {
                if ($field.prop('checked')) result.push({ key: fieldName, value: $field.val() });
                return;
            }

            result.push({ key: fieldName, value: $field.val() });
        });

        return result;
    };

    OziSelect.prototype.appendRemoteParamsToFormData = function (formData, query) {
        var self = this;
        if (this.zldParam) formData.append(this.zldParam, query);
        this.parseRemoteExtraParams().forEach(function (item) {
            if (item.type === 'fixed') { formData.append(item.key, item.value); return; }
            self.collectNamedFieldValues(item.key).forEach(function (pair) { formData.append(pair.key, pair.value); });
        });
        return formData;
    };

    OziSelect.prototype.appendRemoteParamsToUrl = function (url, query) {
        var self     = this;
        var finalUrl = String(url || '');
        var joiner   = finalUrl.indexOf('?') >= 0 ? '&' : '?';
        var params   = [];

        if (this.zldParam) params.push(encodeURIComponent(this.zldParam) + '=' + encodeURIComponent(query));

        this.parseRemoteExtraParams().forEach(function (item) {
            if (item.type === 'fixed') {
                params.push(encodeURIComponent(item.key) + '=' + encodeURIComponent(item.value));
                return;
            }
            self.collectNamedFieldValues(item.key).forEach(function (pair) {
                params.push(encodeURIComponent(pair.key) + '=' + encodeURIComponent(pair.value));
            });
        });

        if (params.length) finalUrl += joiner + params.join('&');
        return finalUrl;
    };

    OziSelect.prototype.abortRemoteRequest = function () {
        if (this.remoteRequestTimer) { clearTimeout(this.remoteRequestTimer); this.remoteRequestTimer = null; }
        if (this.remoteAbortController) { this.remoteAbortController.abort(); this.remoteAbortController = null; }
    };

    OziSelect.prototype.reconcileSelectedItems = function () {
        var self        = this;
        var oldSelected = this.selectedItems.slice();
        var nextSelected = [];

        oldSelected.forEach(function (oldItem) {
            var fromNewList = self.findOptionInList(self.options, oldItem.value);
            nextSelected.push(fromNewList ? fromNewList : oldItem);
        });

        var unique = [];
        var seen   = {};
        nextSelected.forEach(function (item) {
            var key = String(item.value);
            if (seen[key]) return;
            seen[key] = true;
            unique.push(item);
        });

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
        this.writeOptionsScript(this.options);
        this.reconcileSelectedItems();
        this.updateUI();
        this.renderOptions(this.lastSearchQuery || '');
        this.syncHighlightAfterRender(false);
    };

    // [4.3.2] normalizeOptions aplicado antes de salvar
    OziSelect.prototype.applyRemoteOptions = function (options, query) {
        this.options = this.cloneOptions(this.normalizeOptions(options));
        this.writeOptionsScript(this.options);
        this.reconcileSelectedItems();
        this.updateUI();
        this.renderOptions(query || '');
        this.syncHighlightAfterRender(false);
    };

    OziSelect.prototype.setRemoteLoading = function (state) {
        this.$ui.toggleClass('is-loading', !!state);
    };

    OziSelect.prototype.handleSearchInput = function (query) {
        var self = this;
        var text = String(query || '').trim();
        this.lastSearchQuery = text;
        this.renderOptions(text);
        this.syncHighlightAfterRender(false);
        if (!this.isRemoteSearchEnabled()) return;
        if (this.remoteRequestTimer) { clearTimeout(this.remoteRequestTimer); this.remoteRequestTimer = null; }
        if (!text.length || text.length < this.zldMin) { this.abortRemoteRequest(); this.resetRemoteOptionsToInitial(); return; }
        this.remoteRequestTimer = setTimeout(function () { self.fetchRemoteOptions(text); }, this.zldDelay);
    };

    OziSelect.prototype.fetchRemoteOptions = function (query) {
        var self = this;
        if (!this.isRemoteSearchEnabled()) return;
        this.abortRemoteRequest();

        this.remoteRequestSeq += 1;
        var requestId = this.remoteRequestSeq;

        this.remoteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        this.setRemoteLoading(true);

        var csrf    = $('meta[name="csrf-token"]').attr('content');
        var method  = this.zldMethod === 'GET' ? 'GET' : 'POST';
        var headers = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };

        if (csrf) headers['X-CSRF-TOKEN'] = csrf;

        var url         = this.zldUrl;
        var fetchConfig = { method: method, headers: headers };

        if (this.remoteAbortController) fetchConfig.signal = this.remoteAbortController.signal;

        if (method === 'GET') {
            url = this.appendRemoteParamsToUrl(url, query);
        } else {
            var formData = new FormData();
            this.appendRemoteParamsToFormData(formData, query);
            if (csrf && !formData.has('_token')) formData.append('_token', csrf);
            fetchConfig.body = formData;
        }

        if (this.zldLog) {
            console.log('OziSelect | remote request', {
                key: this.key, method: method, url: url, query: query, itemName: this.zldItemName
            });
        }

        return fetch(url, fetchConfig)
            .then(async function (response) {
                if (requestId !== self.remoteRequestSeq) return null;
                var json = null;
                try { json = await response.json(); } catch (err) {
                    if (self.zldLog) console.error('OziSelect | resposta JSON inválida', err);
                    return null;
                }
                if (self.zldLog) console.log('OziSelect | remote json', json);
                if (json && Array.isArray(json.actions) && typeof window.zldActions === 'function') {
                    window.zldActions(json.actions, {
                        loadData: { zldUrl: self.zldUrl, zldApi: true, zldExpectJson: true },
                        response: response, json: json
                    });
                }
                if (!response.ok) return null;
                var options   = self.extractOptionsFromRemoteResponse(json);
                var liveQuery = self.$search ? (self.$search.val() || '') : query;
                self.applyRemoteOptions(options, liveQuery);
                return options;
            })
            .catch(function (err) {
                if (err && err.name === 'AbortError') return null;
                if (self.zldLog) console.error('OziSelect | erro remoto', err);
                return null;
            })
            .finally(function () {
                if (requestId !== self.remoteRequestSeq) return;
                self.setRemoteLoading(false);
                self.remoteAbortController = null;
            });
    };

    // ------------------------------------------
    // Destroy / Reload
    // ------------------------------------------

    OziSelect.prototype.destroy = function () {
        this.abortRemoteRequest();
        $(document).off(this.ns);
        if (this.$form && this.$form.length) this.$form.off(this.ns);
        if (this.$ui) { this.$ui.off(); this.$ui.remove(); }
        if (this.$feedback) this.$feedback.remove();
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

    // ------------------------------------------
    // API pública — window.OziSelect
    // ------------------------------------------

    window.OziSelect = {

        init: function (selector) {
            var $elements = selector ? $(selector) : $('[data-ozi-select]');
            var $targets  = $elements.filter('[data-ozi-select]').add($elements.find('[data-ozi-select]'));

            $targets.each(function () {
                var $el  = $(this);
                var key  = String($el.attr('data-ozi-select') || '').trim();
                if (!key) return;

                var existing = instances[key];

                if (existing) {
                    var sameElement   = existing.$root && existing.$root[0] === this;
                    var oldStillInDom = existing.$root && document.contains(existing.$root[0]);

                    if (sameElement && $el.data('ozi-select-initialized')) return;
                    if (!sameElement && !oldStillInDom) { existing.destroy(); }
                    else if (!sameElement && oldStillInDom) { return; }
                }

                instances[key] = new OziSelect(this);
            });

            return this;
        },

        observe: function () {
            if (window.__oziSelectObserverInited) return;
            window.__oziSelectObserverInited = true;

            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
                        if (!node || node.nodeType !== 1) return;
                        var $node = $(node);
                        if ($node.is('[data-ozi-select]')) { window.OziSelect.init($node); return; }
                        var $children = $node.find('[data-ozi-select]');
                        if ($children.length) window.OziSelect.init($node);
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
            window.__oziSelectObserver = observer;
        },

        get: function (selectorOrKey) {
            if (!selectorOrKey) return null;
            if (typeof selectorOrKey === 'string' && !selectorOrKey.startsWith('#') && !selectorOrKey.startsWith('.')) {
                return instances[selectorOrKey] || null;
            }
            var $el = $(selectorOrKey).first();
            if (!$el.length) return null;
            var key = String($el.attr('data-ozi-select') || '').trim();
            return instances[key] || null;
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

        value: function (selectorOrKey, newValue) {
            var instance = this.get(selectorOrKey);
            if (!instance) return null;
            if (newValue === undefined) return instance.getValue();
            instance.setValue(newValue);
            return instance.getValue();
        },

        items: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            return instance ? instance.getSelectedItems() : [];
        },

        clear: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            instance.clearSelection();
        },

        open: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            instance.open(false);
        },

        close: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            instance.close();
        },

        disable: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            instance.setDisabled(true);
        },

        enable: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            instance.setDisabled(false);
        },

        required: function (selectorOrKey, state) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            if (state === undefined) return instance.isRequired();
            instance.setRequired(!!state);
        }
    };

    $(function () {
        window.OziSelect.init();
        window.OziSelect.observe();
    });

})(jQuery);