/**
 * ------------------------------------------
 * ozi-auth
 * ------------------------------------------
 * Ver: 3.0.1
 * 2026-05-30
 *
 * Changelog:
 *   - v3.0.1: [FIX-P1] _updateFieldState e _updateConfirmState — classes
 *     'is-valid'/'is-invalid' BS5 substituídas por _classMap().
 *   - v3.0.1: [FIX-B]  _classMap() helper adicionado ao módulo.
 *   - v3.0.1: [FIX-P2] Strings PT hardcoded substituídas por _t() com fallback.
 *     Textos de regras, summary, título e badges usam OZI.lang.t() quando disponível.
 */

(function ($, window, document) {
    'use strict';

    if (typeof $ === 'undefined') {
        console.error('[OZI:auth] jQuery não encontrado.');
        return;
    }

    /* ─────────────────────────────────────────────
     * [1] HELPERS INTERNOS
     * ───────────────────────────────────────────── */

    // [FIX-B] classMap helper — mesmo padrão dos outros componentes
    function _classMap(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        return (conf && conf.classMap && conf.classMap[key]) || fallback || '';
    }

    // [FIX-P2] tradução com fallback
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

    /* ─────────────────────────────────────────────
     * [2] MOTOR DE VALIDAÇÃO
     * ───────────────────────────────────────────── */

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

    /* ─────────────────────────────────────────────
     * [3] REGRAS — textos via _t()
     * ───────────────────────────────────────────── */

    function _getPassRules(passMin, passMax) {
        return [
            {
                key:     'mailValid',
                text:    _t('auth.mailRequired', 'Preencher email obrigatório')
            },
            {
                key:     'passLength',
                text:    _t('auth.passLength', '{min} até {max} caracteres', { min: passMin, max: passMax }),
                badge:   true,
                passMin: passMin,
                passMax: passMax
            },
            {
                key:  'passLowercase',
                text: _t('auth.lowercase', '1 letra minúscula')
            },
            {
                key:  'passUppercase',
                text: _t('auth.uppercase', '1 letra maiúscula')
            },
            {
                key:  'passNumber',
                text: _t('auth.number', '1 número')
            },
            {
                key:  'passSpecial',
                text: _t('auth.special', '1 caractere especial')
            },
            {
                key:  'passNoSpace',
                text: _t('auth.noSpace', 'Não pode conter espaços')
            },
            {
                key:  'passNoEmailParts',
                text: _t('auth.noEmailParts', 'Não pode conter partes do email')
            }
        ];
    }

    function _getConfirmRules() {
        return [{
            key:  'passConfirm',
            text: _t('auth.confirm', 'Senha e confirmação devem ser iguais')
        }];
    }

    /* ─────────────────────────────────────────────
     * [4] MODO
     * ───────────────────────────────────────────── */

    function _getMode($form) {
        var $submit = $form.find('[data-ozi-auth-submit]').first();
        if (!$submit.length) return { submit: $(), listId: '', list: false, dropdown: true, checkIcons: null };

        var listId      = String($submit.attr('data-ozi-auth-list-id') || '').trim();
        var hasDropdown = $submit.is('[data-ozi-auth-dropdown]');
        var checkRaw    = String($submit.attr('data-ozi-auth-check') || '').trim();
        var checkIcons  = null;

        if (checkRaw) {
            var parts = checkRaw.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
            checkIcons = { invalid: parts[0] || '', valid: parts[1] || parts[0] || '' };
        }

        return { submit: $submit, listId: listId, list: !!listId, dropdown: hasDropdown || !listId, checkIcons: checkIcons };
    }

    /* ─────────────────────────────────────────────
     * [5] TOGGLE SHOW/HIDE SENHA
     * ───────────────────────────────────────────── */

    function _buildToggle($input, iconShow, iconHide) {
        if ($input.parent().hasClass('ozi-auth-input-group')) return;
        if (String($input.attr('type') || '').toLowerCase() !== 'password') return;

        var customClass = String($input.attr('data-ozi-auth-class') || '').trim();
        var btnClass    = customClass || 'ozi-auth-btn-toggle';

        $input.wrap('<div class="ozi-auth-input-group"></div>');

        var $toggle = $('<button>', {
            type:         'button',
            class:        btnClass,
            tabindex:     -1,
            'aria-label': _t('auth.showPassword', 'Mostrar senha')
        }).append($('<i>', { class: iconShow }));

        $input.after($toggle);

        $toggle.on('click', function () {
            var isPassword = $input.attr('type') === 'password';
            $input.attr('type', isPassword ? 'text' : 'password');
            $(this)
                .attr('aria-label', isPassword
                    ? _t('auth.hidePassword', 'Ocultar senha')
                    : _t('auth.showPassword', 'Mostrar senha'))
                .find('i').attr('class', isPassword ? iconHide : iconShow);
            $input.trigger('focus');
        });
    }

    function _initPasswordToggle($form) {
        $form.find('[data-ozi-auth-pass], [data-ozi-auth-confirm]').each(function () {
            var $input = $(this);
            if ($input.data('oziAuthToggleReady') === 1) return;
            $input.data('oziAuthToggleReady', 1);

            var icons = String($input.attr('data-ozi-auth-pass') || $input.attr('data-ozi-auth-confirm') || '').trim();
            if (!icons) return;

            var parts    = icons.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
            var iconShow = parts[0] || 'bi bi-eye-slash';
            var iconHide = parts[1] || 'bi bi-eye';

            _buildToggle($input, iconShow, iconHide);
        });
    }

    /* ─────────────────────────────────────────────
     * [6] HELPERS DE RENDER
     * ───────────────────────────────────────────── */

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
        var $item = $('<div>', { class: 'ozi-auth-dropdown-item ozi-auth-dropdown-item--invalid', 'data-rule': rule.key });
        var $icon = $('<span>', { class: 'ozi-auth-dd-icon' }).append($('<i>', { class: 'ozi-auth-icon-invalid' }));
        var $text = $('<span>', { class: 'ozi-auth-dd-text' });

        if (rule.badge) {
            $text.append(document.createTextNode(rule.text + ' '))
                .append($('<span>', { class: 'ozi-badge-count' }).text('0/' + (rule.passMax || 14)));
        } else {
            $text.text(rule.text);
        }

        return $item.append($icon, $text);
    }

    /* ─────────────────────────────────────────────
     * [7] LIST
     * ───────────────────────────────────────────── */

    function _ensureList($form, mode, passMin, passMax) {
        if (!mode.list || !mode.listId) return null;
        var $container = $('#' + mode.listId);
        if (!$container.length) return null;
        if ($container.data('oziAuthListReady') === 1) return $container;
        $container.data('oziAuthListReady', 1);

        var passRules    = _getPassRules(passMin, passMax);
        var confirmRules = _getConfirmRules();
        var rulesHtml    = '';
        passRules.forEach(function (r) { rulesHtml += _buildRuleItemHtml(r); });
        confirmRules.forEach(function (r) { rulesHtml += _buildRuleItemHtml(r); });

        $container.html(
            '<div class="ozi-auth-alert ozi-auth-alert-box">' +
            '<div class="ozi-auth-alert-title">' + _t('auth.rulesTitle', 'Regras da senha') + '</div>' +
            '<div class="ozi-auth-list-rules">' + rulesHtml + '</div>' +
            '<div class="ozi-auth-summary ozi-auth-summary--invalid">' +
            _t('auth.summaryInvalid', 'Preencha os critérios acima para continuar.') +
            '</div>' +
            '</div>'
        );

        return $container;
    }

    /* ─────────────────────────────────────────────
     * [8] DROPDOWNS
     * ───────────────────────────────────────────── */

    function _ensureDropdowns($form, mode, passMin, passMax) {
        if (!mode.dropdown) return;

        var $pass    = $form.find('[data-ozi-auth-pass]').first();
        var $confirm = $form.find('[data-ozi-auth-confirm]').first();

        if (!window.__oziAuthDropdownOutsideBound) {
            window.__oziAuthDropdownOutsideBound = true;
            $(document).on('mousedown.oziAuthDropdown', function (e) {
                if (!$(e.target).closest('.ozi-auth-dropdown-wrap').length) {
                    $('.ozi-auth-dropdown-menu').hide();
                }
            });
        }

        function _bindDropdown($input, $dropdown) {
            var blurTimer = null;
            $input.on('focus.oziAuthDD click.oziAuthDD', function () {
                clearTimeout(blurTimer);
                $('.ozi-auth-dropdown-menu').not($dropdown).hide();
                $dropdown.show();
            });
            $input.on('blur.oziAuthDD', function () {
                blurTimer = setTimeout(function () { $dropdown.hide(); }, 150);
            });
            $dropdown.on('mousedown.oziAuthDD', function () { clearTimeout(blurTimer); });
        }

        function _createDropdown($input, rules, extraClass) {
            var existing = $input.data('oziAuthDropdown');
            if (existing) return existing;
            $input.wrap('<div class="ozi-auth-dropdown-wrap"></div>');
            var $dropdown = $('<div>', { class: 'ozi-auth-dropdown-menu ' + (extraClass || '') });
            rules.forEach(function (rule) { $dropdown.append(_buildDropdownItemEl(rule)); });
            $input.after($dropdown);
            $input.data('oziAuthDropdown', $dropdown);
            return $dropdown;
        }

        if ($pass.length && !$pass.data('oziAuthDropdownReady')) {
            $pass.data('oziAuthDropdownReady', 1);
            _bindDropdown($pass, _createDropdown($pass, _getPassRules(passMin, passMax), 'ozi-auth-dropdown-pass'));
        }

        if ($confirm.length && !$confirm.data('oziAuthDropdownReady')) {
            $confirm.data('oziAuthDropdownReady', 1);
            _bindDropdown($confirm, _createDropdown($confirm, _getConfirmRules(), 'ozi-auth-dropdown-confirm'));
        }
    }

    /* ─────────────────────────────────────────────
     * [9] UPDATE UI
     * ───────────────────────────────────────────── */

    function _resolveRuleIcon($item, ok, checkIcons) {
        var $icon = $item.find('.ozi-auth-rule-icon i, .ozi-auth-dd-icon i').first();
        if (checkIcons) {
            $icon.attr('class', ok ? checkIcons.valid : checkIcons.invalid);
        } else {
            $icon.attr('class', ok ? 'ozi-auth-icon-valid' : 'ozi-auth-icon-invalid');
        }
    }

    function _updateBadge($item, passLen, passMax) {
        var $badge = $item.find('.ozi-badge-count');
        if (!$badge.length) return;
        var len  = Math.min(passLen, passMax);
        var rest = Math.max(0, 8 - passLen);
        if (passLen === 0) {
            $badge.text('0/' + passMax);
        } else if (passLen <= passMax) {
            $badge.text(len + '/' + passMax + (rest > 0 ? ' · ' + _t('auth.remaining', 'faltam') + ' ' + rest : ''));
        } else {
            $badge.text(passLen + '/' + passMax + ' · ' + _t('auth.exceeded', 'excedido'));
        }
    }

    function _updateList($form, result, mode, passMax) {
        if (!mode.list || !mode.listId) return;
        var $container = $('#' + mode.listId);
        if (!$container.length) return;

        $container.find('[data-rule]').each(function () {
            var $item = $(this);
            var key   = String($item.attr('data-rule') || '');
            var ok    = !!result[key];
            $item.removeClass('ozi-auth-list-item--valid ozi-auth-list-item--invalid')
                .addClass(ok ? 'ozi-auth-list-item--valid' : 'ozi-auth-list-item--invalid');
            _resolveRuleIcon($item, ok, mode.checkIcons);
            if (key === 'passLength') _updateBadge($item, result.passLen, passMax);
        });

        var $summary = $container.find('.ozi-auth-summary');
        if ($summary.length) {
            $summary.removeClass('ozi-auth-summary--valid ozi-auth-summary--invalid')
                .addClass(result.access ? 'ozi-auth-summary--valid' : 'ozi-auth-summary--invalid')
                .html(result.access
                    ? _t('auth.summaryValid',   'Senha pronta para salvar.')
                    : _t('auth.summaryInvalid', 'Preencha os critérios acima para continuar.'));
        }
    }

    function _updateDropdown($dropdown, result, checkIcons, passMax) {
        if (!$dropdown || !$dropdown.length) return;
        $dropdown.find('[data-rule]').each(function () {
            var $item = $(this);
            var key   = String($item.attr('data-rule') || '');
            var ok    = !!result[key];
            $item.removeClass('ozi-auth-dropdown-item--valid ozi-auth-dropdown-item--invalid')
                .addClass(ok ? 'ozi-auth-dropdown-item--valid' : 'ozi-auth-dropdown-item--invalid');
            _resolveRuleIcon($item, ok, checkIcons);
            if (key === 'passLength') _updateBadge($item, result.passLen, passMax);
        });
    }

    function _updateDropdowns($form, result, mode, passMax) {
        if (!mode.dropdown) return;
        _updateDropdown($form.find('[data-ozi-auth-pass]').first().data('oziAuthDropdown'),    result, mode.checkIcons, passMax);
        _updateDropdown($form.find('[data-ozi-auth-confirm]').first().data('oziAuthDropdown'), result, mode.checkIcons, passMax);
    }

    // [FIX-P1] usa _classMap() em vez de classes BS5 hardcoded
    function _updateFieldState($field, valid, emptyOk) {
        var val       = String($field.val() || '').trim();
        var clsValid  = _classMap('valid',   'ozi-valid');
        var clsInvalid = _classMap('invalid', 'ozi-invalid');
        $field.removeClass(clsValid + ' ' + clsInvalid);
        if (val === '' && emptyOk !== false) return;
        $field.addClass(valid ? clsValid : clsInvalid);
    }

    // [FIX-P1] usa _classMap() em vez de classes BS5 hardcoded
    function _updateConfirmState($confirm, result) {
        var confirmVal = String($confirm.val() || '');
        var clsValid   = _classMap('valid',   'ozi-valid');
        var clsInvalid = _classMap('invalid', 'ozi-invalid');
        $confirm.removeClass(clsValid + ' ' + clsInvalid);
        if (confirmVal === '') return;
        $confirm.addClass(result.passConfirm ? clsValid : clsInvalid);
    }

    function _updateButton($form, result, mode) {
        if (!mode.submit.length) return;
        var $submit    = mode.submit;
        var checkIcons = mode.checkIcons;

        $submit.prop('disabled', !result.access)
            .toggleClass('ozi-auth-submit--disabled', !result.access)
            .toggleClass('ozi-auth-submit--ready', !!result.access);

        if (checkIcons) {
            var $icon = $submit.find('.ozi-auth-btn-check-icon').first();
            if (!$icon.length) { $icon = $('<i>', { class: 'ozi-auth-btn-check-icon' }); $submit.prepend($icon); }
            $icon.attr('class', 'ozi-auth-btn-check-icon ' + (result.access ? checkIcons.valid : checkIcons.invalid));
        }
    }

    /* ─────────────────────────────────────────────
     * [10] AVALIAÇÃO DO FORM
     * ───────────────────────────────────────────── */

    function _evaluateForm($form) {
        var mode = _getMode($form);

        var $mail    = $form.find('[data-ozi-auth-mail]').first();
        var $pass    = $form.find('[data-ozi-auth-pass]').first();
        var $confirm = $form.find('[data-ozi-auth-confirm]').first();
        var $user    = $form.find('[data-ozi-auth-user]').first();

        var pluginConf   = window.OZI && window.OZI.conf && window.OZI.conf.pluginConf && window.OZI.conf.pluginConf.auth;
        var passMin      = parseInt($pass.attr('data-ozi-auth-pass-min') || '', 10)      || (pluginConf && pluginConf.passMin)      || 8;
        var passMax      = parseInt($pass.attr('data-ozi-auth-pass-max') || '', 10)      || (pluginConf && pluginConf.passMax)      || 64;
        var userCaracter = parseInt($user.attr('data-ozi-auth-user-caracter') || '', 10) || (pluginConf && pluginConf.userCaracter) || 0;

        var result = _oziAuth({
            user:         $user.val(),
            userCaracter: userCaracter,
            mail:         $mail.val(),
            password:     $pass.val(),
            confirm:      $confirm.val(),
            passMin:      passMin,
            passMax:      passMax
        });

        result.passLen = String($pass.val() || '').length;

        _updateFieldState($mail, result.mailValid, $pass.val() === '');
        _updateFieldState($pass, (
            result.passLength && result.passLowercase && result.passUppercase &&
            result.passNumber && result.passSpecial && result.passNoSpace && result.passNoEmailParts
        ), true);
        _updateConfirmState($confirm, result);
        _updateButton($form, result, mode);
        _updateList($form, result, mode, passMax);
        _updateDropdowns($form, result, mode, passMax);

        $form.trigger('ozi:auth-change', [{ result: result, access: result.access }]);
        if (result.access) $form.trigger('ozi:auth-ready', [{ result: result }]);

        return result;
    }

    /* ─────────────────────────────────────────────
     * [11] INIT NO ESCOPO
     * ───────────────────────────────────────────── */

    function _initOziAuth($scope) {
        $scope = $scope || $(document);

        $scope.find('form').each(function () {
            var $form = $(this);

            var hasAuth =
                $form.find('[data-ozi-auth-mail]').length ||
                $form.find('[data-ozi-auth-pass]').length ||
                $form.find('[data-ozi-auth-confirm]').length;

            if (!hasAuth || $form.data('oziAuthReady') === 1) return;
            $form.data('oziAuthReady', 1);

            var mode = _getMode($form);

            var $pass       = $form.find('[data-ozi-auth-pass]').first();
            var pluginConf  = window.OZI && window.OZI.conf && window.OZI.conf.pluginConf && window.OZI.conf.pluginConf.auth;
            var passMin     = parseInt($pass.attr('data-ozi-auth-pass-min') || '', 10) || (pluginConf && pluginConf.passMin) || 8;
            var passMax     = parseInt($pass.attr('data-ozi-auth-pass-max') || '', 10) || (pluginConf && pluginConf.passMax) || 64;

            _initPasswordToggle($form);
            _ensureList($form, mode, passMin, passMax);
            _ensureDropdowns($form, mode, passMin, passMax);

            $form.on(
                'input.oziAuth change.oziAuth blur.oziAuth',
                '[data-ozi-auth-mail], [data-ozi-auth-pass], [data-ozi-auth-confirm], [data-ozi-auth-user]',
                function () { _evaluateForm($form); }
            );

            $form.on('submit.oziAuth', function (e) {
                var result = _evaluateForm($form);
                if (!result || !result.access) {
                    e.preventDefault();
                    $form.trigger('ozi:auth-broken', [{ result: result }]);
                }
            });

            _evaluateForm($form);
        });
    }

    /* ─────────────────────────────────────────────
     * [12] API PÚBLICA
     * ───────────────────────────────────────────── */

    var authAPI = {
        init: function (root) {
            _initOziAuth(root ? $(root) : $(document));
        },
        evaluate: function (formEl) {
            var $form = $(formEl).is('form') ? $(formEl) : $(formEl).closest('form');
            if ($form.length) _evaluateForm($form);
        }
    };

    /* ─────────────────────────────────────────────
     * [13] BOOT
     * ───────────────────────────────────────────── */

    function _boot() {
        authAPI.init();

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

        var zld = window.__zldConf || (window.zldConf && window.zldConf.zldHooks ? window.zldConf : null);
        if (zld && zld.zldHooks && Array.isArray(zld.zldHooks.afterRender)) {
            var already = zld.zldHooks.afterRender.some(function (fn) { return fn && fn.__oziAuthHook === true; });
            if (!already) {
                var hook = function (root) { authAPI.init(root); };
                hook.__oziAuthHook = true;
                zld.zldHooks.afterRender.push(hook);
            }
        }
    }

    window.oziAuth            = _oziAuth;
    window.oziAuthInit        = function (scope) { _initOziAuth(scope ? $(scope) : $(document)); };
    window.oziAuthInitFetched = function (root)  { _initOziAuth(root ? $(root) : $(document)); };

    window.OziAuth = {
        init:     function (root) { authAPI.init(root); },
        evaluate: authAPI.evaluate
    };

    $(function () { _boot(); });

})(jQuery, window, document);