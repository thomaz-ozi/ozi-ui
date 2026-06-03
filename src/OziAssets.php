<?php

namespace OziUI\Core;

class OziAssets
{
    protected string $base;
    protected string $version;

    protected array $availableStyles = [
        'reset'        => 'shared/css/ozi-reset.css',
        'utilities'    => 'shared/css/ozi-utilities.css',
        'validate'     => 'modules/ozi-validate/css/ozi-validate.css',
        'loaddata'     => 'modules/ozi-loaddata/css/ozi-loaddata.css',
        'select'       => 'components/ozi-select/css/ozi-select.css',
        'autocomplete' => 'components/ozi-autocomplete/css/ozi-autocomplete.css',
        'audio'        => 'components/ozi-audio/css/ozi-audio.css',
        'editor'       => 'components/ozi-editor/css/ozi-editor.css',
        'auth'         => 'components/ozi-auth/css/ozi-auth.css',
        'search'       => 'components/ozi-search/css/ozi-search.css',
        'copy'         => 'behaviors/ozi-copy/css/ozi-copy.css',
    ];

    protected array $availableScripts = [
        'loaddata'     => 'modules/ozi-loaddata/js/ozi-loaddata.js',
        'validate'     => 'modules/ozi-validate/js/ozi-validate.js',
        'actions'      => 'modules/ozi-actions/js/ozi-actions.js',
        'suggest'      => 'modules/ozi-suggest/js/ozi-suggest.js',
        'password'     => 'modules/ozi-password-rules/js/ozi-password-rules.js',
        'select'       => 'components/ozi-select/js/ozi-select.js',
        'autocomplete' => 'components/ozi-autocomplete/js/ozi-autocomplete.js',
        'audio'        => 'components/ozi-audio/js/ozi-audio.js',
        'editor'       => 'components/ozi-editor/js/ozi-editor.js',
        'auth'         => 'components/ozi-auth/js/ozi-auth.js',
        'check'        => 'components/ozi-check/js/ozi-check.js',
        'search'       => 'components/ozi-search/js/ozi-search.js',
        'copy'         => 'behaviors/ozi-copy/js/ozi-copy.js',
        'toggle'       => 'behaviors/ozi-toggle/js/ozi-toggle.js',
    ];

    protected array $groups = [
        'auth'  => ['validate', 'password', 'auth', 'check', 'copy', 'toggle'],
        'forms' => ['validate', 'actions', 'loaddata', 'select', 'autocomplete'],
        'full'  => [], // array vazio = todos
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

        return implode("\n", array_map(
            fn($file) => '<script src="' . $this->url($file) . '"></script>',
            $map
        ));
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