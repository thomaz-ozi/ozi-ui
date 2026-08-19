/* ───────────────────────────────────────────── */

/**
 * components/ozi-audio/lang/es.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('es', {
        audio: {
            play:           'Reproducir',
            pause:          'Pausar',
            record:         'Grabar',
            stopRecord:     'Detener grabación',
            save:           'Guardar',
            volume:         'Volumen',
            speed:          'Velocidad',
            ready:          'Listo',
            recording:      'Grabando...',
            processing:     'Procesando...',
            sending:        'Enviando...',
            saved:          'Guardado',
            saveError:      'Error al guardar',
            senderError:    'ZLD no disponible',
            noRecording:    'Sin grabación',
            noDestiny:      'Sin destino',
            micUnavailable: 'Micrófono no disponible',
            player:         'Reproductor de audio',
            recorder:       'Grabador de audio'
        }
    });
})(window);