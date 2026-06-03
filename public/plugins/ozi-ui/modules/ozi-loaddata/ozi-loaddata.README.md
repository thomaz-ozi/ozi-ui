# ozi-loaddata.js

**Versão:** 1.0.0  
**Camada:** `modules/ozi-loaddata/`  
**Dependências:** `ozi-core.js`, `ozi-helpers.js`, `ozi-validate.js` (opcional), `ozi-actions.js` (opcional)  
**Expõe:** `OZI.modules.loadData`, `window.oziLoadData`

---

## Descrição

Transport central do OZI-UI. Toda comunicação front → back passa por aqui.

Na v1.0.0 o `ozi-loaddata.js` foi reduzido ao seu propósito real — **transport + UI feedback**. As responsabilidades extras que existiam no monolito v3.9.4 foram extraídas:

| v3.9.4 (dentro do loadData) | v1.0.0 (arquivo próprio) |
|---|---|
| `oziConf` / `zldConf` | `ozi-conf.js` |
| `oziValidateContainer` | `ozi-validate.js` |
| `zldActions` | `ozi-actions.js` |
| `zldParseBool`, `zldClassNames`... | `ozi-helpers.js` |
| sistema de hooks | `ozi-hooks.js` |

---

## Modos de envio

| Modo | Comportamento |
|---|---|
| `fetch` (padrão) | Requisição HTTP via Fetch API |
| `window` | Abre URL em nova aba/janela |
| `page` | Navega para URL (redirect) |

---

## Atributos HTML

### [1] Envio
| Atributo | Descrição |
|---|---|
| `data-zld-url` | URL de destino — dispara o loadData ao clicar |
| `data-zld-mode` | `fetch` (padrão) \| `window` \| `page` |
| `data-zld-mode-method` | `POST` (padrão) \| `GET` \| `PUT` \| `DELETE` |
| `data-zld-mode-page-target` | Target da janela/aba (`_blank`, `_self`) |

### [2] Coleta
| Atributo | Descrição |
|---|---|
| `data-zld-catch-group-id` | ID do grupo de campos a coletar |
| `data-zld-catch-item-name` | Nome do campo no FormData |
| `data-zld-file` | Campo é upload de arquivo |
| `data-zld-json` | Valor serializado como JSON |
| `data-zld-checkbox` | Campo é checkbox (`1` ou `0`) |

### [3] Resposta
| Atributo | Descrição |
|---|---|
| `data-zld-destiny-id` | ID do elemento que recebe o HTML retornado |
| `data-zld-destiny-append` | Adiciona ao final em vez de substituir |
| `data-zld-destiny-Before` | Adiciona no início |
| `data-zld-expect-json` | Força `Accept: application/json` |
| `data-zld-api` | Idem (alias semântico) |

### [4] Comportamento
| Atributo | Descrição |
|---|---|
| `data-zld-form-busy` | Elemento desabilitado durante o envio |
| `data-zld-form-clear` | Limpa o form após sucesso |
| `data-zld-log` | Ativa log detalhado para este trigger |

---

## Retorno

```js
{
    perm:   boolean,  // false se 401/403
    isJson: boolean,  // true se resposta JSON
    ok:     boolean,  // true se status 2xx
    status: number,   // HTTP status code
    data:   object,   // parsed JSON (se isJson)
    html:   string,   // HTML retornado (se não JSON)
    error:  string    // mensagem de erro (se falhou)
}
```

---

## API pública

### `OZI.modules.loadData(payload, attribute?, clickedEl?)`

```js
// declarativo — trigger do DOM
OZI.modules.loadData($('[data-zld-url="/api/salvar"]'));

// imperativo — objeto de configuração
OZI.modules.loadData({
    url:    '/api/dados',
    method: 'GET',
    json:   true
}).then(function (result) {
    if (result.ok) {
        console.log(result.data);
    }
});

// com FormData customizado
var fd = new FormData();
fd.append('nome', 'João');
OZI.modules.loadData({ url: '/api/salvar', data: fd });
```

---

## Fluxo de execução

```
click em [data-zld-url]
    ↓
progressStart() + setBusy()
    ↓
validate() via OZI.modules.validate
    ↓ isValid = false → progressEnd(false) + return
    ↓ isValid = true
collectData() — lê inputs do grupo
    ↓
transport() — fetch / window / page
    ↓
progressEnd(ok) + setBusy(false)
    ↓
finish():
    ├─ renderToDestiny() — insere HTML
    ├─ beforeRender / afterRender via OZI.hooks
    ├─ actions.run() via OZI.modules.actions
    └─ form.reset() se data-zld-form-clear
```

---

## UI Feedback

### Progress bar global

Inserida automaticamente no `<body>`. Controlada por classes CSS:

| Classe | Estado |
|---|---|
| `ozi-progress-loading` | Enviando |
| `ozi-progress-success` | Sucesso |
| `ozi-progress-error` | Erro |

Classe extra configurável via:
```js
oziConf({ plugins: { loadData: { progressBarGlobalClass: 'progress-bar-striped' } } });
```

### Busy state

Elementos com `data-zld-form-busy` são desabilitados durante o envio.  
Classe aplicada via `OZI.conf.classMap.disabled`.

---

## CSRF

Token lido automaticamente de `<meta name="csrf-token">` e adicionado no header `X-CSRF-TOKEN`.

---

## Exemplos HTML

### Formulário básico

```html
<div data-zld-catch-group-id="form-contato">
    <input data-zld-catch-item-name="nome" type="text">
    <input data-zld-catch-item-name="email" type="email">
    <textarea data-zld-catch-item-name="mensagem"></textarea>

    <button
        data-zld-url="/contato/enviar"
        data-zld-destiny-id="resultado"
        data-zld-form-busy
        data-zld-form-clear="true">
        Enviar
    </button>
</div>

<div id="resultado"></div>
```

### Upload de arquivo

```html
<div data-zld-catch-group-id="form-upload">
    <input data-zld-catch-item-name="arquivo" data-zld-file="true" type="file">

    <button data-zld-url="/upload" data-zld-form-busy>
        Enviar arquivo
    </button>
</div>
```

### Retorno JSON com ações

```php
// Laravel — retorno PHP
return response()->json([
    'actions' => [
        ['type' => 'toast',    'payload' => ['message' => 'Salvo!', 'type' => 'success']],
        ['type' => 'redirect', 'payload' => '/lista']
    ]
]);
```

---

## Compat retroativa

| Alias | Aponta para | Warn |
|---|---|---|
| `window.oziLoaddata` | `window.oziLoadData` | ✅ |
| `window.zldRenderDependencies` | `OZI.hooks.afterRender.run()` | ✅ |

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-validate.js` | Validação pré-envio via `OZI.modules.validate` |
| `ozi-actions.js` | Executa `result.data.actions` pós-resposta |
| `ozi-hooks.js` | `beforeRender` / `afterRender` pós-render de HTML |
| `ozi-helpers.js` | `parseBool`, `classNames` usados internamente |
| `ozi-conf.js` | `plugins.loadData.*` e `classMap.*` |
