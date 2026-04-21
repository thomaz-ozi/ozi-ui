// OZI AUDIO
// VERSAO: 1.2.0
// DATA: 2026-04-12
// DESCRICAO:
// Componente declarativo de audio.
// Modos:
// - data-ozi-audio="player"
// - data-ozi-audio="recorder"
// - data-ozi-audio="full"

(function ($) {
    'use strict';

    if (!$) {
        console.error('oziAudio: jQuery nao encontrado.');
        return;
    }

    var instances = {};
    var instanceCounter = 0;
    var activePlayerInstance = null;

    function OziAudio(element) {
        this.$root = $(element);
        this.mode = String(this.$root.attr('data-ozi-audio') || '').trim().toLowerCase();

        this.uid = this.$root.attr('id') || ('ozi-audio-' + (++instanceCounter));
        this.$root.attr('id', this.uid);

        this.ns = '.oziAudio.' + this.uid;

        this.url = String(this.$root.attr('data-ozi-audio-url') || '').trim();
        this.title = String(this.$root.attr('data-ozi-audio-title') || '').trim();

        this.showVolume = this.parseBooleanAttr('data-ozi-audio-volume', true);
        this.showSpeed = this.parseBooleanAttr('data-ozi-audio-speed', true);

        this.showPreview = this.parseBooleanAttr('data-ozi-audio-preview', true);
        this.saveUrl = String(this.$root.attr('data-ozi-audio-save-url') || '').trim();
        this.saveField = String(this.$root.attr('data-ozi-audio-save-field') || 'audio_file').trim();

        this.audio = null;
        this.playerTimer = null;
        this.playerObjectUrl = '';

        this.mediaStream = null;
        this.mediaRecorder = null;
        this.recordChunks = [];
        this.recordTimer = null;
        this.recordStartedAt = 0;
        this.recordDuration = 0;
        this.recordedBlob = null;
        this.recordedFile = null;
        this.recordedMimeType = '';
        this.previewUrl = '';
        this.isRecording = false;

        this.$ui = null;
        this.$box = null;
        this.$title = null;

        this.$play = null;
        this.$timeline = null;
        this.$progress = null;
        this.$timeCurrent = null;
        this.$timeLength = null;
        this.$volumeWrap = null;
        this.$volumeBtn = null;
        this.$volumeBar = null;
        this.$volumeFill = null;
        this.$speed = null;

        this.$record = null;
        this.$status = null;
        this.$previewWrap = null;
        this.$preview = null;
        this.$save = null;

        this.init();
    }

    OziAudio.prototype.parseBooleanAttr = function (attrName, fallbackValue) {
        if (!this.$root.is('[' + attrName + ']')) return !!fallbackValue;

        var raw = this.$root.attr(attrName);

        if (raw === undefined || raw === '') return true;

        raw = String(raw).trim().toLowerCase();

        if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') {
            return false;
        }

        return true;
    };

    OziAudio.prototype.init = function () {
        if (this.$root.data('ozi-audio-initialized')) return;
        this.$root.data('ozi-audio-initialized', true);

        if (this.mode === 'player') {
            this.initPlayer();
            return;
        }

        if (this.mode === 'recorder') {
            this.initRecorder();
            return;
        }

        if (this.mode === 'full') {
            this.initFull();
            return;
        }

        console.warn('oziAudio 1.2.0: modo inválido em #' + this.uid + '.');
    };

    OziAudio.prototype.emit = function (eventName, payload) {
        this.$root.trigger(eventName, [payload || {}, this]);
    };

    OziAudio.prototype.buildShell = function () {
        this.$root.empty().removeClass('ozi-audio-player ozi-audio-recorder ozi-audio-full');
        this.$root.addClass('ozi-audio');

        this.$ui = $('<div>', {
            class: 'ozi-audio__main'
        });

        this.$root.append(this.$ui);
    };

    OziAudio.prototype.appendTitleBox = function ($target) {
        var $box = $('<div>', {
            class: 'ozi-audio__timeline-box'
        });

        if (this.title) {
            this.$title = $('<div>', {
                class: 'ozi-audio__title'
            }).text(this.title);

            $box.append(this.$title);
        }

        $target.append($box);
        return $box;
    };

    OziAudio.prototype.ensureAudioObject = function () {
        var self = this;

        if (this.audio) return;

        this.audio = new Audio();
        this.audio.preload = 'metadata';
        this.audio.volume = 0.5;

        this.audio.addEventListener('loadedmetadata', function () {
            self.handlePlayerLoadedMetadata();
        });

        this.audio.addEventListener('ended', function () {
            self.handlePlayerEnded();
        });
    };

    OziAudio.prototype.setAudioSource = function (src, isObjectUrl) {
        if (!src) {
            this.syncPlayerAvailability(false);
            return;
        }

        this.ensureAudioObject();

        if (this.playerObjectUrl) {
            try {
                URL.revokeObjectURL(this.playerObjectUrl);
            } catch (error) {}
            this.playerObjectUrl = '';
        }

        if (isObjectUrl) {
            this.playerObjectUrl = src;
        }

        this.audio.pause();
        this.audio.src = src;
        this.audio.load();

        if (this.$speed) {
            this.audio.playbackRate = 1;
            this.$speed.text('1x');
        }

        this.updateProgressUI(0);
        this.updateTimeUI(0, 0);
        this.setPlayState(false);
        this.syncVolumeUI();
        this.syncPlayerAvailability(true);
    };

    OziAudio.prototype.syncPlayerAvailability = function (enabled) {
        var isEnabled = !!enabled;

        if (this.$play) {
            this.$play.prop('disabled', !isEnabled);
        }

        if (this.$timeline) {
            this.$timeline.toggleClass('is-disabled', !isEnabled);
        }

        if (this.$volumeBtn) {
            this.$volumeBtn.prop('disabled', !isEnabled);
        }

        if (this.$volumeBar) {
            this.$volumeBar.toggleClass('is-disabled', !isEnabled);
        }

        if (this.$speed) {
            this.$speed.prop('disabled', !isEnabled);
        }
    };

    OziAudio.prototype.buildPlayerControls = function () {
        this.$play = $('<button>', {
            type: 'button',
            class: 'ozi-audio__play is-play',
            'aria-label': 'Reproduzir'
        }).html(
            '<span class="ozi-audio__play-icon">▶</span>' +
            '<span class="ozi-audio__pause-icon">❚❚</span>'
        );

        this.$timeline = $('<div>', {
            class: 'ozi-audio__timeline',
            role: 'progressbar',
            'aria-valuemin': '0',
            'aria-valuemax': '100',
            'aria-valuenow': '0'
        });

        this.$progress = $('<div>', {
            class: 'ozi-audio__progress'
        });

        this.$timeline.append(this.$progress);

        var $meta = $('<div>', {
            class: 'ozi-audio__meta'
        });

        var $time = $('<div>', {
            class: 'ozi-audio__time'
        });

        this.$timeCurrent = $('<span>', {
            class: 'ozi-audio__time-current'
        }).text('0:00');

        this.$timeLength = $('<span>', {
            class: 'ozi-audio__time-length'
        }).text('0:00');

        $time.append(
            this.$timeCurrent,
            $('<span>', { class: 'ozi-audio__time-sep' }).text('/'),
            this.$timeLength
        );

        $meta.append($time);

        if (this.showVolume) {
            this.$volumeWrap = $('<div>', {
                class: 'ozi-audio__volume'
            });

            this.$volumeBtn = $('<button>', {
                type: 'button',
                class: 'ozi-audio__volume-btn is-on',
                'aria-label': 'Volume'
            }).html(
                '<span class="ozi-audio__volume-on">🔊</span>' +
                '<span class="ozi-audio__volume-off">🔇</span>'
            );

            this.$volumeBar = $('<div>', {
                class: 'ozi-audio__volume-bar'
            });

            this.$volumeFill = $('<div>', {
                class: 'ozi-audio__volume-fill'
            });

            this.$volumeBar.append(this.$volumeFill);
            this.$volumeWrap.append(this.$volumeBtn, this.$volumeBar);
            $meta.append(this.$volumeWrap);
        }

        this.$box.append(this.$timeline, $meta);

        this.$ui.append(this.$play, this.$box);

        if (this.showSpeed) {
            this.$speed = $('<button>', {
                type: 'button',
                class: 'ozi-audio__speed',
                'aria-label': 'Velocidade'
            }).text('1x');

            this.$ui.append(this.$speed);
        }
    };

    OziAudio.prototype.buildRecorderControls = function () {
        this.$record = $('<button>', {
            type: 'button',
            class: 'ozi-audio__record is-idle',
            'aria-label': 'Gravar'
        }).html(
            '<span class="ozi-audio__record-idle-icon">●</span>' +
            '<span class="ozi-audio__record-stop-icon">■</span>'
        );

        this.$ui.append(this.$record);
    };

    OziAudio.prototype.buildRecorderBox = function () {
        var $meta = $('<div>', {
            class: 'ozi-audio__meta'
        });

        var $time = $('<div>', {
            class: 'ozi-audio__time'
        });

        this.$timeCurrent = $('<span>', {
            class: 'ozi-audio__time-current'
        }).text('0:00');

        $time.append(this.$timeCurrent);

        this.$status = $('<div>', {
            class: 'ozi-audio__status'
        }).text('Pronto');

        $meta.append($time, this.$status);
        this.$box.append($meta);

        if (this.showPreview) {
            this.$previewWrap = $('<div>', {
                class: 'ozi-audio__preview-wrap',
                hidden: true
            });

            this.$preview = $('<audio>', {
                class: 'ozi-audio__preview',
                controls: true
            });

            this.$previewWrap.append(this.$preview);
            this.$box.append(this.$previewWrap);
        }

        if (this.saveUrl) {
            this.$save = $('<button>', {
                type: 'button',
                class: 'ozi-audio__save',
                'aria-label': 'Salvar áudio',
                disabled: true
            }).text('Salvar');

            this.$ui.append(this.$save);
        }
    };

    OziAudio.prototype.initPlayer = function () {
        this.$root.addClass('ozi-audio-player');
        this.buildShell();
        this.$box = this.appendTitleBox(this.$ui);
        this.buildPlayerControls();

        this.bindPlayerEvents();
        this.updateTimeUI(0, 0);

        if (!this.url) {
            console.warn('oziAudio 1.2.0: data-ozi-audio-url é obrigatório no modo player.');
            this.syncPlayerAvailability(false);
            return;
        }

        this.setAudioSource(this.url, false);
    };

    OziAudio.prototype.initRecorder = function () {
        this.$root.addClass('ozi-audio-recorder');
        this.buildShell();
        this.$box = this.appendTitleBox(this.$ui);
        this.buildRecorderBox();
        this.buildRecorderControls();

        this.bindRecorderEvents();
        this.updateRecorderTimeUI(0);
        this.setRecorderStatus('Pronto');
    };

    OziAudio.prototype.initFull = function () {
        this.$root.addClass('ozi-audio-full');
        this.buildShell();
        this.$box = this.appendTitleBox(this.$ui);

        this.buildPlayerControls();

        this.$status = $('<div>', {
            class: 'ozi-audio__status'
        }).text('Pronto');

        this.$box.find('.ozi-audio__meta').append(this.$status);

        if (this.showPreview) {
            this.$previewWrap = $('<div>', {
                class: 'ozi-audio__preview-wrap',
                hidden: true
            });

            this.$preview = $('<audio>', {
                class: 'ozi-audio__preview',
                controls: true
            });

            this.$previewWrap.append(this.$preview);
            this.$box.append(this.$previewWrap);
        }

        this.buildRecorderControls();

        if (this.saveUrl) {
            this.$save = $('<button>', {
                type: 'button',
                class: 'ozi-audio__save',
                'aria-label': 'Salvar áudio',
                disabled: true
            }).text('Salvar');

            this.$ui.append(this.$save);
        }

        this.bindPlayerEvents();
        this.bindRecorderEvents();
        this.updateTimeUI(0, 0);
        this.setRecorderStatus('Pronto');

        if (this.url) {
            this.setAudioSource(this.url, false);
        } else {
            this.syncPlayerAvailability(false);
        }
    };

    OziAudio.prototype.bindPlayerEvents = function () {
        var self = this;

        if (this.$play) {
            this.$play.on('click' + this.ns, function (e) {
                e.preventDefault();
                if (!self.audio) return;
                self.togglePlay();
            });
        }

        if (this.$timeline) {
            this.$timeline.on('click' + this.ns, function (e) {
                if (!self.audio) return;
                self.seekTo(e);
            });
        }

        if (this.showVolume && this.$volumeBar && this.$volumeBtn) {
            this.$volumeBar.on('click' + this.ns, function (e) {
                if (!self.audio) return;
                self.setVolumeFromEvent(e);
            });

            this.$volumeBtn.on('click' + this.ns, function (e) {
                e.preventDefault();
                if (!self.audio) return;
                self.toggleMute();
            });
        }

        if (this.showSpeed && this.$speed) {
            this.$speed.on('click' + this.ns, function (e) {
                e.preventDefault();
                if (!self.audio) return;
                self.toggleSpeed();
            });
        }
    };

    OziAudio.prototype.bindRecorderEvents = function () {
        var self = this;

        if (this.$record) {
            this.$record.on('click' + this.ns, function (e) {
                e.preventDefault();
                self.toggleRecord();
            });
        }

        if (this.$save) {
            this.$save.on('click' + this.ns, function (e) {
                e.preventDefault();
                self.saveRecording();
            });
        }
    };

    OziAudio.prototype.pauseOtherPlayerIfNeeded = function () {
        if (activePlayerInstance && activePlayerInstance !== this) {
            activePlayerInstance.pause();
        }

        activePlayerInstance = this;
    };

    OziAudio.prototype.togglePlay = function () {
        if (!this.audio) return;

        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    };

    OziAudio.prototype.play = function () {
        var self = this;

        if (!this.audio) return;

        this.pauseOtherPlayerIfNeeded();

        this.audio.play().then(function () {
            self.setPlayState(true);
            self.startPlayerLoop();
            self.emit('ozi:audio-play', {
                mode: self.mode,
                url: self.audio ? self.audio.src : ''
            });
        }).catch(function (error) {
            console.warn('oziAudio: erro ao reproduzir', error);
        });
    };

    OziAudio.prototype.pause = function () {
        if (!this.audio) return;

        this.audio.pause();
        this.setPlayState(false);
        this.stopPlayerLoop();

        this.emit('ozi:audio-pause', {
            mode: this.mode,
            url: this.audio ? this.audio.src : ''
        });
    };

    OziAudio.prototype.setPlayState = function (isPlaying) {
        if (!this.$play) return;

        this.$play.toggleClass('is-pause', !!isPlaying);
        this.$play.toggleClass('is-play', !isPlaying);
        this.$play.attr('aria-label', isPlaying ? 'Pausar' : 'Reproduzir');
    };

    OziAudio.prototype.handlePlayerLoadedMetadata = function () {
        if (!this.audio) return;
        this.updateTimeUI(this.audio.currentTime || 0, this.audio.duration || 0);
    };

    OziAudio.prototype.handlePlayerEnded = function () {
        if (!this.audio) return;

        this.pause();
        this.audio.currentTime = 0;
        this.updateProgressUI(0);
        this.updateTimeUI(0, this.audio.duration || 0);
    };

    OziAudio.prototype.startPlayerLoop = function () {
        var self = this;

        this.stopPlayerLoop();

        this.playerTimer = setInterval(function () {
            if (!self.audio) return;

            var current = self.audio.currentTime || 0;
            var duration = self.audio.duration || 0;
            var progress = duration > 0 ? (current / duration) * 100 : 0;

            self.updateProgressUI(progress);
            self.updateTimeUI(current, duration);
        }, 250);
    };

    OziAudio.prototype.stopPlayerLoop = function () {
        if (this.playerTimer) {
            clearInterval(this.playerTimer);
            this.playerTimer = null;
        }
    };

    OziAudio.prototype.updateProgressUI = function (percent) {
        if (!this.$progress || !this.$timeline) return;

        percent = isNaN(percent) ? 0 : percent;
        this.$progress.css('width', percent + '%');
        this.$timeline.attr('aria-valuenow', Math.round(percent));
    };

    OziAudio.prototype.updateTimeUI = function (current, duration) {
        if (this.$timeCurrent) {
            this.$timeCurrent.text(this.getTimeCodeFromNum(current));
        }

        if (this.$timeLength) {
            this.$timeLength.text(this.getTimeCodeFromNum(duration));
        }
    };

    OziAudio.prototype.seekTo = function (e) {
        if (!this.audio || !this.audio.duration || !this.$timeline) return;

        var width = this.$timeline.outerWidth();
        var offsetX = e.pageX - this.$timeline.offset().left;
        var ratio = Math.max(0, Math.min(1, offsetX / width));

        this.audio.currentTime = ratio * this.audio.duration;
        this.updateProgressUI(ratio * 100);
        this.updateTimeUI(this.audio.currentTime, this.audio.duration);
    };

    OziAudio.prototype.setVolumeFromEvent = function (e) {
        if (!this.audio || !this.$volumeBar) return;

        var width = this.$volumeBar.outerWidth();
        var offsetX = e.pageX - this.$volumeBar.offset().left;
        var ratio = Math.max(0, Math.min(1, offsetX / width));

        this.audio.volume = ratio;
        this.audio.muted = false;
        this.syncVolumeUI();
    };

    OziAudio.prototype.toggleMute = function () {
        if (!this.audio) return;

        this.audio.muted = !this.audio.muted;
        this.syncVolumeUI();
    };

    OziAudio.prototype.syncVolumeUI = function () {
        if (!this.showVolume || !this.$volumeFill || !this.$volumeBtn || !this.audio) return;

        var volume = this.audio.muted ? 0 : this.audio.volume;
        this.$volumeFill.css('width', (volume * 100) + '%');

        this.$volumeBtn.toggleClass('is-off', !!this.audio.muted);
        this.$volumeBtn.toggleClass('is-on', !this.audio.muted);
    };

    OziAudio.prototype.toggleSpeed = function () {
        if (!this.audio || !this.$speed) return;

        var current = this.audio.playbackRate || 1;
        var next = 1;

        if (current === 1) next = 1.25;
        else if (current === 1.25) next = 1.5;
        else if (current === 1.5) next = 1.75;
        else if (current === 1.75) next = 2;
        else if (current === 2) next = 0.75;

        this.audio.playbackRate = next;
        this.$speed.text(next + 'x');
    };

    OziAudio.prototype.toggleRecord = function () {
        if (this.isRecording) {
            this.stopRecording();
            return;
        }

        this.startRecording();
    };

    OziAudio.prototype.getPreferredRecorderMimeType = function () {
        if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') {
            return '';
        }

        var candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];

        for (var i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) {
                return candidates[i];
            }
        }

        return '';
    };

    OziAudio.prototype.startRecording = function () {
        var self = this;

        if (this.audio && !this.audio.paused) {
            this.pause();
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            this.setRecorderStatus('Microfone indisponível');
            this.emit('ozi:audio-record-error', {
                message: 'getUserMedia indisponível'
            });
            return;
        }

        if (!window.MediaRecorder) {
            this.setRecorderStatus('Gravação indisponível');
            this.emit('ozi:audio-record-error', {
                message: 'MediaRecorder indisponível'
            });
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            var mimeType = self.getPreferredRecorderMimeType();
            var config = mimeType ? { mimeType: mimeType } : {};

            self.cleanupRecorderMedia();
            self.mediaStream = stream;
            self.recordChunks = [];
            self.recordStartedAt = Date.now();
            self.recordDuration = 0;
            self.recordedBlob = null;
            self.recordedFile = null;
            self.recordedMimeType = mimeType || 'audio/webm';

            if (self.$save) {
                self.$save.prop('disabled', true);
            }

            self.mediaRecorder = new MediaRecorder(stream, config);

            self.mediaRecorder.addEventListener('dataavailable', function (event) {
                if (event.data && event.data.size > 0) {
                    self.recordChunks.push(event.data);
                }
            });

            self.mediaRecorder.addEventListener('stop', function () {
                self.handleRecorderStop();
            });

            self.mediaRecorder.start();
            self.isRecording = true;
            self.setRecordState(true);
            self.setRecorderStatus('Gravando...');
            self.startRecorderLoop();

            self.emit('ozi:audio-record-start', {
                mode: self.mode
            });
        }).catch(function (error) {
            self.setRecorderStatus('Permissão negada');
            self.emit('ozi:audio-record-error', {
                message: error && error.message ? error.message : 'Erro ao acessar microfone'
            });
        });
    };

    OziAudio.prototype.stopRecording = function () {
        if (!this.mediaRecorder || !this.isRecording) return;

        this.isRecording = false;
        this.stopRecorderLoop();
        this.setRecordState(false);
        this.setRecorderStatus('Processando...');

        try {
            this.mediaRecorder.stop();
        } catch (error) {
            this.setRecorderStatus('Erro ao parar');
            this.emit('ozi:audio-record-error', {
                message: error && error.message ? error.message : 'Erro ao parar gravação'
            });
            this.cleanupRecorderMedia();
        }
    };

    OziAudio.prototype.handleRecorderStop = function () {
        var mimeType = (this.mediaRecorder && this.mediaRecorder.mimeType) || this.recordedMimeType || 'audio/webm';
        var duration = (Date.now() - this.recordStartedAt) / 1000;
        var extension = this.guessExtension(mimeType);
        var filename = 'gravacao-' + this.uid + '-' + Date.now() + '.' + extension;
        var blob = new Blob(this.recordChunks, { type: mimeType });
        var file;

        try {
            file = new File([blob], filename, { type: mimeType });
        } catch (error) {
            file = blob;
            file.name = filename;
        }

        this.recordedBlob = blob;
        this.recordedFile = file;
        this.recordedMimeType = mimeType;
        this.recordDuration = Math.max(0, duration);

        if (this.showPreview && this.$preview && this.$previewWrap) {
            this.revokePreviewUrl();
            this.previewUrl = URL.createObjectURL(blob);
            this.$preview.attr('src', this.previewUrl);
            this.$previewWrap.prop('hidden', false);
        }

        if (this.mode === 'full') {
            this.attachRecordedAudioToPlayer(blob);
        }

        if (this.$save) {
            this.$save.prop('disabled', false);
        }

        this.setRecorderStatus('Pronto');
        this.updateRecorderTimeUI(this.recordDuration);
        this.cleanupRecorderMedia();

        this.emit('ozi:audio-recorded', {
            duration: parseFloat(this.recordDuration.toFixed(2)),
            mimeType: mimeType,
            size: file.size || blob.size || 0,
            file: file
        });
    };

    OziAudio.prototype.attachRecordedAudioToPlayer = function (blob) {
        if (!blob) return;

        var objectUrl = URL.createObjectURL(blob);
        this.setAudioSource(objectUrl, true);
    };

    OziAudio.prototype.startRecorderLoop = function () {
        var self = this;

        this.stopRecorderLoop();

        this.recordTimer = setInterval(function () {
            var seconds = (Date.now() - self.recordStartedAt) / 1000;
            self.updateRecorderTimeUI(seconds);
        }, 250);
    };

    OziAudio.prototype.stopRecorderLoop = function () {
        if (this.recordTimer) {
            clearInterval(this.recordTimer);
            this.recordTimer = null;
        }
    };

    OziAudio.prototype.updateRecorderTimeUI = function (seconds) {
        if (this.$timeCurrent) {
            this.$timeCurrent.text(this.getTimeCodeFromNum(seconds));
        }
    };

    OziAudio.prototype.setRecordState = function (isRecording) {
        if (!this.$record) return;

        this.$record.toggleClass('is-recording', !!isRecording);
        this.$record.toggleClass('is-idle', !isRecording);
        this.$record.attr('aria-label', isRecording ? 'Parar gravação' : 'Gravar');
    };

    OziAudio.prototype.setRecorderStatus = function (text) {
        if (this.$status) {
            this.$status.text(String(text || '').trim());
        }
    };

    OziAudio.prototype.guessExtension = function (mimeType) {
        var type = String(mimeType || '').toLowerCase();

        if (type.indexOf('ogg') !== -1) return 'ogg';
        if (type.indexOf('mp4') !== -1) return 'mp4';
        if (type.indexOf('mpeg') !== -1 || type.indexOf('mp3') !== -1) return 'mp3';

        return 'webm';
    };

    OziAudio.prototype.saveRecording = function () {
        var self = this;
        var sender = window.oziLoaddata || window.oziLoadData || (typeof oziLoaddata === 'function' ? oziLoaddata : null);

        if (!this.recordedFile) {
            this.setRecorderStatus('Sem gravação');
            return;
        }

        if (!this.saveUrl) {
            this.setRecorderStatus('Sem destino');
            return;
        }

        if (!sender) {
            this.setRecorderStatus('ZLD indisponível');
            return;
        }

        if (this.$save) {
            this.$save.prop('disabled', true);
        }

        this.setRecorderStatus('Enviando...');

        var payload = {
            zldUrl: this.saveUrl,
            zldMode: 'fetch',
            zldModeMethod: 'POST',
            zldExpectJson: true,
            zldApi: true,
            zldFiles: [
                {
                    name: this.saveField,
                    file: this.recordedFile,
                    filename: this.recordedFile.name || ('gravacao.' + this.guessExtension(this.recordedMimeType))
                }
            ],
            zldJson: [
                {
                    duration: parseFloat(this.recordDuration.toFixed(2)),
                    mimeType: this.recordedFile.type || this.recordedMimeType || '',
                    size: this.recordedFile.size || 0,
                    source: 'oziAudio'
                }
            ]
        };

        var result = sender(payload, null, this.$save ? this.$save[0] : this.$root[0]);

        if (result && typeof result.then === 'function') {
            result.then(function (response) {
                var ok = !!(response && response.ok === true);

                if (ok) {
                    self.setRecorderStatus('Salvo');
                    self.emit('ozi:audio-saved', {
                        response: response
                    });
                    return;
                }

                self.setRecorderStatus('Erro ao salvar');
                self.emit('ozi:audio-save-error', {
                    response: response
                });
            }).catch(function (error) {
                self.setRecorderStatus('Erro ao salvar');
                self.emit('ozi:audio-save-error', {
                    error: error
                });
            }).finally(function () {
                if (self.$save) {
                    self.$save.prop('disabled', false);
                }
            });

            return;
        }

        if (this.$save) {
            this.$save.prop('disabled', false);
        }
    };

    OziAudio.prototype.cleanupRecorderMedia = function () {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(function (track) {
                track.stop();
            });
            this.mediaStream = null;
        }

        this.mediaRecorder = null;
    };

    OziAudio.prototype.revokePreviewUrl = function () {
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = '';
        }
    };

    OziAudio.prototype.getTimeCodeFromNum = function (num) {
        if (!Number.isFinite(Number(num))) {
            return '0:00';
        }

        var seconds = parseInt(num, 10);
        var minutes = parseInt(seconds / 60, 10);
        seconds -= minutes * 60;
        var hours = parseInt(minutes / 60, 10);
        minutes -= hours * 60;

        if (hours === 0) {
            return minutes + ':' + String(seconds % 60).padStart(2, '0');
        }

        return String(hours).padStart(2, '0') + ':' + minutes + ':' + String(seconds % 60).padStart(2, '0');
    };

    OziAudio.prototype.destroy = function () {
        this.stopPlayerLoop();
        this.stopRecorderLoop();

        if (this.playerObjectUrl) {
            try {
                URL.revokeObjectURL(this.playerObjectUrl);
            } catch (error) {}
            this.playerObjectUrl = '';
        }

        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
            this.audio = null;
        }

        this.cleanupRecorderMedia();
        this.revokePreviewUrl();

        this.$root
            .removeData('ozi-audio-initialized')
            .removeClass('ozi-audio ozi-audio-player ozi-audio-recorder ozi-audio-full')
            .empty();

        if (activePlayerInstance === this) {
            activePlayerInstance = null;
        }

        delete instances[this.uid];
    };

    window.OziAudio = {
        init: function (selector) {
            var $elements = selector ? $(selector) : $('[data-ozi-audio]');
            var $targets = $elements.filter('[data-ozi-audio]').add($elements.find('[data-ozi-audio]'));

            $targets.each(function () {
                var $el = $(this);
                var id = String($el.attr('id') || '').trim();
                var existing = id ? instances[id] : null;

                if (existing) {
                    var sameElement = existing.$root && existing.$root[0] === this;
                    var oldStillInDom = existing.$root && document.contains(existing.$root[0]);

                    if (sameElement && $el.data('ozi-audio-initialized')) {
                        return;
                    }

                    if (!sameElement && !oldStillInDom) {
                        existing.destroy();
                    } else if (!sameElement && oldStillInDom) {
                        return;
                    }
                }

                var instance = new OziAudio(this);
                instances[instance.uid] = instance;
            });

            return this;
        },

        observe: function () {
            if (window.__oziAudioObserverInited) return;
            window.__oziAudioObserverInited = true;

            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
                        if (!node || node.nodeType !== 1) return;

                        var $node = $(node);

                        if ($node.is('[data-ozi-audio]')) {
                            window.OziAudio.init($node);
                            return;
                        }

                        var $children = $node.find('[data-ozi-audio]');
                        if ($children.length) {
                            window.OziAudio.init($node);
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            window.__oziAudioObserver = observer;
        },

        refresh: function (selector) {
            return this.init(selector);
        },

        get: function (selectorOrId) {
            if (!selectorOrId) return null;

            if (instances[selectorOrId]) {
                return instances[selectorOrId];
            }

            var $el = $(selectorOrId).first();
            if (!$el.length) return null;

            var id = String($el.attr('id') || '').trim();
            return instances[id] || null;
        },

        destroy: function (selectorOrId) {
            var instance = this.get(selectorOrId);
            if (!instance) return;
            instance.destroy();
        },

        play: function (selectorOrId) {
            var instance = this.get(selectorOrId);
            if (!instance) return;
            instance.play();
        },

        pause: function (selectorOrId) {
            var instance = this.get(selectorOrId);
            if (!instance) return;
            instance.pause();
        },

        record: function (selectorOrId) {
            var instance = this.get(selectorOrId);
            if (!instance) return;
            instance.startRecording();
        },

        stopRecord: function (selectorOrId) {
            var instance = this.get(selectorOrId);
            if (!instance) return;
            instance.stopRecording();
        },

        save: function (selectorOrId) {
            var instance = this.get(selectorOrId);
            if (!instance) return;
            instance.saveRecording();
        }
    };

    $(function () {
        window.OziAudio.init();
        window.OziAudio.observe();
    });
})(jQuery);