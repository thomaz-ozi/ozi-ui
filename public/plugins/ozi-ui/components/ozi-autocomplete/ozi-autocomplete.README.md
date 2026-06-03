# ozi-autocomplete.js

**Versão:** 1.0.0  
**Camada:** `components/ozi-autocomplete/`  
**Dependências:** `ozi-core.js`, `ozi-suggest.js`, `ozi-validate.js`  
**Expõe:** `OZI.components.autocomplete`, `window.OziAutocomplete` (compat)  
**Eventos:** `ozi:change`, `ozi:unique-invalid`

---

## Descrição

Input com sugestões filtradas — variante simplificada do `oziSelect`.  
Single-select, sem grupos, sem imagens. O usuário digita diretamente no input.

Diferenciais em relação ao oziSelect:
- Input visível — usuário digita e vê sugestões
- `syncInputToSelectionOrExactMatch` no blur — match exato antes de limpar
- `data-ozi-autocomplete-unique` — impede duplicatas no grupo
- Busca remota implementada via `OZI.modules.suggest` (ausente na v0.x)

---

## Atributos HTML

### [1] Identificação
| Atributo | Tipo | Descrição |
|---|---|---|
| `data-ozi-autocomplete` | string | Chave única — **obrigatório** |
| `data-ozi-autocomplete-hidden-name` | string | Nome do hidden input (default: key) |

### [2] Mensagens
| Atributo | Default | Descrição |
|---|---|---|
| `data-ozi-autocomplete-msg-empty` | `'Nenhum resultado'` | Mensagem sem resultados |
| `data-ozi-autocomplete-msg-search` | `'Pesquisar...'` | Placeholder do input |
| `data-ozi-autocomplete-required` | `false` | Campo obrigatório |
| `data-ozi-autocomplete-required-message` | `'Campo obrigatório'` | Mensagem de validação |

### [3] Busca remota
| Atributo | Default | Descrição |
|---|---|---|
| `data-ozi-autocomplete-zld-url` | — | URL do endpoint |
| `data-ozi-autocomplete-zld-method` | `'POST'` | Método HTTP |
| `data-ozi-autocomplete-zld-param` | `'search'` | Nome do parâmetro |
| `data-ozi-autocomplete-zld-item-name` | — | Chave do array na resposta |
| `data-ozi-autocomplete-zld-min` | `1` | Mínimo de chars |
| `data-ozi-autocomplete-zld-delay` | `300` | Debounce em ms |
| `data-ozi-autocomplete-zld-log` | `false` | Log de debug |

### [4] Alias
| Atributo | Exemplo | Descrição |
|---|---|---|
| `data-ozi-autocomplete-as` | `"value=id, label=nome"` | Remapeia campos do JSON |

### [5] Unicidade
| Atributo | Descrição |
|---|---|
| `data-ozi-autocomplete-unique` | Nome do grupo de unicidade |
| `data-ozi-autocomplete-unique-message` | Mensagem quando viola unicidade |

---

## Opções — formato JSON

```html
<script type="application/json" data-ozi-autocomplete-options="cliente">
[
    { "value": "1", "label": "João Silva" },
    { "value": "2", "label": "Maria Santos", "subLabel": "RJ" }
]
</script>
<div data-ozi-autocomplete="cliente"
     data-ozi-autocomplete-hidden-name="cliente_id">
</div>
```

---

## API pública

### Estática — `OZI.components.autocomplete`

```js
OZI.components.autocomplete.init(root?)
OZI.components.autocomplete.get(key)
OZI.components.autocomplete.getAll()
OZI.components.autocomplete.destroy(key)
OZI.components.autocomplete.reload(key)
OZI.components.autocomplete.value(key)           // getter
OZI.components.autocomplete.value(key, value)    // setter
OZI.components.autocomplete.item(key)            // item completo selecionado
OZI.components.autocomplete.clear(key)
OZI.components.autocomplete.setOptions(key, [])
```

### Por instância

```js
var inst = OZI.components.autocomplete.get('cliente');
inst.getValue()         // valor do hidden
inst.getItem()          // item completo { value, label, ... }
inst.setValue('1')      // define valor
inst.setOptions([...])  // substitui opções
inst._clearSelection()  // limpa
inst.isValid()          // boolean
inst.validate(focus?)   // valida e aplica estado visual
inst.setState('valid' | 'invalid' | 'reset')
```

---

## Eventos

| Evento | Payload | Quando |
|---|---|---|
| `ozi:change` | `{ value, label, item }` | Seleção alterada ou limpa |
| `ozi:unique-invalid` | `{ item, group }` | Tentou selecionar item já selecionado no grupo |

```js
$('[data-ozi-autocomplete="cliente"]').on('ozi:change', function (e, payload) {
    console.log('selecionado:', payload.value, payload.label);
});
```

---

## Exemplos

### Básico com opções locais

```html
<script type="application/json" data-ozi-autocomplete-options="cidade">
    [{"value":"1","label":"São Paulo"},{"value":"2","label":"Rio de Janeiro"}]
</script>
<div data-ozi-autocomplete="cidade"
     data-ozi-autocomplete-required="true">
</div>
```

### Busca remota

```html
<div data-ozi-autocomplete="cliente"
     data-ozi-autocomplete-as="value=id, label=nome"
     data-ozi-autocomplete-zld-url="/api/clientes"
     data-ozi-autocomplete-zld-min="2"
     data-ozi-autocomplete-zld-delay="400">
</div>
```

### Unicidade — impede selecionar o mesmo cliente em duas linhas

```html
<!-- linha 1 -->
<div data-ozi-autocomplete="cliente_1"
     data-ozi-autocomplete-unique="clientes-lista">
</div>

<!-- linha 2 -->
<div data-ozi-autocomplete="cliente_2"
     data-ozi-autocomplete-unique="clientes-lista"
     data-ozi-autocomplete-unique-message="Este cliente já foi selecionado.">
</div>
```

---

## Comportamento no blur — `syncInputToSelectionOrExactMatch`

Quando o usuário sai do input (blur):

```
1. Input vazio → limpa seleção e hidden
2. Label bate com seleção atual → mantém (sem reprocessar)
3. Match exato nas opções locais → seleciona automaticamente
4. Sem match → limpa hidden, mantém texto visível (usuário vê o que digitou)
```

Delay de 120ms para não competir com o `mousedown` do dropdown.

---

## Comparação v0.x → v1.0.0

| v0.x | v1.0.0 |
|---|---|
| Busca remota não implementada | `OZI.modules.suggest.createRemoteSearcher` |
| Classes Bootstrap hardcoded | `OZI.conf.classMap` |
| Strings PT hardcoded | `OZI.lang.t()` |
| MutationObserver próprio | `OZI.hooks.afterRender.register` |
| Sem adapter de validação | `OZI.modules.validate.registerAdapter` |
| `window.OziAutocomplete` | `OZI.components.autocomplete` + alias compat |
| `oziAutocompleteInitFetched` | Alias depreciado com warn |

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-suggest.js` | `loadFromScriptTag`, `normalizeOptions`, `filterByQuery`, `createRemoteSearcher` |
| `ozi-validate.js` | Adapter registrado automaticamente ao carregar |
| `ozi-hooks.js` | `afterRender.register('component:autocomplete')` |
