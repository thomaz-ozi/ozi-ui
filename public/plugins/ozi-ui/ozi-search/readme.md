# oziSearch

### Identificação
- **Nome:** `oziSearch`
- **Versão:** `2.0.0`
- **Data:** `2026-04-26`

---

### Descrição

`oziSearch` é um plugin de busca, filtragem e paginação em tempo real para interfaces web. Localiza, destaca e organiza elementos no DOM a partir da digitação do usuário, permitindo pesquisar itens por seletor configurável, ocultar ou exibir resultados dinamicamente e destacar termos encontrados.

A partir da v2.0.0 o plugin incorpora paginação declarativa — transformando qualquer lista de elementos em uma interface estilo DataTables, porém baseada em `div` e totalmente responsiva, sem dependência de `<table>`. A paginação recalcula automaticamente ao filtrar, volta para a página 1 a cada nova busca e integra-se nativamente com conteúdo dinâmico via `oziLoadData`.

---

### Recursos

- Busca em tempo real por seletor CSS configurável
- Filtragem com ocultação de itens não encontrados
- Busca por múltiplas palavras simultâneas
- Highlight configurável via tokens CSS próprios
- Modo somente highlight — sem ocultação de itens
- Grupos dinâmicos — oculta grupos sem itens visíveis
- Paginação declarativa — sem `<table>`, sem DataTables
- Integração com `afterRender` — funciona com conteúdo dinâmico via oziLoadData

---

### [1] ALVO DA BUSCA

| Atributo | Descrição |
|----------|-----------|
| `data-ozi-search` | Seletor dos elementos pesquisados e filtrados |
| `data-ozi-search-group` | Grupos relacionados — ocultados quando sem itens visíveis |

---

### [2] COMPORTAMENTO DA BUSCA

| Atributo | Descrição |
|----------|-----------|
| `data-ozi-search-min` | Mínimo de caracteres para iniciar a busca |
| `data-ozi-search-words` | Ativa busca por múltiplos termos separados por espaço |
| `data-ozi-search-multi` | Alias legado de `data-ozi-search-words` |
| `data-ozi-search-no-filter` | Mantém itens visíveis — aplica apenas highlight |

---

### [3] HIGHLIGHT

| Valor | Comportamento |
|-------|--------------|
| `true`, `1` ou vazio | Usa a classe padrão `ozi-search-highlight` |
| `false` ou `0` | Desativa o highlight |
| Texto qualquer | Usa o valor como classe CSS personalizada |

```html
data-ozi-search-highlight="true"
data-ozi-search-highlight="minha-classe-destaque"
```

---

### [4] PAGINAÇÃO

A paginação transforma qualquer lista de elementos em páginas navegáveis. O `<nav>` de controle é injetado automaticamente dentro do container, abaixo dos itens.

| Atributo | Padrão | Descrição |
|----------|--------|-----------|
| `data-ozi-search-pagination` | `10` | Ativa paginação — valor define itens por página |
| `data-ozi-search-pagination-id` | — | **Obrigatório** — ID do container que envolve os itens |

**Comportamento:**
- Na inicialização → pagina todos os itens
- Ao digitar → filtra, recalcula total de páginas, volta para página 1
- Ao limpar → restaura paginação original
- Reticências automáticas quando há muitas páginas: `< 1 ... 4 5 6 ... 10 >`

#### Exemplo completo
```html
<input
    type="text"
    class="form-control"
    data-ozi-search=".item-card"
    data-ozi-search-pagination="20"
    data-ozi-search-pagination-id="listaContainer"
    data-ozi-search-highlight="true"
    placeholder="Pesquisar...">

<div id="listaContainer">
    <div class="item-card">Item 1</div>
    <div class="item-card">Item 2</div>
    <div class="item-card">Item 3</div>
    <!-- nav de paginação injetado automaticamente aqui -->
</div>
```

---

### [5] APARÊNCIA — TOKENS CSS

```css
:root {
    /* paginação */
    --ozi-search-pagination-gap: 4px;
    --ozi-search-pagination-radius: 0.375rem;
    --ozi-search-pagination-height: 34px;
    --ozi-search-pagination-min-width: 34px;
    --ozi-search-pagination-font-size: 0.875rem;

    --ozi-search-pagination-color: #495057;
    --ozi-search-pagination-bg: #fff;
    --ozi-search-pagination-border: #dee2e6;

    --ozi-search-pagination-hover-bg: #f8f9fa;
    --ozi-search-pagination-hover-border: #adb5bd;

    --ozi-search-pagination-active-bg: #0d6efd;
    --ozi-search-pagination-active-color: #fff;
    --ozi-search-pagination-active-border: #0d6efd;

    --ozi-search-pagination-disabled-color: #adb5bd;

    /* highlight */
    --ozi-search-highlight-bg: #fff3cd;
    --ozi-search-highlight-color: #212529;
}
```

---

### [6] EXEMPLOS

#### Busca simples
```html
<input
    type="text"
    data-ozi-search=".item"
    placeholder="Pesquisar...">
```

#### Busca com múltiplas palavras e highlight
```html
<input
    type="text"
    data-ozi-search=".produto"
    data-ozi-search-words="true"
    data-ozi-search-highlight="true"
    data-ozi-search-min="2"
    placeholder="Pesquisar produtos...">
```

#### Busca com grupos
```html
<input
    type="text"
    data-ozi-search=".menu-item"
    data-ozi-search-group=".menu-group"
    placeholder="Pesquisar no menu...">
```

#### Busca com paginação
```html
<input
    type="text"
    data-ozi-search=".card"
    data-ozi-search-pagination="12"
    data-ozi-search-pagination-id="cardContainer"
    placeholder="Pesquisar...">

<div id="cardContainer">
    <div class="card">...</div>
    <div class="card">...</div>
</div>
```

---

### [7] ATRIBUTOS REMOVIDOS NA v2.0.0

| Atributo | Motivo |
|----------|--------|
| `data-ozi-search-menu` | Removido — funcionalidade de menu hierárquico descontinuada |