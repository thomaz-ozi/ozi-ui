/* ───────────────────────────────────────────── */

/**
 * components/ozi-auth/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        auth: {
            showPassword:  'Show password',
            hidePassword:  'Hide password',
            rulesTitle:    'Password rules',
            passLength:    'Between {min} and {max} characters',
            uppercase:     'At least one uppercase letter',
            lowercase:     'At least one lowercase letter',
            number:        'At least one number',
            special:       'At least one special character (!@#$%...)',
            noSpace:       'No spaces',
            noEmailParts:  'Password cannot contain parts of the email',
            confirm:       'Passwords match',
            userMin:       'Username: minimum {min} characters'
        }
    });
})(window);