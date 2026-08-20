/* ───────────────────────────────────────────── */

/**
 * components/ozi-audio/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        audio: {
            play:           'Play',
            pause:          'Pause',
            record:         'Record',
            stopRecord:     'Stop recording',
            save:           'Save',
            volume:         'Volume',
            speed:          'Speed',
            ready:          'Ready',
            stopped:        'Stopped',
            recording:      'Recording...',
            processing:     'Processing...',
            sending:        'Sending...',
            saved:          'Saved',
            saveError:      'Save error',
            senderError:    'ZLD unavailable',
            noRecording:    'No recording',
            noDestiny:      'No destination',
            micUnavailable: 'Microphone unavailable',
            player:         'Audio player',
            recorder:       'Audio recorder'
        }
    });
})(window);
