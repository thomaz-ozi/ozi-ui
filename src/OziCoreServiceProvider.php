<?php

namespace OziUI\Core;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Blade;

class OziCoreServiceProvider extends ServiceProvider
{
    /**
     * Todos os assets publicáveis do ecossistema ozi-ui.
     */
    public function boot(): void
    {
        $this->publishAssets();
        $this->publishConfig();
        $this->registerBladeDirectives();
    }

    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__ . '/../config/ozi-ui.php',
            'ozi-ui'
        );
    }

    // ──────────────────────────────────────────────────────────────
    // Assets
    // ──────────────────────────────────────────────────────────────

    protected function publishAssets(): void
    {
        // Publica TUDO de uma vez
        $this->publishes([
            __DIR__ . '/../public' => public_path('plugins/ozi-ui'),
        ], 'ozi-ui');

        // Ou por plugin individualmente
        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-core.js' => public_path('plugins/ozi-ui/ozi-core.js'),
            __DIR__ . '/../public/plugins/ozi-ui/ozi-core.css' => public_path('plugins/ozi-ui/ozi-core.css'),
        ], 'ozi-ui-core');

        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-loaddata' => public_path('plugins/ozi-ui/ozi-loaddata'),
        ], 'ozi-ui-loaddata');

        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-select' => public_path('plugins/ozi-ui/ozi-select'),
        ], 'ozi-ui-select');

        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-search' => public_path('plugins/ozi-ui/ozi-search'),
        ], 'ozi-ui-search');

        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-editor' => public_path('plugins/ozi-ui/ozi-editor'),
        ], 'ozi-ui-editor');

        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-autocomplete' => public_path('plugins/ozi-ui/ozi-autocomplete'),
        ], 'ozi-ui-autocomplete');

        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-audio' => public_path('plugins/ozi-ui/ozi-audio'),
        ], 'ozi-ui-audio');

        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui/ozi-addons' => public_path('plugins/ozi-ui/ozi-addons'),
        ], 'ozi-ui-addons');
    }

    // ──────────────────────────────────────────────────────────────
    // Config
    // ──────────────────────────────────────────────────────────────

    protected function publishConfig(): void
    {
        $this->publishes([
            __DIR__ . '/../config/ozi-ui.php' => config_path('ozi-ui.php'),
        ], 'ozi-ui-config');
    }

    // ──────────────────────────────────────────────────────────────
    // Blade Directives
    // ──────────────────────────────────────────────────────────────

    protected function registerBladeDirectives(): void
    {
        /**
         * @oziStyles
         * Carrega o CSS do core + plugins configurados.
         *
         * Uso: @oziStyles
         */
        Blade::directive('oziStyles', function () {
            return "<?php echo app(\OziUI\Core\OziAssets::class)->styles(); ?>";
        });

        /**
         * @oziScripts
         * Carrega o JS do core + plugins configurados.
         *
         * Uso: @oziScripts
         */
        Blade::directive('oziScripts', function () {
            return "<?php echo app(\OziUI\Core\OziAssets::class)->scripts(); ?>";
        });

        /**
         * @oziPlugin('nome')
         * Carrega CSS + JS de um plugin específico.
         *
         * Uso: @oziPlugin('ozi-select')
         */
        Blade::directive('oziPlugin', function (string $expression) {
            return "<?php echo app(\OziUI\Core\OziAssets::class)->plugin({$expression}); ?>";
        });
    }
}
