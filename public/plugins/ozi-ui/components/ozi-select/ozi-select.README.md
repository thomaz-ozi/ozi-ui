# ozi-select.js

**Versão:** 1.0.0  
**Camada:** `components/ozi-select/`  
**Dependências:** `ozi-core.js`, `ozi-suggest.js`, `ozi-validate.js`  
**Expõe:** `OZI.components.select`, `window.OziSelect` (compat)  
**Eventos:** `ozi:open`, `ozi:close`, `ozi:change`

---

## Descrição

Select customizado com busca, seleção múltipla, grupos, imagens e busca remota.  
Padrão Prototype com `key/uid/ns` + registry + destroy.  
Baseado em `oziSelect v4.3.2`.

---

## Atributos HTML

### [1] Identificação
| Atributo | Tipo | Descrição |
|---|---|---|
| `data-ozi-select` | string | Chave única da instância — **obrigatório** |

### [2] Modo
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `data-ozi-select-multiple` | boolean | `false` | Seleção múltipla com tags |
| `data-ozi-select-multiple-group` | boolean | `false` | Múltipla com toggle de grupo |
| `data-ozi-select-disabled` | boolean | `false` | Desabilitado |
| `data-ozi-select-required` | boolean | `false` | Campo obrigatório |

### [3] Visual
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `data-ozi-select-value-placeholder` | string | `'Selecione...'` | Placeholder do control |
| `data-ozi-select-search-placeholder` | string | `'Pesquisar...'` | Placeholder da busca |
| `data-ozi-select-list` | string | — | Max-height da lista (ex: `'200px'`) |
| `data-ozi-select-image-dimension` | string | `'24px'` | Tamanho das imagens |

### [4] Submit
| Atributo | Tipo | Default | Descrição |
|---|---|---|---|
| `data-ozi-select-submit-name` | string | `data-ozi-select` | Nome base dos hidden inputs |
| `data-ozi-select-submit-mode` | string | `'value-label'` | Modo de geração dos inputs |
| `data-ozi-select-submit-extra` | string | — | Campos extras no modo value-label |

**Modos de submit:**

| Modo | Hidden inputs gerados |
|---|---|
| `value-label` | `name`, `name_label`, `name_image`, `name_group` + extras |
| `value` | Só `name` |
| `auto` | `name[i]`, `name[i][campo]` para todos os campos do JSON |
| `legacy` | Campos explícitos via `data-ozi-select-submit-fields` |

### [5] Alias
| Atributo | Exemplo | Descrição |
|---|---|---|
| `data-ozi-select-as` | `"value=id, label=nome"` | Remapeia campos do JSON |

### [6] Busca remota
| Atributo | Default | Descrição |
|---|---|---|
| `data-ozi-select-zld-url` | — | URL do endpoint |
| `data-ozi-select-zld-method` | `'POST'` | Método HTTP |
| `data-ozi-select-zld-param` | `'search'` | Nome do parâmetro |
| `data-ozi-select-zld-item-name` | — | Chave do array na resposta |
| `data-ozi-select-zld-min` | `1` | Mínimo de chars |
| `data-ozi-select-zld-delay` | `300` | Debounce em ms |
| `data-ozi-select-zld-log` | `false` | Log de debug |

### [7] Validação
| Atributo | Descrição |
|---|---|
| `data-ozi-select-required-message` | Mensagem customizada de validação |

---

## Opções — formato JSON

```html
<script type="application/json" data-ozi-select-options="meu-select">
[
    { "value": "1", "label": "Opção 1" },
    { "value": "2", "label": "Opção 2", "group": "Grupo A" },
    { "value": "3", "label": "Opção 3", "image": "/img/foto.jpg", "selected": true },
    { "value": "4", "label": "Desabilitada", "disabled": true }
]
</script>
<div data-ozi-select="meu-select"></div>
```

**Campos suportados:**

