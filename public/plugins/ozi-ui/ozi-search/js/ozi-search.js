/**
 * ------------------------------------------
 * oziSearch
 * ------------------------------------------
 * Ver: (1.5)
 * 2026-04-08
 * ------------------------------------------
 * @description
 * Realiza busca textual em listas, grupos e menus hierárquicos,
 * com suporte a filtro, múltiplas palavras e highlight.
 *
 * RECURSOS
 * busca simples         → localiza termos em itens visíveis
 * busca por palavras    → permite procurar múltiplos termos no mesmo campo
 * highlight             → destaca visualmente os termos encontrados
 * filtro opcional       → permite apenas destacar sem ocultar itens
 * grupos dinâmicos      → oculta grupos pais sem itens visíveis
 * menu hierárquico      → expande e recolhe blocos de menu conforme os resultados
 *
 * ATRIBUTOS
 * data-ozi-search           → define os itens onde a busca será aplicada
 * data-ozi-search-group     → define os grupos pais que devem ser ocultados quando não houver itens visíveis
 * data-ozi-search-menu      → define a estrutura de menu hierárquico e a classe de colapso
 *                             ex: "pesqMenu, hidden" | "pesqMenu, mm-collapse"
 * data-ozi-search-min       → define a quantidade mínima de caracteres antes de iniciar a busca
 * data-ozi-search-words     → ativa a busca por múltiplas palavras
 * data-ozi-search-highlight → ativa o highlight padrão ou recebe classes CSS para personalizar o destaque
 *                             ex: "bg-warning text-dark fw-bold"
 * data-ozi-search-no-filter → destaca os termos encontrados sem ocultar os itens
 *
 * COMPORTAMENTO
 * busca vazia           → restaura o estado original dos itens, grupos e menus
 * busca com filtro      → oculta itens não encontrados e reorganiza grupos e menus
 * busca sem filtro      → mantém todos os itens visíveis e aplica somente highlight
 * highlight padrão      → aplica classes visuais padrão quando ativado com true
 * highlight customizado → aplica as classes CSS informadas no atributo
 *
 * @example
 * <input
 *     type="text"
 *     class="form-control"
 *     data-ozi-search=".item-menu"
 *     data-ozi-search-group=".grupo-menu"
 *     data-ozi-search-menu="pesqMenu, mm-collapse"
 *     data-ozi-search-min="1"
 *     data-ozi-search-words="true"
 *     data-ozi-search-highlight="bg-dark text-white"
 * />
 */


