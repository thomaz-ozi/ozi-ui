<?php

namespace OziUI\Core\Commands;

use Illuminate\Console\Command;
use OziUI\Core\OziAssets;

/**
 * Verificação do ecossistema ozi-ui (v2).
 *
 * Fonte única de plugins é o `_pluginMap` do ozi-conf.js.
 * Este comando cumpre o item F1 do projeto v2 ("mata a dupla lista"):
 * as listas do OziAssets.php são validadas CONTRA o _pluginMap —
 * qualquer deriva entre as duas (ou arquivo ausente em disco) falha o check.
 *
 * Duas origens de assets (desde a 2.1.0):
 *   - PUBLICADO: arquivos em public/plugins/ozi-ui (via vendor:publish).
 *   - ROTA-FALLBACK: servidos direto do pacote pela rota `ozi-ui.asset`.
 * O check considera um arquivo OK se existir em QUALQUER das duas — assim não
 * acusa falso "não publicado" quando o app usa só a rota.
 *
 * Checks:
 *   1. Arquivos core (ozi.js + subsistemas)
 *   2. Todo js/css do _pluginMap existe em disco
 *   3. Todo path do OziAssets existe em disco
 *   4. Deriva OziAssets ↔ _pluginMap (dois sentidos, com exceções documentadas)
 *   4c. Deriva do `deps:` — o $scriptDeps do OziAssets espelha o _pluginMap
 *   5. config/ozi-ui.php disponível (publicado OU merge do pacote)
 *   6. Chaves do @oziScripts/@oziStyles nas views (OZI-W002, só avisa)
 *   7. Com --lint (2.12.0, N7 do roadmap "pronto para IA"): os data-ozi-* / data-zld-* das views
 *      contra o registro dos manifestos (OZI-W001, o mesmo do aviso do navegador, lido de
 *      core/ozi-attrs.json) e os plugins usados que nenhum @oziScripts carrega (OZI-W003).
 *      Achado em 6 ou 7 termina com erro (código 1): serve de verificação no CI e para o agente.
 */
class OziCheckCommand extends Command
{
    protected $signature   = 'ozi:check
        {--lint : Confere os atributos data-ozi-* das views (OZI-W001) e se os plugins usados são carregados (OZI-W003); termina com erro se achar algo}';
    protected $description = 'Verifica se o ecossistema ozi-ui está instalado corretamente (deriva do _pluginMap)';

    /** Base publicada no app (public/plugins/ozi-ui) — null se não publicado. */
    protected ?string $published = null;

    /** Base do pacote (origem da rota-fallback) — null se inacessível. */
    protected ?string $pkg = null;

