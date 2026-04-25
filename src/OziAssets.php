<?php

namespace OziUI\Core;

class OziAssets
{
    protected array $config;

    // Mapa de plugins com seus arquivos CSS e JS
    protected array $pluginMap = [
        'ozi-loaddata' => [
            'css' => ['ozi-loaddata/css/ozi-loaddata.css'],
            'js'  => ['ozi-loaddata/js/ozi-loaddata.js'],
        ],
        'ozi-select' => [
            'css' => ['ozi-select/css/ozi-select.css'],
            'js'  => ['ozi-select/js/ozi-select.js'],
        ],
        'ozi-select-livewire' => [
            'css' => [],
            'js'  => ['ozi-select/js/ozi-select.livewire.js'],
        ],
        'ozi-search' => [
            'css' => [],
            'js'  => ['ozi-search/js/ozi-search.js'],
        ],
        'ozi-editor' => [
            'css' => ['ozi-editor/css/ozi-editor.css'],
            'js'  => ['ozi-editor/js/ozi-editor.js'],
        ],
        'ozi-autocomplete' => [
            'css' => ['ozi-autocomplete/css/ozi-autocomplete.css'],
            'js'  => ['ozi-autocomplete/js/ozi-autocomplete.js'],
        ],
        'ozi-audio' => [
            'css' => ['ozi-audio/css/ozi-audio.css'],
            'js'  => ['ozi-audio/js/ozi-audio.js'],
        ],
        'ozi-addons' => [
            'css' => [
                'ozi-addons/css/ozi-toggle.css',
                'ozi-addons/css/ozi-copy.css',
                'ozi-addons/css/ozi-check.css',
                'ozi-addons/css/ozi-auth.css',
            ],
            'js' => [
                'ozi-addons/js/ozi-addons.js',
                'ozi-addons/js/ozi-toggle.js',
                'ozi-addons/js/ozi-copy.js',
                'ozi-addons/js/ozi-check.js',
                'ozi-addons/js/ozi-auth.js',
            ],
        ],
    ];

    public function __construct()
    {
        $this->config = config('ozi-ui', []);
    }

    // ──────────────────────────────────────────────────────────────
    // Retorna todos os <link> CSS configurados
    // ──────────────────────────────────────────────────────────────

    public function styles(): string
    {
        $html = [];

        // CSS do core
        $html[] = $this->link('ozi-core.css');

        // CSS dos plugins ativos
        foreach ($this->activePlugins() as $plugin) {
            foreach ($this->pluginMap[$plugin]['css'] ?? [] as $file) {
                $html[] = $this->link($file);
            }
        }

        return implode("\n", array_filter($html));
    }

    // ──────────────────────────────────────────────────────────────
    // Retorna todos os <script> JS configurados
    // ──────────────────────────────────────────────────────────────

    public function scripts(): string
    {
        $html = [];

        // JS do core
        $html[] = $this->script('ozi-core.js');

        // JS dos plugins ativos
        foreach ($this->activePlugins() as $plugin) {
            foreach ($this->pluginMap[$plugin]['js'] ?? [] as $file) {
                $html[] = $this->script($file);
            }
        }

        return implode("\n", array_filter($html));
    }

    // ──────────────────────────────────────────────────────────────
    // Carrega CSS + JS de um plugin específico
    // ──────────────────────────────────────────────────────────────

    public function plugin(string $name): string
    {
        if (!isset($this->pluginMap[$name])) {
            return "<!-- ozi-ui: plugin [{$name}] não encontrado -->";
        }

        $html = [];

        foreach ($this->pluginMap[$name]['css'] ?? [] as $file) {
            $html[] = $this->link($file);
        }

        foreach ($this->pluginMap[$name]['js'] ?? [] as $file) {
            $html[] = $this->script($file);
        }

        return implode("\n", array_filter($html));
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers internos
    // ──────────────────────────────────────────────────────────────

    protected function activePlugins(): array
    {
        return $this->config['plugins'] ?? array_keys($this->pluginMap);
    }

    protected function base(): string
    {
        return rtrim($this->config['base_path'] ?? 'plugins/ozi-ui', '/');
    }

    protected function link(string $file): string
    {
        $url = asset($this->base() . '/' . $file);
        return "<link rel=\"stylesheet\" href=\"{$url}\">";
    }

    protected function script(string $file): string
    {
        $url = asset($this->base() . '/' . $file);
        return "<script src=\"{$url}\" data-navigate-once></script>";
    }
}
