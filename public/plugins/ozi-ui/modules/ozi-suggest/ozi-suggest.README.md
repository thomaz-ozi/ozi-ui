# ozi-suggest.js

**Versão:** 1.0.0  
**Camada:** `modules/`  
**Dependências:** `ozi-core.js` (OZI.helpers.normalize — opcional)  
**Expõe:** `OZI.modules.suggest`  
**Consumido por:** `ozi-select.js`, `ozi-autocomplete.js`

---

## Descrição

Módulo de busca e sugestão compartilhado entre `oziSelect` e `oziAutocomplete`.  
Elimina ~240 linhas duplicadas entre os dois plugins no código real v0.x.

---

## O que resolve (v0.x)

| Duplicação | Onde existia | Linhas eliminadas |
|---|---|---|
| `fetchRemoteOptions` com AbortController + seq guard | oziSelect + oziAutocomplete | ~150 |
| `parseAliasMap` + `normalizeOptions` | oziSelect + oziAutocomplete | ~50 |
| `normalize` + `filterByQuery` | oziSelect + oziAutocomplete + oziSearch | ~40 |
| **Total** | | **~240** |

---

## API pública

### `OZI.modules.suggest.loadFromScriptTag(key, attrName)`

Lê opções de uma tag `<script type="application/json">`.

```html
<script type="application/json" data-ozi-select-options="estado">
    [{"value": "SP", "label": "São Paulo"}, {"value": "RJ", "label": "Rio de Janeiro"}]
</script>
```

```js
OZI.modules.suggest.loadFromScriptTag('estado', 'data-ozi-select-options');
// → [{ value: 'SP', label: 'São Paulo' }, { value: 'RJ', label: 'Rio de Janeiro' }]
```

Aceita array direto ou `{ options: [...] }`.

---

### `OZI.modules.suggest.parseAliasMap(rawString)`

Parseia string de alias de campo.

```js
OZI.modules.suggest.parseAliasMap('value=id, label=nome, group=setor');
// → { value: 'id', label: 'nome', group: 'setor' }
```

Usado quando o backend retorna campos com nomes diferentes do esperado pelo plugin.  
Ativado via atributo HTML: `data-ozi-select-as="value=id, label=nome"`.

---

### `OZI.modules.suggest.normalizeOptions(options, aliasMap)`

Aplica aliasMap nas opções — remapeia campos para nomes canônicos.

```js
var aliasMap = OZI.modules.suggest.parseAliasMap('value=id, label=estado');

OZI.modules.suggest.normalizeOptions(
    [{ id: 1, estado: 'São Paulo', sigla: 'SP' }],
    aliasMap
);
// → [{ value: 1, label: 'São Paulo', id: 1, estado: 'São Paulo', sigla: 'SP' }]
```

Preserva campos originais — não perde dados.

---

### `OZI.modules.suggest.normalize(str)`

NFD + remove diacríticos + lowercase. Para busca sem acentos.

```js
OZI.modules.suggest.normalize('São Paulo') // 'sao paulo'
OZI.modules.suggest.normalize('Ação')      // 'acao'
```

---

### `OZI.modules.suggest.filterByQuery(options, query, fields?)`

Filtra opções por query normalizada.

```js
OZI.modules.suggest.filterByQuery(options, 'paulo');
// busca em ['label', 'value', 'group'] por padrão

OZI.modules.suggest.filterByQuery(options, 'sp', ['value', 'sigla']);
// busca nos campos 'value' e 'sigla'
```

---

### `OZI.modules.suggest.createRemoteSearcher(config)`

Cria instância de busca remota com debounce, AbortController e seq guard.

```js
var searcher = OZI.modules.suggest.createRemoteSearcher({
    url:      '/api/clientes/busca',
    method:   'POST',           // 'POST' | 'GET'
    param:    'search',         // nome do parâmetro enviado
    itemName: 'clientes',       // chave do array na resposta JSON
    min:      2,                // mínimo de chars para disparar
    delay:    300,              // debounce em ms
    aliasMap: { value: 'id', label: 'nome' },
    log:      false
});

// callback de loading (spinner, ícone)
searcher.onLoadingChange(function (isLoading) {
    $spinner.toggle(isLoading);
});

// busca com debounce automático
searcher.fetch('joão').then(function (options) {
    renderOptions(options);
});

// cancela requisição em andamento
searcher.abort();
```

