/**
 * ------------------------------------------
 * ozi-password-rules
 * ------------------------------------------
 * Ver: 1.1.0
 * 2026-08-18
 *
 * Responsabilidade:
 *   - Motor puro de validacao de regras de senha
 *   - Funcao pura: recebe dados, retorna resultado — sem DOM, sem estado
 *   - Parametrizavel: passMin, passMax, userCaracter via OZI.conf ou argumento
 *
 * O que NAO faz:
 *   - Nao manipula DOM — responsabilidade de ozi-auth.js (component)
 *   - Nao le atributos HTML diretamente
 *   - Nao depende de jQuery
 *
 * Dependencias: ozi.js (OZI.conf.pluginConf.auth — opcional)
 * Expoe: OZI.modules.passwordRules, window.oziPasswordRules (compat)
 *
 * Changelog:
 *   - v1.1.0: [feat] params.disabled — array de tokens publicos (lowercase,
 *     uppercase, number, special, no-space, no-email-parts, confirm, user,
 *     length) e/ou chaves internas. Regras desligadas saem do access e do
 *     rulesList(). 'mail' nao e desabilitavel (sempre obrigatorio). Paridade
 *     com o motor embutido de ozi-auth v4.1.0.
 *   - v1.0.1: [FIX-B] Removido hook afterRender vazio ('module:password-rules').
 *     Modulo e funcao pura sem estado — nao ha reinit necessario.
 *     Hook vazio apenas poluia o log OZI.hooks.run() com entradas inuteis.
 *   - v1.0.0: guard singleton adicionado
 *   - v1.0.0: registro no namespace dentro do DOMReady — garante OZI bootado
 *   - v1.0.0: _getDefault lia conf.plugins.auth — caminho errado,
 *     corrigido para conf.pluginConf.auth (alinhado com ozi-conf.js)
 *   - v1.0.0: rulesList exposto na API publica em vez de propriedade de funcao
 *   - v1.0.0: window.OziPasswordRules alias para consistencia com outros modulos
 */

