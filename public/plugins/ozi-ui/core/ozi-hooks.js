/**
 ------------------------------------------
 ozi-hooks
 ------------------------------------------
 Ver: 1.0.1
 2026-05-27


 *
 * Responsabilidade:
 *   - Prover sistema único de re-init pós-render dinâmico
 *   - Conectar automaticamente Livewire 3, Livewire 4 e DOMContentLoaded
 *   - Permitir registro de fontes externas (Inertia, Alpine, HTMX, etc.)
 *   - Garantir FIFO, deduplicação por ID e execução segura
 *
 * NAO faz:
 *   - Nao inicializa plugins diretamente
 *   - Nao depende de jQuery
 *   - Nao detecta quais plugins estao carregados
 *
 * Dependencias: ozi-conf.js (para log)
 * Consumido por: ozi.js (window.OziHooks)
 * Usado por: todos os plugins via OZI.hooks.afterRender.register()
 *
 * Changelog v1.0.1:
 *   - Corrigido: Livewire 4 — removido hook 'morph.updated' (nao existe no LW4)
 *     Eventos corretos mantidos: livewire:navigated, livewire:initialized
 *   - Corrigido: compat-zld refatorado — hook registrado diretamente no canal,
 *     sem passar pela abstracao de registerSource (evitava dependencia circular)
 *   - Corrigido: _log movido para o topo do arquivo — estava sendo chamado
 *     durante construcao do modulo antes de ser declarado (ordem confusa)
 *   - Mantido: estrutura createHookChannel, afterRender, beforeRender
 *   - Mantido: fontes dom, livewire3, livewire4
 *   - Mantido: API window.OziHooks intacta
 */

