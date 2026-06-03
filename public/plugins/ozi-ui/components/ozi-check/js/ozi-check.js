/**
 * ------------------------------------------
 * ozi-check
 * ------------------------------------------
 * Ver: 2.2.0
 * 2026-06-01
 *
 * Responsabilidade:
 *   - Gerenciar checkboxes hierárquicos em 3 níveis por grupo
 *   - Hierarquia: switch → group → item
 *   - Estado tristate (indeterminate) automático no "group"
 *   - Singleton puro — sem estado interno, lê o DOM a cada operação
 *
 * Atributos:
 *   data-ozi-check-switch="grupo"            ← habilita/desabilita 1 grupo
 *   data-ozi-check-switch="grupo1,grupo2"    ← habilita/desabilita N grupos simultaneamente
 *   data-ozi-check-group="grupo"             ← marca/desmarca todos os items do grupo
 *   data-ozi-check-item="grupo"              ← checkbox individual
 *
 * Dependências: ozi.js (OZI.hooks)
 * Expõe: OZI.components.check, window.OziCheck (compat)
 * Eventos: ozi:check-change
 *
 * Changelog v2.2.0:
 *   - [BREAKING] data-ozi-check-enabled    → data-ozi-check-switch
 *   - [BREAKING] data-ozi-check-all        → data-ozi-check-group
 *   - data-ozi-check-item permanece inalterado
 *   - data-ozi-check-switch aceita lista CSV de grupos
 *   - switch com "grupo1,grupo2" controla ambos simultaneamente
 *   - getGroups() expande CSV — grupos individuais corretamente coletados
 *   - getGroupElements() encontra switch multi-grupo via filter
 *   - _bindSwitch() itera cada grupo do CSV ao mudar estado
 *
 * Changelog v2.1.0:
 *   - [BREAKING] enabled não altera mais o estado de marcação
 *   - enabled controla apenas interatividade (disabled/enabled visual)
 *   - Preserva checked/indeterminate ao desabilitar e reabilitar grupo
 *   - syncGroup sempre reflete estado real dos items, independente do enabled
 *
 * Changelog v2.0.0 / v1.0.1:
 *   - Corrigido: loop recursivo syncGroup → setGroupEnabledState (v0.x)
 *   - Corrigido: syncAllGroups chamava syncGroup duas vezes quando enabled (v0.x)
 *   - Corrigido: scope mantido nos métodos de leitura/sync
 *   - Corrigido: binds sempre delegados no document
 *   - Adicionado: classe CSS .ozi-check-disabled aplicada nos elementos desabilitados
 *   - Adicionado: ozi:check-change em todos os pontos de mudança de estado
 *   - Adicionado: hook OZI.hooks.afterRender registrado como 'component:check'
 *   - Mantido: compatibilidade oziCheckInitFetched + zldConf.zldHooks.afterRender
 */

