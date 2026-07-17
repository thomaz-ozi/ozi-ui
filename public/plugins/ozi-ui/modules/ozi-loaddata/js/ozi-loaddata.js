/**
 * ------------------------------------------
 * ozi-loaddata
 * ------------------------------------------
 * Ver: 5.0.0
 * 2026-07-03
 *
 * Responsabilidade:
 *   - Orquestra fetch, UI, progress bar, busy state, actions
 *   - Coleta e valida campos via OziCollector (ozi-loaddata-collector.js)
 *   - Renderiza HTML ou processa JSON no destino
 *   - Bind automatico de [data-zld-url] (click + change nativo)
 *   - Validacao interativa campo a campo
 *
 * O que NAO faz:
 *   - Nao valida diretamente — delega para OziCollector -> OZI.modules.validate
 *   - Nao conhece adapters de componentes OZI
 *
 * Dependencias:
 *   - ozi-loaddata-collector.js (auto-carregado antes do boot)
 *   - ozi-validate.js (OZI.modules.validate — carregado pelo ozi-conf antes deste)
 *   - zero jQuery (contrato de camadas v2)
 *
 * Expoe: window.oziLoadData, window.__zldConf
 *
 * Changelog:
 *   - v5.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Motor 100% nativo: querySelector/querySelectorAll/classList/insertAdjacentHTML
 *         no lugar de jQuery; AJAX ja era via fetch (sem mudanca).
 *       - zldGetProgressBar/zldApplyTriggerState/renderToDestiny/handleHttpErrorHtml/
 *         limpeza pos-envio (zldFormClear) reescritos sem $().
 *       - Delegacao de clique/change/interativa nativa via addEventListener + closest()
 *         (blur trocado por focusout — blur nao faz bubble, delegacao precisa de bubble).
 *       - zldSafeById passa a retornar Element nativo (era jQuery) — nenhum consumidor
 *         externo encontrado (grep no plugin inteiro); alinha com o alias de mesmo nome
 *         que o ozi-helpers v1.1.0 ja expõe (eliminava a divergência entre os dois).
 *       - Nao emite CustomEvent proprio (nunca emitiu — apenas orquestra render/hooks);
 *         nenhuma mudanca de contrato de eventos aqui.
 *       - API publica inalterada: window.oziLoadData, window.__zldConf, window.zldConf
 *         (getter), aliases zld* e oziLoaddata (compat v0.x).
 *   - v4.0.5: [FIX-HOOKS] zldRenderDependencies passa a disparar OZI.hooks apos
 *     os hooks do zldConf. Garante que plugins registrados em OZI.hooks.afterRender
 *     (ex: component:select) re-inicializam em conteudo carregado por fetch,
 *     sem depender da ponte instalada pelo ozi.js em _bridgeHooks().
 *   - v4.0.4: [FIX-CSS] zldResponseValidClass/InvalidClass defaults corrigidos
 *     de 'is-valid'/'is-invalid' (BS5) para 'ozi-valid'/'ozi-invalid' (neutro OZI).
 *     Adicionado _zldClassMap() — le OZI.conf.classMap primeiro, com zldConf
 *     como fallback. Mesma filosofia do _classMap() dos componentes.
 *     Dev com tema 'bootstrap5' recebe 'is-valid'/'is-invalid' automaticamente
 *     via classMap — sem precisar configurar zldConf separadamente.
 *   - v4.0.3: [FIX-P1] Removido window.oziConf = oziConf — sobrescrevia o
 *     window.oziConf do ozi.js (core), descartando configuracoes de tema,
 *     lang e plugins silenciosamente. A funcao oziConf() interna do loaddata
 *     configura apenas zldConf — e de uso exclusivamente interno.
 *   - v4.0.2: Removido oziValidateContainer interna — delegado para OziCollector.collect()
 *   - v4.0.2: Removido zldSyncTriggerState duplicava logica do validate — usa collector
 *   - v4.0.2: Removido funcoes internas de validacao (400+ linhas)
 *   - v4.0.2: Mantido toda a logica de fetch, progress, busy, actions, bind, hooks
 *   - v4.0.2: Adicionado auto-carregamento do collector via _loadCollector()
 */

