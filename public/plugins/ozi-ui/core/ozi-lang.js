/**
 ------------------------------------------
 ozi-lang
 ------------------------------------------
 Ver: 1.0.1
 2026-05-27

 *
 * Responsabilidade:
 *   - Gerenciar dicionarios de traducao por idioma
 *   - Resolver chaves via OZI.lang.t() com fallback automatico
 *   - Suportar interpolacao de parametros nas strings
 *   - Merge profundo ao registrar novos dicionarios (plugins)
 *   - Expor window.OziLang como contrato interno para ozi.js
 *
 * NAO faz:
 *   - Nao carrega arquivos de idioma (responsabilidade do ozi-loader.js)
 *   - Nao detecta idioma do browser automaticamente
 *   - Nao traduz HTML diretamente — so retorna strings
 *
 * Dependencias: ozi-conf.js (lang, fallbackLang, log)
 * Consumido por: ozi.js (window.OziLang)
 * Usado por: todos os plugins via OZI.lang.t()
 *
 * Changelog v1.0.1:
 *   - Corrigido: _normalizeLocale movida para antes da API window.OziLang.
 *     Estava declarada apos o objeto que a usa — ordem confusa apesar de
 *     hoisting resolver. Reorganizado para manter padrao do restante do arquivo.
 *   - Mantido: merge profundo, lookup, fallback, interpolacao — sem bugs logicos.
 */

