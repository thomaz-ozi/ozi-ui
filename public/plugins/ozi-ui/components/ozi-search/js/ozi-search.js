/**
 * ------------------------------------------
 * ozi-search
 * ------------------------------------------
 * Ver: 4.0.0
 * 2026-07-04
 *
 * Responsabilidade:
 *   - Filtro local de elementos DOM por texto, em tempo real
 *   - Highlight robusto via TreeWalker (nao quebra event handlers)
 *   - Grupos: oculta o container pai quando nenhum filho e visivel
 *   - Paginacao com reticencias (window de +-1 ao redor da pagina atual)
 *   - Modo sem filtro (apenas highlight)
 *   - Singleton puro — sem instancias por elemento; delegacao de 'input'
 *     no document. Cada <input data-ozi-search> resolve seus proprios
 *     items/grupos por seletor CSS.
 *
 * Atributos (no <input>):
 *   data-ozi-search               ← OBRIGATORIO. Seletor CSS ou nome de classe dos items
 *   data-ozi-search-group         ← seletor dos containers pais (grupos)
 *   data-ozi-search-min           ← minimo de caracteres p/ iniciar (default 0)
 *   data-ozi-search-words | -multi ← divide a busca em palavras (espaco)
 *   data-ozi-search-no-filter     ← nao filtra, so aplica highlight
 *   data-ozi-search-highlight     ← false = sem; true = classe padrao; string = classe custom
 *   data-ozi-search-pagination    ← itens por pagina; habilita paginacao
 *   data-ozi-search-pagination-id ← id do container do nav (obrigatorio c/ paginacao)
 *
 * Dependencias: ozi.js (OZI.hooks, OZI.helpers, OZI.lang) — zero jQuery
 *   (contrato de camadas v2 §2).
 * Expoe: OZI.components.search, window.OziSearch (compat)
 * Eventos: ozi:search-filtered
 *
 * Changelog:
 *   - v4.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Zero jQuery. Delegacao de 'input' nativa no document
 *         (e.target.closest('[data-ozi-search]')); TreeWalker/regex ja eram nativos.
 *       - Estado por-elemento migrado de $.data() para WeakMap/WeakSet
 *         (originalHtml/originalVisible/originalInlineDisplay por item; estado
 *         de paginacao e flag de "ready" por input). Beneficio colateral: itens
 *         removidos pelo setItems() sao coletados sem deixar estado orfao.
 *       - ':visible' do jQuery substituido por _isVisible() (offsetWidth/Height/
 *         getClientRects), mesma heuristica do ozi-select/ozi-toggle.
 *       - $.contains(g, el) -> g.contains(el) nativo; $group.toggle()/$item.show()/
 *         .hide() -> manipulacao direta de style.display (respeitando o display
 *         inline original memorizado).
 *       - Fim do dual-dispatch: emit() somente via OZI.helpers.emit (CustomEvent
 *         bubbles:true, payload em detail). Sem shim — ozi:search-filtered nao e
 *         consumido no Central RH (inventario F0). Payload passa a aderir ao
 *         contrato: { component, name, value: query, query, matched, total, source }.
 *         Nenhuma chave do payload legado (query/matched/total) colide com as
 *         reservadas do contrato.
 *       - source: 'user' na digitacao delegada; 'api' quando via trigger/reset/
 *         setItems (permite adapter Livewire evitar loop).
 *       - i18n: aria-labels do nav de paginacao (antes PT hardcoded) passam por
 *         _t() com fallback PT — chaves search.pagination/prev/next/page.
 *       - [FIX] Bug latente da v1 corrigido: um grupo ocultado numa busca nao
 *         reaparecia ao ampliar/alterar o termo. _updateGroups media a
 *         visibilidade do item via ':visible'/offsetWidth, que retorna false
 *         quando o ancestral (o proprio grupo) ainda esta em display:none —
 *         chicken-egg. Passa a decidir pelo style.display do proprio item.
 *       - API publica inalterada: init, trigger, reset, goToPage, getState,
 *         setItems; window.OziSearch mantido.
 *
 *   Historico anterior (jQuery):
 *   - v3.1.0: setItems() na API (substituicao dinamica do conjunto; Livewire).
 *   - v3.0.1: boot via $(fn); OZI.components.search; hook afterRender; compat zld.
 *   - v3.0.0/v2.0.0: TreeWalker; _resolveElements com fallback de classe;
 *     paginacao com reticencias; visibilidade original preservada.
 */

