/**
 * ------------------------------------------
 * oziLoadData
 * ------------------------------------------
 * Ver: (3.9.4)
 * 2026-04-12
 * ------------------------------------------
 * @description
 * Realiza coleta, envio e tratamento de dados em diferentes modos de execução,
 * com suporte a destino visual, integração com API e controle de comportamento.
 *
 * ### RECURSOS
 * envio dinâmico       → suporta envio nos modos fetch, window e page
 * coleta flexível      → coleta dados por grupo, item individual ou JSON
 * resposta visual      → envia retorno para um destino específico no DOM
 * integração com API   → facilita chamadas orientadas a dados
 * limpeza de formulário→ limpa campos após envio quando configurado
 * controle de clique   → evita múltiplas ações durante a requisição
 * suporte a debug      → exibe logs detalhados para análise do fluxo
 *
 * ### [1] ENVIO
 * data-zld-url            → define o endereço de envio
 * data-zld-mode           → define o modo de envio: fetch, window ou page
 * data-zld-mode-method     → define o método da requisição: GET ou POST
 * data-zld-mode-page-target → define o alvo da página: _self, _blank, _parent, _top ou framename
 *
 * ### [2] COLETA DE DADOS
 * data-zld-catch-group-id   → coleta os dados dentro do id informado
 * data-zld-catch-item-name  → coleta itens individuais pelo atributo name
 * data-zld-json           → envia dados estruturados em Array ou JSON string junto com o FormData
 * data-zld-file           → faz tratamento de arquivos: audio-webm
 * data-zld-checkbox       → define ou auxilia o tratamento de valores de checkbox
 *
 * ### [3] RESPOSTA / DESTINO
 * data-zld-destiny-id      → define o destino da resposta
 * data-zld-destiny-append  → adiciona a resposta no destino informado
 * data-zld-destiny-Before  → insere a resposta antes do destino informado
 * data-zld-expect-json     → ajusta headers para JSON e facilita integração com Laravel
 * data-zld-api            → define a chamada como modo API, voltada para resposta em dados
 *
 * ### [4] COMPORTAMENTO / UX
 * data-zld-form-busy       → evita múltiplos cliques durante a requisição
 * data-zld-form-clear      → limpa formulários após o envio, exceto campos hidden
 * data-zld-reload-script   → recarrega scripts da classe ld-reload em cenários legados
 *
 * ### [5] DEBUG / SUPORTE
 * data-zld-log            → ativa logs de depuração no console
 *
 *
 * Versão 3.8.0
 * Refatoração estrutural do oziLoadData, com adaptação para IIFE, base preparada para SPA e organização do núcleo do plugin para melhor manutenção e expansão.
 *
 * @param {Object} [data={}] Objeto de configuração da chamada
 * @param {Object} [attribute={}] Atributos auxiliares processados internamente
 *
 * @returns {*} Retorna a resposta processada conforme o modo de execução
 *      perm: 1/0,
 *         isJson: true/false,
 *         ok: true/false,
 *         status: 200,
 *         data:[...]/null
 *         html:null
 *         error: null/
 *         }

 * @example
 * // configuração mínima:
 * <button
 *     data-zld-url: '/rota/exemplo',
 *     data-zld-destiny-id: 'resultado',
 *     data-zld-catch-group-id: 'formCadastro',
 *     type="button"
 *     class="btn btn-primary">
 *      Enviar
 * </button>
 *
 * @example
 * // configuração mínima:
 * const response = oziLoadData({
 *     zldUrl: '/rota/exemplo',
 *     zldDestinyId: 'resultado',
 *     zldCatchGroupId: 'formCadastro',
 * });
 *
 *
 *
 */

