/**
 * ------------------------------------------
 * ozi-audio
 * ------------------------------------------
 * Ver: 4.0.2
 * 2026-08-19
 *
 * Changelog:
 *   - v4.0.2: [FIX] i18n — 13 chaves audio.* faltavam nos 3 dicionários e caíam no
 *       fallback embutido (play/pause/record/stopRecord/save/volume/speed/sending/
 *       saved/saveError/senderError/noRecording/noDestiny), adicionadas em pt-BR/en/es.
 *       [FIX] CSS — .ozi-audio__time ganhou width:75px + flex-shrink:0 + white-space:nowrap
 *       (não sofrer influência de classes externas; o tempo quebrava em 2 linhas).
 *   - v4.0.1: [V2-F5B] Fix: init() aceita Document/DocumentFragment.
 *       O OZI.hooks.afterRender chama init(root) com `document` (ozi-hooks.js
 *       converte root null -> document). Como document.nodeType === 9 (e não 1),
 *       o argumento caía no ramo de seletor e estourava
 *       "DOMException: document.querySelector('[object HTMLDocument]')".
 *       Agora a resolução é por tipo: string -> querySelector; nó com
 *       querySelectorAll (Element/Document/Fragment) -> escopo direto; senão null.
 *   - v4.0.0: [V2-F2] Migração para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Zero jQuery. Toda a UI construída com document.createElement (helper _el);
 *         manipulação via classList/textContent/style/setAttribute nativos.
 *       - Eventos de clique por instância registrados com addEventListener e
 *         rastreados em this._listeners para remoção no destroy(). Namespace
 *         jQuery (`.oziAudio.<uid>`) descartado.
 *       - Geometria de seek/volume via getBoundingClientRect() + e.clientX
 *         (viewport-relativo) no lugar de $.outerWidth()/$.offset()+pageX.
 *       - Estado de init por-elemento migrado de $.data() para o marker nativo
 *         `el.__oziAudioInitialized`.
 *       - Fim do dual-dispatch: emit() usa somente OZI.helpers.emit() (CustomEvent
 *         bubbles:true, payload em detail no contrato v2:
 *         { component:'ozi-audio', name, value, source, ...extra }). Nomes ozi:*
 *         preservados. Sem shim — ozi:audio-* não é consumido no Central RH
 *         (inventário F0). Adicionados ozi:init (pós-init) e ozi:change (quando
 *         há nova gravação) e ozi:destroy (no destroy). source: 'user' na
 *         interação, 'api' nas chamadas programáticas da API.
 *       - Adapter ozi-validate declara nativeElement:true e recebe Element nativo
 *         (padrão do ozi-select F2#4). getValue() do adapter retorna o File real
 *         (recorder/full) ou a url (player) para o FormData; o detail.value do
 *         evento é serializável (nome do arquivo / url).
 *       - Boot $(fn) -> document.readyState/DOMContentLoaded nativo.
 *       - [FIX] Modificador de modo (ozi-audio-player/-recorder/-full) passou a
 *         ser aplicado DEPOIS do _buildShell() — na v1 era adicionado antes e o
 *         removeClass do _buildShell o apagava, deixando as regras CSS
 *         `.ozi-audio-player .ozi-audio__main` (align) sem efeito (bug latente).
 *       - Sistema de ícones SVG (DOMParser/fetch/cache) já era nativo; _setIcon
 *         passou a receber Element e usa OZI.helpers.icon quando disponível.
 *       - API pública inalterada: OZI.components.audio.{init,get,getAll,destroy,
 *         play,pause,record,stopRecord,save,setIconBase}; window.OziAudio mantido.
 *
 *   Histórico anterior (jQuery):
 *   - v3.0.2: [FIX-P2] strings PT hardcoded em _setStatus -> _t(); [FIX-P3]
 *     adapter OZI.modules.validate registrado no _boot(); isValid por modo.
 */

