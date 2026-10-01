# ozi-conf.js

**Versão:** 1.0.0  
**Camada:** `core/`  
**Dependências:** nenhuma  
**Consumido por:** `ozi-core.js`

---

## Descrição

Sistema de configuração global do OZI-UI.  
Ponto único de entrada para todas as preferências do projeto: tema, idioma, integrações e comportamento de cada plugin.

Internamente expõe `window.OziConf` como contrato entre arquivos do core.  
Externamente o dev usa apenas `oziConf({...})` — definido em `ozi-core.js`.

---

## Responsabilidades

- Definir os **defaults globais** de todos os plugins
- Aplicar **presets de tema** (`bootstrap5`, `tailwind`, `default`, `custom`)
- Realizar **merge profundo** entre defaults → preset → config do dev
- Expor leitura segura via `OziConf.get(path)`

---

## O que NÃO faz

- Não inicializa plugins
- Não acessa DOM
- Não depende de nenhum outro arquivo OZI

---

## Uso pelo dev

```js
oziConf({
    // — global —
    theme:        'bootstrap5',  // 'default' | 'bootstrap5' | 'tailwind' | 'custom'
    themeMode:    'light',       // 'light' | 'dark' | 'auto'
    lang:         'pt-BR',
    fallbackLang: 'en',
    integrations: ['livewire'], // auto-detect v3/v4

    // — core —
    core: {
        urlBase:  '/plugins/ozi-ui/',
        log:      false,
        failFast: false
    },

    // — plugins —
    plugins: {
        loadData: { progressBarGlobalClass: 'progress-bar-striped' },
        select:   { imageDimension: '32px' },
        editor:   { uicolor: 'var(--bs-primary)' },
        auth:     { passMin: 12, passMax: 64 }
    },

    // — classMap — override pontual (opcional)
    // preset do theme já preenche automaticamente
    classMap: {
        invalid: 'is-invalid'
    }
});
```

---

## Opções globais

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `theme` | string | `'default'` | Preset de tema UI |
| `themeMode` | string | `'auto'` | Modo de cor |
| `lang` | string | `'pt-BR'` | Idioma ativo |
| `fallbackLang` | string | `'en'` | Idioma de fallback |
| `integrations` | array | `[]` | Adapters a inicializar |

### Valores de `theme`

| Valor | Comportamento |
|---|---|
| `'default'` | Classes `ozi-*` neutras — sem dependência de framework |
| `'bootstrap5'` | `is-invalid`, `was-validated`, `d-none`, etc. |
| `'tailwind'` | Classes utilitárias do Tailwind |
| `'custom'` | Sem preset — dev declara `classMap` completo |

---

## Opções de `core`

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `urlBase` | string | `'/plugins/ozi-ui/'` | Caminho base dos assets |
| `log` | boolean | `false` | Ativa logs internos no console |
| `failFast` | boolean | `false` | Para na primeira falha (útil em dev) |

---

## Opções de `plugins`

### `plugins.loadData`

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `interactiveValidation` | boolean | `true` | Valida em tempo real |
| `interactiveScope` | string | `'ozi'` | Escopo dos adapters de validação |
| `progressBarGlobalClass` | string | `''` | Classe extra na progress bar |
| `fileMaxSize` | number | `10` | Tamanho máximo de arquivo em MB |
| `log` | boolean | `false` | Log específico do loadData |

### `plugins.select`

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `imageDimension` | string | `'24px'` | Tamanho das imagens nas opções |
| `autoObserve` | boolean | `false` | MutationObserver automático |

### `plugins.autocomplete`

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `autoObserve` | boolean | `false` | MutationObserver automático |

### `plugins.editor`

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `uicolor` | string | `'var(--ozi-color-primary)'` | Cor de destaque da toolbar |
| `autoObserve` | boolean | `false` | MutationObserver automático |

### `plugins.audio`

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `iconBase` | string | `'auto'` | Sistema de ícones: `'auto'` \| `'svg'` \| `'fa'` |
| `autoObserve` | boolean | `false` | MutationObserver automático |