    /** Arquivos core (fora do _pluginMap — carregados pelo boot, não pelo loader). */
    protected array $coreFiles = [
        'ozi.js',
        'core/ozi-conf.js',
        'core/ozi-theme.js',
        'core/ozi-hooks.js',
        'core/ozi-attrs.js',         // aviso OZI-W001 (2.10.0)
        'core/ozi-lang.js',
        'core/helpers/ozi-helpers.js',
        'core/ozi-loader.js',
        'core/ozi-integrations.js',
        'core/ozi-assets-boot.js',   // boot do @oziScripts (2.8.0, era inline)
        'core/ozi-assets-ready.js',
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

    /**
     * Chaves cujo nome diverge entre o _pluginMap (JS) e o OziAssets (PHP).
     * Divergência histórica, mantida por compatibilidade do @oziScripts.
     */
    protected array $mapKeyAliases = [
        'password-rules' => 'password',
        'livewire'       => 'livewire-adapter',
    ];

    public function handle(): int
    {
        $this->newLine();
        $this->line('  <fg=red>ozi</><fg=#e67e22>-ui</> — Verificação do ecossistema (v2)');
        $this->newLine();

        $this->published = public_path(config('ozi-ui.base_path', 'plugins/ozi-ui'));
        $this->pkg       = realpath(__DIR__ . '/../../public/plugins/ozi-ui') ?: null;
        $allOk           = true;

        // Modo: publicado (assets em public/) vs rota-fallback (servidos do pacote).
        $isPublished = is_file($this->published . '/ozi.js');
        $this->line($isPublished
            ? '  <fg=gray>Modo: publicado — assets em public/' . config('ozi-ui.base_path', 'plugins/ozi-ui') . '/.</>'
            : '  <fg=gray>Modo: rota-fallback — assets servidos do pacote pela rota ozi-ui.asset (vendor:publish é opcional).</>');
        if ($this->pkg === null) {
            $this->line('  <fg=yellow>⚠ base do pacote inacessível — só a cópia publicada será verificada.</>');
        }
        $this->newLine();

        // ── 1. Core ──────────────────────────────────────────────────────
        foreach ($this->coreFiles as $file) {
            $allOk = $this->checkFile($file, 'core') && $allOk;
        }
        $this->newLine();

        // ── 2. _pluginMap → disco ────────────────────────────────────────
        $mapPaths = $this->parsePluginMap($this->resolvePath('core/ozi-conf.js'));

        if ($mapPaths === null) {
            $this->line('  <fg=red>✘</> não foi possível ler o _pluginMap de core/ozi-conf.js');
            $allOk = false;
            $mapPaths = [];
        } else {
            $this->line('  <fg=gray>_pluginMap: ' . count($mapPaths) . ' arquivos declarados (fonte única)</>');
            foreach ($mapPaths as $file) {
                $allOk = $this->checkFile($file, 'map', quietOk: true) && $allOk;
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
            $allOk = $this->checkFile($file, 'assets', quietOk: true) && $allOk;
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

            // ── 4c. Deriva do `deps:` ────────────────────────────────────
            // O @oziScripts não passa pelo ozi-loader, então o OziAssets tem o
            // seu próprio espelho das dependências ($scriptDeps). Se os dois
            // divergirem, volta a valer o problema que a 2.6.0 corrigiu: uma
            // chave emitida sem a dependência que ela precisa em runtime.
            $allOk = $this->checkDepsDrift($assets) && $allOk;
        }

        // ── 5. Config disponível (publicado OU merge do pacote) ──────────
        if (file_exists(config_path('ozi-ui.php'))) {
            $this->line('  <fg=green>✔</> <fg=white>config/ozi-ui.php</> <fg=gray>OK (publicado)</>');
        } elseif (config('ozi-ui') !== null) {
            $this->line('  <fg=green>✔</> <fg=white>config/ozi-ui.php</> <fg=gray>OK (merge do pacote, sem publish)</>');
        } else {
            $this->line('  <fg=red>✘</> <fg=white>config/ozi-ui.php</> <fg=red>indisponível</>');
            $allOk = false;
        }

        // ── 6. Chaves do @oziScripts/@oziStyles nos Blade (OZI-W002, 2.10.0) ──
        // Só avisa (não muda o código de saída): é a mesma regra do aviso em runtime.
        $w002 = $this->checkBladeKeys(app(OziAssets::class));

        // ── 7. --lint: atributos das views e plugins carregados (OZI-W001 / OZI-W003, 2.12.0) ──
        $lintFound = 0;
        if ($this->option('lint')) {
            $this->newLine();
            $lintFound = $w002 + $this->lintBlade(app(OziAssets::class));
        }

        $this->newLine();

        if ($allOk) {
            $this->line('  <fg=green>✔ Tudo certo!</> ozi-ui v2 instalado, sem deriva entre OziAssets e _pluginMap.');
        } else {
            $this->line('  <fg=yellow>⚠ Problemas encontrados.</> Arquivo ausente das DUAS origens (public/ e pacote)');
            $this->line('  <fg=yellow>  indica instalação corrompida. Para (re)publicar em public/, rode:</>');
            $this->newLine();
            $this->line('    <fg=white>php artisan vendor:publish --tag=ozi-ui --force</>');
        }

        $this->newLine();

        if ($lintFound > 0) {
            $this->line("  <fg=yellow>⚠ --lint: {$lintFound} achado(s) nas views.</> Corrija e rode de novo (código de saída 1).");
            $this->newLine();
        }

        return ($allOk && $lintFound === 0) ? self::SUCCESS : self::FAILURE;
    }

    /**
     * --lint (2.12.0): percorre as views Blade e confere cada atributo `data-ozi-*` / `data-zld-*`
     * contra o registro gerado dos manifestos (core/ozi-attrs.json). Depois confere se os plugins
     * usados nas views são carregados por algum `@oziScripts([...])`. Devolve quantos achou.
     */
    protected function lintBlade(OziAssets $assets): int
    {
        $regPath = $this->resolvePath('core/ozi-attrs.json');
        $reg     = $regPath ? json_decode((string) file_get_contents($regPath), true) : null;
        if (!is_array($reg) || empty($reg['known'])) {
            $this->line('  <fg=yellow>⚠</> --lint: <fg=white>core/ozi-attrs.json</> indisponível (pacote anterior à 2.12.0?): atributos não conferidos');
            return 0;
        }

        $dir = resource_path('views');
        if (!is_dir($dir)) {
            $this->line('  <fg=gray>--lint: sem resources/views.</>');
            return 0;
        }

        $known     = array_flip($reg['known']);
        $zldKnown  = array_flip($reg['zld']['known'] ?? []);
        $found     = 0;
        $used      = [];   // chave do @oziScripts => "arquivo:linha" do 1º uso
        $loaded    = [];   // chaves carregadas (união de todos os @oziScripts)
        $loadsAll  = false;
        $hasScript = false;

        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));
        $list  = [];
        foreach ($files as $file) {
            if (str_ends_with($file->getFilename(), '.blade.php')) $list[] = $file->getPathname();
        }
        sort($list);

        foreach ($list as $path) {
            $src = (string) file_get_contents($path);
            $rel = ltrim(str_replace([base_path(), '\\'], ['', '/'], $path), '/');

            // @oziScripts das views: o que fica carregado
            if (preg_match_all('/@oziScripts\b(\s*\(\s*(\[(.*?)\])?\s*\))?/s', $src, $calls, PREG_SET_ORDER)) {
                foreach ($calls as $call) {
                    $hasScript = true;
                    $only = [];
                    if (!empty($call[3])) {
                        preg_match_all('/[\'"]([^\'"]+)[\'"]/', $call[3], $k);
                        $only = $k[1];
                    }
                    $keys = $assets->scriptKeysFor($only);
                    if ($keys === null) $loadsAll = true;
                    else foreach ($keys as $key) $loaded[$key] = true;
                }
            }

            // atributos: só em posição de atributo HTML (espaço antes; =, espaço ou > depois).
            // Nome montado no Blade (`data-ozi-{{ $x }}`) e string de JS ('[data-ozi-x]') ficam de fora.
            foreach (preg_split('/\R/', $src) as $i => $line) {
                if (!preg_match_all('/(?<=\s)(data-(?:ozi|zld)-[a-z0-9][a-z0-9-]*)(?=\s*=|\s|\/?>|$)/i', $line, $m)) continue;
                foreach ($m[1] as $raw) {
                    $name  = strtolower($raw);
                    $where = $rel . ':' . ($i + 1);
                    $isZld = str_starts_with($name, 'data-zld');

                    if ($isZld ? !isset($zldKnown[$name]) : !isset($known[$name])) {
                        $found++;
                        $this->line(sprintf(
                            "  <fg=yellow>⚠</> OZI-W001 <fg=white>%s</> atributo desconhecido <fg=white>'%s'</>%s",
                            $where, $raw, $this->lintHint($name, $reg)
                        ));
                        continue;
                    }

                    $key = $this->lintPluginKey($name, $reg['namespaces'] ?? []);
                    if ($key !== null && !isset($used[$key])) $used[$key] = $where;
                }
            }
        }

        // plugins usados que nenhum @oziScripts carrega (OZI-W003)
        if (!$hasScript) {
            $this->line('  <fg=gray>--lint: nenhum @oziScripts nas views (ozi.js ou carga manual): plugins carregados não conferidos.</>');
        } elseif (!$loadsAll) {
            ksort($used);
            foreach ($used as $key => $where) {
                if (isset($loaded[$key])) continue;
                $found++;
                $tip = $key === 'livewire-adapter' ? "o grupo 'livewire'" : "'{$key}'";
                $this->line(sprintf(
                    "  <fg=yellow>⚠</> OZI-W003 <fg=white>%s</> plugin <fg=white>'%s'</> usado e nenhum @oziScripts das views o carrega — acrescente %s",
                    $where, $key, $tip
                ));
            }
        }

        if ($found === 0) {
            $this->line('  <fg=green>✔</> <fg=white>--lint: atributos data-ozi-* e plugins carregados nas views</> <fg=gray>OK</>');
        }

        return $found;
    }

