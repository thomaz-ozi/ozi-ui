/* ───────────────────────────────────────────── */

/**
 * components/ozi-auth/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        auth: {
            showPassword:  'Mostrar contraseña',
            hidePassword:  'Ocultar contraseña',
            rulesTitle:    'Reglas de la contraseña',
            passLength:    'Entre {min} y {max} caracteres',
            uppercase:     'Al menos una letra mayúscula',
            lowercase:     'Al menos una letra minúscula',
            number:        'Al menos un número',
            special:       'Al menos un carácter especial (!@#$%...)',
            noSpace:       'Sin espacios',
            noEmailParts:  'La contraseña no puede contener partes del correo',
            confirm:       'Las contraseñas coinciden',
            userMin:       'Usuario: mínimo {min} caracteres'
        }
    });
})(window);