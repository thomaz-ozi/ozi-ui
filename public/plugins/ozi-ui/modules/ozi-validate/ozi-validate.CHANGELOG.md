# ozi-validate.js — CHANGELOG

---

## [2.0.0] — 2026-07-03 (v2 F2 #1 — primeiro componente migrado)

### Alterado
- Motor interno 100% JS puro — zero jQuery (contrato de camadas v2,
  `dev-hard/docs/ozi-ui-v2-contratos.md`). Coleta/estado via `querySelectorAll`,
  `closest`, `classList`; sem `$()`/`.is()`/`.val()`/`.attr()` internos.
- Validação interativa passa a usar delegação nativa em `document`
  (`input`/`change`/`focusout` — `focusout` no lugar de `blur`, que não faz bubble).
- `container()`/`field()`/`applyState()` aceitam Element nativo, jQuery ou
  seletor via `OZI.helpers.toElement`/`toElements` (helpers de transição v1.1.0).
- `invalidFields[].el` substitui `invalidFields[].$el` — nenhum consumidor
  externo lia esse campo além de `.name` (confirmado por grep no plugin inteiro).

### Mantido (sem regressão)
- API pública inalterada: `registerAdapter`, `container`, `applyState`,
  `initInteractive`, `field`, `getAdapters`.
- Compat retroativa `window.oziValidateContainer` com warn.
- Adapters ainda-v1 registrados por `ozi-select`, `ozi-autocomplete`,
  `ozi-editor` e `ozi-audio` (pendentes na F2) continuam funcionando sem
  alteração — recebem o elemento envelopado em jQuery via ponte de transição
  `_wrapLegacy()` (`guard-ok`, documentada no arquivo), removida quando cada
  um desses componentes migrar.
- Validado por página de aceite dedicada:
  `public/teste-v2/aceite-validate.html` (20 checks, PASSOU em Edge headless).

### Nota
- Retirado do `PENDING_V1` do guard `tools/check-camadas.sh` — primeiro
  componente do escopo v2 a zerar a própria pendência.

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