(function (window, document) {
    'use strict';

    // ─────────────────────────────────────────────
    // [1] GUARD — Singleton
    // ─────────────────────────────────────────────

    if (window.OziSearch) return;


    // ─────────────────────────────────────────────
    // [2] ESTADO POR-ELEMENTO (substitui $.data)
    // ─────────────────────────────────────────────

    // por item/grupo: { originalHtml?, originalVisible: '0'|'1', originalInlineDisplay }
    var _itemState = new WeakMap();
    // por input: estado de paginacao { pageSize, currentPage, totalPages, container, currentItems }
    var _pagination = new WeakMap();
    // por input: flag de paginacao ja inicializada
    var _paginationReady = new WeakSet();

    var _inputBound = false;


    // ─────────────────────────────────────────────
    // [3] HELPERS (puros — sem jQuery)
    // ─────────────────────────────────────────────

    function _t(key, fallback) {
        var lang = window.OZI && window.OZI.lang;
        if (lang && typeof lang.t === 'function') {
            var v = lang.t(key);
            if (v && v !== key) return v;
        }
        return fallback || key;
    }

    function _isTrue(value) {
        var v = String(value == null ? '' : value).trim().toLowerCase();
        return value === true || value === 1 || v === 'true' || v === '1';
    }

    function _isFalse(value) {
        var v = String(value == null ? '' : value).trim().toLowerCase();
        return value === false || value === 0 || v === 'false' || v === '0';
    }

    function _escapeRegExp(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function _getFirstAttr(el, attrs) {
        for (var i = 0; i < attrs.length; i++) {
            var v = el.getAttribute(attrs[i]);
            if (v !== null) return v;
        }
        return null;
    }

    // heuristica equivalente ao jQuery :visible (mesma do ozi-select/ozi-toggle)
    function _isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
    }

    // equivalente a $('<tag>', { attrs }) — so atributos HTML
    function _make(tag, attrs) {
        var el = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) {
                    el.setAttribute(k, attrs[k]);
                }
            });
        }
        return el;
    }

    // normaliza seletor/Element/jQuery para Element (API publica aceita os 3)
    function _toEl(x) {
        if (!x) return null;
        if (x.nodeType === 1) return x;
        if (typeof x === 'string') return document.querySelector(x);
        if (x.jquery) return x[0] || null; // objeto jQuery passado pela API — so leitura de propriedade
        return null;
    }

    function _queryAll(sel) {
        try {
            return Array.prototype.slice.call(document.querySelectorAll(sel));
        } catch (e) {
            return [];
        }
    }

    /**
     * Resolve seletor — se nao encontrar elementos diretamente,
     * tenta como nome de classe (sem o ponto). Retorna Array<Element>.
     */
    function _resolveElements(rawSelector) {
        rawSelector = String(rawSelector || '').trim();
        if (!rawSelector) return [];

        var els = _queryAll(rawSelector);
        if (els.length) return els;

        var looksSimple = !/[.#\[\]:\s,>+~]/.test(rawSelector);
        if (looksSimple) els = _queryAll('.' + rawSelector);

        return els;
    }

    function _resolveItems(input)  { return _resolveElements(input.getAttribute('data-ozi-search')); }
    function _resolveGroups(input) { return _resolveElements(input.getAttribute('data-ozi-search-group')); }

    function _buildRegex(pattern, global) {
        return new RegExp('(' + pattern + ')', global ? 'gi' : 'i');
    }

    function _normalizeTerms(terms) {
        return terms
            .map(function (t) { return _escapeRegExp(t); })
            .sort(function (a, b) { return b.length - a.length; })
            .join('|');
    }


    // ─────────────────────────────────────────────
    // [4] HTML / VISIBILIDADE ORIGINAL
    // ─────────────────────────────────────────────

    function _state(el) {
        var st = _itemState.get(el);
        if (!st) { st = {}; _itemState.set(el, st); }
        return st;
    }

    function _storeOriginalHtml(items) {
        items.forEach(function (el) {
            var st = _state(el);
            if (st.originalHtml === undefined) st.originalHtml = el.innerHTML;
        });
    }

    function _clearHighlights(items) {
        items.forEach(function (el) {
            var st = _itemState.get(el);
            if (st && st.originalHtml !== undefined) el.innerHTML = st.originalHtml;
        });
    }

    function _storeOriginalVisibility(els) {
        els.forEach(function (el) {
            var st = _state(el);
            if (st.originalVisible !== undefined) return;
            st.originalVisible       = _isVisible(el) ? '1' : '0';
            st.originalInlineDisplay = el.style.display || '';
        });
    }

    function _hide(el) { el.style.display = 'none'; }

    // mostra restaurando o display inline original memorizado (equivale a $.show())
    function _show(el) {
        var st = _itemState.get(el);
        el.style.display = st ? (st.originalInlineDisplay || '') : '';
    }

    function _restoreVisibility(els) {
        els.forEach(function (el) {
            var st       = _itemState.get(el);
            var visible  = !st || st.originalVisible !== '0';
            var display  = st ? st.originalInlineDisplay : '';
            el.style.display = visible ? (display || '') : 'none';
        });
    }


    // ─────────────────────────────────────────────
    // [5] HIGHLIGHT VIA TREEWALKER (preservado do v2.0.0)
    // ─────────────────────────────────────────────

    function _applyHighlight(element, regex, highlightClass) {
        var root = element;
        if (!root) return;

        var blocked = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'];

        var walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    var parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (blocked.indexOf(parent.tagName) > -1) return NodeFilter.FILTER_REJECT;
                    if (parent.hasAttribute('__oziSearchMark')) return NodeFilter.FILTER_REJECT;
                    if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        var nodes = [];
        var node;
        while ((node = walker.nextNode())) nodes.push(node);

        nodes.forEach(function (textNode) {
            var text = textNode.nodeValue;
            regex.lastIndex = 0;
            if (!regex.test(text)) return;
            regex.lastIndex = 0;

            var highlighted = text.replace(regex, function (m) {
                return '<span __oziSearchMark class="' + highlightClass + '">' + m + '</span>';
            });

            var temp = document.createElement('span');
            temp.innerHTML = highlighted;

            var frag = document.createDocumentFragment();
            while (temp.firstChild) frag.appendChild(temp.firstChild);

            if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
        });
    }


    // ─────────────────────────────────────────────
    // [6] GRUPOS
    // ─────────────────────────────────────────────

    function _updateGroups(groups, items) {
        if (!groups.length || !items.length) return;
        groups.forEach(function (group) {
            var st = _itemState.get(group);
            if (st && st.originalVisible === '0') { _hide(group); return; }
            // Um item conta como "visivel para o grupo" pela decisao que o motor
            // acabou de tomar (style.display do proprio item), NAO por _isVisible():
            // se o grupo estava oculto de uma busca anterior, o item recem-exibido
            // ainda tem o ancestral em display:none e _isVisible() retornaria false
            // (chicken-egg). Isso corrige um bug latente da v1, onde um grupo ocultado
            // nunca reaparecia ao ampliar a busca ($(item).is(':visible') dependia do
            // ancestral). Itens originalmente ocultos ja foram _hide()'d acima.
            var hasVisible = items.some(function (item) {
                return group.contains(item) && item.style.display !== 'none';
            });
            if (hasVisible) _show(group); else _hide(group);
        });
    }


    // ─────────────────────────────────────────────
    // [7] PAGINACAO
    // ─────────────────────────────────────────────

    function _parsePaginationSize(raw) {
        var n = parseInt(String(raw || '').trim(), 10);
        return isNaN(n) || n < 1 ? 10 : n;
    }

    function _getPaginationState(input) {
        return _pagination.get(input) || null;
    }

    function _setPaginationState(input, state) {
        _pagination.set(input, state);
    }

    function _buildPageWindows(totalPages, currentPage) {
        if (totalPages <= 7) {
            var pages = [];
            for (var i = 1; i <= totalPages; i++) pages.push(i);
            return pages;
        }
        var result = [];
        var delta  = 1;
        var left   = Math.max(2, currentPage - delta);
        var right  = Math.min(totalPages - 1, currentPage + delta);

        result.push(1);
        if (left > 2) result.push('...');
        for (var p = left; p <= right; p++) result.push(p);
        if (right < totalPages - 1) result.push('...');
        result.push(totalPages);
        return result;
    }

    function _buildPaginationNav(totalPages, currentPage, input) {
        var nav = _make('nav', { 'class': 'ozi-search-pagination', 'aria-label': _t('search.pagination', 'Paginação') });
        var ul  = _make('ul', { 'class': 'ozi-search-pagination__list' });

        function pageBtn(attrs, htmlOrText, isHtml) {
            var btn = _make('button', attrs);
            if (isHtml) btn.innerHTML = htmlOrText; else btn.textContent = htmlOrText;
            return btn;
        }

        // prev
        var prevLi  = _make('li', { 'class': 'ozi-search-pagination__item' + (currentPage === 1 ? ' is-disabled' : '') });
        prevLi.appendChild(pageBtn({
            type: 'button', 'class': 'ozi-search-pagination__btn',
            'data-ozi-page': currentPage - 1, 'aria-label': _t('search.prev', 'Anterior'),
            disabled: currentPage === 1 ? 'disabled' : false
        }, '&#8249;', true));
        ul.appendChild(prevLi);

        // paginas
        _buildPageWindows(totalPages, currentPage).forEach(function (page) {
            if (page === '...') {
                var elip = _make('li', { 'class': 'ozi-search-pagination__item is-ellipsis' });
                var span = _make('span', { 'class': 'ozi-search-pagination__ellipsis' });
                span.textContent = '...';
                elip.appendChild(span);
                ul.appendChild(elip);
                return;
            }
            var isCurrent = page === currentPage;
            var li = _make('li', { 'class': 'ozi-search-pagination__item' + (isCurrent ? ' is-active' : '') });
            li.appendChild(pageBtn({
                type: 'button',
                'class': 'ozi-search-pagination__btn' + (isCurrent ? ' is-active' : ''),
                'data-ozi-page': page,
                'aria-label': _t('search.page', 'Página') + ' ' + page,
                'aria-current': isCurrent ? 'page' : false
            }, String(page), false));
            ul.appendChild(li);
        });

        // next
        var nextLi = _make('li', { 'class': 'ozi-search-pagination__item' + (currentPage === totalPages ? ' is-disabled' : '') });
        nextLi.appendChild(pageBtn({
            type: 'button', 'class': 'ozi-search-pagination__btn',
            'data-ozi-page': currentPage + 1, 'aria-label': _t('search.next', 'Próxima'),
            disabled: currentPage === totalPages ? 'disabled' : false
        }, '&#8250;', true));
        ul.appendChild(nextLi);

        nav.appendChild(ul);

        // clique delegado no nav (nav e removido/recriado a cada render — sem leak)
        nav.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('[data-ozi-page]') : null;
            if (!btn || !nav.contains(btn)) return;
            var page = Number(btn.getAttribute('data-ozi-page'));
            if (!page || page < 1 || page > totalPages) return;
            _goToPage(input, page);
        });

        return nav;
    }

    function _renderPagination(input, visibleItems, pageSize, currentPage) {
        var state = _getPaginationState(input);
        if (!state) return;

        var container  = state.container;
        var total      = visibleItems.length;
        var totalPages = Math.max(1, Math.ceil(total / pageSize));

        currentPage       = Math.max(1, Math.min(currentPage, totalPages));
        state.currentPage = currentPage;
        state.totalPages  = totalPages;
        _setPaginationState(input, state);

        // mostra/oculta itens da pagina
        var start = (currentPage - 1) * pageSize;
        var end   = start + pageSize;
        visibleItems.forEach(function (el, index) {
            if (index >= start && index < end) _show(el); else _hide(el);
        });

        // nav
        Array.prototype.slice.call(container.querySelectorAll('.ozi-search-pagination'))
            .forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        if (totalPages > 1) container.appendChild(_buildPaginationNav(totalPages, currentPage, input));
    }

    function _goToPage(input, page) {
        var state = _getPaginationState(input);
        if (!state) return;
        _renderPagination(input, state.currentItems, state.pageSize, page);
    }

    function _initPagination(input, allItems) {
        var paginationRaw = input.getAttribute('data-ozi-search-pagination');
        if (paginationRaw === null) return false;

        var pageSize    = _parsePaginationSize(paginationRaw);
        var containerId = String(input.getAttribute('data-ozi-search-pagination-id') || '').trim();

        if (!containerId) {
            console.warn('[OZI:search] data-ozi-search-pagination-id é obrigatório com paginação.');
            return false;
        }

        var container = document.getElementById(containerId);
        if (!container) {
            console.warn('[OZI:search] container não encontrado: #' + containerId);
            return false;
        }

        _setPaginationState(input, {
            pageSize:     pageSize,
            currentPage:  1,
            totalPages:   1,
            container:    container,
            currentItems: allItems
        });

        _renderPagination(input, allItems, pageSize, 1);
        return true;
    }

    function _updatePagination(input, visibleItems) {
        var state = _getPaginationState(input);
        if (!state) return false;
        state.currentItems = visibleItems;
        _setPaginationState(input, state);
        _renderPagination(input, visibleItems, state.pageSize, 1);
        return true;
    }

    function _initPaginationInScope(root) {
        var scope = (root && root.querySelectorAll) ? root : document;

        var inputs = Array.prototype.slice.call(scope.querySelectorAll('[data-ozi-search][data-ozi-search-pagination]'));

        // addBack: o proprio root pode ser o input
        if (root && root.nodeType === 1 && root.matches &&
            root.matches('[data-ozi-search][data-ozi-search-pagination]') &&
            inputs.indexOf(root) === -1) {
            inputs.push(root);
        }

        inputs.forEach(function (input) {
            if (_paginationReady.has(input)) return;
            _paginationReady.add(input);

            var items = _resolveItems(input);
            if (!items.length) return;

            items.forEach(_show);
            _storeOriginalVisibility(items);
            _initPagination(input, items);
        });
    }


    // ─────────────────────────────────────────────
    // [8] EMIT — contrato v2, sem dual-dispatch
    // ─────────────────────────────────────────────

    function _emit(input, query, matched, total, source) {
        var detail = {
            component: 'ozi-search',
            name:      input.getAttribute('name') || input.id || null,
            value:     query,
            query:     query,
            matched:   matched,
            total:     total,
            source:    source || 'user'
        };

        var helpers = window.OZI && window.OZI.helpers;
        if (helpers && typeof helpers.emit === 'function') {
            helpers.emit(input, 'ozi:search-filtered', detail);
        } else if (typeof CustomEvent === 'function') {
            input.dispatchEvent(new CustomEvent('ozi:search-filtered', { bubbles: true, detail: detail }));
        }
    }


    // ─────────────────────────────────────────────
    // [9] MOTOR PRINCIPAL — filtro/highlight (logica v2.0.0)
    // source: 'user' (digitacao) | 'api' (trigger/reset/setItems)
    // ─────────────────────────────────────────────

    function _filter(input, source) {
        var minLengthRaw = input.getAttribute('data-ozi-search-min');
        var minLength    = isNaN(parseInt(minLengthRaw, 10)) ? 0 : parseInt(minLengthRaw, 10);

        var words    = _isTrue(_getFirstAttr(input, ['data-ozi-search-words', 'data-ozi-search-multi']));
        var noFilter = _isTrue(input.getAttribute('data-ozi-search-no-filter'));

        var highlightRaw     = input.getAttribute('data-ozi-search-highlight');
        var highlightEnabled = highlightRaw !== null && !_isFalse(highlightRaw);
        var highlightClass   = (highlightRaw === null || highlightRaw === '' || _isTrue(highlightRaw))
            ? 'ozi-search-highlight'
            : String(highlightRaw).trim();

        var hasPagination = input.getAttribute('data-ozi-search-pagination') !== null;

        var items  = _resolveItems(input);
        var groups = _resolveGroups(input);

        if (!items.length) return;

        // init paginacao na primeira execucao
        if (hasPagination && !_getPaginationState(input)) {
            _initPagination(input, items);
        }

        _storeOriginalHtml(items);
        _clearHighlights(items);
        _storeOriginalVisibility(items);
        _storeOriginalVisibility(groups);

        var value = String(input.value || '').trim();

        // busca vazia ou abaixo do minimo — restaura
        if (value === '' || value.length < minLength) {
            _restoreVisibility(items);
            _restoreVisibility(groups);
            if (hasPagination) _updatePagination(input, items);

            _emit(input, value, items.length, items.length, source);
            return;
        }

        var terms   = words ? value.split(/\s+/).filter(Boolean) : [value];
        var pattern = _normalizeTerms(terms);

        if (!pattern) {
            _restoreVisibility(items);
            _restoreVisibility(groups);
            if (hasPagination) _updatePagination(input, items);
            return;
        }

        var regexTest      = _buildRegex(pattern, false);
        var regexHighlight = _buildRegex(pattern, true);

        // modo sem filtro — so highlight
        if (noFilter) {
            _restoreVisibility(items);
            _restoreVisibility(groups);
            if (highlightEnabled) {
                items.filter(_isVisible).forEach(function (el) {
                    _applyHighlight(el, regexHighlight, highlightClass);
                });
            }
            _emit(input, value, items.length, items.length, source);
            return;
        }

        // filtra
        var matched = [];

        items.forEach(function (item) {
            var st = _itemState.get(item);
            if (st && st.originalVisible === '0') { _hide(item); return; }

            if (regexTest.test(item.textContent)) {
                _show(item);
                if (highlightEnabled) _applyHighlight(item, regexHighlight, highlightClass);
                matched.push(item);
            } else {
                _hide(item);
            }
        });

        _updateGroups(groups, items);
        if (hasPagination) _updatePagination(input, matched);

        _emit(input, value, matched.length, items.length, source);
    }


    // ─────────────────────────────────────────────
    // [10] DELEGACAO NATIVA — input no document
    // ─────────────────────────────────────────────

    function _bindInput() {
        if (_inputBound) return;
        _inputBound = true;
        document.addEventListener('input', function (e) {
            var input = (e.target && e.target.closest) ? e.target.closest('[data-ozi-search]') : null;
            if (!input) return;
            _filter(input, 'user');
        });
    }


    // ─────────────────────────────────────────────
    // [11] API PUBLICA — OZI.components.search
    // ─────────────────────────────────────────────

    var searchAPI = {

        init: function (root) {
            _initPaginationInScope(root);
        },

        trigger: function (selectorOrEl, query) {
            var input = _toEl(selectorOrEl);
            if (!input) return;
            var q = query !== undefined ? String(query) : input.value;
            input.value = q;
            _filter(input, 'api');
        },

        reset: function (selectorOrEl) {
            var input = _toEl(selectorOrEl);
            if (!input) return;
            input.value = '';
            _filter(input, 'api');
        },

        goToPage: function (selectorOrEl, page) {
            var input = _toEl(selectorOrEl);
            if (!input) return;
            _goToPage(input, page);
        },

        getState: function (selectorOrEl) {
            var input = _toEl(selectorOrEl);
            if (!input) return null;
            return _getPaginationState(input);
        },

        setItems: function (selectorOrEl, items) {
            var input = _toEl(selectorOrEl);
            if (!input) return;

            var rawSelector = input.getAttribute('data-ozi-search') || '';
            if (!rawSelector) return;

            var itemClass = rawSelector.charAt(0) === '.' ? rawSelector.slice(1) : rawSelector;
            var existing  = _queryAll('.' + itemClass);
            if (!existing.length) return;

            var container = existing[0].parentNode;
            if (!container) return;

            existing.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });

            var list = Array.isArray(items) ? items : [];
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                var text = typeof item === 'string' ? item : (item.label || item.text || String(item));
                var div  = document.createElement('div');
                div.className   = itemClass;
                div.textContent = text;
                container.appendChild(div);
            }

            _paginationReady.delete(input);
            _pagination.delete(input);
            _initPaginationInScope(input);
            searchAPI.trigger(selectorOrEl, input.value || '');
        }
    };


    // ─────────────────────────────────────────────
    // [12] COMPAT ZLD — zldConf.zldHooks.afterRender
    // ─────────────────────────────────────────────

    function _bindZldCompat() {
        var zld = window.__zldConf || (window.zldConf && window.zldConf.zldHooks ? window.zldConf : null);
        if (zld && zld.zldHooks && Array.isArray(zld.zldHooks.afterRender)) {
            var alreadyBound = zld.zldHooks.afterRender.some(function (fn) {
                return fn && fn.__oziSearchHook === true;
            });
            if (!alreadyBound) {
                var hook = function (root) {
                    var target = (root && root.jquery) ? root[0] : root; // root pode vir como objeto jQuery de hosts v1
                    searchAPI.init(target || document);
                };
                hook.__oziSearchHook = true;
                zld.zldHooks.afterRender.push(hook);
            }
        }
    }


    // ─────────────────────────────────────────────
    // [13] EXPOSICAO + BOOT
    // ─────────────────────────────────────────────

    // compat v0.x — atribuido sincronamente (fallback do ozi-search.plugin.js)
    window.OziSearch = searchAPI;

    function _boot() {
        _bindInput();
        searchAPI.init();

        var OZI = window.OZI;

        // namespace defensivo
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.search = searchAPI;
        }

        // OZI.hooks.afterRender — re-init de paginacao em conteudo dinamico
        if (OZI && OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:search', function (root) {
                searchAPI.init(root);
            });
        }

        _bindZldCompat();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})(window, document);
