<?php

namespace OziUI\Core\Tests;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * Padrão de nomes dos .md distribuídos em public/plugins/ozi-ui:
 *   ozi-<nome>.CHANGELOG.md  ·  ozi-<nome>.README.md  ·  README.md (só na raiz de um tema)
 *
 * Existe porque o Windows não diferencia maiúsculas: `ozi-loader.changelog.md` e
 * `ozi-loader.CHANGELOG.md` são o mesmo arquivo no disco, mas nomes diferentes para o git e
 * no Linux. Foi assim que o -hard e o -pkg divergiram sem ninguém ver (e um `coi-conf` com
 * erro de digitação sobreviveu desde a v1).
 */
class NamingConventionTest extends TestCase
{
    public function test_distributed_markdown_files_follow_the_naming_pattern(): void
    {
        $root = realpath(__DIR__ . '/../public/plugins/ozi-ui');
        $bad  = [];

        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS));

        foreach ($files as $file) {
            if (strtolower($file->getExtension()) !== 'md') {
                continue;
            }

            $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
            $name     = $file->getFilename();

            $isPluginDoc = (bool) preg_match('/^ozi-[a-z0-9-]+\.(CHANGELOG|README)\.md$/', $name);
            $isThemeDoc  = (bool) preg_match('#^themes/[^/]+/README\.md$#', $relative);

            if (!$isPluginDoc && !$isThemeDoc) {
                $bad[] = $relative;
            }
        }

        $this->assertSame([], $bad, 'Fora do padrão ozi-<nome>.CHANGELOG.md / ozi-<nome>.README.md');
    }
}