(function (window, document) {
    'use strict';

    if (window.OziAudio) return; // singleton guard (idempotente)

    /* ─────────────────────────────────────────────
     * [1] REGISTRY
     * ───────────────────────────────────────────── */

    var _instances            = {};
    var _instanceCounter      = 0;
    var _activePlayerInstance = null;

    /* ─────────────────────────────────────────────
     * [2] HELPERS DE DOM (nativos)
     * ───────────────────────────────────────────── */

    // Cria um elemento aplicando um objeto de props no estilo $('<tag>', {...}).
    function _el(tag, props) {
        var node = document.createElement(tag);
        if (props) {
            for (var k in props) {
                if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
                var v = props[k];
                if (k === 'class')          node.className   = v;
                else if (k === 'text')      node.textContent = v;
                else if (k === 'html')      node.innerHTML   = v;
                else if (k === 'hidden')    { if (v) node.hidden = true; }
                else if (k === 'disabled')  { if (v) node.disabled = true; }
                else if (k === 'controls')  { if (v) node.controls = true; }
                else                        node.setAttribute(k, v);
            }
        }
        return node;
    }

    // Anexa filhos (ignora nulos). _append(parent, a, b, ...)
    function _append(parent) {
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i]) parent.appendChild(arguments[i]);
        }
    }

    function _empty(el) {
        if (!el) return;
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    /* ─────────────────────────────────────────────
     * [3] HELPER DE TRADUÇÃO
     * ───────────────────────────────────────────── */

    function _t(key, fallback) {
        var lang = window.OZI && window.OZI.lang;
        if (lang && typeof lang.t === 'function') {
            var v = lang.t(key);
            if (v && v !== key) return v;
        }
        return fallback || key;
    }

    /* ─────────────────────────────────────────────
     * [4] SISTEMA DE ÍCONES SVG (nativo)
     * ───────────────────────────────────────────── */

    var _iconCache   = {};
    var _iconPending = {};

    function _iconBase() {
        var conf = window.OZI && window.OZI.conf;
        var base = (conf && conf.core && conf.core.urlBase) || './plugins/ozi-ui/';
        if (base.charAt(base.length - 1) !== '/') base += '/';
        return base + 'components/ozi-audio/svg/';
    }

    function _normalizeSvg(svgText) {
        var raw = String(svgText || '').trim();
        if (!raw) return '';
        var parser = new DOMParser();
        var doc    = parser.parseFromString(raw, 'image/svg+xml');
        var svg    = doc.querySelector('svg');
        if (!svg) return '';
        var cls     = String(svg.getAttribute('class') || '').trim();
        var classes = cls ? cls.split(/\s+/) : [];
        if (classes.indexOf('ozi-icon-svg') === -1) classes.push('ozi-icon-svg');
        svg.setAttribute('class', classes.join(' ').trim());
        svg.setAttribute('aria-hidden', 'true');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        return svg.outerHTML;
    }

    function _fetchIcon(iconFile) {
        if (!iconFile) return Promise.resolve('');
        var url = _iconBase() + iconFile;
        if (_iconCache[url])   return Promise.resolve(_iconCache[url]);
        if (_iconPending[url]) return _iconPending[url];

        _iconPending[url] = fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(function (res) {
                if (!res.ok) throw new Error('icon not found: ' + url);
                return res.text();
            })
            .then(function (svg) {
                var clean = _normalizeSvg(svg);
                _iconCache[url] = clean;
                delete _iconPending[url];
                return clean;
            })
            .catch(function (err) {
                console.warn('[OZI:audio] ícone não carregado:', iconFile, err);
                delete _iconPending[url];
                return '';
            });

        return _iconPending[url];
    }

    function _setIcon(el, iconFile, fallback) {
        if (!el) return;

        var h = window.OZI && window.OZI.helpers;
        if (h && typeof h.icon === 'function') {
            var name = iconFile.replace(/\.svg$/, '').replace(/^icon-/, '');
            h.icon(el, name, { plugin: 'audio', fallback: fallback });
            return;
        }

        _fetchIcon(iconFile).then(function (svg) {
            el.innerHTML = svg || fallback || '';
        });
    }

    /* ─────────────────────────────────────────────
     * [5] CONSTRUCTOR
     * ───────────────────────────────────────────── */

    function OziAudio(element) {
        this.root = element;
        this.mode = String(this.root.getAttribute('data-ozi-audio') || '').trim().toLowerCase();

        this.uid = this.root.id || ('ozi-audio-' + (++_instanceCounter));
        this.root.id = this.uid;

        this.url         = String(this.root.getAttribute('data-ozi-audio-url')   || '').trim();
        this.title       = String(this.root.getAttribute('data-ozi-audio-title') || '').trim();
        this.showVolume  = this._parseBoolAttr('data-ozi-audio-volume',  true);
        this.showSpeed   = this._parseBoolAttr('data-ozi-audio-speed',   true);
        this.showPreview = this._parseBoolAttr('data-ozi-audio-preview', true);
        this.saveUrl     = String(this.root.getAttribute('data-ozi-audio-save-url')   || '').trim();
        this.saveField   = String(this.root.getAttribute('data-ozi-audio-save-field') || 'audio_file').trim();

        this.audio           = null;
        this.playerTimer     = null;
        this.playerObjectUrl = '';

        this.mediaStream      = null;
        this.mediaRecorder    = null;
        this.recordChunks     = [];
        this.recordTimer      = null;
        this.recordStartedAt  = 0;
        this.recordDuration   = 0;
        this.recordedBlob     = null;
        this.recordedFile     = null;
        this.recordedMimeType = '';
        this.previewUrl       = '';
        this.isRecording      = false;

        this._listeners = []; // { el, type, handler } — removidos no destroy

        this.ui = null; this.box = null; this.title_el = null;
        this.play = null; this.timeline = null; this.progress = null;
        this.timeCurrent = null; this.timeLength = null;
        this.volumeWrap = null; this.volumeBtn = null;
        this.volumeBar = null; this.volumeFill = null;
        this.speed = null; this.record = null; this.status = null;
        this.previewWrap = null; this.preview = null; this.save = null;
    }

    /* ─────────────────────────────────────────────
     * [6] HELPERS DE INSTÂNCIA
     * ───────────────────────────────────────────── */

    OziAudio.prototype._on = function (el, type, handler) {
        if (!el) return;
        el.addEventListener(type, handler);
        this._listeners.push({ el: el, type: type, handler: handler });
    };

    OziAudio.prototype._parseBoolAttr = function (attr, fb) {
        if (!this.root.hasAttribute(attr)) return !!fb;
        var r = this.root.getAttribute(attr);
        if (r === null || r === '') return true;
        r = String(r).trim().toLowerCase();
        return !(r === 'false' || r === '0' || r === 'no' || r === 'off');
    };

    // Valor canônico serializável para o evento (contrato v2: nunca instância/DOM).
    OziAudio.prototype.getValue = function () {
        if (this.mode === 'player') return this.url || null;
        return this.recordedFile ? (this.recordedFile.name || 'recording') : null;
    };

    // emit — contrato v2, sem dual-dispatch. extra estende o detail; extra.source
    // (opcional) define 'user'|'api'.
    OziAudio.prototype.emit = function (eventName, extra) {
        extra = extra || {};
        var detail = {
            component: 'ozi-audio',
            name:      this.saveField || this.uid,
            value:     this.getValue(),
            source:    extra.source || 'user'
        };
        for (var k in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, k) && k !== 'source') detail[k] = extra[k];
        }
        var helpers = window.OZI && window.OZI.helpers;
        if (helpers && typeof helpers.emit === 'function') {
            helpers.emit(this.root, eventName, detail);
        } else if (typeof CustomEvent === 'function') {
            this.root.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: detail }));
        }
    };

    OziAudio.prototype._getTimeCode = function (num) {
        if (!Number.isFinite(Number(num))) return '0:00';
        var s = parseInt(num, 10);
        var m = parseInt(s / 60, 10); s -= m * 60;
        var h = parseInt(m / 60, 10); m -= h * 60;
        if (h === 0) return m + ':' + String(s % 60).padStart(2, '0');
        return String(h).padStart(2, '0') + ':' + m + ':' + String(s % 60).padStart(2, '0');
    };

    OziAudio.prototype._guessExtension = function (mimeType) {
        var t = String(mimeType || '').toLowerCase();
        if (t.indexOf('ogg') !== -1) return 'ogg';
        if (t.indexOf('mp4') !== -1) return 'mp4';
        if (t.indexOf('mpeg') !== -1 || t.indexOf('mp3') !== -1) return 'mp3';
        return 'webm';
    };

    OziAudio.prototype._getPreferredMimeType = function () {
        if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') return '';
        var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
        for (var i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
        }
        return '';
    };

    /* ─────────────────────────────────────────────
     * [7] BUILD UI
     * ───────────────────────────────────────────── */

    OziAudio.prototype._buildShell = function () {
        _empty(this.root);
        this.root.classList.remove('ozi-audio-player', 'ozi-audio-recorder', 'ozi-audio-full');
        this.root.classList.add('ozi-audio');
        this.ui = _el('div', { class: 'ozi-audio__main' });
        this.root.appendChild(this.ui);
    };

    OziAudio.prototype._appendTitleBox = function (target) {
        var box = _el('div', { class: 'ozi-audio__timeline-box' });
        if (this.title) {
            this.title_el = _el('div', { class: 'ozi-audio__title', text: this.title });
            box.appendChild(this.title_el);
        }
        target.appendChild(box);
        return box;
    };

    OziAudio.prototype._ensureAudio = function () {
        var self = this;
        if (this.audio) return;
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        this.audio.volume  = 0.5;
        this.audio.addEventListener('loadedmetadata', function () { self._onLoadedMetadata(); });
        this.audio.addEventListener('ended',          function () { self._onEnded(); });
    };

    OziAudio.prototype._setAudioSource = function (src, isObjectUrl) {
        if (!src) { this._syncPlayerAvailability(false); return; }
        this._ensureAudio();

        if (this.playerObjectUrl) {
            try { URL.revokeObjectURL(this.playerObjectUrl); } catch (e) {}
            this.playerObjectUrl = '';
        }

        if (isObjectUrl) this.playerObjectUrl = src;

        this.audio.pause();
        this.audio.src = src;
        this.audio.load();

        if (this.speed) { this.audio.playbackRate = 1; this.speed.textContent = '1x'; }

        this._updateProgress(0);
        this._updateTime(0, 0);
        this._setPlayState(false);
        this._syncVolumeUI();
        this._syncPlayerAvailability(true);
    };

    OziAudio.prototype._syncPlayerAvailability = function (enabled) {
        if (this.play)      this.play.disabled = !enabled;
        if (this.timeline)  this.timeline.classList.toggle('is-disabled', !enabled);
        if (this.volumeBtn) this.volumeBtn.disabled = !enabled;
        if (this.volumeBar) this.volumeBar.classList.toggle('is-disabled', !enabled);
        if (this.speed)     this.speed.disabled = !enabled;
    };

    OziAudio.prototype._buildPlayerControls = function () {
        this.play = _el('button', { type: 'button', class: 'ozi-audio__play is-play', 'aria-label': _t('audio.play', 'Reproduzir') });
        var playIcon  = _el('span', { class: 'ozi-audio__play-icon',  'aria-hidden': 'true' });
        var pauseIcon = _el('span', { class: 'ozi-audio__pause-icon', 'aria-hidden': 'true' });
        _append(this.play, playIcon, pauseIcon);
        _setIcon(playIcon,  'icon-play.svg',  '&#9654;');
        _setIcon(pauseIcon, 'icon-pause.svg', '&#10074;&#10074;');

        this.timeline = _el('div', { class: 'ozi-audio__timeline', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' });
        this.progress = _el('div', { class: 'ozi-audio__progress' });
        this.timeline.appendChild(this.progress);

        var meta = _el('div', { class: 'ozi-audio__meta' });
        var time = _el('div', { class: 'ozi-audio__time' });
        this.timeCurrent = _el('span', { class: 'ozi-audio__time-current', text: '0:00' });
        this.timeLength  = _el('span', { class: 'ozi-audio__time-length',  text: '0:00' });
        _append(time, this.timeCurrent, _el('span', { class: 'ozi-audio__time-sep', text: '/' }), this.timeLength);
        meta.appendChild(time);

        if (this.showVolume) {
            this.volumeWrap = _el('div', { class: 'ozi-audio__volume' });
            this.volumeBtn  = _el('button', { type: 'button', class: 'ozi-audio__volume-btn is-on', 'aria-label': _t('audio.volume', 'Volume') });
            var volOn  = _el('span', { class: 'ozi-audio__volume-on',  'aria-hidden': 'true' });
            var volOff = _el('span', { class: 'ozi-audio__volume-off', 'aria-hidden': 'true' });
            _append(this.volumeBtn, volOn, volOff);
            _setIcon(volOn,  'icon-volume-on.svg',  '&#128266;');
            _setIcon(volOff, 'icon-volume-off.svg', '&#128263;');
            this.volumeBar  = _el('div', { class: 'ozi-audio__volume-bar' });
            this.volumeFill = _el('div', { class: 'ozi-audio__volume-fill' });
            this.volumeBar.appendChild(this.volumeFill);
            _append(this.volumeWrap, this.volumeBtn, this.volumeBar);
            meta.appendChild(this.volumeWrap);
        }

        _append(this.box, this.timeline, meta);
        _append(this.ui, this.play, this.box);

        if (this.showSpeed) {
            this.speed = _el('button', { type: 'button', class: 'ozi-audio__speed', 'aria-label': _t('audio.speed', 'Velocidade'), text: '1x' });
            this.ui.appendChild(this.speed);
        }
    };

    OziAudio.prototype._buildRecorderControls = function () {
        this.record = _el('button', { type: 'button', class: 'ozi-audio__record is-idle', 'aria-label': _t('audio.record', 'Gravar') });
        var recIdle = _el('span', { class: 'ozi-audio__record-idle-icon', 'aria-hidden': 'true' });
        var recStop = _el('span', { class: 'ozi-audio__record-stop-icon', 'aria-hidden': 'true' });
        _append(this.record, recIdle, recStop);
        _setIcon(recIdle, 'icon-record.svg', '&#9679;');
        _setIcon(recStop, 'icon-stop.svg',   '&#9632;');
        this.ui.appendChild(this.record);
    };

    OziAudio.prototype._buildSaveButton = function () {
        this.save = _el('button', { type: 'button', class: 'ozi-audio__save', 'aria-label': _t('audio.save', 'Salvar áudio'), disabled: true });
        _setIcon(this.save, 'icon-save.svg', _t('audio.save', 'Salvar'));
        this.ui.appendChild(this.save);
    };

    OziAudio.prototype._buildRecorderBox = function () {
        var meta = _el('div', { class: 'ozi-audio__meta' });
        var time = _el('div', { class: 'ozi-audio__time' });
        this.timeCurrent = _el('span', { class: 'ozi-audio__time-current', text: '0:00' });
        time.appendChild(this.timeCurrent);
        this.status = _el('div', { class: 'ozi-audio__status', text: _t('audio.ready', 'Pronto') });
        _append(meta, time, this.status);
        this.box.appendChild(meta);

        if (this.showPreview) {
            this.previewWrap = _el('div', { class: 'ozi-audio__preview-wrap', hidden: true });
            this.preview     = _el('audio', { class: 'ozi-audio__preview', controls: true });
            this.previewWrap.appendChild(this.preview);
            this.box.appendChild(this.previewWrap);
        }

        if (this.saveUrl) this._buildSaveButton();
    };

    /* ─────────────────────────────────────────────
     * [8] INIT POR MODO
     * ───────────────────────────────────────────── */

    OziAudio.prototype.init = function () {
        if (this.root.__oziAudioInitialized) return;
        this.root.__oziAudioInitialized = true;

        if      (this.mode === 'player')   this._initPlayer();
        else if (this.mode === 'recorder') this._initRecorder();
        else if (this.mode === 'full')     this._initFull();
        else console.warn('[OZI:audio] modo inválido em #' + this.uid);

        this.emit('ozi:init', { source: 'api', mode: this.mode });
    };

    OziAudio.prototype._initPlayer = function () {
        this._buildShell(); // reseta modificadores; o modificador do modo é aplicado depois
        this.root.classList.add('ozi-audio-player');
        this.box = this._appendTitleBox(this.ui);
        this._buildPlayerControls();
        this._bindPlayerEvents();
        this._updateTime(0, 0);

        if (!this.url) {
            console.warn('[OZI:audio] data-ozi-audio-url obrigatório no modo player.');
            this._syncPlayerAvailability(false);
            return;
        }
        this._setAudioSource(this.url, false);
    };

    OziAudio.prototype._initRecorder = function () {
        this._buildShell();
        this.root.classList.add('ozi-audio-recorder');
        this.box = this._appendTitleBox(this.ui);
        this._buildRecorderBox();
        this._buildRecorderControls();
        this._bindRecorderEvents();
        this._updateRecorderTime(0);
        this._setStatus(_t('audio.ready', 'Pronto'));
    };

    OziAudio.prototype._initFull = function () {
        this._buildShell();
        this.root.classList.add('ozi-audio-full');
        this.box = this._appendTitleBox(this.ui);
        this._buildPlayerControls();

        this.status = _el('div', { class: 'ozi-audio__status', text: _t('audio.ready', 'Pronto') });
        var meta = this.box.querySelector('.ozi-audio__meta');
        if (meta) meta.appendChild(this.status);

        if (this.showPreview) {
            this.previewWrap = _el('div', { class: 'ozi-audio__preview-wrap', hidden: true });
            this.preview     = _el('audio', { class: 'ozi-audio__preview', controls: true });
            this.previewWrap.appendChild(this.preview);
            this.box.appendChild(this.previewWrap);
        }

        this._buildRecorderControls();
        if (this.saveUrl) this._buildSaveButton();

        this._bindPlayerEvents();
        this._bindRecorderEvents();
        this._updateTime(0, 0);
        this._setStatus(_t('audio.ready', 'Pronto'));

        if (this.url) { this._setAudioSource(this.url, false); }
        else          { this._syncPlayerAvailability(false); }
    };

    /* ─────────────────────────────────────────────
     * [9] EVENTOS (nativos, rastreados p/ destroy)
     * ───────────────────────────────────────────── */

    OziAudio.prototype._bindPlayerEvents = function () {
        var self = this;
        if (this.play)     this._on(this.play,     'click', function (e) { e.preventDefault(); if (self.audio) self._togglePlay(); });
        if (this.timeline) this._on(this.timeline, 'click', function (e) { if (self.audio) self._seekTo(e); });

        if (this.showVolume && this.volumeBar && this.volumeBtn) {
            this._on(this.volumeBar, 'click', function (e) { if (self.audio) self._setVolumeFromEvent(e); });
            this._on(this.volumeBtn, 'click', function (e) { e.preventDefault(); if (self.audio) self._toggleMute(); });
        }

        if (this.showSpeed && this.speed) {
            this._on(this.speed, 'click', function (e) { e.preventDefault(); if (self.audio) self._toggleSpeed(); });
        }
    };

    OziAudio.prototype._bindRecorderEvents = function () {
        var self = this;
        if (this.record) this._on(this.record, 'click', function (e) { e.preventDefault(); self._toggleRecord(); });
        if (this.save)   this._on(this.save,   'click', function (e) { e.preventDefault(); self._saveRecording(); });
    };

    /* ─────────────────────────────────────────────
     * [10] PLAYER
     * ───────────────────────────────────────────── */

    OziAudio.prototype._pauseOthers = function () {
        var h = window.OZI && window.OZI.helpers;
        if (h && typeof h.exclusiveActor === 'function') {
            var prev = h.exclusiveActor('audio-player', this);
            if (prev && prev !== this && typeof prev.pause === 'function') prev.pause();
            return;
        }
        if (_activePlayerInstance && _activePlayerInstance !== this) _activePlayerInstance.pause();
        _activePlayerInstance = this;
    };

    OziAudio.prototype._togglePlay = function () {
        if (!this.audio) return;
        this.audio.paused ? this.play_() : this.pause();
    };

    // play_ é o método interno de reprodução (a propriedade this.play é o botão DOM).
    OziAudio.prototype.play_ = function (source) {
        var self = this;
        if (!this.audio) return;
        this._pauseOthers();
        this.audio.play().then(function () {
            self._setPlayState(true);
            self._startPlayerLoop();
            self.emit('ozi:audio-play', { source: source || 'user', mode: self.mode, url: self.audio ? self.audio.src : '' });
        }).catch(function (err) { console.warn('[OZI:audio] erro ao reproduzir', err); });
    };

    OziAudio.prototype.pause = function (source) {
        if (!this.audio) return;
        this.audio.pause();
        this._setPlayState(false);
        this._stopPlayerLoop();
        this.emit('ozi:audio-pause', { source: source || 'user', mode: this.mode, url: this.audio ? this.audio.src : '' });
    };

    OziAudio.prototype._setPlayState = function (playing) {
        if (!this.play) return;
        this.play.classList.toggle('is-pause', !!playing);
        this.play.classList.toggle('is-play', !playing);
        this.play.setAttribute('aria-label', playing ? _t('audio.pause', 'Pausar') : _t('audio.play', 'Reproduzir'));
    };

    OziAudio.prototype._onLoadedMetadata = function () {
        if (this.audio) this._updateTime(this.audio.currentTime || 0, this.audio.duration || 0);
    };

    OziAudio.prototype._onEnded = function () {
        if (!this.audio) return;
        this.pause();
        this.audio.currentTime = 0;
        this._updateProgress(0);
        this._updateTime(0, this.audio.duration || 0);
    };

    OziAudio.prototype._startPlayerLoop = function () {
        var self = this;
        this._stopPlayerLoop();
        this.playerTimer = setInterval(function () {
            if (!self.audio) return;
            var c = self.audio.currentTime || 0, d = self.audio.duration || 0;
            self._updateProgress(d > 0 ? (c / d) * 100 : 0);
            self._updateTime(c, d);
        }, 250);
    };

    OziAudio.prototype._stopPlayerLoop = function () {
        if (this.playerTimer) { clearInterval(this.playerTimer); this.playerTimer = null; }
    };

    OziAudio.prototype._updateProgress = function (pct) {
        if (!this.progress || !this.timeline) return;
        pct = isNaN(pct) ? 0 : pct;
        this.progress.style.width = pct + '%';
        this.timeline.setAttribute('aria-valuenow', Math.round(pct));
    };

    OziAudio.prototype._updateTime = function (current, duration) {
        if (this.timeCurrent) this.timeCurrent.textContent = this._getTimeCode(current);
        if (this.timeLength)  this.timeLength.textContent  = this._getTimeCode(duration);
    };

    OziAudio.prototype._seekTo = function (e) {
        if (!this.audio || !this.audio.duration || !this.timeline) return;
        var rect = this.timeline.getBoundingClientRect();
        var w = rect.width;
        var x = e.clientX - rect.left;
        var r = w > 0 ? Math.max(0, Math.min(1, x / w)) : 0;
        this.audio.currentTime = r * this.audio.duration;
        this._updateProgress(r * 100);
        this._updateTime(this.audio.currentTime, this.audio.duration);
    };

    OziAudio.prototype._setVolumeFromEvent = function (e) {
        if (!this.audio || !this.volumeBar) return;
        var rect = this.volumeBar.getBoundingClientRect();
        var w = rect.width;
        var x = e.clientX - rect.left;
        this.audio.volume = w > 0 ? Math.max(0, Math.min(1, x / w)) : 0;
        this.audio.muted  = false;
        this._syncVolumeUI();
    };

    OziAudio.prototype._toggleMute = function () {
        if (!this.audio) return;
        this.audio.muted = !this.audio.muted;
        this._syncVolumeUI();
    };

    OziAudio.prototype._syncVolumeUI = function () {
        if (!this.showVolume || !this.volumeFill || !this.volumeBtn || !this.audio) return;
        var v = this.audio.muted ? 0 : this.audio.volume;
        this.volumeFill.style.width = (v * 100) + '%';
        this.volumeBtn.classList.toggle('is-off', !!this.audio.muted);
        this.volumeBtn.classList.toggle('is-on', !this.audio.muted);
    };

    OziAudio.prototype._toggleSpeed = function () {
        if (!this.audio || !this.speed) return;
        var c = this.audio.playbackRate || 1, n = 1;
        if      (c === 1)    n = 1.25;
        else if (c === 1.25) n = 1.5;
        else if (c === 1.5)  n = 1.75;
        else if (c === 1.75) n = 2;
        else if (c === 2)    n = 0.75;
        this.audio.playbackRate = n;
        this.speed.textContent = n + 'x';
    };

    /* ─────────────────────────────────────────────
     * [11] RECORDER
     * ───────────────────────────────────────────── */

    OziAudio.prototype._toggleRecord = function () {
        this.isRecording ? this._stopRecording() : this._startRecording();
    };

    OziAudio.prototype._startRecording = function (source) {
        var self = this;
        if (this.audio && !this.audio.paused) this.pause();

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            this._setStatus(_t('audio.micUnavailable', 'Microfone indisponível'));
            this.emit('ozi:audio-record-error', { source: source || 'user', message: 'getUserMedia indisponível' });
            return;
        }
        if (!window.MediaRecorder) {
            this._setStatus(_t('audio.micUnavailable', 'Gravação indisponível'));
            this.emit('ozi:audio-record-error', { source: source || 'user', message: 'MediaRecorder indisponível' });
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            var mimeType = self._getPreferredMimeType();
            var config   = mimeType ? { mimeType: mimeType } : {};

            self._cleanupRecorderMedia();
            self.mediaStream      = stream;
            self.recordChunks     = [];
            self.recordStartedAt  = Date.now();
            self.recordDuration   = 0;
            self.recordedBlob     = null;
            self.recordedFile     = null;
            self.recordedMimeType = mimeType || 'audio/webm';

            if (self.save) self.save.disabled = true;

            self.mediaRecorder = new MediaRecorder(stream, config);

            self.mediaRecorder.addEventListener('dataavailable', function (e) {
                if (e.data && e.data.size > 0) self.recordChunks.push(e.data);
            });

            self.mediaRecorder.addEventListener('stop', function () { self._handleRecorderStop(); });

            self.mediaRecorder.start();
            self.isRecording = true;
            self._setRecordState(true);
            self._setStatus(_t('audio.recording', 'Gravando...'));
            self._startRecorderLoop();
            self.emit('ozi:audio-record-start', { source: source || 'user', mode: self.mode });

        }).catch(function (err) {
            self._setStatus(_t('audio.micUnavailable', 'Permissão negada'));
            self.emit('ozi:audio-record-error', { source: source || 'user', message: err && err.message ? err.message : 'Erro ao acessar microfone' });
        });
    };

    OziAudio.prototype._stopRecording = function () {
        if (!this.mediaRecorder || !this.isRecording) return;
        this.isRecording = false;
        this._stopRecorderLoop();
        this._setRecordState(false);
        this._setStatus(_t('audio.processing', 'Processando...'));
        try { this.mediaRecorder.stop(); }
        catch (err) {
            this._setStatus(_t('audio.micUnavailable', 'Erro ao parar'));
            this.emit('ozi:audio-record-error', { message: err && err.message ? err.message : 'Erro ao parar gravação' });
            this._cleanupRecorderMedia();
        }
    };

    OziAudio.prototype._handleRecorderStop = function () {
        var mimeType  = (this.mediaRecorder && this.mediaRecorder.mimeType) || this.recordedMimeType || 'audio/webm';
        var duration  = (Date.now() - this.recordStartedAt) / 1000;
        var extension = this._guessExtension(mimeType);
        var filename  = 'gravacao-' + this.uid + '-' + Date.now() + '.' + extension;
        var blob      = new Blob(this.recordChunks, { type: mimeType });
        var file;

        try { file = new File([blob], filename, { type: mimeType }); }
        catch (e) { file = blob; file.name = filename; }

        this.recordedBlob     = blob;
        this.recordedFile     = file;
        this.recordedMimeType = mimeType;
        this.recordDuration   = Math.max(0, duration);

        if (this.showPreview && this.preview && this.previewWrap) {
            this._revokePreviewUrl();
            this.previewUrl = URL.createObjectURL(blob);
            this.preview.setAttribute('src', this.previewUrl);
            this.previewWrap.hidden = false;
        }

        if (this.mode === 'full') this._attachRecordedToPlayer(blob);
        if (this.save) this.save.disabled = false;

        this._setStatus(_t('audio.ready', 'Pronto'));
        this._updateRecorderTime(this.recordDuration);
        this._cleanupRecorderMedia();

        var payload = {
            duration: parseFloat(this.recordDuration.toFixed(2)),
            mimeType: mimeType,
            size:     file.size || blob.size || 0,
            file:     file
        };
        this.emit('ozi:audio-recorded', payload);
        // Contrato v2: nova gravação = mudança de valor canônico.
        this.emit('ozi:change', { file: file, duration: payload.duration });
    };

    OziAudio.prototype._attachRecordedToPlayer = function (blob) {
        if (!blob) return;
        this._setAudioSource(URL.createObjectURL(blob), true);
    };

    OziAudio.prototype._startRecorderLoop = function () {
        var self = this;
        this._stopRecorderLoop();
        this.recordTimer = setInterval(function () {
            self._updateRecorderTime((Date.now() - self.recordStartedAt) / 1000);
        }, 250);
    };

    OziAudio.prototype._stopRecorderLoop = function () {
        if (this.recordTimer) { clearInterval(this.recordTimer); this.recordTimer = null; }
    };

    OziAudio.prototype._updateRecorderTime = function (seconds) {
        if (this.timeCurrent) this.timeCurrent.textContent = this._getTimeCode(seconds);
    };

    OziAudio.prototype._setRecordState = function (recording) {
        if (!this.record) return;
        this.record.classList.toggle('is-recording', !!recording);
        this.record.classList.toggle('is-idle', !recording);
        this.record.setAttribute('aria-label', recording ? _t('audio.stopRecord', 'Parar gravação') : _t('audio.record', 'Gravar'));
    };

    OziAudio.prototype._setStatus = function (text) {
        if (this.status) this.status.textContent = String(text || '').trim();
    };

    OziAudio.prototype._saveRecording = function () {
        var self   = this;
        var sender = window.oziLoadData || window.oziLoaddata || null;

        if (!this.recordedFile) { this._setStatus(_t('audio.noRecording', 'Sem gravação'));    return; }
        if (!this.saveUrl)      { this._setStatus(_t('audio.noDestiny',   'Sem destino'));      return; }
        if (!sender)            { this._setStatus(_t('audio.senderError', 'ZLD indisponível')); return; }

        if (this.save) this.save.disabled = true;
        this._setStatus(_t('audio.sending', 'Enviando...'));

        var payload = {
            zldUrl:        this.saveUrl,
            zldMode:       'fetch',
            zldModeMethod: 'POST',
            zldExpectJson: true,
            zldApi:        true,
            zldFiles: [{
                name:     this.saveField,
                file:     this.recordedFile,
                filename: this.recordedFile.name || ('gravacao.' + this._guessExtension(this.recordedMimeType))
            }],
            zldJson: [{
                duration: parseFloat(this.recordDuration.toFixed(2)),
                mimeType: this.recordedFile.type || this.recordedMimeType || '',
                size:     this.recordedFile.size || 0,
                source:   'oziAudio'
            }]
        };

        var result = sender(payload, null, this.save ? this.save : this.root);

        if (result && typeof result.then === 'function') {
            result.then(function (res) {
                if (res && res.ok === true) {
                    self._setStatus(_t('audio.saved', 'Salvo'));
                    self.emit('ozi:audio-saved', { response: res });
                } else {
                    self._setStatus(_t('audio.saveError', 'Erro ao salvar'));
                    self.emit('ozi:audio-save-error', { response: res });
                }
            }).catch(function (err) {
                self._setStatus(_t('audio.saveError', 'Erro ao salvar'));
                self.emit('ozi:audio-save-error', { error: err });
            }).then(function () {
                // .finally() substituído por .then() para compat com browsers legados
                if (self.save) self.save.disabled = false;
            });
            return;
        }

        if (this.save) this.save.disabled = false;
    };

    OziAudio.prototype._cleanupRecorderMedia = function () {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(function (t) { t.stop(); });
            this.mediaStream = null;
        }
        this.mediaRecorder = null;
    };

    OziAudio.prototype._revokePreviewUrl = function () {
        if (this.previewUrl) { URL.revokeObjectURL(this.previewUrl); this.previewUrl = ''; }
    };

    /* ─────────────────────────────────────────────
     * [12] DESTROY
     * ───────────────────────────────────────────── */

    OziAudio.prototype.destroy = function () {
        this._stopPlayerLoop();
        this._stopRecorderLoop();

        // remove listeners próprios
        for (var i = 0; i < this._listeners.length; i++) {
            var L = this._listeners[i];
            try { L.el.removeEventListener(L.type, L.handler); } catch (e) {}
        }
        this._listeners = [];

        if (this.playerObjectUrl) {
            try { URL.revokeObjectURL(this.playerObjectUrl); } catch (e) {}
            this.playerObjectUrl = '';
        }

        if (this.audio) { this.audio.pause(); this.audio.src = ''; this.audio = null; }

        this._cleanupRecorderMedia();
        this._revokePreviewUrl();

        this.emit('ozi:destroy', { source: 'api' });

        delete this.root.__oziAudioInitialized;
        this.root.classList.remove('ozi-audio', 'ozi-audio-player', 'ozi-audio-recorder', 'ozi-audio-full');
        _empty(this.root);

        if (_activePlayerInstance === this) _activePlayerInstance = null;

        delete _instances[this.uid];
    };

    /* ─────────────────────────────────────────────
     * [13] API ESTÁTICA
     * ───────────────────────────────────────────── */

    var audioAPI = {

        init: function (scope) {
            var targets;
            if (!scope) {
                targets = Array.prototype.slice.call(document.querySelectorAll('[data-ozi-audio]'));
            } else {
                var root = (typeof scope === 'string') ? document.querySelector(scope)
                         : (scope.querySelectorAll ? scope : null);
                if (!root) return this;
                targets = (root.matches && root.matches('[data-ozi-audio]')) ? [root] : [];
                targets = targets.concat(Array.prototype.slice.call(root.querySelectorAll('[data-ozi-audio]')));
            }

            targets.forEach(function (el) {
                var id       = String(el.id || '').trim();
                var existing = id ? _instances[id] : null;

                if (existing) {
                    var same  = existing.root === el;
                    var inDom = existing.root && document.contains(existing.root);
                    if (same && el.__oziAudioInitialized) return;
                    if (!same && !inDom) existing.destroy();
                    else if (!same && inDom) return;
                }

                try {
                    var inst = new OziAudio(el);
                    inst.init();
                    _instances[inst.uid] = inst;
                } catch (e) {
                    console.warn('[OZI:audio] init erro:', e.message);
                }
            });

            return this;
        },

        get: function (ref) {
            if (!ref) return null;
            if (ref.nodeType === 1) return _instances[ref.id] || null;
            if (_instances[ref]) return _instances[ref];
            try {
                var el = document.querySelector(ref);
                if (el) return _instances[String(el.id || '')] || null;
            } catch (e) {}
            return null;
        },

        getAll:     function ()   { return Object.keys(_instances).map(function (k) { return _instances[k]; }); },
        destroy:    function (id) { var i = this.get(id); if (i) i.destroy(); },
        play:       function (id) { var i = this.get(id); if (i) i.play_('api'); },
        pause:      function (id) { var i = this.get(id); if (i) i.pause('api'); },
        record:     function (id) { var i = this.get(id); if (i) i._startRecording('api'); },
        stopRecord: function (id) { var i = this.get(id); if (i) i._stopRecording(); },
        save:       function (id) { var i = this.get(id); if (i) i._saveRecording(); },

        setIconBase: function (path) {
            _iconCache   = {};
            _iconPending = {};
            if (window.OZI && window.OZI.conf && window.OZI.conf.core) {
                window.OZI.conf.core.urlBase = String(path || '').replace(/\/?$/, '/');
            }
        }
    };

    /* ─────────────────────────────────────────────
     * [14] BOOT
     * ───────────────────────────────────────────── */

    function _registerAdapter() {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate || typeof validate.registerAdapter !== 'function') return;

        validate.registerAdapter({
            name:          'ozi-audio',
            nativeElement: true, // v2 — recebe Element puro, sem envelopar em jQuery

            match: function (el) { return el.hasAttribute('data-ozi-audio'); },

            isValid: function (el) {
                var inst = audioAPI.get(el);
                if (!inst) return true;
                if (inst.mode === 'player') return true;      // player — sempre válido (url no HTML)
                return !!inst.recordedFile;                    // recorder/full — válido se há gravação
            },

            getValue: function (el) {
                var inst = audioAPI.get(el);
                if (!inst) return null;
                if (inst.mode === 'player') return inst.url || null;
                return inst.recordedFile || null;              // File real para o FormData
            },

            setState: function (el, state) {
                var inst = audioAPI.get(el);
                if (!inst) return;
                if (state === 'invalid') inst.root.classList.add('ozi-audio--invalid');
                else                     inst.root.classList.remove('ozi-audio--invalid');
            }
        });
    }

    function _boot() {
        audioAPI.init();
        _registerAdapter();

        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.audio = audioAPI;
        }

        if (OZI && OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:audio', function (root) {
                audioAPI.init(root);
            });
        }
    }

    window.OziAudio = {
        init:        function (root) { audioAPI.init(root); },
        get:         function (id)   { return audioAPI.get(id); },
        getAll:      function ()     { return audioAPI.getAll(); },
        destroy:     function (id)   { audioAPI.destroy(id); },
        play:        function (id)   { audioAPI.play(id); },
        pause:       function (id)   { audioAPI.pause(id); },
        record:      function (id)   { audioAPI.record(id); },
        stopRecord:  function (id)   { audioAPI.stopRecord(id); },
        save:        function (id)   { audioAPI.save(id); },
        setIconBase: function (path) { audioAPI.setIconBase(path); },
        refresh:     function (root) { audioAPI.init(root); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})(window, document);
