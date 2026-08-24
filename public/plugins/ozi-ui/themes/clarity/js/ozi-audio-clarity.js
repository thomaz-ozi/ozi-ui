/**
 * themes/clarity/js/ozi-audio-clarity.js
 * Versão: 1.0.0
 *
 * Comportamento do skin "clarity" para o ozi-audio nos modos `recorder` e `full`.
 * Transporte estilo mensageiro: Pausar/Continuar, lixeira (descarta) e Concluir
 * (para + envia num clique, sem revisão).
 *
 * PRINCÍPIO (aditivo, base intocada além da API 4.3): o clarity NÃO edita o
 * ozi-audio.js. Ele constrói a PRÓPRIA UI e dirige o motor pela API pública
 * `OziAudio.{record,stopRecord,save,recordPause,recordResume,get}` + escuta os
 * eventos `ozi:audio-*` (que sobem no root). Os botões nativos ficam escondidos.
 *
 * API pública:
 *   OziAudioClarity.scan(scope)          — decora todos os recorder/full do escopo
 *   OziAudioClarity.decorate(el)         — decora um elemento
 *   OziAudioClarity.showSaved(el, take)  — mostra o layout salvo (player|combo)
 *   OziAudioClarity.clearSaved(el)       — volta ao ocioso
 *
 * Estados: idle · recording · paused · saved.
 * `data-ozi-audio-saved` (player|combo) escolhe a aparência pós-conclusão
 * (ausente = player). O medidor é decorativo (nível real via AnalyserNode fica
 * como melhoria futura).
 *
 * DEPENDE: ozi-audio.js >= 4.3.0 (recordPause/recordResume).
 */

