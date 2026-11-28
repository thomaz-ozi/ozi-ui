<?php

namespace OziUI\Core\Tests;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

/**
 * `php artisan ozi:check --lint` (2.12.0, N7): atributos data-ozi-* / data-zld-* das views contra
 * o registro dos manifestos (OZI-W001) e plugins usados que nenhum @oziScripts carrega (OZI-W003).
 */
class OziCheckLintTest extends TestCase
{
    private string $views;

    protected function setUp(): void
    {
        parent::setUp();
        $this->views = resource_path('views/ozi-lint-fixture');
        File::deleteDirectory($this->views);
        File::ensureDirectoryExists($this->views);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->views);
        parent::tearDown();
    }

    private function writeView(string $name, string $src): void
    {
        file_put_contents($this->views . '/' . $name . '.blade.php', $src);
    }

    /** @return array{0:int,1:string} */
    private function lint(bool $lint = true): array
    {
        // Artisan::call: o texto sai em várias linhas e com tags de cor removidas no output
        $exit = Artisan::call('ozi:check', $lint ? ['--lint' => true] : []);
        return [$exit, Artisan::output()];
    }

    public function test_clean_views_pass(): void
    {
        $this->writeView('layout', "<body>\n@oziScripts(['select', 'editor-md', 'livewire'])\n</body>\n");
        $this->writeView('form', implode("\n", [
            '<div data-ozi-select="uf" data-ozi-select-value-placeholder="Estado"',
            '     data-ozi-livewire-model="uf" data-ozi-required="true"></div>',
            '<textarea data-ozi-editor-md="texto"></textarea>',
            '<button data-zld-url="/salvar" data-zld-form-busy="true">Salvar</button>',
        ]) . "\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(0, $exit, $out);
        $this->assertStringContainsString('--lint: atributos data-ozi-* e plugins carregados nas views OK', $out);
        $this->assertStringNotContainsString('OZI-W001', $out);
        $this->assertStringNotContainsString('OZI-W003', $out);
    }

    public function test_unknown_attribute_with_suggestion_fails(): void
    {
        $this->writeView('layout', "@oziScripts(['select'])\n");
        $this->writeView('form', "<div\n  data-ozi-select=\"uf\" data-ozi-select-multple=\"true\"></div>\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(1, $exit, $out);
        $this->assertStringContainsString(
            "OZI-W001 resources/views/ozi-lint-fixture/form.blade.php:2 atributo desconhecido 'data-ozi-select-multple' — você quis dizer 'data-ozi-select-multiple'?",
            $out
        );
        $this->assertStringContainsString('--lint: 1 achado(s) nas views.', $out);
    }

    public function test_without_lint_the_attribute_check_does_not_run(): void
    {
        $this->writeView('form', "<div data-ozi-select-placehlder=\"x\"></div>\n");

        [$exit, $out] = $this->lint(false);

        $this->assertSame(0, $exit, $out);
        $this->assertStringNotContainsString('OZI-W001', $out);
    }

    public function test_removed_and_renamed_attributes_say_so(): void
    {
        $this->writeView('layout', "@oziScripts()\n");
        $this->writeView('form', implode("\n", [
            '<div data-ozi-audio="recorder" data-ozi-audio-preview="true"></div>',
            '<input type="checkbox" data-ozi-check-all="g">',
            '<button data-ozi-copy="x">copiar</button>',
        ]) . "\n");

        [, $out] = $this->lint();

        $this->assertStringContainsString("'data-ozi-audio-preview' — ele saiu na 2.2", $out);
        $this->assertStringContainsString("'data-ozi-check-all' — você quis dizer 'data-ozi-check-group'?", $out);
        $this->assertStringContainsString("'data-ozi-copy' — saiu na 2.0 (receitas Alpine)", $out);
    }

    public function test_zld_prefix_is_checked_too(): void
    {
        $this->writeView('layout', "@oziScripts(['loaddata'])\n");
        $this->writeView('form', "<button data-zld-url=\"/a\" data-zld-destny-id=\"d\">ok</button>\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(1, $exit, $out);
        $this->assertStringContainsString("atributo desconhecido 'data-zld-destny-id' — você quis dizer 'data-zld-destiny-id'?", $out);
        $this->assertStringNotContainsString("'data-zld-url'", $out);
    }

    public function test_plugin_not_loaded(): void
    {
        $this->writeView('layout', "@oziScripts(['select'])\n");
        $this->writeView('form', implode("\n", [
            '<div data-ozi-select="uf"></div>',
            '<textarea data-ozi-editor-html="corpo"></textarea>',
            '<div data-ozi-select="b" data-ozi-livewire-model="b"></div>',
        ]) . "\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(1, $exit, $out);
        $this->assertStringContainsString(
            "OZI-W003 resources/views/ozi-lint-fixture/form.blade.php:2 plugin 'editor' usado e nenhum @oziScripts das views o carrega — acrescente 'editor'",
            $out
        );
        $this->assertStringContainsString("plugin 'livewire-adapter' usado e nenhum @oziScripts das views o carrega — acrescente o grupo 'livewire'", $out);
        $this->assertStringNotContainsString("plugin 'select'", $out);
    }

    public function test_dependencies_and_groups_count_as_loaded(): void
    {
        // select puxa loaddata/validate; o grupo forms traz autocomplete
        $this->writeView('layout', "@oziScripts(['select', 'forms'])\n");
        $this->writeView('form', implode("\n", [
            '<button data-zld-url="/a">ok</button>',
            '<input data-ozi-validate="cpf">',
            '<input data-ozi-autocomplete="cidade">',
        ]) . "\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(0, $exit, $out);
    }

    public function test_scripts_without_list_load_everything(): void
    {
        $this->writeView('layout', "@oziScripts\n");
        $this->writeView('form', "<textarea data-ozi-editor-html=\"x\"></textarea>\n<div data-ozi-audio=\"player\"></div>\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(0, $exit, $out);
        $this->assertStringNotContainsString('OZI-W003', $out);
    }

    public function test_no_ozi_scripts_skips_the_loaded_check(): void
    {
        $this->writeView('form', "<div data-ozi-select=\"uf\"></div>\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(0, $exit, $out);
        $this->assertStringContainsString('nenhum @oziScripts nas views', $out);
    }

    public function test_js_strings_and_blade_built_names_are_not_attributes(): void
    {
        $this->writeView('layout', "@oziScripts(['select'])\n");
        $this->writeView('form', implode("\n", [
            "<script>document.querySelector('[data-ozi-selcet]'); el.getAttribute('data-ozi-nada');</script>",
            '<div data-ozi-select-{{ $campo }}="x" data-ozi-{{ $p }}="y"></div>',
        ]) . "\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(0, $exit, $out);
        $this->assertStringNotContainsString('OZI-W001', $out);
    }

    public function test_unknown_scripts_key_also_fails_with_lint(): void
    {
        $this->writeView('layout', "@oziScripts(['ozi-validate'])\n");

        [$exit, $out] = $this->lint();

        $this->assertSame(1, $exit, $out);
        $this->assertStringContainsString('OZI-W002', $out);
    }
}
