/**
 * ------------------------------------------
 * ozi-autocomplete
 * ------------------------------------------
 * Ver: 3.0.3
 * 2026-05-30
 *
 * Changelog:
 *   - v3.0.3: [FIX-P1] Fallback 'invalid-feedback' (BS5) → 'ozi-feedback' em _buildUI.
 *   - v3.0.3: [FIX-A]  Classes 'is-valid'/'is-invalid' hardcoded em _validateUnique
 *     substituídas por _classMap('valid','ozi-valid') e _classMap('invalid','ozi-invalid').
 *   - v3.0.3: [FIX-B]  Fallback 'is-valid' em validate() → 'ozi-valid'.
 *   - v3.0.3: [FIX-C]  Classe 'is-loading' → _classMap('loading','ozi-loading')
 *     em _setLoading() para consistência com o sistema de temas.
 */

(function ($, window, document) {
    'use strict';

    if (typeof $ === 'undefined') {
        console.error('[OZI:autocomplete] jQuery não encontrado.');
        return;
    }

    var _instances       = {};
    var _instanceCounter = 0;

    /* ─── CONSTRUCTOR ───────────────────────────── */

    function OziAutocomplete(element) {
        this.$input = $(element);
        this.key    = String(this.$input.attr('data-ozi-autocomplete') || '').trim();
        if (!this.key) throw new Error('[OZI:autocomplete] data-ozi-autocomplete é obrigatório.');

        this.uid = 'ozi-autocomplete-' + (++_instanceCounter);
        this.ns  = '.oziAutocomplete.' + this.uid;

        this.hiddenName  = String(this.$input.attr('data-ozi-autocomplete-hidden-name') || this.key).trim();
        this.msgEmpty    = String(this.$input.attr('data-ozi-autocomplete-msg-empty')   || 'No results').trim();
        this.msgSearch   = String(this.$input.attr('data-ozi-autocomplete-msg-search')  || 'Searching...').trim();
        this.isRequired  = this._parseBoolAttr('data-ozi-autocomplete-required');
        this.requiredMsg = String(this.$input.attr('data-ozi-autocomplete-required-message') || 'Required field').trim();

        this.zldUrl    = String(this.$input.attr('data-ozi-autocomplete-zld-url')    || '').trim();
        this.zldMethod = String(this.$input.attr('data-ozi-autocomplete-zld-method') || 'POST').trim().toUpperCase();
        this.zldParam  = String(this.$input.attr('data-ozi-autocomplete-zld-param')  || 'search').trim();
        this.zldMin    = this._parseIntAttr('data-ozi-autocomplete-zld-min',   1);
        this.zldDelay  = this._parseIntAttr('data-ozi-autocomplete-zld-delay', 300);
        this.zldLog    = this._parseBoolAttr('data-ozi-autocomplete-zld-log');

        this.uniqueGroup   = String(this.$input.attr('data-ozi-autocomplete-unique') || '').trim();
        this.uniqueMessage = String(this.$input.attr('data-ozi-autocomplete-unique-message') || 'Value already selected').trim();
        this.$uniqueToast  = null;

        this.options          = [];
        this.initialOptions   = [];
        this.filteredOptions  = [];
        this.selectedItem     = null;
        this.highlightedIndex = -1;
        this.isOpen           = false;
        this.isLoading        = false;

        this.remoteRequestTimer    = null;
        this.remoteAbortController = null;
        this.remoteRequestSeq      = 0;

        this.$wrap     = null;
        this.$dropdown = null;
        this.$list     = null;
        this.$hidden   = null;
        this.$feedback = null;
    }

    /* ─── HELPERS ───────────────────────────────── */

    OziAutocomplete.prototype._parseBoolAttr = function (a) {
        if (!this.$input.is('[' + a + ']')) return false;
        var r = this.$input.attr(a);
        if (r === undefined || r === '') return true;
        r = String(r).trim().toLowerCase();
        return !(r === 'false' || r === '0' || r === 'no' || r === 'off');
    };

    OziAutocomplete.prototype._parseIntAttr = function (a, fb) {
        if (!this.$input.is('[' + a + ']')) return fb;
        var n = parseInt(String(this.$input.attr(a) || '').trim(), 10);
        return isNaN(n) ? fb : n;
    };

    OziAutocomplete.prototype._classMap = function (key, fb) {
        var conf = window.OZI && window.OZI.conf;
        return (conf && conf.classMap && conf.classMap[key]) || fb || '';
    };

    OziAutocomplete.prototype._normalize = function (v) {
        return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    OziAutocomplete.prototype.isRemoteEnabled = function () { return !!this.zldUrl; };

    /* ─── ALIAS MAP ─────────────────────────────── */

    OziAutocomplete.prototype._parseAliasMap = function () {
        var raw = String(this.$input.attr('data-ozi-autocomplete-as') || '').trim();
        var map = {};
        if (!raw) return map;
        raw.split(',').forEach(function (chunk) {
            var p = chunk.split('=');
            var c = String(p[0] || '').trim(), a = String(p[1] || '').trim();
            if (c && a && c !== a) map[c] = a;
        });
        return map;
    };

    OziAutocomplete.prototype._normalizeOptions = function (options) {
        var map = this.aliasMap;
        if (!map || !Object.keys(map).length) return options;
        return (Array.isArray(options) ? options : []).map(function (item) {
            if (!item || typeof item !== 'object') return item;
            var n = {};
            Object.keys(item).forEach(function (k) { n[k] = item[k]; });
            Object.keys(map).forEach(function (c) {
                var a = map[c];
                if (Object.prototype.hasOwnProperty.call(item, a)) { n[c] = item[a]; delete n[a]; }
            });
            return n;
        });
    };

    OziAutocomplete.prototype._cloneOptions = function (o) {
        try { return JSON.parse(JSON.stringify(Array.isArray(o) ? o : [])); }
        catch (e) { return Array.isArray(o) ? o.slice() : []; }
    };

    /* ─── UNIQUE ────────────────────────────────── */

    OziAutocomplete.prototype._isUniqueViolation = function (value) {
        var self = this, group = self.uniqueGroup;
        if (!group) return false;
        return Object.keys(_instances).some(function (k) {
            var inst = _instances[k];
            if (inst.key === self.key || inst.uniqueGroup !== group) return false;
            return inst.selectedItem && String(inst.selectedItem.value) === String(value);
        });
    };

    OziAutocomplete.prototype._showUniqueToast = function () {
        var self = this;
        if (this.$uniqueToast) { this.$uniqueToast.remove(); this.$uniqueToast = null; }
        var offset = this.$input.offset(), h = this.$input.outerHeight();
        this.$uniqueToast = $('<div>', {
            class: 'ozi-autocomplete-unique-toast',
            text:  this.uniqueMessage,
            css:   { position: 'fixed', top: (offset.top + h + 6) + 'px', left: offset.left + 'px', zIndex: 9999, opacity: 1 }
        });
        $('body').append(this.$uniqueToast);
        var $t = this.$uniqueToast;
        setTimeout(function () {
            $t.animate({ opacity: 0 }, 400, function () {
                $t.remove();
                if (self.$uniqueToast && self.$uniqueToast[0] === $t[0]) self.$uniqueToast = null;
            });
        }, 2500);
    };

    OziAutocomplete.prototype._validateUnique = function () {
        if (!this.uniqueGroup) return;
        var text = String(this.$input.val() || '').trim();

        // [FIX-A] usa _classMap em vez de classes BS5 hardcoded
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.$input.removeClass(clsValid + ' ' + clsInvalid);

        if (!text) return;
        var match = this._findByLabel(text);
        if (match && this._isUniqueViolation(match.value)) {
            this.selectedItem = null;
            this.$input.val('');
            this._syncHidden();
            this.$input.addClass(clsInvalid);
            this._showUniqueToast();
            this._emit('ozi:unique-invalid', { item: match, group: this.uniqueGroup });
            return;
        }
        if (match) this.$input.addClass(clsValid);
    };

    /* ─── INIT ──────────────────────────────────── */

    OziAutocomplete.prototype.init = function () {
        if (this.$input.data('ozi-autocomplete-initialized')) return;
        this.$input.data('ozi-autocomplete-initialized', true);

        this.aliasMap        = this._parseAliasMap();
        this.options         = this._normalizeOptions(this._loadOptions());
        this.initialOptions  = this._cloneOptions(this.options);
        this.filteredOptions = this.options.slice();

        this._buildUI();
        this._syncInitialFromHidden();
        this._bindEvents();
    };

    /* ─── LOAD OPTIONS ──────────────────────────── */

    OziAutocomplete.prototype._loadOptions = function () {
        var key = this.key;
        var sel = 'script[data-ozi-autocomplete-options="' + key + '"]';
        var $s  = this.$input.nextAll(sel).first();
        if (!$s.length) $s = this.$input.parent().find(sel).first();
        if (!$s.length) $s = $(sel).first();
        if (!$s.length) return [];
        try {
            var p = JSON.parse($s.text().trim() || '[]');
            return Array.isArray(p) ? p : [];
        } catch (e) {
            console.error('[OZI:autocomplete] JSON inválido "' + key + '"', e);
            return [];
        }
    };

    /* ─── BUILD UI ──────────────────────────────── */

    OziAutocomplete.prototype._buildUI = function () {
        this.$input.addClass('ozi-autocomplete-input');
        if (!this.$input.parent().hasClass('ozi-autocomplete-wrap')) {
            this.$input.wrap('<div class="ozi-autocomplete-wrap"></div>');
        }
        this.$wrap = this.$input.parent();

        this.$dropdown = $('<div>', { class: 'ozi-autocomplete-dropdown' }).hide();
        this.$list     = $('<div>', { class: 'ozi-autocomplete-list' });
        this.$dropdown.append(this.$list);
        this.$wrap.append(this.$dropdown);

        this.$hidden = $('<input>', {
            type:                         'hidden',
            name:                         this.hiddenName,
            'data-ozi-autocomplete-hidden': this.key
        });
        this.$wrap.append(this.$hidden);

        // [FIX-P1] fallback neutro OZI em vez de 'invalid-feedback' (BS5)
        var fbClass = this._classMap('feedback', 'ozi-feedback');
        this.$feedback = $('<div>', { class: fbClass + ' ozi-autocomplete-feedback' }).hide();
        this.$wrap.append(this.$feedback);
    };

    /* ─── EVENTOS ───────────────────────────────── */

    OziAutocomplete.prototype._bindEvents = function () {
        var self = this;

        this.$input.on('focus' + this.ns + ' click' + this.ns, function () {
            self._filterAndRender($(this).val() || '');
            self._openDropdown();
        });

        this.$input.on('input' + this.ns, function () {
            var text = $(this).val() || '';
            if (self.selectedItem && text !== String(self.selectedItem.label || '')) {
                self.selectedItem = null; self._syncHidden();
            }
            self._handleInput(text);
        });

        this.$input.on('keydown' + this.ns, function (e) { self._handleKeydown(e); });

        this.$input.on('blur' + this.ns, function () {
            setTimeout(function () {
                self._syncInputToSelectionOrExactMatch();
                self._validateUnique();
                self._closeDropdown();
            }, 120);
        });

        this.$dropdown.on('mousedown' + this.ns, '.ozi-autocomplete-option', function (e) {
            e.preventDefault();
            var item = self.filteredOptions[Number($(this).attr('data-index'))];
            if (item) self._selectItem(item);
        });

        $(document).on('click' + this.ns, function (e) {
            if (!self.$wrap.is(e.target) && self.$wrap.has(e.target).length === 0) {
                self._syncInputToSelectionOrExactMatch();
                self._closeDropdown();
            }
        });
    };

    /* ─── HANDLE INPUT ──────────────────────────── */

    OziAutocomplete.prototype._handleInput = function (text) {
        this._filterAndRender(text);
        this._openDropdown();
        if (!this.isRemoteEnabled()) return;
        if (this.remoteRequestTimer) { clearTimeout(this.remoteRequestTimer); this.remoteRequestTimer = null; }
        if (!text.length || text.length < this.zldMin) { this._abortRemote(); this._resetToInitialOptions(); return; }
        var self = this;
        this.remoteRequestTimer = setTimeout(function () { self._fetchRemote(text); }, this.zldDelay);
    };

    /* ─── BUSCA REMOTA ──────────────────────────── */

    OziAutocomplete.prototype._abortRemote = function () {
        if (this.remoteRequestTimer) { clearTimeout(this.remoteRequestTimer); this.remoteRequestTimer = null; }
        if (this.remoteAbortController) { this.remoteAbortController.abort(); this.remoteAbortController = null; }
    };

    OziAutocomplete.prototype._resetToInitialOptions = function () {
        this.options = this._cloneOptions(this.initialOptions);
        this._filterAndRender(this.$input.val() || '');
    };

    OziAutocomplete.prototype._setLoading = function (state) {
        this.isLoading = !!state;
        // [FIX-C] usa _classMap para consistência com o sistema de temas
        var clsLoading = this._classMap('loading', 'ozi-loading');
        this.$input.toggleClass('ozi-autocomplete-loading', this.isLoading);
        if (clsLoading) this.$input.toggleClass(clsLoading, this.isLoading);
        this._renderList();
    };

    OziAutocomplete.prototype._fetchRemote = function (query) {
        var self = this;
        this._abortRemote();
        this.remoteRequestSeq += 1;
        var reqId = this.remoteRequestSeq;
        this.remoteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        this._setLoading(true);

        var csrf    = $('meta[name="csrf-token"]').attr('content');
        var method  = this.zldMethod === 'GET' ? 'GET' : 'POST';
        var headers = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
        if (csrf) headers['X-CSRF-TOKEN'] = csrf;

        var url = this.zldUrl;
        var cfg = { method: method, headers: headers };
        if (this.remoteAbortController) cfg.signal = this.remoteAbortController.signal;

        if (method === 'GET') {
            url += (url.indexOf('?') >= 0 ? '&' : '?') + encodeURIComponent(this.zldParam) + '=' + encodeURIComponent(query);
        } else {
            var fd = new FormData();
            fd.append(this.zldParam, query);
            if (csrf && !fd.has('_token')) fd.append('_token', csrf);
            cfg.body = fd;
        }

        if (this.zldLog) console.log('[OZI:autocomplete] remote request', { key: this.key, url: url, query: query });

        return fetch(url, cfg)
            .then(function (res) { return res.json().then(function (j) { return { res: res, json: j }; }); })
            .then(function (r) {
                if (reqId !== self.remoteRequestSeq) return;
                var json = r.json;
                if (self.zldLog) console.log('[OZI:autocomplete] remote json', json);
                if (json && Array.isArray(json.actions)) {
                    var act = window.OZI && window.OZI.modules && window.OZI.modules.actions;
                    if (act && typeof act.run === 'function') act.run(json.actions);
                    else if (typeof window.zldActions === 'function') window.zldActions(json.actions);
                }
                if (!r.res.ok) return;
                var raw = Array.isArray(json) ? json : (json && Array.isArray(json.options) ? json.options : []);
                self.options = self._cloneOptions(self._normalizeOptions(raw));
                self._filterAndRender(String(self.$input.val() || '').trim());
            })
            .catch(function (err) {
                if (err && err.name === 'AbortError') return;
                if (self.zldLog) console.error('[OZI:autocomplete] remote error', err);
            })
            .finally(function () {
                if (reqId !== self.remoteRequestSeq) return;
                self._setLoading(false);
                self.remoteAbortController = null;
            });
    };

    /* ─── KEYDOWN ───────────────────────────────── */

    OziAutocomplete.prototype._handleKeydown = function (e) {
        if (!this.isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            this._filterAndRender(this.$input.val() || '');
            this._openDropdown();
            e.key === 'ArrowDown' ? this._highlightNext() : this._highlightPrev();
            return;
        }
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); this._highlightNext(); break;
            case 'ArrowUp':   e.preventDefault(); this._highlightPrev(); break;
            case 'Enter':
                if (!this.isOpen) return;
                e.preventDefault();
                if (this.highlightedIndex >= 0 && this.filteredOptions[this.highlightedIndex]) {
                    this._selectItem(this.filteredOptions[this.highlightedIndex]);
                } else {
                    this._syncInputToSelectionOrExactMatch();
                    this._closeDropdown();
                }
                break;
            case 'Escape': e.preventDefault(); this._abortRemote(); this._closeDropdown(); break;
            case 'Tab':    this._syncInputToSelectionOrExactMatch(); this._closeDropdown(); break;
        }
    };

    /* ─── FILTER / RENDER ───────────────────────── */

    OziAutocomplete.prototype._filterOptions = function (query) {
        var self = this, norm = this._normalize(query);
        if (!norm) return this.options.slice();
        return this.options.filter(function (o) {
            return self._normalize(o.label || '').indexOf(norm) !== -1 ||
                self._normalize(String(o.value || '')).indexOf(norm) !== -1;
        });
    };

    OziAutocomplete.prototype._filterAndRender = function (query) {
        this.filteredOptions  = this._filterOptions(query);
        this.highlightedIndex = -1;
        this._renderList();
    };

    OziAutocomplete.prototype._renderList = function () {
        var self = this;
        this.$list.empty();
        if (this.isLoading) {
            this.$list.append($('<div>', { class: 'ozi-autocomplete-empty ozi-autocomplete-loading-msg' }).text(this.msgSearch));
            return;
        }
        if (!this.filteredOptions.length) {
            this.$list.append($('<div>', { class: 'ozi-autocomplete-empty' }).text(this.msgEmpty));
            return;
        }
        this.filteredOptions.forEach(function (item, idx) {
            var isSel = self.selectedItem && String(self.selectedItem.value) === String(item.value);
            var $opt  = $('<button>', {
                type:           'button',
                class:          'ozi-autocomplete-option' + (isSel ? ' is-selected' : ''),
                'data-index':   idx
            }).text(item.label || item.value || '');
            if (item.subLabel) $opt.append($('<span>', { class: 'ozi-autocomplete-sublabel' }).text(item.subLabel));
            self.$list.append($opt);
        });
    };

    /* ─── OPEN / CLOSE / HIGHLIGHT ──────────────── */

    OziAutocomplete.prototype._openDropdown  = function () { if (this.isOpen) return; this.isOpen = true;  this.$dropdown.show(); };
    OziAutocomplete.prototype._closeDropdown = function () { if (!this.isOpen) return; this.isOpen = false; this.$dropdown.hide(); this._clearHighlight(); };
    OziAutocomplete.prototype._clearHighlight = function () {
        this.highlightedIndex = -1;
        this.$list.find('.ozi-autocomplete-option').removeClass('is-highlighted');
    };

    OziAutocomplete.prototype._highlightOption = function (idx) {
        var $opts = this.$list.find('.ozi-autocomplete-option');
        if (!$opts.length) { this.highlightedIndex = -1; return; }
        idx = Math.max(0, Math.min(idx, $opts.length - 1));
        this.highlightedIndex = idx;
        $opts.removeClass('is-highlighted');
        var $cur = $opts.eq(idx).addClass('is-highlighted');
        var lEl  = this.$dropdown[0], oEl = $cur[0];
        if (lEl && oEl) {
            var oT = oEl.offsetTop, oB = oT + oEl.offsetHeight;
            var lT = lEl.scrollTop, lB = lT + lEl.clientHeight;
            if (oT < lT) lEl.scrollTop = oT;
            else if (oB > lB) lEl.scrollTop = oB - lEl.clientHeight;
        }
    };

    OziAutocomplete.prototype._highlightNext = function () {
        if (!this.isOpen || !this.filteredOptions.length) return;
        this._highlightOption(this.highlightedIndex + 1);
    };
    OziAutocomplete.prototype._highlightPrev = function () {
        if (!this.isOpen || !this.filteredOptions.length) return;
        this._highlightOption(this.highlightedIndex <= 0 ? this.filteredOptions.length - 1 : this.highlightedIndex - 1);
    };

    /* ─── SELEÇÃO ───────────────────────────────── */

    OziAutocomplete.prototype._selectItem = function (item) {
        if (!item) return;
        this.selectedItem = item;
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.$input.val(item.label || '').removeClass(clsValid + ' ' + clsInvalid);
        this._syncHidden();
        this._filterAndRender(this.$input.val() || '');
        this._closeDropdown();
        this._clearInvalid();
        this._emit('ozi:change', { value: item.value, label: item.label, item: item });
    };

    OziAutocomplete.prototype._syncHidden = function () {
        if (this.$hidden) {
            this.$hidden.val(!this.selectedItem ? '' : String(this.selectedItem.value == null ? '' : this.selectedItem.value));
        }
    };

    OziAutocomplete.prototype._findByLabel = function (text) {
        var norm = this._normalize(text);
        if (!norm) return null;
        for (var i = 0; i < this.options.length; i++) {
            if (this._normalize(this.options[i].label || '') === norm) return this.options[i];
        }
        return null;
    };

    OziAutocomplete.prototype._syncInputToSelectionOrExactMatch = function () {
        var text = String(this.$input.val() || '').trim();
        if (!text) { this._clearSelection(false); return; }
        if (this.selectedItem && text === String(this.selectedItem.label || '')) { this._syncHidden(); return; }
        var exact = this._findByLabel(text);
        if (exact) {
            this.selectedItem = exact;
            this.$input.val(exact.label || '');
            this._syncHidden();
            this._emit('ozi:change', { value: exact.value, label: exact.label, item: exact });
            return;
        }
        this.selectedItem = null; this._syncHidden();
    };

    OziAutocomplete.prototype._syncInitialFromHidden = function () {
        var self = this;
        var hVal = String(this.$hidden ? this.$hidden.val() : '').trim();
        var iVal = String(this.$input.val() || '').trim();
        if (hVal) {
            var byV = this.options.filter(function (o) { return String(o.value) === hVal; })[0];
            if (byV) { this.selectedItem = byV; this.$input.val(byV.label || ''); this._syncHidden(); return; }
        }
        if (iVal) {
            var byL = this.options.filter(function (o) { return self._normalize(o.label || '') === self._normalize(iVal); })[0];
            if (byL) { this.selectedItem = byL; this.$input.val(byL.label || ''); this._syncHidden(); return; }
        }
        this.selectedItem = null; this._syncHidden();
    };

    OziAutocomplete.prototype._clearSelection = function (emitChange) {
        this.selectedItem = null;
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.$input.val('').removeClass(clsValid + ' ' + clsInvalid);
        this._syncHidden();
        this._filterAndRender('');
        if (emitChange !== false) this._emit('ozi:change', { value: null, label: null, item: null });
    };

    /* ─── VALIDAÇÃO ─────────────────────────────── */

    OziAutocomplete.prototype.isValid = function () { return !this.isRequired || !!this.selectedItem; };

    OziAutocomplete.prototype._markInvalid = function (msg) {
        this.$input.addClass(this._classMap('invalid', 'ozi-invalid'));
        if (this.$feedback) this.$feedback.text(msg || this.requiredMsg).show();
    };

    OziAutocomplete.prototype._clearInvalid = function () {
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.$input.removeClass(clsInvalid).removeClass(clsValid);
        if (this.$feedback) this.$feedback.hide();
    };

    OziAutocomplete.prototype.validate = function (focusOnError) {
        var valid = this.isValid();
        if (!valid) {
            this._markInvalid();
            if (focusOnError) this.$input.focus();
        } else {
            this._clearInvalid();
            // [FIX-B] fallback neutro OZI em vez de 'is-valid' (BS5)
            if (this.isRequired) this.$input.addClass(this._classMap('valid', 'ozi-valid'));
        }
        return valid;
    };

    OziAutocomplete.prototype.setState = function (state) {
        this._clearInvalid();
        if (state === 'invalid') this._markInvalid();
        if (state === 'valid')   this.$input.addClass(this._classMap('valid', 'ozi-valid'));
    };

    /* ─── EMIT ──────────────────────────────────── */

    OziAutocomplete.prototype._emit = function (eventName, payload) {
        this.$input.trigger(eventName, [payload, this]);
        if (typeof CustomEvent === 'function') {
            this.$input[0].dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: payload }));
        }
    };

    /* ─── I/O PÚBLICO ───────────────────────────── */

    OziAutocomplete.prototype.getValue  = function () { return this.selectedItem ? this.selectedItem.value : null; };
    OziAutocomplete.prototype.getItem   = function () { return this.selectedItem || null; };

    OziAutocomplete.prototype.setValue = function (value) {
        var found = this.options.filter(function (o) { return String(o.value) === String(value); })[0];
        if (!found) { this._clearSelection(false); return null; }
        this._selectItem(found); return found.value;
    };

    OziAutocomplete.prototype.setOptions = function (options) {
        this.options         = this._cloneOptions(this._normalizeOptions(Array.isArray(options) ? options : []));
        this.initialOptions  = this._cloneOptions(this.options);
        this.filteredOptions = this.options.slice();
        this._clearSelection(false);
    };

    OziAutocomplete.prototype.destroy = function () {
        this._abortRemote();
        if (this.$uniqueToast) { this.$uniqueToast.remove(); this.$uniqueToast = null; }
        $(document).off(this.ns);
        this.$input.off(this.ns);
        if (this.$dropdown && this.$dropdown.length) { this.$dropdown.off().remove(); }
        if (this.$hidden)   this.$hidden.remove();
        if (this.$feedback) this.$feedback.remove();
        if (this.$wrap && this.$wrap.length && this.$input.parent().is(this.$wrap)) this.$input.unwrap();
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.$input
            .removeClass('ozi-autocomplete-input ' + clsValid + ' ' + clsInvalid)
            .removeData('ozi-autocomplete-initialized');
        delete _instances[this.key];
    };

    OziAutocomplete.prototype.reload = function () {
        var el = this.$input[0]; this.destroy();
        var fresh = new OziAutocomplete(el); fresh.init();
        _instances[fresh.key] = fresh; return fresh;
    };

    /* ─── API ESTÁTICA ──────────────────────────── */

    function _resolve(k) {
        if (!k) return null;
        if (typeof k === 'string' && _instances[k]) return _instances[k];
        var el = k instanceof $ ? k[0] : k, key = el && $(el).attr('data-ozi-autocomplete');
        return key ? (_instances[key] || null) : null;
    }

    var autocompleteAPI = {
        init: function (root) {
            var $scope = root ? $(root) : $(document);
            $scope.find('[data-ozi-autocomplete]').addBack('[data-ozi-autocomplete]').each(function () {
                var $el = $(this), key = String($el.attr('data-ozi-autocomplete') || '').trim();
                if (!key) return;
                var ex = _instances[key];
                if (ex) {
                    var same = ex.$input && ex.$input[0] === this;
                    var inDom = ex.$input && document.contains(ex.$input[0]);
                    if (same && $el.data('ozi-autocomplete-initialized')) return;
                    if (!same && !inDom) ex.destroy();
                    else if (!same && inDom) return;
                }
                try {
                    _instances[key] = new OziAutocomplete(this);
                    _instances[key].init();
                } catch (e) {
                    console.warn('[OZI:autocomplete] erro "' + key + '":', e.message);
                }
            });
        },
        get:        function (k)       { return _resolve(k); },
        getAll:     function ()        { return Object.keys(_instances).map(function (k) { return _instances[k]; }); },
        destroy:    function (k)       { var i = _resolve(k); if (i) i.destroy(); },
        reload:     function (k)       { var i = _resolve(k); return i ? i.reload() : null; },
        value:      function (k, v)    { var i = _resolve(k); if (!i) return undefined; return v === undefined ? i.getValue() : i.setValue(v); },
        item:       function (k)       { var i = _resolve(k); return i ? i.getItem() : null; },
        clear:      function (k)       { var i = _resolve(k); if (i) i._clearSelection(); },
        setOptions: function (k, opts) { var i = _resolve(k); if (i) i.setOptions(opts); }
    };

    /* ─── BOOT ──────────────────────────────────── */

    function _registerAdapter() {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate || typeof validate.registerAdapter !== 'function') return;
        validate.registerAdapter({
            name:     'ozi-autocomplete',
            match:    function ($el) { return $el.is('[data-ozi-autocomplete]'); },
            isValid:  function ($el) { var i = _resolve($el[0]); return i ? i.isValid() : true; },
            getValue: function ($el) { var i = _resolve($el[0]); return i ? i.getValue() : null; },
            setState: function ($el, state) { var i = _resolve($el[0]); if (i) i.setState(state); }
        });
    }

    function _boot() {
        autocompleteAPI.init();
        _registerAdapter();
        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.autocomplete = autocompleteAPI;
        }
        if (OZI && OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:autocomplete', function (root) {
                autocompleteAPI.init(root);
            });
        }
    }

    window.OziAutocomplete = {
        init:    function (root) { autocompleteAPI.init(root); },
        get:     autocompleteAPI.get,
        value:   autocompleteAPI.value,
        item:    autocompleteAPI.item,
        clear:   autocompleteAPI.clear,
        destroy: autocompleteAPI.destroy,
        reload:  autocompleteAPI.reload
    };

    window.oziAutocompleteInitFetched = function (root) {
        console.warn('[OZI] oziAutocompleteInitFetched depreciado.');
        autocompleteAPI.init(root);
    };

    $(function () { _boot(); });

})(jQuery, window, document);