<?php

namespace OziUI\Core\Tests;

use OziUI\Core\OziAssets;

class OziAssetsTest extends TestCase
{
    private const VALIDATE  = 'modules/ozi-validate/js/ozi-validate.js';
    private const SANITIZE  = 'modules/ozi-editor-sanitize/js/ozi-editor-sanitize.js';
    private const EDITOR    = 'components/ozi-editor/js/ozi-editor.js';
    private const SELECT    = 'components/ozi-select/js/ozi-select.js';
    private const LOADDATA  = 'modules/ozi-loaddata/js/ozi-loaddata.js';
    private const ACTIONS   = 'modules/ozi-actions/js/ozi-actions.js';
    private const SUGGEST   = 'modules/ozi-suggest/js/ozi-suggest.js';

    // ── deps: (2.6.0) ────────────────────────────────────────────────

    public function test_editor_pulls_its_deps_before_itself(): void
    {
        $paths = $this->pluginPaths($this->assets()->scripts(['editor']));

        $this->assertContains(self::VALIDATE, $paths);
        $this->assertContains(self::SANITIZE, $paths);
        $this->assertLessThan(array_search(self::EDITOR, $paths), array_search(self::SANITIZE, $paths));
        $this->assertLessThan(array_search(self::EDITOR, $paths), array_search(self::VALIDATE, $paths));
    }

    public function test_deps_are_resolved_transitively(): void
    {
        // select → loaddata → actions (actions não é dep direta do select)
        $paths = $this->pluginPaths($this->assets()->scripts(['select']));

        foreach ([self::LOADDATA, self::SUGGEST, self::VALIDATE, self::ACTIONS, self::SELECT] as $path) {
            $this->assertContains($path, $paths);
        }
    }

    public function test_key_order_does_not_change_output(): void
    {
        $this->assertSame(
            $this->assets()->scripts(['editor', 'editor-sanitize']),
            $this->assets()->scripts(['editor-sanitize', 'editor'])
        );
    }

    public function test_output_follows_canonical_order(): void
    {
        $paths    = $this->pluginPaths($this->assets()->scripts(['toggle', 'select', 'validate']));
        $expected = array_values(array_filter(
            array_values($this->assets()->getAvailableScripts()),
            fn (string $path) => in_array($path, $paths, true)
        ));

        $this->assertSame($expected, $paths);
    }

    public function test_every_declared_dep_is_a_known_key(): void
    {
        $scripts = $this->assets()->getAvailableScripts();

        foreach ($this->assets()->getScriptDeps() as $key => $deps) {
            $this->assertArrayHasKey($key, $scripts, "deps de chave desconhecida: {$key}");
            foreach ($deps as $dep) {
                $this->assertArrayHasKey($dep, $scripts, "{$key} depende de chave desconhecida: {$dep}");
            }
        }
    }

    // ── grupos e chaves ──────────────────────────────────────────────

    public function test_empty_list_and_full_group_emit_everything(): void
    {
        $all = count($this->assets()->getAvailableScripts());

        $this->assertCount($all, $this->pluginPaths($this->assets()->scripts()));
        $this->assertCount($all, $this->pluginPaths($this->assets()->scripts(['full'])));
    }

    public function test_forms_group_brings_suggest(): void
    {
        $this->assertContains(self::SUGGEST, $this->pluginPaths($this->assets()->scripts(['forms'])));
    }

    public function test_livewire_group_brings_the_components_it_adapts(): void
    {
        $paths = $this->pluginPaths($this->assets()->scripts(['livewire']));

        $this->assertContains('integrations/adapters/ozi-livewire.adapter.js', $paths);
        $this->assertContains(self::SELECT, $paths);
        $this->assertContains(self::EDITOR, $paths);
    }

    public function test_shims_are_opt_in(): void
    {
        $default = $this->pluginPaths($this->assets()->scripts(['forms', 'livewire']));
        $shims   = $this->pluginPaths($this->assets()->scripts(['shims-v1']));

        $this->assertNotContains('integrations/adapters/ozi-change-v1-compat.shim.js', $default);
        $this->assertContains('integrations/adapters/ozi-change-v1-compat.shim.js', $shims);
    }

    public function test_keys_are_trimmed_and_case_insensitive(): void
    {
        $this->assertContains(self::SELECT, $this->pluginPaths($this->assets()->scripts(['  Select '])));
    }

    public function test_unknown_key_emits_no_plugin(): void
    {
        $html = $this->assets()->scripts(['does-not-exist']);

        $this->assertSame([], $this->pluginPaths($html));
        $this->assertStringContainsString('core/ozi-conf.js', $html, 'o boot do core sai sempre');
    }

    public function test_styles_emit_only_what_was_asked(): void
    {
        $this->assertSame(
            ['components/ozi-select/css/ozi-select.css'],
            $this->pluginPaths($this->assets()->styles(['select']))
        );
    }

    // ── versão e base ────────────────────────────────────────────────

    public function test_cache_busting_uses_the_package_version(): void
    {
        $composer = json_decode(file_get_contents(__DIR__ . '/../composer.json'), true);

        $this->assertStringContainsString(
            'ozi-select.js?v=' . $composer['version'],
            (new OziAssets())->scripts(['select'])
        );
    }

    public function test_base_follows_config(): void
    {
        config(['ozi-ui.base_path' => 'assets/ozi']);

        $this->assertStringContainsString('/assets/ozi/core/ozi-conf.js', (new OziAssets())->scripts([]));
    }

    // ── locale ───────────────────────────────────────────────────────

    public function test_locale_is_normalized_from_laravel(): void
    {
        $cases = ['pt_BR' => 'pt-BR', 'pt-br' => 'pt-BR', 'pt-PT' => 'pt-BR', 'es_ES' => 'es', 'en_US' => 'en', 'fr' => 'en'];

        foreach ($cases as $appLocale => $expected) {
            $this->app->setLocale($appLocale);

            $this->assertStringContainsString(
                'lang:"' . $expected . '"',
                (new OziAssets())->scripts([]),
                "locale {$appLocale}"
            );
        }
    }

    public function test_dictionaries_are_emitted_without_vendor_publish(): void
    {
        // Modo rota-fallback (só composer require): os dicionários existem no pacote
        // e precisam sair, senão todo _t() cai no fallback embutido.
        $this->app->setLocale('pt_BR');
        $paths = $this->langPaths((new OziAssets())->setBase('/p/')->setVersion('T')->scripts(['select']));

        $this->assertContains('shared/lang/pt-BR.js', $paths);
        $this->assertContains('components/ozi-select/lang/pt-BR.js', $paths);
        $this->assertNotContains('components/ozi-editor/lang/pt-BR.js', $paths, 'só o lang do que foi carregado');
    }

    public function test_dictionaries_come_after_the_boot_and_before_the_plugins(): void
    {
        // os arquivos de lang chamam OZI.lang.register(), que só existe depois do boot imediato
        $html = $this->assets()->scripts(['select']);

        $this->assertLessThan(strpos($html, 'shared/lang/'), strpos($html, 'OziConf.init()'));
        $this->assertLessThan(strpos($html, 'components/ozi-select/js/'), strpos($html, 'components/ozi-select/lang/'));
    }

    public function test_unsupported_locale_falls_back_to_english_dictionaries(): void
    {
        $this->app->setLocale('fr');

        $this->assertContains(
            'components/ozi-select/lang/en.js',
            $this->langPaths((new OziAssets())->setBase('/p/')->setVersion('T')->scripts(['select']))
        );
    }
}
