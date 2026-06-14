/**

 *  ------------------------------------------
 *  ozi-conf
 *  ------------------------------------------
 *  Ver: 2.0.3
 *  2026-05-27
 *
 * Responsabilidade:
 *   - Define todos os valores default do OZI-UI
 *   - Recebe e aplica customizações via oziConf()
 *   - Resolve mapa de plugins (nome → arquivos JS/CSS/lang)
 *   - Resolve presets de tema (classMap por framework)
 *
 * Expõe: window.OziConf
 *
 * NÃO depende de nenhum outro subsistema OZI.
 * Deve ser carregado ANTES de todos os outros.
 */

(function (window) {
    'use strict';

    /* ─────────────────────────────────────────────
     * [1] DEFAULTS GLOBAIS
     * ───────────────────────────────────────────── */

    var _defaults = {
        theme:       'default',   // 'default' | 'bootstrap5' | 'tailwind' | 'custom'
        themeMode:   'auto',      // 'light'   | 'dark'       | 'auto'
        lang:        'en',        // 'en' | 'pt-BR' | qualquer locale registrado
        fallbackLang:'en',

        plugins: 'all',           // 'all' | ['loaddata', 'select', ...]

        core: {
            urlBase:  './plugins/ozi-ui/',
            log:      false,
            failFast: false
        },

        // configurações por plugin — sobrescritas via oziConf({ plugins: { select: {} } })
        pluginConf: {
            loaddata: {
                progressBarGlobalClass: 'ozi-progress',
                interactiveValidation:  true
            },
            select: {
                imageDimension: '24px',
                autoObserve:    false
            },
            autocomplete: {
                autoObserve: false
            },
            editor: {
                uicolor: 'var(--ozi-color-primary)'
            },
            audio: {
                autoObserve: false
            },
            auth: {
                passMin:       12,
                passMax:       64,
                userCaracter:  4
            }
        },

        // classMap — tokens semânticos → classes do framework UI
        // preenchido pelo preset do tema escolhido
        classMap: {}
    };

    /* ─────────────────────────────────────────────
     * [2] PRESETS DE TEMA
     * classMap por framework UI
     * ───────────────────────────────────────────── */

    var _presets = {

        'default': {
            invalid:       'ozi-invalid',
            valid:         'ozi-valid',
            formValidated: 'ozi-validated',
            feedback:      'ozi-feedback',
            button:        'ozi-btn',
            disabled:      'ozi-disabled'
        },

        'bootstrap5': {
            invalid:       'is-invalid',
            valid:         'is-valid',
            formValidated: 'was-validated',
            feedback:      'invalid-feedback',
            button:        'btn btn-primary',
            disabled:      'disabled'
        },

        'tailwind': {
            invalid:       'border-red-500 text-red-600',
            valid:         'border-green-500 text-green-600',
            formValidated: 'ozi-validated',
            feedback:      'text-red-500 text-sm mt-1',
            button:        'px-4 py-2 bg-blue-600 text-white rounded',
            disabled:      'opacity-50 cursor-not-allowed'
        }
    };

    /* ─────────────────────────────────────────────
     * [3] MAPA DE PLUGINS
     *
     * Define para cada plugin:
     *   - deps:  plugins que devem ser carregados antes
     *   - js:    caminho do script principal
     *   - css:   caminho do CSS (null = sem CSS)
     *   - lang:  caminho do arquivo de lang ({lang} = substituído pelo locale)
     *
     * Caminhos relativos ao urlBase.
     * ───────────────────────────────────────────── */

    var _pluginMap = {

        // ── modules ────────────────────────────────

        'validate': {
            deps: [],
            js:   'modules/ozi-validate/js/ozi-validate.js',
            css:  null,
            lang: null
        },

        'actions': {
            deps: [],
            js:   'modules/ozi-actions/js/ozi-actions.js',
            css:  null,
            lang: null
        },

        'suggest': {
            deps: [],
            js:   'modules/ozi-suggest/js/ozi-suggest.js',
            css:  null,
            lang: null
        },

        'password-rules': {
            deps: [],
            js:   'modules/ozi-password-rules/js/ozi-password-rules.js',
            css:  null,
            lang: null
        },

        'loaddata': {
            deps: ['validate', 'actions'],
            js:   'modules/ozi-loaddata/js/ozi-loaddata.js',
            css:  'modules/ozi-loaddata/css/ozi-loaddata.css',
            lang: 'modules/ozi-loaddata/lang/{lang}.js'
        },

        // ── components ─────────────────────────────

        'select': {
            deps: ['loaddata', 'suggest', 'validate'],
            js:   'components/ozi-select/js/ozi-select.js',
            css:  'components/ozi-select/css/ozi-select.css',
            lang: 'components/ozi-select/lang/{lang}.js'
        },

        'autocomplete': {
            deps: ['loaddata', 'suggest', 'validate'],
            js:   'components/ozi-autocomplete/js/ozi-autocomplete.js',
            css:  'components/ozi-autocomplete/css/ozi-autocomplete.css',
            lang: 'components/ozi-autocomplete/lang/{lang}.js'
        },

        'editor': {
            deps: ['validate'],
            js:   'components/ozi-editor/js/ozi-editor.js',
            css:  'components/ozi-editor/css/ozi-editor.css',
            lang: 'components/ozi-editor/lang/{lang}.js'
        },

        'editor-md': {
            deps: ['editor'],
            js:   'components/ozi-editor/js/ozi-editor-md.js',
            css:  null,
            lang: null
        },

        'audio': {
            deps: ['loaddata'],
            js:   'components/ozi-audio/js/ozi-audio.js',
            css:  'components/ozi-audio/css/ozi-audio.css',
            lang: 'components/ozi-audio/lang/{lang}.js'
        },

        'auth': {
            deps: ['password-rules'],
            js:   'components/ozi-auth/js/ozi-auth.js',
            css:  'components/ozi-auth/css/ozi-auth.css',
            lang: 'components/ozi-auth/lang/{lang}.js'
        },

        'check': {
            deps: [],
            js:   'components/ozi-check/js/ozi-check.js',
            css:  'components/ozi-check/css/ozi-check.css',
            lang: null
        },

        'search': {
            deps: [],
            js:   'components/ozi-search/js/ozi-search.js',
            css:  'components/ozi-search/css/ozi-search.css',
            lang: 'components/ozi-search/lang/{lang}.js'
        },

        // ── behaviors ──────────────────────────────

        'copy': {
            deps: [],
            js:   'behaviors/ozi-copy/js/ozi-copy.js',
            css:  'behaviors/ozi-copy/css/ozi-copy.css',
            lang: 'behaviors/ozi-copy/lang/{lang}.js'
        },
        'paste': {
            deps: [],
            js:   'behaviors/ozi-paste/js/ozi-paste.js',
            css:  'behaviors/ozi-paste/css/ozi-paste.css',
            lang: 'behaviors/ozi-paste/lang/{lang}.js'
        },
        'toggle': {
            deps: [],
            js:   'behaviors/ozi-toggle/js/ozi-toggle.js',
            css:  'behaviors/ozi-toggle/css/ozi-toggle.css',
            lang: null
        },

        // ── integrations ───────────────────────────

        'select-plugin': {
            deps: ['select'],
            js:   'integrations/plugins/ozi-select.plugin.js',
            css:  null,
            lang: null
        },

        'autocomplete-plugin': {
            deps: ['autocomplete'],
            js:   'integrations/plugins/ozi-autocomplete.plugin.js',
            css:  null,
            lang: null
        },

        'editor-plugin': {
            deps: ['editor'],
            js:   'integrations/plugins/ozi-editor.plugin.js',
            css:  null,
            lang: null
        },

        'audio-plugin': {
            deps: ['audio'],
            js:   'integrations/plugins/ozi-audio.plugin.js',
            css:  null,
            lang: null
        },

        'auth-plugin': {
            deps: ['auth'],
            js:   'integrations/plugins/ozi-auth.plugin.js',
            css:  null,
            lang: null
        },

        'check-plugin': {
            deps: ['check'],
            js:   'integrations/plugins/ozi-check.plugin.js',
            css:  null,
            lang: null
        },

        'copy-plugin': {
            deps: ['copy'],
            js:   'integrations/plugins/ozi-copy.plugin.js',
            css:  null,
            lang: null
        },

        'search-plugin': {
            deps: ['search'],
            js:   'integrations/plugins/ozi-search.plugin.js',
            css:  null,
            lang: null
        },

        'toggle-plugin': {
            deps: ['toggle'],
            js:   'integrations/plugins/ozi-toggle.plugin.js',
            css:  null,
            lang: null
        },

        'livewire': {
            deps: [],
            js:   'integrations/adapters/ozi-livewire.adapter.js',
            css:  null,
            lang: null
        }
    };

    // Ordem de carregamento quando plugins: 'all'
    var _allPlugins = [
        'validate',
        'actions',
        'suggest',
        'password-rules',
        'loaddata',
        'select',
        'autocomplete',
        'editor',
        'editor-md',
        'audio',
        'auth',
        'check',
        'search',
        'copy',
        'paste',
        'toggle',
        'editor-plugin',
        'autocomplete-plugin',
        'audio-plugin',
        'auth-plugin',
        'check-plugin',
        'copy-plugin',
        'search-plugin',
        'toggle-plugin',
        'select-plugin',
        'livewire'
    ];

    /* ─────────────────────────────────────────────
     * [4] ESTADO INTERNO
     * ───────────────────────────────────────────── */

    var _conf = null;   // configuração ativa (após init)
    var _pending = {};  // customizações recebidas antes do init

    /* ─────────────────────────────────────────────
     * [5] MERGE PROFUNDO
     * ───────────────────────────────────────────── */

    function _deepMerge(target, source) {
        if (!source || typeof source !== 'object') return target;
        Object.keys(source).forEach(function (key) {
            var srcVal = source[key];
            var tgtVal = target[key];
            if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal) &&
                tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal)) {
                _deepMerge(tgtVal, srcVal);
            } else {
                target[key] = srcVal;
            }
        });
        return target;
    }

    /* ─────────────────────────────────────────────
     * [6] RESOLUÇÃO DE PLUGINS
     *
     * Recebe 'all' ou array de nomes.
     * Resolve dependências automaticamente.
     * Retorna lista ordenada sem duplicatas.
     * ───────────────────────────────────────────── */

    function _resolvePlugins(requested) {
        var list = requested === 'all' ? _allPlugins.slice() : (Array.isArray(requested) ? requested : []);

        // expande dependências
        var resolved = [];
        var seen     = {};

        function add(name) {
            if (seen[name]) return;
            if (!_pluginMap[name]) {
                console.warn('[OZI:conf] plugin desconhecido ignorado: "' + name + '"');
                return;
            }
            // deps primeiro
            (_pluginMap[name].deps || []).forEach(function (dep) { add(dep); });
            seen[name] = true;
            resolved.push(name);
        }

        list.forEach(function (name) { add(String(name).trim()); });
        return resolved;
    }

    /* ─────────────────────────────────────────────
     * [7] RESOLUÇÃO DE ARQUIVOS DE UM PLUGIN
     * ───────────────────────────────────────────── */

    function _resolveFiles(pluginName, urlBase, lang) {
        var def = _pluginMap[pluginName];
        if (!def) return null;

        var base   = String(urlBase || './plugins/ozi-ui/').replace(/\/$/, '') + '/';
        var locale = String(lang || 'en');

        function resolvePath(path) {
            if (!path) return null;
            return base + path.replace('{lang}', locale);
        }

        return {
            name: pluginName,
            js:   resolvePath(def.js),
            css:  resolvePath(def.css),
            lang: resolvePath(def.lang)
        };
    }

    /* ─────────────────────────────────────────────
     * [8] API PÚBLICA — OziConf
     * ───────────────────────────────────────────── */

    var OziConf = {

        /**
         * Inicializa a configuração ativa com os defaults
         * e aplica customizações pendentes (chamadas antes do init).
         * Chamado pelo ozi.js durante o bootstrap.
         */
        init: function () {
            // clona defaults
            _conf = _deepMerge({}, _defaults);

            // aplica preset do tema
            var preset = _presets[_conf.theme] || _presets['default'];
            _conf.classMap = _deepMerge({}, preset);

            // aplica customizações pendentes
            if (Object.keys(_pending).length) {
                this.apply(_pending);
                _pending = {};
            }

            return _conf;
        },

        /**
         * Aplica customizações sobre a configuração ativa.
         * Se chamado antes do init, acumula em _pending.
         */
        apply: function (userConfig) {
            if (!userConfig || typeof userConfig !== 'object') return;

            if (!_conf) {
                // ainda não inicializado — acumula
                _deepMerge(_pending, userConfig);
                return;
            }

            // aplica tema e atualiza classMap se tema mudou
            if (userConfig.theme && userConfig.theme !== _conf.theme) {
                _conf.theme = userConfig.theme;
                var preset  = _presets[_conf.theme] || _presets['default'];
                _conf.classMap = _deepMerge({}, preset);
            }

            // merge do restante (exceto theme que já foi tratado)
            var rest = {};
            Object.keys(userConfig).forEach(function (key) {
                if (key !== 'theme') rest[key] = userConfig[key];
            });
            _deepMerge(_conf, rest);

            // classMap pontual sobrescreve o preset
            if (userConfig.classMap) {
                _deepMerge(_conf.classMap, userConfig.classMap);
            }
        },

        /** Retorna a configuração ativa (ou os defaults se não inicializado) */
        get: function () {
            return _conf || _deepMerge({}, _defaults);
        },

        /**
         * Retorna a lista de arquivos a carregar, na ordem correta.
         * Chamado pelo ozi-loader.js durante o boot.
         *
         * @returns Array de { name, js, css, lang }
         */
        getLoadList: function () {
            var conf    = _conf || _defaults;
            var urlBase = conf.core && conf.core.urlBase ? conf.core.urlBase : _defaults.core.urlBase;
            var lang    = conf.lang || _defaults.lang;
            var plugins = _resolvePlugins(conf.plugins || 'all');

            return plugins.map(function (name) {
                return _resolveFiles(name, urlBase, lang);
            }).filter(Boolean);
        },

        /** Retorna o mapa de plugins (para inspeção/debug) */
        getPluginMap: function () {
            return _pluginMap;
        },

        /** Retorna a lista de todos os plugins em ordem */
        getAllPlugins: function () {
            return _allPlugins.slice();
        },

        /** Verifica se um plugin está na lista de carregamento */
        hasPlugin: function (name) {
            var conf    = _conf || _defaults;
            var plugins = _resolvePlugins(conf.plugins || 'all');
            return plugins.indexOf(name) !== -1;
        }
    };

    window.OziConf = OziConf;

})(window);