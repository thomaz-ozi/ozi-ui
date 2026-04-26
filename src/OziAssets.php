<?php

namespace OziUI\Core;

class OziAssets
{
    protected string $base = '/plugins/ozi-ui/';
    protected string $version = '0.18.1';

    protected array $availableStyles = [
        'core'           => 'ozi-core/css/ozi-core.css',
        'loaddata'       => 'ozi-loaddata/css/ozi-loaddata.css',
        'select'         => 'ozi-select/css/ozi-select.css',
        'audio'          => 'ozi-audio/css/ozi-audio.css',
        'editor'         => 'ozi-editor/css/ozi-editor.css',
        'auth'           => 'ozi-addons/css/ozi-auth.css',
    ];

    protected array $availableScripts = [
        'loaddata'       => 'ozi-loaddata/js/ozi-loaddata.js',
        'select'         => 'ozi-select/js/ozi-select.js',
        'audio'          => 'ozi-audio/js/ozi-audio.js',
        'autocomplete'   => 'ozi-autocomplete/js/ozi-autocomplete.js',
        'editor'         => 'ozi-editor/js/ozi-editor.js',
        'search'         => 'ozi-search/js/ozi-search.js',
        'addons'         => 'ozi-addons/js/ozi-addons.js',
        'auth'           => 'ozi-addons/js/ozi-auth.js',
        'check'          => 'ozi-addons/js/ozi-check.js',
        'copy'           => 'ozi-addons/js/ozi-copy.js',
        'toggle'         => 'ozi-addons/js/ozi-toggle.js',
    ];

    // plugins que sempre devem ser carregados juntos
    protected array $groups = [
        'auth'  => ['auth', 'check', 'copy', 'toggle', 'addons'],
        'forms' => ['loaddata', 'select', 'autocomplete', 'auth', 'check'],
        'full'  => [], // vazio = carrega tudo
    ];

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
        // sem filtro — retorna tudo
        if (empty($only)) {
            return array_values($available);
        }

        $keys = [];

        foreach ($only as $key) {
            $key = strtolower(trim($key));

            // é um grupo?
            if (isset($this->groups[$key])) {
                $groupKeys = $this->groups[$key];

                // grupo vazio = tudo
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

        // dedup mantendo ordem
        $keys = array_unique($keys);

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