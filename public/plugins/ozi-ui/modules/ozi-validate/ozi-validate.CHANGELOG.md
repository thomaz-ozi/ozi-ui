# ozi-validate.js — CHANGELOG

---

## [2.2.0] — 2026-08-24 (feat — gate de envio + fixes do standalone)

### Adicionado
- **Gate de envio declarativo** — `data-ozi-validate` reaproveitado em `<button
  type="submit">`/`<input type="submit">`. Capturado em fase de **captura** no `document` no
  evento `submit` (cobre clique e Enter); revalida tudo, bloqueia (`preventDefault` +
  `stopImmediatePropagation`) se inválido e foca o 1º campo inválido; deixa passar se válido.
  Sempre ativo, independente de `initInteractive()`/`interactiveValidation`.
- `data-ozi-validate-group` (CSV de ids) — alvo do gate fora do `<form>`; sem ele, cai no
  `<form>` mais próximo; sem nenhum dos dois, loga aviso e não intercepta (fail-open).
- Eventos `ozi:validate-broken`/`ozi:validate-ready` via `OZI.helpers.emit` (contrato v2, R7).
- `container()` passa a honrar `config.container` (seletor CSS) e `config.groupId` (id via
  `document.getElementById`) — documentados no README desde a v1.0.0, nunca lidos pelo código
  (só `$container`/`$elements` funcionavam). **Achado #1** do roadmap
  `ozi-validate-standalone-livewire.md`.
- `pluginConf.validate.interactiveValidation` — alias checado antes de
  `pluginConf.loaddata.interactiveValidation` (mantido como fallback). **Achado #3** do roadmap.

### Decisão de arquitetura — sem plugin de integração Livewire dedicado
O roadmap original previa um novo plugin exposto em `integrations/.../validate-livewire` para
"interceptar o `wire:submit` na ordem certa". Investigação nesta versão (lendo
`vendor/livewire/livewire/dist/livewire.js` real, disponível no bench `ozi-ui-dev-tw`) mostrou
que `wire:submit` é implementado como um `addEventListener('submit', ...)` em **fase de bolha**
direto no `<form>` (via `x-on:submit.prevent` do Alpine, que é o motor de diretivas do
Livewire). Um listener em **fase de captura** no `document` — que é exatamente o que o gate já
precisava para cobrir Enter além de clique — **sempre** roda antes de qualquer listener de
bolha no `<form>`, por ordem de fase do DOM (não por ordem de registro). Logo
`stopImmediatePropagation()` no gate já barra o `wire:submit` quando inválido, **sem** nenhum
código específico de Livewire. O plugin de integração deixou de ser necessário — validado por
página de aceite que reproduz fielmente o padrão real (listener de bolha direto no `<form>`).

### Corrigido (achados do roadmap, não implementados)
- **Achado #2 (CSS do standalone) — não era bug.** O roadmap presumia que `_pluginMap['validate'].css
  = null` deixava o modo standalone sem visual. Na verdade o tema **`default`**
  (`themes/default/overrides.css`) já estiliza `.ozi-invalid`/`.ozi-valid`/`.ozi-feedback` —
  qualquer app que já linka o tema (passo obrigatório, decisão #19) tem o visual básico de
  graça. `modules/ozi-validate/css/ozi-validate.css` é uma casca **opcional** mais rica (ícones
  SVG, dark mode, input-group) — o `css: null` é intencional, documentado em
  `OziCheckCommand.php` ("o css é visual do tema `default`, opt-in via `@oziStyles`"). Nada
  alterado; a divergência era do roadmap contra uma decisão já tomada em outro arquivo.
- **Achado #4 (README/CHANGELOG desalinhados)** — `runAdapters()` documentado mas inexistente
  (removido da doc); `field()` existente mas não documentado (adicionado); `ldValidate`
  documentado como `boolean` mas é `number` (contagem de `invalidFields`) desde a v1.0.0
  (corrigido); versão do README presa em `2.0.0` (código já estava em `2.1.0`).

### Validado
- Página de aceite dedicada: `public/teste-v2/aceite-validate-gate.html` — **15/15** em Edge
  headless (bloqueio por clique, libera quando válido, `data-ozi-validate-group` fora do
  `<form>`, submit implícito sem `submitter`, bloqueio do listener "Livewire" em fase de bolha,
  `container({ container })`/`container({ groupId })`).
- Regressão: `aceite-validate.html` (20/20), `aceite-select*.html`, `aceite-autocomplete.html`,
  `aceite-check-shim.html` — todos PASSARAM sem alteração de resultado.

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
