<?php

namespace OziUI\Core\Tests;

use Illuminate\Support\Facades\File;

class OziCheckCommandTest extends TestCase
{
    private string $published;

    protected function setUp(): void
    {
        parent::setUp();

        $this->published = public_path('plugins/ozi-ui');
        File::deleteDirectory(public_path('plugins'));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(public_path('plugins'));

        parent::tearDown();
    }

    public function test_passes_on_a_clean_install(): void
    {
        $this->artisan('ozi:check')->assertSuccessful();
    }

    public function test_fails_when_deps_drift_from_the_plugin_map(): void
    {
        // O ozi:check prefere a cópia publicada: publicar um ozi-conf.js com o
        // deps: do editor esvaziado simula a deriva sem tocar no pacote.
        $conf    = file_get_contents(__DIR__ . '/../public/plugins/ozi-ui/core/ozi-conf.js');
        $drifted = preg_replace("/('editor'\s*:\s*\{\s*deps:\s*)\[[^\]]*\]/", '$1[]', $conf, 1, $count);
        $this->assertSame(1, $count, 'fixture: entrada do editor não encontrada no _pluginMap');

        File::ensureDirectoryExists($this->published . '/core');
        file_put_contents($this->published . '/core/ozi-conf.js', $drifted);

        $this->artisan('ozi:check')
            ->expectsOutputToContain('deriva de deps: editor')
            ->assertFailed();
    }

    public function test_fails_when_the_plugin_map_declares_a_missing_file(): void
    {
        $conf    = file_get_contents(__DIR__ . '/../public/plugins/ozi-ui/core/ozi-conf.js');
        $drifted = str_replace(
            "'components/ozi-select/js/ozi-select.js'",
            "'components/ozi-select/js/ozi-select-renomeado.js'",
            $conf,
            $count
        );
        $this->assertGreaterThan(0, $count, 'fixture: path do select não encontrado no _pluginMap');

        File::ensureDirectoryExists($this->published . '/core');
        file_put_contents($this->published . '/core/ozi-conf.js', $drifted);

        $this->artisan('ozi:check')->assertFailed();
    }
}
