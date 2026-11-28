<?php

namespace OziUI\Core;

class OziAssets
{
    protected string $base;
    protected string $version;
    protected string $locale;

    /*
     | v2 (2026-07-17): copy/paste descontinuados (fora das listas — substitutos
     | são receitas Alpine, ver ozi-ui-docs/dev/_meta/receitas-alpine.md).
     | Ordem espelha a load order documentada: modules → components → behaviors.
     | As listas são verificadas contra o _pluginMap do ozi-conf.js (fonte única)
     | pelo comando `php artisan ozi:check`.
     |
     | v2 (2026-07-21): i18n. Este caminho NÃO passa pelo ozi-loader, então os
     | dicionários dos plugins precisam ser emitidos aqui — ver $availableLangs.
     | O locale vem do Laravel (resolveLocale), não do oziConf() do blade.
     */
    protected array $availableStyles = [
        'reset'        => 'shared/css/ozi-reset.css',
        'utilities'    => 'shared/css/ozi-utilities.css',
        'validate'     => 'modules/ozi-validate/css/ozi-validate.css',
        'loaddata'     => 'modules/ozi-loaddata/css/ozi-loaddata.css',
        'select'       => 'components/ozi-select/css/ozi-select.css',
        'autocomplete' => 'components/ozi-autocomplete/css/ozi-autocomplete.css',
        'editor'       => 'components/ozi-editor/css/ozi-editor.css',
        'auth'         => 'components/ozi-auth/css/ozi-auth.css',
        'check'        => 'components/ozi-check/css/ozi-check.css',
        'search'       => 'components/ozi-search/css/ozi-search.css',
        'audio'        => 'components/ozi-audio/css/ozi-audio.css',
        'toggle'       => 'behaviors/ozi-toggle/css/ozi-toggle.css',
    ];

    protected array $availableScripts = [
        'validate'            => 'modules/ozi-validate/js/ozi-validate.js',
        'actions'             => 'modules/ozi-actions/js/ozi-actions.js',
        'suggest'             => 'modules/ozi-suggest/js/ozi-suggest.js',
        'password'            => 'modules/ozi-password-rules/js/ozi-password-rules.js',
        // motor puro de sanitização do ozi-editor (extraído em 2026-08-28);
        // o editor declara deps:['validate','editor-sanitize'] no _pluginMap,
        // então precisa vir ANTES dele — mesma ordem do _allPlugins
        'editor-sanitize'     => 'modules/ozi-editor-sanitize/js/ozi-editor-sanitize.js',
        'loaddata'            => 'modules/ozi-loaddata/js/ozi-loaddata.js',
        'select'              => 'components/ozi-select/js/ozi-select.js',
        'autocomplete'        => 'components/ozi-autocomplete/js/ozi-autocomplete.js',
        'editor'              => 'components/ozi-editor/js/ozi-editor.js',
        'editor-md'           => 'components/ozi-editor/js/ozi-editor-md.js',
        'auth'                => 'components/ozi-auth/js/ozi-auth.js',
        'check'               => 'components/ozi-check/js/ozi-check.js',
        'search'              => 'components/ozi-search/js/ozi-search.js',
        'audio'               => 'components/ozi-audio/js/ozi-audio.js',
        'toggle'              => 'behaviors/ozi-toggle/js/ozi-toggle.js',
        'select-plugin'       => 'integrations/plugins/ozi-select.plugin.js',
        'autocomplete-plugin' => 'integrations/plugins/ozi-autocomplete.plugin.js',
        'audio-plugin'        => 'integrations/plugins/ozi-audio.plugin.js',
        'auth-plugin'         => 'integrations/plugins/ozi-auth.plugin.js',
        'check-plugin'        => 'integrations/plugins/ozi-check.plugin.js',
        'editor-plugin'       => 'integrations/plugins/ozi-editor.plugin.js',
        'search-plugin'       => 'integrations/plugins/ozi-search.plugin.js',
        'toggle-plugin'       => 'integrations/plugins/ozi-toggle.plugin.js',
        'livewire-adapter'    => 'integrations/adapters/ozi-livewire.adapter.js',
        // Shims de transição v1→v2 (opt-in; REMOVER NO CORTE — contrato v2 §emit)
        'change-v1-shim'      => 'integrations/adapters/ozi-change-v1-compat.shim.js',
        'check-v1-shim'       => 'integrations/adapters/ozi-check-v1-events.shim.js',
    ];

