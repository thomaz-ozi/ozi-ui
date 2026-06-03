# ozi-helpers.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- `parseBool($el, attrName, fallback?)` — leitura segura de boolean em atributo HTML
- `parseInt($el, attrName, fallback?)` — leitura segura de inteiro em atributo HTML
- `parseList(raw)` — string separada por vírgula → array limpo
- `generateId(prefix?)` — ID único crescente para uso no DOM
- `normalizeDomId(value)` — sanitiza string para ID/seletor CSS seguro
- `safeById(id)` — `document.getElementById` seguro com retorno null
- `normalize(str)` — NFD + remove diacríticos + lowercase (para busca sem acentos)
- `escapeRegExp(str)` — escape para uso em `RegExp`
- `splitTopLevel(raw, separator, openChar?, closeChar?)` — split respeitando aninhamento
- `classNames(...args)` — junção condicional de classes (string, array, objeto)
- `icon($el, name, options?)` — sistema unificado de ícones SVG (substitui Audio + Editor)
- `runBatch($items, callbackItem, callbackEnd?)` — execução em lote com isolamento de erros
- `exclusiveActor(scope, instance?)` — controle de instância única por escopo
- `window.OziHelpers` como contrato interno para `ozi-core.js`
- Aliases retroativos v0.x com warn: `zldParseBool`, `zldParseList`, `zldGenerateId`, `zldNormalizeDomId`, `zldSafeById`, `zldClassNames`, `zldGetElementById`

### Consolida (elimina duplicação)
- `parseBool` — existia em oziLoadData, oziSelect, oziAutocomplete
- `parseList` — existia em oziLoadData, oziEditor
- `normalize` + `escapeRegExp` — existiam em oziSelect, oziAutocomplete, oziSearch
- `splitTopLevel` — existia em oziEditor e oziSelect
- `classNames` — existia em oziLoadData (zldClassNames)
- `icon()` — sistemas próprios de oziAudio (~80 linhas) e oziEditor (~80 linhas) unificados
- `exclusiveActor` — `activePlayerInstance` global do oziAudio encapsulado
- **Total eliminado: ~315 linhas duplicadas**

### Decisões de design
- Sem dependência de `OZI.conf` — funções recebem tudo por parâmetro
- `icon()` lê `urlBase` em runtime do `OZI.conf` — safe mesmo sem conf no momento do registro
- `runBatch` usa jQuery `$items.each()` — mantém compatibilidade com padrão do projeto
- `exclusiveActor` usa closure interno — não polui `window.*`
- Aliases retroativos emitem warn apenas quando `OZI.conf.core.log = true` — sem ruído em produção

---

## Versões anteriores

Não existia como arquivo separado na v0.x.  
Funções estavam espalhadas em `oziLoadData` (zld*), `oziAddons`, `oziAudio` e `oziEditor`.  
`oziAddons` era o arquivo "guarda-chuva" de utilitários — absorvido e reorganizado aqui.
