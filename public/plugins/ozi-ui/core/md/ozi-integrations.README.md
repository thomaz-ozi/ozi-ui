# ozi-integrations.js

**Versão:** 1.0.0  
**Camada:** `core/` → `integrations/`  
**Dependências:** `ozi-conf.js`, `ozi-hooks.js`  
**Consumido por:** `ozi-core.js`  
**Usado por:** fichas `/integrations/plugins/` e adapters `/integrations/adapters/`

---

## Descrição

Matchmaker entre plugins OZI e adapters de framework.  
Evolução direta do `OziFrameworks` (v0.x) — mesma arquitetura, integrado ao namespace `OZI`.

Enquanto `ozi-hooks.js` cuida do **lifecycle de re-init**, o `ozi-integrations.js` cuida da **comunicação bidirecional plugin ↔ framework** (model binding, set-options, eventos DOM).

---

## O problema que resolve

```
PLUGINS (UI)              ozi-integrations              ADAPTERS (frameworks)
oziSelect    ─┐          ┌─ pluginRegistry           ┌─ ozi-livewire.adapter.js
oziAudio     ─┼─ ficha →─┤                           ├─ ozi-alpine.adapter.js
oziEditor    ─┘          └─ adapterRegistry  ←─ ficha─┴─ ozi-htmx.adapter.js
                                ↓
                         rescan via OZI.hooks.afterRender
```

Plugin registra ficha dizendo **"eu existo, meu seletor é X, meu evento é Y"**.  
Adapter registra dizendo **"eu sou Livewire, sei integrar com qualquer plugin desse padrão"**.  
O matchmaker casa os dois automaticamente — sem cada plugin precisar conhecer cada framework.

---

## Diferença entre `ozi-hooks` e `ozi-integrations`

| | `ozi-hooks` | `ozi-integrations` |
|---|---|---|
| **Foco** | Re-init após render dinâmico | Comunicação plugin ↔ framework |
| **Quem usa** | Todos os plugins (init) | Fichas + adapters |
| **O que faz** | Chama `OZI.components.X.init(root)` | Amarra `wire:model`, `set-value`, eventos |
| **Conhece frameworks?** | Não | Não — delega para adapters |

---

## API pública

### `OZI.integrations.registerPlugin(plugin)`

Chamado pelas fichas em `/integrations/plugins/`.

```js
// integrations/plugins/ozi-select.plugin.js
OZI.integrations.registerPlugin({
    name:         'select',
    selector:     '[data-ozi-select]',
    keyAttribute: 'data-ozi-select',
    changeEvent:  'ozi:change',

    getInstance: function (root) { return OZI.components.select.get(root); },
    getValue:    function (instance) { return instance.getValue(); },
    setValue:    function (root, value) { OZI.components.select.value(root, value); },
    destroy:     function (instance) { instance.destroy(); },
    reinit:      function (root) { OZI.components.select.init(root); }
});
```

**Contrato da ficha de plugin:**

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Identificador único — ex: `'select'` |
| `selector` | string | Seletor CSS do elemento raiz |
| `keyAttribute` | string | Atributo que contém a chave da instância |
| `changeEvent` | string | Evento disparado ao mudar valor |
| `getInstance` | function | `fn(root)` → instância |
| `getValue` | function | `fn(instance)` → valor atual |
| `setValue` | function | `fn(root, value)` → define valor |
| `destroy` | function | `fn(instance)` → destrói instância |
| `reinit` | function | `fn(root)` → reinicializa |

---

### `OZI.integrations.registerAdapter(adapter)`

Chamado pelos adapters em `/integrations/adapters/`.

```js
// integrations/adapters/ozi-livewire.adapter.js
OZI.integrations.registerAdapter({
    name:       'livewire',
    attrPrefix: 'data-ozi-livewire-',

    scan: function (plugin, scope) {
        // percorre elementos do plugin no escopo
        // amarra binding Livewire ↔ plugin
        var elements = scope.querySelectorAll(plugin.selector);
        elements.forEach(function (el) {
            _bindLivewire(el, plugin);
        });
    }
});
```

**Contrato do adapter:**

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Identificador único — ex: `'livewire'` |
| `attrPrefix` | string | Prefixo dos atributos do framework |
| `scan` | function | `fn(plugin, scope)` — amarra integração |

---

### `OZI.integrations.rescan(scope?)`

Força rescan manual. Útil para conteúdo inserido via fetch.

```js
// após inserir HTML manualmente:
document.querySelector('#container').innerHTML = html;
OZI.integrations.rescan(document.querySelector('#container'));
```