(function ($, window, document) {
    'use strict';

    if (!$) {
        console.error('oziLoadData: jQuery nao encontrado.');
        return;
    }

    if (window.__zld_inited) return;
    window.__zld_inited = true;

    /**
     * ------------------------------------------
     * [1] CONFIGURACAO GLOBAL
     * ------------------------------------------
     */
    const zldConf = {
        zldProgressBarGlobalOption: true,
        zldProgressBarGlobalClass: 'progress-bar-global',

        zldResponseValidClass: 'is-valid',
        zldResponseInvalidClass: 'is-invalid',

        zldInteractiveValidation: true,
        zldInteractiveEvents: 'input change blur',
        zldButtonDisabledClass: 'zld-disabled',
        zldButtonEnabledClass: '',
        zldUseNativeDisabled: false,
        zldAriaDisabled: true,

        zldAlertClass: 'zld-alert',
        zldAlertWarningClass: 'zld-alert-warning',
        zldAlertDangerClass: 'zld-alert-danger',
        zldAlertMetaClass: 'zld-alert-meta',

        zldProgressClass: 'zld-progress',
        zldProgressBarClass: 'zld-progress-bar',
        zldProgressLoadingClass: 'zld-progress-loading',
        zldProgressSuccessClass: 'zld-progress-success',

        zldAutoInit: {
            tabs: true,
            editor: true
        },

        zldHooks: {
            beforeRender: [],
            afterRender: []
        }
    };

    /**
     * ------------------------------------------
     * [2] API DE CONFIGURACAO
     * ------------------------------------------
     */
    function oziConf(conf = {}) {
        zldConf.zldProgressBarGlobalOption = conf.zldProgressBarGlobalOption ?? zldConf.zldProgressBarGlobalOption;
        zldConf.zldProgressBarGlobalClass = conf.zldProgressBarGlobalClass ?? zldConf.zldProgressBarGlobalClass;

        zldConf.zldResponseValidClass = conf.zldResponseValidClass ?? zldConf.zldResponseValidClass;
        zldConf.zldResponseInvalidClass = conf.zldResponseInvalidClass ?? zldConf.zldResponseInvalidClass;

        zldConf.zldInteractiveValidation = conf.zldInteractiveValidation ?? zldConf.zldInteractiveValidation;
        zldConf.zldInteractiveEvents = conf.zldInteractiveEvents ?? zldConf.zldInteractiveEvents;
        zldConf.zldButtonDisabledClass = conf.zldButtonDisabledClass ?? zldConf.zldButtonDisabledClass;
        zldConf.zldButtonEnabledClass = conf.zldButtonEnabledClass ?? zldConf.zldButtonEnabledClass;
        zldConf.zldUseNativeDisabled = conf.zldUseNativeDisabled ?? zldConf.zldUseNativeDisabled;
        zldConf.zldAriaDisabled = conf.zldAriaDisabled ?? zldConf.zldAriaDisabled;

        zldConf.zldAlertClass = conf.zldAlertClass ?? zldConf.zldAlertClass;
        zldConf.zldAlertWarningClass = conf.zldAlertWarningClass ?? zldConf.zldAlertWarningClass;
        zldConf.zldAlertDangerClass = conf.zldAlertDangerClass ?? zldConf.zldAlertDangerClass;
        zldConf.zldAlertMetaClass = conf.zldAlertMetaClass ?? zldConf.zldAlertMetaClass;

        zldConf.zldProgressClass = conf.zldProgressClass ?? zldConf.zldProgressClass;
        zldConf.zldProgressBarClass = conf.zldProgressBarClass ?? zldConf.zldProgressBarClass;
        zldConf.zldProgressLoadingClass = conf.zldProgressLoadingClass ?? zldConf.zldProgressLoadingClass;
        zldConf.zldProgressSuccessClass = conf.zldProgressSuccessClass ?? zldConf.zldProgressSuccessClass;

        if (conf.zldAutoInit) {
            zldConf.zldAutoInit.tabs = conf.zldAutoInit.tabs ?? zldConf.zldAutoInit.tabs;
            zldConf.zldAutoInit.editor = conf.zldAutoInit.editor ?? zldConf.zldAutoInit.editor;
        }

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


    /**
     * ------------------------------------------
     * [3] HELPERS
     * ------------------------------------------
     * Cole aqui, sem mudar assinatura:
     * - zldParseBool
     * - zldGenerateId
     * - zldSafeById
     * - zldCkEditor
     * - zldRenderDependencies
     * - zldActions
     * - oziValidateContainer
     */

    function zldParseBool(val) {
        if (val === undefined || val === null) return false;

        const s = String(val).trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'on' || s === 'yes';
    }

    function zldGenerateId() {
        return +Date.now() + Math.floor(Math.random() * 10000);
    }

    function zldSafeById(id, zldLog = false) {
        if (id && typeof id === 'string' && id.trim() !== '') {
            const $el = $('#' + id);
            if ($el.length) return $el;
            if (zldLog) console.warn('LOG Elemento com id não encontrado', id);
        } else {
            if (zldLog) console.warn('LOG ID vazio ou inválido passado para zldSafeById()');
        }
        return null;
    }

    function zldRenderDependencies(root, loadData, phase) {
        if (!root) return;

        const hooks = zldConf?.zldHooks || {};
        const list = phase === 'before'
            ? hooks.beforeRender
            : hooks.afterRender;

        if (!Array.isArray(list)) return;

        list.forEach((fn) => {
            try {
                if (typeof fn === 'function') fn(root, loadData);
            } catch (e) {
                if (loadData?.zldLog) console.warn('zldHooks| erro', phase, e);
            }
        });
    }


    function zldClassNames() {
        return Array.from(arguments)
            .flat()
            .filter(Boolean)
            .map(item => String(item).trim())
            .filter(Boolean)
            .join(' ');
    }

    function zldBuildAlertHtml(type, title, meta) {
        const isDanger = String(type || '').toLowerCase() === 'danger';

        const alertClass = zldClassNames(
            zldConf.zldAlertClass,
            isDanger ? zldConf.zldAlertDangerClass : zldConf.zldAlertWarningClass
        );

        const metaClass = zldClassNames(zldConf.zldAlertMetaClass);

        return `
        <div class="${alertClass}">
            <b>${title || ''}</b>
            ${meta ? `<div class="${metaClass}">${meta}</div>` : ''}
        </div>
    `;
    }

    function zldBuildProgressBarHtml() {
        const wrapClass = zldClassNames(zldConf.zldProgressClass);
        const barClass = zldClassNames(
            zldConf.zldProgressBarClass,
            zldConf.zldProgressLoadingClass
        );

        return `
        <div class="${wrapClass}">
            <div class="${barClass}"
                 role="progressbar"
                 style="width:1%; height:7px; display:block; border-radius: 25px;">
                <span class="sr-only">Progress</span>
            </div>
        </div>
    `;
    }







    function zldParseList(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;

        const s = String(raw).trim();
        if (!s) return [];

        if (s.startsWith('[') && s.endsWith(']')) {
            try {
                const arr = JSON.parse(s.replaceAll("'", '"'));
                return Array.isArray(arr) ? arr : [];
            } catch {
                return s.split(',').map(x => x.trim()).filter(Boolean);
            }
        }

        return s.split(',').map(x => x.trim()).filter(Boolean);
    }

    function zldNormalizeDomId(v) {
        if (v === undefined || v === null) return '';
        let s = String(v).trim();

        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1).trim();
        }

        if (s.startsWith('#')) s = s.slice(1).trim();

        return s;
    }

    function zldReadTriggerValidationConfig(el) {
        return {
            zldCatchGroupId: zldParseList(
                el.dataset.zldCatchGroupId ??
                el.getAttribute('data-zld-catch-group-id')
            ),
            zldCatchItemName: zldParseList(
                el.dataset.zldCatchItemName || el.dataset.ldCatchItemName
            ),
            zldLog: el.dataset.zldLog
                ? Boolean(JSON.parse(String(el.dataset.zldLog).toLowerCase()))
                : false
        };
    }

    function zldApplyTriggerState(el, isValid) {
        const $el = $(el);
        const valid = !!isValid;

        if (!$el.is('[data-zld-show-errors]')) {
            $el.attr('data-zld-show-errors', 'false');
        }

        $el.attr('data-zld-valid', valid ? 'true' : 'false');
        $el.attr('data-zld-disabled', valid ? 'false' : 'true');

        if (zldConf.zldAriaDisabled) {
            $el.attr('aria-disabled', valid ? 'false' : 'true');
        }

        if (zldConf.zldButtonDisabledClass) {
            $el.toggleClass(zldConf.zldButtonDisabledClass, !valid);
        }

        if (zldConf.zldButtonEnabledClass) {
            $el.toggleClass(zldConf.zldButtonEnabledClass, valid);
        }

        if (zldConf.zldUseNativeDisabled === true) {
            $el.prop('disabled', !valid);
        }
    }

    function zldSyncTriggerState(el, options = {}) {
        if (!el) return null;

        const $el = $(el);
        const cfg = zldReadTriggerValidationConfig(el);
        const previousValid = $el.attr('data-zld-valid') === 'true';

        let showErrors =
            options.showErrors === true ||
            $el.attr('data-zld-show-errors') === 'true';

        let result = oziValidateContainer({
            zldCatchGroupId: cfg.zldCatchGroupId,
            zldCatchItemName: cfg.zldCatchItemName,
            loadData: {
                zldLog: cfg.zldLog,
                zldValidateName: ''
            },
            formData: new FormData(),
            ldValidate: 0,
            applyUi: showErrors,
            appendToFormData: false
        });

        let isValid = !!(result && result.isValid);

        const becameInvalidAfterBeingValid =
            previousValid === true &&
            isValid === false &&
            options.fromFieldChange === true;

        if (becameInvalidAfterBeingValid && showErrors !== true) {
            showErrors = true;

            result = oziValidateContainer({
                zldCatchGroupId: cfg.zldCatchGroupId,
                zldCatchItemName: cfg.zldCatchItemName,
                loadData: {
                    zldLog: cfg.zldLog,
                    zldValidateName: ''
                },
                formData: new FormData(),
                ldValidate: 0,
                applyUi: true,
                appendToFormData: false
            });

            isValid = !!(result && result.isValid);
        }

        if (!isValid && showErrors === true) {
            $el.attr('data-zld-show-errors', 'true');
        }

        if (isValid) {
            $el.attr('data-zld-show-errors', 'false');
        }

        zldApplyTriggerState(el, isValid);

        return result;
    }

    function zldFieldMatchesTrigger(field, triggerConfig) {
        if (!field || !triggerConfig) return false;

        const fieldName = String(field.name || '').trim();

        const insideGroup = triggerConfig.zldCatchGroupId.some((rawId) => {
            const id = zldNormalizeDomId(rawId);
            if (!id) return false;

            const container = document.getElementById(id);
            return !!(container && container.contains(field));
        });

        if (insideGroup) return true;

        const directName = triggerConfig.zldCatchItemName.some((item) => {
            if (!item) return false;
            if (String(item).includes(':')) return false;
            return String(item).trim() === fieldName;
        });

        return directName;
    }

    function zldSyncRelatedTriggers(field, options = {}) {
        $('[data-zld-url]').each(function () {
            const triggerConfig = zldReadTriggerValidationConfig(this);

            if (zldFieldMatchesTrigger(field, triggerConfig)) {
                const showErrors = $(this).attr('data-zld-show-errors') === 'true';

                zldSyncTriggerState(this, {
                    showErrors: showErrors,
                    fromFieldChange: true
                });
            }
        });
    }

    function zldInitInteractiveValidation(scope) {
        const $scope = scope ? $(scope) : $(document);

        $scope.find('[data-zld-url]').addBack('[data-zld-url]').each(function () {
            zldSyncTriggerState(this, {showErrors: false});
        });
    }


    function zldCkEditor(v_id, v_name, v_value) {
        try {
            console.log(CKEDITOR.instances[v_id])
            v_value = CKEDITOR.instances[v_id].getData();
        } catch (err) {
            console.log('LOG| TEXTAREA CkEditor', v_id);
            console.log(' - CkEditor| Name:', v_name);
            console.log(' - CkEditor| Value:', v_value);
            console.log(' - CkEditor|', err.message);

        } finally {

            const result = {
                "v_name": v_name, "v_value": v_value
            }

            return result;

        }
    }

    /**
     * ------------------------------------------
     * [4] VALIDACAO / COLETA
     * ------------------------------------------
     * applyUi: true
     * appendToFormData: true
     *
     *  @example
     *  oziValidateContainer({
     *      zldCatchGroupId:string/array
     *      zldCatchItemName:string/array
     *  })
     *
     * */
    function oziValidateContainer(config = {}) {
        const cfg = {
            container: config.container ?? null,
            valueCatch: Number(config.valueCatch ?? 0),
            loadData: config.loadData ?? {},
            formData: config.formData ?? new FormData(),
            ldValidate: Number(config.ldValidate ?? 0),
            zldCatchGroupId: config.zldCatchGroupId ?? [],
            zldCatchItemName: config.zldCatchItemName ?? [],
            applyUi: config.applyUi !== false,
            appendToFormData: config.appendToFormData !== false,
        };

        const parseList = (raw) => {
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;

            const s = String(raw).trim();

            if (s.startsWith("[") && s.endsWith("]")) {
                try {
                    const arr = JSON.parse(s.replaceAll("'", '"'));
                    return Array.isArray(arr) ? arr : [];
                } catch {
                    return s.split(",").map(x => x.trim()).filter(Boolean);
                }
            }

            return s.split(",").map(x => x.trim()).filter(Boolean);
        };

        const normalizeDomId = (v) => {
            if (v === undefined || v === null) return "";
            let s = String(v).trim();

            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
                s = s.slice(1, -1).trim();
            }

            if (s.startsWith("#")) s = s.slice(1).trim();

            return s;
        };

        cfg.zldCatchGroupId = parseList(cfg.zldCatchGroupId);
        cfg.zldCatchItemName = parseList(cfg.zldCatchItemName);

        let formData = cfg.formData;
        let ldValidate = cfg.ldValidate;
        const loadData = cfg.loadData;

        let invalidFields = [];
        let data = {};

        const addInvalid = (name) => {
            if (!name) return;
            invalidFields.push(name);
            ldValidate++;
            loadData.zldValidateName = (loadData.zldValidateName || "") + name + ",";
        };

        const addValue = (name, value) => {
            if (!name) return;

            if (cfg.appendToFormData) {
                formData.append(name, value);
            }

            if (Object.prototype.hasOwnProperty.call(data, name)) {
                if (!Array.isArray(data[name])) {
                    data[name] = [data[name]];
                }
                data[name].push(value);
            } else {
                data[name] = value;
            }
        };

        const markValid = (selector) => {
            if (!cfg.applyUi || !selector) return;
            $(selector)
                .addClass(zldConf.zldResponseValidClass)
                .removeClass(zldConf.zldResponseInvalidClass);
        };

        const markInvalid = (selector) => {
            if (!cfg.applyUi || !selector) return;
            $(selector)
                .addClass(zldConf.zldResponseInvalidClass)
                .removeClass(zldConf.zldResponseValidClass);
        };

        const processContainer = (container, valueCatch) => {
            if (!container) {
                if (loadData.zldLog) {
                    console.warn(`Info: 'Null' | Catch: ${valueCatch} | Objeto não encontrado`);
                }
                return;
            }

            let groupId = "";
            let list = [];

            if (valueCatch === 1) {
                groupId = container.id ? `#${container.id} ` : "";
            } else {
                list = Array.from(container || []);
            }

            const inputList = valueCatch === 1
                ? Array.from(container.getElementsByTagName("input"))
                : list.filter(el => el && el.localName === "input");

            const selectList = valueCatch === 1
                ? Array.from(container.getElementsByTagName("select"))
                : list.filter(el => el && el.localName === "select");

            const textareaList = valueCatch === 1
                ? Array.from(container.querySelectorAll("textarea"))
                : list.filter(el => el && el.localName === "textarea");

            inputList.forEach((obj) => {
                if (!obj) return;

                if (obj.classList.contains("select2-search__field")) {
                    obj.name = "null";
                    if (loadData.zldLog) {
                        console.log("LOG| INFO: select2 multi não tem nome");
                    }
                } else if (!obj.getAttribute("name")) {
                    console.error("LOG| ERROR: Algum dos seus objetos INPUT não possui atributo NAME", obj);
                }

                const v_name = obj.name ?? null;
                const v_value = obj.value ?? "";
                const v_required = obj.required || false;
                const v_disabled = obj.disabled || false;
                const v_type = obj.type ?? null;
                const v_checked = obj.checked || false;

                const selector = v_name ? `${groupId}[name="${v_name}"]` : null;

                if (loadData.zldLog) {
                    console.log("LOG| FieldData extraído:", {
                        name: v_name,
                        value: v_value,
                        required: v_required,
                        disabled: v_disabled,
                        type: v_type,
                        checked: v_checked
                    });
                }

                if (v_type === "radio") {
                    if (v_checked) {
                        addValue(v_name, v_value);
                    }

                    if (v_required) {
                        const checkedCount = $(`[name="${v_name}"]:checked`).length;

                        if (checkedCount > 0) {
                            $(`[name="${v_name}"]`).each(function () {
                                const id = $(this).attr('id');
                                if (id) $(`[for="${id}"]`).addClass('text-success').removeClass('text-danger');
                            });
                        } else {
                            $(`[name="${v_name}"]`).each(function () {
                                const id = $(this).attr('id');
                                if (id) $(`[for="${id}"]`).removeClass('text-success').addClass('text-danger');
                            });
                            addInvalid(v_name);
                        }
                    }

                    return;
                }

                if (v_type === "checkbox") {
                    if (v_disabled) return;

                    if (v_required && !v_checked) {
                        addInvalid(v_name);
                        markInvalid(selector);
                        return;
                    }

                    if (v_checked) {
                        addValue(v_name, v_value);
                        markValid(selector);
                    }

                    return;
                }

                if (v_type === "file") {
                    const files = Array.from(obj.files || []);
                    let mask = "_files";
                    if (obj.multiple === true) mask += "[]";

                    if (v_required && !v_disabled && files.length === 0) {
                        if (loadData.zldLog) {
                            console.warn("LOG| Campo obrigatório sem arquivo:", v_name);
                        }
                        addInvalid(v_name);
                        markInvalid(selector);
                        return;
                    }

                    files.forEach(file => addValue(v_name + mask, file));
                    if (files.length) markValid(selector);
                    return;
                }

                if (v_type === "search") {
                    if ((obj.className ?? null) !== 'select2-search__field' && loadData.zldLog) {
                        console.log('LOG| ERROR: search ', obj);
                    }
                    return;
                }

                if (v_required && !v_disabled) {
                    if (v_value === "") {
                        addInvalid(v_name);
                        markInvalid(selector);
                        return;
                    }

                    if (v_type === "email") {
                        const txt = v_value;
                        const invalid = (txt.indexOf("@") < 1) ||
                            (txt.indexOf(".") < 3) ||
                            (txt.indexOf("#") > -1) ||
                            (txt.indexOf(",") > -1);

                        if (invalid) {
                            addInvalid(v_name);
                            markInvalid(selector);
                            return;
                        }
                    }

                    markValid(selector);
                }

                addValue(v_name, v_value);
            });

            selectList.forEach((obj) => {
                if (!obj) return;

                if (!obj.getAttribute("name")) {
                    console.warn("LOG| ERROR: Algum SELECT não possui atributo NAME", obj);
                }

                const v_name = obj.name ?? null;
                const v_required = obj.required || false;
                const v_disabled = obj.disabled || false;

                if (!v_name || v_disabled) return;

                const selector = `${groupId}[name="${v_name}"]`;

                if (obj.multiple) {
                    const selected = Array.from(obj.options)
                        .filter(opt => opt.selected)
                        .map(opt => opt.value);

                    if (v_required && selected.length === 0) {
                        addInvalid(v_name);
                        markInvalid(selector);
                        return;
                    }

                    selected.forEach(value => addValue(v_name + "[]", value));
                    if (selected.length) markValid(selector);
                    return;
                }

                const selected = obj.selectedOptions?.[0];
                const value = selected ? selected.value : "";

                if (v_required && value === "") {
                    addInvalid(v_name);
                    markInvalid(selector);

                    const escaped = v_name.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
                    $(`${groupId}#select2-${escaped}-container`).parent()
                        .removeClass(zldConf.zldResponseValidClass + " border-0")
                        .addClass(zldConf.zldResponseInvalidClass + " border-0");
                    return;
                }

                const escaped = v_name.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
                $(`${groupId}#select2-${escaped}-container`).parent()
                    .addClass(zldConf.zldResponseValidClass + " border-0")
                    .removeClass(zldConf.zldResponseInvalidClass + " border-0");

                markValid(selector);
                addValue(v_name, value);
            });

            textareaList.forEach((obj) => {
                if (!obj) return;

                if (!obj.getAttribute("name")) {
                    console.error("LOG| ERROR: Algum TEXTAREA não possui atributo NAME", obj);
                    return;
                }

                const v_name = obj.name;
                const v_id = obj.id;
                const v_class = obj.className || "";
                const v_required = obj.required || false;
                const v_disabled = obj.disabled || false;
                const selector = `${groupId}[name="${v_name}"]`;

                let v_value = obj.value ?? "";

                if (v_class.indexOf("ckeditor") === 0) {
                    const result = zldCkEditor(v_id, v_name, null);
                    v_value = result.v_value ?? "";
                }

                if (v_required && !v_disabled && v_value === "") {
                    addInvalid(v_name);
                    markInvalid(selector);
                    return;
                }

                markValid(selector);
                addValue(v_name, v_value);
            });
        };

        if (cfg.container && (cfg.valueCatch === 1 || cfg.valueCatch === 2)) {
            processContainer(cfg.container, cfg.valueCatch);
        } else {
            cfg.zldCatchGroupId.forEach((rawId) => {
                const id = normalizeDomId(rawId);
                if (!id) return;

                const container = document.getElementById(id);
                processContainer(container, 1);
            });

            cfg.zldCatchItemName.forEach((item) => {
                if (!item) return;

                if (String(item).includes(":")) {
                    const parts = String(item).split(":");
                    const key = parts[0]?.trim();
                    const val = parts.slice(1).join(":").trim();

                    if (key) addValue(key, val);
                    return;
                }

                const container = document.getElementsByName(String(item).trim());
                processContainer(container, 2);
            });
        }

        return {
            formData,
            data,
            ldValidate,
            invalidFields,
            zldValidateName: (loadData.zldValidateName || "").replace(/,+$/, ''),
            isValid: ldValidate === 0,
        };
    }


    // 5) COLE AQUI: zldActions
    /**
     * ------------------------------------------
     * [5] ACTIONS
     * ------------------------------------------

     */

    function zldActions(actions = [], ctx = {}) {
        if (!Array.isArray(actions)) return;

        actions.forEach((action) => {
            if (!action || !action.type) return;

            try {
                switch (action.type) {
                    case 'toast': {
                        const level = String(action.level || 'info').toLowerCase();
                        const title = action.title || '';
                        const message = action.message || '';

                        // Prioriza UIToast (se existir)
                        if (window.UIToast && typeof window.UIToast[level] === 'function') {
                            window.UIToast[level](message, title, action.options || {});
                            break;
                        }

                        // Fallback para toastr puro
                        if (window.toastr && typeof window.toastr[level] === 'function') {
                            window.toastr[level](message, title);
                            break;
                        }

                        console.warn('zldActions| toast não disponível');
                        break;
                    }

                    case 'modal-close': {
                        const selector = action.selector || '#appModal';
                        const el = document.querySelector(selector);
                        if (!el) return;

                        if (window.bootstrap?.Modal) {
                            window.bootstrap.Modal.getOrCreateInstance(el).hide();
                        } else if (window.jQuery) {
                            window.jQuery(el).modal('hide');
                        }
                        break;
                    }

                    case 'modal-open': {
                        const selector = action.selector || '#appModal';
                        const el = document.querySelector(selector);
                        if (!el) return;

                        if (window.bootstrap?.Modal) {
                            window.bootstrap.Modal.getOrCreateInstance(el).show();
                        } else if (window.jQuery) {
                            window.jQuery(el).modal('show');
                        }
                        break;
                    }

                    case 'offcanvas-close': {
                        const selector = action.selector || '#appOffEnd';
                        const el = document.querySelector(selector);
                        if (!el) return;

                        if (window.bootstrap?.Offcanvas) {
                            window.bootstrap.Offcanvas.getOrCreateInstance(el).hide();
                        } else {
                            // fallback simples
                            el.classList.remove('show');
                        }
                        break;
                    }

                    case 'offcanvas-open': {
                        const selector = action.selector;
                        if (!selector) return;

                        const el = document.querySelector(selector);
                        if (!el) return;

                        if (window.bootstrap?.Offcanvas) {
                            window.bootstrap.Offcanvas.getOrCreateInstance(el).show();
                        } else {
                            el.classList.add('show');
                        }
                        break;
                    }

                    case 'zld-load': {
                        if (typeof window.oziLoaddata === 'function' && action.payload) {
                            window.oziLoaddata(action.payload);
                        } else {
                            console.warn('zldActions| oziLoadData indisponível ou payload vazio');
                        }
                        break;
                    }

                    case 'reload': {
                        window.location.reload();
                        break;
                    }

                    case 'redirect': {
                        if (action.url) window.location.href = action.url;
                        break;
                    }

                    case 'eval': {
                        // opcional, use com cuidado
                        if (action.script && typeof action.script === 'string') {
                            (new Function(action.script))();
                        }
                        break;
                    }

                    default:
                        console.warn('zldActions| ação não mapeada:', action);
                }
            } catch (err) {
                console.error('zldActions| erro ao executar ação:', action, err);
            }
        });
    }

    /**
     * [6]  oziLoaddata
     */
    function oziLoaddata(data = null, loadAttribute = null, clickedEl = null) {
        let ldValidate = 0;
        let formData = new FormData();
        const dataResponse = {
            perm: 0,
            isJson: false,
            ok: false,
            status: 0,
            data: null,
            html: null,
            error: null
        };
        if (data.zldLog) console.log("oziLoadData| data: entrada data", data);

        let elementData = clickedEl;

        const loadData = {
            zldLog: zldParseBool(data?.zldLog ?? data?.ldLog),

            zldUrl: data?.zldUrl ?? data?.ldUrl ?? "",
            zldDestinyId: data?.zldDestinyId ?? data?.ldDestinyId ?? "",
            zldDestinyAppend: zldParseBool(data?.zldDestinyAppend ?? data?.ldDestinyAppend),
            zldDestinyBefore: zldParseBool(data?.zldDestinyBefore ?? data?.ldDestinyBefore),

            zldCatchGroupId:
                data?.zldCatchGroupId ??
                data?.ldCatchGroupId,

            zldCatchItemName: data?.zldCatchItemName ?? data?.ldCatchItemName ?? data?.ldCatchItenName,

            zldMode: data?.zldMode ?? data?.ldWay ?? "fetch",
            zldModeMethod: data?.zldModeMethod ?? data?.ldWayPageMethod ?? "POST",
            zldModePageTarget: data?.zldModePageTarget ?? data?.ldWayPageTarget ?? "_self",

            zldFormClear: zldParseBool(data?.zldFormClear ?? data?.ldFormClear),
            zldFormBusy: zldParseBool(data?.zldFormBusy ?? data?.ldBusy),
            zldReloadScript: zldParseBool(data?.zldReloadScript ?? data?.ldReload),

            zldExpectJson: zldParseBool(data?.zldExpectJson ?? data?.ldExpectJson),
            zldApi: zldParseBool(data?.zldApi ?? data?.ldApi),

            zldJson: data?.zldJson,
            zldCheckbox: data?.zldCheckbox ?? data?.ldCheckbox,
            zldFiles: Array.isArray(data?.zldFiles) ? data.zldFiles : []
        };


        if (loadData.zldLog) console.log("oziLoadData| loadData: distribuição ", loadData);

        const parseList = (raw) => {
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;

            const s = String(raw).trim();

            if (s.startsWith("[") && s.endsWith("]")) {
                try {
                    const arr = JSON.parse(s.replaceAll("'", '"'));
                    return Array.isArray(arr) ? arr : [];
                } catch {
                    return s.split(",").map(x => x.trim()).filter(Boolean);
                }
            }

            return s.split(",").map(x => x.trim()).filter(Boolean);
        };

        loadData.zldCatchGroupId = parseList(loadData.zldCatchGroupId);
        loadData.zldCatchItemName = parseList(loadData.zldCatchItemName);


        // chamada via script (sem evento)
        if (!elementData) {
            elementData = document.createElement("span");
            elementData.id = "zld-script-" + Date.now();
            document.body.appendChild(elementData);
        }

        if (!elementData.id || elementData.id.trim() === "") {
            elementData.id = zldGenerateId();
        }
        loadData.zldId = elementData.id;

        const $button = zldSafeById(loadData.zldId, loadData.zldLog);

        if (loadData.zldFormBusy === true && $button) {
            const disabledClass = zldConf.zldButtonDisabledClass || '';
            const already = disabledClass ? $button.hasClass(disabledClass) : false;

            if (already) return { perm: 1 };

            if (disabledClass) {
                $button.addClass(disabledClass);
            }

            if (zldConf.zldButtonEnabledClass) {
                $button.removeClass(zldConf.zldButtonEnabledClass);
            }

            if (zldConf.zldAriaDisabled) {
                $button.attr('aria-disabled', 'true');
            }

            $button.attr('data-zld-busy', 'true');
        }


        const appendZldFilesToFormData = () => {
            if (!Array.isArray(loadData.zldFiles) || !loadData.zldFiles.length) return;

            loadData.zldFiles.forEach((entry) => {
                if (!entry || !entry.name || !entry.file) return;

                const fieldName = String(entry.name).trim();
                if (!fieldName) return;

                const file = entry.file;
                const filename = entry.filename ? String(entry.filename).trim() : '';

                if (filename) {
                    formData.append(fieldName, file, filename);
                    return;
                }

                formData.append(fieldName, file);
            });
        };


        const addCsrfIfMissing = () => {
            const tokenMeta = $('meta[name="csrf-token"]').attr('content');
            if (tokenMeta && !formData.has("_token")) {
                formData.append("_token", tokenMeta);
            }
        };

        // Coleta grupos
        const normalizeDomId = (v) => {
            if (v === undefined || v === null) return "";
            let s = String(v).trim();

            // remove aspas soltas
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
                s = s.slice(1, -1).trim();
            }

            // aceita "#meuId"
            if (s.startsWith("#")) s = s.slice(1).trim();

            return s;
        };


        // Coleta grupos
        if (Array.isArray(loadData.zldCatchGroupId)) {
            loadData.zldCatchGroupId.forEach(rawId => {
                const id = normalizeDomId(rawId);
                if (!id) return;

                const container = document.getElementById(id);
                if (!container) {
                    if (loadData.zldLog) console.warn("LOG groupId não encontrado", rawId, "normalizado:", id);
                    return;
                }


                const result = oziValidateContainer({
                    container: container,
                    valueCatch: 1,
                    loadData: loadData,
                    formData: formData,
                    ldValidate: ldValidate
                });

                formData = result.formData;
                ldValidate = result.ldValidate;
                loadData.zldValidateName = result.zldValidateName;
            });
        }


        // Coleta individuais
        if (loadData.zldCatchItemName && loadData.zldCatchItemName.length) {
            loadData.zldCatchItemName.forEach(item => {
                if (!item) return;

                if (String(item).includes(":")) {
                    const parts = String(item).split(":");
                    const key = parts[0]?.trim();
                    const val = parts.slice(1).join(":").trim();
                    if (key) formData.append(key, val);
                    return;
                }

                const container = document.getElementsByName(String(item).trim());

                const result = oziValidateContainer({
                    container: container,
                    valueCatch: 2,
                    loadData: loadData,
                    formData: formData,
                    ldValidate: ldValidate
                });

                formData = result.formData;
                ldValidate = result.ldValidate;
                loadData.zldValidateName = result.zldValidateName;
            });
        }


        // ldJson
        if (loadData.zldJson) {
            try {
                const arr = Array.isArray(loadData.zldJson) ? loadData.zldJson : JSON.parse(loadData.zldJson);
                arr.forEach((row, index) => {
                    formData.append(`zldJson[${index}]`, JSON.stringify(row));
                });
            } catch {
                if (loadData.zldLog) console.warn("LOG zldJson inválido", loadData.zldJson);
            }
        }

        addCsrfIfMissing();
        appendZldFilesToFormData();

        // URL join do seu jeito, só garantindo base
        let v_protocol = window.location.protocol;
        let v_url_host = `${v_protocol}//${window.location.host}/`;
        let v_url = loadData.zldUrl;

        // TRAVA AQUI: se tem erro, não envia nada
        if (ldValidate !== 0) {
            if ($button) $button.removeClass("disabled"); // solta o botão se você travou
            return {perm: ldValidate, invalid: loadData.zldValidateName || ""};
        }

        if (loadData.zldLog) console.log("LOG URL base", v_url);

        if (ldValidate !== 0) {
            if ($button) $button.removeClass("disabled");
            return {perm: ldValidate};
        }


        //NÃO ACONSELHADO UTILIZAR JUNTO FRAMEWORK JS
        if (loadData.zldReloadScript === true) {
            var reload = "<script>" + $(".zld-reload-script").html() + "<\/script>";
            // $("#zldReloadScript").html(reload);

            $("#zldReloadScript").contents().find("body").html(reload);

        }

        // Barra global
        if (zldConf.zldProgressBarGlobalOption === true) {
            const progressBarHtml = zldBuildProgressBarHtml();
            const $bar = $('.' + zldConf.zldProgressBarGlobalClass);

            if ($bar.length) {
                $bar.html(progressBarHtml).css({ display: 'block', width: '100%' });

                const $progress = $bar.find('[role="progressbar"]').first()

                $progress.animate(
                    { width: '100%' },
                    {
                        duration: 800,
                        step: function (now) {
                            $(this).text(Math.round(now) + '%');
                        },
                        complete: function () {
                            $(this)
                                .removeClass(zldConf.zldProgressLoadingClass)
                                .addClass(zldConf.zldProgressSuccessClass)
                                .text('Concluído!');
                        }
                    }
                );
            }
        }

        const finishUi = () => {
            if (zldConf.zldProgressBarGlobalOption === true) {
                const $bar = $('.' + zldConf.zldProgressBarGlobalClass);
                if ($bar.length) {
                    setTimeout(() => $bar.css('display', 'none'), 400);
                }
            }

            if ($button) {
                setTimeout(() => {
                    if (zldConf.zldButtonDisabledClass) {
                        $button.removeClass(zldConf.zldButtonDisabledClass);
                    }

                    if (zldConf.zldButtonEnabledClass) {
                        $button.addClass(zldConf.zldButtonEnabledClass);
                    }

                    if (zldConf.zldAriaDisabled) {
                        const isStillInvalid = $button.attr('data-zld-disabled') === 'true';
                        $button.attr('aria-disabled', isStillInvalid ? 'true' : 'false');
                    }

                    $button.attr('data-zld-busy', 'false');
                }, 400);
            }
        };

        const renderToDestiny = (html) => {
            const ld_destiny = loadData.zldDestinyId;
            if (!ld_destiny) return;

            const $destiny = $("#" + ld_destiny);
            if (!$destiny.length) {
                if (loadData.zldLog) console.warn("LOG destino não encontrado", ld_destiny);
                return;
            }

            const root = $destiny[0];

            if (loadData.zldLog) console.log("ZLD| beforeRender", ld_destiny);
            zldRenderDependencies(root, loadData, "before");

            if (loadData.zldDestinyAppend === true) $destiny.append(html);
            else if (loadData.zldDestinyBefore === true) $destiny.before(html);
            else $destiny.html(html);

            if (loadData.zldLog) console.log("ZLD| afterRender", ld_destiny);
            zldRenderDependencies(root, loadData, "after");
        };

        const handleHttpErrorHtml = (status, html) => {
            const msgError = zldBuildAlertHtml(
                'warning',
                'Erro ao carregar.',
                'Status ' + status
            );

            renderToDestiny(msgError);

            $("#logErrorLaravelOziTitle").html(status);
            $("#logErrorLaravelOzi").contents().find("body").html(html);
        };

        if (loadData.zldMode === "fetch") {

            const buildZldFetchHeaders = (method, loadData) => {
                const headers = {
                    "X-Requested-With": "XMLHttpRequest",
                    "X-ZLD": "true",
                };

                const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                if (csrf) {
                    headers["X-CSRF-TOKEN"] = csrf;
                }

                const wantsJson =
                    loadData.zldApi === true ||
                    loadData.zldExpectJson === true ||
                    method !== "GET";

                headers["Accept"] = wantsJson
                    ? "application/json"
                    : "text/html, */*;q=0.8";

                return headers;
            };

            const method = (loadData.zldModeMethod || "POST").toUpperCase();
            const headers = buildZldFetchHeaders(method, loadData);

            return fetch(
                v_url,
                method === "GET"
                    ? {method, headers}
                    : {method, headers, body: formData}
            )
                .then(async (response) => {
                    dataResponse.ok = response.ok;
                    dataResponse.status = response.status;

                    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
                    dataResponse.isJson = contentType.includes('application/json');

                    if (dataResponse.isJson) {
                        let json = null;

                        try {
                            json = await response.json();
                            dataResponse.data = json;
                        } catch (err) {
                            dataResponse.error = err;

                            if (loadData.zldLog) {
                                console.error('zldLog| erro ao ler JSON', err);
                            }

                            renderToDestiny(
                                zldBuildAlertHtml(
                                    'danger',
                                    'Erro: Resposta JSON inválida.',
                                    'Verifique o retorno da rota.'
                                )
                            );

                            return dataResponse;
                        }

                        if (loadData.zldLog) {
                            console.log('zldLog| JSON response', {
                                status: response.status,
                                ok: response.ok,
                                json
                            });
                        }

                        if (json && Array.isArray(json.actions)) {
                            zldActions(json.actions, {loadData, response, json});
                        }

                        if (!response.ok && (!json || !Array.isArray(json.actions) || json.actions.length === 0)) {
                            renderToDestiny(
                                zldBuildAlertHtml(
                                    'warning',
                                    json?.message || 'Erro ao processar.',
                                    'Status ' + response.status
                                )
                            );
                        }

                        return dataResponse;
                    }

                    const html = await response.text();
                    dataResponse.html = html;

                    if (!response.ok) {
                        handleHttpErrorHtml(response.status, html);
                        return dataResponse;
                    }

                    renderToDestiny(html);
                    return dataResponse;
                })
                .catch((err) => {
                    dataResponse.error = err;

                    if (loadData.zldLog) {
                        console.error("LOG fetch falhou", err);
                    }

                    renderToDestiny(
                        zldBuildAlertHtml(
                            'danger',
                            'Erro: Não foi possível carregar.',
                            'Verifique sua conexão.'
                        )
                    );

                    return dataResponse;
                })
                .finally(() => {
                    finishUi();

                    if (loadData.zldFormClear) {
                        (loadData.zldCatchGroupId || []).forEach(groupId => {
                            if (!groupId) return;
                            const $group = $("#" + groupId);
                            if (!$group.length) return;

                            formData.forEach((value, key) => {
                                const $input = $group.find('[name="' + key + '"]');
                                if ($input.length && $input.attr("type") !== "hidden") {
                                    $input.removeClass(zldConf.zldResponseValidClass).removeClass(zldConf.zldResponseInvalidClass);
                                    $input.val("");
                                }
                            });
                        });
                    }
                });
        } else if (loadData.zldMode === "window") {
            let qs = "";
            formData.forEach((value, key) => {
                qs += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
            });
            const finalUrl = loadData.zldUrl + "?" + qs;
            window.open(finalUrl, "_blank", "noopener,noreferrer");
            finishUi();

        } else if (loadData.zldMode === "page") {
            const form = document.createElement("form");
            form.method = (loadData.zldModeMethod || "POST").toUpperCase();
            form.target = loadData.zldModePageTarget || "_self";
            form.action = loadData.zldUrl;

            formData.forEach((value, key) => {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = key;
                input.value = value;
                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
            finishUi();

        } else {
            if (loadData.zldLog) console.warn("LOG zldMode inválido", loadData.zldMode);
            finishUi();
        }

        dataResponse.perm = ldValidate;

        return dataResponse;
    }

    /**
     * [7] BIND AUTOMÁTICO
     */

    $(document).on('click change', '[data-zld-url]', function (e) {
        const el = (e.target && e.target.closest)
            ? e.target.closest('[data-zld-url]')
            : this;

        const zldLog = el.dataset.zldLog
            ? Boolean(JSON.parse(String(el.dataset.zldLog).toLowerCase()))
            : false;

        const attributes = {
            zldUrl: el.dataset.zldUrl,
            zldDestinyId: el.dataset.zldDestinyId,
            zldCatchGroupId:
                el.dataset.zldCatchGroupId ??
                el.getAttribute('data-zld-catch-group-id'),

            zldCatchItemName: el.dataset.zldCatchItemName || el.dataset.ldCatchItemName,

            zldMode: el.dataset.zldMode || el.dataset.ldWay || 'fetch',
            zldModeMethod: el.dataset.zldModeMethod,
            zldModePageTarget: el.dataset.zldModePageTarget,

            zldFormClear: el.dataset.zldFormClear,
            zldFormBusy: el.dataset.zldFormBusy === 'true',

            zldReloadScript: el.dataset.zldReloadScript === 'true',
            zldJson: el.dataset.zldJson,
            zldCheckbox: el.dataset.zldCheckbox,

            zldExpectJson: el.dataset.zldExpectJson,
            zldApi: el.dataset.zldApi,

            zldLog: zldLog
        };

        if (zldLog) {
            console.log('zldLog| dataset', el.dataset);
            console.log('zldLog| attributes', attributes);
        }

        if (zldConf.zldInteractiveValidation === true) {
            const precheck = zldSyncTriggerState(el, {showErrors: true});

            if (!precheck || precheck.isValid !== true) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        oziLoaddata(attributes, null, el);
    });

    /**
     * [8] Bind interativo dos campos
     *
     */
    $(document).on(zldConf.zldInteractiveEvents, 'input, select, textarea', function () {
        if (zldConf.zldInteractiveValidation !== true) return;
        zldSyncRelatedTriggers(this, {showErrors: false});
    });
    /**
     * 6. Inicialização no carregamento e no pós-render
     * */
    $(function () {
        zldInitInteractiveValidation(document);
    });

    zldConf.zldHooks.afterRender.push(function (root) {
        zldInitInteractiveValidation(root);
    });

    /**
     * [9] EXPORTS PÚBLICOS
     */
    window.zldConf = zldConf;
    window.oziConf = oziConf;
    window.oziLoaddata = oziLoaddata;
    window.zldActions = zldActions;
    window.oziValidateContainer = oziValidateContainer;
    window.zldRenderDependencies = zldRenderDependencies;
    window.zldParseBool = zldParseBool;
    window.zldGenerateId = zldGenerateId;
    window.zldSafeById = zldSafeById;


    window.zldParseList = zldParseList;
    window.zldNormalizeDomId = zldNormalizeDomId;
    window.zldReadTriggerValidationConfig = zldReadTriggerValidationConfig;
    window.zldApplyTriggerState = zldApplyTriggerState;
    window.zldSyncTriggerState = zldSyncTriggerState;
    window.zldFieldMatchesTrigger = zldFieldMatchesTrigger;
    window.zldSyncRelatedTriggers = zldSyncRelatedTriggers;
    window.zldInitInteractiveValidation = zldInitInteractiveValidation;


})(jQuery, window, document);