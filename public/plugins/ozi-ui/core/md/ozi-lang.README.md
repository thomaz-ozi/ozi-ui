# ozi-en.js

**Versão:** 1.0.0  
**Camada:** `core/`  
**Dependências:** `ozi-conf.js` (lang, fallbackLang, log)  
**Consumido por:** `ozi-core.js`  
**Usado por:** todos os plugins via `OZI.lang.t()`

---

## Descrição

Sistema de internacionalização (i18n) do OZI-UI.  
Toda string visível ao usuário passa por `OZI.lang.t()` — nunca hardcoded nos plugins.

Segue a **Opção B** de arquitetura de lang:
- Strings globais (`common.*`) no `core/lang/`
- Strings de cada plugin no próprio `plugin/lang/`
- Merge profundo ao registrar — plugins adicionam ao dicionário, nunca sobrescrevem

---

## O que NÃO faz

- Não carrega arquivos de idioma automaticamente — responsabilidade do `ozi-loader.js`
- Não detecta idioma do browser — lê de `OZI.conf.lang`
- Não traduz HTML diretamente — retorna strings para o plugin usar

---

## API pública

### `OZI.lang.t(key, params?)`

Traduz uma chave. Ponto central de i18n de todo o projeto.

```js
OZI.lang.t('common.loading')
// → 'Carregando...'

OZI.lang.t('select.searchPlaceholder')
// → 'Pesquisar...'

OZI.lang.t('auth.minChars', { min: 12 })
// → 'Mínimo de 12 caracteres'
```

**Ordem de resolução:**

```
1. idioma ativo (OZI.conf.lang)
2. idioma de fallback (OZI.conf.fallbackLang)
3. retorna a própria chave como último recurso
```

**Interpolação** — suporta `{param}` e `{{param}}`:

```js
// dicionário: { auth: { minChars: 'Mínimo de {min} caracteres' } }
OZI.lang.t('auth.minChars', { min: 12 })
// → 'Mínimo de 12 caracteres'
```

---

### `OZI.lang.register(locale, dict)`

Registra ou estende um dicionário.  
Chamado por cada plugin ao ser carregado.

```js
// dentro de ozi-select/lang/pt-BR.js:
OZI.lang.register('pt-BR', {
    select: {
        searchPlaceholder: 'Pesquisar...',
        valuePlaceholder:  'Selecione...',
        empty:             'Nenhuma opção encontrada'
    }
});

// dentro de ozi-editor/lang/pt-BR.js:
OZI.lang.register('pt-BR', {
    editor: {
        bold:   'Negrito',
        italic: 'Itálico',
        table:  'Tabela'
    }
});
```

Merge profundo — cada plugin adiciona seu namespace sem afetar os outros.

**Resultado em memória após os dois registros:**
```js
{
    common: { loading: 'Carregando...', ... },  // core
    select: { searchPlaceholder: '...' },        // ozi-select
    editor: { bold: '...', italic: '...' }       // ozi-editor
}
```

---

### `OZI.lang.use(locale)`

Define o idioma ativo.  
Não carrega arquivos — apenas muda o ponteiro interno.

```js
OZI.lang.use('en');
OZI.lang.t('common.loading'); // → 'Loading...'

OZI.lang.use('pt-BR');
OZI.lang.t('common.loading'); // → 'Carregando...'
```

Aceita variações de formato — normaliza automaticamente:

| Entrada | Normalizado |
|---|---|
| `'pt-BR'` | `'pt-BR'` |
| `'pt-br'` | `'pt-BR'` |
| `'pt_BR'` | `'pt-BR'` |
| `'EN'` | `'en'` |

---

### `OZI.lang.available()`

Lista de idiomas com dicionário registrado.

```js
OZI.lang.available();
// → ['pt-BR', 'en']
```

---

### `OZI.lang.getDict(locale?)`

Retorna o dicionário completo de um idioma. Útil para debug.

```js
OZI.lang.getDict();         // idioma ativo
OZI.lang.getDict('en');     // inglês
```

---

### `OZI.lang.current` / `OZI.lang.fallback`

Propriedades de leitura.

```js
OZI.lang.current;   // 'pt-BR'
OZI.lang.fallback;  // 'en'
```

---

## Estrutura de dicionários

### `core/lang/pt-BR.js` — strings globais