    /** Chave do @oziScripts que um atributo conhecido exige, ou null (atributo compartilhado). */
    protected function lintPluginKey(string $name, array $namespaces): ?string
    {
        if (str_starts_with($name, 'data-zld')) return 'loaddata';
        if ($name === 'data-ozi-editor-md') return 'editor-md';
        foreach ($namespaces as $ns) {
            $base = 'data-ozi-' . $ns;
            if ($name === $base || str_starts_with($name, $base . '-')) {
                return $ns === 'livewire' ? 'livewire-adapter' : $ns;
            }
        }
        return null;
    }

    /**
     * Sugestão para um nome desconhecido, com as mesmas regras do aviso do navegador
     * (core/ozi-attrs.js): nome que saiu, troca conhecida, `zld-` sobrando ou faltando,
     * distância de edição <= 2 (até 3 candidatos), fim do nome igual a um atributo do plugin.
     */
    protected function lintHint(string $name, array $reg): string
    {
        $special = $reg['special'][$name] ?? null;
        if (!empty($special['suggest'])) {
            return ' — você quis dizer ' . $this->lintQuote($special['suggest']) . '?';
        }
        if (!empty($special['gone'])) {
            return " — ele saiu na {$special['gone']}";
        }
        foreach ($reg['gonePrefixes'] ?? [] as $g) {
            if ($name === $g['prefix'] || str_starts_with($name, $g['prefix'] . '-')) {
                return " — saiu na {$g['since']}" . (!empty($g['hint']) ? " ({$g['hint']})" : '');
            }
        }

        $isZld  = str_starts_with($name, 'data-zld');
        $author = $isZld ? ($reg['zld']['author'] ?? []) : ($reg['author'] ?? []);

        $ns = null;
        if (!$isZld) {
            $first = explode('-', substr($name, strlen('data-ozi-')))[0];
            if (in_array($first, $reg['namespaces'] ?? [], true)) $ns = $first;
        }
        $base = $ns !== null ? 'data-ozi-' . $ns . '-' : '';
        $tail = $ns !== null ? (string) substr($name, strlen($base)) : '';

        if ($ns !== null && $tail !== '') {
            $alt = str_starts_with($tail, 'zld-') ? $base . substr($tail, 4) : $base . 'zld-' . $tail;
            if (in_array($alt, $author, true)) return ' — você quis dizer ' . $this->lintQuote([$alt]) . '?';
        }

        $best = 3; $hits = [];
        foreach ($author as $n) {
            if (abs(strlen($n) - strlen($name)) > 2) continue;
            $d = levenshtein($name, $n);
            if ($d > 2) continue;
            if ($d < $best) { $best = $d; $hits = [$n]; }
            elseif ($d === $best) $hits[] = $n;
        }
        if ($hits && count($hits) <= 3) return ' — você quis dizer ' . $this->lintQuote($hits) . '?';

        if ($ns !== null && $tail !== '') {
            $ends = array_values(array_filter($author, fn ($n) => str_starts_with($n, $base) && $n !== $name && str_ends_with($n, '-' . $tail)));
            if ($ends && count($ends) <= 3) return ' — você quis dizer ' . $this->lintQuote($ends) . '?';
        }

        return '';
    }