(function (window) {
    'use strict';

    // guard — singleton
    if (window.OziLang) return;

    // ---------------------------------------------
    // [1] ESTADO INTERNO
    // ---------------------------------------------

    var _current  = 'pt-BR';   // idioma ativo
    var _fallback = 'en';      // idioma de fallback
    var _dicts    = {};        // { 'pt-BR': { common: {...} }, 'en': {...} }


    // ---------------------------------------------
    // [2] DICIONARIO BASE — pt-BR e en
    // Strings globais compartilhadas por 3+ plugins.
    // Strings de plugin ficam em plugin/lang/pt-BR.js.
    // ---------------------------------------------

    var _baseDicts = {

        'pt-BR': {
            copy: {
                success: 'Copiado!',
                error:   'Erro ao copiar!'
            },
            common: {
                loading:  'Carregando...',
                saving:   'Salvando...',
                save:     'Salvar',
                cancel:   'Cancelar',
                confirm:  'Confirmar',
                close:    'Fechar',
                clear:    'Limpar',
                search:   'Pesquisar',
                empty:    'Nenhum resultado',
                error:    'Erro',
                success:  'Concluido',
                required: 'Campo obrigatorio',
                yes:      'Sim',
                no:       'Nao',
                add:      'Adicionar',
                remove:   'Remover',
                edit:     'Editar',
                back:     'Voltar'
            }
        },

        'en': {
            copy: {
                success: 'Copied!',
                error:   'Copy failed!'
            },
            common: {
                loading:  'Loading...',
                saving:   'Saving...',
                save:     'Save',
                cancel:   'Cancel',
                confirm:  'Confirm',
                close:    'Close',
                clear:    'Clear',
                search:   'Search',
                empty:    'No results',
                error:    'Error',
                success:  'Done',
                required: 'Required field',
                yes:      'Yes',
                no:       'No',
                add:      'Add',
                remove:   'Remove',
                edit:     'Edit',
                back:     'Back'
            }
        }
    };


    // ---------------------------------------------
    // [3] LOG INTERNO
    // ---------------------------------------------

    function _log(level, msg) {
        var conf   = window.OZI && window.OZI.conf;
        var active = conf && conf.core && conf.core.log;
        if (!active && level === 'info') return;
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift('[OZI:lang]');
        if (level === 'warn')  console.warn.apply(console, args);
        if (level === 'error') console.error.apply(console, args);
        if (level === 'info')  console.log.apply(console, args);
    }


    // ---------------------------------------------
    // [4] NORMALIZACAO DE LOCALE
    // Movida para antes da API — era declarada apos window.OziLang
    // mas usada dentro de use(). Reorganizado para clareza.
    //
    // 'pt-br' -> 'pt-BR' | 'pt_BR' -> 'pt-BR' | 'EN' -> 'en'
    // ---------------------------------------------

    function _normalizeLocale(locale) {
        if (!locale) return 'en';

        var parts = locale.replace('_', '-').split('-');

        if (parts.length === 1) {
            return parts[0].toLowerCase();
        }

        return parts[0].toLowerCase() + '-' + parts[1].toUpperCase();
    }


    // ---------------------------------------------
    // [5] MERGE PROFUNDO DE DICIONARIOS
    // Merge recursivo — nunca sobrescreve chaves existentes
    // com objetos inteiros. Plugins adicionam ao dict existente.
    // ---------------------------------------------

    function _deepMergeDict(target, source) {
        if (!source || typeof source !== 'object') return target;

        Object.keys(source).forEach(function (key) {
            var srcVal = source[key];
            var tgtVal = target[key];

            if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
                target[key] = _deepMergeDict(
                    tgtVal && typeof tgtVal === 'object' ? tgtVal : {},
                    srcVal
                );
            } else {
                target[key] = srcVal;
            }
        });

        return target;
    }


    // ---------------------------------------------
    // [6] RESOLUCAO DE CHAVE
    // Busca por caminho pontilhado: 'common.loading'
    // Tenta idioma ativo -> fallback -> retorna a chave
    // ---------------------------------------------

    function _resolve(key, locale) {
        var dict = _dicts[locale];
        if (!dict) return undefined;

        return key.split('.').reduce(function (obj, part) {
            return obj && obj[part] !== undefined ? obj[part] : undefined;
        }, dict);
    }

    function _lookup(key) {
        // 1. idioma ativo
        var value = _resolve(key, _current);
        if (value !== undefined) return value;

        // 2. fallback
        if (_fallback && _fallback !== _current) {
            value = _resolve(key, _fallback);
            if (value !== undefined) {
                _log('info', 't("' + key + '"): usando fallback "' + _fallback + '"');
                return value;
            }
        }

        // 3. retorna a propria chave como ultimo recurso
        _log('warn', 't("' + key + '"): chave nao encontrada em "' + _current + '" nem "' + _fallback + '"');
        return key;
    }


    // ---------------------------------------------
    // [7] INTERPOLACAO DE PARAMETROS
    // Substitui {{param}} ou {param} por valores do objeto.
    //
    // OZI.lang.t('auth.minChars', { min: 12 })
    // -> 'Minimo de 12 caracteres'
    // ---------------------------------------------

    function _interpolate(str, params) {
        if (!params || typeof params !== 'object') return str;
        if (typeof str !== 'string') return str;

        return str.replace(/\{\{?\s*(\w+)\s*\}?\}/g, function (match, key) {
            return params[key] !== undefined ? params[key] : match;
        });
    }


    // ---------------------------------------------
    // [8] API INTERNA — window.OziLang
    // Contrato entre ozi-en.js e ozi.js.
    // Apos boot, exposto em OZI.lang.
    // ---------------------------------------------

    window.OziLang = {

        // -----------------------------------------
        // init(lang, fallbackLang)
        // Chamado pelo ozi.js no bootstrap.
        // Carrega dicionarios base e aplica idioma.
        // -----------------------------------------
        init: function (lang, fallbackLang) {
            _fallback = fallbackLang || 'en';

            // registra dicionarios base
            Object.keys(_baseDicts).forEach(function (locale) {
                window.OziLang.register(locale, _baseDicts[locale]);
            });

            // aplica idioma configurado
            window.OziLang.use(lang || 'pt-BR');

            _log('info', 'inicializado — idioma: ' + _current + ', fallback: ' + _fallback);
        },

        // -----------------------------------------
        // register(locale, dict)
        // Registra ou estende um dicionario.
        // Chamado pelos plugins ao carregar:
        //   OZI.lang.register('pt-BR', { select: { searchPlaceholder: 'Pesquisar...' } })
        //
        // @param {string} locale — ex: 'pt-BR', 'en', 'es'
        // @param {object} dict   — objeto de traducao (merge profundo)
        // -----------------------------------------
        register: function (locale, dict) {
            if (!locale || !dict) return;

            if (!_dicts[locale]) {
                _dicts[locale] = {};
            }

            _deepMergeDict(_dicts[locale], dict);
            _log('info', 'register("' + locale + '"): ' + Object.keys(dict).join(', '));
        },

        // -----------------------------------------
        // use(locale)
        // Define o idioma ativo.
        // Nao carrega arquivos — so muda o ponteiro.
        //
        // @param {string} locale
        // -----------------------------------------
        use: function (locale) {
            if (!locale) return;

            var normalized = _normalizeLocale(locale);

            if (!_dicts[normalized]) {
                _log('warn', 'use("' + locale + '"): dicionario nao registrado. Registre antes de usar.');
            }

            _current = normalized;
            _log('info', 'idioma ativo: ' + _current);
        },

        // -----------------------------------------
        // t(key, params?)
        // Traduz uma chave. Ponto central de i18n.
        //
        // @param {string} key    — caminho pontilhado: 'common.loading'
        // @param {object} params — interpolacao: { min: 12 }
        // @returns {string}
        //
        // @example
        // OZI.lang.t('common.loading')             // 'Carregando...'
        // OZI.lang.t('select.searchPlaceholder')   // 'Pesquisar...'
        // OZI.lang.t('auth.minChars', { min: 12 }) // 'Minimo de 12 caracteres'
        // -----------------------------------------
        t: function (key, params) {
            if (!key) return '';
            var value = _lookup(key);
            return _interpolate(value, params);
        },

        // -----------------------------------------
        // getDict(locale?)
        // Retorna o dicionario completo de um idioma.
        // Sem locale retorna o idioma ativo.
        // Util para debug.
        // -----------------------------------------
        getDict: function (locale) {
            return _dicts[locale || _current] || {};
        },

        // -----------------------------------------
        // available()
        // Lista de idiomas com dicionario registrado.
        // -----------------------------------------
        available: function () {
            return Object.keys(_dicts);
        },

        get current()  { return _current;  },
        get fallback() { return _fallback; }
    };

})(window);