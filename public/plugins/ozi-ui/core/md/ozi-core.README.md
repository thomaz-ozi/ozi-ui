# ozi-core.js

**Versão:** 1.0.0  
**Camada:** `core/`  
**Dependências:** todos os subsistemas abaixo devem carregar antes  
**Expõe:** `window.OZI`, `window.oziConf()`

---

## Descrição

Orquestrador puro do OZI-UI.  
Cria o namespace `window.OZI`, inicializa os subsistemas na ordem correta e expõe `oziConf()` como ponto único de configuração.

Não contém lógica própria — apenas cola as peças.

---

## Ordem de carregamento obrigatória

```html
<!-- 1. subsistemas — ordem importa -->
<script src="/plugins/ozi-ui/core/ozi-conf.js"></script>
<script src="/plugins/ozi-ui/core/ozi-hooks.js"></script>
<script src="/plugins/ozi-ui/core/ozi-en.js"></script>
<script src="/plugins/ozi-ui/core/ozi-loader.js"></script>
<script src="/plugins/ozi-ui/core/ozi-integrations.js"></script>
<script src="/plugins/ozi-ui/core/helpers/ozi-helpers.js"></script>

<!-- 2. core — sempre por último da camada core -->
<script src="/plugins/ozi-ui/core/ozi-core.js"></script>

<!-- 3. configuração — antes ou depois do core, mas antes dos plugins -->
<script>
oziConf({
    theme:        'bootstrap5',
    lang:         'pt-BR',
    integrations: ['livewire'],
    core: { urlBase: '/plugins/ozi-ui/' }
});
</script>

<!-- 4. plugins — se auto-registram via OZI.hooks.afterRender -->
<script src="/plugins/ozi-ui/modules/ozi-loaddata/js/ozi-loaddata.js"></script>
<script src="/plugins/ozi-ui/components/ozi-select/js/ozi-select.js"></script>
```

---

## Subsistemas

| Subsistema | Obrigatório | Contrato | O que fornece |
|---|---|---|---|
| `ozi-conf.js` | ✅ | `window.OziConf` | `OZI.conf` — configuração global |
| `ozi-hooks.js` | ✅ | `window.OziHooks` | `OZI.hooks` — afterRender/beforeRender |
| `ozi-en.js` | ⚠️ opcional | `window.OziLang` | `OZI.lang` — i18n |
| `ozi-loader.js` | ⚠️ opcional | `window.OziLoader` | `OZI.loader` — carregamento sob demanda |
| `ozi-integrations.js` | ⚠️ opcional | `window.OziIntegrations` | `OZI.integrations` — plugin↔framework |
| `ozi-helpers.js` | ⚠️ opcional | `window.OziHelpers` | `OZI.helpers` — utilitários |

---

## Namespace OZI

```js
window.OZI = {
    version:      '1.0.0',
    conf:         {},        // ← ozi-conf.js
    helpers:      {},        // ← ozi-helpers.js
    modules:      {},        // ← ozi-loaddata.js, ozi-validate.js...
    components:   {},        // ← ozi-select.js, ozi-editor.js...
    behaviors:    {},        // ← ozi-copy.js, ozi-toggle.js
    lang:         {},        // ← ozi-en.js
    hooks:        {},        // ← ozi-hooks.js
    integrations: {},        // ← ozi-integrations.js
    loader:       {},        // ← ozi-loader.js
    isReady:      false,
    ready:        function(callback) { ... }
}
```

---

## API pública

### `oziConf(userConfig)`

Ponto único de configuração. Pode ser chamado antes ou depois do boot.

```js
oziConf({
    theme:        'bootstrap5',
    themeMode:    'light',
    lang:         'pt-BR',
    fallbackLang: 'en',
    integrations: ['livewire'],

    core: {
        urlBase:  '/plugins/ozi-ui/',
        log:      false,
        failFast: false
    },

    plugins: {
        loadData: { progressBarGlobalClass: 'progress-bar-striped' },
        select:   { imageDimension: '32px' },
        editor:   { uicolor: 'var(--bs-primary)' },
        auth:     { passMin: 12, passMax: 64 }
    },

    classMap: {
        invalid: 'is-invalid'  // override pontual — preset preenche o resto
    }
});
```

