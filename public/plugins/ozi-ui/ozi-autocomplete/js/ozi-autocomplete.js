/**
 * ------------------------------------------
 * oziAutocomplete
 * ------------------------------------------
 * Ver: (2.0.0)
 * 2026-04-25
 * ------------------------------------------
 */
(function ($) {
    'use strict';

    var instances = {};
    var instanceCounter = 0;

    function OziAutocomplete(element) {
        this.$input = $(element);
        this.key = String(this.$input.attr('data-ozi-autocomplete') || '').trim();

        if (!this.key) {
            throw new Error('oziAutocomplete 1.1.0: data-ozi-autocomplete é obrigatório.');
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

        // busca remota
        this.zldUrl    = String(this.$input.attr('data-ozi-autocomplete-zld-url')    || '').trim();
        this.zldMethod = String(this.$input.attr('data-ozi-autocomplete-zld-method') || 'POST').trim().toUpperCase();
        this.zldParam  = String(this.$input.attr('data-ozi-autocomplete-zld-param')  || 'search').trim();
        this.zldMin    = this.parseIntegerAttr('data-ozi-autocomplete-zld-min',   1);
        this.zldDelay  = this.parseIntegerAttr('data-ozi-autocomplete-zld-delay', 300);
        this.zldLog    = this.parseBooleanAttr('data-ozi-autocomplete-zld-log');

        this.options = [];
        this.initialOptions = [];
        this.filteredOptions = [];
        this.selectedItem = null;
        this.highlightedIndex = -1;
        this.isOpen = false;
        this.isLoading = false;

        this.remoteRequestTimer = null;
        this.remoteAbortController = null;
        this.remoteRequestSeq = 0;

        this.$wrap = null;
        this.$dropdown = null;
        this.$list = null;
        this.$hidden = null;

        this.init();
    }

    // ------------------------------------------
    // HELPERS DE ATRIBUTO
    // ------------------------------------------

    OziAutocomplete.prototype.parseBooleanAttr = function (attrName) {
        if (!this.$input.is('[' + attrName + ']')) return false;
        var raw = this.$input.attr(attrName);
        if (raw === undefined || raw === '') return true;
        raw = String(raw).trim().toLowerCase();
        if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
        return true;
    };

    OziAutocomplete.prototype.parseIntegerAttr = function (attrName, fallback) {
        if (!this.$input.is('[' + attrName + ']')) return fallback;
        var parsed = parseInt(String(this.$input.attr(attrName) || '').trim(), 10);
        return isNaN(parsed) ? fallback : parsed;
    };

    OziAutocomplete.prototype.isRemoteEnabled = function () {
        return !!this.zldUrl;
    };

    // ------------------------------------------
    // INIT
    // ------------------------------------------

    OziAutocomplete.prototype.init = function () {
        if (this.$input.data('ozi-autocomplete-initialized')) return;
        this.$input.data('ozi-autocomplete-initialized', true);

        this.options = this.loadOptions();
        this.initialOptions = this.cloneOptions(this.options);
        this.filteredOptions = this.options.slice();

        this.buildUI();
        this.syncInitialFromHidden();
        this.bindEvents();
    };

    OziAutocomplete.prototype.cloneOptions = function (options) {
        try {
            return JSON.parse(JSON.stringify(Array.isArray(options) ? options : []));
        } catch (e) {
            return Array.isArray(options) ? options.slice() : [];
        }
    };

    // ------------------------------------------
    // LOAD OPTIONS
    // ------------------------------------------

    OziAutocomplete.prototype.loadOptions = function () {
        var selector = 'script[data-ozi-autocomplete-options="' + this.key + '"]';
        var $script = this.$input.nextAll(selector).first();

        if (!$script.length) $script = this.$input.parent().find(selector).first();
        if (!$script.length) $script = $(selector).first();
        if (!$script.length) return [];

        try {
            var parsed = JSON.parse($script.text().trim() || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('oziAutocomplete 1.1.0: erro ao parsear JSON de "' + this.key + '".', error);
            return [];
        }
    };

    // ------------------------------------------
    // BUILD UI
    // ------------------------------------------

    OziAutocomplete.prototype.buildUI = function () {
        this.$input.addClass('ozi-autocomplete-input');

        if (!this.$input.parent().hasClass('ozi-autocomplete-wrap')) {
            this.$input.wrap('<div class="ozi-autocomplete-wrap"></div>');
        }

        this.$wrap = this.$input.parent();

        this.$dropdown = $('<div>', {
            class: 'ozi-autocomplete-dropdown',
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

    // ------------------------------------------
    // EVENTOS
    // ------------------------------------------

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

            self.handleInput(text);
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

    // ------------------------------------------
    // HANDLE INPUT — local + remoto
    // ------------------------------------------

    OziAutocomplete.prototype.handleInput = function (text) {
        // sempre filtra local primeiro — resposta imediata
        this.filterAndRender(text);
        this.open();

        if (!this.isRemoteEnabled()) return;

        // cancela timer anterior
        if (this.remoteRequestTimer) {
            clearTimeout(this.remoteRequestTimer);
            this.remoteRequestTimer = null;
        }

        // abaixo do mínimo — volta para opções iniciais
        if (!text.length || text.length < this.zldMin) {
            this.abortRemoteRequest();
            this.resetToInitialOptions();
            return;
        }

        // debounce
        var self = this;
        this.remoteRequestTimer = setTimeout(function () {
            self.fetchRemoteOptions(text);
        }, this.zldDelay);
    };

    // ------------------------------------------
    // BUSCA REMOTA
    // ------------------------------------------

    OziAutocomplete.prototype.abortRemoteRequest = function () {
        if (this.remoteRequestTimer) {
            clearTimeout(this.remoteRequestTimer);
            this.remoteRequestTimer = null;
        }

        if (this.remoteAbortController) {
            this.remoteAbortController.abort();
            this.remoteAbortController = null;
        }
    };

    OziAutocomplete.prototype.resetToInitialOptions = function () {
        this.options = this.cloneOptions(this.initialOptions);
        this.filterAndRender(this.$input.val() || '');
    };

    OziAutocomplete.prototype.setLoading = function (state) {
        this.isLoading = !!state;
        this.$input.toggleClass('is-loading', this.isLoading);
        this.renderList();
    };

    OziAutocomplete.prototype.extractOptions = function (json) {
        if (Array.isArray(json)) return json;
        if (json && Array.isArray(json.options)) return json.options;
        return [];
    };

    OziAutocomplete.prototype.fetchRemoteOptions = function (query) {
        var self = this;

        this.abortRemoteRequest();

        this.remoteRequestSeq += 1;
        var requestId = this.remoteRequestSeq;

        this.remoteAbortController = typeof AbortController !== 'undefined'
            ? new AbortController()
            : null;

        this.setLoading(true);

        var csrf = $('meta[name="csrf-token"]').attr('content');
        var method = this.zldMethod === 'GET' ? 'GET' : 'POST';

        var headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        };

        if (csrf) headers['X-CSRF-TOKEN'] = csrf;

        var url = this.zldUrl;
        var fetchConfig = { method: method, headers: headers };

        if (this.remoteAbortController) {
            fetchConfig.signal = this.remoteAbortController.signal;
        }

        if (method === 'GET') {
            var joiner = url.indexOf('?') >= 0 ? '&' : '?';
            url += joiner + encodeURIComponent(this.zldParam) + '=' + encodeURIComponent(query);
        } else {
            var formData = new FormData();
            formData.append(this.zldParam, query);

            if (csrf && !formData.has('_token')) {
                formData.append('_token', csrf);
            }

            fetchConfig.body = formData;
        }

        if (this.zldLog) {
            console.log('oziAutocomplete| remote request', {
                key: this.key,
                method: method,
                url: url,
                query: query
            });
        }

        return fetch(url, fetchConfig)
            .then(function (response) {
                return response.json().then(function (json) {
                    return { response: response, json: json };
                });
            })
            .then(function (result) {
                if (requestId !== self.remoteRequestSeq) return;

                var response = result.response;
                var json     = result.json;

                if (self.zldLog) {
                    console.log('oziAutocomplete| remote json', json);
                }

                // integra zldActions se disponível
                if (json && Array.isArray(json.actions) && typeof window.zldActions === 'function') {
                    window.zldActions(json.actions, {
                        loadData: { zldUrl: self.zldUrl, zldApi: true, zldExpectJson: true },
                        response: response,
                        json: json
                    });
                }

                if (!response.ok) return;

                var options = self.extractOptions(json);
                self.options = self.cloneOptions(options);

                var liveQuery = String(self.$input.val() || '').trim();
                self.filterAndRender(liveQuery);
            })
            .catch(function (err) {
                if (err && err.name === 'AbortError') return;

                if (self.zldLog) {
                    console.error('oziAutocomplete| erro remoto', err);
                }
            })
            .finally(function () {
                if (requestId !== self.remoteRequestSeq) return;
                self.setLoading(false);
                self.remoteAbortController = null;
            });
    };

    // ------------------------------------------
    // KEYDOWN
    // ------------------------------------------

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
                this.abortRemoteRequest();
                this.close();
                break;

            case 'Tab':
                this.syncInputToSelectionOrExactMatch();
                this.close();
                break;
        }
    };

    // ------------------------------------------
    // NORMALIZE / FILTER
    // ------------------------------------------

    OziAutocomplete.prototype.normalize = function (value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };

    OziAutocomplete.prototype.filterOptions = function (query) {
        var self = this;
        var normalizedQuery = this.normalize(query);

        if (!normalizedQuery) return this.options.slice();

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

    // ------------------------------------------
    // RENDER
    // ------------------------------------------

    OziAutocomplete.prototype.renderList = function () {
        var self = this;

        this.$list.empty();

        if (this.isLoading) {
            this.$list.append(
                $('<div>', { class: 'ozi-autocomplete-empty ozi-autocomplete-loading' })
                    .text(this.msgSearch)
            );
            return;
        }

        if (!this.filteredOptions.length) {
            this.$list.append(
                $('<div>', { class: 'ozi-autocomplete-empty' })
                    .text(this.msgEmpty)
            );
            return;
        }

        this.filteredOptions.forEach(function (item, index) {
            var isSelected = self.selectedItem && String(self.selectedItem.value) === String(item.value);

            var $option = $('<button>', {
                type: 'button',
                class: 'ozi-autocomplete-option' + (isSelected ? ' is-selected' : ''),
                'data-index': index
            }).text(item.label || item.value || '');

            self.$list.append($option);
        });
    };

    // ------------------------------------------
    // OPEN / CLOSE
    // ------------------------------------------

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

    // ------------------------------------------
    // HIGHLIGHT
    // ------------------------------------------

    OziAutocomplete.prototype.clearHighlight = function () {
        this.highlightedIndex = -1;
        this.$list.find('.ozi-autocomplete-option').removeClass('is-highlighted');
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
        $options.removeClass('is-highlighted');

        var $current = $options.eq(index).addClass('is-highlighted');

        var listEl   = this.$dropdown[0];
        var optionEl = $current[0];

        if (listEl && optionEl) {
            var optionTop    = optionEl.offsetTop;
            var optionBottom = optionTop + optionEl.offsetHeight;
            var listTop      = listEl.scrollTop;
            var listBottom   = listTop + listEl.clientHeight;

            if (optionTop < listTop) {
                listEl.scrollTop = optionTop;
            } else if (optionBottom > listBottom) {
                listEl.scrollTop = optionBottom - listEl.clientHeight;
            }
        }
    };

    OziAutocomplete.prototype.highlightNext = function () {
        if (!this.isOpen || !this.filteredOptions.length) return;
        this.highlightOption(this.highlightedIndex + 1);
    };

    OziAutocomplete.prototype.highlightPrev = function () {
        if (!this.isOpen || !this.filteredOptions.length) return;

        if (this.highlightedIndex <= 0) {
            this.highlightOption(this.filteredOptions.length - 1);
            return;
        }

        this.highlightOption(this.highlightedIndex - 1);
    };

    // ------------------------------------------
    // SELEÇÃO
    // ------------------------------------------

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
        var inputValue  = String(this.$input.val()  || '').trim();
        var self = this;

        if (hiddenValue) {
            var byValue = this.options.filter(function (item) {
                return String(item.value) === hiddenValue;
            })[0];

            if (byValue) {
                this.selectedItem = byValue;
                this.$input.val(byValue.label || '');
                this.syncHidden();
                return;
            }
        }

        if (inputValue) {
            var byLabel = this.options.filter(function (item) {
                return self.normalize(item.label) === self.normalize(inputValue);
            })[0];

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

    // ------------------------------------------
    // API DE INSTÂNCIA
    // ------------------------------------------

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
            key:      this.key,
            value:    this.getValue(),
            item:     this.getItem(),
            instance: this
        };

        this.$input.trigger('ozi:change', [detail.item, this, detail]);

        if (this.$input[0] && typeof CustomEvent === 'function') {
            this.$input[0].dispatchEvent(new CustomEvent('ozi:change', {
                bubbles: true,
                detail:  detail
            }));
        }
    };

    OziAutocomplete.prototype.destroy = function () {
        this.abortRemoteRequest();

        $(document).off(this.ns);
        this.$input.off(this.ns);

        if (this.$dropdown) this.$dropdown.remove();
        if (this.$hidden)   this.$hidden.remove();

        this.$input.removeData('ozi-autocomplete-initialized');

        delete instances[this.key];
    };

    OziAutocomplete.prototype.reload = function () {
        var input = this.$input[0];
        this.destroy();
        instances[this.key] = new OziAutocomplete(input);
        return instances[this.key];
    };

    // ------------------------------------------
    // API PÚBLICA
    // ------------------------------------------

    window.OziAutocomplete = {
        init: function (selector) {
            var $elements = selector ? $(selector) : $('[data-ozi-autocomplete]');
            var $targets  = $elements.filter('[data-ozi-autocomplete]').add($elements.find('[data-ozi-autocomplete]'));

            $targets.each(function () {
                var $el  = $(this);
                var key  = String($el.attr('data-ozi-autocomplete') || '').trim();

                if (!key) return;

                var existing = instances[key];

                if (existing) {
                    var sameElement   = existing.$input && existing.$input[0] === this;
                    var oldStillInDom = existing.$input && document.contains(existing.$input[0]);

                    if (sameElement && $el.data('ozi-autocomplete-initialized')) return;

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
                        if ($children.length) window.OziAutocomplete.init($node);
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
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

            if (newValue === undefined) return instance.getValue();

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