```js
OZI.lang.register('pt-BR', {
    common: {
        loading:  'Carregando...',
        saving:   'Salvando...',
        save:     'Salvar',
        cancel:   'Cancelar',
        confirm:  'Confirmar',
        close:    'Fechar',
        clear:    'Limpar',
        search:   'Pesquisar',
        empty:    'Nenhum resultado',
        error:    'Erro',
        success:  'Concluído',
        required: 'Campo obrigatório',
        yes:      'Sim',
        no:       'Não'
    }
});
```

### `plugin/lang/pt-BR.js` — strings do plugin

Cada plugin registra seu próprio namespace:

```js
// ozi-select/lang/pt-BR.js
OZI.lang.register('pt-BR', {
    select: {
        searchPlaceholder: 'Pesquisar...',
        valuePlaceholder:  'Selecione...',
        empty:             'Nenhuma opção encontrada'
    }
});

// ozi-audio/lang/pt-BR.js
OZI.lang.register('pt-BR', {
    audio: {
        ready:          'Pronto',
        recording:      'Gravando...',
        processing:     'Processando...',
        micUnavailable: 'Microfone indisponível',
        player:         'Player de áudio',
        recorder:       'Gravador de áudio'
    }
});

// ozi-auth/lang/pt-BR.js
OZI.lang.register('pt-BR', {
    auth: {
        showPassword:  'Mostrar senha',
        hidePassword:  'Ocultar senha',
        rulesTitle:    'Regras da senha',
        minChars:      'Mínimo de {min} caracteres',
        maxChars:      'Máximo de {max} caracteres',
        uppercase:     'Pelo menos uma letra maiúscula',
        lowercase:     'Pelo menos uma letra minúscula',
        number:        'Pelo menos um número',
        special:       'Pelo menos um caractere especial',
        noSpace:       'Sem espaços',
        confirm:       'Senhas coincidem'
    }
});
```

---

## Como os plugins usam

```js
// dentro de ozi-select.js
var placeholder = OZI.lang.t('select.searchPlaceholder');
// → 'Pesquisar...'

// dentro de ozi-auth.js
var msg = OZI.lang.t('auth.minChars', { min: OZI.conf.plugins.auth.passMin });
// → 'Mínimo de 12 caracteres'

// fallback para common quando não há string específica
var loading = OZI.lang.t('common.loading');
// → 'Carregando...'
```

---

## Adicionando um novo idioma

### 1. Criar os arquivos de lang

```
core/lang/es.js
components/ozi-select/lang/es.js
components/ozi-editor/lang/es.js
...
```

### 2. Registrar em cada arquivo

```js
// core/lang/es.js
OZI.lang.register('es', {
    common: {
        loading:  'Cargando...',
        save:     'Guardar',
        cancel:   'Cancelar',
        // ...
    }
});
```

### 3. Carregar via loader e ativar

```js
OZI.loader.load([
    'core/lang/es.js',
    'components/ozi-select/lang/es.js',
    'components/ozi-editor/lang/es.js'
]).then(function () {
    OZI.lang.use('es');
});
```

---

## Template para novos idiomas

Veja `core/lang/_template.js` para a estrutura completa com todas as chaves disponíveis.

---

## Comparação v0.x → v1.0.0

| v0.x | v1.0.0 |
|---|---|
| Strings PT hardcoded em 4 plugins | `OZI.lang.t()` em todos |
| i18n interno do oziEditor (LANGS objeto) | `OZI.lang.register()` + `t()` |
| Sem fallback de idioma | Fallback automático para `en` |
| Sem interpolação | `t('key', { param: value })` |

---

## Arquivos relacionados

| Arquivo | Relação |
|---|---|
| `ozi-core.js` | Chama `OziLang.init(lang, fallbackLang)` no bootstrap |
| `ozi-conf.js` | Fonte de `lang`, `fallbackLang` e `core.log` |
| `ozi-loader.js` | Carrega arquivos `plugin/lang/pt-BR.js` sob demanda |
| `core/lang/pt-BR.js` | Dicionário global pt-BR (carregado no boot) |
| `core/lang/en.js` | Dicionário global en (carregado no boot) |
| `core/lang/_template.js` | Template para novos idiomas |
| Todos os plugins | Registram via `OZI.lang.register()` e consomem via `t()` |
