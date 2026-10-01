# ozi-loader.js — CHANGELOG

---

## [1.0.2] — 2026-10-01

### Corrigido
- **CSS de plugin entra antes do tema.** Era anexado no fim do `<head>`, depois das folhas de
  tema que o dev linka estáticas; como `themes/<tema>/overrides.css` estiliza as mesmas classes
  `ozi-*` com a mesma especificidade, o componente vencia e o tema não aplicava (ex.: select com
  padding de 6px em vez dos 8px do tailwind). Agora o loader insere antes da primeira folha
  `…/themes/<tema>/*.css`, reproduzindo a ordem documentada (framework → componentes → tema).
  Sem tema linkado, nada muda. Aceite: `aceite-temas.html` (12/14 → 14/14).

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- Carregamento sequencial via Promise chain com ordem garantida
- Carregamento paralelo via `Promise.all` com opção `parallel: true`
- Cache por URL com estados `loading`, `loaded`, `error`
- Suporte a retry configurável por entrada ou globalmente
- Resolução de caminhos relativos via `OZI.conf.core.urlBase`
- Detecção automática de tipo por sufixo (`.js` vs `.css`)
- CSS falho não quebra o boot — `resolve()` sempre (sem rejeitar)
- `skip` condicional por entrada — carregamento opcional de plugins
- `OZI.loader.resolve(path)` para uso por plugins que montam URLs de assets
- `OZI.loader.isLoaded(url)` para verificação antes de carregar
- `OZI.loader.getCache()` para debug de estado de carregamento
- `OZI.loader.clearCache()` para reload em desenvolvimento
- `window.OziLoader` como contrato interno para `ozi-core.js`

### Decisões de design
- `async: false` nos scripts garante ordem de execução no browser
- Retry só para scripts (`.js`) — CSS não é crítico para execução
- `failFast` herdado de `OZI.conf.core.failFast` mas sobrescritível por chamada
- Arrays substituídos no merge (consistente com `ozi-conf.js`)
- Sem dependência de jQuery — funciona com DOM puro

---

## Versões anteriores

Não existia como arquivo separado na v0.x.  
Na v0.x o carregamento era feito pelo `oziCore` via lista hardcoded de scripts.  
Este arquivo substitui e generaliza esse mecanismo.