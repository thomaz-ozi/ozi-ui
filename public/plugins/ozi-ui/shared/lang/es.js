/**
 * shared/lang/es.js
 *
 * Diccionario global es del OZI-UI.
 * Contiene solo strings genuinamente compartidas por 3+ plugins.
 * Strings específicas de cada plugin van en component/lang/es.js.
 */

(function (window) {
    'use strict';

    function _register() {
        var lang = window.OZI && window.OZI.lang;
        if (!lang || !lang.register) return;

        lang.register('es', {
            common: {
                loading:  'Cargando...',
                saving:   'Guardando...',
                save:     'Guardar',
                cancel:   'Cancelar',
                confirm:  'Confirmar',
                close:    'Cerrar',
                clear:    'Limpiar',
                search:   'Buscar',
                add:      'Agregar',
                remove:   'Eliminar',
                edit:     'Editar',
                back:     'Volver',
                send:     'Enviar',
                apply:    'Aplicar',
                reset:    'Restablecer',
                empty:    'Sin resultados',
                error:    'Error',
                success:  'Completado',
                required: 'Campo obligatorio',
                optional: 'Opcional',
                yes:      'Sí',
                no:       'No',
                ok:       'OK'
            }
        });
    }

    // aguarda OZI.ready() — garante que lang já existe
    if (window.OZI && window.OZI.isReady) {
        _register();
    } else if (window.OZI && window.OZI.ready) {
        window.OZI.ready(_register);
    } else {
        document.addEventListener('DOMContentLoaded', _register);
    }

})(window);