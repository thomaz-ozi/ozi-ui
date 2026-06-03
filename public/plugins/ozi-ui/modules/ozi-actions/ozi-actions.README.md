# ozi-actions.js

**Versão:** 1.0.0  
**Camada:** `modules/`  
**Dependências:** `ozi-core.js` (OZI.conf, OZI.lang)  
**Expõe:** `OZI.modules.actions`, `window.zldActions` (compat)

---

## Descrição

Sistema de ações declarativas do OZI-UI.  
O backend Laravel retorna um array `actions` no JSON — o frontend executa automaticamente.

Na v1.0.0 os acoplamentos hardcoded a `window.UIToast`, `window.bootstrap` e `window.toastr` viram **adapters por tema**, extensíveis pelo dev.

---

## Como funciona

```
Backend Laravel retorna JSON:
{
    "actions": [
        { "type": "toast",      "payload": { "message": "Salvo!", "level": "success" } },
        { "type": "modal-close" },
        { "type": "redirect",   "payload": { "url": "/lista" } }
    ]
}
        ↓
OZI.modules.loadData detecta actions
        ↓
OZI.modules.actions.run(result.data.actions)
        ↓
cada action executada pelo handler correto
```

---

## Tipos de action disponíveis

### Dependentes de tema (bootstrap5 / tailwind / default)

| Tipo | Payload | Descrição |
|---|---|---|
| `toast` | `{ message, level, delay }` | Notificação visual |
| `modal-open` | `{ id }` | Abre modal pelo ID |
| `modal-close` | `{ id? }` | Fecha modal (sem id = fecha aberto) |
| `offcanvas-open` | `{ id }` | Abre offcanvas pelo ID |
| `offcanvas-close` | `{ id? }` | Fecha offcanvas |

### Universais (independentes de tema)

| Tipo | Payload | Descrição |
|---|---|---|
| `redirect` | `{ url, target? }` | Navega para URL |
| `reload` | `{ delay? }` | Recarrega a página |
| `zld-load` | `{ url, ... }` | Dispara novo loadData |
| `eval` | `{ code }` | Executa JS (use com cautela) |
| `set-value` | `{ plugin, key, value }` | Seta valor em componente OZI |
| `set-options` | `{ plugin, key, options }` | Atualiza opções em componente OZI |

---

## Exemplos de payload

### toast

```json
{ "type": "toast", "payload": { "message": "Registro salvo!", "level": "success", "delay": 4000 } }
```

Níveis: `success`, `error`, `warning`, `info`

### modal-open / close

```json
{ "type": "modal-open",  "payload": { "id": "modal-confirmacao" } }
{ "type": "modal-close", "payload": { "id": "modal-confirmacao" } }
{ "type": "modal-close" }
```

### redirect

```json
{ "type": "redirect", "payload": { "url": "/dashboard" } }
{ "type": "redirect", "payload": { "url": "https://exemplo.com", "target": "_blank" } }
```

### set-value (Livewire / componente OZI)

```json
{ "type": "set-value", "payload": { "plugin": "select", "key": "estado", "value": "SP" } }
```

---

## API pública

### `OZI.modules.actions.run(actions, ctx?)`

Executa lista de ações.

```js
OZI.modules.actions.run([
    { type: 'toast',    payload: { message: 'Salvo!', level: 'success' } },
    { type: 'redirect', payload: { url: '/lista' } }
]);
```

---

### `OZI.modules.actions.registerHandler(type, fn)`

Registra handler customizado. **Tem prioridade sobre adapters de tema.**

```js
OZI.modules.actions.registerHandler('minha-action', function (action, ctx) {
    var payload = action.payload;
    console.log('executando minha-action:', payload);
});
```

Backend retorna:
```json
{ "type": "minha-action", "payload": { "dados": "..." } }
```

---

### `OZI.modules.actions.registerThemeAdapter(theme, handlers)`

Registra ou sobrescreve handlers de um tema inteiro.

```js
// projeto com biblioteca de toast própria:
OZI.modules.actions.registerThemeAdapter('bootstrap5', {
    toast: function (action) {
        var p = action.payload;
        MyNotification.show(p.message, p.level);
    }
});

// tema customizado:
oziConf({ theme: 'meu-tema' });

OZI.modules.actions.registerThemeAdapter('meu-tema', {
    toast:         function (action) { ... },
    'modal-open':  function (action) { ... },
    'modal-close': function (action) { ... }
});
```

---

### `OZI.modules.actions.getHandlers()`

Lista handlers registrados. Útil para debug.

```js
OZI.modules.actions.getHandlers();
// {
//   custom:    ['minha-action'],
//   themes:    ['bootstrap5', 'tailwind', 'default'],
//   universal: ['redirect', 'reload', 'eval', 'zld-load', 'set-value', 'set-options']
// }
```

---

## Prioridade de execução

```
1. Handler customizado (registerHandler)     — mais específico
2. Adapter de tema ativo (OZI.conf.theme)
3. Handler universal (redirect, reload, etc.)
4. warn: tipo não reconhecido
```

---

## Integração com Laravel

```php
// Controller / Livewire Component
return response()->json([
    'actions' => [
        [
            'type'    => 'toast',
            'payload' => ['message' => 'Salvo com sucesso!', 'level' => 'success']
        ],
        [
            'type'    => 'modal-close',
            'payload' => ['id' => 'modal-form']
        ],
        [
            'type'    => 'set-value',
            'payload' => ['plugin' => 'select', 'key' => 'categoria', 'value' => 3]
        ]
    ]
]);
```

---

## Adapters de toast disponíveis (bootstrap5)

O adapter `bootstrap5` tenta na ordem:

1. `window.UIToast` — Up-Bond theme (projeto atual)
2. `window.toastr` — biblioteca popular
3. Bootstrap 5 Toast nativo
4. `console.info` — fallback silencioso

---

## Compat retroativa

```js
// v0.x — continua funcionando com warn
zldActions([{ type: 'toast', payload: { message: 'Ok' } }]);
```

---

## Comparação v0.x → v1.0.0

| v0.x | v1.0.0 |
|---|---|
| `window.UIToast` hardcoded | Adapter bootstrap5 com fallbacks |
| `window.bootstrap.Modal` direto | Adapter por tema |
| Sem extensão de tipos | `registerHandler()` para tipos customizados |
| Sem troca de tema | `registerThemeAdapter()` |
| `zld-load` referenciava `oziLoaddata` (d minúsculo) | Usa `OZI.modules.loadData` corretamente |

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-loaddata.js` | Chama `OZI.modules.actions.run(result.data.actions)` |
| `ozi-conf.js` | Fonte de `theme` para selecionar adapter |
| `ozi-integrations.js` | `set-value` e `set-options` disparam eventos DOM |