---

### `OZI.ready(callback)`

Executa callback quando o boot estiver completo.  
Se já pronto, executa imediatamente. Suporta múltiplos callbacks.

```js
OZI.ready(function (OZI) {
    console.log('OZI pronto!', OZI.version);

    // carregar plugins sob demanda
    OZI.loader.load([
        'components/ozi-select/js/ozi-select.js',
        'components/ozi-editor/js/ozi-editor.js'
    ]);
});

// chainable
OZI.ready(fn1).ready(fn2).ready(fn3);
```

---

## Sequência de boot

```
DOMContentLoaded
    ↓
[4.1] OziConf.init()          → OZI.conf populado
    ↓
[4.2] OziHelpers              → OZI.helpers populado
    ↓
[4.3] OziLang.init()          → OZI.lang populado, idioma ativado
    ↓
[4.4] OziHooks._boot()        → afterRender/beforeRender conectados
    ↓                           (Livewire 3, Livewire 4, DOMContentLoaded)
[4.5] OziIntegrations._boot() → rescan registrado no afterRender
    ↓
[4.6] OziLoader               → OZI.loader disponível
    ↓
[4.7] isReady = true          → callbacks OZI.ready() disparados
    ↓
plugins (já carregados via <script>) auto-registram via OZI.hooks.afterRender
```

---

## failFast

Em desenvolvimento, ative `failFast` para parar na primeira falha:

```js
oziConf({
    core: {
        log:      true,   // logs detalhados
        failFast: true    // lança exceção em vez de engolir erros
    }
});
```

Em produção mantenha `failFast: false` (default) — o core continua mesmo com subsistemas opcionais faltando.

---

## Aliases retroativos v0.x

| Alias | Aponta para | Warn? |
|---|---|---|
| `window.oziCore` | `window.OZI` | ✅ |
| `window.zldConf` | `OZI.conf.plugins.loadData` | ✅ |
| `window.oziLoaddata` | `window.oziLoadData` | ✅ |
| `window.OziFrameworks` | `OZI.integrations` | ✅ |

Warn emitido quando `OZI.conf.core.log = true`.  
Aliases removidos na v2.0.0.

---

## Como plugins se registram (v1.0.0)

Na v0.x o `oziCore` tinha `hookCandidates` — lista hardcoded de plugins.  
Na v1.0.0 cada plugin se auto-registra ao carregar:

```js
// no final de ozi-select.js:
OZI.hooks.afterRender.register('component:select', function (root) {
    OZI.components.select.init(root);
});

// no final de ozi-editor.js:
OZI.hooks.afterRender.register('component:editor', function (root) {
    OZI.components.editor.init(root);
});
```

O core não precisa saber quais plugins existem.

---

## Comparação v0.x → v1.0.0

| v0.x (oziCore v1.3.0) | v1.0.0 |
|---|---|
| `hookCandidates` hardcoded | Plugins se auto-registram |
| Sem namespace `OZI` | `window.OZI` com slots para todos |
| `oziConf` só conhecia `zldConf` | `oziConf()` com theme, lang, plugins, classMap |
| Sem suporte a lang/tema | `OZI.lang` + `OZI.conf.classMap` via preset |
| Falha no meio da fila quebrava tudo | `failFast` configurável, subsistemas opcionais |
| `OziFrameworks` separado | `OZI.integrations` unificado |
| Rescan em eventos DOM próprios | Rescan via `OZI.hooks.afterRender` |

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-conf.js` | Fornece `window.OziConf` — obrigatório |
| `ozi-hooks.js` | Fornece `window.OziHooks` — obrigatório |
| `ozi-en.js` | Fornece `window.OziLang` — opcional |
| `ozi-loader.js` | Fornece `window.OziLoader` — opcional |
| `ozi-integrations.js` | Fornece `window.OziIntegrations` — opcional |
| `ozi-helpers.js` | Fornece `window.OziHelpers` — opcional |
