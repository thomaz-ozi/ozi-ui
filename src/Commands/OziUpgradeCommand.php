<?php

namespace OziUI\Core\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * `php artisan ozi:upgrade` (2.12.0) — o passo depois do `composer update ozi-ui/core`.
 *
 *   1. Mostra a versão instalada.
 *   2. Se o app tem a cópia publicada dos assets (public/plugins/ozi-ui, via vendor:publish), atualiza
 *      os arquivos que mudaram no pacote. É o passo que fica esquecido: o webserver serve a cópia, não
 *      o vendor/, e o visitante continua recebendo o JS antigo. Arquivo da cópia que não existe mais no
 *      pacote é só listado, nunca apagado. Sem cópia publicada (rota-fallback), não há o que copiar.
 *   3. Lista as versões desde a última vez que o comando rodou (marcada em storage/app/ozi-ui.version),
 *      tiradas do CHANGELOG.md do pacote, com as correções de segurança em destaque.
 *   4. Roda o `ozi:check --lint` (atributos das views e plugins carregados) e devolve o código dele.
 *
 * Nunca roda o composer nem mexe em config/ozi-ui.php.
 */
class OziUpgradeCommand extends Command
{
    protected $signature   = 'ozi:upgrade
        {--dry-run : Mostra o que mudaria, sem copiar nem marcar a versão}
        {--no-lint : Não roda o ozi:check --lint no fim}';
    protected $description = 'Depois do composer update: atualiza a cópia publicada dos assets, lista o que mudou (segurança em destaque) e roda o ozi:check --lint';

    public function handle(): int
    {
        $root    = realpath(__DIR__ . '/../..') ?: (__DIR__ . '/../..');
        $pkg     = $root . '/public/plugins/ozi-ui';
        $version = $this->installedVersion($root);
        $dry     = (bool) $this->option('dry-run');
        $marker  = storage_path('app/ozi-ui.version');
        $prev    = is_file($marker) ? trim((string) file_get_contents($marker)) : null;

        $this->newLine();
        $this->line('  <fg=red>ozi</><fg=#e67e22>-ui</> — Atualização' . ($dry ? ' <fg=gray>(--dry-run: nada é gravado)</>' : ''));
        $this->newLine();
        $this->line("  Versão instalada: <fg=white>{$version}</>" . ($prev !== null && $prev !== '' && $prev !== $version ? " <fg=gray>(antes: {$prev})</>" : ''));
        $this->newLine();

        // ── 1. cópia publicada ───────────────────────────────────────────
        $published = public_path(trim((string) config('ozi-ui.base_path', 'plugins/ozi-ui'), '/'));
        if (!is_file($published . '/ozi.js')) {
            $this->line('  <fg=gray>Sem cópia publicada em public/: os assets saem do pacote pela rota ozi-ui.asset. Nada a copiar.</>');
        } elseif (!is_dir($pkg)) {
            $this->line('  <fg=red>✘</> pasta de assets do pacote não encontrada: ' . $pkg);
            return self::FAILURE;
        } else {
            $this->syncPublished($pkg, $published, $dry);
        }
        $this->newLine();

        // ── 2. o que mudou desde a última vez ────────────────────────────
        $this->listChanges($root . '/CHANGELOG.md', $prev, $version);

        if (!$dry && $version !== '?') {
            File::ensureDirectoryExists(dirname($marker));
            file_put_contents($marker, $version . "\n");
        }

        // ── 3. lint ──────────────────────────────────────────────────────
        if ($this->option('no-lint')) {
            $this->newLine();
            return self::SUCCESS;
        }

        return $this->call('ozi:check', ['--lint' => true]);
    }

    /** Copia do pacote para a cópia publicada só o que é novo ou diferente. */
    protected function syncPublished(string $pkg, string $published, bool $dry): void
    {
        $pkgFiles = $this->files($pkg);
        $pubFiles = $this->files($published);

        $new = $changed = $same = 0;
        foreach ($pkgFiles as $rel => $abs) {
            $dest = $published . '/' . $rel;
            if (!isset($pubFiles[$rel])) {
                $new++;
            } elseif (md5_file($abs) !== md5_file($dest)) {
                $changed++;
            } else {
                $same++;
                continue;
            }
            if (!$dry) {
                File::ensureDirectoryExists(dirname($dest));
                copy($abs, $dest);
            }
        }

        $label = str_replace([base_path(), '\\'], ['', '/'], $published);
        $verb  = $dry ? 'seriam atualizados' : 'atualizados';
        if ($new + $changed === 0) {
            $this->line("  <fg=green>✔</> Cópia publicada <fg=white>" . ltrim($label, '/') . "</> já igual ao pacote <fg=gray>({$same} arquivos)</>");
        } else {
            $this->line(sprintf(
                '  <fg=green>✔</> Cópia publicada <fg=white>%s</>: %d %s, %d novos <fg=gray>(%d iguais)</>',
                ltrim($label, '/'), $changed, $verb, $new, $same
            ));
        }

        $stale = array_diff_key($pubFiles, $pkgFiles);
        if ($stale) {
            ksort($stale);
            $this->line('  <fg=yellow>⚠</> ' . count($stale) . ' arquivo(s) da cópia não existem mais no pacote (não apagados; confira se o app usa):');
            foreach (array_slice(array_keys($stale), 0, 10) as $rel) {
                $this->line("      <fg=white>{$rel}</>");
            }
            if (count($stale) > 10) $this->line('      <fg=gray>... e mais ' . (count($stale) - 10) . '</>');
        }
    }