### `plugins.auth`

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `passMin` | number | `12` | Mínimo de caracteres na senha |
| `passMax` | number | `64` | Máximo de caracteres na senha |
| `userCaracter` | number | `4` | Mínimo de caracteres no usuário |

---

## classMap — tokens semânticos

O `classMap` mapeia tokens internos do OZI para classes do framework escolhido.  
O preset do `theme` preenche automaticamente. Use `classMap` no `oziConf` apenas para **overrides pontuais**.

| Token | Bootstrap 5 | Tailwind | Default |
|---|---|---|---|
| `invalid` | `is-invalid` | `border-red-500 text-red-600` | `ozi-invalid` |
| `valid` | `is-valid` | `border-green-500 text-green-600` | `ozi-valid` |
| `formValidated` | `was-validated` | `ozi-validated` | `ozi-validated` |
| `feedback` | `invalid-feedback` | `text-red-500 text-sm mt-1` | `ozi-feedback` |
| `button` | `btn btn-primary` | `px-4 py-2 bg-blue-600...` | `ozi-btn` |
| `hidden` | `d-none` | `hidden` | `ozi-hidden` |
| `disabled` | `disabled` | `opacity-50 cursor-not-allowed` | `ozi-disabled` |
| `active` | `active` | `ring-2 ring-blue-500` | `ozi-active` |
| `badge` | `badge` | `inline-flex items-center...` | `ozi-badge` |

---

## API interna — `window.OziConf`

> **Uso exclusivo do `ozi-core.js`.** Não use diretamente no projeto.

| Método | Descrição |
|---|---|
| `OziConf.init()` | Inicializa e retorna conf com preset aplicado |
| `OziConf.apply(userConfig)` | Merge da config do dev + preset |
| `OziConf.get(path?)` | Leitura segura por caminho de chave |
| `OziConf.getPresets()` | Lista de presets disponíveis |

### Leitura segura

```js
// dentro de qualquer plugin:
var dimension = OZI.conf.plugins.select.imageDimension;  // '24px'
var invalid   = OZI.conf.classMap.invalid;                // 'is-invalid'
var urlBase   = OZI.conf.core.urlBase;                    // '/plugins/ozi-ui/'
```

---

## Ordem de precedência no merge

```
defaults globais (DEFAULTS)
    ↓ merge
preset do tema (PRESETS[theme])
    ↓ merge
config do dev (oziConf({...}))
    ↓ merge
override classMap do dev (classMap: {...})
```

Cada nível sobrescreve apenas o que declara. O restante herda do nível anterior.

---

## Exemplos

### Projeto Bootstrap 5 — configuração mínima

```js
oziConf({
    theme: 'bootstrap5',
    lang:  'pt-BR',
    core:  { urlBase: '/plugins/ozi-ui/' }
});
```

### Projeto Tailwind com override de classMap

```js
oziConf({
    theme: 'tailwind',
    lang:  'pt-BR',
    classMap: {
        invalid: 'border-red-500 ring-1 ring-red-400'  // personalizado
    }
});
```

### Projeto com tema custom completo

```js
oziConf({
    theme: 'custom',
    classMap: {
        invalid:       'field-error',
        valid:         'field-ok',
        formValidated: 'form-checked',
        feedback:      'field-message',
        button:        'my-btn',
        hidden:        'is-hidden',
        disabled:      'is-disabled',
        active:        'is-active',
        badge:         'pill'
    }
});
```

### Múltiplas integrações

```js
oziConf({
    theme:        'bootstrap5',
    integrations: ['livewire', 'alpine']
});
```

---

## Arquivo relacionados

| Arquivo | Relação |
|---|---|
| `ozi-core.js` | Consome `window.OziConf.init()` e `apply()` |
| `ozi-en.js` | Lê `OZI.conf.lang` e `fallbackLang` |
| `ozi-ozi-hooks.js` | Lê `OZI.conf.integrations` |
| `ozi-integrations.js` | Lê `OZI.conf.integrations` para boot dos adapters |
| Todos os plugins | Leem `OZI.conf.plugins.X` e `OZI.conf.classMap` |