<?php

namespace OziUI\Core\Tests;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * OZI-W002 (2.10.0): chave desconhecida no @oziScripts/@oziStyles avisa em vez de sumir em
 * silêncio. Com APP_DEBUG: comentário HTML + console.warn. Sem: só Log::warning (decisão #25).
 */
class UnknownKeysTest extends TestCase
{
    public function test_valid_keys_and_groups_do_not_warn(): void
    {
        config(['app.debug' => true]);

        foreach ([['select'], ['forms'], ['livewire', 'editor-md'], ['password'], []] as $only) {
            $this->assertStringNotContainsString('OZI-W002', $this->assets()->scripts($only), json_encode($only));
        }
        foreach ([['select', 'reset'], ['auth'], ['password']] as $only) {
            // 'password' não tem CSS: é chave de script, não pode virar aviso no @oziStyles
            $this->assertStringNotContainsString('OZI-W002', $this->assets()->styles($only), json_encode($only));
        }
    }

    public function test_unknown_key_warns_in_debug_with_suggestion_and_keeps_the_rest(): void
    {
        config(['app.debug' => true]);
        $this->app->setLocale('pt_BR');

        $html = $this->assets()->scripts(['ozi-validate', 'select']);

        $this->assertStringContainsString("<!-- [OZI] OZI-W002 chave desconhecida &#039;ozi-validate&#039; em @oziScripts.", $html);
        $this->assertStringContainsString("Você quis dizer &#039;validate&#039;?", $html);
        $this->assertStringContainsString('<script>console.warn("[OZI] OZI-W002 chave desconhecida \\u0027ozi-validate\\u0027 em @oziScripts.', $html);
        $this->assertStringContainsString('https://oziui.com/docs/warnings#ozi-w002', $html);
        // o resto sai igual: select e as dependências dele
        $this->assertContains('components/ozi-select/js/ozi-select.js', $this->pluginPaths($html));
        // o aviso vai no topo; o fim é sempre o ready
        $this->assertStringStartsWith('<!-- [OZI] OZI-W002', $html);
        $this->assertStringEndsWith('/p/core/ozi-assets-ready.js?v=T"></script>', $html);
    }

    public function test_suggestions(): void
    {
        $a = $this->assets();

        $this->assertSame('validate', $a->suggestKey('ozi-validate'));
        $this->assertSame('select', $a->suggestKey('selct'));
        $this->assertSame('select', $a->suggestKey('selects'));
        $this->assertSame('password', $a->suggestKey('password-rules'));
        $this->assertSame('editor-md', $a->suggestKey('markdown'));
        $this->assertSame('livewire', $a->suggestKey('livewrie'));
        $this->assertNull($a->suggestKey('dropdown'));
        $this->assertNull($a->suggestKey('x'), 'chave curta não ganha sugestão aleatória');
    }

    public function test_unknown_key_without_suggestion_and_removed_plugin(): void
    {
        config(['app.debug' => true]);
        $this->app->setLocale('en');

        $html = $this->assets()->scripts(['dropdown', 'copy']);

        $this->assertStringContainsString("OZI-W002 unknown key &#039;dropdown&#039; in @oziScripts. Key list:", $html);
        $this->assertStringContainsString("OZI-W002 unknown key &#039;copy&#039; in @oziScripts. It was removed in 2.0.", $html);
    }

    public function test_styles_warn_too(): void
    {
        config(['app.debug' => true]);

        $this->assertStringContainsString("OZI-W002", $this->assets()->styles(['selectt']));
        $this->assertStringContainsString("@oziStyles", $this->assets()->styles(['selectt']));
    }

    public function test_production_logs_and_never_touches_the_html(): void
    {
        config(['app.debug' => false]);
        Log::spy();

        $html = $this->assets()->scripts(['ozi-validate']);

        $this->assertStringNotContainsString('OZI-W002', $html);
        $this->assertStringStartsWith('<script src="/p/core/helpers/ozi-helpers.js', $html);
        Log::shouldHaveReceived('warning')->once()->withArgs(fn ($m) => str_contains($m, "OZI-W002") && str_contains($m, "'ozi-validate'"));
    }

    public function test_each_call_reports_only_its_own_keys(): void
    {
        config(['app.debug' => true]);
        $a = $this->assets();

        $this->assertStringContainsString('OZI-W002', $a->scripts(['selectt']));
        $this->assertStringNotContainsString('OZI-W002', $a->scripts(['select']), 'o singleton não pode carregar o aviso da chamada anterior');
    }

    public function test_boot_tag_carries_debug_flag_and_attrs_loads_after_hooks(): void
    {
        config(['app.debug' => true]);
        $html = $this->assets()->scripts([]);
        $this->assertStringContainsString('data-ozi-debug="1"></script>', $html);
        $this->assertLessThan(strpos($html, 'core/ozi-attrs.js'), strpos($html, 'core/ozi-hooks.js'));
        $this->assertLessThan(strpos($html, 'core/ozi-assets-boot.js'), strpos($html, 'core/ozi-attrs.js'));

        config(['app.debug' => false]);
        $this->assertStringContainsString('data-ozi-debug="0"></script>', $this->assets()->scripts([]));
    }

    public function test_ozi_check_lists_unknown_keys_in_blade_views(): void
    {
        $views = resource_path('views/ozi-check-fixture');
        File::ensureDirectoryExists($views);
        file_put_contents($views . '/layout.blade.php', "<head>\n@oziStyles(['select'])\n</head>\n<body>\n@oziScripts(['ozi-validate', 'select'])\n</body>\n");

        try {
            // Artisan::call em vez de expectsOutputToContain: cada expectativa consome a linha
            // escrita, e as três estão na mesma linha
            $exit   = Artisan::call('ozi:check');
            $output = Artisan::output();

            $this->assertSame(0, $exit, 'só avisa: não muda o código de saída');
            $this->assertStringContainsString(
                "OZI-W002 resources/views/ozi-check-fixture/layout.blade.php:5 @oziScripts: chave desconhecida 'ozi-validate' — você quis dizer 'validate'?",
                $output
            );
            $this->assertStringNotContainsString("'select'", $output, 'chave certa não aparece');
        } finally {
            File::deleteDirectory($views);
        }
    }
}