    /** @return array<string,string> caminho relativo (com /) => caminho absoluto */
    protected function files(string $dir): array
    {
        $out = [];
        if (!is_dir($dir)) return $out;
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if (!$file->isFile()) continue;
            $rel = str_replace('\\', '/', substr($file->getPathname(), strlen($dir) + 1));
            $out[$rel] = $file->getPathname();
        }
        return $out;
    }

    /** Versões do CHANGELOG.md entre a anterior (exclusive) e a instalada (inclusive). */
    protected function listChanges(string $changelog, ?string $prev, string $version): void
    {
        if ($prev === null || $prev === '') {
            $this->line('  <fg=gray>Primeira vez do ozi:upgrade neste app: a próxima atualização vai listar o que mudou desde esta.</>');
            $this->line('  <fg=gray>Histórico completo: vendor/ozi-ui/core/CHANGELOG.md</>');
            return;
        }
        if ($prev === $version) {
            $this->line("  <fg=gray>Já estava na {$version}: nada novo no changelog.</>");
            return;
        }
        if (!is_file($changelog)) {
            $this->line('  <fg=gray>CHANGELOG.md do pacote não encontrado.</>');
            return;
        }

        $src = str_replace("\r\n", "\n", (string) file_get_contents($changelog));
        preg_match_all('/^## \[(\d+\.\d+\.\d+)\][^\n]*\n(.*?)(?=^## \[|\z)/ms', $src, $sec, PREG_SET_ORDER);

        $rows = [];
        foreach ($sec as $s) {
            $v = $s[1];
            if (version_compare($v, $prev, '<=') || version_compare($v, $version, '>')) continue;
            $body = $s[2];
            $count = fn (string $h) => preg_match('/^### ' . $h . '\n(.*?)(?=^### |\z)/ms', $body, $m) ? preg_match_all('/^- /m', $m[1]) : 0;
            $security = [];
            if (preg_match('/^### Security\n(.*?)(?=^### |\z)/ms', $body, $m)) {
                preg_match_all('/^- \*\*(.+?)\*\*/m', $m[1], $t);
                $security = $t[1];
            }
            $rows[] = [$v, $security, $count('Fixed'), $count('Added')];
        }

        if (!$rows) {
            $this->line("  <fg=gray>Nenhuma versão entre {$prev} e {$version} no changelog.</>");
            return;
        }

        $sec = array_sum(array_map(fn ($r) => count($r[1]), $rows));
        $this->line(sprintf('  Desde a %s: %d versão(ões)%s', $prev, count($rows), $sec ? ", <fg=red>{$sec} correção(ões) de segurança</>" : ''));
        foreach ($rows as [$v, $security, $fixed, $added]) {
            $parts = [];
            if ($security) $parts[] = '<fg=red>segurança (' . count($security) . ')</>';
            if ($fixed)    $parts[] = "correções ({$fixed})";
            if ($added)    $parts[] = "novidades ({$added})";
            $this->line("    <fg=white>{$v}</>  " . ($parts ? implode(' · ', $parts) : '<fg=gray>—</>'));
            foreach ($security as $t) {
                $this->line('        <fg=red>!</> ' . strip_tags(str_replace('`', '', $t)));
            }
        }
        $this->line('  <fg=gray>Detalhes: vendor/ozi-ui/core/CHANGELOG.md</>');
    }

    /**
     * O `version` do composer.json do próprio pacote vem primeiro: é o que está no disco (no
     * vendor/ de um app é o da versão instalada). O InstalledVersions pode estar velho fora de um
     * `composer update` (no repositório do pacote ele guarda a do último install da raiz).
     */
    protected function installedVersion(string $root): string
    {
        $json = json_decode((string) @file_get_contents($root . '/composer.json'), true);
        $v    = is_array($json) ? ltrim((string) ($json['version'] ?? ''), 'v') : '';
        if (preg_match('/^\d+\.\d+\.\d+$/', $v)) return $v;

        if (class_exists(\Composer\InstalledVersions::class) && \Composer\InstalledVersions::isInstalled('ozi-ui/core')) {
            $v = ltrim((string) \Composer\InstalledVersions::getPrettyVersion('ozi-ui/core'), 'v');
            if (preg_match('/^\d+\.\d+\.\d+$/', $v)) return $v;
        }
        return '?';
    }
}
