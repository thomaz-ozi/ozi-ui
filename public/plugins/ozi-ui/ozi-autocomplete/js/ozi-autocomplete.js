(function ($) {
    'use strict';

    var instances = {};
    var instanceCounter = 0;

    function OziAutocomplete(element) {
        this.$input = $(element);
        this.key = String(this.$input.attr('data-ozi-autocomplete') || '').trim();

        if (!this.key) {
            throw new Error('oziAutocomplete 1.0.0: data-ozi-autocomplete é obrigatório.');
        }

        this.uid = 'ozi-autocomplete-' + (++instanceCounter);
        this.ns = '.oziAutocomplete.' + this.uid;

        this.hiddenName = String(
            this.$input.attr('data-ozi-autocomplete-hidden-name') || this.key
        ).trim();

        this.msgEmpty = String(
            this.$input.attr('data-ozi-autocomplete-msg-empty') || 'Nenhum resultado encontrado'
        ).trim();

        this.msgSearch = String(
            this.$input.attr('data-ozi-autocomplete-msg-search') || 'Pesquisando...'
        ).trim();

        this.options = [];
        this.filteredOptions = [];
        this.selectedItem = null;
        this.highlightedIndex = -1;
        this.isOpen = false;
        this.isLoading = false;

        this.$wrap = null;
        this.$dropdown = null;
        this.$list = null;
        this.$hidden = null;

        this.init();
    }

    OziAutocomplete.prototype.init = function () {
        if (this.$input.data('ozi-autocomplete-initialized')) return;
        this.$input.data('ozi-autocomplete-initialized', true);

        this.options = this.loadOptions();
        this.filteredOptions = this.options.slice();

        this.buildUI();
        this.syncInitialFromHidden();
        this.bindEvents();
    };

    OziAutocomplete.prototype.loadOptions = function () {
        var selector = 'script[data-ozi-autocomplete-options="' + this.key + '"]';
        var $script = this.$input.nextAll(selector).first();

        if (!$script.length) {
            $script = this.$input.parent().find(selector).first();
        }

        if (!$script.length) {
            $script = $(selector).first();
        }

        if (!$script.length) {
            return [];
        }

        try {
            var parsed = JSON.parse($script.text().trim() || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('oziAutocomplete 1.0.0: erro ao parsear JSON de "' + this.key + '".', error);
            return [];
        }
    };

    OziAutocomplete.prototype.buildUI = function () {
        this.$input.addClass('ozi-autocomplete-input');

        if (!this.$input.parent().hasClass('ozi-autocomplete-wrap')) {
            this.$input.wrap('<div class="ozi-autocomplete-wrap position-relative"></div>');
        }

        this.$wrap = this.$input.parent();

        this.$dropdown = $('<div>', {
            class: 'ozi-autocomplete-dropdown dropdown-menu w-100',
            style: 'display:none;'
        });

        this.$list = $('<div>', {
            class: 'ozi-autocomplete-list'
        });

        this.$dropdown.append(this.$list);
        this.$wrap.append(this.$dropdown);

        this.$hidden = $('<input>', {
            type: 'hidden',
            name: this.hiddenName,
            'data-ozi-autocomplete-hidden': this.key
        });

        this.$wrap.append(this.$hidden);
    };

    OziAutocomplete.prototype.bindEvents = function () {
        var self = this;

        this.$input.on('focus' + this.ns + ' click' + this.ns, function () {
            self.filterAndRender($(this).val() || '');
            self.open();
        });

        this.$input.on('input' + this.ns, function () {
            var text = $(this).val() || '';

            if (self.selectedItem && text !== String(self.selectedItem.label || '')) {
                self.selectedItem = null;
                self.syncHidden();
            }

            self.filterAndRender(text);
            self.open();
        });

        this.$input.on('keydown' + this.ns, function (e) {
            self.handleKeydown(e);
        });

        this.$input.on('blur' + this.ns, function () {
            setTimeout(function () {
                self.syncInputToSelectionOrExactMatch();
                self.close();
            }, 120);
        });

        this.$dropdown.on('mousedown' + this.ns, '.ozi-autocomplete-option', function (e) {
            e.preventDefault();

            var index = Number($(this).attr('data-index'));
            var item = self.filteredOptions[index];

            if (!item) return;
            self.selectItem(item);
        });

        $(document).on('click' + this.ns, function (e) {
            if (!self.$wrap.is(e.target) && self.$wrap.has(e.target).length === 0) {
                self.syncInputToSelectionOrExactMatch();
                self.close();
            }
        });
    };

    OziAutocomplete.prototype.handleKeydown = function (e) {
        if (!this.isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            this.filterAndRender(this.$input.val() || '');
            this.open();

            if (e.key === 'ArrowDown') {
                this.highlightNext();
            } else {
                this.highlightPrev();
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
                if (!this.isOpen) return;
                e.preventDefault();

                if (
                    this.highlightedIndex >= 0 &&
                    this.filteredOptions[this.highlightedIndex]
                ) {
                    this.selectItem(this.filteredOptions[this.highlightedIndex]);
                } else {
                    this.syncInputToSelectionOrExactMatch();
                    this.close();
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.close();
                break;

            case 'Tab':
                this.syncInputToSelectionOrExactMatch();
                this.close();
                break;
        }
    };

    OziAutocomplete.prototype.normalize = function (value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };

    OziAutocomplete.prototype.filterOptions = function (query) {
        var self = this;
        var normalizedQuery = this.normalize(query);

        if (!normalizedQuery) {
            return this.options.slice();
        }

        return this.options.filter(function (item) {
            var label = self.normalize(item.label);
            var value = self.normalize(item.value);
            return label.indexOf(normalizedQuery) !== -1 || value.indexOf(normalizedQuery) !== -1;
        });
    };

    OziAutocomplete.prototype.filterAndRender = function (query) {
        this.filteredOptions = this.filterOptions(query);
        this.highlightedIndex = -1;
        this.renderList();
    };

    OziAutocomplete.prototype.renderList = function () {
        var self = this;

        this.$list.empty();

        if (this.isLoading) {
            this.$list.append(
                $('<div>', {
                    class: 'ozi-autocomplete-empty dropdown-item-text text-muted'
                }).text(this.msgSearch)
            );
            return;
        }

        if (!this.filteredOptions.length) {
            this.$list.append(
                $('<div>', {
                    class: 'ozi-autocomplete-empty dropdown-item-text text-muted'
                }).text(this.msgEmpty)
            );
            return;
        }

        this.filteredOptions.forEach(function (item, index) {
            var isSelected = self.selectedItem && String(self.selectedItem.value) === String(item.value);

            var $option = $('<button>', {
                type: 'button',
                class: 'dropdown-item ozi-autocomplete-option' + (isSelected ? ' is-selected' : ''),
                'data-index': index
            });

            $option.text(item.label || item.value || '');
            self.$list.append($option);
        });
    };

    OziAutocomplete.prototype.open = function () {
        if (this.isOpen) return;

        this.isOpen = true;
        this.$dropdown.show();
    };

    OziAutocomplete.prototype.close = function () {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.$dropdown.hide();
        this.clearHighlight();
    };

    OziAutocomplete.prototype.clearHighlight = function () {
        this.highlightedIndex = -1;
        this.$list.find('.ozi-autocomplete-option').removeClass('active');
    };

    OziAutocomplete.prototype.highlightOption = function (index) {
        var $options = this.$list.find('.ozi-autocomplete-option');

        if (!$options.length) {
            this.highlightedIndex = -1;
            return;
        }

        if (index < 0) index = 0;
        if (index >= $options.length) index = $options.length - 1;

        this.highlightedIndex = index;
        $options.removeClass('active');

        var $current = $options.eq(index).addClass('active');

        var listEl = this.$dropdown[0];
        var optionEl = $current[0];

        if (listEl && optionEl) {
            var optionTop = optionEl.offsetTop;
            var optionBottom = optionTop + optionEl.offsetHeight;
            var listTop = listEl.scrollTop;
            var listBottom = listTop + listEl.clientHeight;

            if (optionTop < listTop) {
                listEl.scrollTop = optionTop;
            } else if (optionBottom > listBottom) {
                listEl.scrollTop = optionBottom - listEl.clientHeight;
            }
        }
    };

    OziAutocomplete.prototype.highlightNext = function () {
        if (!this.isOpen) return;
        if (!this.filteredOptions.length) return;

        this.highlightOption(this.highlightedIndex + 1);
    };

    OziAutocomplete.prototype.highlightPrev = function () {
        if (!this.isOpen) return;
        if (!this.filteredOptions.length) return;

        if (this.highlightedIndex <= 0) {
            this.highlightOption(this.filteredOptions.length - 1);
            return;
        }

        this.highlightOption(this.highlightedIndex - 1);
    };

    OziAutocomplete.prototype.selectItem = function (item) {
        if (!item) return;

        this.selectedItem = item;
        this.$input.val(item.label || '');
        this.syncHidden();
        this.filterAndRender(this.$input.val() || '');
        this.close();
        this.emitChange();
    };

    OziAutocomplete.prototype.syncHidden = function () {
        if (!this.selectedItem) {
            this.$hidden.val('');
            return;
        }

        this.$hidden.val(this.selectedItem.value == null ? '' : String(this.selectedItem.value));
    };

    OziAutocomplete.prototype.findExactMatchByLabel = function (text) {
        var normalizedText = this.normalize(text);

        if (!normalizedText) return null;

        for (var i = 0; i < this.options.length; i++) {
            if (this.normalize(this.options[i].label) === normalizedText) {
                return this.options[i];
            }
        }

        return null;
    };

    OziAutocomplete.prototype.syncInputToSelectionOrExactMatch = function () {
        var text = String(this.$input.val() || '').trim();

        if (!text) {
            this.clearSelection(false);
            return;
        }

        if (this.selectedItem && text === String(this.selectedItem.label || '')) {
            this.syncHidden();
            return;
        }

        var exact = this.findExactMatchByLabel(text);

        if (exact) {
            this.selectedItem = exact;
            this.$input.val(exact.label || '');
            this.syncHidden();
            this.emitChange();
            return;
        }

        this.selectedItem = null;
        this.syncHidden();
    };

    OziAutocomplete.prototype.syncInitialFromHidden = function () {
        var hiddenValue = String(this.$hidden.val() || '').trim();
        var inputValue = String(this.$input.val() || '').trim();
        var self = this;

        if (hiddenValue) {
            var byValue = this.options.find(function (item) {
                return String(item.value) === hiddenValue;
            });

            if (byValue) {
                this.selectedItem = byValue;
                this.$input.val(byValue.label || '');
                this.syncHidden();
                return;
            }
        }

        if (inputValue) {
            var byLabel = this.options.find(function (item) {
                return self.normalize(item.label) === self.normalize(inputValue);
            });

            if (byLabel) {
                this.selectedItem = byLabel;
                this.$input.val(byLabel.label || '');
                this.syncHidden();
                return;
            }
        }

        this.selectedItem = null;
        this.syncHidden();
    };

    OziAutocomplete.prototype.clearSelection = function (emitChange) {
        this.selectedItem = null;
        this.$input.val('');
        this.syncHidden();
        this.filterAndRender('');

        if (emitChange !== false) {
            this.emitChange();
        }
    };

    OziAutocomplete.prototype.getValue = function () {
        return this.selectedItem ? this.selectedItem.value : null;
    };

    OziAutocomplete.prototype.getItem = function () {
        return this.selectedItem || null;
    };

    OziAutocomplete.prototype.setValue = function (value) {
        var found = null;

        for (var i = 0; i < this.options.length; i++) {
            if (String(this.options[i].value) === String(value)) {
                found = this.options[i];
                break;
            }
        }

        if (!found) {
            this.clearSelection(false);
            return null;
        }

        this.selectedItem = found;
        this.$input.val(found.label || '');
        this.syncHidden();
        this.emitChange();

        return found.value;
    };

    OziAutocomplete.prototype.emitChange = function () {
        var detail = {
            key: this.key,
            value: this.getValue(),
            item: this.getItem(),
            instance: this
        };

        this.$input.trigger('ozi:change', [detail.item, this, detail]);

        if (this.$input[0] && typeof CustomEvent === 'function') {
            this.$input[0].dispatchEvent(new CustomEvent('ozi:change', {
                bubbles: true,
                detail: detail
            }));
        }
    };

    OziAutocomplete.prototype.destroy = function () {
        $(document).off(this.ns);
        this.$input.off(this.ns);

        if (this.$dropdown) {
            this.$dropdown.remove();
        }

        if (this.$hidden) {
            this.$hidden.remove();
        }

        this.$input.removeData('ozi-autocomplete-initialized');

        delete instances[this.key];
    };

    OziAutocomplete.prototype.reload = function () {
        var input = this.$input[0];
        this.destroy();
        instances[this.key] = new OziAutocomplete(input);
        return instances[this.key];
    };

    window.OziAutocomplete = {
        init: function (selector) {
            var $elements = selector ? $(selector) : $('[data-ozi-autocomplete]');
            var $targets = $elements.filter('[data-ozi-autocomplete]').add($elements.find('[data-ozi-autocomplete]'));

            $targets.each(function () {
                var $el = $(this);
                var key = String($el.attr('data-ozi-autocomplete') || '').trim();

                if (!key) return;

                var existing = instances[key];

                if (existing) {
                    var sameElement = existing.$input && existing.$input[0] === this;
                    var oldStillInDom = existing.$input && document.contains(existing.$input[0]);

                    if (sameElement && $el.data('ozi-autocomplete-initialized')) {
                        return;
                    }

                    if (!sameElement && !oldStillInDom) {
                        existing.destroy();
                    } else if (!sameElement && oldStillInDom) {
                        return;
                    }
                }

                instances[key] = new OziAutocomplete(this);
            });

            return this;
        },

        observe: function () {
            if (window.__oziAutocompleteObserverInited) return;
            window.__oziAutocompleteObserverInited = true;

            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
                        if (!node || node.nodeType !== 1) return;

                        var $node = $(node);

                        if ($node.is('[data-ozi-autocomplete]')) {
                            window.OziAutocomplete.init($node);
                            return;
                        }

                        var $children = $node.find('[data-ozi-autocomplete]');
                        if ($children.length) {
                            window.OziAutocomplete.init($node);
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            window.__oziAutocompleteObserver = observer;
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

            var key = String($el.attr('data-ozi-autocomplete') || '').trim();
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

        item: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            return instance ? instance.getItem() : null;
        },

        clear: function (selectorOrKey) {
            var instance = this.get(selectorOrKey);
            if (!instance) return;
            instance.clearSelection();
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
        }
    };

    function oziAutocompleteInitFetched(root) {
        window.OziAutocomplete.init(root || document);
    }

    $(function () {
        window.OziAutocomplete.init();
        window.OziAutocomplete.observe();
    });

    window.oziAutocompleteInitFetched = oziAutocompleteInitFetched;

})(jQuery);