| Campo | Tipo | Descrição |
|---|---|---|
| `value` | any | Valor submetido — obrigatório |
| `label` | string | Texto exibido — obrigatório |
| `group` | string | Grupo de agrupamento |
| `image` | string | URL de imagem |
| `subLabel` | string | Texto secundário |
| `selected` | boolean | Pré-selecionado |
| `disabled` | boolean | Desabilitado |

---

## API pública

### Estática — `OZI.components.select`

```js
OZI.components.select.init(root?)        // inicializa no escopo
OZI.components.select.get(key)           // instância por key
OZI.components.select.getAll()           // todas as instâncias
OZI.components.select.destroy(key)       // destrói
OZI.components.select.reload(key)        // reconstrói
OZI.components.select.value(key)         // getter
OZI.components.select.value(key, val)    // setter
OZI.components.select.items(key)         // itens selecionados
OZI.components.select.clear(key)         // limpa seleção
OZI.components.select.open(key)          // abre dropdown
OZI.components.select.close(key)         // fecha dropdown
OZI.components.select.disable(key)       // desabilita
OZI.components.select.enable(key)        // habilita
OZI.components.select.required(key)      // getter de required
OZI.components.select.required(key, bool) // setter de required
OZI.components.select.setOptions(key, []) // atualiza opções
```

### Por instância

```js
var inst = OZI.components.select.get('meu-select');
inst.getValue()           // valor(es) atual(is)
inst.setValue('SP')       // define valor
inst.getItems()           // itens completos selecionados
inst.setOptions([...])    // substitui opções
inst.clearSelection()     // limpa
inst.isValid()            // boolean
inst.validate(focusOnError?) // valida e aplica estado visual
inst.setState('valid' | 'invalid' | 'reset')
inst.emit(eventName, payload)
```

---

## Eventos

| Evento | Payload | Quando |
|---|---|---|
| `ozi:open` | `{}` | Dropdown aberto |
| `ozi:close` | `{}` | Dropdown fechado |
| `ozi:change` | `{ value, items }` | Seleção alterada |

```js
$('[data-ozi-select="estado"]').on('ozi:change', function (e, payload) {
    console.log('valor:', payload.value);
    console.log('itens:', payload.items);
});
```

---

## Exemplos

### Select simples

```html
<script type="application/json" data-ozi-select-options="estado">
    [{"value":"SP","label":"São Paulo"},{"value":"RJ","label":"Rio de Janeiro"}]
</script>
<div data-ozi-select="estado" data-ozi-select-required="true"></div>
```

### Com alias map (backend com campos diferentes)

```html
<div data-ozi-select="cliente"
     data-ozi-select-as="value=id, label=nome_completo"
     data-ozi-select-zld-url="/api/clientes"
     data-ozi-select-zld-min="2">
</div>
```

### Múltipla com grupos

```html
<div data-ozi-select="categorias"
     data-ozi-select-multiple-group="true"
     data-ozi-select-submit-mode="auto">
</div>
```

### Submit mode auto — todos os campos do JSON

```html
<div data-ozi-select="produto" data-ozi-select-submit-mode="auto"></div>
```

JSON: `[{"value":"1","label":"Produto A","sku":"ABC","price":"99.90"}]`  
Gera: `produto[0]=1`, `produto[0][label]=Produto A`, `produto[0][sku]=ABC`, `produto[0][price]=99.90`

---

## Comparação v0.x → v1.0.0

| v0.x | v1.0.0 |
|---|---|
| Classes `is-invalid` hardcoded | `OZI.conf.classMap.invalid` |
| Strings PT hardcoded | `OZI.lang.t('select.*')` |
| `fetchRemoteOptions` próprio (~150 linhas) | `OZI.modules.suggest.createRemoteSearcher` |
| MutationObserver próprio | `OZI.hooks.afterRender.register` |
| Sem adapter de validação | `OZI.modules.validate.registerAdapter` |
| `window.OziSelect` | `OZI.components.select` + alias compat |
