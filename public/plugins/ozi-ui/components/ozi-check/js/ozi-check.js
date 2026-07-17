/**
 * ------------------------------------------
 * ozi-check
 * ------------------------------------------
 * Ver: 3.0.0
 * 2026-07-04
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
 * Dependências: ozi.js (OZI.hooks, OZI.helpers) — zero jQuery (contrato de camadas v2).
 * Expõe: OZI.components.check, window.OziCheck (compat)
 * Eventos: ozi:check-change
 *
 * Changelog:
 *   - v3.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Coleta/estado via querySelectorAll/classList/propriedades nativas
 *         (checked/indeterminate/disabled) — zero jQuery.
 *       - Delegacao de 'change' nativa em document (closest() por seletor,
 *         3 listeners independentes — switch/group/item — mesma estrutura da v1).
 *       - Fim do dual-dispatch: _emit() usa somente OZI.helpers.emit(). O
 *         payload original tinha uma chave `source` ('switch'|'group'|'item')
 *         que colidia com o `source` do contrato ('user'|'api') — renomeada
 *         para `level`; demais chaves preservadas no detail.
 *       - Removido o listener de evento jQuery customizado 'oziCheck:initFetched'
 *         do componente (nao pode existir em modules/components/behaviors —
 *         contrato de camadas v2 §2). Documentado como compat opcional em
 *         integrations/adapters/ozi-check-v1-events.shim.js para hosts que
 *         ainda disparam esse evento via jQuery. O alias por chamada direta
 *         window.oziCheckInitFetched(root) continua funcionando sem jQuery.
 *       - API publica inalterada: OZI.components.check.{init,refresh,getGroups,
 *         getGroupElements,isGroupEnabled,setGroupEnabledState,setAllItems,
 *         syncGroup,syncAllGroups}; window.OziCheck mantido.
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

(function (window, document) {
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
     * Retorna { switchEls, groupEls, itemEls } (Array<Element>) para o
     * grupo dentro do scope. switchEls inclui tanto match exato quanto
     * switch multi-grupo CSV.
     */
    function getGroupElements(group, scope) {
        var root = scope || document;

        function find(attr) {
            var sel = '[' + attr + '="' + group + '"]';
            return Array.prototype.slice.call(root.querySelectorAll(sel));
        }

        // switch exato: data-ozi-check-switch="norte"
        var switchExact = find('data-ozi-check-switch');

        // switch multi-grupo: data-ozi-check-switch="nordeste,norte"
        var switchMulti = Array.prototype.filter.call(root.querySelectorAll(SEL_SWITCH), function (el) {
            var groups = _parseGroupList(el.getAttribute('data-ozi-check-switch'));
            return groups.length > 1 && groups.indexOf(group) !== -1;
        });

        var switchEls = switchExact.slice();
        switchMulti.forEach(function (el) { if (switchEls.indexOf(el) === -1) switchEls.push(el); });

        return {
            switchEls: switchEls,
            groupEls:  find('data-ozi-check-group'),
            itemEls:   find('data-ozi-check-item')
        };
    }

    /**
     * getGroups(scope)
     * Coleta todos os nomes de grupos únicos dentro do scope.
     * Expande CSV do switch em grupos individuais.
     */
    function getGroups(scope) {
        var root   = scope || document;
        var groups = [];

        var all = root.querySelectorAll(SEL_SWITCH + ', ' + SEL_GROUP + ', ' + SEL_ITEM);

        Array.prototype.forEach.call(all, function (el) {
            var raw = el.getAttribute('data-ozi-check-switch')
                || el.getAttribute('data-ozi-check-group')
                || el.getAttribute('data-ozi-check-item')
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
        if (!els.switchEls.length) return true;
        return els.switchEls[0].checked === true;
    }

    /**
     * _applyDisabledVisual(els, disabled)
     * Aplica/remove prop disabled + classe CSS .ozi-check-disabled.
     * NÃO toca em checked ou indeterminate.
     */
    function _applyDisabledVisual(els, disabled) {
        els.forEach(function (el) {
            el.disabled = disabled;
            el.classList.toggle(CSS_DISABLED, disabled);
        });
    }

    /**
     * setGroupEnabledState(group, enabled, scope)
     * Habilita ou desabilita group + items do grupo.
     * NÃO altera o estado de marcação — preserva checked/indeterminate.
     */
    function setGroupEnabledState(group, enabled, scope) {
        var els = getGroupElements(group, scope);

        if (!enabled) {
            _applyDisabledVisual(els.groupEls, true);
            _applyDisabledVisual(els.itemEls, true);
            _emit(group, { group: group, enabled: false, source: 'switch' }, scope);
        } else {
            _applyDisabledVisual(els.groupEls, false);
            _applyDisabledVisual(els.itemEls, false);
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
        els.itemEls.forEach(function (el) { if (!el.disabled) el.checked = !!checked; });
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

        if (!els.groupEls.length) return;

        var activeItems  = els.itemEls.filter(function (el) { return !el.disabled; });
        var total        = activeItems.length;
        var checkedCount = activeItems.filter(function (el) { return el.checked; }).length;

        var checkedState, indeterminateState;
        if (total === 0 || checkedCount === 0) {
            checkedState = false; indeterminateState = false;
        } else if (checkedCount === total) {
            checkedState = true; indeterminateState = false;
        } else {
            checkedState = false; indeterminateState = true;
        }

        els.groupEls.forEach(function (el) {
            el.checked = checkedState;
            el.indeterminate = indeterminateState;
        });
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

            _applyDisabledVisual(els.groupEls, !enabled);
            _applyDisabledVisual(els.itemEls, !enabled);
            syncGroup(group, scope);
        });
    }


    // ─────────────────────────────────────────────
    // [5] EVENTOS — delegação nativa no document
    // ─────────────────────────────────────────────

    function _bindSwitch() {
        document.addEventListener('change', function (e) {
            var el = e.target.closest(SEL_SWITCH);
            if (!el) return;

            var raw = (el.getAttribute('data-ozi-check-switch') || '').trim();
            if (!raw) return;

            var enabled = el.checked === true;

            // itera cada grupo do CSV
            _parseGroupList(raw).forEach(function (group) {
                setGroupEnabledState(group, enabled);
            });
        });
    }

    function _bindGroup() {
        document.addEventListener('change', function (e) {
            var el = e.target.closest(SEL_GROUP);
            if (!el) return;

            var group = (el.getAttribute('data-ozi-check-group') || '').trim();
            if (!group) return;

            if (!isGroupEnabled(group)) return;

            setAllItems(group, el.checked === true);
        });
    }

    function _bindItem() {
        document.addEventListener('change', function (e) {
            var el = e.target.closest(SEL_ITEM);
            if (!el) return;

            var group = (el.getAttribute('data-ozi-check-item') || '').trim();
            if (!group) return;

            if (!isGroupEnabled(group)) return;

            syncGroup(group);
            _emit(group, {
                group:   group,
                source:  'item',
                checked: el.checked,
                value:   el.value
            });
        });
    }


    // ─────────────────────────────────────────────
    // [6] EMIT — contrato v2, sem dual-dispatch
    // Nota: o payload original usa `source` para indicar o nivel
    // (switch/group/item) — renomeado para `level` para nao colidir com
    // o `source` do contrato ('user'|'api').
    // ─────────────────────────────────────────────

    function _emit(group, payload, scope) {
        payload = payload || {};
        var els    = getGroupElements(group, scope);
        var origin = els.switchEls[0] || els.groupEls[0] || els.itemEls[0] || document;

        var detail = {
            component: 'ozi-check',
            name:      group,
            value:     (payload.checked !== undefined) ? payload.checked : (payload.enabled !== undefined ? payload.enabled : null),
            source:    'user'
        };
        Object.keys(payload).forEach(function (k) {
            if (k === 'source') { detail.level = payload.source; return; }
            if (k === 'group')  return; // ja e o "name"
            detail[k] = payload[k];
        });

        var helpers = window.OZI && window.OZI.helpers;
        if (helpers && typeof helpers.emit === 'function') {
            helpers.emit(origin, 'ozi:check-change', detail);
        } else if (typeof CustomEvent === 'function') {
            origin.dispatchEvent(new CustomEvent('ozi:check-change', { bubbles: true, detail: detail }));
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
        var isJq = root && typeof window.jQuery !== 'undefined' && root instanceof window.jQuery; // guard-ok: compat v1, sem dependência
        var target = isJq ? root[0] : root;
        refresh(target || document);
    };


    // ─────────────────────────────────────────────
    // [10] COMPAT ZLD — zldConf.zldHooks.afterRender
    // Nota: o listener do evento jQuery customizado 'oziCheck:initFetched'
    // saiu daqui (contrato de camadas v2 §2 — jQuery só em integrations/).
    // Disponivel como shim opcional em
    // integrations/adapters/ozi-check-v1-events.shim.js.
    // ─────────────────────────────────────────────

    function _bindZldCompat() {
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
                    var isJq = root && typeof window.jQuery !== 'undefined' && root instanceof window.jQuery; // guard-ok: compat v1, sem dependência
                    var target = isJq ? root[0] : root;
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

    function _boot() {
        init();
        _bindZldCompat();

        if (window.OZI && window.OZI.hooks) {
            window.OZI.hooks.afterRender.register('component:check', function () {
                refresh();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})(window, document);
