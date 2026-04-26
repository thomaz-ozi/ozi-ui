<?php

namespace OziUI\Core\Commands;

use Illuminate\Console\Command;

class OziCheckCommand extends Command
{
    protected $signature   = 'ozi:check';
    protected $description = 'Verifica se o ecossistema ozi-ui está instalado corretamente';

    // Mapa de plugins com suas classes/arquivos de verificação
    protected array $plugins = [
        'oziCore'         => ['version' => 'v0.18.1-alpha', 'asset' => 'plugins/ozi-ui/ozi-core.js'],
        'oziLoadData'     => ['version' => 'v3.10.2',        'asset' => 'plugins/ozi-ui/ozi-loaddata/js/ozi-loaddata.js'],
        'oziSelect'       => ['version' => 'v4.3.2',        'asset' => 'plugins/ozi-ui/ozi-select/js/ozi-select.js'],
        'oziAutocomplete' => ['version' => 'v2.0.1',        'asset' => 'plugins/ozi-ui/ozi-autocomplete/js/ozi-autocomplete.js'],
        'oziSearch'       => ['version' => 'v1.5.0',          'asset' => 'plugins/ozi-ui/ozi-search/js/ozi-search.js'],
        'oziEditor'       => ['version' => 'v1.5.1',        'asset' => 'plugins/ozi-ui/ozi-editor/js/ozi-editor.js'],
        'oziAudio'        => ['version' => 'v2.6.6',        'asset' => 'plugins/ozi-ui/ozi-audio/js/ozi-audio.js'],
        'oziToggle'       => ['version' => 'v2.3.0',        'asset' => 'plugins/ozi-ui/ozi-addons/js/ozi-toggle.js'],
        'oziCopy'         => ['version' => 'v2.3.1',        'asset' => 'plugins/ozi-ui/ozi-addons/js/ozi-copy.js'],
        'oziCheck'        => ['version' => 'v1.0.0',        'asset' => 'plugins/ozi-ui/ozi-addons/js/ozi-check.js'],
        'oziAuth'         => ['version' => 'v2.2.4',        'asset' => 'plugins/ozi-ui/ozi-addons/js/ozi-auth.js'],
        'oziAddons'       => ['version' => 'v1.2.0',        'asset' => 'plugins/ozi-ui/ozi-addons/js/ozi-addons.js'],
    ];

    public function handle(): int
    {
        $this->newLine();
        $this->line('  <fg=red>ozi</><fg=#e67e22>-ui</> — Verificação do ecossistema');
        $this->newLine();

        $allOk    = true;
        $found    = 0;
        $missing  = 0;

        foreach ($this->plugins as $name => $info) {
            $path   = public_path($info['asset']);
            $exists = file_exists($path);

            if ($exists) {
                $this->line(sprintf(
                    '  <fg=green>✔</> <fg=white>%-18s</> <fg=yellow>%-14s</> <fg=gray>OK</>',
                    $name,
                    $info['version']
                ));
                $found++;
            } else {
                $this->line(sprintf(
                    '  <fg=red>✘</> <fg=white>%-18s</> <fg=yellow>%-14s</> <fg=red>Não publicado</>',
                    $name,
                    $info['version']
                ));
                $missing++;
                $allOk = false;
            }
        }

        $this->newLine();

        // Verifica o config
        $configOk = file_exists(config_path('ozi-ui.php'));
        if ($configOk) {
            $this->line('  <fg=green>✔</> <fg=white>config/ozi-ui.php</> <fg=gray>OK</>');
        } else {
            $this->line('  <fg=red>✘</> <fg=white>config/ozi-ui.php</> <fg=red>Não publicado</>');
            $allOk = false;
        }

        $this->newLine();

        // Resumo
        if ($allOk) {
            $this->line('  <fg=green>✔ Tudo certo!</> ozi-ui está instalado e configurado corretamente.');
        } else {
            $this->line("  <fg=yellow>⚠ {$missing} item(s) não publicado(s).</> Rode:");
            $this->newLine();
            $this->line('    <fg=white>php artisan vendor:publish --tag=ozi-ui</>');
        }

        $this->newLine();

        return $allOk ? self::SUCCESS : self::FAILURE;
    }
}
