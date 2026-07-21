/**
 * ------------------------------------------
 * ozi-autocomplete
 * ------------------------------------------
 * Ver: 4.0.1
 * 2026-07-20
 *
 * Changelog:
 *   - v4.0.1: [V2-F5B] Fix: init() aceita Document/DocumentFragment.
 *       O OZI.hooks.afterRender chama init(root) com `document` (ozi-hooks.js
 *       converte root null -> document). Como document.nodeType === 9 (e nao 1),
 *       o argumento caia no ramo de seletor e estourava
 *       "DOMException: document.querySelector('[object HTMLDocument]')".
 *       Agora a resolucao e por tipo: string -> querySelector; no com
 *       querySelectorAll (Element/Document/Fragment) -> escopo direto; senao null.
 *   - v4.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Zero jQuery: DOM via document.createElement/querySelector/classList;
 *         "wrap" do input feito manualmente (insertBefore + appendChild) no
 *         lugar de $.wrap()/$.unwrap().
 *       - Delegacao de mousedown nas opcoes via addEventListener + closest()
 *         no dropdown; clique-fora via listener em document + contains().
 *       - Toast de violacao "unique" reimplementado com Web Animations API
 *         (Element.animate) no lugar de $.animate(); posicionamento via
 *         getBoundingClientRect() (mais correto que offset() do jQuery para
 *         um elemento position:fixed — offset() e relativo ao documento).
 *       - Fim do dual-dispatch: emit() usa somente OZI.helpers.emit() (mesmo
 *         shim generico do ozi-select cobre o formato posicional legado —
 *         integrations/adapters/ozi-change-v1-compat.shim.js).
 *       - emit() ganha `source` ('user'|'api'); setValue() (API programatica)
 *         emite source:'api'.
 *       - _registerAdapter() marca `nativeElement: true` no ozi-validate.
 *       - init idempotente via marker `el.__oziAutocompleteInitialized` (era
 *         $input.data('ozi-autocomplete-initialized')).
 *       - API publica inalterada: OZI.components.autocomplete.{init,get,
 *         getAll,destroy,reload,value,item,clear,setOptions}; window.OziAutocomplete
 *         mantido.
 *   - v3.0.3: [FIX-P1] Fallback 'invalid-feedback' (BS5) → 'ozi-feedback' em _buildUI.
 *   - v3.0.3: [FIX-A]  Classes 'is-valid'/'is-invalid' hardcoded em _validateUnique
 *     substituídas por _classMap('valid','ozi-valid') e _classMap('invalid','ozi-invalid').
 *   - v3.0.3: [FIX-B]  Fallback 'is-valid' em validate() → 'ozi-valid'.
 *   - v3.0.3: [FIX-C]  Classe 'is-loading' → _classMap('loading','ozi-loading')
 *     em _setLoading() para consistência com o sistema de temas.
 */

