# ozi-loader.js

**Versão:** 1.0.0  
**Camada:** `core/`  
**Dependências:** `ozi-conf.js` (urlBase, log, failFast)  
**Consumido por:** `ozi-core.js`  
**Usado por:** qualquer plugin que precise carregar assets sob demanda

---

## Descrição

Gerenciador de carregamento de scripts e estilos do OZI-UI.  
Garante ordem de execução, evita duplicação e resolve caminhos via `urlBase`.

---

## Responsabilidades

- Carregar scripts `.js` em sequência via Promise chain
- Carregar estilos `.css` sem bloquear execução
- Cache por URL — nunca carrega o mesmo recurso duas vezes
- Retry configurável para scripts críticos
- Resolver caminhos relativos via `OZI.conf.core.urlBase`

---

## O que NÃO faz

- Não inicializa plugins após carregar
- Não gerencia dependências entre plugins
- Não usa `import/export` (ES6 modules)
- CSS falho não quebra o boot (`failFast` não se aplica a estilos)

---

## API pública

### `OZI.loader.load(entries, options?)`

Carrega lista de recursos. Por padrão em **sequência**.

```js
OZI.loader.load([
    'modules/ozi-loaddata/js/ozi-loaddata.js',
    'components/ozi-select/js/ozi-select.js',
    'components/ozi-select/css/ozi-select.css',

    // com opções por entrada
    { src: 'components/ozi-editor/js/ozi-editor.js', retries: 2 },

    // carregamento condicional
    { src: 'components/ozi-audio/js/ozi-audio.js', skip: !window.hasAudio }
]);
```

**Opções globais:**

| Opção | Tipo | Default | Descrição |
|---|---|---|---|
| `retries` | number | `0` | Tentativas após falha |
| `retryDelay` | number | `1000` | Delay entre retries em ms |
| `failFast` | boolean | `OZI.conf.core.failFast` | Para na primeira falha |
| `parallel` | boolean | `false` | Carrega tudo ao mesmo tempo |

**Opções por entrada (objeto):**

| Opção | Tipo | Descrição |
|---|---|---|
| `src` | string | Caminho do recurso |
| `retries` | number | Sobrescreve opção global |
| `retryDelay` | number | Sobrescreve opção global |
| `skip` | boolean | Pula este recurso se `true` |

---

### `OZI.loader.loadOne(entry, options?)`

Carrega um único recurso.

```js
OZI.loader.loadOne('components/ozi-audio/js/ozi-audio.js', { retries: 1 });
```

---

### `OZI.loader.resolve(path)`

Resolve caminho relativo para URL absoluta.

```js
OZI.loader.resolve('core/svg/icon-close.svg');
// → '/plugins/ozi-ui/core/svg/icon-close.svg'

OZI.loader.resolve('https://cdn.example.com/lib.js');
// → 'https://cdn.example.com/lib.js'  (passa direto)
```

---

### `OZI.loader.isLoaded(url)`

Verifica se recurso já foi carregado com sucesso.

```js
if (!OZI.loader.isLoaded('components/ozi-select/js/ozi-select.js')) {
    OZI.loader.loadOne('components/ozi-select/js/ozi-select.js');
}
```

---

### `OZI.loader.getCache()`

Retorna estado atual do cache. Útil para debug.

```js
OZI.loader.getCache();
// {
//   '/plugins/ozi-ui/components/ozi-select/js/ozi-select.js': { state: 'loaded', promise: Promise },
//   '/plugins/ozi-ui/components/ozi-editor/js/ozi-editor.js': { state: 'loading', promise: Promise },
// }
```

**Estados possíveis:**

| Estado | Descrição |
|---|---|
| `'loading'` | Requisição em andamento |
| `'loaded'` | Carregado com sucesso |
| `'error'` | Falhou (sem retry restante) |

---

### `OZI.loader.clearCache(url?)`

Limpa cache de um recurso ou de tudo. Útil em desenvolvimento.

```js
OZI.loader.clearCache('components/ozi-select/js/ozi-select.js'); // específico
OZI.loader.clearCache(); // limpa tudo
```

---

## Resolução de caminhos

| Entrada | Resultado |
|---|---|
| `'components/ozi-select/js/ozi-select.js'` | `urlBase + entrada` |
| `'/plugins/ozi-ui/ozi-select.js'` | Passa direto (começa com `/`) |
| `'https://cdn.example.com/lib.js'` | Passa direto (absoluto) |

`urlBase` vem de `OZI.conf.core.urlBase` — default `'/plugins/ozi-ui/'`.

---

## Carregamento sequencial vs paralelo

### Sequencial (padrão) — use para scripts com dependências

```js
OZI.loader.load([
    'core/ozi-helpers.js',          // 1° — base
    'modules/ozi-validate.js',       // 2° — usa helpers
    'components/ozi-select/js/ozi-select.js'  // 3° — usa validate
]);
```

### Paralelo — use para recursos independentes entre si

```js
// CSS não tem dependência de ordem — carrega tudo junto
OZI.loader.load([
    'components/ozi-select/css/ozi-select.css',
    'components/ozi-editor/css/ozi-editor.css',
    'components/ozi-audio/css/ozi-audio.css'
], { parallel: true });
```

---

## Comportamento com erros

### `failFast: false` (default)

```
script A → ok
script B → erro → loga warn → continua
script C → ok
```

### `failFast: true` (recomendado em dev)

```
script A → ok
script B → erro → lança exceção → para tudo
```

### CSS — nunca bloqueia

CSS com erro é logado como `warn` mas não rejeita a Promise.  
O boot continua normalmente — layout pode ficar sem estilo, mas funcionalidade preservada.

---

## Retry

Útil para recursos críticos em conexões instáveis.

```js
OZI.loader.load([
    {
        src:        'modules/ozi-loaddata/js/ozi-loaddata.js',
        retries:    2,       // tenta mais 2 vezes após falha
        retryDelay: 500      // aguarda 500ms entre tentativas
    }
]);
```

---

## Uso típico no boot do projeto

```html
<!-- HTML: só o core e conf precisam estar no <head> -->
<script src="/plugins/ozi-ui/core/ozi-conf.js"></script>
<script src="/plugins/ozi-ui/core/ozi-hooks.js"></script>
<script src="/plugins/ozi-ui/core/ozi-en.js"></script>
<script src="/plugins/ozi-ui/core/ozi-loader.js"></script>
<script src="/plugins/ozi-ui/core/ozi-integrations.js"></script>
<script src="/plugins/ozi-ui/core/helpers/ozi-helpers.js"></script>
<script src="/plugins/ozi-ui/core/ozi-core.js"></script>

<script>
oziConf({
    theme: 'bootstrap5',
    lang:  'pt-BR',
    core:  { urlBase: '/plugins/ozi-ui/' }
});

// carrega plugins usados nesta página
OZI.ready(function () {
    OZI.loader.load([
        'components/ozi-select/css/ozi-select.css',
        'components/ozi-select/js/ozi-select.js',
        'components/ozi-editor/css/ozi-editor.css',
        'components/ozi-editor/js/ozi-editor.js'
    ]);
});
</script>
```

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-core.js` | Consome `window.OziLoader` — chama `load()` se `core.scripts` declarado |
| `ozi-conf.js` | Fonte de `urlBase`, `log` e `failFast` |
| `ozi-helpers.js` | Carregado via loader antes dos components |
| Todos os plugins | Podem ser carregados sob demanda via `OZI.loader.load()` |