---

### Leitura dos registries

```js
OZI.integrations.getPlugins();   // ['select', 'autocomplete', 'editor', ...]
OZI.integrations.getAdapters();  // ['livewire']
OZI.integrations.getPlugin('select');   // { name, selector, ... }
OZI.integrations.getAdapter('livewire'); // { name, attrPrefix, scan }
```

---

## Helpers compartilhados

Disponíveis em `OZI.integrations.helpers.*` — para adapters reutilizarem sem duplicar.

| Helper | Descrição |
|---|---|
| `isBlank(value)` | `null`, `undefined`, `''`, `[]`, `{}` → `true` |
| `parseJsonSafe(value, fallback)` | Parse JSON sem exceção |
| `stableStringify(value)` | JSON com chaves ordenadas — para comparações |
| `escapeAttrValue(str)` | Escapa para uso em atributos HTML |
| `ensureSingleScript(id, src)` | Insere `<script>` uma única vez |
| `parseIntegrationEntry(entry)` | `'livewire:3'` → `{ name, version }` |

---

## Fluxo de registro

### Quando plugin chega primeiro

```
1. ozi-select.plugin.js → registerPlugin('select')
2. [adapter ainda não chegou — aguarda]
3. ozi-livewire.adapter.js → registerAdapter('livewire')
4. adapter.scan() roda imediatamente para 'select'
5. binding ativado ✅
```

### Quando adapter chega primeiro

```
1. ozi-livewire.adapter.js → registerAdapter('livewire')
2. [plugin ainda não chegou — aguarda]
3. ozi-select.plugin.js → registerPlugin('select')
4. adapter.scan() notificado imediatamente
5. binding ativado ✅
```

Ordem de carregamento não importa — matchmaker casa no momento em que ambos estiverem presentes.

---

## Fichas de plugin — estrutura de arquivos

```
integrations/plugins/
├── ozi-select.plugin.js
├── ozi-autocomplete.plugin.js
├── ozi-search.plugin.js
├── ozi-editor.plugin.js
├── ozi-audio.plugin.js
├── ozi-auth.plugin.js
├── ozi-check.plugin.js
├── ozi-copy.plugin.js
└── ozi-toggle.plugin.js
```

---

## Atributos HTML dos adapters

### Livewire (`data-ozi-livewire-*`)

```html
<div wire:ignore>
    <input
        data-ozi-select="estado"
        data-ozi-livewire-model="estado"
        data-ozi-livewire-value="SP">
</div>
```

| Atributo | Descrição |
|---|---|
| `data-ozi-livewire-model` | Propriedade Livewire para binding |
| `data-ozi-livewire-text-model` | Propriedade para o label (autocomplete) |
| `data-ozi-livewire-options-event` | Evento que atualiza as opções |
| `data-ozi-livewire-value` | Valor inicial vindo do Livewire |

### Eventos DOM imperativos (universais)

```js
// funciona com qualquer framework
document.dispatchEvent(new CustomEvent('ozi-livewire:set-value', {
    detail: { plugin: 'select', key: 'estado', value: 'SP' }
}));

document.dispatchEvent(new CustomEvent('ozi-livewire:set-options', {
    detail: { plugin: 'autocomplete', key: 'cliente', options: [...] }
}));
```

---

## Compat retroativa

```js
// v0.x — continua funcionando com warn no console
window.OziFrameworks.registerPlugin({...});   // → OZI.integrations.registerPlugin
window.OziFrameworks.registerAdapter({...});  // → OZI.integrations.registerAdapter
window.OziFrameworks.rescan();                // → OZI.integrations.rescan
```

---

## Comparação v0.x → v1.0.0

| v0.x | v1.0.0 |
|---|---|
| `window.OziFrameworks` | `OZI.integrations` |
| Rescan em `livewire:navigated` (próprio) | Rescan via `OZI.hooks.afterRender` |
| Helpers duplicados nos adapters | `OZI.integrations.helpers.*` compartilhado |
| `ozi-autocomplete.livewire.js` bridge dedicado | Absorvido em `ozi-livewire.adapter.js` |
| `ozi-frameworks-core.js` | `ozi-integrations.js` |

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-core.js` | Chama `OziIntegrations._boot(integrations)` |
| `ozi-hooks.js` | Integrations registra rescan via `afterRender` |
| `ozi-conf.js` | Fonte de `integrations: []` e `core.log` |
| `integrations/plugins/ozi-X.plugin.js` | Fichas declarativas de cada plugin |
| `integrations/adapters/ozi-livewire.adapter.js` | Adapter de binding Livewire |