(function ($) {
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

        // 1) tenta exatamente como veio
        let $elements = $(rawSelector);
        if ($elements.length) return $elements;

        // 2) se for um nome simples, tenta como classe
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

    function oziSearchParseMenuConfig(rawValue) {
        rawValue = String(rawValue || '').trim();
        if (!rawValue) return null;

        const parts = rawValue
            .split(',')
            .map(part => String(part).trim())
            .filter(Boolean);

        if (!parts.length) return null;

        let menuSelector = parts[0];

        // tenta puro primeiro; se for simples, depois classe
        if (!/[.#\[\]:\s>+~]/.test(menuSelector)) {
            const $test = $(menuSelector);
            if (!$test.length) {
                menuSelector = '.' + menuSelector;
            }
        }

        let collapseClass = parts[1] || 'hidden';
        collapseClass = collapseClass.replace(/^\./, '').trim();

        return {
            menuSelector,
            collapseClass
        };
    }

    function oziSearchResolveMenuBlocks($input, menuConfig) {
        if (!menuConfig) return $();
        return oziSearchResolveElements(menuConfig.menuSelector);
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

    function oziSearchStoreMenuState($menuBlocks, menuConfig) {
        if (!$menuBlocks.length || !menuConfig) return;

        const $allMenuBlocks = $menuBlocks
            .filter(menuConfig.menuSelector)
            .add($menuBlocks.find(menuConfig.menuSelector));

        oziSearchStoreOriginalVisibility($allMenuBlocks);

        const collapseSelector = '.' + menuConfig.collapseClass;

        $allMenuBlocks.find(collapseSelector).each(function () {
            const $el = $(this);

            if ($el.data('__oziSearchOriginalCollapsed') !== undefined) return;
            $el.data('__oziSearchOriginalCollapsed', '1');
        });
    }

    function oziSearchRestoreMenu($menuBlocks, menuConfig) {
        if (!$menuBlocks.length || !menuConfig) return;

        const $allMenuBlocks = $menuBlocks
            .filter(menuConfig.menuSelector)
            .add($menuBlocks.find(menuConfig.menuSelector));

        oziSearchRestoreVisibility($allMenuBlocks);

        $allMenuBlocks.find('*').each(function () {
            const $el = $(this);
            const originalCollapsed = $el.data('__oziSearchOriginalCollapsed');

            if (originalCollapsed === undefined) return;

            if (originalCollapsed === '1') {
                $el.addClass(menuConfig.collapseClass);
            } else {
                $el.removeClass(menuConfig.collapseClass);
            }
        });
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

    function oziSearchUpdateMenu($menuBlocks, $items, menuConfig) {
        if (!$menuBlocks.length || !$items.length || !menuConfig) return;

        const $allMenuBlocks = $menuBlocks
            .filter(menuConfig.menuSelector)
            .add($menuBlocks.find(menuConfig.menuSelector));

        $allMenuBlocks.find('*').each(function () {
            const $el = $(this);
            const originalCollapsed = $el.data('__oziSearchOriginalCollapsed');

            if (originalCollapsed === undefined) return;

            if (originalCollapsed === '1') {
                $el.addClass(menuConfig.collapseClass);
            } else {
                $el.removeClass(menuConfig.collapseClass);
            }
        });

        const orderedBlocks = $(
            $allMenuBlocks.get().sort(function (a, b) {
                return $(b).parents(menuConfig.menuSelector).length - $(a).parents(menuConfig.menuSelector).length;
            })
        );

        orderedBlocks.each(function () {
            const $block = $(this);

            if ($block.data('__oziSearchOriginalVisible') === '0') {
                $block.hide();
                return;
            }

            const hasVisibleItems = $items.filter(function () {
                return $.contains($block[0], this) && $(this).is(':visible');
            }).length > 0;

            $block.toggle(hasVisibleItems);
        });

        const collapseSelector = '.' + menuConfig.collapseClass;

        $items.filter(':visible').each(function () {
            const $item = $(this);

            $item.parents(menuConfig.menuSelector).each(function () {
                const $block = $(this);

                if ($block.data('__oziSearchOriginalVisible') !== '0') {
                    $block.show();
                }
            });

            $item.parents(collapseSelector).each(function () {
                $(this).removeClass(menuConfig.collapseClass).show();
            });
        });
    }

    $(document).on('input', '[data-ozi-search]', function () {
        const $input = $(this);

        const minLengthRaw = oziSearchGetAttr($input, 'data-ozi-search-min');
        const minLength = Number.isNaN(parseInt(minLengthRaw, 10))
            ? 0
            : parseInt(minLengthRaw, 10);

        // compatibilidade nova + antiga
        const words = oziSearchIsTrue(
            oziSearchGetFirstAttr($input, [
                'data-ozi-search-words',
                'data-ozi-search-multi'
            ])
        );

        const noFilter = oziSearchIsTrue(
            oziSearchGetAttr($input, 'data-ozi-search-no-filter')
        );

        const highlight = oziSearchGetAttr($input, 'data-ozi-search-highlight');

        const highlightEnabled =
            highlight !== undefined &&
            !oziSearchIsFalse(highlight);

        const highlightClass =
            highlight === undefined ||
            highlight === '' ||
            oziSearchIsTrue(highlight)
                ? 'bg-dark text-white'
                : String(highlight).trim();

        const menuConfig = oziSearchParseMenuConfig(
            oziSearchGetAttr($input, 'data-ozi-search-menu')
        );

        const $items = oziSearchResolveItems($input);
        const $groups = oziSearchResolveGroups($input);
        const $menuBlocks = oziSearchResolveMenuBlocks($input, menuConfig);

        if (!$items.length) return;

        oziSearchStoreOriginalHtml($items);
        oziSearchClearHighlights($items);

        oziSearchStoreOriginalVisibility($items);
        oziSearchStoreOriginalVisibility($groups);
        oziSearchStoreMenuState($menuBlocks, menuConfig);

        const value = String($input.val() || '').trim();

        if (value === '' || value.length < minLength) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);
            oziSearchRestoreMenu($menuBlocks, menuConfig);
            return;
        }

        const terms = words
            ? value.split(/\s+/).filter(Boolean)
            : [value];

        const pattern = oziSearchNormalizeTerms(terms);

        if (!pattern) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);
            oziSearchRestoreMenu($menuBlocks, menuConfig);
            return;
        }

        const regexTest = oziSearchBuildRegex(pattern, false);
        const regexHighlight = oziSearchBuildRegex(pattern, true);

        if (noFilter) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);
            oziSearchRestoreMenu($menuBlocks, menuConfig);

            if (highlightEnabled) {
                $items.filter(':visible').each(function () {
                    oziSearchApplyHighlight($(this), regexHighlight, highlightClass);
                });
            }

            return;
        }

        $items.each(function () {
            const $item = $(this);

            if ($item.data('__oziSearchOriginalVisible') === '0') {
                $item.hide();
                return;
            }

            const text = $item.text();

            if (regexTest.test(text)) {
                $item.show();

                if (highlightEnabled) {
                    oziSearchApplyHighlight($item, regexHighlight, highlightClass);
                }
            } else {
                $item.hide();
            }
        });

        oziSearchUpdateMenu($menuBlocks, $items, menuConfig);
        oziSearchUpdateGroups($groups, $items);
    });
})(jQuery);
