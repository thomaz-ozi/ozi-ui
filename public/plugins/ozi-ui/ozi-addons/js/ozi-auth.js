(function ($) {
    'use strict';

    if (window.__oziAuthInited) return;
    window.__oziAuthInited = true;

    function oziAuth(data = {}) {
        const result = {
            userValid: true,
            mailValid: false,
            passLength: false,
            passLowercase: false,
            passUppercase: false,
            passNumber: false,
            passSpecial: false,
            passNoSpace: false,
            passNoEmailParts: true,
            passConfirm: false,
            access: false
        };

        const user = String(data.user || '').trim();
        const mail = String(data.mail || '').trim().toLowerCase();
        const pass = String(data.password || '');
        const confirm = String(data.confirm || '');
        const userCaracter = Number(data.userCaracter || 0);

        if (userCaracter > 0) {
            result.userValid = user.length >= userCaracter;
        }

        result.mailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
        result.passLength = /^.{8,14}$/.test(pass);
        result.passLowercase = /[a-z]/.test(pass);
        result.passUppercase = /[A-Z]/.test(pass);
        result.passNumber = /\d/.test(pass);
        result.passSpecial = /[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/.test(pass);
        result.passNoSpace = !/\s/.test(pass);

        if (mail && mail.includes('@')) {
            const [localPart, domainPart = ''] = mail.split('@');

            const parts = [
                localPart,
                ...localPart.split(/[._\-+]/),
                domainPart,
                ...domainPart.split(/[.\-]/)
            ]
                .map(v => String(v || '').trim())
                .filter(v => v.length >= 3);

            result.passNoEmailParts = !parts.some(part =>
                pass.toLowerCase().includes(part.toLowerCase())
            );
        } else {
            result.passNoEmailParts = true;
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

    function getPassRules() {
        return [
            { key: 'passLength', text: '8 até 14 caracteres' },
            { key: 'passLowercase', text: '1 letra minúscula' },
            { key: 'passUppercase', text: '1 letra maiúscula' },
            { key: 'passNumber', text: '1 número' },
            { key: 'passSpecial', text: '1 caractere especial' },
            { key: 'passNoSpace', text: 'Não pode conter espaços' },
            { key: 'passNoEmailParts', text: 'Não pode conter partes do email' }
        ];
    }

    function getConfirmRules() {
        return [
            { key: 'passConfirm', text: 'Senha e confirmação devem ser iguais' }
        ];
    }

    function getMode($form) {
        const $submit = $form.find('[data-ozi-auth-submit]').first();

        if (!$submit.length) {
            return {
                submit: $(),
                listId: '',
                list: false,
                dropdown: true
            };
        }

        const listId = String($submit.attr('data-ozi-auth-list-id') || '').trim();
        const hasDropdown = $submit.is('[data-ozi-auth-dropdown]');

        return {
            submit: $submit,
            listId,
            list: !!listId,
            dropdown: hasDropdown || !listId
        };
    }

    function buildToggle($input, iconShow, iconHide) {
        if ($input.parent().hasClass('ozi-auth-input-wrap')) return;

        const type = String($input.attr('type') || '').toLowerCase();
        if (type !== 'password') return;

        const $wrapper = $('<div class="input-group ozi-auth-input-wrap"></div>');
        $input.wrap($wrapper);

        const $toggle = $(`
            <button type="button" class="btn btn-outline-secondary ozi-auth-toggle" tabindex="-1" aria-label="Mostrar senha">
                <i class="${iconShow}"></i>
            </button>
        `);

        $input.after($toggle);

        $toggle.on('click', function () {
            const isPassword = $input.attr('type') === 'password';
            $input.attr('type', isPassword ? 'text' : 'password');
            $(this)
                .attr('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha')
                .find('i')
                .attr('class', isPassword ? iconHide : iconShow);
        });
    }

    function initPasswordToggle($form) {
        $form.find('[data-ozi-auth-pass], [data-ozi-auth-confirm]').each(function () {
            const $input = $(this);

            if ($input.data('oziAuthToggleReady') === 1) return;
            $input.data('oziAuthToggleReady', 1);

            const icons = String(
                $input.attr('data-ozi-auth-pass') ||
                $input.attr('data-ozi-auth-confirm') ||
                ''
            ).trim();

            if (!icons) return;

            const parts = icons.split(',').map(v => v.trim()).filter(Boolean);
            const iconShow = parts[0] || 'bi bi-eye-slash';
            const iconHide = parts[1] || 'bi bi-eye';

            buildToggle($input, iconShow, iconHide);
        });
    }

    function ensureList($form, mode) {
        if (!mode.list || !mode.listId) return null;

        const $container = $('#' + mode.listId);
        if (!$container.length) return null;

        if ($container.data('oziAuthListReady') === 1) {
            return $container;
        }

        $container.data('oziAuthListReady', 1);

        const passRules = getPassRules();
        const confirmRules = getConfirmRules();

        let html = `
            <div class="alert alert-light border ozi-auth-list-box mb-0">
                <h6 class="mb-2">Regras da senha</h6>
                <div class="ozi-auth-list-rules">
        `;

        passRules.forEach(rule => {
            html += `
                <div class="ozi-auth-list-item" data-rule="${rule.key}">
                    <span class="ozi-auth-rule-icon me-2">•</span>${rule.text}
                </div>
            `;
        });

        confirmRules.forEach(rule => {
            html += `
                <div class="ozi-auth-list-item" data-rule="${rule.key}">
                    <span class="ozi-auth-rule-icon me-2">•</span>${rule.text}
                </div>
            `;
        });

        html += `
                </div>
                <div class="ozi-auth-summary small mt-2 text-danger">Preencha os critérios acima para continuar.</div>
            </div>
        `;

        $container.html(html);

        $container.find('.ozi-auth-list-item').addClass('text-danger opacity-75');

        return $container;
    }

    function createDropdown($input, rules, extraClass) {
        const existing = $input.data('oziAuthDropdown');
        if (existing) return existing;

        const $wrap = $('<div class="ozi-auth-dropdown-wrap position-relative"></div>');
        $input.wrap($wrap);

        const $dropdown = $(`
            <div class="dropdown-menu p-2 ozi-auth-dropdown ${extraClass || ''}"
                 style="display:none; position:absolute; inset:auto auto auto 0; min-width:100%; z-index:1055;">
            </div>
        `);

        rules.forEach(rule => {
            $dropdown.append(`
                <div class="dropdown-item small py-1 px-2" data-rule="${rule.key}">
                    <span class="ozi-auth-dd-icon me-2">•</span>${rule.text}
                </div>
            `);
        });

        $input.after($dropdown);
        $input.data('oziAuthDropdown', $dropdown);

        return $dropdown;
    }

    function ensureDropdowns($form, mode) {
        if (!mode.dropdown) return;

        const $pass = $form.find('[data-ozi-auth-pass]').first();
        const $confirm = $form.find('[data-ozi-auth-confirm]').first();

        if ($pass.length && !$pass.data('oziAuthDropdownReady')) {
            $pass.data('oziAuthDropdownReady', 1);

            const $dropdownPass = createDropdown($pass, getPassRules(), 'ozi-auth-dropdown-pass');

            $pass.on('focus click', function () {
                $form.find('.ozi-auth-dropdown').hide();
                $dropdownPass.show();
            });
        }

        if ($confirm.length && !$confirm.data('oziAuthDropdownReady')) {
            $confirm.data('oziAuthDropdownReady', 1);

            const $dropdownConfirm = createDropdown($confirm, getConfirmRules(), 'ozi-auth-dropdown-confirm');

            $confirm.on('focus click', function () {
                $form.find('.ozi-auth-dropdown').hide();
                $dropdownConfirm.show();
            });
        }

        if (!$form.data('oziAuthDropdownOutsideBound')) {
            $form.data('oziAuthDropdownOutsideBound', 1);

            $(document).on('mousedown.oziAuthDropdown', function (e) {
                if (!$(e.target).closest($form).length) {
                    $form.find('.ozi-auth-dropdown').hide();
                }
            });
        }
    }

    function updateList($form, result, mode) {
        if (!mode.list || !mode.listId) return;

        const $container = $('#' + mode.listId);
        if (!$container.length) return;

        $container.find('[data-rule]').each(function () {
            const $item = $(this);
            const key = String($item.attr('data-rule') || '');
            const ok = !!result[key];

            $item.removeClass('text-success text-danger fw-semibold opacity-75');
            $item.find('.ozi-auth-rule-icon').remove();

            if (ok) {
                $item.addClass('text-success').prepend('<span class="ozi-auth-rule-icon me-2">✅</span>');
            } else {
                $item.addClass('text-danger opacity-75').prepend('<span class="ozi-auth-rule-icon me-2">•</span>');
            }
        });

        const $summary = $container.find('.ozi-auth-summary');

        if ($summary.length) {
            if (result.access) {
                $summary.removeClass('text-danger')
                    .addClass('text-success')
                    .html('✅ Senha pronta para salvar.');
            } else {
                $summary.removeClass('text-success')
                    .addClass('text-danger')
                    .html('Preencha os critérios acima para continuar.');
            }
        }
    }

    function updateDropdown($dropdown, result) {
        if (!$dropdown || !$dropdown.length) return;

        let allOk = true;

        $dropdown.find('[data-rule]').each(function () {
            const $item = $(this);
            const key = String($item.attr('data-rule') || '');
            const ok = !!result[key];

            $item.removeClass('text-success text-danger opacity-75');
            $item.find('.ozi-auth-dd-icon').text(ok ? '✅' : '•');

            if (ok) {
                $item.addClass('text-success');
            } else {
                $item.addClass('text-danger opacity-75');
                allOk = false;
            }
        });

        // Se todas as regras foram cumpridas
        if (allOk) {
            if (!$dropdown.siblings(".ozi-feedback").length) {
                $dropdown.after("<div class='ozi-feedback text-success mt-1'>✅ Completado</div>");
            }
            setTimeout(function () {
                $dropdown.slideUp();
                $dropdown.siblings(".ozi-feedback").fadeOut(function () { $(this).remove(); });
            }, 1500);
        }
    }

    function updateDropdowns($form, result, mode) {
        if (!mode.dropdown) return;

        const $pass = $form.find('[data-ozi-auth-pass]').first();
        const $confirm = $form.find('[data-ozi-auth-confirm]').first();

        updateDropdown($pass.data('oziAuthDropdown'), result);
        updateDropdown($confirm.data('oziAuthDropdown'), result);
    }

    function updateFieldState($field, valid, emptyOk = true) {
        const val = String($field.val() || '').trim();

        $field.removeClass('is-valid is-invalid');

        if (val === '' && emptyOk) return;

        $field.addClass(valid ? 'is-valid' : 'is-invalid');
    }

    function updateConfirmState($confirm, result) {
        const confirmVal = String($confirm.val() || '');

        $confirm.removeClass('is-valid is-invalid');

        if (confirmVal === '') return;

        $confirm.addClass(result.passConfirm ? 'is-valid' : 'is-invalid');
    }

    function updateButton($form, result, mode) {
        if (!mode.submit.length) return;

        mode.submit.prop('disabled', !result.access)
            .toggleClass('btn-secondary', !result.access)
            .toggleClass('btn-primary', result.access);
    }

    function evaluateForm($form) {
        const mode = getMode($form);

        const $mail = $form.find('[data-ozi-auth-mail]').first();
        const $pass = $form.find('[data-ozi-auth-pass]').first();
        const $confirm = $form.find('[data-ozi-auth-confirm]').first();
        const $user = $form.find('[data-ozi-auth-user]').first();

        const result = oziAuth({
            user: $user.val(),
            userCaracter: $user.data('ozi-auth-user-caracter') || 0,
            mail: $mail.val(),
            password: $pass.val(),
            confirm: $confirm.val()
        });

        updateFieldState($mail, result.mailValid, true);

        updateFieldState($pass, (
            result.passLength &&
            result.passLowercase &&
            result.passUppercase &&
            result.passNumber &&
            result.passSpecial &&
            result.passNoSpace &&
            result.passNoEmailParts
        ), true);

        updateConfirmState($confirm, result);
        updateButton($form, result, mode);
        updateList($form, result, mode);
        updateDropdowns($form, result, mode);

        return result;
    }

    function initOziAuth($scope = $(document)) {
        $scope.find('form').each(function () {
            const $form = $(this);

            const hasAuth =
                $form.find('[data-ozi-auth-mail]').length ||
                $form.find('[data-ozi-auth-pass]').length ||
                $form.find('[data-ozi-auth-confirm]').length;

            if (!hasAuth) return;
            if ($form.data('oziAuthReady') === 1) return;

            $form.data('oziAuthReady', 1);

            const mode = getMode($form);

            initPasswordToggle($form);
            ensureList($form, mode);
            ensureDropdowns($form, mode);

            $form.on(
                'input.oziAuth change.oziAuth blur.oziAuth',
                '[data-ozi-auth-mail], [data-ozi-auth-pass], [data-ozi-auth-confirm], [data-ozi-auth-user]',
                function () {
                    evaluateForm($form);
                }
            );

            evaluateForm($form);
        });
    }
    function oziAuthInitFetched(root = document) {
        const $root = root instanceof jQuery ? root : $(root);
        initOziAuth($root);
    }

    function bindOziAuthFetchSupport() {
        // evento manual para uso externo
        $(document)
            .off('oziAuth:initFetched')
            .on('oziAuth:initFetched', function (e, root) {
                oziAuthInitFetched(root || document);
            });

        // integração automática com ZLD
        if (
            window.zldConf &&
            window.zldConf.zldHooks &&
            Array.isArray(window.zldConf.zldHooks.afterRender)
        ) {
            const alreadyBound = window.zldConf.zldHooks.afterRender.some(function (fn) {
                return fn && fn.__oziAuthAfterRender === true;
            });

            if (!alreadyBound) {
                const hook = function (root) {
                    oziAuthInitFetched(root || document);
                };

                hook.__oziAuthAfterRender = true;
                window.zldConf.zldHooks.afterRender.push(hook);
            }
        }
    }
    $(document).ready(function () {
        initOziAuth($(document));
        bindOziAuthFetchSupport();
    });

    window.oziAuth = oziAuth;
    window.oziAuthInit = initOziAuth;
    window.oziAuthInitFetched = oziAuthInitFetched;

})(jQuery);