    /*
     | Dicionários i18n dos plugins ({lang} = locale resolvido do Laravel).
     |
     | Espelha as chaves `lang:` do _pluginMap do ozi-conf.js. Fica FORA do
     | $availableScripts de propósito: o `php artisan ozi:check` descarta paths
     | com {lang} ao ler o _pluginMap, então incluí-los ali acusaria deriva falsa.
     |
     | Por que existe: no boot standalone o ozi-loader.js carrega estes arquivos
     | a partir do _pluginMap; o @oziScripts não passa pelo loader, então sem esta
     | lista NENHUM dicionário de plugin era registrado e todo _t() caía no
     | fallback embutido, logando "chave nao encontrada" no console.
     |
     | copy/paste ficam fora (descontinuados na v2, como no $availableScripts).
     */
    protected array $availableLangs = [
        'shared'       => 'shared/lang/{lang}.js',
        'loaddata'     => 'modules/ozi-loaddata/lang/{lang}.js',
        'select'       => 'components/ozi-select/lang/{lang}.js',
        'autocomplete' => 'components/ozi-autocomplete/lang/{lang}.js',
        'editor'       => 'components/ozi-editor/lang/{lang}.js',
        'auth'         => 'components/ozi-auth/lang/{lang}.js',
        'search'       => 'components/ozi-search/lang/{lang}.js',
        'audio'        => 'components/ozi-audio/lang/{lang}.js',
    ];

    /** Locales com dicionário publicado. Qualquer outro cai no fallback. */
    protected array $supportedLocales = ['pt-BR', 'en', 'es'];

    /**
     * Dependências entre chaves de script — espelho PHP do `deps:` do _pluginMap
     * (core/ozi-conf.js, fonte única). O `php artisan ozi:check` valida a deriva
     * entre os dois; ao mexer no `deps:` do JS, mexa aqui também.
     *
     * Existe porque o @oziScripts NÃO passa pelo ozi-loader: até a 2.6.0 esta
     * classe era uma tradução literal chave → caminho, então
     * `@oziScripts(['editor'])` emitia um editor SEM o ozi-editor-sanitize —
     * que desde o editor 4.4.0 é módulo à parte e dá `throw` na 1ª sanitização.
     * A mensagem do throw manda declarar `deps:` no ozi-conf, que é justamente
     * o mecanismo que não se aplica a quem chegou por aqui.
     *
     * ⚠️ Nome divergente: o _pluginMap chama `password-rules`; a chave pública
     * do @oziScripts é `password` (mantida por compatibilidade). O ozi:check
     * conhece o alias.
     */
    protected array $scriptDeps = [
        'loaddata'            => ['validate', 'actions'],
        'select'              => ['loaddata', 'suggest', 'validate'],
        'autocomplete'        => ['loaddata', 'suggest', 'validate'],
        'editor'              => ['validate', 'editor-sanitize'],
        'editor-md'           => ['editor'],
        'audio'               => ['loaddata'],
        'auth'                => ['password'],
        'select-plugin'       => ['select'],
        'autocomplete-plugin' => ['autocomplete'],
        'editor-plugin'       => ['editor'],
        'audio-plugin'        => ['audio'],
        'auth-plugin'         => ['auth'],
        'check-plugin'        => ['check'],
        'search-plugin'       => ['search'],
        'toggle-plugin'       => ['toggle'],
    ];

