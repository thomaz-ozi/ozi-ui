(function ($) {
    'use strict';

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

    $(document).on('input', '[data-ozi-search]', function () {
        const $input = $(this);

        const minLengthRaw = oziSearchGetAttr($input, 'data-ozi-search-min');
        const minLength = Number.isNaN(parseInt(minLengthRaw, 10))
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

        const highlight    = oziSearchGetAttr($input, 'data-ozi-search-highlight');
        const highlightEnabled = highlight !== undefined && !oziSearchIsFalse(highlight);
        const highlightClass   =
            highlight === undefined ||
            highlight === ''        ||
            oziSearchIsTrue(highlight)
                ? 'bg-dark text-white'
                : String(highlight).trim();

        const $items  = oziSearchResolveItems($input);
        const $groups = oziSearchResolveGroups($input);

        if (!$items.length) return;

        oziSearchStoreOriginalHtml($items);
        oziSearchClearHighlights($items);
        oziSearchStoreOriginalVisibility($items);
        oziSearchStoreOriginalVisibility($groups);

        const value = String($input.val() || '').trim();

        if (value === '' || value.length < minLength) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);
            return;
        }

        const terms   = words ? value.split(/\s+/).filter(Boolean) : [value];
        const pattern = oziSearchNormalizeTerms(terms);

        if (!pattern) {
            oziSearchRestoreVisibility($items);
            oziSearchRestoreVisibility($groups);
            return;
        }

        const regexTest      = oziSearchBuildRegex(pattern, false);
        const regexHighlight = oziSearchBuildRegex(pattern, true);

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

        oziSearchUpdateGroups($groups, $items);
    });

})(jQuery);