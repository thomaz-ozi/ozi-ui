/* ───────────────────────────────────────────── */

/**
 * components/ozi-editor/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        editor: {
            bold:        'Negrita',
            italic:      'Cursiva',
            underline:   'Subrayado',
            strike:      'Tachado',
            ul:          'Lista',
            ol:          'Lista numerada',
            codeblock:   'Bloque de código',
            source:      'HTML',
            table:       'Tabla',
            heading:     'Título',
            h1:          'Título 1',
            h2:          'Título 2',
            h3:          'Título 3',
            h4:          'Título 4',
            h5:          'Título 5',
            h6:          'Título 6',
            classes:     'Estilos',
            alignLeft:   'Alinear a la izquierda',
            alignCenter: 'Centrar',
            alignRight:  'Alinear a la derecha',
            justify:     'Justificar',
            quote:       'Cita',
            hr:          'Línea horizontal',
            undo:        'Deshacer',
            redo:        'Rehacer',
            link:        'Enlace',
            unlink:      'Quitar enlace',
            linkUrl:     'URL',
            color:       'Color de texto',
            highlight:   'Color de resaltado',
            image:            'Imagen',
            imageUrl:         'URL',
            imageAlt:         'Texto alternativo',
            imageWidth:       'Ancho',
            imageHeight:      'Alto',
            imageUpload:      'Subir archivo',
            imageUploading:   'Enviando…',
            imageUploadFailed: 'No se pudo subir la imagen. Inténtelo de nuevo.',
            imageInvalidUrl:  'URL inválida o esquema no permitido.',
            imageAlign:       'Alineación',
            imageAlignLeft:   'A la izquierda (texto al lado)',
            imageAlignRight:  'A la derecha (texto al lado)',
            imageAlignCenter: 'Centrada',
            imageAlignFree:   'Posición libre (arrastra la imagen)',
            paste:       'Pegar',
            pasteFmt:    'Pegar con formato',
            apply:       'Aplicar',
            remove:      'Quitar',
            none:        'Ninguno',
            customize:   'Personalizar',
            clipboardBlocked: 'No se pudo leer el portapapeles. Verifique el permiso del navegador (barra de direcciones / configuración del sitio).',
            words:       'palabras',
            chars:       'caracteres',
            clear:       'Limpiar formato',
            moreTools:   'Más herramientas',
            fewerTools:  'Menos herramientas',
            scrollPrev:  'Desplazar atrás',
            scrollNext:  'Desplazar adelante',
            unknown:     'Herramienta desconocida',
            incompatible: 'No disponible en este modo',
            placeholder: 'Escriba aquí...'
        }
    });
})(window);