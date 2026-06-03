# ozi-helpers.js

**Versão:** 1.0.0  
**Camada:** `core/helpers/`  
**Dependências:** nenhuma (pode carregar antes do OZI.conf)  
**Consumido por:** `ozi-core.js` → `OZI.helpers`  
**Usado por:** todos os plugins

---

## Descrição

Coleção de funções puras e reutilizáveis do OZI-UI.  
Sem estado próprio, sem DOM persistente, sem dependência de outros modules.

Consolida helpers duplicados que existiam em `oziLoadData`, `oziAudio`, `oziEditor`, `oziSelect` e `oziAutocomplete` na v0.x — eliminando ~300 linhas duplicadas.

---

## Regras

- Nenhuma função pode chamar `OZI.modules.*` ou `OZI.components.*`
- Não dependem de `OZI.conf` — recebem tudo por parâmetro
- Cobertura por testes unitários obrigatória

---

## API pública — `OZI.helpers`

### [1] Parsers de atributo

#### `parseBool($el, attrName, fallback?)`

Lê atributo HTML e converte para boolean.

```js
OZI.helpers.parseBool($el, 'data-ozi-select-multiple')       // false
OZI.helpers.parseBool($el, 'data-ozi-select-required', true) // true (fallback)
```

Aceita: `'true'|'1'|'yes'|'on'` → `true` / `'false'|'0'|'no'|'off'|''` → `false`

---

#### `parseInt($el, attrName, fallback?)`

Lê atributo HTML e converte para inteiro.

```js
OZI.helpers.parseInt($el, 'data-ozi-select-zld-min', 3) // 3 (fallback)
```

---

#### `parseList(raw)`

Converte string separada por vírgula em array limpo.

```js
OZI.helpers.parseList('bold, italic, underline') // ['bold', 'italic', 'underline']
OZI.helpers.parseList(['a', 'b'])                // ['a', 'b'] — já é array
OZI.helpers.parseList('')                        // []
```

---

### [2] Identificadores

#### `generateId(prefix?)`

Gera ID único crescente.

```js
OZI.helpers.generateId('select') // 'select-1', 'select-2'...
OZI.helpers.generateId()         // 'ozi-1'
```

---

#### `normalizeDomId(value)`

Sanitiza string para uso como ID ou seletor CSS.

```js
OZI.helpers.normalizeDomId('Meu Campo!') // 'meu-campo'
OZI.helpers.normalizeDomId('user email') // 'user-email'
```

---

#### `safeById(id)`

Retorna elemento por ID de forma segura — `null` se não existir.

```js
OZI.helpers.safeById('meu-elemento')  // Element | null
OZI.helpers.safeById('#meu-elemento') // aceita com # também
```

---

### [3] String

#### `normalize(str)`

NFD decomposition + remove diacríticos + lowercase. Para busca sem acentos.

```js
OZI.helpers.normalize('São Paulo') // 'sao paulo'
OZI.helpers.normalize('Ação')      // 'acao'
```

---

#### `escapeRegExp(str)`

Escapa caracteres especiais para uso em `RegExp`.

```js
OZI.helpers.escapeRegExp('(test)') // '\(test\)'
new RegExp(OZI.helpers.escapeRegExp(query), 'gi')
```

---

#### `splitTopLevel(raw, separator, openChar?, closeChar?)`

Divide string por separador respeitando delimitadores aninhados.

```js
OZI.helpers.splitTopLevel('bold; [ul,ol]; italic', ';')
// ['bold', '[ul,ol]', 'italic']

OZI.helpers.splitTopLevel('a, (b,c), d', ',', '(', ')')
// ['a', '(b,c)', 'd']
```

Usado por `oziEditor` para parsear sintaxe de toolbar.

---

#### `classNames(...args)`

Junta classes condicionalmente. Aceita strings, arrays e objetos.