    protected array $groups = [
        'auth'     => ['validate', 'password', 'auth', 'check', 'toggle'],
        'forms'    => ['validate', 'actions', 'loaddata', 'select', 'autocomplete'],
        'livewire' => ['select-plugin', 'autocomplete-plugin', 'audio-plugin', 'auth-plugin', 'check-plugin', 'editor-plugin', 'search-plugin', 'toggle-plugin', 'livewire-adapter'],
        'shims-v1' => ['change-v1-shim', 'check-v1-shim'], // transição v1→v2; removível no corte
        'full'     => [], // array vazio = todos
    ];

    /*
     | 2.10.0 (N2 do roadmap "pronto para IA"): chave desconhecida no @oziScripts/@oziStyles
     | era descartada em silêncio (`@oziScripts(['ozi-validate'])` não carregava nada e nada
     | avisava). Agora vira o aviso OZI-W002: com APP_DEBUG, comentário HTML + console.warn;
     | em produção, só Log::warning (decisão #25: o visitante nunca vê). Nunca exceção: uma
     | chave errada não pode derrubar a página de quem atualizar o pacote.
     */

    /** Chaves desconhecidas da chamada atual (zeradas a cada styles()/scripts()). */
    protected array $unknownKeys = [];

    /** Nomes que parecem certos e não são, com a chave certa. */
    protected array $keyAliases = [
        'password-rules'     => 'password',
        'ozi-password-rules' => 'password',
        'sanitize'           => 'editor-sanitize',
        'markdown'           => 'editor-md',
        'md'                 => 'editor-md',
        'all'                => 'full',
    ];

    /** Plugins que saíram, com a versão. */
    protected array $removedKeys = ['copy' => '2.0', 'paste' => '2.0'];

    protected const W002_TEXT = [
        'pt-BR' => ['unknown' => "OZI-W002 chave desconhecida '%s' em %s.", 'suggest' => "Você quis dizer '%s'?",
                    'removed' => 'Ela saiu na %s.', 'more' => 'Lista de chaves: %s'],
        'en'    => ['unknown' => "OZI-W002 unknown key '%s' in %s.", 'suggest' => "Did you mean '%s'?",
                    'removed' => 'It was removed in %s.', 'more' => 'Key list: %s'],
        'es'    => ['unknown' => "OZI-W002 clave desconocida '%s' en %s.", 'suggest' => "¿Quiso decir '%s'?",
                    'removed' => 'Se eliminó en la %s.', 'more' => 'Lista de claves: %s'],
    ];

    public function __construct()
    {
        $this->base    = rtrim(asset(config('ozi-ui.base_path', 'plugins/ozi-ui')), '/') . '/';
        $this->version = $this->resolveVersion();
        $this->locale  = $this->resolveLocale();
    }

    /**
     * Locale do JS = locale do Laravel, normalizado para os dicionários publicados.
     *
     * Resolver no servidor tira o i18n da dependência de ordem entre o @oziScripts
     * (que roda no HEAD) e o oziConf({lang}) do blade (que roda depois). Um
     * oziConf({lang}) posterior continua válido e sobrescreve — o blade tem a
     * última palavra.
     */
    protected function resolveLocale(): string
    {
        $raw = function_exists('app') ? (string) app()->getLocale() : '';

        // 'pt_BR' | 'pt-br' | 'pt' → 'pt-BR'; 'es_ES' → 'es'; etc.
        $norm = str_replace('_', '-', $raw);

        foreach ($this->supportedLocales as $supported) {
            if (strcasecmp($norm, $supported) === 0) {
                return $supported;
            }
        }

        // casa só o idioma, ignorando a região ('pt-PT' → 'pt-BR')
        $lang = strtolower(explode('-', $norm)[0] ?? '');

        foreach ($this->supportedLocales as $supported) {
            if ($lang !== '' && $lang === strtolower(explode('-', $supported)[0])) {
                return $supported;
            }
        }

        return 'en';
    }
    public function styles(array $only = []): string
    {
        $this->unknownKeys = [];
        $map = $this->resolveKeys($this->availableStyles, $only);

        // 2.11.1: o ozi-reset.css sai SEMPRE, também com lista de chaves, como no standalone
        // (ozi-loader). Sem ele, o mesmo componente tinha `box-sizing` diferente no Blade e no
        // ozi.js (foi a causa do `max-height` do popover da 2.7.2). Ele é escopado a
        // `[class*="ozi-"]`, então não toca no CSS do app.
        $reset = $this->availableStyles['reset'];
        if (!in_array($reset, $map, true)) {
            array_unshift($map, $reset);
        }

        return $this->unknownKeysWarning('@oziStyles') . implode("\n", array_map(
            fn($file) => '<link rel="stylesheet" href="' . $this->url($file) . '">',
            $map
        ));
    }

