(function ($) {
    'use strict';
/**
 * ------------------------------------------
 * # oziSearch
 * ------------------------------------------
 * Ver: (2.0.0)
 * 2026-04-26
 */
    // ------------------------------------------
    // HELPERS
    // ------------------------------------------

    function oziSearchIsTrue(value) {
        const v = String(value ?? '').trim().toLowerCase();
        return value === true || value === 1 || v === 'true' || v === '1';
    }

    function oziSearchIsFalse(value) {
        const v = String(value ?? '').trim().toLowerCase();
        return value === false || value === 0 || v === 'false' || v === '0';
    }

    function oziSearchGetAttr($el, attrName) {
        return $el.attr(attrName);
    }

    function oziSearchGetFirstAttr($el, attrNames) {
        for (const attrName of attrNames) {
            const value = $el.attr(attrName);
            if (value !== undefined) return value;
        }
        return undefined;
    }

    function oziSearchEscapeRegExp(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function oziSearchResolveElements(rawSelector) {
        rawSelector = String(rawSelector || '').trim();
        if (!rawSelector) return $();

        let $elements = $(rawSelector);
        if ($elements.length) return $elements;

        const looksLikeSimpleName = !/[.#\[\]:\s,>+~]/.test(rawSelector);
        if (looksLikeSimpleName) {
            $elements = $('.' + rawSelector);
        }

        return $elements;
    }

    function oziSearchResolveItems($input) {
        return oziSearchResolveElements(oziSearchGetAttr($input, 'data-ozi-search'));
    }

    function oziSearchResolveGroups($input) {
        return oziSearchResolveElements(oziSearchGetAttr($input, 'data-ozi-search-group'));
    }

    function oziSearchBuildRegex(pattern, globalSearch) {
        return new RegExp(`(${pattern})`, globalSearch ? 'gi' : 'i');
    }

    function oziSearchStoreOriginalHtml($items) {
        $items.each(function () {
            const $item = $(this);
            if ($item.data('__oziSearchOriginalHtml') === undefined) {
                $item.data('__oziSearchOriginalHtml', $item.html());
            }
        });
    }

    function oziSearchClearHighlights($items) {
        $items.each(function () {
            const $item = $(this);
            const originalHtml = $item.data('__oziSearchOriginalHtml');
            if (originalHtml !== undefined) {
                $item.html(originalHtml);
            }
        });
    }

    function oziSearchStoreOriginalVisibility($elements) {
        $elements.each(function () {
            const $el = $(this);
            if ($el.data('__oziSearchOriginalVisible') !== undefined) return;
            $el.data('__oziSearchOriginalVisible', $el.is(':visible') ? '1' : '0');
            $el.data('__oziSearchOriginalInlineDisplay', this.style.display || '');
        });
    }

    function oziSearchRestoreVisibility($elements) {
        $elements.each(function () {
            const $el = $(this);
            const originalVisible = $el.data('__oziSearchOriginalVisible') !== '0';
            const originalInlineDisplay = $el.data('__oziSearchOriginalInlineDisplay');
            this.style.display = originalVisible
                ? (originalInlineDisplay || '')
                : 'none';
        });
    }

    function oziSearchApplyHighlight($element, regex, highlightClass) {
        const root = $element[0];
        if (!root) return;

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (parent.hasAttribute('__oziSearchMark')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (!node.nodeValue || !node.nodeValue.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodes = [];
        let currentNode;

        while ((currentNode = walker.nextNode())) {
            nodes.push(currentNode);
        }

        nodes.forEach(textNode => {
            const text = textNode.nodeValue;
            regex.lastIndex = 0;
            if (!regex.test(text)) return;
            regex.lastIndex = 0;

            const highlightedHtml = text.replace(
                regex,
                `<span __oziSearchMark class="${highlightClass}">$1</span>`
            );

            const temp = document.createElement('span');
            temp.innerHTML = highlightedHtml;

            const fragment = document.createDocumentFragment();
            while (temp.firstChild) {
                fragment.appendChild(temp.firstChild);
            }

            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });
    }

    function oziSearchNormalizeTerms(terms) {
        return terms
            .map(term => oziSearchEscapeRegExp(term))
            .sort((a, b) => b.length - a.length)
            .join('|');
    }

    function oziSearchUpdateGroups($groups, $items) {
        if (!$groups.length || !$items.length) return;

        $groups.each(function () {
            const $group = $(this);

            if ($group.data('__oziSearchOriginalVisible') === '0') {
                $group.hide();
                return;
            }

            const hasVisibleItems = $items.filter(function () {
                return $.contains($group[0], this) && $(this).is(':visible');
            }).length > 0;

            $group.toggle(hasVisibleItems);
        });
    }

    // ------------------------------------------
    // PAGINAÇÃO
    // ------------------------------------------

    function oziSearchParsePaginationSize(raw) {
        const parsed = parseInt(String(raw || '').trim(), 10);
        return isNaN(parsed) || parsed < 1 ? 10 : parsed;
    }

    function oziSearchGetPaginationState($input) {
        return $input.data('__oziSearchPagination') || null;
    }

    function oziSearchSetPaginationState($input, state) {
        $input.data('__oziSearchPagination', state);
    }

    function oziSearchBuildPaginationNav(totalPages, currentPage, $input) {
        const $nav = $('<nav>', {
            class: 'ozi-search-pagination',
            'aria-label': 'Paginação'
        });

        const $ul = $('<ul>', { class: 'ozi-search-pagination__list' });

        // botão anterior
        const $prev = $('<li>', {
            class: 'ozi-search-pagination__item' + (currentPage === 1 ? ' is-disabled' : '')
        }).append(
            $('<button>', {
                type: 'button',
                class: 'ozi-search-pagination__btn',
                'data-ozi-page': currentPage - 1,
                'aria-label': 'Página anterior',
                disabled: currentPage === 1
            }).html('&#8249;')
        );

        $ul.append($prev);

        // páginas com reticências
        const pages = oziSearchBuildPageWindows(totalPages, currentPage);

        pages.forEach(page => {
            if (page === '...') {
                $ul.append(
                    $('<li>', { class: 'ozi-search-pagination__item is-ellipsis' })
                        .append($('<span>', { class: 'ozi-search-pagination__ellipsis' }).text('...'))
                );
                return;
            }

            const isCurrent = page === currentPage;

            $ul.append(
                $('<li>', {
                    class: 'ozi-search-pagination__item' + (isCurrent ? ' is-active' : '')
                }).append(
                    $('<button>', {
                        type: 'button',
                        class: 'ozi-search-pagination__btn' + (isCurrent ? ' is-active' : ''),
                        'data-ozi-page': page,
                        'aria-label': 'Página ' + page,
                        'aria-current': isCurrent ? 'page' : undefined
                    }).text(page)
                )
            );
        });

        // botão próximo
        const $next = $('<li>', {
            class: 'ozi-search-pagination__item' + (currentPage === totalPages ? ' is-disabled' : '')
        }).append(
            $('<button>', {
                type: 'button',
                class: 'ozi-search-pagination__btn',
                'data-ozi-page': currentPage + 1,
                'aria-label': 'Próxima página',
                disabled: currentPage === totalPages
            }).html('&#8250;')
        );

        $ul.append($next);
        $nav.append($ul);

        // bind de clique
        $nav.on('click', '[data-ozi-page]', function () {
            const page = Number($(this).attr('data-ozi-page'));
            if (!page || page < 1 || page > totalPages) return;
            oziSearchGoToPage($input, page);
        });

        return $nav;
    }

    function oziSearchBuildPageWindows(totalPages, currentPage) {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages = [];
        const delta = 1; // páginas ao redor da atual

        const left  = Math.max(2, currentPage - delta);
        const right = Math.min(totalPages - 1, currentPage + delta);

        pages.push(1);

        if (left > 2) pages.push('...');

        for (let i = left; i <= right; i++) {
            pages.push(i);
        }

        if (right < totalPages - 1) pages.push('...');

        pages.push(totalPages);

        return pages;
    }

    function oziSearchRenderPagination($input, $visibleItems, pageSize, currentPage) {
        const state = oziSearchGetPaginationState($input);
        if (!state) return;

        const $container = state.$container;
        const totalItems = $visibleItems.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

        // clamp página
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        // atualiza estado
        state.currentPage = currentPage;
        state.totalPages  = totalPages;
        oziSearchSetPaginationState($input, state);

        // mostra/oculta itens da página
        $visibleItems.each(function (index) {
            const start = (currentPage - 1) * pageSize;
            const end   = start + pageSize;
            $(this).toggle(index >= start && index < end);
        });

        // remove nav anterior e injeta novo
        $container.find('.ozi-search-pagination').remove();

        if (totalPages > 1) {
            $container.append(
                oziSearchBuildPaginationNav(totalPages, currentPage, $input)
            );
        }
    }

    function oziSearchGoToPage($input, page) {
        const state = oziSearchGetPaginationState($input);
        if (!state) return;

        oziSearchRenderPagination($input, state.$currentItems, state.pageSize, page);
    }

    function oziSearchInitPagination($input, $allItems) {
        const paginationRaw = oziSearchGetAttr($input, 'data-ozi-search-pagination');
        if (paginationRaw === undefined) return false;

        const pageSize    = oziSearchParsePaginationSize(paginationRaw);
        const containerId = String(oziSearchGetAttr($input, 'data-ozi-search-pagination-id') || '').trim();

        if (!containerId) {
            console.warn('oziSearch| data-ozi-search-pagination-id é obrigatório com paginação.');
            return false;
        }

        const $container = $('#' + containerId);
        if (!$container.length) {
            console.warn('oziSearch| container não encontrado:', containerId);
            return false;
        }

        const state = {
            pageSize,
            currentPage:  1,
            totalPages:   1,
            $container,
            $currentItems: $allItems
        };

        oziSearchSetPaginationState($input, state);
        oziSearchRenderPagination($input, $allItems, pageSize, 1);

        return true;
    }

    function oziSearchUpdatePagination($input, $visibleItems) {
        const state = oziSearchGetPaginationState($input);
        if (!state) return false;

        state.$currentItems = $visibleItems;
        oziSearchSetPaginationState($input, state);
        oziSearchRenderPagination($input, $visibleItems, state.pageSize, 1);

        return true;
    }

    // ------------------------------------------
    // EVENTO PRINCIPAL
    // ------------------------------------------

    $(document).on('input', '[data-ozi-search]', function () {
        const $input = $(this);

        const minLengthRaw = oziSearchGetAttr($input, 'data-ozi-search-min');
        const minLength    = Number.isNaN(parseInt(minLengthRaw, 10))
            ? 0
            : parseInt(minLengthRaw, 10);

        const words = oziSearchIsTrue(
            oziSearchGetFirstAttr($input, [
                'data-ozi-search-words',
                'data-ozi-search-multi'
            ])
        );

        const noFilter = oziSearchIsTrue(
            oziSearchGetAttr($input, 'data-ozi-search-no-filter')
        );

        const highlight        = oziSearchGetAttr($input, 'data-ozi-search-highlight');
        const highlightEnabled = highlight !== undefined && !oziSearchIsFalse(highlight);
        const highlightClass   =
            highlight === undefined ||
            highlight === ''        ||
            oziSearchIsTrue(highlight)
                ? 'ozi-search-highlight'
                : String(highlight).trim();

        const hasPagination = oziSearchGetAttr($input, 'data-ozi-search-pagination') !== undefined;

        const $items  = oziSearchResolveItems($input);
        const $groups = oziSearchResolveGroups($input);

        if (!$items.length) return;

        // init paginação na primeira execução
        if (hasPagination && !oziSearchGetPaginationState($input)) {
            oziSearchInitPagination($input, $items);
        }

        oziSearchStoreOriginalHtml($items);
        oziSearchClearHighlights($items);
        oziSearchStoreOriginalVisibility($items);
        oziSearchStoreOriginalVisibility($groups);

        const value = String($input.val() || '').trim();

        // busca vazia — restaura
        if (value === '' || value.length < minLength) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);

            if (hasPagination) {
                oziSearchUpdatePagination($input, $items);
            }

            return;
        }

        const terms   = words ? value.split(/\s+/).filter(Boolean) : [value];
        const pattern = oziSearchNormalizeTerms(terms);

        if (!pattern) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);

            if (hasPagination) {
                oziSearchUpdatePagination($input, $items);
            }

            return;
        }

        const regexTest      = oziSearchBuildRegex(pattern, false);
        const regexHighlight = oziSearchBuildRegex(pattern, true);

        // modo sem filtro — só highlight
        if (noFilter) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);

            if (highlightEnabled) {
                $items.filter(':visible').each(function () {
                    oziSearchApplyHighlight($(this), regexHighlight, highlightClass);
                });
            }

            return;
        }

        // filtra itens
        const matched = [];

        $items.each(function () {
            const $item = $(this);

            if ($item.data('__oziSearchOriginalVisible') === '0') {
                $item.hide();
                return;
            }

            if (regexTest.test($item.text())) {
                $item.show();

                if (highlightEnabled) {
                    oziSearchApplyHighlight($item, regexHighlight, highlightClass);
                }

                matched.push(this);
            } else {
                $item.hide();
            }
        });

        const $matched = $(matched);
        oziSearchUpdateGroups($groups, $items);

        // atualiza paginação com itens filtrados
        if (hasPagination) {
            oziSearchUpdatePagination($input, $matched);
        }
    });

    // ------------------------------------------
    // INIT — paginação no carregamento
    // ------------------------------------------