    protected function lintQuote(array $names): string
    {
        return implode(' ou ', array_map(fn ($n) => "<fg=white>'{$n}'</>", $names));
    }

    /**
     * Procura `@oziScripts([...])` e `@oziStyles([...])` nas views e lista as chaves que não
     * existem, com a sugestão. Devolve quantas achou.
     */
    protected function checkBladeKeys(OziAssets $assets): int
    {
        $dir = resource_path('views');
        if (!is_dir($dir)) return 0;

        $known = $assets->knownKeys();
        $found = 0;
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));

        foreach ($files as $file) {
            if (!str_ends_with($file->getFilename(), '.blade.php')) continue;

            $src = (string) file_get_contents($file->getPathname());
            if (!preg_match_all('/@(oziScripts|oziStyles)\s*\(\s*\[(.*?)\]\s*\)/s', $src, $calls, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
                continue;
            }

            foreach ($calls as $call) {
                preg_match_all('/[\'"]([^\'"]+)[\'"]/', $call[2][0], $keys);
                foreach ($keys[1] as $key) {
                    $normalized = strtolower(trim($key));
                    if (in_array($normalized, $known, true)) continue;

                    $found++;
                    $line = substr_count(substr($src, 0, $call[0][1]), "\n") + 1;
                    $rel  = ltrim(str_replace([base_path(), '\\'], ['', '/'], $file->getPathname()), '/');
                    $hint = $assets->suggestKey($normalized);
                    $this->line(sprintf(
                        "  <fg=yellow>⚠</> OZI-W002 <fg=white>%s:%d</> @%s: chave desconhecida <fg=white>'%s'</>%s",
                        $rel, $line, $call[1][0], $key, $hint !== null ? " — você quis dizer <fg=white>'{$hint}'</>?" : ''
                    ));
                }
            }
        }

        if ($found === 0) {
            $this->line('  <fg=green>✔</> <fg=white>chaves do @oziScripts/@oziStyles nas views</> <fg=gray>OK</>');
        }

        return $found;
    }

    /**
     * OK se o arquivo existe em QUALQUER origem (publicado ou pacote/rota).
     * Retorna a origem encontrada para exibir no relatório.
     */
    protected function checkFile(string $file, string $label, bool $quietOk = false): bool
    {
        $src = $this->locate($file);

        if ($src !== null && $quietOk) {
            return true;
        }

        if ($src !== null) {
            $this->line(sprintf('  <fg=green>✔</> <fg=white>%-58s</> <fg=gray>OK (%s)</>', $file, $src));
            return true;
        }

        $this->line(sprintf('  <fg=red>✘</> <fg=white>%-58s</> <fg=red>ausente das 2 origens (%s)</>', $file, $label));
        return false;
    }

    /** Origem onde o arquivo existe: 'publicado', 'pacote' ou null. */
    protected function locate(string $file): ?string
    {
        if ($this->published !== null && is_file($this->published . '/' . $file)) {
            return 'publicado';
        }
        if ($this->pkg !== null && is_file($this->pkg . '/' . $file)) {
            return 'pacote';
        }
        return null;
    }

    /** Caminho absoluto do arquivo na primeira origem que o tiver, ou null. */
    protected function resolvePath(string $file): ?string
    {
        if ($this->published !== null && is_file($this->published . '/' . $file)) {
            return $this->published . '/' . $file;
        }
        if ($this->pkg !== null && is_file($this->pkg . '/' . $file)) {
            return $this->pkg . '/' . $file;
        }
        return null;
    }

    /**
     * Compara o $scriptDeps do OziAssets com o `deps:` do _pluginMap.
     *
     * Só compara chaves que existem nos DOIS lados: `copy`/`paste` (descontinuados)
     * e qualquer chave do map fora do OziAssets são ignoradas aqui — o check 4
     * já cobre esse tipo de ausência.
     */
    protected function checkDepsDrift(OziAssets $assets): bool
    {
        $mapDeps = $this->parsePluginDeps($this->resolvePath('core/ozi-conf.js'));

        if ($mapDeps === null) {
            $this->line('  <fg=yellow>⚠</> não foi possível ler o <fg=white>deps:</> do _pluginMap — deriva de deps não verificada');
            return true;
        }

        $phpDeps = $assets->getScriptDeps();
        $scripts = $assets->getAvailableScripts();
        $ok      = true;

        foreach ($mapDeps as $mapKey => $deps) {
            $key = $this->mapKeyAliases[$mapKey] ?? $mapKey;

            if (!isset($scripts[$key])) {
                continue;
            }

            $expected = [];
            foreach ($deps as $dep) {
                $depKey = $this->mapKeyAliases[$dep] ?? $dep;
                if (isset($scripts[$depKey])) {
                    $expected[] = $depKey;
                }
            }

            $actual = $phpDeps[$key] ?? [];

            sort($expected);
            sort($actual);

            if ($expected !== $actual) {
                $this->line(
                    "  <fg=red>✘</> deriva de deps: <fg=white>{$key}</> — _pluginMap diz ["
                    . implode(', ', $expected) . '], OziAssets diz [' . implode(', ', $actual) . ']'
                );
                $ok = false;
            }
        }

        return $ok;
    }

    /**
     * Extrai o `deps:` de cada chave do bloco `var _pluginMap = {...}`.
     * Retorna null se o arquivo/bloco não puder ser lido.
     *
     * @return array<string,array<int,string>>|null
     */
    protected function parsePluginDeps(?string $confPath): ?array
    {
        if ($confPath === null || !file_exists($confPath)) {
            return null;
        }

        $src = file_get_contents($confPath);

        if (!preg_match('/var\s+_pluginMap\s*=\s*\{(.*?)\n    \};/s', $src, $block)) {
            return null;
        }

        // `'chave': { deps: [ ... ]` — deps é sempre a 1ª propriedade da entrada.
        if (!preg_match_all(
            '/[\'"]([a-z0-9-]+)[\'"]\s*:\s*\{\s*deps:\s*\[([^\]]*)\]/i',
            $block[1],
            $matches,
            PREG_SET_ORDER
        )) {
            return null;
        }

        $out = [];

        foreach ($matches as $m) {
            preg_match_all('/[\'"]([a-z0-9-]+)[\'"]/i', $m[2], $deps);
            $out[$m[1]] = $deps[1];
        }

        return $out;
    }

    /**
     * Extrai os paths js/css do bloco `var _pluginMap = {...}` do ozi-conf.js.
     * Retorna null se o arquivo/bloco não puder ser lido.
     */
    protected function parsePluginMap(?string $confPath): ?array
    {
        if ($confPath === null || !file_exists($confPath)) {
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