(function (window, document) {
    'use strict';

    if (window.__zld_inited) return;
    window.__zld_inited = true;


    // ---------------------------------------------
    // [1] AUTO-CARREGAMENTO DO COLLECTOR
    // Detecta o proprio diretorio e carrega
    // ozi-loaddata-collector.js antes de iniciar.
    // Mesmo padrao usado pelo ozi.js para subsistemas.
    // ---------------------------------------------

    function _loadCollector() {
        return new Promise(function (resolve) {
            // ja carregado
            if (window.OziCollector) { resolve(); return; }

            // detecta o diretorio do proprio script
            var selfUrl = (function () {
                var scripts = document.getElementsByTagName('script');
                for (var i = 0; i < scripts.length; i++) {
                    var src = scripts[i].src || '';
                    if (/ozi-loaddata\.js(\?|$)/.test(src)) {
                        return src.replace(/ozi-loaddata\.js(\?.*)?$/, '');
                    }
                }
                return '';
            })();

            var collectorUrl = selfUrl + 'ozi-loaddata-collector.js';

            // evita duplicata
            if (document.querySelector('script[src="' + collectorUrl + '"]')) {
                resolve(); return;
            }

            var s    = document.createElement('script');
            s.type   = 'text/javascript';
            s.src    = collectorUrl;
            s.async  = false;

            s.onload  = function () { resolve(); };
            s.onerror = function () {
                console.error('[oziLoadData] falha ao carregar ozi-loaddata-collector.js');
                resolve(); // nao quebra o boot — collect() vai avisar
            };

            document.head.appendChild(s);
        });
    }


    // ---------------------------------------------
    // [2] CONFIGURACAO GLOBAL
    // ---------------------------------------------

    var zldConf = {
        zldProgressBarGlobalOption: true,
        zldProgressBarGlobalClass:  'ozi-progress',
        zldProgressLoadingClass:    'ozi-progress-loading',
        zldProgressSuccessClass:    'ozi-progress-success',
        zldProgressErrorClass:      'ozi-progress-error',

        // [FIX-CSS] defaults neutros OZI — classMap do tema sobrescreve via _zldClassMap()
        zldResponseValidClass:   'ozi-valid',
        zldResponseInvalidClass: 'ozi-invalid',

        zldInteractiveValidation: true,
        zldInteractiveEvents:     'input change blur',

        zldButtonDisabledClass: 'ozi-disabled',
        zldButtonEnabledClass:  '',
        zldUseNativeDisabled:   false,
        zldAriaDisabled:        true,

        zldAlertClass:        'ozi-alert',
        zldAlertWarningClass: 'ozi-alert-warning',
        zldAlertDangerClass:  'ozi-alert-danger',
        zldAlertMetaClass:    'ozi-alert-meta',

        zldHooks: {
            beforeRender: [],
            afterRender:  []
        },

        zldLog: false
    };


    // ---------------------------------------------
    // [3] API DE CONFIGURACAO INTERNA
    // Uso exclusivo interno — configura apenas zldConf.
    // NAO exportado para window — o ponto unico de
    // configuracao global e window.oziConf do ozi.js.
    // ---------------------------------------------

    function _applyZldConf(conf) {
        conf = conf || {};

        var assign = function (key, confKey) {
            confKey = confKey || key;
            if (conf[confKey] !== undefined) zldConf[key] = conf[confKey];
        };

        assign('zldProgressBarGlobalOption');
        assign('zldProgressBarGlobalClass');
        assign('zldProgressLoadingClass');
        assign('zldProgressSuccessClass');
        assign('zldProgressErrorClass');
        assign('zldResponseValidClass');
        assign('zldResponseInvalidClass');
        assign('zldInteractiveValidation');
        assign('zldInteractiveEvents');
        assign('zldButtonDisabledClass');
        assign('zldButtonEnabledClass');
        assign('zldUseNativeDisabled');
        assign('zldAriaDisabled');
        assign('zldAlertClass');
        assign('zldAlertWarningClass');
        assign('zldAlertDangerClass');
        assign('zldAlertMetaClass');
        assign('zldLog');

        if (conf.zldHooks) {
            if (Array.isArray(conf.zldHooks.beforeRender)) {
                zldConf.zldHooks.beforeRender = conf.zldHooks.beforeRender;
            }
            if (Array.isArray(conf.zldHooks.afterRender)) {
                zldConf.zldHooks.afterRender = conf.zldHooks.afterRender;
            }
        }

        return zldConf;
    }


    // ---------------------------------------------
    // [4] HELPERS
    // ---------------------------------------------

    function zldParseBool(val) {
        if (val === undefined || val === null) return false;
        var s = String(val).trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'on' || s === 'yes';
    }

    function zldGenerateId() {
        return 'zld-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    }

    function zldSafeById(id, log) {
        if (id && typeof id === 'string' && id.trim() !== '') {
            var el = document.getElementById(id);
            if (el) return el;
            if (log) console.warn('[oziLoadData] Elemento nao encontrado: #' + id);
        } else {
            if (log) console.warn('[oziLoadData] ID vazio passado para zldSafeById()');
        }
        return null;
    }

    // aplica/remove uma ou mais classes (string separada por espaco) num Element
    function _classListOp(el, classString, method) {
        if (!el || !classString) return;
        String(classString).trim().split(/\s+/).forEach(function (c) {
            if (c) el.classList[method](c);
        });
    }

    // Element ou Document que corresponde ao seletor, incluindo o proprio
    // escopo se ele mesmo casar (equivalente a $scope.find(sel).addBack(sel))
    function _matchSelfAndDescendants(scope, selector) {
        var found = Array.prototype.slice.call(scope.querySelectorAll(selector));
        if (scope.nodeType === 1 && scope.matches(selector)) found.unshift(scope);
        return found;
    }

    // ---------------------------------------------
    // _zldClassMap — le OZI.conf.classMap primeiro,
    // com zldConf como fallback.
    // Mesma filosofia do _classMap() dos componentes:
    // o tema ativo define as classes, zldConf e fallback.
    // ---------------------------------------------

    function _zldClassMap(key, zldFallback) {
        var conf   = window.OZI && window.OZI.conf;
        var mapped = conf && conf.classMap && conf.classMap[key];
        return mapped || zldFallback || '';
    }

    // flag de reentrada por fase — impede que um hook do afterRender
    // dispare outro afterRender antes do primeiro terminar (loop)
    var _renderRunning = { before: false, after: false };

    function zldRenderDependencies(root, loadData, phase) {
        if (!root) return;

        // protecao contra reentrada — corta o loop imediatamente
        if (_renderRunning[phase]) {
            if (loadData && loadData.zldLog) {
                console.warn('[oziLoadData] zldRenderDependencies reentrada bloqueada — phase:', phase);
            }
            return;
        }

        var hooks = (zldConf && zldConf.zldHooks) || {};
        var list  = phase === 'before' ? hooks.beforeRender : hooks.afterRender;

        _renderRunning[phase] = true;
        try {
            if (Array.isArray(list)) {
                list.forEach(function (fn) {
                    try {
                        if (typeof fn === 'function') fn(root, loadData);
                    } catch (e) {
                        if (loadData && loadData.zldLog) {
                            console.warn('[oziLoadData] Hook erro (' + phase + ')', e);
                        }
                    }
                });
            }
        } finally {
            _renderRunning[phase] = false;
        }

        // ── ponte OZI.hooks ───────────────────────────────────────────
        // Re-inicializa componentes OZI (ozi-select, ozi-editor, etc.) no
        // conteudo recem-injetado. Quando o boot e feito via @oziScripts
        // (OziAssets), a ponte zldConf.zldHooks -> OZI.hooks que o ozi.js
        // instala em _bridgeHooks() nao existe; sem isto, plugins registrados
        // em OZI.hooks.afterRender (ex: 'component:select') nunca disparam em
        // conteudo carregado por fetch — o ozi-select nao inicializa no offcanvas.
        var OZI     = window.OZI;
        var channel = OZI && OZI.hooks &&
            (phase === 'before' ? OZI.hooks.beforeRender : OZI.hooks.afterRender);

        if (channel && typeof channel.run === 'function') {
            try {
                channel.run(root, loadData);
            } catch (e) {
                if (loadData && loadData.zldLog) {
                    console.warn('[oziLoadData] OZI.hooks.run erro (' + phase + ')', e);
                }
            }
        }
    }

    function zldParseList(raw) {
        return window.OziCollector
            ? window.OziCollector.parseList(raw)
            : (Array.isArray(raw) ? raw : (raw ? String(raw).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []));
    }

    function zldNormalizeDomId(v) {
        return window.OziCollector
            ? window.OziCollector.normalizeDomId(v)
            : String(v == null ? '' : v).trim().replace(/^['"]|['"]$/g, '').replace(/^#/, '');
    }

    function zldBuildAlertHtml(type, title, meta) {
        var isDanger    = String(type || '').toLowerCase() === 'danger';
        var alertClass  = [
            zldConf.zldAlertClass,
            isDanger ? zldConf.zldAlertDangerClass : zldConf.zldAlertWarningClass
        ].filter(Boolean).join(' ');

        return '<div class="' + alertClass + '">' +
            '<b>' + (title || '') + '</b>' +
            (meta ? '<div class="' + zldConf.zldAlertMetaClass + '">' + meta + '</div>' : '') +
            '</div>';
    }


    // ---------------------------------------------
    // [5] PROGRESS BAR
    // ---------------------------------------------

    function zldGetProgressBar() {
        var cls = zldConf.zldProgressBarGlobalClass;
        var bar = document.querySelector('.' + cls);

        if (!bar) {
            bar = document.createElement('div');
            bar.className = cls;
            var inner = document.createElement('div');
            inner.className = 'ozi-progress-bar';
            bar.appendChild(inner);
            document.body.insertBefore(bar, document.body.firstChild);
        }

        return bar;
    }

    function zldProgressStart() {
        if (!zldConf.zldProgressBarGlobalOption) return;
        var bar = zldGetProgressBar();
        _classListOp(bar, zldConf.zldProgressSuccessClass, 'remove');
        _classListOp(bar, zldConf.zldProgressErrorClass,   'remove');
        _classListOp(bar, zldConf.zldProgressLoadingClass, 'add');
    }

    function zldProgressFinish(success) {
        if (!zldConf.zldProgressBarGlobalOption) return;
        var bar         = zldGetProgressBar();
        var finishClass = success !== false
            ? zldConf.zldProgressSuccessClass
            : zldConf.zldProgressErrorClass;

        _classListOp(bar, zldConf.zldProgressLoadingClass, 'remove');
        _classListOp(bar, finishClass, 'add');

        setTimeout(function () {
            _classListOp(bar, finishClass, 'remove');
        }, 600);
    }


    // ---------------------------------------------
    // [6] COLETA — delega para OziCollector
    // ---------------------------------------------

    function _collect(config) {
        if (!window.OziCollector) {
            console.error('[oziLoadData] OziCollector nao disponivel. Verifique se ozi-loaddata-collector.js carregou.');
            return {
                formData:        config.formData || new FormData(),
                data:            {},
                isValid:         false,
                invalidFields:   [],
                ldValidate:      1,
                zldValidateName: ''
            };
        }

        return window.OziCollector.collect({
            zldCatchGroupId:  config.zldCatchGroupId,
            zldCatchItemName: config.zldCatchItemName,
            formData:         config.formData,
            silent:           config.silent,
            log:              config.log
        });
    }


    // ---------------------------------------------
    // [7] VALIDACAO INTERATIVA
    // ---------------------------------------------

    function _readTriggerConfig(el) {
        return {
            zldCatchGroupId:  zldParseList(
                el.dataset.zldCatchGroupId || el.getAttribute('data-zld-catch-group-id')
            ),
            zldCatchItemName: zldParseList(
                el.dataset.zldCatchItemName || el.dataset.ldCatchItemName
            ),
            log: el.dataset.zldLog
                ? Boolean(JSON.parse(String(el.dataset.zldLog).toLowerCase()))
                : false
        };
    }

    function zldApplyTriggerState(el, isValid) {
        var valid = !!isValid;

        if (!el.hasAttribute('data-zld-show-errors')) {
            el.setAttribute('data-zld-show-errors', 'false');
        }

        el.setAttribute('data-zld-valid',    valid ? 'true' : 'false');
        el.setAttribute('data-zld-disabled', valid ? 'false' : 'true');

        if (zldConf.zldAriaDisabled) {
            el.setAttribute('aria-disabled', valid ? 'false' : 'true');
        }

        if (zldConf.zldButtonDisabledClass) {
            _classListOp(el, zldConf.zldButtonDisabledClass, valid ? 'remove' : 'add');
        }

        if (zldConf.zldButtonEnabledClass) {
            _classListOp(el, zldConf.zldButtonEnabledClass, valid ? 'add' : 'remove');
        }

        if (zldConf.zldUseNativeDisabled === true) {
            el.disabled = !valid;
        }
    }

    function _fieldMatchesTrigger(field, triggerConfig) {
        if (!field || !triggerConfig) return false;

        var fieldName = String(field.name || '').trim();

        var insideGroup = triggerConfig.zldCatchGroupId.some(function (rawId) {
            var id = zldNormalizeDomId(rawId);
            if (!id) return false;
            var container = document.getElementById(id);
            return !!(container && container.contains(field));
        });

        if (insideGroup) return true;

        return triggerConfig.zldCatchItemName.some(function (item) {
            if (!item || String(item).indexOf(':') !== -1) return false;
            return String(item).trim() === fieldName;
        });
    }

    function _evalTriggerState(triggerEl) {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate) return;

        var cfg = _readTriggerConfig(triggerEl);

        var result = _collect({
            zldCatchGroupId:  cfg.zldCatchGroupId,
            zldCatchItemName: cfg.zldCatchItemName,
            silent:           true,
            log:              cfg.log
        });

        zldApplyTriggerState(triggerEl, result.isValid);
    }

    function _evalAllTriggers(scope) {
        var root = scope || document;
        _matchSelfAndDescendants(root, '[data-zld-url]').forEach(function (el) {
            _evalTriggerState(el);
        });
    }

    function zldSyncRelatedTriggers(field) {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate || typeof validate.field !== 'function') return;

        var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-zld-url]'));

        var belongs = triggers.some(function (trigger) {
            return _fieldMatchesTrigger(field, _readTriggerConfig(trigger));
        });

        if (!belongs) return;

        validate.field(field);

        triggers.forEach(function (trigger) {
            if (_fieldMatchesTrigger(field, _readTriggerConfig(trigger))) {
                _evalTriggerState(trigger);
            }
        });
    }

    function zldInitInteractiveValidation(scope) {
        var root = scope || document;

        _matchSelfAndDescendants(root, '[data-zld-url]').forEach(function (el) {
            el.setAttribute('data-zld-show-errors', 'false');
            el.setAttribute('data-zld-busy',        'false');

            _evalTriggerState(el);
        });
    }


    // ---------------------------------------------
    // [8] ACTIONS
    // ---------------------------------------------

    function zldActions(actionsArr, ctx) {
        if (!Array.isArray(actionsArr) || !actionsArr.length) return;

        var actionsModule = window.OZI && window.OZI.modules && window.OZI.modules.actions;
        if (actionsModule && typeof actionsModule.run === 'function') {
            actionsModule.run(actionsArr, ctx);
            return;
        }

        console.warn('[oziLoadData] OZI.modules.actions indisponivel — executando fallback basico.');
        actionsArr.forEach(function (action) {
            if (!action || !action.type) return;
            try {
                if (action.type === 'redirect' && action.url) {
                    window.location.href = action.url;
                } else if (action.type === 'reload') {
                    window.location.reload();
                }
            } catch (e) {
                console.error('[oziLoadData] zldActions fallback erro:', e);
            }
        });
    }


    // ---------------------------------------------
    // [9] oziLoadData — funcao principal
    // ---------------------------------------------

    function oziLoadData(data, loadAttribute, clickedEl) {
        data = data || null;

        var formData = new FormData();

        var dataResponse = {
            perm: 0, isJson: false, ok: false,
            status: 0, data: null, html: null, error: null
        };

        var loadData = {
            zldLog: zldParseBool(data && (data.zldLog || data.ldLog)),

            zldUrl:           (data && (data.zldUrl           || data.ldUrl))           || '',
            zldDestinyId:     (data && (data.zldDestinyId      || data.ldDestinyId))     || '',
            zldDestinyAppend: zldParseBool(data && (data.zldDestinyAppend || data.ldDestinyAppend)),
            zldDestinyBefore: zldParseBool(data && (data.zldDestinyBefore || data.ldDestinyBefore)),

            zldCatchGroupId:  data && (data.zldCatchGroupId  || data.ldCatchGroupId),
            zldCatchItemName: data && (data.zldCatchItemName || data.ldCatchItemName || data.ldCatchItenName),

            zldMode:           (data && (data.zldMode           || data.ldWay))            || 'fetch',
            zldModeMethod:     (data && (data.zldModeMethod     || data.ldWayPageMethod))  || 'POST',
            zldModePageTarget: (data && (data.zldModePageTarget || data.ldWayPageTarget))  || '_self',

            zldFormClear:    zldParseBool(data && (data.zldFormClear   || data.ldFormClear)),
            zldFormBusy:     zldParseBool(data && (data.zldFormBusy    || data.ldBusy)),
            zldReloadScript: zldParseBool(data && (data.zldReloadScript || data.ldReload)),
            zldExpectJson:   zldParseBool(data && (data.zldExpectJson  || data.ldExpectJson)),
            zldApi:          zldParseBool(data && (data.zldApi         || data.ldApi)),

            zldJson:     data && data.zldJson,
            zldCheckbox: data && (data.zldCheckbox || data.ldCheckbox),
            zldFiles:    (data && Array.isArray(data.zldFiles)) ? data.zldFiles : []
        };

        if (loadData.zldLog) console.log('[oziLoadData] loadData:', loadData);

        loadData.zldCatchGroupId  = zldParseList(loadData.zldCatchGroupId);
        loadData.zldCatchItemName = zldParseList(loadData.zldCatchItemName);

        var elementData = clickedEl;
        if (!elementData) {
            elementData = document.createElement('span');
            elementData.id = 'zld-script-' + Date.now();
            document.body.appendChild(elementData);
        }
        if (!elementData.id || elementData.id.trim() === '') {
            elementData.id = zldGenerateId();
        }
        loadData.zldId = elementData.id;

        var button = zldSafeById(loadData.zldId, loadData.zldLog);

        // ── busy state ────────────────────────────────────────────
        if (loadData.zldFormBusy === true && button) {
            var disabledClass = zldConf.zldButtonDisabledClass || '';
            if (disabledClass && button.classList.contains(disabledClass)) return { perm: 1 };

            if (disabledClass)                  _classListOp(button, disabledClass, 'add');
            if (zldConf.zldButtonEnabledClass) _classListOp(button, zldConf.zldButtonEnabledClass, 'remove');
            if (zldConf.zldAriaDisabled)       button.setAttribute('aria-disabled', 'true');
            button.setAttribute('data-zld-busy', 'true');
        }

        // ── coleta via collector ──────────────────────────────────
        var collected = _collect({
            zldCatchGroupId:  loadData.zldCatchGroupId,
            zldCatchItemName: loadData.zldCatchItemName,
            formData:         formData,
            silent:           false,
            log:              loadData.zldLog
        });

        formData = collected.formData;
        loadData.zldValidateName = collected.zldValidateName;

        // ── zldJson ───────────────────────────────────────────────
        if (loadData.zldJson) {
            try {
                var arr = Array.isArray(loadData.zldJson)
                    ? loadData.zldJson
                    : JSON.parse(loadData.zldJson);
                arr.forEach(function (row, i) {
                    formData.append('zldJson[' + i + ']', JSON.stringify(row));
                });
            } catch (e) {
                if (loadData.zldLog) console.warn('[oziLoadData] zldJson invalido:', loadData.zldJson);
            }
        }

        // ── CSRF ──────────────────────────────────────────────────
        var csrfMeta = document.querySelector('meta[name="csrf-token"]');
        var token    = csrfMeta ? csrfMeta.getAttribute('content') : null;
        if (token && !formData.has('_token')) formData.append('_token', token);

        // ── arquivos ──────────────────────────────────────────────
        if (Array.isArray(loadData.zldFiles) && loadData.zldFiles.length) {
            loadData.zldFiles.forEach(function (entry) {
                if (!entry || !entry.name || !entry.file) return;
                var fieldName = String(entry.name).trim();
                if (!fieldName) return;
                var filename  = entry.filename ? String(entry.filename).trim() : '';
                if (filename) {
                    formData.append(fieldName, entry.file, filename);
                } else {
                    formData.append(fieldName, entry.file);
                }
            });
        }

        // ── bloqueio de validacao ─────────────────────────────────
        if (!collected.isValid) {
            if (button) _classListOp(button, zldConf.zldButtonDisabledClass, 'remove');
            dataResponse.perm = collected.ldValidate;
            return dataResponse;
        }

        var v_url = loadData.zldUrl;

        zldProgressStart();

        var finishUi = function (success) {
            zldProgressFinish(success !== false);

            if (button) {
                setTimeout(function () {
                    if (zldConf.zldButtonDisabledClass) _classListOp(button, zldConf.zldButtonDisabledClass, 'remove');
                    if (zldConf.zldButtonEnabledClass)  _classListOp(button, zldConf.zldButtonEnabledClass, 'add');

                    if (zldConf.zldAriaDisabled) {
                        var isStillInvalid = button.getAttribute('data-zld-disabled') === 'true';
                        button.setAttribute('aria-disabled', isStillInvalid ? 'true' : 'false');
                    }

                    button.setAttribute('data-zld-busy', 'false');
                }, 400);
            }
        };

        var renderToDestiny = function (html) {
            var ld_destiny = loadData.zldDestinyId;
            if (!ld_destiny) return;

            var destiny = document.getElementById(ld_destiny);
            if (!destiny) {
                if (loadData.zldLog) console.warn('[oziLoadData] destino nao encontrado:', ld_destiny);
                return;
            }

            var root = destiny;

            zldRenderDependencies(root, loadData, 'before');

            if (loadData.zldDestinyAppend)      destiny.insertAdjacentHTML('beforeend', html);
            else if (loadData.zldDestinyBefore) destiny.insertAdjacentHTML('beforebegin', html);
            else                                destiny.innerHTML = html;

            zldRenderDependencies(root, loadData, 'after');
        };

        var handleHttpErrorHtml = function (status, html) {
            renderToDestiny(zldBuildAlertHtml('warning', 'Erro ao carregar.', 'Status ' + status));

            var titleEl = document.getElementById('logErrorLaravelOziTitle');
            if (titleEl) titleEl.innerHTML = status;

            var iframe = document.getElementById('logErrorLaravelOzi');
            if (iframe && iframe.contentDocument) {
                var body = iframe.contentDocument.querySelector('body');
                if (body) body.innerHTML = html;
            }
        };

        // ── modos de envio ────────────────────────────────────────

        if (loadData.zldMode === 'fetch') {
            var method    = (loadData.zldModeMethod || 'POST').toUpperCase();
            var wantsJson = loadData.zldApi === true || loadData.zldExpectJson === true || method !== 'GET';

            var headers = {
                'X-Requested-With': 'XMLHttpRequest',
                'X-ZLD':            'true',
                'Accept':           wantsJson ? 'application/json' : 'text/html, */*;q=0.8'
            };

            var csrf = document.querySelector('meta[name="csrf-token"]');
            if (csrf) headers['X-CSRF-TOKEN'] = csrf.getAttribute('content');

            var fetchOptions = method === 'GET'
                ? { method: method, headers: headers }
                : { method: method, headers: headers, body: formData };

            return fetch(v_url, fetchOptions)
                .then(function (response) {
                    dataResponse.ok     = response.ok;
                    dataResponse.status = response.status;

                    var ct = String(response.headers.get('content-type') || '').toLowerCase();
                    dataResponse.isJson = ct.indexOf('application/json') !== -1;

                    if (dataResponse.isJson) {
                        return response.json().then(function (json) {
                            dataResponse.data = json;

                            if (loadData.zldLog) {
                                console.log('[oziLoadData] JSON response:', { status: response.status, ok: response.ok, json: json });
                            }

                            if (json && Array.isArray(json.actions)) {
                                zldActions(json.actions, { loadData: loadData, response: response, json: json });
                            }

                            if (!response.ok && !(json && json.actions && json.actions.length)) {
                                renderToDestiny(zldBuildAlertHtml(
                                    'warning',
                                    (json && json.message) || 'Erro ao processar.',
                                    'Status ' + response.status
                                ));
                            }

                            return dataResponse;
                        }).catch(function (err) {
                            dataResponse.error = err;
                            renderToDestiny(zldBuildAlertHtml('danger', 'Resposta JSON invalida.', 'Verifique o retorno da rota.'));
                            return dataResponse;
                        });
                    }

                    return response.text().then(function (html) {
                        dataResponse.html = html;
                        if (!response.ok) { handleHttpErrorHtml(response.status, html); return dataResponse; }
                        renderToDestiny(html);
                        return dataResponse;
                    });
                })
                .catch(function (err) {
                    dataResponse.error = err;
                    if (loadData.zldLog) console.error('[oziLoadData] fetch falhou:', err);
                    renderToDestiny(zldBuildAlertHtml('danger', 'Nao foi possivel carregar.', 'Verifique sua conexao.'));
                    return dataResponse;
                })
                .finally(function () {
                    finishUi(dataResponse.ok);

                    if (loadData.zldFormClear) {
                        (loadData.zldCatchGroupId || []).forEach(function (groupId) {
                            if (!groupId) return;
                            var group = document.getElementById(groupId);
                            if (!group) return;

                            formData.forEach(function (value, key) {
                                var inputs = group.querySelectorAll('[name="' + key + '"]');
                                inputs.forEach(function (input) {
                                    if (input.type !== 'hidden') {
                                        // [FIX-CSS] usa _zldClassMap para respeitar o tema ativo
                                        _classListOp(input, _zldClassMap('valid',   zldConf.zldResponseValidClass),   'remove');
                                        _classListOp(input, _zldClassMap('invalid', zldConf.zldResponseInvalidClass), 'remove');
                                        input.value = '';
                                    }
                                });
                            });
                        });
                    }
                });

        } else if (loadData.zldMode === 'window') {
            var qs = '';
            formData.forEach(function (value, key) {
                qs += encodeURIComponent(key) + '=' + encodeURIComponent(value) + '&';
            });
            window.open(loadData.zldUrl + '?' + qs, '_blank', 'noopener,noreferrer');
            finishUi();

        } else if (loadData.zldMode === 'page') {
            var form = document.createElement('form');
            form.method = (loadData.zldModeMethod || 'POST').toUpperCase();
            form.target = loadData.zldModePageTarget || '_self';
            form.action = loadData.zldUrl;

            formData.forEach(function (value, key) {
                var input  = document.createElement('input');
                input.type  = 'hidden';
                input.name  = key;
                input.value = value;
                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
            finishUi();

        } else {
            if (loadData.zldLog) console.warn('[oziLoadData] zldMode invalido:', loadData.zldMode);
            finishUi();
        }

        dataResponse.perm = collected.ldValidate;
        return dataResponse;
    }


    // ---------------------------------------------
    // [10] BIND AUTOMATICO
    // ---------------------------------------------

    function _handleDispatch(el, e) {
        var zldLog = el.dataset.zldLog
            ? Boolean(JSON.parse(String(el.dataset.zldLog).toLowerCase()))
            : false;

        var attributes = {
            zldUrl:            el.dataset.zldUrl,
            zldDestinyId:      el.dataset.zldDestinyId,
            zldCatchGroupId:   el.dataset.zldCatchGroupId || el.getAttribute('data-zld-catch-group-id'),
            zldCatchItemName:  el.dataset.zldCatchItemName || el.dataset.ldCatchItemName,
            zldMode:           el.dataset.zldMode   || el.dataset.ldWay  || 'fetch',
            zldModeMethod:     el.dataset.zldModeMethod,
            zldModePageTarget: el.dataset.zldModePageTarget,
            zldFormClear:      el.dataset.zldFormClear,
            zldFormBusy:       el.dataset.zldFormBusy === 'true',
            zldReloadScript:   el.dataset.zldReloadScript === 'true',
            zldJson:           el.dataset.zldJson,
            zldCheckbox:       el.dataset.zldCheckbox,
            zldExpectJson:     el.dataset.zldExpectJson,
            zldApi:            el.dataset.zldApi,
            zldLog:            zldLog
        };

        if (zldConf.zldInteractiveValidation === true) {
            el.setAttribute('data-zld-show-errors', 'true');

            var cfg = _readTriggerConfig(el);
            var result = _collect({
                zldCatchGroupId:  cfg.zldCatchGroupId,
                zldCatchItemName: cfg.zldCatchItemName,
                silent:           false,
                log:              cfg.log
            });

            if (zldLog) console.log('[oziLoadData] validacao no clique:', result);

            if (!result || result.isValid !== true) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        oziLoadData(attributes, null, el);
    }

    document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-zld-url]');
        if (!el) return;
        _handleDispatch(el, e);
    });

    document.addEventListener('change', function (e) {
        var el = e.target.closest('select[data-zld-url]');
        if (!el) return;
        _handleDispatch(el, e);
    });


    // ---------------------------------------------
    // [11] BIND INTERATIVO DE CAMPOS
    // ---------------------------------------------

    var _syncDebounceTimer = null;

    function _onInteractiveFieldEvent(e) {
        if (zldConf.zldInteractiveValidation !== true) return;
        var field = e.target;
        if (!field.matches('input, select, textarea')) return;

        clearTimeout(_syncDebounceTimer);
        _syncDebounceTimer = setTimeout(function () {
            zldSyncRelatedTriggers(field);
        }, 150);
    }

    // 'focusout' no lugar de 'blur' — blur nao faz bubble, delegacao precisa de bubble
    document.addEventListener('input',    _onInteractiveFieldEvent);
    document.addEventListener('change',   _onInteractiveFieldEvent);
    document.addEventListener('focusout', _onInteractiveFieldEvent);


    // ---------------------------------------------
    // [12] INICIALIZACAO
    // Movida para dentro do [14] BOOT — garante que
    // OziCollector ja esta disponivel antes de rodar.
    // ---------------------------------------------


    // ---------------------------------------------
    // [13] EXPORTS PUBLICOS
    // ---------------------------------------------

    window.__zldConf = zldConf;

    try {
        Object.defineProperty(window, 'zldConf', {
            get: function () { return zldConf; },
            configurable: true
        });
    } catch (e) {
        // ozi.js ja definiu como getter — ok
    }

    // [FIX-P1] window.oziConf NAO e mais exportado aqui.
    // A funcao _applyZldConf() e uso interno — configura apenas zldConf.
    // O ponto unico de configuracao global e window.oziConf do ozi.js,
    // que delega para OziConf.apply() e atualiza OZI.conf (tema, lang, plugins).
    // Exportar oziConf aqui sobrescrevia o oziConf do core apos loadPlugins().

    window.oziLoadData          = oziLoadData;

    // alias deprecado
    Object.defineProperty(window, 'oziLoaddata', {
        get: function () {
            if (zldConf.zldLog) {
                console.warn('[oziLoadData] window.oziLoaddata deprecado. Use window.oziLoadData (D maiusculo).');
            }
            return oziLoadData;
        },
        configurable: true
    });

    window.zldActions               = zldActions;
    window.zldRenderDependencies    = zldRenderDependencies;
    window.zldParseBool             = zldParseBool;
    window.zldGenerateId            = zldGenerateId;
    window.zldSafeById              = zldSafeById;
    window.zldParseList             = zldParseList;
    window.zldNormalizeDomId        = zldNormalizeDomId;
    window.zldApplyTriggerState     = zldApplyTriggerState;
    window.zldSyncRelatedTriggers   = zldSyncRelatedTriggers;
    window.zldInitInteractiveValidation = zldInitInteractiveValidation;
    window.zldEvalAllTriggers           = _evalAllTriggers;


    // ---------------------------------------------
    // [14] BOOT
    //
    // _loadCollector() e async — carrega ozi-loaddata-collector.js
    // via <script> injetado no head.
    //
    // A inicializacao interativa (zldInitInteractiveValidation) e o
    // registro do hook afterRender ficam DENTRO do .then() para garantir
    // que OziCollector ja existe antes de _collect() ser chamado.
    // ---------------------------------------------

    function _initReady() {
        zldInitInteractiveValidation(document);
    }

    _loadCollector().then(function () {
        if (zldConf.zldLog) console.log('[oziLoadData] collector pronto. Iniciando validacao interativa...');

        // inicializacao segura — OziCollector garantido aqui
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _initReady);
        } else {
            _initReady();
        }

        // hook afterRender — re-init em conteudo dinamico
        zldConf.zldHooks.afterRender.push(function (root) {
            zldInitInteractiveValidation(root);
        });

        if (zldConf.zldLog) console.log('[oziLoadData] boot concluido.');
    });

})(window, document);