**Config:**

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `url` | string | — | URL do endpoint de busca |
| `method` | string | `'POST'` | Método HTTP |
| `param` | string | `'search'` | Nome do parâmetro enviado |
| `itemName` | string | `''` | Chave do array na resposta |
| `min` | number | `1` | Mínimo de chars para disparar |
| `delay` | number | `300` | Debounce em ms |
| `aliasMap` | object | `{}` | Mapa de alias para normalizar resposta |
| `log` | boolean | `false` | Log de debug por instância |

**API do searcher retornado:**

| Método | Descrição |
|---|---|
| `fetch(query)` | Busca com debounce — retorna `Promise<Option[]>` |
| `abort()` | Cancela requisição e debounce em andamento |
| `setLoading(bool)` | Define loading manualmente |
| `onLoadingChange(fn)` | Callback chamado ao mudar loading |
| `isLoading` | Estado atual (getter) |

---

## Proteções do createRemoteSearcher

### AbortController
Cancela requisição HTTP anterior ao iniciar nova busca. Evita race conditions.

### Seq guard
Ignora respostas de requisições antigas — se chegarem fora de ordem, são descartadas silenciosamente.

### Debounce
Aguarda `delay` ms antes de disparar — evita requisições a cada tecla.

### Min chars
Requisições só disparam com `query.length >= min`. Abaixo do mínimo retorna `[]` imediatamente.

---

## Formato de resposta esperado

O searcher aceita qualquer um dos formatos:

```json
// array direto
[{ "value": 1, "label": "João Silva" }]

// envelope options
{ "options": [{ "value": 1, "label": "João Silva" }] }

// envelope items
{ "items": [{ "value": 1, "label": "João Silva" }] }

// envelope por itemName (config.itemName = 'clientes')
{ "clientes": [{ "id": 1, "nome": "João Silva" }] }
```

---

## Como oziSelect e oziAutocomplete usam

```js
// dentro de OziSelect.prototype.init():
this._searcher = OZI.modules.suggest.createRemoteSearcher({
    url:      this.$root.attr('data-ozi-select-zld-url'),
    method:   this.$root.attr('data-ozi-select-zld-method') || 'POST',
    param:    this.$root.attr('data-ozi-select-zld-param')  || 'search',
    itemName: this.$root.attr('data-ozi-select-zld-item-name'),
    min:      parseInt(this.$root.attr('data-ozi-select-zld-min') || '1'),
    delay:    parseInt(this.$root.attr('data-ozi-select-zld-delay') || '300'),
    aliasMap: OZI.modules.suggest.parseAliasMap(this.$root.attr('data-ozi-select-as'))
});

this._searcher.onLoadingChange(function (isLoading) {
    self._setSearchLoading(isLoading);
});

// ao digitar na busca:
this._searcher.fetch(query).then(function (options) {
    self._renderOptions(options);
});
```

---

## Opções — estrutura canônica

```js
{
    value:  any,      // obrigatório — valor submetido
    label:  string,   // obrigatório — texto exibido
    group?: string,   // opcional — grupo de agrupamento
    image?: string,   // opcional — URL de imagem (oziSelect)
    disabled?: boolean // opcional — opção desabilitada
}
```

---

## CHANGELOG

### [1.0.0] — 2025

- `loadFromScriptTag(key, attrName)` — carrega opções de script tag JSON
- `parseAliasMap(rawString)` — parseia string de alias de campo
- `normalizeOptions(options, aliasMap)` — remapeia campos preservando originais
- `normalize(str)` — NFD + diacríticos + lowercase (delega para OZI.helpers)
- `filterByQuery(options, query, fields?)` — filtro local multi-campo
- `createRemoteSearcher(config)` — instância com AbortController + seq guard + debounce
- Aceita múltiplos formatos de resposta: array, `options`, `items`, `[itemName]`
- Elimina ~240 linhas duplicadas entre oziSelect e oziAutocomplete

**Versões anteriores:** não existia como arquivo separado.  
Lógica estava duplicada em `oziSelect v4.3.2` e `oziAutocomplete v2.2.1`.