    public function scripts(array $only = []): string
    {
        $this->unknownKeys = [];
        $map = $this->resolveKeys($this->availableScripts, $only, true);

        $helpersUrl      = $this->base . 'core/helpers/ozi-helpers.js?v='  . $this->version;
        $confUrl         = $this->base . 'core/ozi-conf.js?v='             . $this->version;
        $themeUrl        = $this->base . 'core/ozi-theme.js?v='            . $this->version;
        $langUrl         = $this->base . 'core/ozi-lang.js?v='             . $this->version;
        $integrationsUrl = $this->base . 'core/ozi-integrations.js?v='     . $this->version;
        $hooksUrl        = $this->base . 'core/ozi-hooks.js?v='            . $this->version;
        $attrsUrl        = $this->base . 'core/ozi-attrs.js?v='            . $this->version;
        $bootUrl         = $this->base . 'core/ozi-assets-boot.js?v='      . $this->version;
        $readyUrl        = $this->base . 'core/ozi-assets-ready.js?v='     . $this->version;

        // ⚠️ 2.8.0 ([OZI-11] do SNDESK): o boot NÃO pode ser <script> inline. No `wire:navigate`
        // o Livewire reinsere os scripts do <body> de uma vez, e o navegador executa os inline na
        // hora e os externos depois, em ordem. O boot inline rodava antes do core e gravava
        // OZI.hooks = {} (erro "reading 'register'" nos módulos), OZI.helpers = {}, deixava
        // OZI.conf nulo e perdia o oziConf() do blade. Agora o boot é core/ozi-assets-boot.js e
        // core/ozi-assets-ready.js, na fila dos externos.
        //
        // O único inline que sobra é esta ponte, e ela só precisa de duas coisas que valem em
        // qualquer ordem: o window.OZI e uma FILA para o oziConf(). Um oziConf({...}) inline do
        // blade que rode antes do boot (o caso do navigate) é guardado e aplicado pelo boot.
        $bridge = 'window.OZI=window.OZI||{components:{},behaviors:{},modules:{},helpers:{},conf:null,lang:null};'
                . 'window.OZI.helpers=window.OziHelpers||window.OZI.helpers||{};'
                . 'window.__oziConfQueue=[];'
                . 'window.oziConf=function(c){(window.__oziConfQueue=window.__oziConfQueue||[]).push(c);};';

        // base e locale vão por data-* (o arquivo os lê de document.currentScript)
        $bootTag = '<script src="' . $bootUrl . '"'
                 . ' data-ozi-base="' . htmlspecialchars($this->base, ENT_QUOTES) . '"'
                 . ' data-ozi-locale="' . htmlspecialchars($this->locale, ENT_QUOTES) . '"'
                 // 2.10.0: o aviso OZI-W001 (core/ozi-attrs.js) segue o APP_DEBUG (decisão #25)
                 . ' data-ozi-debug="' . ($this->isDebug() ? '1' : '0') . '"></script>';

        $head = '<script src="' . $helpersUrl . '"></script>' . "\n"
              . '<script>' . $bridge . '</script>' . "\n"
              . '<script src="' . $confUrl . '"></script>' . "\n"
              // ozi-theme logo após o conf (2.8.0): o oziConf({themeMode}) do blade chama
              // OziTheme.setMode() de dentro do OziConf.apply(), então ele precisa já existir
              . '<script src="' . $themeUrl . '"></script>' . "\n"
              . '<script src="' . $langUrl . '"></script>' . "\n"
              . '<script src="' . $integrationsUrl . '"></script>' . "\n"
              . '<script src="' . $hooksUrl . '"></script>' . "\n"
              // 2.10.0: logo após o ozi-hooks, para registrar a varredura no afterRender antes dos plugins
              . '<script src="' . $attrsUrl . '"></script>' . "\n"
              . $bootTag;

        // Dicionários logo após o boot: os arquivos de lang chamam
        // OZI.lang.register(), que só existe a partir dele. Antes dos plugins,
        // para que qualquer _t() em tempo de init já encontre as chaves.
        $langs = $this->resolveLangs($map);

        if ($langs !== []) {
            $head .= "\n" . implode("\n", array_map(
                fn($file) => '<script src="' . $this->url($file) . '"></script>',
                $langs
            ));
        }

        $body = implode("\n", array_map(
            fn($file) => '<script src="' . $this->url($file) . '"></script>',
            $map
        ));

        // ready por último: liga os hooks do Livewire e sobe OZI.isReady depois dos plugins
        // o aviso vai no TOPO: o fim da saída é sempre o ozi-assets-ready.js
        return $this->unknownKeysWarning('@oziScripts')
             . $head . "\n" . $body . "\n" . '<script src="' . $readyUrl . '"></script>';
    }

