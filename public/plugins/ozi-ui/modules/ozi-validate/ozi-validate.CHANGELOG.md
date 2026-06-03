# ozi-validate.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- `OZI.modules.validate.registerAdapter()` — adapter pattern para componentes OZI
- `OZI.modules.validate.container(config)` — validação por container/groupId
- `OZI.modules.validate.runAdapters(scope?)` — valida só componentes OZI
- `OZI.modules.validate.applyState($el, state)` — estado visual manual
- `OZI.modules.validate.initInteractive()` — validação em tempo real opt-in
- `OZI.modules.validate.getAdapters()` — lista adapters registrados (debug)
- Adapter nativo HTML: input, select, textarea, radio, checkbox, file, email
- Suporte a `data-ozi-required` além de `required` nativo
- Suporte a `data-ozi-required-message` para mensagem customizada
- Classes visual via `OZI.conf.classMap.invalid/valid` — sem hardcode
- Validação interativa opt-in via `[data-ozi-validate]` no container
- Compat retroativa: `window.oziValidateContainer` com warn
- Retorno inclui compat v0.x: `ldValidate`, `zldValidateName`

### Resolve (dívidas técnicas da v0.x)
- Acoplamento a Select2 e CKEditor → adapter pattern (dívida #6)
- Classes `is-invalid`, `was-validated` hardcoded → `OZI.conf.classMap` (dívida #8)
- Delegação global em todos input/select/textarea → opt-in via `[data-ozi-validate]` (dívida #11)
- Bloco duplicado de validação → `_container()` unificado (dívida #9)

### Decisões de design
- Adapters OZI têm prioridade sobre adapter nativo — mais específico primeiro
- Deduplicação por nome no `registerAdapter()` — registrar duas vezes substitui
- `focusOnError` tenta `$el.focus()` com try/catch — safe para elementos não focáveis
- `silent: true` coleta dados sem aplicar classes — útil para validação silenciosa

---

## Versões anteriores

### oziValidateContainer (dentro de oziLoadData v3.9.4)

- Misturado com o transport no mesmo arquivo
- Acoplado a Select2 (`$(el).select2('data')`) e CKEditor (`CKEDITOR.instances`)
- Classes `is-invalid`, `was-validated` hardcoded
- Delegação global em todos input/select/textarea da página (sem opt-out)
- Retorno: `{ formData, data, ldValidate, invalidFields, zldValidateName }`
- Exposto como `window.oziValidateContainer`

### Migração
- `oziValidateContainer(container)` → `OZI.modules.validate.container({ container })`
- `oziValidateContainer({ groupId })` → `OZI.modules.validate.container({ groupId })`
- Retorno mantém `ldValidate` e `zldValidateName` para compat
