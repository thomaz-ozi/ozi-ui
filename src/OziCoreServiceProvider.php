<?php

namespace OziUI\Core;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Blade;

class OziCoreServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Alterado para a tag 'ozi-ui' conforme sua preferência
        $this->publishes([
            __DIR__ . '/../public' => public_path('plugins/ozi-ui'),
        ], 'ozi-ui');

        // Mantendo as diretivas Blade
        Blade::directive('oziStyles', function (string $expression) {
            $expr = empty(trim($expression)) ? '[]' : $expression;
            return "<?php echo app(\OziUI\Core\OziAssets::class)->styles({$expr}); ?>";
        });

        Blade::directive('oziScripts', function (string $expression) {
            $expr = empty(trim($expression)) ? '[]' : $expression;
            return "<?php echo app(\OziUI\Core\OziAssets::class)->scripts({$expr}); ?>";
        });
    }

    public function register(): void
    {
        $this->app->singleton(OziAssets::class, function () {
            return new OziAssets();
        });
    }
}