    /**
     * Dicionários a emitir, dado o conjunto de scripts já resolvido.
     *
     * Só entra o lang de plugin que está de fato sendo carregado — @oziScripts(['auth'])
     * não deve puxar o dicionário do select. O 'shared' é global e entra sempre.
     * Arquivo ausente em disco é ignorado (locale sem tradução publicada).
     *
     * A existência é conferida nas DUAS origens, como no ozi:check: a cópia
     * publicada (public/{base_path}) e o próprio pacote (rota-fallback). Até a
     * 2.6.1 só a publicada era olhada, então quem instalou só com
     * `composer require` (o modo recomendado desde a 2.1.0) não recebia nenhum
     * dicionário e todo _t() caía no fallback embutido.
     *
     * @param  array<int,string>  $scriptPaths  paths já resolvidos por resolveKeys()
     * @return array<int,string>
     */
    protected function resolveLangs(array $scriptPaths): array
    {
        $files     = [];
        $published = public_path(trim((string) config('ozi-ui.base_path', 'plugins/ozi-ui'), '/'));
        $package   = __DIR__ . '/../public/plugins/ozi-ui';

        foreach ($this->availableLangs as $key => $template) {
            if ($key !== 'shared') {
                $script = $this->availableScripts[$key] ?? null;

                if ($script === null || !in_array($script, $scriptPaths, true)) {
                    continue;
                }
            }

            $file = str_replace('{lang}', $this->locale, $template);

            if (is_file($published . '/' . $file) || is_file($package . '/' . $file)) {
                $files[] = $file;
            }
        }

        return $files;
    }