// DEPOIS
    function oziSearchInitPaginationInScope(root) {
        const $scope = root ? $(root) : $(document);

        $scope.find('[data-ozi-search][data-ozi-search-pagination]')
            .addBack('[data-ozi-search][data-ozi-search-pagination]')
            .each(function () {
                const $input = $(this);

                if ($input.data('__oziSearchPaginationReady')) return;
                $input.data('__oziSearchPaginationReady', true);

                const $items = oziSearchResolveItems($input);
                if (!$items.length) return;

                $items.show();
                oziSearchStoreOriginalVisibility($items);
                oziSearchInitPagination($input, $items);
            });
    }

    $(function () {
        oziSearchInitPaginationInScope(document);
    });

// afterRender — conteúdo dinâmico via oziLoadData
    if (
        window.zldConf &&
        window.zldConf.zldHooks &&
        Array.isArray(window.zldConf.zldHooks.afterRender)
    ) {
        const alreadyBound = window.zldConf.zldHooks.afterRender.some(function (fn) {
            return fn && fn.__oziSearchAfterRender === true;
        });

        if (!alreadyBound) {
            const hook = function (root) {
                oziSearchInitPaginationInScope(root);
            };
            hook.__oziSearchAfterRender = true;
            window.zldConf.zldHooks.afterRender.push(hook);
        }
    }

})(jQuery);