(function ($, window, document) {
    'use strict';

    // ─────────────────────────────────────────────
    // [1] GUARD — Singleton
    // ─────────────────────────────────────────────

    if (window.OziCheck) return;


    // ─────────────────────────────────────────────
    // [2] SELETORES
    // ─────────────────────────────────────────────

    var SEL_SWITCH   = '[data-ozi-check-switch]';
    var SEL_GROUP    = '[data-ozi-check-group]';
    var SEL_ITEM     = '[data-ozi-check-item]';
    var CSS_DISABLED = 'ozi-check-disabled';

    /**
     * _parseGroupList(attrValue)
     * "nordeste,norte" → ['nordeste', 'norte']
     * "sul"            → ['sul']
     */
    function _parseGroupList(attrValue) {
        if (!attrValue) return [];
        return String(attrValue).split(',').map(function (g) { return g.trim(); }).filter(Boolean);
    }


    // ─────────────────────────────────────────────
    // [3] COLETA DE ELEMENTOS POR GRUPO
    // ─────────────────────────────────────────────

    /**
     * getGroupElements(group, scope)
     * Retorna { $switch, $group, $items } para o grupo dentro do scope.
     * $switch inclui tanto match exato quanto switch multi-grupo CSV.
     */
    function getGroupElements(group, scope) {
        var $scope = scope ? $(scope) : $(document);
        var isDoc  = !scope || scope === document;

        function find(attr) {
            var sel = '[' + attr + '="' + group + '"]';
            return isDoc ? $(sel) : $scope.find(sel);
        }

        // switch exato: data-ozi-check-switch="norte"
        var $switchExact = find('data-ozi-check-switch');

        // switch multi-grupo: data-ozi-check-switch="nordeste,norte"
        var $switchMulti = (isDoc ? $(SEL_SWITCH) : $scope.find(SEL_SWITCH))
            .filter(function () {
                var groups = _parseGroupList($(this).attr('data-ozi-check-switch'));
                return groups.length > 1 && groups.indexOf(group) !== -1;
            });

        return {
            $switch: $switchExact.add($switchMulti),
            $group:  find('data-ozi-check-group'),
            $items:  find('data-ozi-check-item')
        };
    }

    /**
     * getGroups(scope)
     * Coleta todos os nomes de grupos únicos dentro do scope.
     * Expande CSV do switch em grupos individuais.
     */
    function getGroups(scope) {
        var $scope = scope ? $(scope) : $(document);
        var isDoc  = !scope || scope === document;
        var groups = [];

        var $all = isDoc
            ? $(SEL_SWITCH + ', ' + SEL_GROUP + ', ' + SEL_ITEM)
            : $scope.find(SEL_SWITCH + ', ' + SEL_GROUP + ', ' + SEL_ITEM);

        $all.each(function () {
            var raw = $(this).attr('data-ozi-check-switch')
                || $(this).attr('data-ozi-check-group')
                || $(this).attr('data-ozi-check-item')
                || '';

            _parseGroupList(raw).forEach(function (g) {
                if (groups.indexOf(g) === -1) groups.push(g);
            });
        });

        return groups;
    }


    // ─────────────────────────────────────────────
    // [4] ESTADO DO GRUPO
    // ─────────────────────────────────────────────

    /**
     * isGroupEnabled(group, scope)
     * true se o switch está marcado (ou ausente — grupo sempre ativo).
     */
    function isGroupEnabled(group, scope) {
        var els = getGroupElements(group, scope);
        if (!els.$switch.length) return true;
        return els.$switch.first().prop('checked') === true;
    }

    /**
     * _applyDisabledVisual($els, disabled)
     * Aplica/remove prop disabled + classe CSS .ozi-check-disabled.
     * NÃO toca em checked ou indeterminate.
     */
    function _applyDisabledVisual($els, disabled) {
        $els.prop('disabled', disabled);
        if (disabled) {
            $els.addClass(CSS_DISABLED);
        } else {
            $els.removeClass(CSS_DISABLED);
        }
    }

    /**
     * setGroupEnabledState(group, enabled, scope)
     * Habilita ou desabilita group + items do grupo.
     * NÃO altera o estado de marcação — preserva checked/indeterminate.
     */
    function setGroupEnabledState(group, enabled, scope) {
        var els = getGroupElements(group, scope);

        if (!enabled) {
            _applyDisabledVisual(els.$group, true);
            _applyDisabledVisual(els.$items, true);
            _emit(group, { group: group, enabled: false, source: 'switch' }, scope);
        } else {
            _applyDisabledVisual(els.$group, false);
            _applyDisabledVisual(els.$items, false);
            syncGroup(group, scope);
            _emit(group, { group: group, enabled: true, source: 'switch' }, scope);
        }
    }

    /**
     * setAllItems(group, checked, scope)
     * Marca ou desmarca todos os items não-disabled do grupo.
     */
    function setAllItems(group, checked, scope) {
        var els = getGroupElements(group, scope);
        els.$items.not(':disabled').prop('checked', !!checked);
        syncGroup(group, scope);
        _emit(group, { group: group, checked: checked, source: 'group' }, scope);
    }

    /**
     * syncGroup(group, scope)
     * Calcula e aplica estado tristate do "group" conforme items.
     * Sempre reflete o estado real — independente de o grupo estar enabled ou não.
     */
    function syncGroup(group, scope) {
        var els = getGroupElements(group, scope);

        if (!els.$group.length) return;

        var $activeItems = els.$items.not(':disabled');
        var total        = $activeItems.length;
        var checkedCount = $activeItems.filter(':checked').length;

        if (total === 0 || checkedCount === 0) {
            els.$group.prop('checked', false).prop('indeterminate', false);
        } else if (checkedCount === total) {
            els.$group.prop('checked', true).prop('indeterminate', false);
        } else {
            els.$group.prop('checked', false).prop('indeterminate', true);
        }
    }

    /**
     * syncAllGroups(scope)
     * Sincroniza visual de disabled + tristate de todos os grupos.
     * NÃO altera checked de nenhum item.
     */
    function syncAllGroups(scope) {
        getGroups(scope).forEach(function (group) {
            var enabled = isGroupEnabled(group, scope);
            var els     = getGroupElements(group, scope);

            _applyDisabledVisual(els.$group, !enabled);
            _applyDisabledVisual(els.$items, !enabled);
            syncGroup(group, scope);
        });
    }


    // ─────────────────────────────────────────────
    // [5] EVENTOS — delegação no document
    // ─────────────────────────────────────────────

    function _bindSwitch() {
        $(document)
            .off('change.oziCheckSwitch')
            .on('change.oziCheckSwitch', SEL_SWITCH, function () {
                var raw = ($(this).attr('data-ozi-check-switch') || '').trim();
                if (!raw) return;

                var enabled = $(this).prop('checked') === true;

                // itera cada grupo do CSV
                _parseGroupList(raw).forEach(function (group) {
                    setGroupEnabledState(group, enabled);
                });
            });
    }

    function _bindGroup() {
        $(document)
            .off('change.oziCheckGroup')
            .on('change.oziCheckGroup', SEL_GROUP, function () {
                var group = ($(this).attr('data-ozi-check-group') || '').trim();
                if (!group) return;

                if (!isGroupEnabled(group)) return;

                var checked = $(this).prop('checked') === true;
                setAllItems(group, checked);
            });
    }

    function _bindItem() {
        $(document)
            .off('change.oziCheckItem')
            .on('change.oziCheckItem', SEL_ITEM, function () {
                var group = ($(this).attr('data-ozi-check-item') || '').trim();
                if (!group) return;

                if (!isGroupEnabled(group)) return;

                syncGroup(group);
                _emit(group, {
                    group:   group,
                    source:  'item',
                    checked: $(this).prop('checked'),
                    value:   $(this).val()
                });
            });
    }


    // ─────────────────────────────────────────────
    // [6] EMIT
    // ─────────────────────────────────────────────

    function _emit(group, payload) {
        var els      = getGroupElements(group);
        var $targets = els.$switch.add(els.$group).add(els.$items);

        $targets.first().trigger('ozi:check-change', [payload]);

        if (typeof CustomEvent === 'function') {
            document.dispatchEvent(new CustomEvent('ozi:check-change', {
                bubbles: true,
                detail:  payload
            }));
        }
    }


    // ─────────────────────────────────────────────
    // [7] INIT / REFRESH
    // ─────────────────────────────────────────────

    function init() {
        _bindSwitch();
        _bindGroup();
        _bindItem();
        syncAllGroups();
    }

    function refresh(scope) {
        syncAllGroups(scope || document);
    }


    // ─────────────────────────────────────────────
    // [8] API PÚBLICA — OZI.components.check
    // ─────────────────────────────────────────────

    var check = {
        init:                 init,
        refresh:              refresh,
        getGroups:            getGroups,
        getGroupElements:     getGroupElements,
        isGroupEnabled:       isGroupEnabled,
        setGroupEnabledState: setGroupEnabledState,
        setAllItems:          setAllItems,
        syncGroup:            syncGroup,
        syncAllGroups:        syncAllGroups
    };


    // ─────────────────────────────────────────────
    // [9] EXPOSIÇÃO
    // ─────────────────────────────────────────────

    if (window.OZI && window.OZI.components) {
        window.OZI.components.check = check;
    }

    window.OziCheck = check;

    window.oziCheckInitFetched = function (root) {
        console.warn('[OZI] oziCheckInitFetched depreciado. Use OZI.components.check.refresh().');
        var target = root instanceof jQuery ? root[0] : root;
        refresh(target || document);
    };


    // ─────────────────────────────────────────────
    // [10] COMPAT ZLD — zldConf.zldHooks.afterRender
    // ─────────────────────────────────────────────

    function _bindZldCompat() {
        $(document)
            .off('oziCheck:initFetched')
            .on('oziCheck:initFetched', function (e, root) {
                var target = root instanceof jQuery ? root[0] : root;
                refresh(target || document);
            });

        if (
            window.zldConf &&
            window.zldConf.zldHooks &&
            Array.isArray(window.zldConf.zldHooks.afterRender)
        ) {
            var alreadyBound = window.zldConf.zldHooks.afterRender.some(function (fn) {
                return fn && fn.__oziCheckAfterRender === true;
            });

            if (!alreadyBound) {
                var hook = function (root) {
                    var target = root instanceof jQuery ? root[0] : root;
                    refresh(target || document);
                };
                hook.__oziCheckAfterRender = true;
                window.zldConf.zldHooks.afterRender.push(hook);
            }
        }
    }


    // ─────────────────────────────────────────────
    // [11] AUTO-INIT E HOOKS
    // ─────────────────────────────────────────────

    $(function () {
        init();
        _bindZldCompat();

        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('component:check', function () {
                refresh();
            });
        }
    });

})(jQuery, window, document);