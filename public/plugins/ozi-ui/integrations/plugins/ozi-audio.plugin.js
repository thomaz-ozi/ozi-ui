/**

 * ------------------------------------------
 * ozi-audio
 * ------------------------------------------
 * Ver: 3.0.0
 * 2026-05-27
 *
 *
 * Ficha declarativa do ozi-audio para OZI.integrations.
 *
 * Uso Livewire (recorder + save):
 *   <div wire:ignore>
 *     <div data-ozi-audio="recorder"
 *          data-ozi-audio-save-url="/api/audio/salvar"
 *          data-ozi-audio-save-field="arquivo">
 *     </div>
 *   </div>
 *
 *   // escutar gravação salva:
 *   $el.addEventListener('ozi:audio-saved', function(e) {
 *       console.log(e.detail.result);
 *   });
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        var audio        = (window.OZI && window.OZI.components && window.OZI.components.audio)
                        || window.OziAudio;

        if (!integrations || !integrations.registerPlugin) return;
        if (!audio) {
            console.warn('[OZI] ozi-audio.plugin.js: ozi-audio.js não carregado.');
            return;
        }

        integrations.registerPlugin({
            name:         'audio',
            selector:     '[data-ozi-audio]',
            keyAttribute: 'id',
            changeEvent:  'ozi:audio-saved',

            getInstance: function (root) {
                return audio.get(root);
            },
            getValue: function (instance) {
                return instance ? instance.recordedFile : null;
            },
            setValue: function () {
                // audio não tem setValue externo — controlado pelo MediaRecorder
            },
            destroy: function (instance) {
                if (instance) instance.destroy();
            },
            reinit: function (root) {
                audio.init(root);
            }
        });
    }

    if (window.OZI && window.OZI.isReady) { _register(); }
    else if (window.OZI && window.OZI.ready) { window.OZI.ready(_register); }
    else { document.addEventListener('DOMContentLoaded', _register); }

})(window);
