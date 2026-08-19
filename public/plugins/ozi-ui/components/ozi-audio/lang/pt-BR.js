/* ───────────────────────────────────────────── */

/**
 * components/ozi-audio/lang/pt-BR.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('pt-BR', {
        audio: {
            play:           'Reproduzir',
            pause:          'Pausar',
            record:         'Gravar',
            stopRecord:     'Parar gravação',
            save:           'Salvar',
            volume:         'Volume',
            speed:          'Velocidade',
            ready:          'Pronto',
            recording:      'Gravando...',
            processing:     'Processando...',
            sending:        'Enviando...',
            saved:          'Salvo',
            saveError:      'Erro ao salvar',
            senderError:    'ZLD indisponível',
            noRecording:    'Sem gravação',
            noDestiny:      'Sem destino',
            micUnavailable: 'Microfone indisponível',
            player:         'Player de áudio',
            recorder:       'Gravador de áudio'
        }
    });
})(window);