(function (window, document) {
    'use strict';

    function api() { return window.OziAudio || null; }

    function t(key, fb) {
        var lang = window.OZI && window.OZI.lang;
        var v = lang && typeof lang.t === 'function' ? lang.t(key) : '';
        return (v && v !== key) ? v : fb;
    }

    function _el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }
    function _hide(el) { if (el) el.style.display = 'none'; }
    function _show(el, disp) { if (el) el.style.display = disp || ''; }

    // marca o <html> para o CSS do clarity vencer a base (ver overrides/tokens/dark).
    // Idempotente e preserva outros skins já presentes. Chamado o quanto antes.
    function ensureSkinMarker() {
        var el = document.documentElement;
        if (!el) return;
        var cur = (el.getAttribute('data-ozi-skin') || '').split(/\s+/).filter(Boolean);
        if (cur.indexOf('clarity') === -1) { cur.push('clarity'); el.setAttribute('data-ozi-skin', cur.join(' ')); }
    }
    ensureSkinMarker();

    var ICONS = {
        pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
        play:  '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
        trash: '<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13a2 2 0 01-2 2H9a2 2 0 01-2-2L6 7zm3-3h6l1 2h4v2H4V6h4l1-2z"/></svg>',
        mic:   '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-3.1A7 7 0 0019 11h-2z"/></svg>',
        check: '<svg viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z"/></svg>'
    };
    var METER_BARS = 9;

    var _ctrls = {};   // uid -> Ctrl

    /* ─────────────────────────────────────────────
     * Controller
     * ───────────────────────────────────────────── */

    function Ctrl(root) {
        this.root    = root;
        this.mode    = String(root.getAttribute('data-ozi-audio') || '').toLowerCase();
        this.inst    = null;
        this.state   = 'idle';
        this._pending = null;      // 'conclude' | 'discard'
        this._timer  = null;
        this._t0     = 0;          // referência do cronômetro do clarity
        this._elapsed = 0;         // segundos acumulados (congela na pausa)
    }

    Ctrl.prototype.id = function () { return this.root.id; };

    Ctrl.prototype.build = function () {
        var A = api();
        this.inst = A ? A.get(this.root) : null;
        this.root.classList.add('ozi-clarity');
        this._buildShared();
        if (this.mode === 'recorder') this._buildRecorder();
        else                          this._buildFull();
        this._bindEvents();
        this._setState('idle');
    };

    /* — controles comuns aos dois modos — */
    Ctrl.prototype._buildShared = function () {
        var self = this;

        // Pausar / Continuar (azul)
        this.pauseCtrl  = _el('div', 'ozi-audio__clarity-ctrl');
        this.pauseBtn   = _el('button', 'ozi-audio__clarity-pause', ICONS.pause);
        this.pauseBtn.type = 'button';
        this.pauseLabel = _el('span', 'ozi-audio__clarity-label', t('audio.pause', 'Pausar'));
        this.pauseCtrl.appendChild(this.pauseBtn);
        this.pauseCtrl.appendChild(this.pauseLabel);
        this.pauseBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var A = api(); if (!A) return;
            if (self.state === 'paused') A.recordResume(self.id());
            else if (self.state === 'recording') A.recordPause(self.id());
        });

        // Lixeira (descarta)
        this.discardBtn = _el('button', 'ozi-audio__clarity-discard', ICONS.trash);
        this.discardBtn.type = 'button';
        this.discardBtn.setAttribute('aria-label', t('audio.discard', 'Descartar'));
        this.discardBtn.addEventListener('click', function (e) {
            e.preventDefault();
            self._pending = 'discard';
            var A = api(); if (A) A.stopRecord(self.id());
        });

        // Concluir (verde) — reusa o estilo .ozi-audio__save
        this.concludeCtrl  = _el('div', 'ozi-audio__clarity-ctrl');
        this.concludeBtn   = _el('button', 'ozi-audio__save', ICONS.check);
        this.concludeBtn.type = 'button';
        this.concludeLabel = _el('span', 'ozi-audio__clarity-label', t('audio.conclude', 'Concluir'));
        this.concludeCtrl.appendChild(this.concludeBtn);
        this.concludeCtrl.appendChild(this.concludeLabel);
        this.concludeBtn.addEventListener('click', function (e) {
            e.preventDefault();
            self._pending = 'conclude';
            var A = api(); if (!A) return;
            if (self.state === 'recording' || self.state === 'paused') A.stopRecord(self.id());
        });
    };

    /* — RECORDER: mic (ocioso) + barra própria (grava/pausa) — */
    Ctrl.prototype._buildRecorder = function () {
        var self = this;
        _hide(this.inst && this.inst.ui);          // some com o layout nativo

        // microfone (ocioso)
        this.mic = _el('button', 'ozi-audio__clarity-mic', ICONS.mic);
        this.mic.type = 'button';
        this.mic.setAttribute('aria-label', t('audio.record', 'Gravar'));
        this.mic.addEventListener('click', function (e) {
            e.preventDefault();
            var A = api(); if (A) A.record(self.id());
        });

        // barra (grava/pausa)
        this.timer = _el('span', 'ozi-audio__clarity-timer', '0:00');
        this.badge = _el('span', 'ozi-audio__clarity-state is-recording', t('audio.recording', 'Gravando…'));
        this.meter = _el('div', 'ozi-audio__clarity-meter');
        for (var i = 0; i < METER_BARS; i++) this.meter.appendChild(_el('span'));

        this.bar = _el('div', 'ozi-audio__clarity-bar');
        this.bar.appendChild(this.pauseCtrl);
        this.bar.appendChild(this.timer);
        this.bar.appendChild(this.badge);
        this.bar.appendChild(this.meter);
        this.bar.appendChild(this.discardBtn);
        this.bar.appendChild(this.concludeCtrl);

        this.savedWrap = _el('div', 'ozi-audio__clarity-saved');  // usado no showSaved

        this.root.appendChild(this.mic);
        this.root.appendChild(this.bar);
        this.root.appendChild(this.savedWrap);
    };

    /* — FULL: mantém o player nativo + gravar/concluir/pausa/lixeira — */
    Ctrl.prototype._buildFull = function () {
        var self = this;
        var main = this.inst && this.inst.ui;
        // esconde os botões nativos de gravar/salvar (o clarity põe os seus) e o
        // status nativo ("Pronto/Gravando...") — no full o feedback é timer+Pausar;
        // o status colidia com o rótulo do Gravar.
        _hide(this.inst && this.inst.record);
        _hide(this.inst && this.inst.save);
        _hide(this.inst && this.inst.status);

        // Gravar (vermelho) com rótulo
        this.recCtrl = _el('div', 'ozi-audio__clarity-ctrl');
        this.recBtn  = _el('button', 'ozi-audio__clarity-rec', ICONS.mic);
        this.recBtn.type = 'button';
        this.recLabel = _el('span', 'ozi-audio__clarity-label', t('audio.record', 'Gravar'));
        this.recCtrl.appendChild(this.recBtn);
        this.recCtrl.appendChild(this.recLabel);
        this.recBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var A = api(); if (A) A.record(self.id());
        });

        // insere na linha do player: [pausa(oculta)] play ... [lixeira(oculta)] [gravar] [concluir]
        if (main) {
            main.insertBefore(this.pauseCtrl, main.firstChild);
            main.appendChild(this.discardBtn);
            main.appendChild(this.recCtrl);
            main.appendChild(this.concludeCtrl);
        }
    };

    /* — eventos do motor (sobem no root) — */
    Ctrl.prototype._bindEvents = function () {
        var self = this;
        var on = function (name, fn) { self.root.addEventListener(name, fn); };
        on('ozi:audio-record-start',  function () { self._setState('recording'); });
        on('ozi:audio-record-pause',  function () { self._setState('paused'); });
        on('ozi:audio-record-resume', function () { self._setState('recording'); });
        on('ozi:audio-recorded',      function () { self._onRecorded(); });
        on('ozi:audio-saved',         function () { self._onSaved(); });
        on('ozi:audio-save-error',    function () { self._pending = null; self._setState('recording'); self._setStatus(t('audio.saveError', 'Erro ao salvar')); });
    };

    Ctrl.prototype._onRecorded = function () {
        var A = api();
        if (this._pending === 'conclude') {
            this._pending = null;
            if (A) A.save(this.id());            // para+envia num clique
        } else if (this._pending === 'discard') {
            this._pending = null;
            this._setState('idle');               // descarta: volta ao mic
        }
        // parada "manual" sem pending: mantém no estado atual (sem revisão no clarity)
    };

    Ctrl.prototype._onSaved = function () {
        var take = null;
        try {
            var blob = this.inst && this.inst.recordedBlob;
            take = { url: blob ? URL.createObjectURL(blob) : (this.inst && this.inst.audio ? this.inst.audio.src : ''),
                     title: (this.inst && this.inst.title) || t('audio.recording', 'Gravação') };
        } catch (e) { take = { url: '', title: '' }; }
        showSaved(this.root, take);
    };

    /* — máquina de estados (visibilidade + rótulos + timer + medidor) — */
    Ctrl.prototype._setState = function (s) {
        this.state = s;
        var recording = (s === 'recording');
        var paused    = (s === 'paused');
        var active    = recording || paused;

        this.root.classList.toggle('is-recording', recording);
        this.root.classList.toggle('is-paused', paused);

        // pausa: ícone + rótulo (Pausar <-> Continuar)
        if (this.pauseBtn)  this.pauseBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
        if (this.pauseLabel) this.pauseLabel.textContent = paused ? t('audio.resume', 'Continuar') : t('audio.pause', 'Pausar');

        // badge (recorder)
        if (this.badge) {
            this.badge.className = 'ozi-audio__clarity-state ' + (paused ? 'is-paused' : 'is-recording');
            this.badge.textContent = paused ? t('audio.paused', 'Pausado') : t('audio.recording', 'Gravando…');
        }

        if (this.mode === 'recorder') this._layoutRecorder(s);
        else                          this._layoutFull(s);

        // cronômetro + medidor
        if (recording)      { this._startTimer(); this._runMeter(true); }
        else if (paused)    { this._stopTimer();  this._runMeter(false); }
        else                { this._stopTimer();  this._runMeter(false); this._elapsed = 0; if (this.timer) this.timer.textContent = '0:00'; }
    };

    Ctrl.prototype._layoutRecorder = function (s) {
        var active = (s === 'recording' || s === 'paused');
        var saved  = (s === 'saved');
        _show(this.mic, (s === 'idle') ? 'inline-flex' : 'none');
        _show(this.bar, active ? 'flex' : 'none');
        _show(this.savedWrap, saved ? 'inline-flex' : 'none');
        // ao voltar pro idle, esvazia o layout salvo
        if (s === 'idle' && this.savedWrap) this.savedWrap.innerHTML = '';
        this.root.classList.toggle('is-empty', !saved);   // idle/gravando = "recolhido"; salvo revela
    };

    Ctrl.prototype._layoutFull = function (s) {
        var active = (s === 'recording' || s === 'paused');
        // durante gravação: esconde o play nativo, mostra Pausar + lixeira; Gravar apaga
        _show(this.inst && this.inst.play, active ? 'none' : '');
        _show(this.pauseCtrl, active ? 'flex' : 'none');
        _show(this.discardBtn, active ? 'inline-flex' : 'none');
        if (this.recBtn) this.recBtn.disabled = active;           // Gravar: vivo no ocioso, apaga ao gravar
        if (this.concludeBtn) this.concludeBtn.disabled = !active; // Concluir: apagado no ocioso, acende ao gravar
    };

    /* — cronômetro do clarity (reusa recordStartedAt da base, já compensado no resume) — */
    Ctrl.prototype._startTimer = function () {
        var self = this;
        this._stopTimer();
        this._tick();
        this._timer = setInterval(function () { self._tick(); }, 250);
    };
    Ctrl.prototype._stopTimer = function () {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    };
    Ctrl.prototype._tick = function () {
        if (!this.inst || !this.inst.recordStartedAt) return;
        var secs = (Date.now() - this.inst.recordStartedAt) / 1000;
        var m = Math.floor(secs / 60), sc = Math.floor(secs % 60);
        var txt = m + ':' + (sc < 10 ? '0' + sc : sc);
        if (this.timer) this.timer.textContent = txt;
    };

    /* — medidor decorativo — */
    Ctrl.prototype._runMeter = function (animate) {
        if (!this.meter) return;
        var bars = this.meter.children, i;
        if (this._meterInt) { clearInterval(this._meterInt); this._meterInt = null; }
        if (animate) {
            var self = this;
            this._meterInt = setInterval(function () {
                for (i = 0; i < bars.length; i++) {
                    bars[i].style.height = (25 + Math.round(Math.random() * 75)) + '%';
                }
            }, 140);
        } else {
            for (i = 0; i < bars.length; i++) bars[i].style.height = '40%';
        }
    };

    Ctrl.prototype._setStatus = function (txt) {
        if (this.inst && typeof this.inst._setStatus === 'function') this.inst._setStatus(txt);
    };

    /* ─────────────────────────────────────────────
     * showSaved / clearSaved
     * ───────────────────────────────────────────── */

    function _makeTakePlayer(take, title) {
        var el = _el('div');
        el.setAttribute('data-ozi-audio', 'player');
        if (take && take.url) el.setAttribute('data-ozi-audio-url', take.url);
        el.setAttribute('data-ozi-audio-title', (take && take.title) || title || '');
        return el;
    }

    function showSaved(root, take) {
        var c = _ctrls[root.id];
        var A = api();
        var kind = String(root.getAttribute('data-ozi-audio-saved') || 'player').toLowerCase();

        if (c && c.mode === 'recorder') {
            // padrão: mic ocioso (nova gravação) + player do take ao lado (lista)
            // combo: player do take + Gravar(vermelho) num card só
            c._setState('saved');          // limpa is-recording/is-paused, para timer/medidor
            var wrap = c.savedWrap;
            wrap.innerHTML = '';

            var player = _makeTakePlayer(take);
            if (kind === 'combo') {
                wrap.appendChild(player);
                if (A) A.init(player);
                // Gravar(vermelho) dentro do card do player
                var rc = _el('div', 'ozi-audio__clarity-ctrl');
                var rb = _el('button', 'ozi-audio__clarity-rec', ICONS.mic); rb.type = 'button';
                rc.appendChild(rb);
                rc.appendChild(_el('span', 'ozi-audio__clarity-label', t('audio.record', 'Gravar')));
                var main = player.querySelector('.ozi-audio__main');
                if (main) main.appendChild(rc);
                rb.addEventListener('click', function (e) { e.preventDefault(); clearSaved(root); if (A) A.record(root.id); });
            } else {
                // padrão: mic ocioso + player lado a lado
                var mic = _el('button', 'ozi-audio__clarity-mic', ICONS.mic); mic.type = 'button';
                mic.addEventListener('click', function (e) { e.preventDefault(); clearSaved(root); if (A) A.record(root.id); });
                wrap.appendChild(mic);
                wrap.appendChild(player);
                if (A) A.init(player);
            }
            return;
        }

        // full: o próprio card já é player+gravador; volta pro idle pronto p/ ouvir/gravar de novo
        if (c) c._setState('idle');
    }

    function clearSaved(root) {
        var c = _ctrls[root.id];
        if (!c) return;
        if (c.savedWrap) c.savedWrap.innerHTML = '';
        c._setState('idle');
    }

    /* ─────────────────────────────────────────────
     * decorate / scan / boot
     * ───────────────────────────────────────────── */

    function decorate(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.__clarityDecorated) return;
        var mode = String(el.getAttribute('data-ozi-audio') || '').toLowerCase();
        if (mode !== 'recorder' && mode !== 'full') return;   // player = só skin CSS
        var A = api();
        if (!A) { console.warn('[OZI:clarity] OziAudio não encontrado; carregue ozi-audio.js antes.'); return; }
        // a instância do ozi-audio precisa existir (init do plugin já rodou);
        // se ainda não, NÃO marca — um scan posterior (OZI.ready/afterRender) decora.
        if (!A.get(el)) return;
        el.__clarityDecorated = true;
        var c = new Ctrl(el);
        _ctrls[el.id || (el.id = 'ozi-audio-clarity-' + Date.now())] = c;
        c.build();
    }

    function scan(scope) {
        var root = scope || document;
        var list = root.querySelectorAll('[data-ozi-audio="recorder"],[data-ozi-audio="full"]');
        Array.prototype.forEach.call(list, decorate);
    }

    window.OziAudioClarity = {
        scan:      scan,
        decorate:  decorate,
        showSaved: showSaved,
        clearSaved: clearSaved
    };

    // auto-scan + integração com o ciclo de render do OZI (se presente)
    function boot() {
        scan(document);
        var OZI = window.OZI;
        if (OZI && OZI.hooks && OZI.hooks.afterRender && typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('skin:clarity-audio', function (root) { scan(root || document); });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

})(window, document);
