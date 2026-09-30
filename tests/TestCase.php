<?php

namespace OziUI\Core\Tests;

use Orchestra\Testbench\TestCase as Orchestra;
use OziUI\Core\OziAssets;
use OziUI\Core\OziCoreServiceProvider;

abstract class TestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [OziCoreServiceProvider::class];
    }

    /** OziAssets com base e versão fixas, para asserções sobre o HTML emitido. */
    protected function assets(): OziAssets
    {
        return (new OziAssets())->setBase('/p/')->setVersion('T');
    }

    /**
     * Paths de plugin emitidos (sem base e sem ?v=), na ordem em que aparecem.
     * Ignora o boot do core (helpers/conf/lang/...) e os dicionários i18n.
     *
     * @return array<int,string>
     */
    protected function pluginPaths(string $html): array
    {
        return array_values(array_filter(
            $this->emittedPaths($html),
            fn (string $path) => !str_starts_with($path, 'core/') && !str_contains($path, '/lang/')
        ));
    }

    /** @return array<int,string> só os dicionários i18n emitidos */
    protected function langPaths(string $html): array
    {
        return array_values(array_filter(
            $this->emittedPaths($html),
            fn (string $path) => str_contains($path, '/lang/')
        ));
    }

    /** @return array<int,string> */
    private function emittedPaths(string $html): array
    {
        preg_match_all('#(?:src|href)="/p/([^"?]+)\?v=T"#', $html, $m);

        return $m[1];
    }
}
