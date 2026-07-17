/**
 * ------------------------------------------
 * ozi-auth
 * ------------------------------------------
 * Ver: 4.0.0
 * 2026-07-04
 *
 * Responsabilidade:
 *   - Validacao de senha/confirmacao/email/usuario aplicada a um <form> inteiro
 *   - Feedback em tempo real: dropdown (focus) e/ou lista estatica em container
 *   - Toggle show/hide senha, badge de comprimento, gestao do botao submit
 *   - Motor de validacao proprio embutido (_oziAuth) — independente do
 *     modulo ozi-password-rules (logica equivalente, sem acoplamento)
 *   - Singleton: escaneia forms, nao cria instancia por <input>. Delegacao
 *     de eventos nativa no document (um unico bind global).
 *
 * Campos (atributos): data-ozi-auth-{user,mail,pass,confirm}
 * Config no submit:    data-ozi-auth-{submit,list-id,dropdown,check}
 *
 * Dependencias: ozi.js (OZI.hooks, OZI.helpers, OZI.lang, OZI.conf.pluginConf.auth)
 *   — zero jQuery (contrato de camadas v2 §2).
 * Expoe: OZI.components.auth, window.OziAuth, window.oziAuth (motor puro),
 *        window.oziAuthInit, window.oziAuthInitFetched (compat)
 * Eventos: ozi:init, ozi:auth-change, ozi:auth-ready, ozi:auth-broken, ozi:destroy
 *
 * Changelog:
 *   - v4.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Zero jQuery. Toda manipulacao de DOM via APIs nativas
 *         (querySelector/classList/insertAdjacentElement/wrap manual).
 *       - Delegacao de input/change/focusout/submit NATIVA no document
 *         (singleton, e.target.closest) em vez de $form.on() por formulario.
 *         'blur' delegado -> 'focusout' (que borbulha).
 *       - Estado por-elemento migrado de $.data() para WeakSet/WeakMap
 *         (forms inicializados, inputs com toggle/dropdown prontos, container da
 *         lista, e o elemento dropdown de cada input).
 *       - [LACUNA CORRIGIDA] Era o unico componente sem CustomEvent. Os eventos
 *         eram jQuery-only ($form.trigger('ozi:auth-*', [payload])). Agora sao
 *         CustomEvent nativos via OZI.helpers.emit(), payload em detail aderente
 *         ao contrato: { component:'ozi-auth', name, value:access, source,
 *         result, access }. Adicionados ozi:init (pos-init de cada form) e
 *         ozi:destroy (via API destroy). Sem shim — ozi:auth-* nao e consumido
 *         no Central RH (inventario F0). source: 'user' na interacao, 'api' no
 *         init/evaluate/destroy programaticos.
 *       - API publica: init, evaluate + destroy (novo). window.OziAuth/oziAuth/
 *         oziAuthInit/oziAuthInitFetched mantidos (aceitam Element|jQuery|seletor).
 *
 *   Historico anterior (jQuery):
 *   - v3.0.1: classes is-valid/is-invalid BS5 -> _classMap(); strings PT -> _t().
 */

