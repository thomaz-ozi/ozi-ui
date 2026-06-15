/**
 * ------------------------------------------
 * ozi-search
 * ------------------------------------------
 * Ver: 3.0.1
 * 2026-05-27
 *
 * Lógica preservada do oziSearch v2.0.0 (código real):
 *   - TreeWalker para highlight robusto
 *   - oziSearchResolveElements — resolve seletor como classe automaticamente
 *   - Paginação com reticências (oziSearchBuildPageWindows)
 *   - Visibilidade original preservada por $.data()
 *
 * Adições v1.0.1 (padrão OZI-UI v1.0.0):
 *   - Boot via $(function(){}) — init no DOMContentLoaded
 *   - Namespace defensivo OZI.components.search
 *   - Hook OZI.hooks.afterRender para conteúdo dinâmico
 *   - Bridge zldConf.zldHooks mantido para compat oziLoadData
 *   - window.OziSearch exposto para compat v0.x
 *   - API pública: trigger(), reset(), goToPage(), getState()
 */

(function ($, window, document) {
    'use strict';

    if (typeof $ === 'undefined') {
        console.error('[OZI:search] jQuery não encontrado.');
        return;
    }

    /* ─────────────────────────────────────────────
     * [1] HELPERS (preservados do v2.0.0)
     * ───────────────────────────────────────────── */

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

    function _getAttr($el, attr) {
        return $el.attr(attr);
    }

    function _getFirstAttr($el, attrs) {
        for (var i = 0; i < attrs.length; i++) {
            var v = $el.attr(attrs[i]);
            if (v !== undefined) return v;
        }
        return undefined;
    }

    /**
     * Resolve seletor — se não encontrar elementos diretamente,
     * tenta como nome de classe (sem o ponto).
     */
    function _resolveElements(rawSelector) {
        rawSelector = String(rawSelector || '').trim();
        if (!rawSelector) return $();

        var $els = $(rawSelector);
        if ($els.length) return $els;

        var looksSimple = !/[.#\[\]:\s,>+~]/.test(rawSelector);
        if (looksSimple) $els = $('.' + rawSelector);

        return $els;
    }

    function _resolveItems($input)  { return _resolveElements(_getAttr($input, 'data-ozi-search')); }
    function _resolveGroups($input) { return _resolveElements(_getAttr($input, 'data-ozi-search-group')); }

    function _buildRegex(pattern, global) {
        return new RegExp('(' + pattern + ')', global ? 'gi' : 'i');
    }

    function _normalizeTerms(terms) {
        return terms
            .map(function (t) { return _escapeRegExp(t); })
            .sort(function (a, b) { return b.length - a.length; })
            .join('|');
    }

    /* ─────────────────────────────────────────────
     * [2] ORIGINAL HTML / VISIBILITY (v2.0.0)
     * ───────────────────────────────────────────── */

    function _storeOriginalHtml($items) {
        $items.each(function () {
            var $el = $(this);
            if ($el.data('__oziSearchOriginalHtml') === undefined) {
                $el.data('__oziSearchOriginalHtml', $el.html());
            }
        });
    }

    function _clearHighlights($items) {
        $items.each(function () {
            var $el  = $(this);
            var orig = $el.data('__oziSearchOriginalHtml');
            if (orig !== undefined) $el.html(orig);
        });
    }

    function _storeOriginalVisibility($els) {
        $els.each(function () {
            var $el = $(this);
            if ($el.data('__oziSearchOriginalVisible') !== undefined) return;
            $el.data('__oziSearchOriginalVisible',      $el.is(':visible') ? '1' : '0');
            $el.data('__oziSearchOriginalInlineDisplay', this.style.display || '');
        });
    }

    function _restoreVisibility($els) {
        $els.each(function () {
            var $el      = $(this);
            var visible  = $el.data('__oziSearchOriginalVisible') !== '0';
            var display  = $el.data('__oziSearchOriginalInlineDisplay');
            this.style.display = visible ? (display || '') : 'none';
        });
    }

    /* ─────────────────────────────────────────────
     * [3] HIGHLIGHT VIA TREEWALKER (v2.0.0)
     * ───────────────────────────────────────────── */

    function _applyHighlight($element, regex, highlightClass) {
        var root = $element[0];
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

    /* ─────────────────────────────────────────────
     * [4] GRUPOS (v2.0.0)
     * ───────────────────────────────────────────── */

    function _updateGroups($groups, $items) {
        if (!$groups.length || !$items.length) return;
        $groups.each(function () {
            var $group = $(this);
            if ($group.data('__oziSearchOriginalVisible') === '0') { $group.hide(); return; }
            var hasVisible = $items.filter(function () {
                return $.contains($group[0], this) && $(this).is(':visible');
            }).length > 0;
            $group.toggle(hasVisible);
        });
    }

    /* ─────────────────────────────────────────────
     * [5] PAGINAÇÃO (v2.0.0)
     * ───────────────────────────────────────────── */

    function _parsePaginationSize(raw) {
        var n = parseInt(String(raw || '').trim(), 10);
        return isNaN(n) || n < 1 ? 10 : n;
    }

    function _getPaginationState($input) {
        return $input.data('__oziSearchPagination') || null;
    }

    function _setPaginationState($input, state) {
        $input.data('__oziSearchPagination', state);
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

    function _buildPaginationNav(totalPages, currentPage, $input) {
        var $nav = $('<nav>', { class: 'ozi-search-pagination', 'aria-label': 'Paginação' });
        var $ul  = $('<ul>', { class: 'ozi-search-pagination__list' });

        // prev
        $ul.append(
            $('<li>', { class: 'ozi-search-pagination__item' + (currentPage === 1 ? ' is-disabled' : '') })
                .append($('<button>', { type: 'button', class: 'ozi-search-pagination__btn', 'data-ozi-page': currentPage - 1, 'aria-label': 'Anterior', disabled: currentPage === 1 }).html('&#8249;'))
        );

        // páginas
        _buildPageWindows(totalPages, currentPage).forEach(function (page) {
            if (page === '...') {
                $ul.append($('<li>', { class: 'ozi-search-pagination__item is-ellipsis' })
                    .append($('<span>', { class: 'ozi-search-pagination__ellipsis' }).text('...')));
                return;
            }
            var isCurrent = page === currentPage;
            $ul.append(
                $('<li>', { class: 'ozi-search-pagination__item' + (isCurrent ? ' is-active' : '') })
                    .append($('<button>', {
                        type: 'button',
                        class: 'ozi-search-pagination__btn' + (isCurrent ? ' is-active' : ''),
                        'data-ozi-page': page,
                        'aria-label': 'Página ' + page,
                        'aria-current': isCurrent ? 'page' : undefined
                    }).text(page))
            );
        });

        // next
        $ul.append(
            $('<li>', { class: 'ozi-search-pagination__item' + (currentPage === totalPages ? ' is-disabled' : '') })
                .append($('<button>', { type: 'button', class: 'ozi-search-pagination__btn', 'data-ozi-page': currentPage + 1, 'aria-label': 'Próxima', disabled: currentPage === totalPages }).html('&#8250;'))
        );

        $nav.append($ul);

        // bind clique
        $nav.on('click', '[data-ozi-page]', function () {
            var page = Number($(this).attr('data-ozi-page'));
            if (!page || page < 1 || page > totalPages) return;
            _goToPage($input, page);
        });

        return $nav;
    }

    function _renderPagination($input, $visibleItems, pageSize, currentPage) {
        var state      = _getPaginationState($input);
        if (!state) return;

        var $container = state.$container;
        var total      = $visibleItems.length;
        var totalPages = Math.max(1, Math.ceil(total / pageSize));

        currentPage        = Math.max(1, Math.min(currentPage, totalPages));
        state.currentPage  = currentPage;
        state.totalPages   = totalPages;
        _setPaginationState($input, state);

        // mostra/oculta itens da página
        $visibleItems.each(function (index) {
            var start = (currentPage - 1) * pageSize;
            var end   = start + pageSize;
            $(this).toggle(index >= start && index < end);
        });

        // nav
        $container.find('.ozi-search-pagination').remove();
        if (totalPages > 1) $container.append(_buildPaginationNav(totalPages, currentPage, $input));
    }

    function _goToPage($input, page) {
        var state = _getPaginationState($input);
        if (!state) return;
        _renderPagination($input, state.$currentItems, state.pageSize, page);
    }

    function _initPagination($input, $allItems) {
        var paginationRaw = _getAttr($input, 'data-ozi-search-pagination');
        if (paginationRaw === undefined) return false;

        var pageSize    = _parsePaginationSize(paginationRaw);
        var containerId = String(_getAttr($input, 'data-ozi-search-pagination-id') || '').trim();

        if (!containerId) {
            console.warn('[OZI:search] data-ozi-search-pagination-id é obrigatório com paginação.');
            return false;
        }

        var $container = $('#' + containerId);
        if (!$container.length) {
            console.warn('[OZI:search] container não encontrado: #' + containerId);
            return false;
        }

        _setPaginationState($input, {
            pageSize:      pageSize,
            currentPage:   1,
            totalPages:    1,
            $container:    $container,
            $currentItems: $allItems
        });

        _renderPagination($input, $allItems, pageSize, 1);
        return true;
    }

    function _updatePagination($input, $visibleItems) {
        var state = _getPaginationState($input);
        if (!state) return false;
        state.$currentItems = $visibleItems;
        _setPaginationState($input, state);
        _renderPagination($input, $visibleItems, state.pageSize, 1);
        return true;
    }

    /* ─────────────────────────────────────────────
     * [6] EMIT
     * ───────────────────────────────────────────── */

    function _emit(el, eventName, payload) {
        $(el).trigger(eventName, [payload]);
        if (typeof CustomEvent === 'function') {
            el.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: payload }));
        }
    }

    /* ─────────────────────────────────────────────
     * [7] EVENTO PRINCIPAL — input (lógica v2.0.0)
     * ───────────────────────────────────────────── */

    $(document).on('input.oziSearch', '[data-ozi-search]', function () {
        var $input = $(this);

        var minLengthRaw = _getAttr($input, 'data-ozi-search-min');
        var minLength    = isNaN(parseInt(minLengthRaw, 10)) ? 0 : parseInt(minLengthRaw, 10);

        var words    = _isTrue(_getFirstAttr($input, ['data-ozi-search-words', 'data-ozi-search-multi']));
        var noFilter = _isTrue(_getAttr($input, 'data-ozi-search-no-filter'));

        var highlightRaw     = _getAttr($input, 'data-ozi-search-highlight');
        var highlightEnabled = highlightRaw !== undefined && !_isFalse(highlightRaw);
        var highlightClass   = (highlightRaw === undefined || highlightRaw === '' || _isTrue(highlightRaw))
            ? 'ozi-search-highlight'
            : String(highlightRaw).trim();

        var hasPagination = _getAttr($input, 'data-ozi-search-pagination') !== undefined;

        var $items  = _resolveItems($input);
        var $groups = _resolveGroups($input);

        if (!$items.length) return;

        // init paginação na primeira execução
        if (hasPagination && !_getPaginationState($input)) {
            _initPagination($input, $items);
        }

        _storeOriginalHtml($items);
        _clearHighlights($items);
        _storeOriginalVisibility($items);
        _storeOriginalVisibility($groups);

        var value = String($input.val() || '').trim();

        // busca vazia ou abaixo do mínimo — restaura
        if (value === '' || value.length < minLength) {
            _restoreVisibility($items);
            _restoreVisibility($groups);
            if (hasPagination) _updatePagination($input, $items);

            _emit(this, 'ozi:search-filtered', { query: value, matched: $items.length, total: $items.length });
            return;
        }

        var terms   = words ? value.split(/\s+/).filter(Boolean) : [value];
        var pattern = _normalizeTerms(terms);

        if (!pattern) {
            _restoreVisibility($items);
            _restoreVisibility($groups);
            if (hasPagination) _updatePagination($input, $items);
            return;
        }

        var regexTest      = _buildRegex(pattern, false);
        var regexHighlight = _buildRegex(pattern, true);

        // modo sem filtro — só highlight
        if (noFilter) {
            _restoreVisibility($items);
            _restoreVisibility($groups);
            if (highlightEnabled) {
                $items.filter(':visible').each(function () {
                    _applyHighlight($(this), regexHighlight, highlightClass);
                });
            }
            _emit(this, 'ozi:search-filtered', { query: value, matched: $items.length, total: $items.length });
            return;
        }

        // filtra
        var matched = [];

        $items.each(function () {
            var $item = $(this);
            if ($item.data('__oziSearchOriginalVisible') === '0') { $item.hide(); return; }

            if (regexTest.test($item.text())) {
                $item.show();
                if (highlightEnabled) _applyHighlight($item, regexHighlight, highlightClass);
                matched.push(this);
            } else {
                $item.hide();
            }
        });

        var $matched = $(matched);
        _updateGroups($groups, $items);
        if (hasPagination) _updatePagination($input, $matched);

        _emit(this, 'ozi:search-filtered', { query: value, matched: matched.length, total: $items.length });
    });

    /* ─────────────────────────────────────────────
     * [8] INIT DE PAGINAÇÃO NO ESCOPO
     * ───────────────────────────────────────────── */

    function _initPaginationInScope(root) {
        var $scope = root ? $(root) : $(document);

        $scope.find('[data-ozi-search][data-ozi-search-pagination]')
            .addBack('[data-ozi-search][data-ozi-search-pagination]')
            .each(function () {
                var $input = $(this);
                if ($input.data('__oziSearchPaginationReady')) return;
                $input.data('__oziSearchPaginationReady', true);

                var $items = _resolveItems($input);
                if (!$items.length) return;

                $items.show();
                _storeOriginalVisibility($items);
                _initPagination($input, $items);
            });
    }

    /* ─────────────────────────────────────────────
     * [9] API PÚBLICA
     * ───────────────────────────────────────────── */

    var searchAPI = {

        init: function (root) {
            _initPaginationInScope(root);
        },

        trigger: function (selectorOrEl, query) {
            var $input = $(selectorOrEl);
            if (!$input.length) return;
            var q = query !== undefined ? String(query) : $input.val();
            $input.val(q).trigger('input.oziSearch');
        },

        reset: function (selectorOrEl) {
            var $input = $(selectorOrEl);
            if (!$input.length) return;
            $input.val('').trigger('input.oziSearch');
        },

        goToPage: function (selectorOrEl, page) {
            var $input = $(selectorOrEl);
            if (!$input.length) return;
            _goToPage($input, page);
        },

        getState: function (selectorOrEl) {
            var $input = $(selectorOrEl);
            if (!$input.length) return null;
            return _getPaginationState($input);
        },

        setItems: function (selectorOrEl, items) {
            var $input = $(selectorOrEl);
            if (!$input.length) return;

            var rawSelector = _getAttr($input, 'data-ozi-search') || '';
            if (!rawSelector) return;

            var itemClass = rawSelector.charAt(0) === '.' ? rawSelector.slice(1) : rawSelector;
            var $existing = $('.' + itemClass);
            if (!$existing.length) return;

            var container = $existing[0].parentNode;
            if (!container) return;

            $existing.remove();

            var list = Array.isArray(items) ? items : [];
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                var text = typeof item === 'string' ? item : (item.label || item.text || String(item));
                var div  = document.createElement('div');
                div.className   = itemClass;
                div.textContent = text;
                container.appendChild(div);
            }

            $input.removeData('__oziSearchPaginationReady');
            _initPaginationInScope($input[0]);
            searchAPI.trigger(selectorOrEl, $input.val() || '');
        }
    };

    /* ─────────────────────────────────────────────
     * [10] BOOT
     * ───────────────────────────────────────────── */

    function _boot() {
        searchAPI.init();

        var OZI = window.OZI;

        // namespace defensivo
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.search = searchAPI;
        }

        // OZI.hooks.afterRender (v1.0.0)
        if (OZI && OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:search', function (root) {
                searchAPI.init(root);
            });
        }

        // bridge zldConf.zldHooks (oziLoadData compat)
        var zld = window.__zldConf || (window.zldConf && window.zldConf.zldHooks ? window.zldConf : null);
        if (zld && zld.zldHooks && Array.isArray(zld.zldHooks.afterRender)) {
            var alreadyBound = zld.zldHooks.afterRender.some(function (fn) {
                return fn && fn.__oziSearchHook === true;
            });
            if (!alreadyBound) {
                var hook = function (root) { searchAPI.init(root); };
                hook.__oziSearchHook = true;
                zld.zldHooks.afterRender.push(hook);
            }
        }
    }

    // compat v0.x
    window.OziSearch = searchAPI;

    // boot sempre via jQuery ready
    $(function () { _boot(); });

})(jQuery, window, document);