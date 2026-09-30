<?php

namespace OziUI\Core\Tests;

use Illuminate\Support\Facades\Route;
use Laravel\SerializableClosure\SerializableClosure;
use ReflectionFunction;

class AssetRouteTest extends TestCase
{
    public function test_serves_package_assets_with_the_right_mime(): void
    {
        $js = $this->get('/plugins/ozi-ui/ozi.js')->assertOk();
        $this->assertStringStartsWith('text/javascript', $js->headers->get('Content-Type'));

        $css = $this->get('/plugins/ozi-ui/components/ozi-select/css/ozi-select.css')->assertOk();
        $this->assertStringStartsWith('text/css', $css->headers->get('Content-Type'));

        $svg = $this->get('/plugins/ozi-ui/components/ozi-editor/svg/icon-link.svg')->assertOk();
        $this->assertStringStartsWith('image/svg+xml', $svg->headers->get('Content-Type'));
    }

    public function test_missing_file_is_404(): void
    {
        $this->get('/plugins/ozi-ui/nao-existe.js')->assertNotFound();
    }

    public function test_extension_outside_whitelist_is_404(): void
    {
        // arquivo real dentro da raiz de assets, mas .php não é servível
        $this->get('/plugins/ozi-ui/integrations/ozi-usage-example.blade.php')->assertNotFound();
    }

    public function test_path_traversal_is_404(): void
    {
        $this->get('/plugins/ozi-ui/../../../composer.json')->assertNotFound();
        $this->get('/plugins/ozi-ui/%2e%2e/%2e%2e/%2e%2e/composer.json')->assertNotFound();
    }

    public function test_cache_headers_depend_on_debug(): void
    {
        config(['app.debug' => true]);
        $this->assertStringContainsString(
            'no-cache',
            $this->get('/plugins/ozi-ui/ozi.js')->headers->get('Cache-Control')
        );

        config(['app.debug' => false]);
        $cache = $this->get('/plugins/ozi-ui/ozi.js')->headers->get('Cache-Control');
        $this->assertStringContainsString('immutable', $cache);
        $this->assertStringContainsString('max-age=31536000', $cache);
    }

    public function test_route_closure_survives_route_cache(): void
    {
        // 2.6.0: com `$this` capturado, o route:cache serializava o provider inteiro
        // (e o container) e estourava a memória no deploy.
        $action = Route::getRoutes()->getByName('ozi-ui.asset')->getAction('uses');

        $this->assertNull((new ReflectionFunction($action))->getClosureThis(), 'a closure da rota precisa ser static');

        // o nome da classe aparece só como `scope`; o que não pode vir é o objeto
        $serialized = serialize(new SerializableClosure($action));
        $this->assertStringContainsString('s:4:"this";N;', $serialized);
        $this->assertLessThan(20000, strlen($serialized));
    }
}
