<?php

namespace OziUI\Core\Commands;

use Illuminate\Console\Command;
use OziUI\Core\OziAssets;

/**
 * Verificação do ecossistema ozi-ui (v2).
 *
 * Fonte única de plugins é o `_pluginMap` do ozi-conf.js publicado.
 * Este comando cumpre o item F1 do projeto v2 ("mata a dupla lista"):
 * as listas do OziAssets.php são validadas CONTRA o _pluginMap —
 * qualquer deriva entre as duas (ou arquivo ausente em disco) falha o check.
 *
 * Checks:
 *   1. Arquivos core publicados (ozi.js + subsistemas)
 *   2. Todo js/css do _pluginMap existe em disco
 *   3. Todo path do OziAssets existe em disco
 *   4. Deriva OziAssets ↔ _pluginMap (dois sentidos, com exceções documentadas)
 *   5. config/ozi-ui.php publicado
 */
class OziCheckCommand extends Command
{
    protected $signature   = 'ozi:check';
    protected $description = 'Verifica se o ecossistema ozi-ui está instalado corretamente (deriva do _pluginMap)';

    /** Arquivos core (fora do _pluginMap — carregados pelo boot, não pelo loader). */
    protected array $coreFiles = [
        'ozi.js',
        'core/ozi-conf.js',
        'core/ozi-hooks.js',
        'core/ozi-lang.js',
        'core/helpers/ozi-helpers.js',
        'core/ozi-loader.js',
        'core/ozi-integrations.js',
    ];

    /**
     * Paths do _pluginMap ausentes do OziAssets de propósito.
     * copy/paste: descontinuados na v2 (substitutos = receitas Alpine).
     */
    protected array $mapOnlyAllowed = [
        'behaviors/ozi-copy/js/ozi-copy.js',
        'behaviors/ozi-copy/css/ozi-copy.css',
        'behaviors/ozi-paste/js/ozi-paste.js',
        'behaviors/ozi-paste/css/ozi-paste.css',
        'integrations/plugins/ozi-copy.plugin.js',
    ];

    /**
     * Prefixos de paths do OziAssets que não vivem no _pluginMap de propósito.
     * adapters/: shims de transição e adapter Livewire são opt-in do lado PHP.
     * shared/: reset/utilities não são plugins.
     */
    protected array $assetsOnlyAllowedPrefixes = [
        'integrations/adapters/',
        'shared/',
    ];

    /**
     * Paths individuais do OziAssets fora do _pluginMap de propósito.
     * validate css: o _pluginMap declara `css: null` porque o visual do
     * validate é papel do TEMA (bs5/tailwind); este css é o visual do tema
     * `default`, opt-in via @oziStyles (ver header do próprio arquivo).
     */
    protected array $assetsOnlyAllowed = [
        'modules/ozi-validate/css/ozi-validate.css',
    ];

