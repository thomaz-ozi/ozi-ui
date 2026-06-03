# ozi-loaddata.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- `OZI.modules.loadData` como namespace v1.0.0
- `window.oziLoadData` (D maiúsculo) como alias público correto
- Suporte a chamada imperativa: `oziLoadData({ url, method, data, json })`
- Transport fetch com suporte a `GET`, `POST`, `PUT`, `DELETE`
- Progress bar via classes `ozi-progress-*` (tokens CSS, sem Bootstrap hardcoded)
- Busy state via `OZI.conf.classMap.disabled` (sem classe hardcoded)
- Validação pré-envio via `OZI.modules.validate` (opcional, adapter pattern)
- Ações pós-resposta via `OZI.modules.actions` (opcional)
- Hooks `beforeRender` / `afterRender` via `OZI.hooks` com fallback para `zldConf.zldHooks`
- CSRF token automático via `<meta name="csrf-token">`
- Log configurável via `OZI.conf.plugins.loadData.log`
- `progressBarGlobalClass` configurável via `OZI.conf.plugins.loadData`
- Alias depreciado `window.zldRenderDependencies` com warn

### Removido (migrado para outros arquivos)
- `oziConf` / `zldConf` → `ozi-conf.js`
- `oziValidateContainer` → `ozi-validate.js`
- `zldActions` → `ozi-actions.js`
- `zldParseBool`, `zldGenerateId`, `zldClassNames`... → `ozi-helpers.js`
- Sistema de hooks interno → `ozi-hooks.js`
- Acoplamento a Select2 e CKEditor → removido (sem substituição)
- `zldCkEditor` → removido (obsoleto)

### Decisões de design
- Bind declarativo via delegação `$(document).on('click.oziLoadData')` — cobre DOM dinâmico sem MutationObserver
- Progress bar inserida no `<body>` uma única vez (singleton lazy)
- Classes UI via `OZI.conf.classMap.*` — sem Bootstrap/Tailwind hardcoded
- `validate` e `actions` são opcionais — loadData funciona sem eles

---

## [3.9.4] — oziLoadData v0.x (código real anterior)

### Estado
- Monolito com ~1300 linhas e 17 exports globais
- Hospedava: oziConf, zldConf, oziValidateContainer, zldActions, helpers, hooks
- Classes Bootstrap hardcoded (`is-invalid`, `was-validated`, `btn`)
- Naming bug: exposto como `window.oziLoaddata` (d minúsculo)
- Acoplado a Select2 e CKEditor no motor de validação
- `zldCkEditor` com `console.log` infinito sem CKEditor presente

### Migração v3.9.4 → v1.0.0
- `window.oziLoaddata` → `window.oziLoadData` (D maiúsculo) — alias retroativo mantido
- `zldConf.zldProgressBarGlobalClass` → `OZI.conf.plugins.loadData.progressBarGlobalClass`
- `zldConf.zldHooks.afterRender` → `OZI.hooks.afterRender` (compat automática)
- `oziValidateContainer` → `OZI.modules.validate.container()`
- `zldActions` → `OZI.modules.actions.run()`
- `zldRenderDependencies` → `OZI.hooks.afterRender.run()` (alias com warn mantido)
