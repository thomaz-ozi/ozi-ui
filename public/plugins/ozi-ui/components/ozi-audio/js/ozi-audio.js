/**
 * ------------------------------------------
 * ozi-audio
 * ------------------------------------------
 * Ver: 3.0.2
 * 2026-05-30
 *
 * Changelog:
 *   - v3.0.2: [FIX-P2] Strings PT hardcoded em _setStatus substituídas
 *     por _t() com fallback — usa OZI.lang.t() se disponível.
 *   - v3.0.2: [FIX-P3] Adapter OZI.modules.validate registrado no _boot().
 *     isValid() retorna true se recordedFile existe (modo recorder/full)
 *     ou se url está definida (modo player — sempre válido).
 */

(function ($, window, document) {
    'use strict';

    if (typeof $ === 'undefined') {
        console.error('[OZI:audio] jQuery não encontrado.');
        return;
    }

    /* ─────────────────────────────────────────────
     * [1] REGISTRY
     * ───────────────────────────────────────────── */

    var _instances            = {};
    var _instanceCounter      = 0;
    var _activePlayerInstance = null;

    /* ─────────────────────────────────────────────
     * [2] HELPER DE TRADUÇÃO
     * [FIX-P2] centraliza acesso ao OZI.lang.t()
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
     * [3] SISTEMA DE ÍCONES SVG
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

    function _setIcon($el, iconFile, fallback) {
        if (!$el || !$el.length) return;

        var h = window.OZI && window.OZI.helpers;
        if (h && typeof h.icon === 'function') {
            var name = iconFile.replace(/\.svg$/, '').replace(/^icon-/, '');
            h.icon($el, name, { plugin: 'audio', fallback: fallback });
            return;
        }

        _fetchIcon(iconFile).then(function (svg) {
            $el.html(svg || fallback || '');
        });
    }

    /* ─────────────────────────────────────────────
     * [4] CONSTRUCTOR
     * ───────────────────────────────────────────── */

    function OziAudio(element) {
        this.$root = $(element);
        this.mode  = String(this.$root.attr('data-ozi-audio') || '').trim().toLowerCase();

        this.uid = this.$root.attr('id') || ('ozi-audio-' + (++_instanceCounter));
        this.$root.attr('id', this.uid);
        this.ns = '.oziAudio.' + this.uid;

        this.url         = String(this.$root.attr('data-ozi-audio-url')   || '').trim();
        this.title       = String(this.$root.attr('data-ozi-audio-title') || '').trim();
        this.showVolume  = this._parseBoolAttr('data-ozi-audio-volume',  true);
        this.showSpeed   = this._parseBoolAttr('data-ozi-audio-speed',   true);
        this.showPreview = this._parseBoolAttr('data-ozi-audio-preview',  true);
        this.saveUrl     = String(this.$root.attr('data-ozi-audio-save-url')   || '').trim();
        this.saveField   = String(this.$root.attr('data-ozi-audio-save-field') || 'audio_file').trim();

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

        this.$ui = null; this.$box = null; this.$title = null;
        this.$play = null; this.$timeline = null; this.$progress = null;
        this.$timeCurrent = null; this.$timeLength = null;
        this.$volumeWrap = null; this.$volumeBtn = null;
        this.$volumeBar = null; this.$volumeFill = null;
        this.$speed = null; this.$record = null; this.$status = null;
        this.$previewWrap = null; this.$preview = null; this.$save = null;
    }

    /* ─────────────────────────────────────────────
     * [5] HELPERS
     * ───────────────────────────────────────────── */

    OziAudio.prototype._parseBoolAttr = function (attr, fb) {
        if (!this.$root.is('[' + attr + ']')) return !!fb;
        var r = this.$root.attr(attr);
        if (r === undefined || r === '') return true;
        r = String(r).trim().toLowerCase();
        return !(r === 'false' || r === '0' || r === 'no' || r === 'off');
    };

    OziAudio.prototype.emit = function (eventName, payload) {
        this.$root.trigger(eventName, [payload || {}, this]);
        if (typeof CustomEvent === 'function') {
            this.$root[0].dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail: payload || {} }));
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
     * [6] BUILD UI
     * ───────────────────────────────────────────── */

    OziAudio.prototype._buildShell = function () {
        this.$root.empty().removeClass('ozi-audio-player ozi-audio-recorder ozi-audio-full');
        this.$root.addClass('ozi-audio');
        this.$ui = $('<div>', { class: 'ozi-audio__main' });
        this.$root.append(this.$ui);
    };

    OziAudio.prototype._appendTitleBox = function ($target) {
        var $box = $('<div>', { class: 'ozi-audio__timeline-box' });
        if (this.title) {
            this.$title = $('<div>', { class: 'ozi-audio__title' }).text(this.title);
            $box.append(this.$title);
        }
        $target.append($box);
        return $box;
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

        if (this.$speed) { this.audio.playbackRate = 1; this.$speed.text('1x'); }

        this._updateProgress(0);
        this._updateTime(0, 0);
        this._setPlayState(false);
        this._syncVolumeUI();
        this._syncPlayerAvailability(true);
    };

    OziAudio.prototype._syncPlayerAvailability = function (enabled) {
        if (this.$play)      this.$play.prop('disabled', !enabled);
        if (this.$timeline)  this.$timeline.toggleClass('is-disabled', !enabled);
        if (this.$volumeBtn) this.$volumeBtn.prop('disabled', !enabled);
        if (this.$volumeBar) this.$volumeBar.toggleClass('is-disabled', !enabled);
        if (this.$speed)     this.$speed.prop('disabled', !enabled);
    };

    OziAudio.prototype._buildPlayerControls = function () {
        this.$play = $('<button>', { type: 'button', class: 'ozi-audio__play is-play', 'aria-label': _t('audio.play', 'Reproduzir') });
        var $playIcon  = $('<span>', { class: 'ozi-audio__play-icon',  'aria-hidden': 'true' });
        var $pauseIcon = $('<span>', { class: 'ozi-audio__pause-icon', 'aria-hidden': 'true' });
        this.$play.append($playIcon, $pauseIcon);
        _setIcon($playIcon,  'icon-play.svg',  '&#9654;');
        _setIcon($pauseIcon, 'icon-pause.svg', '&#10074;&#10074;');

        this.$timeline = $('<div>', { class: 'ozi-audio__timeline', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' });
        this.$progress = $('<div>', { class: 'ozi-audio__progress' });
        this.$timeline.append(this.$progress);

        var $meta = $('<div>', { class: 'ozi-audio__meta' });
        var $time = $('<div>', { class: 'ozi-audio__time' });
        this.$timeCurrent = $('<span>', { class: 'ozi-audio__time-current' }).text('0:00');
        this.$timeLength  = $('<span>', { class: 'ozi-audio__time-length'  }).text('0:00');
        $time.append(this.$timeCurrent, $('<span>', { class: 'ozi-audio__time-sep' }).text('/'), this.$timeLength);
        $meta.append($time);

        if (this.showVolume) {
            this.$volumeWrap = $('<div>', { class: 'ozi-audio__volume' });
            this.$volumeBtn  = $('<button>', { type: 'button', class: 'ozi-audio__volume-btn is-on', 'aria-label': _t('audio.volume', 'Volume') });
            var $volOn  = $('<span>', { class: 'ozi-audio__volume-on',  'aria-hidden': 'true' });
            var $volOff = $('<span>', { class: 'ozi-audio__volume-off', 'aria-hidden': 'true' });
            this.$volumeBtn.append($volOn, $volOff);
            _setIcon($volOn,  'icon-volume-on.svg',  '&#128266;');
            _setIcon($volOff, 'icon-volume-off.svg', '&#128263;');
            this.$volumeBar  = $('<div>', { class: 'ozi-audio__volume-bar' });
            this.$volumeFill = $('<div>', { class: 'ozi-audio__volume-fill' });
            this.$volumeBar.append(this.$volumeFill);
            this.$volumeWrap.append(this.$volumeBtn, this.$volumeBar);
            $meta.append(this.$volumeWrap);
        }

        this.$box.append(this.$timeline, $meta);
        this.$ui.append(this.$play, this.$box);

        if (this.showSpeed) {
            this.$speed = $('<button>', { type: 'button', class: 'ozi-audio__speed', 'aria-label': _t('audio.speed', 'Velocidade') }).text('1x');
            this.$ui.append(this.$speed);
        }
    };

    OziAudio.prototype._buildRecorderControls = function () {
        this.$record = $('<button>', { type: 'button', class: 'ozi-audio__record is-idle', 'aria-label': _t('audio.record', 'Gravar') });
        var $recIdle = $('<span>', { class: 'ozi-audio__record-idle-icon', 'aria-hidden': 'true' });
        var $recStop = $('<span>', { class: 'ozi-audio__record-stop-icon', 'aria-hidden': 'true' });
        this.$record.append($recIdle, $recStop);
        _setIcon($recIdle, 'icon-record.svg', '&#9679;');
        _setIcon($recStop, 'icon-stop.svg',   '&#9632;');
        this.$ui.append(this.$record);
    };

    OziAudio.prototype._buildSaveButton = function () {
        this.$save = $('<button>', { type: 'button', class: 'ozi-audio__save', 'aria-label': _t('audio.save', 'Salvar áudio'), disabled: true });
        _setIcon(this.$save, 'icon-save.svg', _t('audio.save', 'Salvar'));
        this.$ui.append(this.$save);
    };

    OziAudio.prototype._buildRecorderBox = function () {
        var $meta = $('<div>', { class: 'ozi-audio__meta' });
        var $time = $('<div>', { class: 'ozi-audio__time' });
        this.$timeCurrent = $('<span>', { class: 'ozi-audio__time-current' }).text('0:00');
        $time.append(this.$timeCurrent);
        this.$status = $('<div>', { class: 'ozi-audio__status' }).text(_t('audio.ready', 'Pronto'));
        $meta.append($time, this.$status);
        this.$box.append($meta);

        if (this.showPreview) {
            this.$previewWrap = $('<div>', { class: 'ozi-audio__preview-wrap', hidden: true });
            this.$preview     = $('<audio>', { class: 'ozi-audio__preview', controls: true });
            this.$previewWrap.append(this.$preview);
            this.$box.append(this.$previewWrap);
        }

        if (this.saveUrl) this._buildSaveButton();
    };

    /* ─────────────────────────────────────────────
     * [7] INIT POR MODO
     * ───────────────────────────────────────────── */

    OziAudio.prototype.init = function () {
        if (this.$root.data('ozi-audio-initialized')) return;
        this.$root.data('ozi-audio-initialized', true);

        if      (this.mode === 'player')   this._initPlayer();
        else if (this.mode === 'recorder') this._initRecorder();
        else if (this.mode === 'full')     this._initFull();
        else console.warn('[OZI:audio] modo inválido em #' + this.uid);
    };

    OziAudio.prototype._initPlayer = function () {
        this.$root.addClass('ozi-audio-player');
        this._buildShell();
        this.$box = this._appendTitleBox(this.$ui);
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
        this.$root.addClass('ozi-audio-recorder');
        this._buildShell();
        this.$box = this._appendTitleBox(this.$ui);
        this._buildRecorderBox();
        this._buildRecorderControls();
        this._bindRecorderEvents();
        this._updateRecorderTime(0);
        this._setStatus(_t('audio.ready', 'Pronto'));
    };

    OziAudio.prototype._initFull = function () {
        this.$root.addClass('ozi-audio-full');
        this._buildShell();
        this.$box = this._appendTitleBox(this.$ui);
        this._buildPlayerControls();

        this.$status = $('<div>', { class: 'ozi-audio__status' }).text(_t('audio.ready', 'Pronto'));
        this.$box.find('.ozi-audio__meta').append(this.$status);

        if (this.showPreview) {
            this.$previewWrap = $('<div>', { class: 'ozi-audio__preview-wrap', hidden: true });
            this.$preview     = $('<audio>', { class: 'ozi-audio__preview', controls: true });
            this.$previewWrap.append(this.$preview);
            this.$box.append(this.$previewWrap);
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
     * [8] EVENTOS
     * ───────────────────────────────────────────── */

    OziAudio.prototype._bindPlayerEvents = function () {
        var self = this;
        if (this.$play)     this.$play.on('click' + this.ns, function (e) { e.preventDefault(); if (self.audio) self._togglePlay(); });
        if (this.$timeline) this.$timeline.on('click' + this.ns, function (e) { if (self.audio) self._seekTo(e); });

        if (this.showVolume && this.$volumeBar && this.$volumeBtn) {
            this.$volumeBar.on('click' + this.ns, function (e) { if (self.audio) self._setVolumeFromEvent(e); });
            this.$volumeBtn.on('click' + this.ns, function (e) { e.preventDefault(); if (self.audio) self._toggleMute(); });
        }

        if (this.showSpeed && this.$speed) {
            this.$speed.on('click' + this.ns, function (e) { e.preventDefault(); if (self.audio) self._toggleSpeed(); });
        }
    };

    OziAudio.prototype._bindRecorderEvents = function () {
        var self = this;
        if (this.$record) this.$record.on('click' + this.ns, function (e) { e.preventDefault(); self._toggleRecord(); });
        if (this.$save)   this.$save.on('click' + this.ns,   function (e) { e.preventDefault(); self._saveRecording(); });
    };

    /* ─────────────────────────────────────────────
     * [9] PLAYER
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
        this.audio.paused ? this.play() : this.pause();
    };

    OziAudio.prototype.play = function () {
        var self = this;
        if (!this.audio) return;
        this._pauseOthers();
        this.audio.play().then(function () {
            self._setPlayState(true);
            self._startPlayerLoop();
            self.emit('ozi:audio-play', { mode: self.mode, url: self.audio ? self.audio.src : '' });
        }).catch(function (err) { console.warn('[OZI:audio] erro ao reproduzir', err); });
    };

    OziAudio.prototype.pause = function () {
        if (!this.audio) return;
        this.audio.pause();
        this._setPlayState(false);
        this._stopPlayerLoop();
        this.emit('ozi:audio-pause', { mode: this.mode, url: this.audio ? this.audio.src : '' });
    };

    OziAudio.prototype._setPlayState = function (playing) {
        if (!this.$play) return;
        this.$play.toggleClass('is-pause', !!playing).toggleClass('is-play', !playing);
        this.$play.attr('aria-label', playing ? _t('audio.pause', 'Pausar') : _t('audio.play', 'Reproduzir'));
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
        if (!this.$progress || !this.$timeline) return;
        pct = isNaN(pct) ? 0 : pct;
        this.$progress.css('width', pct + '%');
        this.$timeline.attr('aria-valuenow', Math.round(pct));
    };

    OziAudio.prototype._updateTime = function (current, duration) {
        if (this.$timeCurrent) this.$timeCurrent.text(this._getTimeCode(current));
        if (this.$timeLength)  this.$timeLength.text(this._getTimeCode(duration));
    };

    OziAudio.prototype._seekTo = function (e) {
        if (!this.audio || !this.audio.duration || !this.$timeline) return;
        var w = this.$timeline.outerWidth();
        var x = e.pageX - this.$timeline.offset().left;
        var r = Math.max(0, Math.min(1, x / w));
        this.audio.currentTime = r * this.audio.duration;
        this._updateProgress(r * 100);
        this._updateTime(this.audio.currentTime, this.audio.duration);
    };

    OziAudio.prototype._setVolumeFromEvent = function (e) {
        if (!this.audio || !this.$volumeBar) return;
        var w = this.$volumeBar.outerWidth();
        var x = e.pageX - this.$volumeBar.offset().left;
        this.audio.volume = Math.max(0, Math.min(1, x / w));
        this.audio.muted  = false;
        this._syncVolumeUI();
    };

    OziAudio.prototype._toggleMute = function () {
        if (!this.audio) return;
        this.audio.muted = !this.audio.muted;
        this._syncVolumeUI();
    };

    OziAudio.prototype._syncVolumeUI = function () {
        if (!this.showVolume || !this.$volumeFill || !this.$volumeBtn || !this.audio) return;
        var v = this.audio.muted ? 0 : this.audio.volume;
        this.$volumeFill.css('width', (v * 100) + '%');
        this.$volumeBtn.toggleClass('is-off', !!this.audio.muted).toggleClass('is-on', !this.audio.muted);
    };

    OziAudio.prototype._toggleSpeed = function () {
        if (!this.audio || !this.$speed) return;
        var c = this.audio.playbackRate || 1, n = 1;
        if      (c === 1)    n = 1.25;
        else if (c === 1.25) n = 1.5;
        else if (c === 1.5)  n = 1.75;
        else if (c === 1.75) n = 2;
        else if (c === 2)    n = 0.75;
        this.audio.playbackRate = n;
        this.$speed.text(n + 'x');
    };

    /* ─────────────────────────────────────────────
     * [10] RECORDER
     * ───────────────────────────────────────────── */

    OziAudio.prototype._toggleRecord = function () {
        this.isRecording ? this._stopRecording() : this._startRecording();
    };

    OziAudio.prototype._startRecording = function () {
        var self = this;
        if (this.audio && !this.audio.paused) this.pause();

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            this._setStatus(_t('audio.micUnavailable', 'Microfone indisponível'));
            this.emit('ozi:audio-record-error', { message: 'getUserMedia indisponível' });
            return;
        }
        if (!window.MediaRecorder) {
            this._setStatus(_t('audio.micUnavailable', 'Gravação indisponível'));
            this.emit('ozi:audio-record-error', { message: 'MediaRecorder indisponível' });
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

            if (self.$save) self.$save.prop('disabled', true);

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
            self.emit('ozi:audio-record-start', { mode: self.mode });

        }).catch(function (err) {
            self._setStatus(_t('audio.micUnavailable', 'Permissão negada'));
            self.emit('ozi:audio-record-error', { message: err && err.message ? err.message : 'Erro ao acessar microfone' });
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

        if (this.showPreview && this.$preview && this.$previewWrap) {
            this._revokePreviewUrl();
            this.previewUrl = URL.createObjectURL(blob);
            this.$preview.attr('src', this.previewUrl);
            this.$previewWrap.prop('hidden', false);
        }

        if (this.mode === 'full') this._attachRecordedToPlayer(blob);
        if (this.$save) this.$save.prop('disabled', false);

        this._setStatus(_t('audio.ready', 'Pronto'));
        this._updateRecorderTime(this.recordDuration);
        this._cleanupRecorderMedia();

        this.emit('ozi:audio-recorded', {
            duration: parseFloat(this.recordDuration.toFixed(2)),
            mimeType: mimeType,
            size:     file.size || blob.size || 0,
            file:     file
        });
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
        if (this.$timeCurrent) this.$timeCurrent.text(this._getTimeCode(seconds));
    };

    OziAudio.prototype._setRecordState = function (recording) {
        if (!this.$record) return;
        this.$record.toggleClass('is-recording', !!recording).toggleClass('is-idle', !recording);
        this.$record.attr('aria-label', recording ? _t('audio.stopRecord', 'Parar gravação') : _t('audio.record', 'Gravar'));
    };

    OziAudio.prototype._setStatus = function (text) {
        if (this.$status) this.$status.text(String(text || '').trim());
    };

    OziAudio.prototype._saveRecording = function () {
        var self   = this;
        var sender = window.oziLoadData || window.oziLoaddata || null;

        if (!this.recordedFile) { this._setStatus(_t('audio.noRecording', 'Sem gravação'));    return; }
        if (!this.saveUrl)      { this._setStatus(_t('audio.noDestiny',   'Sem destino'));      return; }
        if (!sender)            { this._setStatus(_t('audio.senderError', 'ZLD indisponível')); return; }

        if (this.$save) this.$save.prop('disabled', true);
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

        var result = sender(payload, null, this.$save ? this.$save[0] : this.$root[0]);

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
                // [FIX-A] .finally() substituído por .then() para compat com browsers legados
                if (self.$save) self.$save.prop('disabled', false);
            });
            return;
        }

        if (this.$save) this.$save.prop('disabled', false);
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
     * [11] DESTROY
     * ───────────────────────────────────────────── */

    OziAudio.prototype.destroy = function () {
        this._stopPlayerLoop();
        this._stopRecorderLoop();

        if (this.playerObjectUrl) {
            try { URL.revokeObjectURL(this.playerObjectUrl); } catch (e) {}
            this.playerObjectUrl = '';
        }

        if (this.audio) { this.audio.pause(); this.audio.src = ''; this.audio = null; }

        this._cleanupRecorderMedia();
        this._revokePreviewUrl();

        this.$root
            .removeData('ozi-audio-initialized')
            .removeClass('ozi-audio ozi-audio-player ozi-audio-recorder ozi-audio-full')
            .empty();

        if (_activePlayerInstance === this) _activePlayerInstance = null;

        delete _instances[this.uid];
    };

    /* ─────────────────────────────────────────────
     * [12] API ESTÁTICA
     * ───────────────────────────────────────────── */

    var audioAPI = {

        init: function (root) {
            var $scope = root ? $(root) : $(document);
            $scope.find('[data-ozi-audio]').addBack('[data-ozi-audio]').each(function () {
                var $el = $(this);
                var id  = String($el.attr('id') || '').trim();
                var existing = id ? _instances[id] : null;

                if (existing) {
                    var same  = existing.$root && existing.$root[0] === this;
                    var inDom = existing.$root && document.contains(existing.$root[0]);
                    if (same && $el.data('ozi-audio-initialized')) return;
                    if (!same && !inDom) existing.destroy();
                    else if (!same && inDom) return;
                }

                try {
                    var inst = new OziAudio(this);
                    inst.init();
                    _instances[inst.uid] = inst;
                } catch (e) {
                    console.warn('[OZI:audio] init erro:', e.message);
                }
            });
        },

        get:        function (id) { if (!id) return null; if (_instances[id]) return _instances[id]; var $el = $(id).first(); if (!$el.length) return null; return _instances[String($el.attr('id') || '')] || null; },
        getAll:     function ()   { return Object.keys(_instances).map(function (k) { return _instances[k]; }); },
        destroy:    function (id) { var i = this.get(id); if (i) i.destroy(); },
        play:       function (id) { var i = this.get(id); if (i) i.play(); },
        pause:      function (id) { var i = this.get(id); if (i) i.pause(); },
        record:     function (id) { var i = this.get(id); if (i) i._startRecording(); },
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
     * [13] BOOT
     * [FIX-P3] adapter de validação adicionado
     * ───────────────────────────────────────────── */

    function _registerAdapter() {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate || typeof validate.registerAdapter !== 'function') return;

        validate.registerAdapter({
            name: 'ozi-audio',

            match: function ($el) { return $el.is('[data-ozi-audio]'); },

            isValid: function ($el) {
                var inst = audioAPI.get(String($el.attr('id') || ''));
                if (!inst) return true;
                // player — sempre válido (url definida no HTML)
                if (inst.mode === 'player') return true;
                // recorder / full — válido se há gravação
                return !!inst.recordedFile;
            },

            getValue: function ($el) {
                var inst = audioAPI.get(String($el.attr('id') || ''));
                return inst ? (inst.recordedFile || null) : null;
            },

            setState: function ($el, state) {
                // visual opcional — audio não tem campo de feedback padrão
                // o dev pode usar data-ozi-audio-required-message se quiser
                var inst = audioAPI.get(String($el.attr('id') || ''));
                if (!inst) return;
                if (state === 'invalid') {
                    inst.$root.addClass('ozi-audio--invalid');
                } else {
                    inst.$root.removeClass('ozi-audio--invalid');
                }
            }
        });
    }

    function _boot() {
        audioAPI.init();
        _registerAdapter(); // [FIX-P3]

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
        get:         audioAPI.get,
        destroy:     audioAPI.destroy,
        play:        audioAPI.play,
        pause:       audioAPI.pause,
        record:      audioAPI.record,
        stopRecord:  audioAPI.stopRecord,
        save:        audioAPI.save,
        setIconBase: audioAPI.setIconBase,
        refresh:     function (root) { audioAPI.init(root); }
    };

    $(function () { _boot(); });

})(jQuery, window, document);