    public function handle(): int
    {
        $this->newLine();
        $this->line('  <fg=red>ozi</><fg=#e67e22>-ui</> — Verificação do ecossistema (v2)');
        $this->newLine();

        $base  = public_path(config('ozi-ui.base_path', 'plugins/ozi-ui'));
        $allOk = true;

        // ── 1. Core publicado ────────────────────────────────────────────
        foreach ($this->coreFiles as $file) {
            $allOk = $this->checkFile($base, $file, 'core') && $allOk;
        }
        $this->newLine();

        // ── 2. _pluginMap → disco ────────────────────────────────────────
        $mapPaths = $this->parsePluginMap($base . '/core/ozi-conf.js');

        if ($mapPaths === null) {
            $this->line('  <fg=red>✘</> não foi possível ler o _pluginMap de core/ozi-conf.js');
            $allOk = false;
            $mapPaths = [];
        } else {
            $this->line('  <fg=gray>_pluginMap: ' . count($mapPaths) . ' arquivos declarados (fonte única)</>');
            foreach ($mapPaths as $file) {
                $allOk = $this->checkFile($base, $file, 'map', quietOk: true) && $allOk;
            }
        }
        $this->newLine();

        // ── 3. OziAssets → disco ─────────────────────────────────────────
        $assets      = app(OziAssets::class);
        // array_values antes do merge: scripts e styles usam as MESMAS chaves
        // string ('validate', 'select'…) — merge direto sobrescreveria o js pelo css
        $assetsPaths = array_values(array_unique(array_merge(
            array_values($assets->getAvailableScripts()),
            array_values($assets->getAvailableStyles())
        )));

        $this->line('  <fg=gray>OziAssets: ' . count($assetsPaths) . ' arquivos registrados</>');
        foreach ($assetsPaths as $file) {
            $allOk = $this->checkFile($base, $file, 'assets', quietOk: true) && $allOk;
        }
        $this->newLine();

        // ── 4. Deriva OziAssets ↔ _pluginMap ─────────────────────────────
        if (!empty($mapPaths)) {
            // 4a. no map, fora do OziAssets (e fora das exceções) = deriva
            foreach (array_diff($mapPaths, $assetsPaths, $this->mapOnlyAllowed) as $file) {
                $this->line("  <fg=red>✘</> deriva: <fg=white>{$file}</> está no _pluginMap mas não no OziAssets.php");
                $allOk = false;
            }
            // 4b. no OziAssets, fora do map (e fora das exceções) = deriva
            foreach (array_diff($assetsPaths, $mapPaths, $this->assetsOnlyAllowed) as $file) {
                if ($this->hasAllowedPrefix($file)) {
                    continue;
                }
                $this->line("  <fg=red>✘</> deriva: <fg=white>{$file}</> está no OziAssets.php mas não no _pluginMap");
                $allOk = false;
            }
        }

        // ── 5. Config publicado ──────────────────────────────────────────
        if (file_exists(config_path('ozi-ui.php'))) {
            $this->line('  <fg=green>✔</> <fg=white>config/ozi-ui.php</> <fg=gray>OK</>');
        } else {
            $this->line('  <fg=red>✘</> <fg=white>config/ozi-ui.php</> <fg=red>Não publicado</>');
            $allOk = false;
        }

        $this->newLine();

        if ($allOk) {
            $this->line('  <fg=green>✔ Tudo certo!</> ozi-ui v2 instalado, sem deriva entre OziAssets e _pluginMap.');
        } else {
            $this->line('  <fg=yellow>⚠ Problemas encontrados.</> Se for arquivo ausente, rode:');
            $this->newLine();
            $this->line('    <fg=white>php artisan vendor:publish --tag=ozi-ui --force</>');
        }

        $this->newLine();

        return $allOk ? self::SUCCESS : self::FAILURE;
    }

    protected function checkFile(string $base, string $file, string $label, bool $quietOk = false): bool
    {
        $exists = file_exists($base . '/' . $file);

        if ($exists && $quietOk) {
            return true;
        }

        $this->line($exists
            ? sprintf('  <fg=green>✔</> <fg=white>%-58s</> <fg=gray>OK</>', $file)
            : sprintf('  <fg=red>✘</> <fg=white>%-58s</> <fg=red>Não publicado (%s)</>', $file, $label));

        return $exists;
    }

    /**
     * Extrai os paths js/css do bloco `var _pluginMap = {...}` do ozi-conf.js.
     * Retorna null se o arquivo/bloco não puder ser lido.
     */
    protected function parsePluginMap(string $confPath): ?array
    {
        if (!file_exists($confPath)) {
            return null;
        }

        $src = file_get_contents($confPath);

        // isola o bloco do _pluginMap (da declaração até o fechamento `};` no mesmo nível)
        if (!preg_match('/var\s+_pluginMap\s*=\s*\{(.*?)\n    \};/s', $src, $block)) {
            return null;
        }

        // captura valores string de `js:` e `css:` (ignora null e placeholders {lang})
        preg_match_all('/\b(?:js|css):\s*\'([^\']+)\'/', $block[1], $matches);

        return array_values(array_unique(array_filter(
            $matches[1],
            fn ($path) => !str_contains($path, '{lang}')
        )));
    }

    protected function hasAllowedPrefix(string $file): bool
    {
        foreach ($this->assetsOnlyAllowedPrefixes as $prefix) {
            if (str_starts_with($file, $prefix)) {
                return true;
            }
        }

        return false;
    }
}
