# ozi-actions.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- `OZI.modules.actions.run(actions, ctx?)` — executa lista de ações
- `OZI.modules.actions.registerHandler(type, fn)` — handler customizado por tipo
- `OZI.modules.actions.registerThemeAdapter(theme, handlers)` — adapter por tema
- `OZI.modules.actions.getHandlers()` — debug de handlers registrados
- Adapters built-in: `bootstrap5`, `tailwind`, `default`
- Handlers universais: `redirect`, `reload`, `eval`, `zld-load`, `set-value`, `set-options`
- `set-value` e `set-options` via eventos DOM customizados (`ozi:set-value`, `ozi:set-options`)
- Fallback em cascata para toast: UIToast → toastr → Bootstrap Toast nativo → console
- Compat retroativa: `window.zldActions` com warn

### Resolve (dívidas técnicas da v0.x)
- `window.UIToast` hardcoded → adapter bootstrap5 com fallbacks (dívida #7)
- `window.bootstrap.Modal` direto → adapter por tema (dívida #7)
- `window.bootstrap.Offcanvas` direto → adapter por tema (dívida #7)
- `zld-load` referenciava `oziLoaddata` (d minúsculo) → usa `OZI.modules.loadData`
- Sem extensão de tipos → `registerHandler()` para tipos customizados

### Decisões de design
- Prioridade: handler customizado > adapter de tema > universal > warn
- `tailwind` inicia como clone de `default` — dev sobrescreve via `registerThemeAdapter`
- `eval` mantido por compat mas uso desencorajado (log de aviso quando executado)
- `set-value` e `set-options` como universais — comunicam via eventos DOM (desacoplado de Livewire)

---

## Versões anteriores

### zldActions (dentro de oziLoadData v3.9.4)

- Misturado com o transport no mesmo arquivo (~200 linhas)
- Acoplamentos hardcoded: `window.UIToast`, `window.toastr`, `window.bootstrap.Modal`, `window.bootstrap.Offcanvas`
- `zld-load` referenciava `window.oziLoaddata` (d minúsculo — naming bug)
- Tipos suportados: `toast`, `modal-close`, `modal-open`, `offcanvas-close`, `offcanvas-open`, `zld-load`, `reload`, `redirect`, `eval`
- Exposto como `window.zldActions`

### Migração
- `zldActions([...])` → `OZI.modules.actions.run([...])`
- Alias `window.zldActions` mantido com warn
