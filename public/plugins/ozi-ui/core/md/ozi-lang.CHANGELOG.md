# ozi-en.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- `OZI.lang.t(key, params?)` — ponto único de tradução com fallback automático
- `OZI.lang.register(locale, dict)` — merge profundo por plugin
- `OZI.lang.use(locale)` — troca de idioma em runtime
- `OZI.lang.available()` — lista de idiomas registrados
- `OZI.lang.getDict(locale?)` — inspeção do dicionário para debug
- Propriedades de leitura `OZI.lang.current` e `OZI.lang.fallback`
- Interpolação de parâmetros com `{param}` e `{{param}}`
- Normalização automática de locale: `'pt-br'` → `'pt-BR'`, `'pt_BR'` → `'pt-BR'`
- Dicionário base embutido: `pt-BR` e `en` com namespace `common`
- Fallback automático: ativo → fallback → retorna a própria chave
- `window.OziLang` como contrato interno para `ozi-core.js`
- Template `core/lang/_template.js` para novos idiomas

### Decisões de design
- Arquitetura **Opção B**: strings globais no core, strings de plugin no próprio plugin
- Merge profundo no `register()` — plugins nunca sobrescrevem namespaces alheios
- `t()` nunca retorna `undefined` — pior caso retorna a própria chave
- Sem carregamento automático de arquivos — responsabilidade do `ozi-loader.js`
- Normalização de locale segue BCP 47 (language-REGION)

---

## Versões anteriores

Não existia como sistema separado na v0.x.  
Na v0.x havia strings hardcoded em 4 plugins (oziEditor, oziAudio, oziAuth, oziCopy).  
oziEditor tinha objeto `LANGS` interno com pt-br e en.  
Este arquivo unifica e generaliza todo o i18n do projeto.
