<?php

namespace OziUI\Core\Tests;

use Illuminate\Support\Facades\Blade;

class BladeDirectivesTest extends TestCase
{
    public function test_ozi_scripts_with_keys(): void
    {
        $html = Blade::render("@oziScripts(['editor'])");

        $this->assertStringContainsString('components/ozi-editor/js/ozi-editor.js', $html);
        $this->assertStringContainsString('modules/ozi-editor-sanitize/js/ozi-editor-sanitize.js', $html);
        $this->assertStringNotContainsString('components/ozi-select/js/ozi-select.js', $html);
    }

    public function test_directives_without_arguments_emit_everything(): void
    {
        $scripts = Blade::render('@oziScripts');
        $styles  = Blade::render('@oziStyles');

        $this->assertStringContainsString('components/ozi-audio/js/ozi-audio.js', $scripts);
        $this->assertStringContainsString('behaviors/ozi-toggle/css/ozi-toggle.css', $styles);
    }

    public function test_ozi_styles_with_keys(): void
    {
        $html = Blade::render("@oziStyles(['select'])");

        $this->assertSame(1, substr_count($html, '<link'));
        $this->assertStringContainsString('components/ozi-select/css/ozi-select.css', $html);
    }
}
