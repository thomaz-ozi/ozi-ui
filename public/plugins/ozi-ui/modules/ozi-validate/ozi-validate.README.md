# ozi-validate.js

**Versão:** 2.2.0 (v2 F2 #1 — primeiro componente migrado, 2026-07-03; gate de envio em 2026-08-24)
**Camada:** `modules/`  
**Dependências:** `ozi-core.js` (OZI.conf, OZI.helpers, OZI.lang) — zero jQuery
**Expõe:** `OZI.modules.validate`, `window.oziValidateContainer` (compat)

---

## Descrição

Motor genérico de validação de campos do OZI-UI.  
Extraído do `oziValidateContainer` do `oziLoadData v3.9.4` com adapter pattern para substituir os acoplamentos a Select2 e CKEditor.

**Nota v2:** o motor interno é 100% JS puro (contrato `dev-hard/docs/ozi-ui-v2-contratos.md`). `container()`/`field()`/`applyState()` continuam aceitando Element nativo, jQuery ou seletor CSS (normalizado via `OZI.helpers.toElement`/`toElements`). Adapters registrados por componentes ainda não migrados (`ozi-select`, `ozi-autocomplete`, `ozi-editor`, `ozi-audio`) continuam recebendo o elemento envelopado em jQuery — ponte de transição temporária, removida à medida que cada um migrar na F2.

---

## O que resolve (dívidas v0.x)

| Dívida | Como resolve |
|---|---|
| Acoplado a Select2 e CKEditor | Adapter pattern — componentes se registram |
| Classes `is-invalid` hardcoded | `OZI.conf.classMap.invalid` |
| Delegação global sem opt-out | Opt-in via `data-ozi-validate` no container |
| Bloco duplicado de validação | Unificado em `_container()` |

---

## Adapter Pattern

Cada componente OZI registra como ler e setar seu estado de validação.

### `OZI.modules.validate.registerAdapter(adapter)`

```js
// dentro de ozi-select.js — ao final do arquivo:
OZI.modules.validate.registerAdapter({
    name: 'ozi-select',

    // true se este adapter cuida deste elemento
    match: function ($el) {
        return $el.is('[data-ozi-select]');
    },

    // elemento tem valor válido?
    isValid: function ($el) {
        var required = $el.attr('required') === 'true'
                    || $el.attr('data-ozi-select-required') === 'true';
        if (!required) return true;
        var instance = OZI.components.select.get($el[0]);
        return instance ? instance.isValid() : true;
    },

    // retorna valor atual
    getValue: function ($el) {
        var instance = OZI.components.select.get($el[0]);
        return instance ? instance.getValue() : null;
    },

    // aplica estado visual: 'valid' | 'invalid' | 'reset'
    setState: function ($el, state) {
        var instance = OZI.components.select.get($el[0]);
        if (instance) instance.setState(state);
    }
});
```

**Contrato do adapter:**

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Identificador único — ex: `'ozi-select'` |
| `match` | `fn($el) → bool` | true se este adapter cuida deste elemento |
| `isValid` | `fn($el) → bool` | elemento tem valor válido? |
| `getValue` | `fn($el) → any` | valor atual do elemento |
| `setState` | `fn($el, state)` | aplica estado visual |

**Prioridade:** adapters OZI são testados primeiro (mais específicos). O adapter nativo HTML é fallback.

---

## API pública

### `OZI.modules.validate.container(config)`

Valida todos os campos de um container. Função principal.

```js
// por id (v2.2.0 — antes documentado mas ignorado; ver Changelog)
var result = OZI.modules.validate.container({
    groupId:      'form-contato',
    focusOnError: true
});

// por seletor CSS (v2.2.0 — idem)
var result = OZI.modules.validate.container({
    container:    '#meu-form',
    focusOnError: true
});

// por Element nativo, jQuery ou seletor (toElement normaliza)
var result = OZI.modules.validate.container({
    $container:   document.getElementById('meu-form'),
    silent:       false   // false = aplica classes visual (padrão)
});

// vários elementos soltos (não precisam de container comum)
var result = OZI.modules.validate.container({
    $elements: document.querySelectorAll('.campo-solto')
});

if (result.isValid) {
    // prosseguir com envio
}
```

**Config:**

| Opção | Tipo | Descrição |
|---|---|---|
| `groupId` | string | Id do elemento a validar (`document.getElementById`) |
| `container` | string | Seletor CSS do escopo (`querySelector`) |
| `$container` | Element \| jQuery \| string | Escopo — aceita os três formatos via `toElement` |
| `$elements` | NodeList \| array \| jQuery | Lista explícita de campos (ignora escopo) |
| `focusOnError` | boolean | Foca no primeiro campo inválido |
| `silent` | boolean | `true` = não aplica classes visual |

Prioridade quando mais de uma opção de escopo é passada: `$elements` > `$container` > `container` >
`groupId` > `document` (nenhuma passada — valida a página inteira).

**Retorno:**

```js
{
    formData:      FormData,   // dados coletados
    data:          object,     // { campo: valor }
    isValid:       boolean,
    invalidFields: [           // campos inválidos
        { el, name, adapter }  // el = Element nativo (v2; era $el/jQuery na v1)
    ],
    // compat v0.x:
    ldValidate:      number,   // contagem de invalidFields (nome sugere boolean, mas é number desde a v1.0.0)
    zldValidateName: string[]
}
```

---

### `OZI.modules.validate.field(elArg)`

Valida um único campo (Element nativo, jQuery ou seletor). Aplica o estado visual quando o
campo é obrigatório (mesma lógica de `container()`, num só elemento).

```js
var r = OZI.modules.validate.field('#email');
// { valid: boolean, value: any }
```

---

### `OZI.modules.validate.applyState($el, state)`

Aplica estado visual manualmente.

```js
OZI.modules.validate.applyState($('#meu-campo'), 'invalid');
OZI.modules.validate.applyState($('#meu-campo'), 'valid');
OZI.modules.validate.applyState($('#meu-campo'), 'reset');
```

Classes aplicadas via `OZI.conf.classMap`:

| State | Classe (Bootstrap 5) | Classe (default) |
|---|---|---|
| `invalid` | `is-invalid` | `ozi-invalid` |
| `valid` | `is-valid` | `ozi-valid` |
| `reset` | — | — |

---

### `OZI.modules.validate.initInteractive()`

Ativa validação em tempo real nos campos. Chamado automaticamente se:

```js
oziConf({ plugins: { loadData: { interactiveValidation: true } } });
```

Opt-in por container — só campos dentro de `[data-ozi-validate]`:

```html
<!-- validação interativa ativada neste form -->
<form data-ozi-validate>
    <input name="nome" required>
    <input name="email" type="email" required>
</form>

<!-- sem validação interativa -->
<form>
    <input name="outro">
</form>
```

---

### Gate de envio (v2.2.0)

`data-ozi-validate` reaproveitado em `<button type="submit">`/`<input type="submit">` — sempre
ativo (não depende de `initInteractive()`/`interactiveValidation`). No submit do form (clique
ou Enter — ambos passam pelo evento `submit`, capturado em fase de captura no `document`),
revalida tudo e **bloqueia** se inválido (`preventDefault` + foca o 1º campo inválido).

```html
<form>
    <input name="nome" data-ozi-required="true">
    <button type="submit" data-ozi-validate>Enviar</button>
</form>
```

**Alvo fora do `<form>`** — `data-ozi-validate-group` (CSV de ids); sem ele, cai no `<form>`
mais próximo do botão; sem nenhum dos dois, ignora e loga um aviso (nunca bloqueia a página
inteira por engano):

```html
<button type="submit" data-ozi-validate data-ozi-validate-group="dados,endereco">Enviar</button>
<div id="dados">...</div>
<div id="endereco">...</div>
```

**Eventos** (`OZI.helpers.emit`, `detail: { component:'ozi-validate', name, invalidFields,
isValid, source:'user' }`, `name` = o `data-ozi-validate-group` ou `null`):

| Evento | Quando |
|---|---|
| `ozi:validate-broken` | Submit bloqueado (algum campo inválido) |
| `ozi:validate-ready`  | Submit passou (tudo válido) — segue normalmente |

**Funciona com Livewire sem nenhum código específico dele** — confirmado lendo o bundle real
(`vendor/livewire/livewire/dist/livewire.js`): `wire:submit` é um listener de `submit` em fase
de **bolha**, direto no `<form>` (via `x-on:submit.prevent` do Alpine). Um listener em
**captura** no `document` roda sempre antes de qualquer listener de bolha no `<form>` — ordem
de fase, não de registro — então `stopImmediatePropagation()` barra o Livewire quando inválido,
sem precisar de nenhum adapter/plugin de integração dedicado.

---

### `OZI.modules.validate.getAdapters()`

Lista adapters registrados. Útil para debug.

```js
OZI.modules.validate.getAdapters();
// ['ozi-select', 'ozi-autocomplete', 'ozi-editor', 'native']
```

---

## Campos suportados pelo adapter nativo

| Tipo | Validação |
|---|---|
| `text`, `textarea` | `required`, `minlength`, `maxlength` |
| `email` | `required` + regex de email |
| `number` | `required`, `min`, `max` |
| `checkbox` | `required` → `checked` |
| `radio` | `required` → algum do grupo marcado |
| `file` | `required` → arquivo selecionado |
| `select` | `required` → valor não vazio |
| `[data-ozi-required]` | qualquer elemento com atributo OZI |

---

## Mensagem de feedback

A mensagem de erro usa o elemento `.ozi-feedback` (ou `invalid-feedback` no Bootstrap 5) irmão do campo:

```html
<input name="nome" required data-ozi-required-message="Nome é obrigatório">
<span class="invalid-feedback"></span>
```

Fallback se não houver atributo: `OZI.lang.t('common.required')`.

---

## Compat retroativa

```js
// v0.x — continua funcionando com warn
oziValidateContainer('#meu-form');
oziValidateContainer({ container: '#meu-form', focusOnError: true });
```

---

## Como componentes se integram

Cada componente OZI registra seu adapter ao carregar:

```
ozi-select.js     → registerAdapter('ozi-select')
ozi-autocomplete  → registerAdapter('ozi-autocomplete')
ozi-editor.js     → registerAdapter('ozi-editor')
ozi-audio.js      → registerAdapter('ozi-audio')  ← opcional
```

O `oziValidateContainer` do loadData v3.9.4 tratava Select2 e CKEditor diretamente.  
Na v1.0.0 isso virou contrato — cada componente declara como validar a si mesmo.

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-loaddata.js` | Chama `OZI.modules.validate.container()` antes de enviar |
| `ozi-conf.js` | Fonte de `classMap.invalid/valid`, `plugins.loadData.interactiveValidation` |
| `ozi-en.js` | `common.required` para mensagem de fallback |
| Cada componente OZI | Registra adapter via `registerAdapter()` ao carregar |