(function (window, document) {
    'use strict';

    // ─────────────────────────────────────────────
    // [0] GUARD — Singleton
    // ─────────────────────────────────────────────

    if (window.OziAuth) return;

    var FIELD_SEL = '[data-ozi-auth-mail], [data-ozi-auth-pass], [data-ozi-auth-confirm], [data-ozi-auth-user]';

    // estado por-elemento (substitui $.data)
    var _inited        = new WeakSet(); // <form> ja inicializado
    var _toggleReady   = new WeakSet(); // input com toggle construido
    var _listReady     = new WeakSet(); // container da lista renderizado
    var _dropdownReady = new WeakSet(); // input com dropdown bindado
    var _dropdowns     = new WeakMap(); // input -> elemento do dropdown

    var _docBound = false;


    // ─────────────────────────────────────────────
    // [1] HELPERS INTERNOS
    // ─────────────────────────────────────────────

    function _classMap(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        return (conf && conf.classMap && conf.classMap[key]) || fallback || '';
    }

    function _t(key, fallback, params) {
        var lang = window.OZI && window.OZI.lang;
        if (lang && typeof lang.t === 'function') {
            var v = lang.t(key, params);
            if (v && v !== key) return v;
        }
        if (params && fallback) {
            return fallback.replace(/\{(\w+)\}/g, function (_, k) {
                return params[k] !== undefined ? params[k] : '{' + k + '}';
            });
        }
        return fallback || key;
    }

    function _trim(v) { return String(v == null ? '' : v).trim(); }
    function _val(el) { return el ? String(el.value || '') : ''; }
    function _attr(el, name) { return el ? el.getAttribute(name) : null; }

    // classList.add/remove aceitando string com multiplas classes (ex.: tailwind)
    function _classListOp(el, classString, method) {
        if (!el || !classString) return;
        String(classString).trim().split(/\s+/).forEach(function (c) { if (c) el.classList[method](c); });
    }

    // normaliza Element | jQuery | seletor -> Element (API publica)
    function _toEl(x) {
        if (!x) return null;
        if (x.nodeType === 1 || x.nodeType === 9) return x;
        if (typeof x === 'string') return document.querySelector(x);
        if (x.jquery) return x[0] || null; // objeto jQuery da API — so leitura de propriedade
        return null;
    }


    // ─────────────────────────────────────────────
    // [2] MOTOR DE VALIDACAO (puro — inalterado)
    // ─────────────────────────────────────────────

    function _oziAuth(data) {
        data = data || {};

        var result = {
            userValid:        true,
            mailValid:        false,
            passLength:       false,
            passLowercase:    false,
            passUppercase:    false,
            passNumber:       false,
            passSpecial:      false,
            passNoSpace:      false,
            passNoEmailParts: true,
            passConfirm:      false,
            access:           false
        };

        var user         = String(data.user     || '').trim();
        var mail         = String(data.mail     || '').trim().toLowerCase();
        var pass         = String(data.password || '');
        var confirm      = String(data.confirm  || '');
        var userCaracter = Number(data.userCaracter || 0);
        var passMin      = Number(data.passMin  || 8);
        var passMax      = Number(data.passMax  || 64);

        if (userCaracter > 0) result.userValid = user.length >= userCaracter;

        result.mailValid      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
        result.passLength     = pass.length >= passMin && pass.length <= passMax;
        result.passLowercase  = /[a-z]/.test(pass);
        result.passUppercase  = /[A-Z]/.test(pass);
        result.passNumber     = /\d/.test(pass);
        result.passSpecial    = /[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/.test(pass);
        result.passNoSpace    = !/\s/.test(pass);

        if (mail && mail.indexOf('@') > -1) {
            var mailParts  = mail.split('@');
            var localPart  = mailParts[0] || '';
            var domainPart = mailParts[1] || '';
            var parts = [localPart, domainPart]
                .concat(localPart.split(/[._\-+]/))
                .concat(domainPart.split(/[.\-]/))
                .map(function (v) { return String(v || '').trim(); })
                .filter(function (v) { return v.length >= 3; });

            result.passNoEmailParts = !parts.some(function (part) {
                return pass.toLowerCase().indexOf(part.toLowerCase()) !== -1;
            });
        }

        result.passConfirm = confirm.length > 0 && confirm === pass;

        result.access =
            result.userValid &&
            result.mailValid &&
            result.passLength &&
            result.passLowercase &&
            result.passUppercase &&
            result.passNumber &&
            result.passSpecial &&
            result.passNoSpace &&
            result.passNoEmailParts &&
            result.passConfirm;

        return result;
    }


    // ─────────────────────────────────────────────
    // [3] REGRAS — textos via _t()
    // ─────────────────────────────────────────────

    function _getPassRules(passMin, passMax) {
        return [
            { key: 'mailValid',        text: _t('auth.mailRequired', 'Preencher email obrigatório') },
            { key: 'passLength',       text: _t('auth.passLength', '{min} até {max} caracteres', { min: passMin, max: passMax }), badge: true, passMin: passMin, passMax: passMax },
            { key: 'passLowercase',    text: _t('auth.lowercase', '1 letra minúscula') },
            { key: 'passUppercase',    text: _t('auth.uppercase', '1 letra maiúscula') },
            { key: 'passNumber',       text: _t('auth.number', '1 número') },
            { key: 'passSpecial',      text: _t('auth.special', '1 caractere especial') },
            { key: 'passNoSpace',      text: _t('auth.noSpace', 'Não pode conter espaços') },
            { key: 'passNoEmailParts', text: _t('auth.noEmailParts', 'Não pode conter partes do email') }
        ];
    }

    function _getConfirmRules() {
        return [{ key: 'passConfirm', text: _t('auth.confirm', 'Senha e confirmação devem ser iguais') }];
    }


    // ─────────────────────────────────────────────
    // [4] MODO
    // ─────────────────────────────────────────────

    function _getMode(form) {
        var submit = form.querySelector('[data-ozi-auth-submit]');
        if (!submit) return { submit: null, listId: '', list: false, dropdown: true, checkIcons: null };

        var listId      = _trim(submit.getAttribute('data-ozi-auth-list-id'));
        var hasDropdown = submit.matches('[data-ozi-auth-dropdown]');
        var checkRaw    = _trim(submit.getAttribute('data-ozi-auth-check'));
        var checkIcons  = null;

        if (checkRaw) {
            var parts = checkRaw.split(',').map(_trim).filter(Boolean);
            checkIcons = { invalid: parts[0] || '', valid: parts[1] || parts[0] || '' };
        }

        return { submit: submit, listId: listId, list: !!listId, dropdown: hasDropdown || !listId, checkIcons: checkIcons };
    }


    // ─────────────────────────────────────────────
    // [5] TOGGLE SHOW/HIDE SENHA
    // ─────────────────────────────────────────────

    function _buildToggle(input, iconShow, iconHide) {
        if (input.parentElement && input.parentElement.classList.contains('ozi-auth-input-group')) return;
        if (String(input.getAttribute('type') || '').toLowerCase() !== 'password') return;

        var customClass = _trim(input.getAttribute('data-ozi-auth-class'));
        var btnClass    = customClass || 'ozi-auth-btn-toggle';

        // wrap: <div class="ozi-auth-input-group"> input </div>
        var group = document.createElement('div');
        group.className = 'ozi-auth-input-group';
        input.parentNode.insertBefore(group, input);
        group.appendChild(input);

        var toggle = document.createElement('button');
        toggle.type = 'button';
        _classListOp(toggle, btnClass, 'add');
        toggle.setAttribute('tabindex', '-1');
        toggle.setAttribute('aria-label', _t('auth.showPassword', 'Mostrar senha'));
        var i = document.createElement('i');
        _classListOp(i, iconShow, 'add');
        toggle.appendChild(i);

        input.insertAdjacentElement('afterend', toggle);

        toggle.addEventListener('click', function () {
            var isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            toggle.setAttribute('aria-label', isPassword
                ? _t('auth.hidePassword', 'Ocultar senha')
                : _t('auth.showPassword', 'Mostrar senha'));
            var ic = toggle.querySelector('i');
            if (ic) ic.setAttribute('class', isPassword ? iconHide : iconShow);
            input.focus();
        });
    }

    function _initPasswordToggle(form) {
        Array.prototype.forEach.call(form.querySelectorAll('[data-ozi-auth-pass], [data-ozi-auth-confirm]'), function (input) {
            if (_toggleReady.has(input)) return;
            _toggleReady.add(input);

            var icons = _trim(input.getAttribute('data-ozi-auth-pass') || input.getAttribute('data-ozi-auth-confirm'));
            if (!icons) return;

            var parts    = icons.split(',').map(_trim).filter(Boolean);
            var iconShow = parts[0] || 'bi bi-eye-slash';
            var iconHide = parts[1] || 'bi bi-eye';

            _buildToggle(input, iconShow, iconHide);
        });
    }


    // ─────────────────────────────────────────────
    // [6] HELPERS DE RENDER
    // ─────────────────────────────────────────────

    function _buildRuleItemHtml(rule) {
        var badgeHtml = rule.badge
            ? '<span class="ozi-badge-count">0/' + (rule.passMax || 14) + '</span>'
            : '';
        return '<div class="ozi-auth-list-item ozi-auth-list-item--invalid" data-rule="' + rule.key + '">' +
            '<span class="ozi-auth-rule-icon"><i class="ozi-auth-icon-invalid"></i></span>' +
            '<span class="ozi-auth-rule-text">' + rule.text + ' ' + badgeHtml + '</span>' +
            '</div>';
    }

    function _buildDropdownItemEl(rule) {
        var item = document.createElement('div');
        item.className = 'ozi-auth-dropdown-item ozi-auth-dropdown-item--invalid';
        item.setAttribute('data-rule', rule.key);

        var icon = document.createElement('span');
        icon.className = 'ozi-auth-dd-icon';
        var ii = document.createElement('i');
        ii.className = 'ozi-auth-icon-invalid';
        icon.appendChild(ii);

        var text = document.createElement('span');
        text.className = 'ozi-auth-dd-text';
        if (rule.badge) {
            text.appendChild(document.createTextNode(rule.text + ' '));
            var badge = document.createElement('span');
            badge.className = 'ozi-badge-count';
            badge.textContent = '0/' + (rule.passMax || 14);
            text.appendChild(badge);
        } else {
            text.textContent = rule.text;
        }

        item.appendChild(icon);
        item.appendChild(text);
        return item;
    }


    // ─────────────────────────────────────────────
    // [7] LIST
    // ─────────────────────────────────────────────

    function _ensureList(form, mode, passMin, passMax) {
        if (!mode.list || !mode.listId) return null;
        var container = document.getElementById(mode.listId);
        if (!container) return null;
        if (_listReady.has(container)) return container;
        _listReady.add(container);

        var passRules    = _getPassRules(passMin, passMax);
        var confirmRules = _getConfirmRules();
        var rulesHtml    = '';
        passRules.forEach(function (r) { rulesHtml += _buildRuleItemHtml(r); });
        confirmRules.forEach(function (r) { rulesHtml += _buildRuleItemHtml(r); });

        container.innerHTML =
            '<div class="ozi-auth-alert ozi-auth-alert-box">' +
            '<div class="ozi-auth-alert-title">' + _t('auth.rulesTitle', 'Regras da senha') + '</div>' +
            '<div class="ozi-auth-list-rules">' + rulesHtml + '</div>' +
            '<div class="ozi-auth-summary ozi-auth-summary--invalid">' +
            _t('auth.summaryInvalid', 'Preencha os critérios acima para continuar.') +
            '</div>' +
            '</div>';

        return container;
    }


    // ─────────────────────────────────────────────
    // [8] DROPDOWNS
    // ─────────────────────────────────────────────

    function _ensureDropdowns(form, mode, passMin, passMax) {
        if (!mode.dropdown) return;

        var pass    = form.querySelector('[data-ozi-auth-pass]');
        var confirm = form.querySelector('[data-ozi-auth-confirm]');

        if (!window.__oziAuthDropdownOutsideBound) {
            window.__oziAuthDropdownOutsideBound = true;
            document.addEventListener('mousedown', function (e) {
                if (!(e.target && e.target.closest && e.target.closest('.ozi-auth-dropdown-wrap'))) {
                    Array.prototype.forEach.call(document.querySelectorAll('.ozi-auth-dropdown-menu'), function (m) {
                        m.style.display = 'none';
                    });
                }
            });
        }

        function _bindDropdown(input, dropdown) {
            var blurTimer = null;
            function open() {
                clearTimeout(blurTimer);
                Array.prototype.forEach.call(document.querySelectorAll('.ozi-auth-dropdown-menu'), function (m) {
                    if (m !== dropdown) m.style.display = 'none';
                });
                dropdown.style.display = 'block';
            }
            input.addEventListener('focus', open);
            input.addEventListener('click', open);
            input.addEventListener('blur', function () {
                blurTimer = setTimeout(function () { dropdown.style.display = 'none'; }, 150);
            });
            dropdown.addEventListener('mousedown', function () { clearTimeout(blurTimer); });
        }

        function _createDropdown(input, rules, extraClass) {
            var existing = _dropdowns.get(input);
            if (existing) return existing;

            var wrap = document.createElement('div');
            wrap.className = 'ozi-auth-dropdown-wrap';
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);

            var dropdown = document.createElement('div');
            dropdown.className = 'ozi-auth-dropdown-menu ' + (extraClass || '');
            rules.forEach(function (rule) { dropdown.appendChild(_buildDropdownItemEl(rule)); });

            input.insertAdjacentElement('afterend', dropdown);
            _dropdowns.set(input, dropdown);
            return dropdown;
        }

        if (pass && !_dropdownReady.has(pass)) {
            _dropdownReady.add(pass);
            _bindDropdown(pass, _createDropdown(pass, _getPassRules(passMin, passMax), 'ozi-auth-dropdown-pass'));
        }

        if (confirm && !_dropdownReady.has(confirm)) {
            _dropdownReady.add(confirm);
            _bindDropdown(confirm, _createDropdown(confirm, _getConfirmRules(), 'ozi-auth-dropdown-confirm'));
        }
    }


    // ─────────────────────────────────────────────
    // [9] UPDATE UI
    // ─────────────────────────────────────────────

    function _resolveRuleIcon(item, ok, checkIcons) {
        var icon = item.querySelector('.ozi-auth-rule-icon i, .ozi-auth-dd-icon i');
        if (!icon) return;
        if (checkIcons) icon.setAttribute('class', ok ? checkIcons.valid : checkIcons.invalid);
        else            icon.setAttribute('class', ok ? 'ozi-auth-icon-valid' : 'ozi-auth-icon-invalid');
    }

    function _updateBadge(item, passLen, passMax) {
        var badge = item.querySelector('.ozi-badge-count');
        if (!badge) return;
        var len  = Math.min(passLen, passMax);
        var rest = Math.max(0, 8 - passLen);
        if (passLen === 0) {
            badge.textContent = '0/' + passMax;
        } else if (passLen <= passMax) {
            badge.textContent = len + '/' + passMax + (rest > 0 ? ' · ' + _t('auth.remaining', 'faltam') + ' ' + rest : '');
        } else {
            badge.textContent = passLen + '/' + passMax + ' · ' + _t('auth.exceeded', 'excedido');
        }
    }

    function _updateList(form, result, mode, passMax) {
        if (!mode.list || !mode.listId) return;
        var container = document.getElementById(mode.listId);
        if (!container) return;

        Array.prototype.forEach.call(container.querySelectorAll('[data-rule]'), function (item) {
            var key = String(item.getAttribute('data-rule') || '');
            var ok  = !!result[key];
            item.classList.remove('ozi-auth-list-item--valid', 'ozi-auth-list-item--invalid');
            item.classList.add(ok ? 'ozi-auth-list-item--valid' : 'ozi-auth-list-item--invalid');
            _resolveRuleIcon(item, ok, mode.checkIcons);
            if (key === 'passLength') _updateBadge(item, result.passLen, passMax);
        });

        var summary = container.querySelector('.ozi-auth-summary');
        if (summary) {
            summary.classList.remove('ozi-auth-summary--valid', 'ozi-auth-summary--invalid');
            summary.classList.add(result.access ? 'ozi-auth-summary--valid' : 'ozi-auth-summary--invalid');
            summary.innerHTML = result.access
                ? _t('auth.summaryValid',   'Senha pronta para salvar.')
                : _t('auth.summaryInvalid', 'Preencha os critérios acima para continuar.');
        }
    }

    function _updateDropdown(dropdown, result, checkIcons, passMax) {
        if (!dropdown) return;
        Array.prototype.forEach.call(dropdown.querySelectorAll('[data-rule]'), function (item) {
            var key = String(item.getAttribute('data-rule') || '');
            var ok  = !!result[key];
            item.classList.remove('ozi-auth-dropdown-item--valid', 'ozi-auth-dropdown-item--invalid');
            item.classList.add(ok ? 'ozi-auth-dropdown-item--valid' : 'ozi-auth-dropdown-item--invalid');
            _resolveRuleIcon(item, ok, checkIcons);
            if (key === 'passLength') _updateBadge(item, result.passLen, passMax);
        });
    }

    function _updateDropdowns(form, result, mode, passMax) {
        if (!mode.dropdown) return;
        var pass    = form.querySelector('[data-ozi-auth-pass]');
        var confirm = form.querySelector('[data-ozi-auth-confirm]');
        _updateDropdown(pass    && _dropdowns.get(pass),    result, mode.checkIcons, passMax);
        _updateDropdown(confirm && _dropdowns.get(confirm), result, mode.checkIcons, passMax);
    }

    function _updateFieldState(field, valid, emptyOk) {
        if (!field) return;
        var val        = String(field.value || '').trim();
        var clsValid   = _classMap('valid',   'ozi-valid');
        var clsInvalid = _classMap('invalid', 'ozi-invalid');
        _classListOp(field, clsValid, 'remove');
        _classListOp(field, clsInvalid, 'remove');
        if (val === '' && emptyOk !== false) return;
        _classListOp(field, valid ? clsValid : clsInvalid, 'add');
    }

    function _updateConfirmState(confirm, result) {
        if (!confirm) return;
        var confirmVal = String(confirm.value || '');
        var clsValid   = _classMap('valid',   'ozi-valid');
        var clsInvalid = _classMap('invalid', 'ozi-invalid');
        _classListOp(confirm, clsValid, 'remove');
        _classListOp(confirm, clsInvalid, 'remove');
        if (confirmVal === '') return;
        _classListOp(confirm, result.passConfirm ? clsValid : clsInvalid, 'add');
    }

    function _updateButton(form, result, mode) {
        if (!mode.submit) return;
        var submit = mode.submit;

        submit.disabled = !result.access;
        submit.classList.toggle('ozi-auth-submit--disabled', !result.access);
        submit.classList.toggle('ozi-auth-submit--ready', !!result.access);

        if (mode.checkIcons) {
            var icon = submit.querySelector('.ozi-auth-btn-check-icon');
            if (!icon) {
                icon = document.createElement('i');
                icon.className = 'ozi-auth-btn-check-icon';
                submit.insertBefore(icon, submit.firstChild);
            }
            icon.setAttribute('class', 'ozi-auth-btn-check-icon ' + (result.access ? mode.checkIcons.valid : mode.checkIcons.invalid));
        }
    }


    // ─────────────────────────────────────────────
    // [10] EMIT — contrato v2, sem dual-dispatch
    // ─────────────────────────────────────────────

    function _emit(form, name, extra, source) {
        extra = extra || {};
        var access = extra.access;
        if (access === undefined && extra.result) access = !!extra.result.access;

        var detail = {
            component: 'ozi-auth',
            name:      form.getAttribute('name') || form.id || null,
            value:     (access === undefined || access === null) ? null : !!access,
            source:    source || 'user'
        };
        if (extra.result !== undefined) detail.result = extra.result;
        if (extra.access !== undefined) detail.access = extra.access;

        var helpers = window.OZI && window.OZI.helpers;
        if (helpers && typeof helpers.emit === 'function') {
            helpers.emit(form, name, detail);
        } else if (typeof CustomEvent === 'function') {
            form.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
        }
    }


    // ─────────────────────────────────────────────
    // [11] AVALIACAO DO FORM
    // ─────────────────────────────────────────────

    function _evaluateForm(form, source) {
        var mode = _getMode(form);

        var mail    = form.querySelector('[data-ozi-auth-mail]');
        var pass    = form.querySelector('[data-ozi-auth-pass]');
        var confirm = form.querySelector('[data-ozi-auth-confirm]');
        var user    = form.querySelector('[data-ozi-auth-user]');

        var pluginConf   = window.OZI && window.OZI.conf && window.OZI.conf.pluginConf && window.OZI.conf.pluginConf.auth;
        var passMin      = parseInt(_attr(pass, 'data-ozi-auth-pass-min') || '', 10)      || (pluginConf && pluginConf.passMin)      || 8;
        var passMax      = parseInt(_attr(pass, 'data-ozi-auth-pass-max') || '', 10)      || (pluginConf && pluginConf.passMax)      || 64;
        var userCaracter = parseInt(_attr(user, 'data-ozi-auth-user-caracter') || '', 10) || (pluginConf && pluginConf.userCaracter) || 0;

        var result = _oziAuth({
            user:         _val(user),
            userCaracter: userCaracter,
            mail:         _val(mail),
            password:     _val(pass),
            confirm:      _val(confirm),
            passMin:      passMin,
            passMax:      passMax
        });

        result.passLen = _val(pass).length;

        _updateFieldState(mail, result.mailValid, _val(pass) === '');
        _updateFieldState(pass, (
            result.passLength && result.passLowercase && result.passUppercase &&
            result.passNumber && result.passSpecial && result.passNoSpace && result.passNoEmailParts
        ), true);
        _updateConfirmState(confirm, result);
        _updateButton(form, result, mode);
        _updateList(form, result, mode, passMax);
        _updateDropdowns(form, result, mode, passMax);

        _emit(form, 'ozi:auth-change', { result: result, access: result.access }, source);
        if (result.access) _emit(form, 'ozi:auth-ready', { result: result, access: true }, source);

        return result;
    }


    // ─────────────────────────────────────────────
    // [12] DELEGACAO NATIVA — singleton no document
    // ─────────────────────────────────────────────

    function _onFieldEvent(e) {
        var field = (e.target && e.target.closest) ? e.target.closest(FIELD_SEL) : null;
        if (!field) return;
        var form = field.closest('form');
        if (!form || !_inited.has(form)) return;
        _evaluateForm(form, 'user');
    }

    function _onSubmit(e) {
        var form = e.target;
        if (!form || form.nodeName !== 'FORM' || !_inited.has(form)) return;
        var result = _evaluateForm(form, 'user');
        if (!result || !result.access) {
            e.preventDefault();
            _emit(form, 'ozi:auth-broken', { result: result, access: false }, 'user');
        }
    }

    function _bindDocOnce() {
        if (_docBound) return;
        _docBound = true;
        // 'focusout' (borbulha) no lugar do 'blur' delegado da v1
        document.addEventListener('input', _onFieldEvent);
        document.addEventListener('change', _onFieldEvent);
        document.addEventListener('focusout', _onFieldEvent);
        document.addEventListener('submit', _onSubmit);
    }


    // ─────────────────────────────────────────────
    // [13] INIT / DESTROY NO ESCOPO
    // ─────────────────────────────────────────────

    function _initForm(form) {
        var hasAuth = form.querySelector('[data-ozi-auth-mail], [data-ozi-auth-pass], [data-ozi-auth-confirm]');
        if (!hasAuth || _inited.has(form)) return;
        _inited.add(form);

        var mode       = _getMode(form);
        var pass       = form.querySelector('[data-ozi-auth-pass]');
        var pluginConf = window.OZI && window.OZI.conf && window.OZI.conf.pluginConf && window.OZI.conf.pluginConf.auth;
        var passMin    = parseInt(_attr(pass, 'data-ozi-auth-pass-min') || '', 10) || (pluginConf && pluginConf.passMin) || 8;
        var passMax    = parseInt(_attr(pass, 'data-ozi-auth-pass-max') || '', 10) || (pluginConf && pluginConf.passMax) || 64;

        _initPasswordToggle(form);
        _ensureList(form, mode, passMin, passMax);
        _ensureDropdowns(form, mode, passMin, passMax);

        _emit(form, 'ozi:init', { result: null, access: null }, 'api');
        _evaluateForm(form, 'api');
    }

    function _collectForms(root) {
        var scope = (root && root.querySelectorAll) ? root : document;
        var forms = Array.prototype.slice.call(scope.querySelectorAll('form'));
        if (root && root.nodeType === 1 && root.matches && root.matches('form') && forms.indexOf(root) === -1) {
            forms.push(root); // addBack — root pode ser o proprio form
        }
        return forms;
    }

    function _initScope(root) {
        _bindDocOnce();
        _collectForms(root).forEach(_initForm);
    }

    function _destroyScope(root) {
        _collectForms(root).forEach(function (form) {
            if (!_inited.has(form)) return;
            _inited.delete(form);
            _emit(form, 'ozi:destroy', { result: null, access: null }, 'api');
        });
    }


    // ─────────────────────────────────────────────
    // [14] API PUBLICA — OZI.components.auth
    // ─────────────────────────────────────────────

    var authAPI = {
        init: function (root) {
            _initScope(_toEl(root) || (root ? null : document));
        },
        evaluate: function (formEl) {
            var el = _toEl(formEl);
            if (!el) return;
            var form = el.nodeName === 'FORM' ? el : (el.closest ? el.closest('form') : null);
            if (form) _evaluateForm(form, 'api');
        },
        destroy: function (root) {
            _destroyScope(_toEl(root) || (root ? null : document));
        }
    };


    // ─────────────────────────────────────────────
    // [15] COMPAT ZLD — zldConf.zldHooks.afterRender
    // ─────────────────────────────────────────────

    function _bindZldCompat() {
        var zld = window.__zldConf || (window.zldConf && window.zldConf.zldHooks ? window.zldConf : null);
        if (zld && zld.zldHooks && Array.isArray(zld.zldHooks.afterRender)) {
            var already = zld.zldHooks.afterRender.some(function (fn) { return fn && fn.__oziAuthHook === true; });
            if (!already) {
                var hook = function (root) {
                    var target = (root && root.jquery) ? root[0] : root; // root pode vir como objeto jQuery de hosts v1
                    authAPI.init(target || document);
                };
                hook.__oziAuthHook = true;
                zld.zldHooks.afterRender.push(hook);
            }
        }
    }


    // ─────────────────────────────────────────────
    // [16] EXPOSICAO + BOOT
    // ─────────────────────────────────────────────

    // compat v0.x — atribuidos sincronamente
    window.oziAuth            = _oziAuth; // motor puro
    window.oziAuthInit        = function (scope) { _initScope(_toEl(scope) || (scope ? null : document)); };
    window.oziAuthInitFetched = function (root)  { _initScope(_toEl(root)  || (root  ? null : document)); };

    window.OziAuth = {
        init:     authAPI.init,
        evaluate: authAPI.evaluate,
        destroy:  authAPI.destroy
    };

    function _boot() {
        _initScope(document);

        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.auth = authAPI;
        }

        if (OZI && OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:auth', function (root) {
                authAPI.init(root);
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
