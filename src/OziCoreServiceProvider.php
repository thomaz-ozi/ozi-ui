<?php

namespace OziUI\Core;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use OziUI\Core\Commands\OziCheckCommand;

class OziCoreServiceProvider extends ServiceProvider
{
    /** Diretório dos assets dentro do próprio pacote (fonte da rota-fallback). */
    protected string $assetsRoot = __DIR__ . '/../public/plugins/ozi-ui';

    /**
     * Extensões servíveis pela rota-fallback. Whitelist proposital:
     * mantém .php/.blade.php (ex.: ozi-usage-example.blade.php) fora do alcance.
     */
    protected array $mimes = [
        'css'  => 'text/css',
        'js'   => 'text/javascript',
        'mjs'  => 'text/javascript',
        'map'  => 'application/json',
        'json' => 'application/json',
        'svg'  => 'image/svg+xml',
    ];

    public function boot(): void
    {
        // Assets físicos: publish continua disponível (produção = webserver serve direto).
        $this->publishes([
            __DIR__ . '/../public/plugins/ozi-ui' => public_path('plugins/ozi-ui'),
        ], 'ozi-ui');

        // Config publicável (mesmo tag, para sair junto no vendor:publish --tag=ozi-ui).
        $this->publishes([
            __DIR__ . '/../config/ozi-ui.php' => config_path('ozi-ui.php'),
        ], 'ozi-ui');

        $this->registerAssetRoute();

        if ($this->app->runningInConsole()) {
            $this->commands([OziCheckCommand::class]);
        }

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
        // Config disponível sem publish (ozi-ui.base_path, plugins, debug).
        $this->mergeConfigFrom(__DIR__ . '/../config/ozi-ui.php', 'ozi-ui');

        $this->app->singleton(OziAssets::class, function () {
            return new OziAssets();
        });
    }

    /**
     * Rota-fallback que serve os assets direto do pacote — instala e funciona
     * com um único `composer require`, sem `vendor:publish`.
     *
     * Em produção, quem rodar o publish coloca os arquivos no public/ e o
     * webserver os entrega antes de chegar ao PHP: esta rota nunca dispara.
     * Ou seja, publish vira otimização, não requisito.
     *
     * O prefixo espelha config('ozi-ui.base_path') — a mesma base que o
     * OziAssets usa em asset('plugins/ozi-ui/...').
     */
    protected function registerAssetRoute(): void
    {
        $base = trim((string) config('ozi-ui.base_path', 'plugins/ozi-ui'), '/');

        Route::get($base . '/{path}', function (string $path) {
            $root = realpath($this->assetsRoot);
            $file = realpath($this->assetsRoot . '/' . $path);

            // 404 se: base inacessível, path traversal para fora da raiz, ou não é arquivo.
            abort_if(
                $root === false
                    || $file === false
                    || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)
                    || !is_file($file),
                404
            );

            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            abort_unless(isset($this->mimes[$ext]), 404);

            $response = new BinaryFileResponse($file);
            $response->headers->set('Content-Type', $this->mimes[$ext]);
            $response->setAutoLastModified();

            // O OziAssets já faz cache-busting via ?v=; em debug evitamos cache
            // agressivo para o dev ver alterações sem trocar a versão.
            if (config('app.debug')) {
                $response->headers->set('Cache-Control', 'no-cache, must-revalidate');
            } else {
                $response->setPublic();
                $response->setMaxAge(31536000);
                $response->headers->addCacheControlDirective('immutable');
            }

            return $response;
        })
            ->where('path', '.*')
            ->name('ozi-ui.asset');
    }
}