```js
OZI.helpers.classNames('btn', { 'btn-primary': true, 'disabled': false })
// 'btn btn-primary'

OZI.helpers.classNames(['a', 'b'], 'c')
// 'a b c'

// com classMap:
OZI.helpers.classNames(OZI.conf.classMap.invalid, 'my-extra-class')
// 'is-invalid my-extra-class'
```

---

### [4] Visual

#### `icon($el, name, options?)`

Insere ícone no elemento via SVG inline.  
Resolve path automaticamente via `OZI.conf.core.urlBase`.

```js
// ícone global (core/svg/icon-close.svg)
OZI.helpers.icon($btn, 'close');

// ícone de plugin (components/ozi-editor/svg/icon-bold.svg)
OZI.helpers.icon($btn, 'bold', { plugin: 'editor' });

// com tamanho e cor
OZI.helpers.icon($btn, 'play', {
    plugin:   'audio',
    size:     '20px',
    color:    'var(--ozi-color-primary)',
    fallback: '▶'
});
```

**Opções:**

| Opção | Tipo | Descrição |
|---|---|---|
| `plugin` | string | Plugin dono do ícone. `null` = `core/svg/` |
| `size` | string | `width` e `height` do SVG |
| `color` | string | `color` + `fill: currentColor` |
| `fallback` | string | Texto/emoji se SVG não carregar |

Retorna `Promise<void>`.

---

### [5] Async

#### `runBatch($items, callbackItem, callbackEnd?)`

Executa callback para cada item jQuery. Erros individuais não interrompem o lote.

```js
OZI.helpers.runBatch(
    $('[data-ozi-select]'),
    function ($el, index) {
        OZI.components.select.init($el);
    },
    function (total) {
        console.log(total + ' selects inicializados');
    }
);
```

---

### [6] Concorrência

#### `exclusiveActor(scope, instance?)`

Garante que apenas uma instância esteja ativa por escopo.

```js
// ao iniciar reprodução de áudio:
var previous = OZI.helpers.exclusiveActor('audio-player', this);
if (previous && previous !== this) {
    previous.pause(); // pausa o player anterior
}

// ler instância ativa:
var current = OZI.helpers.exclusiveActor('audio-player');
```

---

## Aliases retroativos v0.x

| Alias | Aponta para | Warn? |
|---|---|---|
| `window.zldParseBool` | `OZI.helpers.parseBool` | ✅ com `core.log` |
| `window.zldParseList` | `OZI.helpers.parseList` | ✅ |
| `window.zldGenerateId` | `OZI.helpers.generateId` | ✅ |
| `window.zldNormalizeDomId` | `OZI.helpers.normalizeDomId` | ✅ |
| `window.zldSafeById` | `OZI.helpers.safeById` | ✅ |
| `window.zldClassNames` | `OZI.helpers.classNames` | ✅ |
| `window.zldGetElementById` | `OZI.helpers.safeById` | ✅ |

---

## Consolidação de código duplicado (v0.x → v1.0.0)

| Função | Existia em | Linhas eliminadas |
|---|---|---|
| `parseBool` | oziLoadData, oziSelect, oziAutocomplete | ~30 |
| `parseList` | oziLoadData, oziEditor | ~20 |
| `normalize` | oziSelect, oziAutocomplete, oziSearch | ~15 |
| `escapeRegExp` | oziSelect, oziAutocomplete, oziSearch | ~10 |
| `splitTopLevel` | oziEditor, oziSelect | ~40 |
| `classNames` | oziLoadData | ~20 |
| `icon()` | oziAudio (~80 linhas), oziEditor (~80 linhas) | ~160 |
| `exclusiveActor` | oziAudio (activePlayerInstance global) | ~20 |
| **Total** | | **~315 linhas** |

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-core.js` | Consome `window.OziHelpers` → `OZI.helpers` |
| `ozi-conf.js` | `icon()` lê `OZI.conf.core.urlBase` em runtime |
| Todos os plugins | Consomem via `OZI.helpers.*` |
