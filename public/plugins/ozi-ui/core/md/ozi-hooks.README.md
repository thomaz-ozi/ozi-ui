# ozi-hooks.js

**Versão:** 1.0.0  
**Camada:** `core/`  
**Dependências:** `ozi-conf.js` (para log)  
**Consumido por:** `ozi-core.js`  
**Usado por:** todos os plugins

---

## Descrição

Sistema único de re-init pós-render dinâmico.  
Substitui os 8 caminhos de auto-registro da v0.x por um único ponto de entrada.

Quando o DOM é atualizado — por Livewire, HTMX, Inertia ou qualquer SPA — o `ozi-hooks` garante que todos os plugins sejam reinicializados no escopo correto, sem duplicação e na ordem certa.

---

## Problema que resolve

Na v0.x cada plugin tinha seu próprio mecanismo de re-init:

```
oziSelect       → MutationObserver próprio
oziAudio        → window.oziAudioInitFetched
oziEditor       → MutationObserver próprio
oziLoadData     → zldConf.zldHooks.afterRender
oziAutocomplete → ozi-autocomplete.livewire.js (bridge dedicado)
...
```

Na v1.0.0 todos registram via um único canal:

```js
OZI.hooks.afterRender.register('component:select', function (root, ctx) {
    OZI.components.select.init(root);
});
```

---

## Canais disponíveis

| Canal | Quando dispara | Uso típico |
|---|---|---|
| `OZI.hooks.afterRender` | Após render dinâmico | Re-init de componentes |
| `OZI.hooks.beforeRender` | Antes do render | Cleanup, destroy de instâncias |

---

## API pública

### `OZI.hooks.afterRender.register(id, fn)`

Registra uma função para rodar após cada render dinâmico.

```js
OZI.hooks.afterRender.register('component:select', function (root, ctx) {
    OZI.components.select.init(root);
});
```

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | string | Identificador único — ex: `'component:select'` |
| `fn` | function | `fn(root, ctx)` — `root` é o elemento raiz do render |

**Deduplicação automática** — registrar o mesmo `id` duas vezes ignora o segundo silenciosamente.

---

### `OZI.hooks.afterRender.unregister(id)`

Remove uma função pelo ID.

```js
OZI.hooks.afterRender.unregister('component:select');
```

---

### `OZI.hooks.afterRender.run(root?, ctx?)`

Executa todos os hooks manualmente.  
Útil para conteúdo carregado via fetch sem passar por Livewire.

```js
// após inserir HTML manualmente:
document.querySelector('#container').innerHTML = htmlCarregado;
OZI.hooks.afterRender.run(document.querySelector('#container'));
```

| Parâmetro | Tipo | Default | Descrição |
|---|---|---|---|
| `root` | Element | `document` | Escopo do render |
| `ctx` | object | `{}` | Contexto adicional |

---

### `OZI.hooks.afterRender.getRegistered()`

Retorna lista de IDs registrados. Útil para debug.

```js
OZI.hooks.afterRender.getRegistered();
// ['component:select', 'component:editor', 'component:audio', ...]
```

---

### `OZI.hooks.afterRender.registerSource(name, connectFn)`

Registra uma fonte externa de eventos.  
Permite conectar qualquer SPA ou framework ao sistema de hooks.

```js
// exemplo: Inertia.js
OZI.hooks.afterRender.registerSource('inertia', function (channel) {
    Inertia.on('navigate', function (event) {
        channel.run(document, { source: 'inertia', event: event });
    });
});

// exemplo: HTMX
OZI.hooks.afterRender.registerSource('htmx', function (channel) {
    document.addEventListener('htmx:afterSwap', function (e) {
        channel.run(e.detail.target, { source: 'htmx' });
    });
});
```

---

## Fontes nativas (conectadas automaticamente)

| Fonte | Evento | Contexto passado |
|---|---|---|
| `dom` | `DOMContentLoaded` | `{ source: 'dom' }` |
| `livewire3` | `Livewire.hook('commit')` | `{ source: 'livewire3', component }` |
| `livewire4` | `morph.updated`, `livewire:navigated`, `livewire:initialized` | `{ source: 'livewire4', component }` |
| `compat-zld` | propaga para `zldConf.zldHooks` | — |

Auto-detect de versão: o sistema tenta conectar Livewire 3 e 4 de forma independente. Se um falhar, o outro continua. Se nenhum estiver presente, só `dom` é ativado.

---

## Convenção de IDs

Use o padrão `camada:nome` para evitar colisões:

| Padrão | Exemplo | Usado por |
|---|---|---|
| `component:X` | `component:select` | Componentes com estado |
| `behavior:X` | `behavior:copy` | Behaviors funcionais |
| `module:X` | `module:loaddata` | Módulos com re-init |
| `integration:X` | `integration:livewire` | Adapters de framework |
| `compat:X` | `compat:zld-hooks` | Aliases retroativos |

---

## Como os plugins registram

Cada plugin registra seu hook ao ser carregado — uma única vez:

```js
// dentro de ozi-select.js (ao final do arquivo)
OZI.hooks.afterRender.register('component:select', function (root, ctx) {
    OZI.components.select.init(root);
});

// dentro de ozi-editor.js
OZI.hooks.afterRender.register('component:editor', function (root, ctx) {
    OZI.components.editor.init(root);
});
```

O hook cuida do resto — deduplicação, ordem, propagação para todas as fontes.

---

## Execução segura

Erros em um hook não interrompem os outros:

```
hook 'component:select' — ok
hook 'component:editor' — erro → logado, continua
hook 'component:audio'  — ok
```

---

## Ordem de execução

**FIFO** — First In, First Out.  
A ordem de execução é a ordem de registro.  
Plugins carregados primeiro executam primeiro.

---

## Comparação v0.x → v1.0.0

| v0.x | v1.0.0 |
|---|---|
| 8 caminhos diferentes de re-init | 1 canal único |
| MutationObserver por plugin | `afterRender.register()` |
| `zldConf.zldHooks.afterRender` | `OZI.hooks.afterRender` (zld via compat) |
| Bridge `ozi-autocomplete.livewire.js` | Adapter genérico via `ozi-livewire.adapter.js` |
| `window.oziXInitFetched` flags globais | Idempotência via `data-ozi-X-initialized` |

---

## Arquivo relacionados

| Arquivo | Relação |
|---|---|
| `ozi-core.js` | Chama `OziHooks._boot()` durante bootstrap |
| `ozi-conf.js` | Fonte de `core.log` para os logs internos |
| `ozi-integrations.js` | Registra fontes externas (livewire, alpine, etc.) |
| Todos os plugins | Registram via `OZI.hooks.afterRender.register()` |