(function (window) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziPasswordRules) return;


    // ---------------------------------------------
    // [1b] DISABLE — tokens publicos -> chaves internas
    // ---------------------------------------------

    // paridade com ozi-auth v4.1.0. 'mail' ausente de proposito: email
    // e sempre obrigatorio.
    var _DISABLE_TOKENS = {
        'lowercase':      'passLowercase',
        'uppercase':      'passUppercase',
        'number':         'passNumber',
        'special':        'passSpecial',
        'no-space':       'passNoSpace',
        'no-email-parts': 'passNoEmailParts',
        'confirm':        'passConfirm',
        'user':           'userValid',
        'length':         'passLength'
    };

    var _ACCESS_KEYS = [
        'userValid', 'mailValid', 'passLength', 'passLowercase', 'passUppercase',
        'passNumber', 'passSpecial', 'passNoSpace', 'passNoEmailParts', 'passConfirm'
    ];

    // aceita array (ou item unico) de tokens publicos e/ou chaves internas
    // -> mapa { chave:true }. 'mail'/'mailValid' sao ignorados (sempre obrigatorio).
    function _normalizeDisabled(list) {
        var out = {};
        if (!list) return out;
        (Array.isArray(list) ? list : [list]).forEach(function (item) {
            var t = String(item == null ? '' : item).trim();
            if (!t) return;
            var low = t.toLowerCase();
            if (low === 'mail' || t === 'mailValid') return; // nunca desabilitavel
            if (Object.prototype.hasOwnProperty.call(_DISABLE_TOKENS, low)) {
                out[_DISABLE_TOKENS[low]] = true;
            } else if (_ACCESS_KEYS.indexOf(t) !== -1) {
                out[t] = true; // ja e chave interna
            }
        });
        return out;
    }


    // ---------------------------------------------
    // [2] DEFAULTS — lidos de OZI.conf ou fallback NIST
    // ---------------------------------------------

    function _getDefault(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        var val  = conf && conf.pluginConf && conf.pluginConf.auth && conf.pluginConf.auth[key];
        return val !== undefined ? val : fallback;
    }


    // ---------------------------------------------
    // [3] MOTOR PURO — passwordRules(params)
    // ---------------------------------------------

    function passwordRules(params) {
        params = params || {};

        var user     = String(params.user     || '');
        var mail     = String(params.mail     || '');
        var password = String(params.password || '');
        var confirm  = String(params.confirm  || '');

        var userCaracter = params.userCaracter !== undefined
            ? window.parseInt(params.userCaracter, 10)
            : _getDefault('userCaracter', 4);

        var passMin = params.passMin !== undefined
            ? window.parseInt(params.passMin, 10)
            : _getDefault('passMin', 12);

        var passMax = params.passMax !== undefined
            ? window.parseInt(params.passMax, 10)
            : _getDefault('passMax', 64);

        var userValid = userCaracter > 0
            ? user.trim().length >= userCaracter
            : true;

        var mailValid = mail.trim() === ''
            ? false
            : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.trim());

        var passLength = password.length >= passMin && password.length <= passMax;

        var passLowercase = /[a-z]/.test(password);

        var passUppercase = /[A-Z]/.test(password);

        var passNumber = /[0-9]/.test(password);

        var passSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);

        var passNoSpace = password.length > 0 && !/\s/.test(password);

        var passNoEmailParts = true;
        if (mail.trim() && password.length > 0) {
            var mailParts = mail.toLowerCase()
                .replace('@', '.')
                .split('.')
                .filter(function (p) { return p.length >= 3; });

            var passLower = password.toLowerCase();
            passNoEmailParts = mailParts.every(function (part) {
                return passLower.indexOf(part) === -1;
            });
        }

        var passConfirm = confirm.length > 0 && confirm === password;

        var checks = {
            userValid:        userValid,
            mailValid:        mailValid,
            passLength:       passLength,
            passLowercase:    passLowercase,
            passUppercase:    passUppercase,
            passNumber:       passNumber,
            passSpecial:      passSpecial,
            passNoSpace:      passNoSpace,
            passNoEmailParts: passNoEmailParts,
            passConfirm:      passConfirm
        };

        var disabled = _normalizeDisabled(params.disabled);
        var access = _ACCESS_KEYS.every(function (k) {
            return disabled[k] ? true : checks[k];
        });

        return {
            userValid:        userValid,
            mailValid:        mailValid,
            passLength:       passLength,
            passLowercase:    passLowercase,
            passUppercase:    passUppercase,
            passNumber:       passNumber,
            passSpecial:      passSpecial,
            passNoSpace:      passNoSpace,
            passNoEmailParts: passNoEmailParts,
            passConfirm:      passConfirm,
            access:           access,
            passMin:          passMin,
            passMax:          passMax,
            userCaracter:     userCaracter
        };
    }


    // ---------------------------------------------
    // [4] HELPER — rulesList(params?, result?)
    // ---------------------------------------------

    function rulesList(params, result) {
        params = params || {};
        result = result || {};

        var passMin      = params.passMin      !== undefined ? params.passMin      : _getDefault('passMin',      12);
        var passMax      = params.passMax      !== undefined ? params.passMax      : _getDefault('passMax',      64);
        var userCaracter = params.userCaracter !== undefined ? params.userCaracter : _getDefault('userCaracter', 4);

        function label(key, fallback, p) {
            var lang = window.OZI && window.OZI.lang;
            if (lang && typeof lang.t === 'function') {
                var translated = lang.t(key, p);
                if (translated !== key) return translated;
            }
            return fallback;
        }

        var rules = [
            {
                key:   'passLength',
                label: label('auth.passLength', 'Entre ' + passMin + ' e ' + passMax + ' caracteres', { min: passMin, max: passMax }),
                valid: !!result.passLength
            },
            {
                key:   'passUppercase',
                label: label('auth.uppercase', 'Pelo menos uma letra maiuscula'),
                valid: !!result.passUppercase
            },
            {
                key:   'passLowercase',
                label: label('auth.lowercase', 'Pelo menos uma letra minuscula'),
                valid: !!result.passLowercase
            },
            {
                key:   'passNumber',
                label: label('auth.number', 'Pelo menos um numero'),
                valid: !!result.passNumber
            },
            {
                key:   'passSpecial',
                label: label('auth.special', 'Pelo menos um caractere especial (!@#$%...)'),
                valid: !!result.passSpecial
            },
            {
                key:   'passNoSpace',
                label: label('auth.noSpace', 'Sem espacos'),
                valid: !!result.passNoSpace
            },
            {
                key:   'passNoEmailParts',
                label: label('auth.noEmailParts', 'Senha nao pode conter partes do email'),
                valid: !!result.passNoEmailParts
            },
            {
                key:   'passConfirm',
                label: label('auth.confirm', 'Senhas coincidem'),
                valid: !!result.passConfirm
            }
        ];

        if (userCaracter > 0) {
            rules.unshift({
                key:   'userValid',
                label: label('auth.userMin', 'Usuario: minimo ' + userCaracter + ' caracteres', { min: userCaracter }),
                valid: !!result.userValid
            });
        }

        var disabled = _normalizeDisabled(params.disabled);
        return rules.filter(function (r) { return !disabled[r.key]; });
    }


    // ---------------------------------------------
    // [5] API PUBLICA
    // ---------------------------------------------

    var passwordRulesApi = {
        run:       passwordRules,
        rulesList: rulesList
    };


    // ---------------------------------------------
    // [6] EXPOSICAO
    // ---------------------------------------------

    window.OziPasswordRules = passwordRulesApi;

    // compat v0.x — funcao direta
    window.oziPasswordRules = passwordRules;

    // DOMReady — namespace OZI
    // [FIX-B] Removido: hook afterRender vazio ('module:password-rules').
    // Este modulo e funcao pura sem estado — nao ha nada a reinicializar
    // apos render dinamico. O hook vazio apenas poluia o log com
    // "[OZI:hooks] run() — N hooks" incluindo entradas sem efeito.
    if (typeof document !== 'undefined') {
        var _ready = function () {
            if (window.OZI && window.OZI.modules) {
                window.OZI.modules.passwordRules = passwordRulesApi;
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _ready);
        } else {
            _ready();
        }
    }

})(window);