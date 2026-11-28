<?php

namespace OziUI\Core\Tests;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

/**
 * `php artisan ozi:upgrade` (2.12.0): atualiza a cópia publicada, lista o que mudou desde a última
 * vez (CHANGELOG.md, segurança em destaque) e roda o `ozi:check --lint`.
 */
class OziUpgradeCommandTest extends TestCase
{
    private string $published;
    private string $marker;
    private string $views;

    protected function setUp(): void
    {
        parent::setUp();
        $this->published = public_path('plugins/ozi-ui');
        $this->marker    = storage_path('app/ozi-ui.version');
        $this->views     = resource_path('views/ozi-upgrade-fixture');
        File::deleteDirectory(public_path('plugins'));
        File::deleteDirectory($this->views);
        @unlink($this->marker);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(public_path('plugins'));
        File::deleteDirectory($this->views);
        @unlink($this->marker);
        parent::tearDown();
    }

    private function pkgVersion(): string
    {
        return json_decode(file_get_contents(__DIR__ . '/../composer.json'), true)['version'];
    }

    /** @return array{0:int,1:string} */
    private function upgrade(array $opts = []): array
    {
        $exit = Artisan::call('ozi:upgrade', $opts);
        return [$exit, Artisan::output()];
    }

    public function test_without_published_copy_marks_the_version_and_runs_lint(): void
    {
        [$exit, $out] = $this->upgrade();

        $this->assertSame(0, $exit, $out);
        $this->assertStringContainsString('Versão instalada: ' . $this->pkgVersion(), $out);
        $this->assertStringContainsString('Sem cópia publicada', $out);
        $this->assertStringContainsString('Primeira vez do ozi:upgrade', $out);
        $this->assertStringContainsString('--lint:', $out, 'roda o ozi:check --lint no fim');
        $this->assertSame($this->pkgVersion(), trim(file_get_contents($this->marker)));
    }

    public function test_updates_the_published_copy_and_keeps_stale_files(): void
    {
        $pkg = __DIR__ . '/../public/plugins/ozi-ui';
        File::copyDirectory($pkg, $this->published);
        file_put_contents($this->published . '/core/ozi-attrs.js', '// versão velha');
        unlink($this->published . '/core/ozi-attrs.json');
        file_put_contents($this->published . '/core/arquivo-velho.js', '//');

        [$exit, $out] = $this->upgrade(['--no-lint' => true]);

        $this->assertSame(0, $exit, $out);
        $this->assertMatchesRegularExpression('/Cópia publicada .*plugins\/ozi-ui: 1 atualizados, 1 novos/', $out);
        $this->assertStringContainsString('1 arquivo(s) da cópia não existem mais no pacote', $out);
        $this->assertStringContainsString('core/arquivo-velho.js', $out);
        $this->assertFileEquals($pkg . '/core/ozi-attrs.js', $this->published . '/core/ozi-attrs.js');
        $this->assertFileExists($this->published . '/core/ozi-attrs.json');
        $this->assertFileExists($this->published . '/core/arquivo-velho.js', 'não apaga');
        $this->assertStringNotContainsString('--lint:', $out, '--no-lint');

        [, $again] = $this->upgrade(['--no-lint' => true]);
        $this->assertStringContainsString('já igual ao pacote', $again);
    }

    public function test_dry_run_changes_nothing(): void
    {
        File::copyDirectory(__DIR__ . '/../public/plugins/ozi-ui', $this->published);
        file_put_contents($this->published . '/core/ozi-attrs.js', '// versão velha');

        [$exit, $out] = $this->upgrade(['--dry-run' => true, '--no-lint' => true]);

        $this->assertSame(0, $exit, $out);
        $this->assertStringContainsString('1 seriam atualizados', $out);
        $this->assertSame('// versão velha', file_get_contents($this->published . '/core/ozi-attrs.js'));
        $this->assertFileDoesNotExist($this->marker);
    }

    public function test_lists_versions_since_the_last_upgrade_with_security_first(): void
    {
        File::ensureDirectoryExists(dirname($this->marker));
        file_put_contents($this->marker, "2.11.4\n");

        [, $out] = $this->upgrade(['--no-lint' => true]);

        $this->assertStringContainsString('Desde a 2.11.4:', $out);
        $this->assertStringContainsString('correção(ões) de segurança', $out);
        $this->assertMatchesRegularExpression('/2\.11\.5\s+segurança \(1\)/', $out);
        $this->assertStringContainsString('ozi-search: highlighted item text is no longer parsed as HTML.', $out);
        $this->assertDoesNotMatchRegularExpression('/^\s+2\.11\.4\s/m', $out, 'a versão anterior não entra');
        $this->assertSame($this->pkgVersion(), trim(file_get_contents($this->marker)));
    }

    public function test_returns_the_lint_exit_code(): void
    {
        File::ensureDirectoryExists($this->views);
        file_put_contents($this->views . '/form.blade.php', "@oziScripts(['select'])\n<div data-ozi-selcet=\"x\"></div>\n");

        [$exit, $out] = $this->upgrade();

        $this->assertSame(1, $exit, $out);
        $this->assertStringContainsString("OZI-W001 resources/views/ozi-upgrade-fixture/form.blade.php:2 atributo desconhecido 'data-ozi-selcet'", $out);
    }
}