(function () {
    'use strict';

    var _instances       = {};
    var _instanceCounter = 0;

    /* ─── DOM helpers ────────────────────────────── */

    function _make(tag, attrs) {
        var el = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
            });
        }
        return el;
    }

    function _classListOp(el, classString, method) {
        if (!el || !classString) return;
        String(classString).trim().split(/\s+/).forEach(function (c) {
            if (c) el.classList[method](c);
        });
    }

    /* ─── CONSTRUCTOR ───────────────────────────── */

    function OziAutocomplete(element) {
        this.input = element;
        this.key   = String(this.input.getAttribute('data-ozi-autocomplete') || '').trim();
        if (!this.key) throw new Error('[OZI:autocomplete] data-ozi-autocomplete é obrigatório.');

        this.uid = 'ozi-autocomplete-' + (++_instanceCounter);

        this.hiddenName  = String(this.input.getAttribute('data-ozi-autocomplete-hidden-name') || this.key).trim();
        this.msgEmpty    = String(this.input.getAttribute('data-ozi-autocomplete-msg-empty')   || 'No results').trim();
        this.msgSearch   = String(this.input.getAttribute('data-ozi-autocomplete-msg-search')  || 'Searching...').trim();
        this.isRequired  = this._parseBoolAttr('data-ozi-autocomplete-required');
        this.requiredMsg = String(this.input.getAttribute('data-ozi-autocomplete-required-message') || 'Required field').trim();

        this.zldUrl    = String(this.input.getAttribute('data-ozi-autocomplete-zld-url')    || '').trim();
        this.zldMethod = String(this.input.getAttribute('data-ozi-autocomplete-zld-method') || 'POST').trim().toUpperCase();
        this.zldParam  = String(this.input.getAttribute('data-ozi-autocomplete-zld-param')  || 'search').trim();
        this.zldMin    = this._parseIntAttr('data-ozi-autocomplete-zld-min',   1);
        this.zldDelay  = this._parseIntAttr('data-ozi-autocomplete-zld-delay', 300);
        this.zldLog    = this._parseBoolAttr('data-ozi-autocomplete-zld-log');

        this.uniqueGroup   = String(this.input.getAttribute('data-ozi-autocomplete-unique') || '').trim();
        this.uniqueMessage = String(this.input.getAttribute('data-ozi-autocomplete-unique-message') || 'Value already selected').trim();
        this.uniqueToast   = null;

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

        this.wrap     = null;
        this.dropdown = null;
        this.list     = null;
        this.hidden   = null;
        this.feedback = null;

        this._onDocumentClick = null;
    }

    /* ─── HELPERS ───────────────────────────────── */

    OziAutocomplete.prototype._parseBoolAttr = function (a) {
        if (!this.input.hasAttribute(a)) return false;
        var r = this.input.getAttribute(a);
        if (r === null || r === '') return true;
        r = String(r).trim().toLowerCase();
        return !(r === 'false' || r === '0' || r === 'no' || r === 'off');
    };

    OziAutocomplete.prototype._parseIntAttr = function (a, fb) {
        if (!this.input.hasAttribute(a)) return fb;
        var n = parseInt(String(this.input.getAttribute(a) || '').trim(), 10);
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
        var raw = String(this.input.getAttribute('data-ozi-autocomplete-as') || '').trim();
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
        if (this.uniqueToast) { this.uniqueToast.remove(); this.uniqueToast = null; }

        var rect = this.input.getBoundingClientRect();
        var toast = _make('div', { class: 'ozi-autocomplete-unique-toast' });
        toast.textContent = this.uniqueMessage;
        toast.style.position = 'fixed';
        toast.style.top      = (rect.top + rect.height + 6) + 'px';
        toast.style.left     = rect.left + 'px';
        toast.style.zIndex   = '9999';
        toast.style.opacity  = '1';
        document.body.appendChild(toast);
        this.uniqueToast = toast;

        setTimeout(function () {
            var finish = function () {
                if (toast.parentNode) toast.remove();
                if (self.uniqueToast === toast) self.uniqueToast = null;
            };
            if (typeof toast.animate === 'function') {
                var anim = toast.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease' });
                anim.onfinish = finish;
            } else {
                toast.style.opacity = '0';
                finish();
            }
        }, 2500);
    };

    OziAutocomplete.prototype._validateUnique = function () {
        if (!this.uniqueGroup) return;
        var text = String(this.input.value || '').trim();

        // [FIX-A] usa _classMap em vez de classes BS5 hardcoded
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        _classListOp(this.input, clsValid,   'remove');
        _classListOp(this.input, clsInvalid, 'remove');

        if (!text) return;
        var match = this._findByLabel(text);
        if (match && this._isUniqueViolation(match.value)) {
            this.selectedItem = null;
            this.input.value = '';
            this._syncHidden();
            _classListOp(this.input, clsInvalid, 'add');
            this._showUniqueToast();
            this._emit('ozi:unique-invalid', { item: match, group: this.uniqueGroup });
            return;
        }
        if (match) _classListOp(this.input, clsValid, 'add');
    };

    /* ─── INIT ──────────────────────────────────── */

    OziAutocomplete.prototype.init = function () {
        if (this.input.__oziAutocompleteInitialized) return;
        this.input.__oziAutocompleteInitialized = true;

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

        var script = null;
        var sib = this.input.nextElementSibling;
        while (sib) {
            if (sib.matches(sel)) { script = sib; break; }
            sib = sib.nextElementSibling;
        }
        if (!script && this.input.parentElement) script = this.input.parentElement.querySelector(sel);
        if (!script) script = document.querySelector(sel);
        if (!script) return [];

        try {
            var p = JSON.parse((script.textContent || '').trim() || '[]');
            return Array.isArray(p) ? p : [];
        } catch (e) {
            console.error('[OZI:autocomplete] JSON inválido "' + key + '"', e);
            return [];
        }
    };

    /* ─── BUILD UI ──────────────────────────────── */

    OziAutocomplete.prototype._buildUI = function () {
        this.input.classList.add('ozi-autocomplete-input');
        if (!this.input.parentElement || !this.input.parentElement.classList.contains('ozi-autocomplete-wrap')) {
            var wrapper = _make('div', { class: 'ozi-autocomplete-wrap' });
            this.input.parentNode.insertBefore(wrapper, this.input);
            wrapper.appendChild(this.input);
        }
        this.wrap = this.input.parentElement;

        this.dropdown = _make('div', { class: 'ozi-autocomplete-dropdown' });
        this.dropdown.style.display = 'none';
        this.list = _make('div', { class: 'ozi-autocomplete-list' });
        this.dropdown.appendChild(this.list);
        this.wrap.appendChild(this.dropdown);

        this.hidden = _make('input', {
            type:                          'hidden',
            name:                          this.hiddenName,
            'data-ozi-autocomplete-hidden': this.key
        });
        this.wrap.appendChild(this.hidden);

        // [FIX-P1] fallback neutro OZI em vez de 'invalid-feedback' (BS5)
        var fbClass = this._classMap('feedback', 'ozi-feedback');
        this.feedback = _make('div', { class: fbClass + ' ozi-autocomplete-feedback' });
        this.feedback.style.display = 'none';
        this.wrap.appendChild(this.feedback);
    };

    /* ─── EVENTOS ───────────────────────────────── */

    OziAutocomplete.prototype._bindEvents = function () {
        var self = this;

        function onFocusOrClick() {
            self._filterAndRender(self.input.value || '');
            self._openDropdown();
        }
        this.input.addEventListener('focus', onFocusOrClick);
        this.input.addEventListener('click', onFocusOrClick);

        this.input.addEventListener('input', function () {
            var text = self.input.value || '';
            if (self.selectedItem && text !== String(self.selectedItem.label || '')) {
                self.selectedItem = null; self._syncHidden();
            }
            self._handleInput(text);
        });

        this.input.addEventListener('keydown', function (e) { self._handleKeydown(e); });

        this.input.addEventListener('blur', function () {
            setTimeout(function () {
                self._syncInputToSelectionOrExactMatch();
                self._validateUnique();
                self._closeDropdown();
            }, 120);
        });

        this.dropdown.addEventListener('mousedown', function (e) {
            var opt = e.target.closest('.ozi-autocomplete-option');
            if (!opt) return;
            e.preventDefault();
            var item = self.filteredOptions[Number(opt.getAttribute('data-index'))];
            if (item) self._selectItem(item);
        });

        this._onDocumentClick = function (e) {
            if (!self.wrap.contains(e.target)) {
                self._syncInputToSelectionOrExactMatch();
                self._closeDropdown();
            }
        };
        document.addEventListener('click', this._onDocumentClick);
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
        this._filterAndRender(this.input.value || '');
    };

    OziAutocomplete.prototype._setLoading = function (state) {
        this.isLoading = !!state;
        // [FIX-C] usa _classMap para consistência com o sistema de temas
        var clsLoading = this._classMap('loading', 'ozi-loading');
        this.input.classList.toggle('ozi-autocomplete-loading', this.isLoading);
        if (clsLoading) this.input.classList.toggle(clsLoading, this.isLoading);
        this._renderList();
    };

    OziAutocomplete.prototype._fetchRemote = function (query) {
        var self = this;
        this._abortRemote();
        this.remoteRequestSeq += 1;
        var reqId = this.remoteRequestSeq;
        this.remoteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        this._setLoading(true);

        var csrfMeta = document.querySelector('meta[name="csrf-token"]');
        var csrf     = csrfMeta ? csrfMeta.getAttribute('content') : null;
        var method   = this.zldMethod === 'GET' ? 'GET' : 'POST';
        var headers  = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
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
                self._filterAndRender(String(self.input.value || '').trim());
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
            this._filterAndRender(this.input.value || '');
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
        this.list.innerHTML = '';
        if (this.isLoading) {
            var loadingEl = _make('div', { class: 'ozi-autocomplete-empty ozi-autocomplete-loading-msg' });
            loadingEl.textContent = this.msgSearch;
            this.list.appendChild(loadingEl);
            return;
        }
        if (!this.filteredOptions.length) {
            var emptyEl = _make('div', { class: 'ozi-autocomplete-empty' });
            emptyEl.textContent = this.msgEmpty;
            this.list.appendChild(emptyEl);
            return;
        }
        this.filteredOptions.forEach(function (item, idx) {
            var isSel = self.selectedItem && String(self.selectedItem.value) === String(item.value);
            var opt = _make('button', {
                type:         'button',
                class:        'ozi-autocomplete-option' + (isSel ? ' is-selected' : ''),
                'data-index': idx
            });
            opt.textContent = item.label || item.value || '';
            if (item.subLabel) {
                var sub = _make('span', { class: 'ozi-autocomplete-sublabel' });
                sub.textContent = item.subLabel;
                opt.appendChild(sub);
            }
            self.list.appendChild(opt);
        });
    };

    /* ─── OPEN / CLOSE / HIGHLIGHT ──────────────── */

    OziAutocomplete.prototype._openDropdown  = function () { if (this.isOpen) return; this.isOpen = true;  this.dropdown.style.display = ''; };
    OziAutocomplete.prototype._closeDropdown = function () { if (!this.isOpen) return; this.isOpen = false; this.dropdown.style.display = 'none'; this._clearHighlight(); };
    OziAutocomplete.prototype._clearHighlight = function () {
        this.highlightedIndex = -1;
        Array.prototype.forEach.call(this.list.querySelectorAll('.ozi-autocomplete-option'), function (o) { o.classList.remove('is-highlighted'); });
    };

    OziAutocomplete.prototype._highlightOption = function (idx) {
        var opts = this.list.querySelectorAll('.ozi-autocomplete-option');
        if (!opts.length) { this.highlightedIndex = -1; return; }
        idx = Math.max(0, Math.min(idx, opts.length - 1));
        this.highlightedIndex = idx;
        Array.prototype.forEach.call(opts, function (o) { o.classList.remove('is-highlighted'); });
        var cur = opts[idx];
        cur.classList.add('is-highlighted');
        var lEl = this.dropdown, oEl = cur;
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
        this.input.value = item.label || '';
        _classListOp(this.input, clsValid,   'remove');
        _classListOp(this.input, clsInvalid, 'remove');
        this._syncHidden();
        this._filterAndRender(this.input.value || '');
        this._closeDropdown();
        this._clearInvalid();
        this._emit('ozi:change', { value: item.value, label: item.label, item: item });
    };

    OziAutocomplete.prototype._syncHidden = function () {
        if (this.hidden) {
            this.hidden.value = !this.selectedItem ? '' : String(this.selectedItem.value == null ? '' : this.selectedItem.value);
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
        var text = String(this.input.value || '').trim();
        if (!text) { this._clearSelection(false); return; }
        if (this.selectedItem && text === String(this.selectedItem.label || '')) { this._syncHidden(); return; }
        var exact = this._findByLabel(text);
        if (exact) {
            this.selectedItem = exact;
            this.input.value = exact.label || '';
            this._syncHidden();
            this._emit('ozi:change', { value: exact.value, label: exact.label, item: exact });
            return;
        }
        this.selectedItem = null; this._syncHidden();
    };

    OziAutocomplete.prototype._syncInitialFromHidden = function () {
        var self = this;
        var hVal = String(this.hidden ? this.hidden.value : '').trim();
        var iVal = String(this.input.value || '').trim();
        if (hVal) {
            var byV = this.options.filter(function (o) { return String(o.value) === hVal; })[0];
            if (byV) { this.selectedItem = byV; this.input.value = byV.label || ''; this._syncHidden(); return; }
        }
        if (iVal) {
            var byL = this.options.filter(function (o) { return self._normalize(o.label || '') === self._normalize(iVal); })[0];
            if (byL) { this.selectedItem = byL; this.input.value = byL.label || ''; this._syncHidden(); return; }
        }
        this.selectedItem = null; this._syncHidden();
    };

    OziAutocomplete.prototype._clearSelection = function (emitChange) {
        this.selectedItem = null;
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.input.value = '';
        _classListOp(this.input, clsValid,   'remove');
        _classListOp(this.input, clsInvalid, 'remove');
        this._syncHidden();
        this._filterAndRender('');
        if (emitChange !== false) this._emit('ozi:change', { value: null, label: null, item: null });
    };

    /* ─── VALIDAÇÃO ─────────────────────────────── */

    OziAutocomplete.prototype.isValid = function () { return !this.isRequired || !!this.selectedItem; };

    OziAutocomplete.prototype._markInvalid = function (msg) {
        _classListOp(this.input, this._classMap('invalid', 'ozi-invalid'), 'add');
        if (this.feedback) { this.feedback.textContent = msg || this.requiredMsg; this.feedback.style.display = ''; }
    };

    OziAutocomplete.prototype._clearInvalid = function () {
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        _classListOp(this.input, clsInvalid, 'remove');
        _classListOp(this.input, clsValid,   'remove');
        if (this.feedback) this.feedback.style.display = 'none';
    };

    OziAutocomplete.prototype.validate = function (focusOnError) {
        var valid = this.isValid();
        if (!valid) {
            this._markInvalid();
            if (focusOnError) this.input.focus();
        } else {
            this._clearInvalid();
            // [FIX-B] fallback neutro OZI em vez de 'is-valid' (BS5)
            if (this.isRequired) _classListOp(this.input, this._classMap('valid', 'ozi-valid'), 'add');
        }
        return valid;
    };

    OziAutocomplete.prototype.setState = function (state) {
        this._clearInvalid();
        if (state === 'invalid') this._markInvalid();
        if (state === 'valid')   _classListOp(this.input, this._classMap('valid', 'ozi-valid'), 'add');
    };

    /* ─── EMIT — contrato v2, sem dual-dispatch ─── */
    // O payload posicional jQuery legado e coberto pelo mesmo shim generico
    // do ozi-select: integrations/adapters/ozi-change-v1-compat.shim.js.

    OziAutocomplete.prototype._emit = function (eventName, payload) {
        payload = payload || {};
        var detail = {
            component: 'ozi-autocomplete',
            name:      this.key,
            value:     ('value' in payload) ? payload.value : this.getValue(),
            items:     payload.item ? [payload.item] : [],
            source:    payload.source || 'user'
        };
        if (payload.group != null) detail.group = payload.group;

        var helpers = window.OZI && window.OZI.helpers;
        if (helpers && typeof helpers.emit === 'function') {
            helpers.emit(this.input, eventName, detail);
        } else if (typeof CustomEvent === 'function') {
            this.input.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: detail }));
        }
    };

    /* ─── I/O PÚBLICO ───────────────────────────── */

    OziAutocomplete.prototype.getValue  = function () { return this.selectedItem ? this.selectedItem.value : null; };
    OziAutocomplete.prototype.getItem   = function () { return this.selectedItem || null; };

    OziAutocomplete.prototype.setValue = function (value) {
        var found = this.options.filter(function (o) { return String(o.value) === String(value); })[0];
        if (!found) { this._clearSelection(false); return null; }
        this.selectedItem = found;
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.input.value = found.label || '';
        _classListOp(this.input, clsValid,   'remove');
        _classListOp(this.input, clsInvalid, 'remove');
        this._syncHidden();
        this._filterAndRender(this.input.value || '');
        this._closeDropdown();
        this._clearInvalid();
        this._emit('ozi:change', { value: found.value, label: found.label, item: found, source: 'api' });
        return found.value;
    };

    OziAutocomplete.prototype.setOptions = function (options) {
        this.options         = this._cloneOptions(this._normalizeOptions(Array.isArray(options) ? options : []));
        this.initialOptions  = this._cloneOptions(this.options);
        this.filteredOptions = this.options.slice();
        this._clearSelection(false);
    };

    OziAutocomplete.prototype.destroy = function () {
        this._abortRemote();
        if (this.uniqueToast) { this.uniqueToast.remove(); this.uniqueToast = null; }
        if (this._onDocumentClick) document.removeEventListener('click', this._onDocumentClick);
        if (this.dropdown) this.dropdown.remove();
        if (this.hidden)   this.hidden.remove();
        if (this.feedback) this.feedback.remove();
        if (this.wrap && this.input.parentElement === this.wrap) {
            this.wrap.parentNode.insertBefore(this.input, this.wrap);
            this.wrap.remove();
        }
        var clsValid   = this._classMap('valid',   'ozi-valid');
        var clsInvalid = this._classMap('invalid', 'ozi-invalid');
        this.input.classList.remove('ozi-autocomplete-input');
        _classListOp(this.input, clsValid,   'remove');
        _classListOp(this.input, clsInvalid, 'remove');
        delete this.input.__oziAutocompleteInitialized;
        delete _instances[this.key];
    };

    OziAutocomplete.prototype.reload = function () {
        var el = this.input; this.destroy();
        var fresh = new OziAutocomplete(el); fresh.init();
        _instances[fresh.key] = fresh; return fresh;
    };

    /* ─── API ESTÁTICA ──────────────────────────── */

    function _resolve(k) {
        if (!k) return null;
        if (typeof k === 'string') {
            if (_instances[k]) return _instances[k];
            var found = document.querySelector(k);
            if (!found) return null;
            var fkey = found.getAttribute('data-ozi-autocomplete');
            return fkey ? (_instances[fkey] || null) : null;
        }
        var el = (k.nodeType === 1) ? k : null;
        if (!el) return null;
        var key = el.getAttribute('data-ozi-autocomplete');
        return key ? (_instances[key] || null) : null;
    }

    var autocompleteAPI = {
        init: function (root) {
            var scope = !root ? document
                      : (typeof root === 'string' ? document.querySelector(root)
                        : (root.querySelectorAll ? root : null));
            if (!scope) return;

            var targets = (scope.nodeType === 1 && scope.matches && scope.matches('[data-ozi-autocomplete]')) ? [scope] : [];
            targets = targets.concat(Array.prototype.slice.call(scope.querySelectorAll('[data-ozi-autocomplete]')));

            targets.forEach(function (el) {
                var key = String(el.getAttribute('data-ozi-autocomplete') || '').trim();
                if (!key) return;

                var ex = _instances[key];
                if (ex) {
                    var same  = ex.input === el;
                    var inDom = ex.input && document.contains(ex.input);
                    if (same && el.__oziAutocompleteInitialized) return;
                    if (!same && !inDom) ex.destroy();
                    else if (!same && inDom) return;
                }

                try {
                    _instances[key] = new OziAutocomplete(el);
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
            name:          'ozi-autocomplete',
            nativeElement: true, // v2 — recebe Element puro, sem envelopar em jQuery
            match:    function (el) { return el.hasAttribute('data-ozi-autocomplete'); },
            isValid:  function (el) { var i = _resolve(el); return i ? i.isValid() : true; },
            getValue: function (el) { var i = _resolve(el); return i ? i.getValue() : null; },
            setState: function (el, state) { var i = _resolve(el); if (i) i.setState(state); }
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})();
