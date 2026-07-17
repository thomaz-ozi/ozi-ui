<?php

namespace OziUI\Core;

class OziAssets
{
    protected string $base;
    protected string $version;

    /*
     | v2 (2026-07-17): copy/paste descontinuados (fora das listas — substitutos
     | são receitas Alpine, ver ozi-ui-docs/dev/_meta/receitas-alpine.md).
     | Ordem espelha a load order documentada: modules → components → behaviors.
     | As listas são verificadas contra o _pluginMap do ozi-conf.js (fonte única)
     | pelo comando `php artisan ozi:check`.
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

    protected array $groups = [
        'auth'     => ['validate', 'password', 'auth', 'check', 'toggle'],
        'forms'    => ['validate', 'actions', 'loaddata', 'select', 'autocomplete'],
        'livewire' => ['select-plugin', 'autocomplete-plugin', 'audio-plugin', 'auth-plugin', 'check-plugin', 'editor-plugin', 'search-plugin', 'toggle-plugin', 'livewire-adapter'],
        'shims-v1' => ['change-v1-shim', 'check-v1-shim'], // transição v1→v2; removível no corte
        'full'     => [], // array vazio = todos
    ];

    public function __construct()
    {
        $this->base    = rtrim(asset('plugins/ozi-ui'), '/') . '/';
        $this->version = $this->resolveVersion();
    }
    public function styles(array $only = []): string
    {
        $map = $this->resolveKeys($this->availableStyles, $only);

        return implode("\n", array_map(
            fn($file) => '<link rel="stylesheet" href="' . $this->url($file) . '">',
            $map
        ));
    }

    public function scripts(array $only = []): string
    {
        $map = $this->resolveKeys($this->availableScripts, $only);

        $helpersUrl      = $this->base . 'core/helpers/ozi-helpers.js?v='  . $this->version;
        $confUrl         = $this->base . 'core/ozi-conf.js?v='             . $this->version;
        $langUrl         = $this->base . 'core/ozi-lang.js?v='             . $this->version;
        $integrationsUrl = $this->base . 'core/ozi-integrations.js?v='     . $this->version;
        $hooksUrl        = $this->base . 'core/ozi-hooks.js?v='            . $this->version;

        $bridge = 'window.OZI=window.OZI||{components:{},behaviors:{},modules:{},helpers:{},conf:null,lang:null};window.OZI.helpers=window.OziHelpers||{};';

        // immediate: init conf + lang + expose OZI.hooks + OZI.integrations so plugins can use them synchronously
        $immediateBoot = 'if(window.OziConf){window.OziConf.init();window.OziConf.apply({core:{urlBase:"' . $this->base . '"}});window.OZI.conf=window.OziConf.get();}window.oziConf=function(c){if(window.OziConf)window.OziConf.apply(c);};'
                       . 'if(window.OziLang){window.OZI.lang=window.OziLang;if(typeof window.OziLang.init==="function"){var _c=window.OZI.conf||{};window.OziLang.init(_c.lang||"en",_c.fallbackLang||"en");}}'
                       . 'window.OZI.hooks=window.OziHooks||{};window.OZI.integrations=window.OziIntegrations||{};if(window.OziIntegrations&&window.OziIntegrations._boot)window.OziIntegrations._boot([]);';

        // deferred: connect Livewire hooks only after @livewireScripts runs (window.Livewire ready at DOMContentLoaded)
        $deferredBoot = '(function(){function b(){var O=window.OZI;if(!O)return;if(O.hooks&&typeof O.hooks._boot==="function")O.hooks._boot();O.isReady=true;}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",b):setTimeout(b,0);})();';

        $head = '<script src="' . $helpersUrl . '"></script>' . "\n"
              . '<script>' . $bridge . '</script>' . "\n"
              . '<script src="' . $confUrl . '"></script>' . "\n"
              . '<script src="' . $langUrl . '"></script>' . "\n"
              . '<script src="' . $integrationsUrl . '"></script>' . "\n"
              . '<script src="' . $hooksUrl . '"></script>' . "\n"
              . '<script>' . $immediateBoot . '</script>';

        $body = implode("\n", array_map(
            fn($file) => '<script src="' . $this->url($file) . '"></script>',
            $map
        ));

        return $head . "\n" . $body . "\n" . '<script>' . $deferredBoot . '</script>';
    }

    protected function resolveKeys(array $available, array $only): array
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

            $keys[] = $key;
        }

        $keys   = array_unique($keys);
        $result = [];

        foreach ($keys as $key) {
            if (isset($available[$key])) {
                $result[] = $available[$key];
            }
        }

        return $result;
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