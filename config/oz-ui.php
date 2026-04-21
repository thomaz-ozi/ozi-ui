<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Caminho base dos assets
    |--------------------------------------------------------------------------
    | Caminho relativo ao public_path() onde os assets foram publicados.
    |
    */
    'base_path' => 'plugins/ozi-ui',

    /*
    |--------------------------------------------------------------------------
    | Plugins ativos
    |--------------------------------------------------------------------------
    | Define quais plugins serão carregados pelas diretivas @oziStyles
    | e @oziScripts. Comente ou remova os que não utilizar.
    |
    */
    'plugins' => [
        'ozi-loaddata',
        'ozi-select',
        // 'ozi-select-livewire', // descomente se usar Livewire
        'ozi-search',
        'ozi-editor',
        'ozi-autocomplete',
        'ozi-audio',
        'ozi-addons',
    ],

    /*
    |--------------------------------------------------------------------------
    | Debug
    |--------------------------------------------------------------------------
    | Ativa logs detalhados no console do browser.
    |
    */
    'debug' => env('OZI_DEBUG', false),

];