    /**
     * Traduz as chaves pedidas em caminhos de arquivo.
     *
     * Expande grupos, completa as dependências declaradas ($scriptDeps) e emite
     * na ORDEM CANÔNICA de $available — que espelha o `_allPlugins` do ozi-conf,
     * a mesma ordem que o ozi-loader usa no boot. A ordem em que o dev escreveu
     * as chaves não define mais a ordem das tags: `['editor', 'editor-sanitize']`
     * e `['editor-sanitize', 'editor']` emitem o mesmo HTML, com o módulo antes
     * do componente nos dois casos.
     */
    protected function resolveKeys(array $available, array $only, bool $withDeps = false): array
    {
        if (empty($only)) {
            return array_values($available);
        }

        $keys = [];

        foreach ($only as $key) {
            $key = strtolower(trim($key));

            if (isset($this->groups[$key])) {
                $groupKeys = $this->groups[$key];

                if (empty($groupKeys)) {
                    return array_values($available);
                }

                foreach ($groupKeys as $gk) {
                    $keys[] = $gk;
                }

                continue;
            }

            if (!isset($available[$key]) && !in_array($key, $this->knownKeys(), true)) {
                $this->unknownKeys[$key] = true;   // OZI-W002 (ver unknownKeysWarning)
                continue;
            }

            $keys[] = $key;
        }

        if ($withDeps) {
            $keys = $this->expandDeps($keys);
        }

        $keys   = array_unique($keys);
        $result = [];

        // Ordem canônica: percorre $available, não $keys.
        foreach ($available as $key => $file) {
            if (in_array($key, $keys, true)) {
                $result[] = $file;
            }
        }

        return $result;
    }

    /**
     * Completa a lista com as dependências declaradas, em profundidade.
     *
     * Só acrescenta chaves — nunca remove, nunca reordena (a ordem final é
     * responsabilidade do resolveKeys). Uma dependência cíclica no mapa não
     * trava: cada chave é visitada uma única vez.
     *
     * @param  array<int,string>  $keys
     * @return array<int,string>
     */
    protected function expandDeps(array $keys): array
    {
        $seen  = [];
        $queue = $keys;

        while ($queue !== []) {
            $key = array_shift($queue);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;

            foreach ($this->scriptDeps[$key] ?? [] as $dep) {
                if (!isset($seen[$dep])) {
                    $queue[] = $dep;
                }
            }
        }

        return array_keys($seen);
    }

    protected function url(string $file): string
    {
        return $this->base . $file . '?v=' . $this->version;
    }

    protected function resolveVersion(): string
    {
        $composerFile = __DIR__ . '/../composer.json';

        if (file_exists($composerFile)) {
            $json = json_decode(file_get_contents($composerFile), true);
            return $json['version'] ?? 'dev';
        }

        return 'dev';
    }

    /** Toda chave aceita por @oziScripts ou @oziStyles (arquivo ou grupo). */
    public function knownKeys(): array
    {
        return array_values(array_unique(array_merge(
            array_keys($this->availableScripts),
            array_keys($this->availableStyles),
            array_keys($this->groups)
        )));
    }

    /**
     * Para uma chave que não existe: a chave certa, se der para adivinhar. Ordem: nome que
     * parece certo (alias), prefixo `ozi-` sobrando, plural, distância de edição <= 2.
     */
    public function suggestKey(string $key): ?string
    {
        $key   = strtolower(trim($key));
        $known = $this->knownKeys();

        if (isset($this->keyAliases[$key])) {
            return $this->keyAliases[$key];
        }

        foreach (['ozi-', 'ozi_'] as $prefix) {
            if (str_starts_with($key, $prefix)) {
                $rest = substr($key, strlen($prefix));
                if (in_array($rest, $known, true)) return $rest;
                if (isset($this->keyAliases[$rest])) return $this->keyAliases[$rest];
            }
        }

        if (str_ends_with($key, 's') && in_array(substr($key, 0, -1), $known, true)) {
            return substr($key, 0, -1);
        }

        $best = null;
        $bestDistance = 3;
        foreach ($known as $candidate) {
            $distance = levenshtein($key, $candidate);
            // chave curta não ganha sugestão aleatória ('x' está a 2 letras de 'md')
            if ($distance < $bestDistance && $distance < strlen($key)) {
                $bestDistance = $distance;
                $best = $candidate;
            }
        }

        return $best;
    }

