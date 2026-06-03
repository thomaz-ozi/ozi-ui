# ozi-validate.js

**Versão:** 1.0.0  
**Camada:** `modules/`  
**Dependências:** `ozi-core.js` (OZI.conf, OZI.helpers, OZI.lang)  
**Expõe:** `OZI.modules.validate`, `window.oziValidateContainer` (compat)

---

## Descrição

Motor genérico de validação de campos do OZI-UI.  
Extraído do `oziValidateContainer` do `oziLoadData v3.9.4` com adapter pattern para substituir os acoplamentos a Select2 e CKEditor.

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
// por group-id (integração com loadData)
var result = OZI.modules.validate.container({
    groupId:      'form-contato',
    focusOnError: true
});

// por seletor CSS
var result = OZI.modules.validate.container({
    container:    '#meu-form',
    focusOnError: true
});

// por jQuery
var result = OZI.modules.validate.container({
    $container:   $('#meu-form'),
    silent:       false   // false = aplica classes visual (padrão)
});

if (result.isValid) {
    // prosseguir com envio
}
```

**Config:**

| Opção | Tipo | Descrição |
|---|---|---|
| `groupId` | string | Group-id do loadData |
| `$container` | jQuery | Escopo jQuery |
| `container` | string | Seletor CSS do escopo |
| `focusOnError` | boolean | Foca no primeiro campo inválido |
| `silent` | boolean | `true` = não aplica classes visual |

**Retorno:**

```js
{
    formData:      FormData,   // dados coletados
    data:          object,     // { campo: valor }
    isValid:       boolean,
    invalidFields: [           // campos inválidos
        { $el, name, adapter }
    ],
    // compat v0.x:
    ldValidate:      boolean,
    zldValidateName: string[]
}
```

---

### `OZI.modules.validate.runAdapters(scope?)`

Valida só componentes OZI num escopo.

```js
var result = OZI.modules.validate.runAdapters('#meu-form');
// { allValid: boolean, results: [{ adapter, $el, valid }] }
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
