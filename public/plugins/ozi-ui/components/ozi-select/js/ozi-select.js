/**
 * ------------------------------------------
 * ozi-select
 * ------------------------------------------
 * Ver: 6.2.0
 * 2026-08-20
 *
 * Changelog:
 *   - v6.2.0: [FEAT] Rodapé de ação no dropdown (`data-ozi-select-footer`). Um botão
 *       persistente no pé do dropdown (ex.: "Gerenciar contas de e-mail"), fora da lista de
 *       opções — sobrevive à busca, é pulado pela navegação por seta, e NÃO é valor p/ o
 *       ozi-validate. Dois modos de autoria:
 *         • SLOT: <template data-ozi-select-footer="<key>"> declarado FORA do root (o root é
 *           limpo por innerHTML='' no buildUI/destroy); o conteúdo do template é movido p/ o
 *           rodapé. O host coloca a ação no próprio markup (wire:click/wire:ignore/@click);
 *           o componente só reposiciona e fecha o dropdown no clique.
 *         • DECLARATIVO: `data-ozi-select-footer-label` (+ `-footer-icon`) gera o botão.
 *       Em ambos os modos o clique FECHA o dropdown e emite `ozi:select-footer` (contrato v2,
 *       source:'user') — SEM preventDefault/stopPropagation (senão mataria o wire:click do
 *       host). A ação declarativa é amarrada pelo host (x-on:ozi:select-footer) ou pelo
 *       adapter Livewire via `data-ozi-select-footer-call` (component.call). O componente
 *       nunca conhece framework (R6). Aditivo → MINOR (pacote 2.2.0).
 *   - v6.1.0: [DEBUG] Flag local `data-ozi-select-log` (convenção `data-ozi-{plugin}-log`,
 *       espelha o zldLog do ozi-loaddata): método _dbg loga init()/destroy() deste widget
 *       com prefixo [OZI:select#<uid>]; destroy() sai com console.trace p/ apontar quem
 *       chamou. Zero custo/ruído quando ausente/false; por instância. Atributo novo →
 *       no pacote entra numa MINOR (entra junto do rodapé na 2.2.0).
 *   - v6.0.1: [V2-F5B] Fix: init()/get() aceitam Document/DocumentFragment.
 *       O OZI.hooks.afterRender chama init(root) com `document` (ozi-hooks.js
 *       converte root null -> document). Como document.nodeType === 9 (e nao 1),
 *       o argumento caia no ramo de seletor e estourava
 *       "DOMException: document.querySelector('[object HTMLDocument]')".
 *       Agora a resolucao e por tipo: string -> querySelector; no com
 *       querySelectorAll (Element/Document/Fragment) -> escopo direto; senao null.
 *       get() retorna null p/ nao-Element (precisa de getAttribute).
 *   - v6.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Zero jQuery: DOM via document.createElement/querySelector/classList;
 *         Element.after()/before() nativos no lugar de .after()/.before() jQuery.
 *       - Delegacao de eventos nativa (addEventListener + closest()) no lugar de
 *         $ui.on(evento, seletor, fn); um unico listener de click por instancia,
 *         checagem em ordem do mais especifico (clear/toggle/tag-remove/option/
 *         group-label) para o mais geral (control) — substitui o guard manual
 *         que a v1 fazia dentro do handler do control.
 *       - ':visible' do jQuery substituido por isVisible() (offsetWidth/Height/
 *         getClientRects), mesma heuristica usada no ozi-toggle.
 *       - Fim do dual-dispatch: emit() usa somente OZI.helpers.emit() (CustomEvent
 *         nativo, bubbles+detail no contrato). O payload posicional jQuery
 *         '(event, items)' que 2 arquivos do Central RH ainda consomem
 *         (candidate-list.blade.php:754, profile/edit.blade.php:388) passa a
 *         ser responsabilidade de um shim em integrations/ (nunca do
 *         componente) — ver integrations/adapters/ozi-change-v1-compat.shim.js.
 *       - emit()/emitChange() ganham parametro `source` ('user'|'api') —
 *         setValue() (API programatica) emite com source:'api'; interacoes
 *         do usuario continuam 'user'. Novo no contrato v2 (nao existia payload
 *         posicional equivalente na v1).
 *       - _registerAdapter() marca `nativeElement: true` no ozi-validate —
 *         adapter agora recebe Element nativo (antes: jQuery $el/$el[0]).
 *         selectAPI.get() passa a aceitar Element nativo alem de string/seletor.
 *       - init idempotente via marker `el.__oziSelectInitialized` (era
 *         $root.data('ozi-select-initialized') — cache interno do jQuery).
 *       - API publica inalterada: OZI.components.select.{init,observe,get,
 *         getAll,destroy,reload,value,items,clear,open,close,disable,enable,
 *         required,setOptions}; window.OziSelect mantido.
 *   - v5.0.2: [FIX-C] Container de hidden marcado com [data-ozi-component-hidden].
 *     Permite que o coletor do ozi-validate (v1.0.3+) preserve o valor da selecao
 *     em forms ZLD (que antes descartavam todo [type="hidden"]). Sem isso, o valor
 *     do select nao chegava ao backend via catch-group.
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

(function () {
    'use strict';

    var instances       = {};
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

    /* ─── helpers de DOM nativo ─────────────────────────────────────── */

    // equivalente a $('<tag>', { attrs }) — so atributos HTML, sem 'css'/'text'/'html'
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

    // heuristica equivalente ao jQuery :visible
    function _isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
    }

    /* ─── construtor ───────────────────────────────────────────────── */

    function OziSelect(element) {
        this.root = element;
        this.key  = String(this.root.getAttribute('data-ozi-select') || '').trim();
        if (!this.key) throw new Error('[OZI:select] data-ozi-select é obrigatório.');

        this.uid = 'ozi-select-' + (++instanceCounter);

        this.isMultiple      = this.parseBooleanAttr('data-ozi-select-multiple');
        this.isMultipleGroup = this.parseBooleanAttr('data-ozi-select-multiple-group');

        if (this.isMultipleGroup)  { this.mode = 'multiple'; this.groupToggleEnabled = true; }
        else if (this.isMultiple)  { this.mode = 'multiple'; this.groupToggleEnabled = false; }
        else                       { this.mode = 'single';   this.groupToggleEnabled = false; }

        this.submitName        = String(this.root.dataset.oziSelectSubmitName || this.key).trim();
        this.valuePlaceholder  = String(this.root.dataset.oziSelectValuePlaceholder || _t('select.valuePlaceholder', 'Selecione...'));
        this.searchPlaceholder = String(this.root.dataset.oziSelectSearchPlaceholder || _t('select.searchPlaceholder', 'Pesquisar...'));
        this.listHeight        = String(this.root.dataset.oziSelectList || '').trim();
        this.imageDimension    = String(this.root.dataset.oziSelectImageDimension || '').trim();
        this.valueIcon         = String(this.root.dataset.oziSelectValueIcon || '').trim();
        this.searchIcon        = String(this.root.dataset.oziSelectSearchIcon || '').trim();

        // rodapé de ação (v6.2.0) — slot (<template data-ozi-select-footer="<key>">) ou
        // botão gerado por label. O slot vive FORA do root (o buildUI/destroy limpam o root).
        this.footerLabel = String(this.root.dataset.oziSelectFooterLabel || '').trim();
        this.footerIcon  = String(this.root.dataset.oziSelectFooterIcon  || '').trim();
        this.footer      = null;   // região do rodapé no dropdown
        this.footerSlot  = null;   // <template> de origem (modo slot)

        this.hasSubmitFieldsConfig = this.root.hasAttribute('data-ozi-select-submit-fields');
        this.submitFieldsRaw       = String(this.root.getAttribute('data-ozi-select-submit-fields') || '');

        this.isDisabledConfig = this.parseBooleanAttr('data-ozi-select-disabled');
        this.isRequiredConfig = this.parseBooleanAttr('data-ozi-select-required');
        // debug local por instância (convenção `data-ozi-{plugin}-log`, espelha o zldLog do ozi-loaddata)
        this.debug            = this.parseBooleanAttr('data-ozi-select-log');
        this.requiredMessage  = String(this.root.getAttribute('data-ozi-select-required-message') || _t('select.requiredMessage', 'Selecione uma opção.'));

        this.zldUrl      = String(this.root.dataset.oziSelectZldUrl      || '').trim();
        this.zldMethod   = String(this.root.dataset.oziSelectZldMethod   || 'POST').trim().toUpperCase();
        this.zldParam    = String(this.root.dataset.oziSelectZldParam    || 'search').trim();
        this.zldItemName = String(this.root.dataset.oziSelectZldItemName || '').trim();
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

        this.form            = null;
        this.ui              = null;
        this.control         = null;
        this.valueEl         = null;
        this.clearBtn        = null;
        this.toggleBtn       = null;
        this.dropdown        = null;
        this.search          = null;
        this.list            = null;
        this.hiddenContainer = null;
        this.feedback        = null;

        this._onDocumentClick = null;
        this._onFormSubmit    = null;
        this._onFormReset     = null;

        this.init();
    }

    /* ─── helpers de atributo ──────────────────────────────────────── */

    OziSelect.prototype.parseBooleanAttr = function (attrName) {
        if (!this.root.hasAttribute(attrName)) return false;
        var raw = this.root.getAttribute(attrName);
        if (raw === null || raw === '') return true;
        raw = String(raw).trim().toLowerCase();
        return !(raw === 'false' || raw === '0' || raw === 'no' || raw === 'off');
    };

    OziSelect.prototype.parseIntegerAttr = function (attrName, fallback) {
        if (!this.root.hasAttribute(attrName)) return fallback;
        var parsed = parseInt(String(this.root.getAttribute(attrName) || '').trim(), 10);
        return isNaN(parsed) ? fallback : parsed;
    };

    // Log de debug local (só quando `data-ozi-select-log` está ligado neste widget).
    // `trace:true` usa console.trace p/ capturar QUEM chamou (ex.: destroy vindo do host).
    OziSelect.prototype._dbg = function (msg, data, trace) {
        if (!this.debug) return;
        var prefix = '[OZI:select#' + this.uid + ']';
        var fn = trace ? console.trace : console.log;
        if (data !== undefined) fn.call(console, prefix, msg, data);
        else                    fn.call(console, prefix, msg);
    };

    /* ─── alias map ────────────────────────────────────────────────── */

    OziSelect.prototype.parseAliasMap = function () {
        var raw = String(this.root.getAttribute('data-ozi-select-as') || '').trim();
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
        if (this.root.__oziSelectInitialized) return;
        this.root.__oziSelectInitialized = true;

        this._dbg('init() key=' + this.key + ' mode=' + this.mode);
        this.parseImageDimension();

        this.submitMode = this.normalizeSubmitMode(
            this.root.getAttribute('data-ozi-select-submit-mode') ||
            (this.hasSubmitFieldsConfig ? 'legacy' : 'value-label')
        );

        this.submitExtraFields = this.parseSubmitExtraFields(this.root.getAttribute('data-ozi-select-submit-extra') || '');
        this.submitFields      = this.hasSubmitFieldsConfig ? this.parseSubmitFields(this.submitFieldsRaw) : [];
        this.aliasMap          = this.parseAliasMap();
        this.options           = this.normalizeOptions(this.loadOptions());
        this.initialOptions    = this.cloneOptions(this.options);

        this.hiddenContainer = this.resolveHiddenContainer();
        this.form            = this.root.closest('form');

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

        var script = null;
        var sib = this.root.nextElementSibling;
        while (sib) {
            if (sib.matches(selector)) { script = sib; break; }
            sib = sib.nextElementSibling;
        }
        if (!script && this.root.parentElement) script = this.root.parentElement.querySelector(selector);
        if (!script) script = document.querySelector(selector);
        if (!script) return [];

        try {
            var parsed = JSON.parse((script.textContent || '').trim() || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('[OZI:select] Erro ao parsear opções do select "' + key + '":', e.message);
            return [];
        }
    };

    OziSelect.prototype.ensureOptionsScript = function () {
        var selector = 'script[data-ozi-select-options="' + this.key + '"]';
        var script   = document.querySelector(selector);
        if (!script) {
            script = document.createElement('script');
            script.type = 'application/json';
            script.setAttribute('data-ozi-select-options', this.key);
            this.root.after(script);
        }
        return script;
    };

    OziSelect.prototype.writeOptionsScript = function (options) {
        this.ensureOptionsScript().textContent = JSON.stringify(Array.isArray(options) ? options : [], null, 2);
    };

    OziSelect.prototype.resolveHiddenContainer = function () {
        var c = _make('div', {
            id: this.uid + '-hidden',
            class: 'ozi-select-hidden-container',
            'data-ozi-select-generated-hidden': this.key,
            // marcador generico: sinaliza ao coletor (ozi-validate) que os hidden
            // aqui dentro carregam valor real e nao devem ser descartados
            'data-ozi-component-hidden': this.key,
            'aria-hidden': 'true'
        });
        this.root.after(c);
        return c;
    };

    /* ─── build UI ─────────────────────────────────────────────────── */

    OziSelect.prototype.buildUI = function () {
        var listId = this.uid + '-list';
        this.root.innerHTML = '';
        this.root.classList.add('ozi-select-root');

        this.ui = _make('div', { class: 'ozi-select-ui ozi-select-ui-v400' });

        this.control = _make('div', {
            class:            'ozi-select-control',
            tabindex:         this.isDisabled() ? '-1' : '0',
            role:             'combobox',
            'aria-haspopup': 'listbox',
            'aria-expanded': 'false',
            'aria-controls':  listId,
            'aria-invalid':  'false'
        });

        this.valueEl = _make('div', { class: 'ozi-select-value' });
        var actions  = _make('div', { class: 'ozi-select-actions' });
        this.clearBtn  = _make('button', { type: 'button', class: 'ozi-select-clear',  'aria-label': 'Limpar seleção' });
        this.clearBtn.innerHTML = '&times;';
        this.toggleBtn = _make('button', { type: 'button', class: 'ozi-select-toggle', 'aria-label': 'Abrir opções' });
        this.toggleBtn.innerHTML = '&#9662;';
        actions.appendChild(this.clearBtn);
        actions.appendChild(this.toggleBtn);

        if (this.valueIcon) {
            var valueIconWrap = _make('span', { class: 'ozi-select-value-icon', 'aria-hidden': 'true' });
            valueIconWrap.appendChild(_make('i', { class: this.valueIcon }));
            this.control.appendChild(valueIconWrap);
        }
        this.control.appendChild(this.valueEl);
        this.control.appendChild(actions);

        this.dropdown = _make('div', { class: 'ozi-select-dropdown' });
        var searchWrap = _make('div', { class: 'ozi-select-search-wrap' });
        this.search = _make('input', {
            type:         'text',
            class:        'ozi-select-search',
            name:         this.key + '_select_search',
            placeholder:  this.searchPlaceholder,
            autocomplete: 'off'
        });

        if (this.searchIcon) {
            var searchIconWrap = _make('span', { class: 'ozi-select-search-icon', 'aria-hidden': 'true' });
            searchIconWrap.appendChild(_make('i', { class: this.searchIcon }));
            searchWrap.appendChild(searchIconWrap);
        }
        searchWrap.appendChild(this.search);

        this.list = _make('div', { class: 'ozi-select-list', id: listId, role: 'listbox' });
        if (this.listHeight) this.list.style.maxHeight = this.listHeight;

        // [FIX-A] fallback neutro OZI em vez de 'invalid-feedback' (BS5)
        var feedbackClass = _classMap('feedback', 'ozi-feedback');
        this.feedback = _make('div', { class: feedbackClass + ' ozi-select-feedback' });
        this.feedback.textContent = this.requiredMessage;

        this.dropdown.appendChild(searchWrap);
        this.dropdown.appendChild(this.list);
        this.buildFooter();   // rodapé de ação (v6.2.0) — 3º filho, fora da lista
        this.ui.appendChild(this.control);
        this.ui.appendChild(this.dropdown);
        this.root.appendChild(this.ui);
        this.root.appendChild(this.feedback);
    };

    /* ─── rodapé de ação (v6.2.0) ──────────────────────────────────── */
    // Fica em .ozi-select-dropdown DEPOIS de .ozi-select-list — fora do listbox, então
    // renderOptions() não o toca (sobrevive à busca) e a navegação por seta o ignora.
    OziSelect.prototype.buildFooter = function () {
        this.footerSlot = document.querySelector('template[data-ozi-select-footer="' + this.key + '"]');
        if (!this.footerSlot && !this.footerLabel) return;   // sem rodapé configurado

        this.footer = _make('div', { class: 'ozi-select-footer' });

        if (this.footerSlot) {
            // modo SLOT: move o conteúdo (nós reais) do <template> p/ o rodapé. Conteúdo de
            // <template> é inerte; ao entrar no DOM vivo o wire:click do host passa a valer
            // (o Livewire delega o clique no document). O <template> fica FORA do root, então
            // sobrevive ao root.innerHTML='' — no destroy devolvemos o conteúdo p/ ele.
            this.footer.appendChild(this.footerSlot.content);
        } else {
            // modo DECLARATIVO: botão gerado a partir de label + ícone opcional.
            var btn = _make('button', { type: 'button', class: 'ozi-select-footer-btn' });
            if (this.footerIcon) {
                var ic = _make('span', { class: 'ozi-select-footer-icon', 'aria-hidden': 'true' });
                ic.appendChild(_make('i', { class: this.footerIcon }));
                btn.appendChild(ic);
            }
            btn.appendChild(document.createTextNode(this.footerLabel));
            this.footer.appendChild(btn);
        }

        this.dropdown.appendChild(this.footer);
    };

    OziSelect.prototype.applyStateStyles = function () {
        var disabled = this.isDisabled();
        this.control.classList.toggle('is-disabled', disabled);
        this.control.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        this.control.setAttribute('tabindex', disabled ? '-1' : '0');
        this.search.disabled    = disabled;
        this.clearBtn.disabled  = disabled;
        this.toggleBtn.disabled = disabled;
        if (disabled) { this.clearInvalid(); this.close(); }
    };

    /* ─── eventos ──────────────────────────────────────────────────── */

    OziSelect.prototype.bindEvents = function () {
        var self = this;

        this.ui.addEventListener('click', function (e) {
            var target = e.target;
            var match;

            match = target.closest('.ozi-select-group-label[data-ozi-group-toggle]');
            if (match) {
                e.preventDefault(); e.stopPropagation();
                if (!self.isDisabled() && self.mode === 'multiple') {
                    self.toggleGroup(match.getAttribute('data-ozi-group-toggle'), true);
                }
                return;
            }

            match = target.closest('.ozi-select-toggle');
            if (match) {
                e.preventDefault(); e.stopPropagation();
                if (!self.isDisabled()) self.toggle();
                return;
            }

            match = target.closest('.ozi-select-clear');
            if (match) {
                e.preventDefault(); e.stopPropagation();
                if (!self.isDisabled()) self.clearSelection();
                return;
            }

            match = target.closest('.ozi-select-tag-remove');
            if (match) {
                e.preventDefault(); e.stopPropagation();
                if (!self.isDisabled()) self.unselectItem(match.getAttribute('data-value'));
                return;
            }

            match = target.closest('.ozi-select-option');
            if (match) {
                e.preventDefault();
                if (self.isDisabled()) return;
                var item = self.findOptionByValue(match.getAttribute('data-value'));
                if (item) self.toggleItem(item);
                return;
            }

            // rodapé de ação (v6.2.0): fecha o dropdown e emite ozi:select-footer.
            // NÃO preventDefault / NÃO stopPropagation — deixa o wire:click/@click do host
            // (modo slot) e o adapter Livewire (data-ozi-select-footer-call) dispararem.
            match = target.closest('.ozi-select-footer');
            if (match) {
                self.close(true);
                self.emit('ozi:select-footer', 'user');
                return;
            }

            // catch-all: clique no control (fora dos alvos especificos acima)
            if (target.closest('.ozi-select-control')) {
                if (self.isDisabled()) return;
                self.toggle();
            }
        });

        this.search.addEventListener('input', function () {
            if (self.isDisabled()) return;
            self.handleSearchInput(self.search.value || '');
        });

        function onKeydown(e) {
            if (self.isDisabled()) return;
            self.handleKeydown(e);
        }
        this.control.addEventListener('keydown', onKeydown);
        this.search.addEventListener('keydown', onKeydown);

        this._onDocumentClick = function (e) {
            if (!self.ui.contains(e.target)) self.close();
        };
        document.addEventListener('click', this._onDocumentClick);
    };

    OziSelect.prototype.bindFormEvents = function () {
        var self = this;
        if (!this.form) return;

        this._onFormSubmit = function (e) {
            if (!self.validate()) {
                e.preventDefault();
                // [FIX-A] fallback neutro OZI em vez de 'was-validated' (BS5)
                _classListOp(self.form, _classMap('formValidated', 'ozi-validated'), 'add');
            }
        };
        this._onFormReset = function () {
            setTimeout(function () { self.resetToInitial(); }, 0);
        };

        this.form.addEventListener('submit', this._onFormSubmit);
        this.form.addEventListener('reset',  this._onFormReset);
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
                var h = this.getHighlightedOption();
                if (h) { var item = this.findOptionByValue(h.getAttribute('data-value')); if (item) this.toggleItem(item); }
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
        this.ui.classList.add('is-open');
        this.control.setAttribute('aria-expanded', 'true');
        this.renderOptions(this.search.value || '');
        this.syncHighlightAfterRender(!!preferLast);
        this.search.focus();
        this.emit('ozi:open');
    };

    OziSelect.prototype.close = function (focusControl) {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.ui.classList.remove('is-open');
        this.control.setAttribute('aria-expanded', 'false');
        this.search.value = '';
        this.lastSearchQuery = '';
        this.renderOptions('');
        Array.prototype.forEach.call(this.list.querySelectorAll('.ozi-select-option'), function (o) { o.classList.remove('is-highlighted'); });
        if (focusControl && !this.isDisabled()) this.control.focus();
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
        this.renderOptions(this.search.value || '');
        this.syncHighlightAfterRender(false); this.clearInvalid(); this.emitChange();
    };

    OziSelect.prototype.unselectItem = function (value) {
        var before = this.selectedItems.length;
        this.selectedItems = this.selectedItems.filter(function (item) { return String(item.value) !== String(value); });
        if (this.selectedItems.length !== before) {
            this.syncHiddenInputs(); this.updateUI();
            this.renderOptions(this.search.value || '');
            this.syncHighlightAfterRender(false); this.validate(false); this.emitChange();
        }
    };

    OziSelect.prototype.clearSelection = function () {
        if (this.isDisabled() || !this.selectedItems.length) return;
        this.selectedItems = [];
        this.syncHiddenInputs(); this.updateUI();
        this.renderOptions(this.search.value || '');
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
        var input = _make('input', { type: 'hidden', name: name, value: value == null ? '' : String(value) });
        input.disabled = this.isDisabled();
        this.hiddenContainer.appendChild(input);
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
        this.hiddenContainer.innerHTML = '';
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
    OziSelect.prototype.renderOptionalHtml = function (el, html) { if (!html) return false; el.innerHTML = String(html); return true; };

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
        var group = _make('div', { class: 'ozi-select-group', 'data-ozi-group': block.group });
        var label = _make('div', {
            class: 'ozi-select-group-label' + (groupSelected ? ' is-group-selected' : '') + (groupPartial ? ' is-group-partial' : ''),
            role: 'presentation'
        });
        label.textContent = block.group;
        if (this.groupToggleEnabled && this.mode === 'multiple' && !this.isDisabled()) label.setAttribute('data-ozi-group-toggle', block.group);
        group.appendChild(label);
        var self = this; block.options.forEach(function (item) { group.appendChild(self.buildOption(item)); });
        return group;
    };

    OziSelect.prototype.getGroupVisibleOptions = function (groupName) {
        var g = this.list.querySelector('.ozi-select-group[data-ozi-group="' + String(groupName).replace(/"/g, '\\"') + '"]');
        if (!g) return [];
        return Array.prototype.filter.call(g.querySelectorAll('.ozi-select-option'), _isVisible);
    };

    OziSelect.prototype.getItemsByGroup = function (groupName, onlyVisible) {
        var group  = String(groupName || '');
        var values = onlyVisible ? this.getGroupVisibleOptions(group).map(function (o) { return String(o.getAttribute('data-value')); }) : null;
        return this.options.filter(function (item) {
            var same = String(item.group || '') === group;
            if (!same) return false;
            if (!onlyVisible) return true;
            return values.indexOf(String(item.value)) !== -1;
        });
    };

    OziSelect.prototype.isGroupFullySelected     = function (groupName, onlyVisible) { var items = this.getItemsByGroup(groupName, onlyVisible); if (!items.length) return false; var self = this; return items.every(function (item) { return self.isSelected(item.value); }); };
    OziSelect.prototype.isGroupPartiallySelected = function (groupName, onlyVisible) { var items = this.getItemsByGroup(groupName, onlyVisible); if (!items.length) return false; var self = this; var count = items.filter(function (item) { return self.isSelected(item.value); }).length; return count > 0 && count < items.length; };

    OziSelect.prototype.toggleGroup = function (groupName, onlyVisible) {
        if (this.isDisabled() || this.mode !== 'multiple' || !this.groupToggleEnabled) return;
        var items = this.getItemsByGroup(groupName, onlyVisible); if (!items.length) return;
        var shouldSelectAll = !this.isGroupFullySelected(groupName, onlyVisible); var self = this;
        if (shouldSelectAll) { items.forEach(function (item) { if (!self.isSelected(item.value)) self.selectedItems.push(item); }); }
        else { var toRemove = items.map(function (item) { return String(item.value); }); this.selectedItems = this.selectedItems.filter(function (s) { return toRemove.indexOf(String(s.value)) === -1; }); }
        this.syncHiddenInputs(); this.updateUI();
        this.renderOptions(this.search.value || '');
        this.syncHighlightAfterRender(false); this.validate(false); this.emitChange();
    };

    OziSelect.prototype.renderOptions = function (query) {
        var self = this; var normalizedQuery = this.normalize(query || '');
        this.list.innerHTML = '';
        var filtered = this.options.filter(function (item) {
            if (!normalizedQuery) return true;
            return self.normalize(self.flattenSearchText(item)).indexOf(normalizedQuery) !== -1;
        });
        if (!filtered.length) {
            var msg = this.ui.classList.contains('is-loading')
                ? _t('common.loading', 'Carregando...')
                : _t('select.empty', 'Nenhum resultado encontrado');
            var empty = _make('div', { class: 'ozi-select-empty' });
            empty.textContent = msg;
            this.list.appendChild(empty);
            return;
        }
        var blocks = this.buildRenderBlocks(filtered);
        blocks.forEach(function (block) {
            if (block.type === 'option') { self.list.appendChild(self.buildOption(block.item)); return; }
            if (block.type === 'group')  { self.list.appendChild(self.renderGroupBlock(block)); }
        });
    };

    OziSelect.prototype.buildOption = function (item) {
        var selected = this.isSelected(item.value);
        var option = _make('div', {
            class:         'ozi-select-option' + (selected ? ' is-selected' : ''),
            'data-value':  item.value,
            role:          'option',
            'aria-selected': selected ? 'true' : 'false'
        });
        if (item.optionClass && String(item.optionClass).trim()) {
            _classListOp(option, String(item.optionClass).trim(), 'add');
        }
        if (item.optionHtml && String(item.optionHtml).trim()) {
            var custom = _make('div', { class: 'ozi-select-option-custom' });
            this.renderOptionalHtml(custom, item.optionHtml);
            option.appendChild(custom); return option;
        }
        var content = _make('div', { class: 'ozi-select-option-content' });
        if (item.image) {
            var img = _make('img', { class: 'ozi-select-option-image', src: item.image, alt: item.label || '' });
            img.style.width = this.imageWidth; img.style.height = this.imageHeight;
            content.appendChild(img);
        } else {
            var ph = _make('div', { class: 'ozi-select-option-image is-no-image' });
            ph.style.width = this.imageWidth; ph.style.height = this.imageHeight;
            content.appendChild(ph);
        }
        var texts = _make('div', { class: 'ozi-select-option-texts' });
        var label = _make('div', { class: 'ozi-select-option-label' });
        if (item.label && String(item.label).trim()) { label.innerHTML = String(item.label); } else { label.textContent = String(item.value || ''); }
        texts.appendChild(label);
        if (item.subLabel && String(item.subLabel).trim()) {
            var sub = _make('div', { class: 'ozi-select-option-sublabel' });
            sub.innerHTML = String(item.subLabel);
            texts.appendChild(sub);
        }
        content.appendChild(texts); option.appendChild(content);
        return option;
    };

    /* ─── updateUI ─────────────────────────────────────────────────── */

    OziSelect.prototype.updateUI = function () {
        this.valueEl.innerHTML = '';
        if (!this.selectedItems.length) {
            this.valueEl.classList.add('is-placeholder');
            var wrap = _make('div', { class: 'ozi-select-value-content' });
            wrap.appendChild(_make('div', { class: 'ozi-select-value-image is-no-image' }));
            var span = _make('span', { class: 'ozi-select-value-label' });
            span.textContent = this.valuePlaceholder;
            wrap.appendChild(span);
            this.valueEl.appendChild(wrap);
            this.clearBtn.style.display = 'none';
            return;
        }
        this.valueEl.classList.remove('is-placeholder');
        if (this.mode === 'single') {
            this.valueEl.appendChild(this.buildSelectedPreview(this.selectedItems[0]));
        } else {
            var tagsWrap = _make('div', { class: 'ozi-select-tags' }); var self = this;
            this.selectedItems.forEach(function (item) {
                var tag = _make('span', { class: 'ozi-select-tag' });
                if (item.image) {
                    var img = _make('img', { class: 'ozi-select-tag-image', src: item.image, alt: item.label || '' });
                    img.style.width = self.imageWidth; img.style.height = self.imageHeight;
                    tag.appendChild(img);
                }
                var tagLabel = _make('span', { class: 'ozi-select-tag-label' });
                if (item.label && String(item.label).trim()) { tagLabel.innerHTML = String(item.label); } else { tagLabel.textContent = String(item.value || ''); }
                tag.appendChild(tagLabel);
                var removeBtn = _make('button', { type: 'button', class: 'ozi-select-tag-remove', 'data-value': item.value, 'aria-label': 'Remover ' + (item.label || item.value || '') });
                removeBtn.innerHTML = '&times;';
                tag.appendChild(removeBtn);
                tagsWrap.appendChild(tag);
            });
            this.valueEl.appendChild(tagsWrap);
        }
        this.clearBtn.style.display = this.isDisabled() ? 'none' : '';
    };

    OziSelect.prototype.buildSelectedPreview = function (item) {
        var content = _make('div', { class: 'ozi-select-value-content' });
        if (item.image) {
            var img = _make('img', { class: 'ozi-select-value-image', src: item.image, alt: item.label || '' });
            img.style.width = this.imageWidth; img.style.height = this.imageHeight;
            content.appendChild(img);
        } else {
            var ph = _make('div', { class: 'ozi-select-value-image is-no-image' });
            ph.style.width = this.imageWidth; ph.style.height = this.imageHeight;
            content.appendChild(ph);
        }
        var texts = _make('div', { class: 'ozi-select-value-texts' });
        var label = _make('div', { class: 'ozi-select-value-label' });
        if (item.label && String(item.label).trim()) { label.innerHTML = String(item.label); } else { label.textContent = String(item.value || ''); }
        texts.appendChild(label);
        if (item.subLabel && String(item.subLabel).trim()) {
            var sub = _make('div', { class: 'ozi-select-value-sublabel' });
            sub.innerHTML = String(item.subLabel);
            texts.appendChild(sub);
        }
        content.appendChild(texts); return content;
    };

    /* ─── highlight / teclado ──────────────────────────────────────── */

    OziSelect.prototype.getVisibleOptions = function () {
        return Array.prototype.filter.call(this.list.querySelectorAll('.ozi-select-option'), _isVisible);
    };

    OziSelect.prototype.getHighlightedOption = function () {
        return this.list.querySelector('.ozi-select-option.is-highlighted');
    };

    OziSelect.prototype.getSelectedVisibleOption = function () {
        if (!this.selectedItems.length) return null;
        var self = this;
        var visible = this.getVisibleOptions();
        for (var i = 0; i < visible.length; i++) {
            var v = visible[i].getAttribute('data-value');
            if (self.selectedItems.some(function (item) { return String(item.value) === String(v); })) return visible[i];
        }
        return null;
    };

    OziSelect.prototype.highlightOption = function (opt) {
        Array.prototype.forEach.call(this.list.querySelectorAll('.ozi-select-option'), function (o) { o.classList.remove('is-highlighted'); });
        if (opt) { opt.classList.add('is-highlighted'); this.ensureOptionVisible(opt); }
    };

    OziSelect.prototype.highlightFirstVisible = function () { var v = this.getVisibleOptions(); this.highlightOption(v[0] || null); };
    OziSelect.prototype.highlightLastVisible  = function () { var v = this.getVisibleOptions(); this.highlightOption(v[v.length - 1] || null); };

    OziSelect.prototype.highlightNext = function () {
        var v = this.getVisibleOptions(); var c = this.getHighlightedOption();
        var i = c ? v.indexOf(c) : -1; var n = v[i + 1];
        if (n) this.highlightOption(n); else if (!c && v.length) this.highlightFirstVisible();
    };

    OziSelect.prototype.highlightPrev = function () {
        var v = this.getVisibleOptions(); var c = this.getHighlightedOption();
        var i = c ? v.indexOf(c) : v.length; var p = v[i - 1];
        if (p) this.highlightOption(p); else if (!c && v.length) this.highlightLastVisible();
    };

    OziSelect.prototype.ensureOptionVisible = function (opt) {
        if (!opt) return;
        var list = this.list;
        var oT = opt.offsetTop;
        var oB = oT + opt.offsetHeight;
        var lT = list.scrollTop;
        var lB = lT + list.clientHeight;
        if (oT < lT) list.scrollTop = oT;
        else if (oB > lB) list.scrollTop = oB - list.clientHeight;
    };

    OziSelect.prototype.syncHighlightAfterRender = function (preferLast) {
        var v = this.getVisibleOptions(); var s = this.getSelectedVisibleOption();
        if (!v.length) {
            Array.prototype.forEach.call(this.list.querySelectorAll('.ozi-select-option'), function (o) { o.classList.remove('is-highlighted'); });
            return;
        }
        if (s) this.highlightOption(s);
        else if (preferLast) this.highlightLastVisible();
        else this.highlightFirstVisible();
    };

    /* ─── validação ────────────────────────────────────────────────── */

    OziSelect.prototype.focusControl = function () { if (!this.isDisabled()) this.control.focus(); };

    OziSelect.prototype.markInvalid = function (focusControl) {
        // [FIX-A] fallback neutro OZI em vez de 'is-invalid' (BS5)
        var cls = _classMap('invalid', 'ozi-invalid');
        _classListOp(this.control, cls, 'add');
        this.control.setAttribute('aria-invalid', 'true');
        this.feedback.textContent = this.requiredMessage;
        this.feedback.classList.add('is-visible');
        if (focusControl !== false) this.focusControl();
    };

    OziSelect.prototype.clearInvalid = function () {
        // [FIX-A] fallback neutro OZI em vez de 'is-invalid' (BS5)
        var cls = _classMap('invalid', 'ozi-invalid');
        _classListOp(this.control, cls, 'remove');
        this.control.setAttribute('aria-invalid', 'false');
        this.feedback.classList.remove('is-visible');
    };

    OziSelect.prototype.validate = function (focusControl) {
        if (!this.isRequired()) { this.clearInvalid(); return true; }
        if (this.isSelectionValid()) { this.clearInvalid(); return true; }
        this.markInvalid(focusControl !== false); return false;
    };

    /* ─── emit — contrato v2, sem dual-dispatch ────────────────────── */
    // Nomes ozi:* preservados; payload posicional jQuery '(event, items)' que
    // 2 arquivos do Central RH ainda consomem e responsabilidade do shim em
    // integrations/adapters/ozi-change-v1-compat.shim.js (nunca do componente).

    OziSelect.prototype.emit = function (eventName, source) {
        var detail = {
            component: 'ozi-select',
            name:      this.key,
            value:     this.getValue(),
            items:     this.getSelectedItems(),
            source:    source || 'user'
        };
        var helpers = window.OZI && window.OZI.helpers;
        if (helpers && typeof helpers.emit === 'function') {
            helpers.emit(this.root, eventName, detail);
        } else if (typeof CustomEvent === 'function') {
            this.root.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: detail }));
        }
    };

    OziSelect.prototype.emitChange = function (source) { this.emit('ozi:change', source); };

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
        this.renderOptions(this.search ? (this.search.value || '') : '');
        this.validate(false); this.emitChange('api');
    };

    OziSelect.prototype.setDisabled = function (state) {
        this.isDisabledConfig = !!state;
        if (this.isDisabledConfig) { this.root.setAttribute('data-ozi-select-disabled', 'disabled'); }
        else                       { this.root.removeAttribute('data-ozi-select-disabled'); }
        this.applyStateStyles(); this.syncHiddenInputs(); this.updateUI(); this.validate(false);
    };

    OziSelect.prototype.setRequired = function (state) {
        this.isRequiredConfig = !!state;
        if (this.isRequiredConfig) { this.root.setAttribute('data-ozi-select-required', 'required'); }
        else                       { this.root.removeAttribute('data-ozi-select-required'); }
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

    OziSelect.prototype.setRemoteLoading = function (state) { this.ui.classList.toggle('is-loading', !!state); };

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

        var csrfMeta = document.querySelector('meta[name="csrf-token"]');
        var csrf     = csrfMeta ? csrfMeta.getAttribute('content') : null;
        var method   = this.zldMethod === 'GET' ? 'GET' : 'POST';
        var headers  = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
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
                    var liveQuery = self.search ? (self.search.value || '') : query;
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
        this._dbg('destroy() chamado — trace de quem chamou:', undefined, true);
        this.abortRemoteRequest();
        if (this._onDocumentClick) document.removeEventListener('click', this._onDocumentClick);
        if (this.form) {
            if (this._onFormSubmit) this.form.removeEventListener('submit', this._onFormSubmit);
            if (this._onFormReset)  this.form.removeEventListener('reset',  this._onFormReset);
        }
        // rodapé slot (v6.2.0): devolve o conteúdo ao <template> antes de limpar o root,
        // p/ reload() reencontrar (no re-render do Livewire o template já vem recriado).
        if (this.footerSlot && this.footer) {
            while (this.footer.firstChild) this.footerSlot.content.appendChild(this.footer.firstChild);
        }
        if (this.ui)              this.ui.remove();
        if (this.feedback)        this.feedback.remove();
        if (this.hiddenContainer) this.hiddenContainer.remove();
        delete this.root.__oziSelectInitialized;
        this.root.classList.remove('ozi-select-root');
        this.root.innerHTML = '';
        delete instances[this.key];
    };

    OziSelect.prototype.reload = function () {
        var root = this.root;
        this.destroy();
        instances[this.key] = new OziSelect(root);
        return instances[this.key];
    };

    /* ─── API pública ──────────────────────────────────────────────── */

    var selectAPI = {

        init: function (scope) {
            var targets;

            if (!scope) {
                targets = Array.prototype.slice.call(document.querySelectorAll('[data-ozi-select]'));
            } else {
                var root = (typeof scope === 'string') ? document.querySelector(scope)
                         : (scope.querySelectorAll ? scope : null);
                if (!root) return this;
                targets = root.matches && root.matches('[data-ozi-select]') ? [root] : [];
                targets = targets.concat(Array.prototype.slice.call(root.querySelectorAll('[data-ozi-select]')));
            }

            targets.forEach(function (el) {
                var key = String(el.getAttribute('data-ozi-select') || '').trim();
                if (!key) return;

                var existing = instances[key];
                if (existing) {
                    var sameEl   = existing.root === el;
                    var oldInDom = existing.root && document.contains(existing.root);
                    if (sameEl && el.__oziSelectInitialized) return;
                    if (!sameEl && !oldInDom) { existing.destroy(); }
                    else if (!sameEl && oldInDom) { return; }
                }

                try {
                    instances[key] = new OziSelect(el);
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

        get: function (s) {
            if (!s) return null;
            if (typeof s === 'string' && s.charAt(0) !== '#' && s.charAt(0) !== '.') return instances[s] || null;
            var el = (typeof s === 'string') ? document.querySelector(s)
                   : (s.nodeType === 1 ? s : null);
            if (!el) return null;
            return instances[String(el.getAttribute('data-ozi-select') || '').trim()] || null;
        },

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
                    if (node.matches && node.matches('[data-ozi-select]')) { selectAPI.init(node); return; }
                    if (node.querySelectorAll && node.querySelectorAll('[data-ozi-select]').length) { selectAPI.init(node); }
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
            name:          'ozi-select',
            nativeElement: true, // v2 — recebe Element puro, sem envelopar em jQuery
            match:    function (el) { return el.hasAttribute('data-ozi-select'); },
            isValid:  function (el) { var inst = selectAPI.get(el); return inst ? inst.validate(false) : true; },
            getValue: function (el) { var inst = selectAPI.get(el); return inst ? inst.getValue() : null; },
            setState: function (el, state) { var inst = selectAPI.get(el); if (!inst) return; if (state === 'invalid') inst.markInvalid(false); else inst.clearInvalid(); }
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})();