(function (window, document) {
    'use strict';

    // guard — singleton
    if (window.OziHooks) return;

    // ---------------------------------------------
    // [1] LOG INTERNO
    // Movido para o topo — e chamado durante a construcao
    // do modulo (registerSource, register) antes do OZI existir.
    // _log e seguro: window.OZI pode nao existir ainda.
    // ---------------------------------------------

    function _log(level, msg) {
        var conf   = window.OZI && window.OZI.conf;
        var active = conf && conf.core && conf.core.log;
        if (!active && level === 'info') return;
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift('[OZI:hooks]');
        if (level === 'warn')  console.warn.apply(console, args);
        if (level === 'error') console.error.apply(console, args);
        if (level === 'info')  console.log.apply(console, args);
    }


    // ---------------------------------------------
    // [2] FABRICA DE HOOK CHANNEL
    // Cria um canal independente (afterRender ou beforeRender).
    // Ambos tem a mesma estrutura e API.
    // ---------------------------------------------

    function createHookChannel(channelName) {

        // registry: { id: fn } — FIFO garantido por ordem de insercao
        var _registry  = {};
        // fontes externas registradas: { name: connectFn }
        var _sources   = {};
        // controle de quais fontes ja foram conectadas
        var _connected = {};

        var channel = {

            // -----------------------------------------
            // register(id, fn)
            // Registra uma funcao no canal.
            // Deduplicacao automatica por ID.
            //
            // @param {string}   id — identificador unico (ex: 'component:select')
            // @param {function} fn — fn(root, ctx) chamada apos render
            // -----------------------------------------
            register: function (id, fn) {
                if (typeof id !== 'string' || !id) {
                    _log('warn', channelName + '.register(): id obrigatorio.');
                    return;
                }
                if (typeof fn !== 'function') {
                    _log('warn', channelName + '.register("' + id + '"): fn deve ser function.');
                    return;
                }
                if (_registry[id]) {
                    _log('info', channelName + '.register(): "' + id + '" ja registrado — ignorando duplicata.');
                    return;
                }

                _registry[id] = fn;
                _log('info', channelName + '.register(): "' + id + '" registrado.');
            },

            // -----------------------------------------
            // unregister(id)
            // Remove uma funcao do canal pelo ID.
            // -----------------------------------------
            unregister: function (id) {
                if (_registry[id]) {
                    delete _registry[id];
                    _log('info', channelName + '.unregister(): "' + id + '" removido.');
                }
            },

            // -----------------------------------------
            // run(root?, ctx?)
            // Executa todas as funcoes registradas.
            // Ordem FIFO por registro.
            // Execucao segura — erro em uma nao para as outras.
            //
            // @param {Element|null} root — escopo do render (null = documento inteiro)
            // @param {object}       ctx  — contexto adicional (ex: componente Livewire)
            // -----------------------------------------
            run: function (root, ctx) {
                var ids = Object.keys(_registry);
                _log('info', channelName + '.run() — ' + ids.length + ' hooks, root:', root || 'document');

                ids.forEach(function (id) {
                    try {
                        _registry[id](root || document, ctx || {});
                    } catch (err) {
                        _log('warn', channelName + '.run(): erro em "' + id + '":', err);
                    }
                });
            },

            // -----------------------------------------
            // getRegistered()
            // Retorna lista de IDs registrados.
            // Util para debug.
            // -----------------------------------------
            getRegistered: function () {
                return Object.keys(_registry);
            },

            // -----------------------------------------
            // registerSource(name, connectFn)
            // Registra uma fonte externa de eventos.
            // connectFn recebe o canal e conecta seus eventos.
            //
            // @param {string}   name      — ex: 'livewire3', 'inertia'
            // @param {function} connectFn — fn(channel) — conecta a fonte ao canal
            // -----------------------------------------
            registerSource: function (name, connectFn) {
                if (_sources[name]) {
                    _log('warn', channelName + '.registerSource(): "' + name + '" ja registrado.');
                    return;
                }
                _sources[name] = connectFn;
                _log('info', channelName + '.registerSource(): "' + name + '" registrado.');
            },

            // -----------------------------------------
            // _connectSources()
            // Conecta todas as fontes registradas.
            // Chamado pelo boot do core.
            // Idempotente — nao reconecta fontes ja ativas.
            // -----------------------------------------
            _connectSources: function () {
                Object.keys(_sources).forEach(function (name) {
                    if (_connected[name]) return;
                    try {
                        _sources[name](channel);
                        _connected[name] = true;
                        _log('info', channelName + ': fonte "' + name + '" conectada.');
                    } catch (err) {
                        _log('warn', channelName + ': erro ao conectar fonte "' + name + '":', err);
                    }
                });
            }
        };

        return channel;
    }


    // ---------------------------------------------
    // [3] CANAIS
    // afterRender  — re-init pos render dinamico (principal)
    // beforeRender — cleanup pre render (uso avancado)
    // ---------------------------------------------

    var afterRender  = createHookChannel('OZI.hooks.afterRender');
    var beforeRender = createHookChannel('OZI.hooks.beforeRender');


    // ---------------------------------------------
    // [4] FONTES NATIVAS
    // Registradas aqui, conectadas no boot via _connectSources().
    // ---------------------------------------------

    // — Fonte: DOMContentLoaded —
    // Garante execucao mesmo sem Livewire.
    afterRender.registerSource('dom', function (channel) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                channel.run(document, { source: 'dom' });
            });
        } else {
            // DOM ja pronto
            channel.run(document, { source: 'dom' });
        }
    });

    // — Fonte: Livewire 3 —
    // hook 'commit' dispara apos cada update de componente.
    afterRender.registerSource('livewire3', function (channel) {
        if (typeof window.Livewire === 'undefined') return;
        if (typeof window.Livewire.hook !== 'function') return;

        try {
            window.Livewire.hook('commit', function (component, succeed) {
                succeed(function () {
                    var el = component && component.el ? component.el : null;
                    channel.run(el, { source: 'livewire3', component: component });
                });
            });
        } catch (e) {
            // nao e Livewire 3 — silencioso
        }
    });

    // — Fonte: Livewire 4 —
    // Usa eventos de documento: livewire:navigated e livewire:initialized.
    // Corrigido v1.0.1: removido hook 'morph.updated' — nao existe no Livewire 4.
    afterRender.registerSource('livewire4', function (channel) {
        if (typeof window.Livewire === 'undefined') return;

        try {
            document.addEventListener('livewire:navigated', function () {
                channel.run(document, { source: 'livewire4', event: 'navigated' });
            });

            document.addEventListener('livewire:initialized', function () {
                channel.run(document, { source: 'livewire4', event: 'initialized' });
            });
        } catch (e) {
            // nao e Livewire 4 — silencioso
        }
    });

    // beforeRender: fonte Livewire 3 para cleanup
    beforeRender.registerSource('livewire3', function (channel) {
        if (typeof window.Livewire === 'undefined') return;
        if (typeof window.Livewire.hook !== 'function') return;

        try {
            window.Livewire.hook('commit', function (component) {
                var el = component && component.el ? component.el : null;
                channel.run(el, { source: 'livewire3', component: component });
            });
        } catch (e) {
            // silencioso
        }
    });


    // ---------------------------------------------
    // [5] COMPAT ZLD — REMOVIDO v1.0.2
    // O hook 'compat:zld-hooks' propagava OZI.hooks.afterRender de volta
    // para zldConf.zldHooks.afterRender, criando loop com a ponte
    // _bridgeHooks do ozi.js (zldConf -> OZI.hooks -> zldConf -> ...).
    // A propagacao correta e unidirecional: zldConf -> OZI.hooks.
    // A ponte _bridgeHooks do ozi.js ja garante isso com flag de reentrada.
    // ---------------------------------------------


    // ---------------------------------------------
    // [6] API INTERNA — window.OziHooks
    // Contrato entre ozi-hooks.js e ozi.js.
    // NAO e API publica para o dev.
    // ---------------------------------------------

    window.OziHooks = {

        afterRender:  afterRender,
        beforeRender: beforeRender,

        /**
         * _boot()
         * Chamado pelo ozi.js durante o bootstrap.
         * Conecta todas as fontes nativas registradas.
         */
        _boot: function () {
            afterRender._connectSources();
            beforeRender._connectSources();
            _log('info', 'hooks conectados.');
        }
    };

})(window, document);