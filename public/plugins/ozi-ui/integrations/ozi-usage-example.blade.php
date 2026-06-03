{{-- ============================================================
     OZI-UI v1.0.0 — Exemplo de integração completa com Livewire
     ============================================================
     Ordem de carregamento correta para projeto Laravel + Livewire
     ============================================================ --}}

{{-- [1] CSS --}}
<link rel="stylesheet" href="{{ asset('plugins/ozi-ui/themes/bootstrap5/tokens.css') }}">
<link rel="stylesheet" href="{{ asset('plugins/ozi-ui/themes/bootstrap5/overrides.css') }}">
<link rel="stylesheet" href="{{ asset('plugins/ozi-ui/shared/css/ozi-utilities.css') }}">
<link rel="stylesheet" href="{{ asset('plugins/ozi-ui/components/ozi-select/css/ozi-select.css') }}">
<link rel="stylesheet" href="{{ asset('plugins/ozi-ui/components/ozi-select/css/ozi-select-bs5.css') }}">
<link rel="stylesheet" href="{{ asset('plugins/ozi-ui/components/ozi-editor/css/ozi-editor.css') }}">
<link rel="stylesheet" href="{{ asset('plugins/ozi-ui/modules/ozi-loaddata/css/ozi-loaddata.css') }}">

{{-- [2] Core JS — ordem obrigatória --}}
<script src="{{ asset('plugins/ozi-ui/core/ozi-conf.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/core/ozi-hooks.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/core/ozi-en.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/core/ozi-loader.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/core/ozi-integrations.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/core/helpers/ozi-helpers.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/core/ozi-core.js') }}"></script>

{{-- [3] Tema classmap --}}
<script src="{{ asset('plugins/ozi-ui/themes/bootstrap5/classmap.js') }}"></script>

{{-- [4] Configuração global --}}
<script>
oziConf({
    theme:        'bootstrap5',
    themeMode:    'auto',
    lang:         'pt-BR',
    fallbackLang: 'en',
    integrations: ['livewire'],
    core: {
        urlBase:  '/plugins/ozi-ui/',
        log:      false,
        failFast: false
    },
    plugins: {
        select:   { imageDimension: '24px' },
        editor:   { uicolor: 'var(--bs-primary)' },
        auth:     { passMin: 12, passMax: 64 }
    }
});
</script>

{{-- [5] Lang compartilhado --}}
<script src="{{ asset('plugins/ozi-ui/shared/lang/pt-BR.js') }}"></script>

{{-- [6] Modules --}}
<script src="{{ asset('plugins/ozi-ui/modules/ozi-loaddata/js/ozi-loaddata.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/modules/ozi-validate/js/ozi-validate.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/modules/ozi-actions/js/ozi-actions.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/modules/ozi-suggest/js/ozi-suggest.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/modules/ozi-password-rules/js/ozi-password-rules.js') }}"></script>

{{-- [7] Components + lang --}}
<script src="{{ asset('plugins/ozi-ui/components/ozi-select/lang/pt-BR.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/components/ozi-select/js/ozi-select.js') }}"></script>

<script src="{{ asset('plugins/ozi-ui/components/ozi-autocomplete/lang/pt-BR.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/components/ozi-autocomplete/js/ozi-autocomplete.js') }}"></script>

<script src="{{ asset('plugins/ozi-ui/components/ozi-editor/lang/pt-BR.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/components/ozi-editor/js/ozi-editor.js') }}"></script>

<script src="{{ asset('plugins/ozi-ui/components/ozi-audio/lang/pt-BR.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/components/ozi-audio/js/ozi-audio.js') }}"></script>

<script src="{{ asset('plugins/ozi-ui/components/ozi-auth/lang/pt-BR.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/components/ozi-auth/js/ozi-auth.js') }}"></script>

<script src="{{ asset('plugins/ozi-ui/components/ozi-check/js/ozi-check.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/components/ozi-search/js/ozi-search.js') }}"></script>

{{-- [8] Behaviors --}}
<script src="{{ asset('plugins/ozi-ui/behaviors/ozi-copy/js/ozi-copy.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/behaviors/ozi-toggle/js/ozi-toggle.js') }}"></script>

{{-- [9] Integrations --}}
<script src="{{ asset('plugins/ozi-ui/integrations/adapters/ozi-livewire.adapter.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-select.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-autocomplete.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-editor.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-audio.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-auth.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-check.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-search.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-copy.plugin.js') }}"></script>
<script src="{{ asset('plugins/ozi-ui/integrations/plugins/ozi-toggle.plugin.js') }}"></script>


