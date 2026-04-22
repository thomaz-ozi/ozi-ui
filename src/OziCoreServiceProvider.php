<?php

namespace OziUI\Core;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Blade;
use OziUI\Core\Commands\OziCheckCommand;

class OziCoreServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->publishAssets();
        $this->publishConfig();
        $this->registerBladeDirectives();
        $this->registerCommands();
    }

    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__ . '/../config/ozi-ui.php',
            'ozi-ui'
        );

        $this->app->singleton(OziAssets::class, function () {
            return new OziAssets();
        });
    }

    // ──────────────────────────────────────────────────────────────
    // Commands
    // ──────────────────────────────────────────────────────────────

    protected function registerCommands(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                OziCheckCommand::class,
            ]);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Assets
    // ──────────────────────────────────────────────────────────────

    protected function publishAssets(): void
    {
        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui' => public_path('plugins/ozi-ui'),
        ], 'ozi-ui');


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
        Blade::directive('oziStyles', function () {
            return "<?php echo app(\OziUI\Core\OziAssets::class)->styles(); ?>";
        });

        Blade::directive('oziScripts', function () {
            return "<?php echo app(\OziUI\Core\OziAssets::class)->scripts(); ?>";
        });

        Blade::directive('oziPlugin', function (string $expression) {
            return "<?php echo app(\OziUI\Core\OziAssets::class)->plugin({$expression}); ?>";
        });
    }
}