    /** Uma mensagem por chave desconhecida da última chamada (vazio = nenhuma). */
    public function unknownKeyMessages(string $directive): array
    {
        $t = self::W002_TEXT[$this->locale] ?? self::W002_TEXT['en'];
        $messages = [];

        foreach (array_keys($this->unknownKeys) as $key) {
            $message = sprintf($t['unknown'], $key, $directive);

            if (isset($this->removedKeys[$key])) {
                $message .= ' ' . sprintf($t['removed'], $this->removedKeys[$key]);
            } elseif (($suggestion = $this->suggestKey((string) $key)) !== null) {
                $message .= ' ' . sprintf($t['suggest'], $suggestion);
            }

            $messages[] = '[OZI] ' . $message . ' ' . sprintf($t['more'], 'https://oziui.com/docs/warnings#ozi-w002');
        }

        return $messages;
    }

    /**
     * O aviso OZI-W002 da última chamada. Com APP_DEBUG: comentário HTML + console.warn (o resto
     * da página não muda). Sem APP_DEBUG: só Log::warning, e nada vai para o HTML.
     */
    protected function unknownKeysWarning(string $directive): string
    {
        $messages = $this->unknownKeyMessages($directive);
        if ($messages === []) return '';

        if (!$this->isDebug()) {
            if (function_exists('logger')) {
                foreach ($messages as $message) logger()->warning($message);
            }
            return '';
        }

        $html = '';
        foreach ($messages as $message) {
            // "--" fecharia o comentário antes da hora
            $html .= '<!-- ' . str_replace('--', '- -', htmlspecialchars($message, ENT_QUOTES)) . ' -->' . "\n";
        }
        $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
        $html .= '<script>' . implode('', array_map(
            fn ($message) => 'console.warn(' . json_encode($message, $flags) . ');',
            $messages
        )) . '</script>' . "\n";

        return $html;
    }

    protected function isDebug(): bool
    {
        return function_exists('config') && (bool) config('app.debug');
    }

    /** Exposto para verificação cruzada com o _pluginMap (php artisan ozi:check). */
    public function getAvailableScripts(): array
    {
        return $this->availableScripts;
    }

    /** Exposto para verificação cruzada com o _pluginMap (php artisan ozi:check). */
    public function getAvailableStyles(): array
    {
        return $this->availableStyles;
    }

    /** Exposto para verificação cruzada com o `deps:` do _pluginMap (php artisan ozi:check). */
    public function getScriptDeps(): array
    {
        return $this->scriptDeps;
    }

    /**
     * Chaves de script que um `@oziScripts($only)` carrega, com grupos e dependências (2.12.0,
     * `ozi:check --lint`). `null` = carrega todos (lista vazia ou o grupo `full`). Chave
     * desconhecida é ignorada aqui (o OZI-W002 já a aponta) e não toca no estado do aviso.
     *
     * @param  array<int,string>  $only
     * @return array<int,string>|null
     */
    public function scriptKeysFor(array $only): ?array
    {
        if (empty($only)) {
            return null;
        }

        $keys = [];
        foreach ($only as $key) {
            $key = strtolower(trim((string) $key));
            if (isset($this->groups[$key])) {
                if (empty($this->groups[$key])) {
                    return null;
                }
                foreach ($this->groups[$key] as $gk) {
                    $keys[] = $gk;
                }
                continue;
            }
            // alias ('markdown', 'password-rules') NÃO carrega nada no @oziScripts: aqui também não
            if (isset($this->availableScripts[$key])) {
                $keys[] = $key;
            }
        }

        return $this->expandDeps(array_values(array_unique($keys)));
    }

    public function setBase(string $base): static
    {
        $this->base = rtrim($base, '/') . '/';
        return $this;
    }

    public function setVersion(string $version): static
    {
        $this->version = $version;
        return $this;
    }
}