{{-- ============================================================
     EXEMPLOS DE USO NO HTML / BLADE
     ============================================================ --}}


{{-- SELECT simples com Livewire --}}
<div wire:ignore>
    <div data-ozi-select="estado"
         data-ozi-select-required="true"
         data-ozi-livewire-model="estado"
         data-ozi-livewire-options-event="estados-updated"
         data-ozi-livewire-value="{{ $estado ?? '' }}">
    </div>
    <script type="application/json" data-ozi-select-options="estado">
        @json($estadosOptions ?? [])
    </script>
    <div class="invalid-feedback"></div>
</div>


{{-- AUTOCOMPLETE com text-model (label além do value) --}}
<div wire:ignore>
    <div data-ozi-autocomplete="cliente_id"
         data-ozi-autocomplete-hidden-name="cliente_id"
         data-ozi-livewire-model="cliente_id"
         data-ozi-livewire-text-model="cliente_nome"
         data-ozi-livewire-options-event="clientes-updated"
         data-ozi-livewire-value="{{ $cliente_id ?? '' }}">
    </div>
    <script type="application/json" data-ozi-autocomplete-options="cliente_id">
        @json($clientesOptions ?? [])
    </script>
</div>


{{-- EDITOR com Livewire --}}
<div wire:ignore>
    <textarea data-ozi-editor="descricao"
              data-ozi-editor-required="true"
              data-ozi-livewire-model="descricao"
              name="descricao">{{ $descricao ?? '' }}</textarea>
    <div class="invalid-feedback"></div>
</div>


{{-- SELECT com busca remota (sem Livewire model — só opções dinâmicas) --}}
<div wire:ignore>
    <div data-ozi-select="produto"
         data-ozi-select-zld-url="/api/produtos/busca"
         data-ozi-select-zld-min="2"
         data-ozi-select-as="value=id, label=nome"
         data-ozi-livewire-model="produto_id">
    </div>
</div>


{{-- LOADDATA — envio de form --}}
<div data-zld-catch-group-id="form-produto">
    <input data-zld-catch-item-name="nome" type="text" name="nome">
    <button data-zld-url="/produto/salvar"
            data-zld-destiny-id="resultado"
            data-zld-form-busy
            data-zld-form-clear="true"
            type="button">
        Salvar
    </button>
</div>
<div id="resultado"></div>


{{-- TOGGLE --}}
<button data-ozi-toggle-trigger="filtros">
    <span data-ozi-toggle-show>Mostrar filtros</span>
    <span data-ozi-toggle-hide>Ocultar filtros</span>
</button>
<div data-ozi-toggle-content="filtros" style="display:none">
    Conteúdo dos filtros
</div>


{{-- COPY --}}
<button data-ozi-copy-value="Texto copiado!">Copiar</button>

<div data-ozi-copy-content="codigo-ref">
    <code>npm install ozi-ui</code>
</div>
<button data-ozi-copy="codigo-ref">Copiar código</button>


{{-- CHECKBOXES hierárquicos --}}
<input type="checkbox" data-ozi-check-enabled="itens"> Habilitar
<input type="checkbox" data-ozi-check-all="itens"> Todos
<input type="checkbox" data-ozi-check-item="itens" value="1"> Item 1
<input type="checkbox" data-ozi-check-item="itens" value="2"> Item 2
<input type="checkbox" data-ozi-check-item="itens" value="3"> Item 3


{{-- BUSCA com highlight e paginação --}}
<input type="text"
       data-ozi-search=".meu-item"
       data-ozi-search-highlight="true"
       data-ozi-search-pagination="10"
       data-ozi-search-pagination-id="paginacao"
       placeholder="Buscar...">

<div class="meu-item">Item A</div>
<div class="meu-item">Item B</div>
<div id="paginacao"></div>


{{-- ============================================================
     EVENTOS DOM IMPERATIVOS (sem Livewire direto)
     ============================================================ --}}
<script>
// setar valor em qualquer componente OZI
document.dispatchEvent(new CustomEvent('ozi:set-value', {
    detail: { plugin: 'select', key: 'estado', value: 'SP' }
}));

// atualizar opções em qualquer componente OZI
document.dispatchEvent(new CustomEvent('ozi:set-options', {
    detail: {
        plugin: 'autocomplete',
        key: 'cliente_id',
        options: [{ value: 1, label: 'João Silva' }]
    }
}));

// escutar mudança de valor
document.querySelector('[data-ozi-select="estado"]').addEventListener('ozi:change', function (e) {
    console.log('estado selecionado:', e.detail.value);
});
</script>
