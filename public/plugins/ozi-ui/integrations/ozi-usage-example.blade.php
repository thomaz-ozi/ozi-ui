{{-- ============================================================
     OZI-UI v2 — Exemplo de integração completa com Livewire
     ============================================================
     Atualizado em 2026-09-23 (ozi-ui/core 2.6.0).

     ⚠️ Este arquivo já esteve defasado: ensinava o boot manual da v1,
     carregando `core/ozi-core.js`, `core/ozi-en.js` e `ozi-copy` — três
     arquivos que NÃO existem mais no pacote. Quem copiava daqui tomava 404
     e um editor que nunca inicializava. Ao mexer nos componentes, mexa aqui
     junto: exemplo publicado desatualizado ensina o erro ativamente.
     ============================================================ --}}

{{-- ============================================================
     [1] BOOT — as duas diretivas dão conta de tudo
     ============================================================
     @oziStyles / @oziScripts emitem CSS e JS na ordem correta, com o
     locale do Laravel e cache-busting por versão do pacote.

     Sem argumento = todos os plugins. Com lista, as DEPENDÊNCIAS são
     resolvidas sozinhas (desde a 2.6.0): pedir 'editor' traz junto o
     'validate' e o 'editor-sanitize', que o editor exige em runtime.
     A ordem das tags é sempre a canônica, não a ordem que você digitou.

     Grupos aceitos: auth · forms · livewire · shims-v1 · full
     ============================================================ --}}

@oziStyles(['select', 'autocomplete', 'editor', 'loaddata'])

@oziScripts(['forms', 'editor', 'audio', 'auth', 'check', 'search', 'toggle', 'livewire'])

{{-- [2] Tema classmap — só se o app usa bootstrap5/tailwind --}}
<script src="{{ asset('plugins/ozi-ui/themes/bootstrap5/classmap.js') }}"></script>

{{-- [3] Configuração global — sempre DEPOIS do @oziScripts --}}
<script>
oziConf({
    theme:        'bootstrap5',
    themeMode:    'auto',
    lang:         'pt-BR',
    fallbackLang: 'en',
    integrations: ['livewire'],
    core: {
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

{{-- ⓘ `core.urlBase` não precisa ser declarado no caminho @oziScripts:
     o próprio OziAssets já injeta a base resolvida por asset(). --}}

{{-- ⓘ Verificação: `php artisan ozi:check` valida a instalação contra o
     _pluginMap (fonte única) e acusa qualquer deriva, inclusive de deps. --}}


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
{{-- A chave vai em data-ozi-editor-html (ou -md, para o editor Markdown).
     `data-ozi-editor` sem sufixo é da v1 e NÃO inicializa o componente. --}}
<div wire:ignore>
    <textarea data-ozi-editor-html="descricao"
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


{{-- ⚠️ ozi-copy / ozi-paste foram DESCONTINUADOS no corte 2.0.0 (uso medido = zero).
     O exemplo que existia aqui foi removido. Substitutos: receitas Alpine, em
     ozi-ui-docs/dev/_meta/receitas-alpine.md. O código segue na tag v1-final. --}}


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
