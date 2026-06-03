# ozi-core.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- Namespace `window.OZI` com slots para todos os subsistemas
- Sequência de boot controlada: conf → helpers → lang → hooks → integrations → loader
- `OZI.ready(callback)` com suporte a múltiplos callbacks (array, não sobrescreve)
- `window.oziConf()` como ponto único de configuração — pode ser chamado antes ou depois do boot
- Distinção entre subsistemas obrigatórios (conf, hooks) e opcionais (lang, loader, integrations, helpers)
- `failFast` configurável — lança exceção em dev, engole em produção
- Aliases retroativos v0.x com warn: `oziCore`, `zldConf`, `oziLoaddata`, `OziFrameworks`
- `OZI._log()` exposto para subsistemas usarem antes do boot completo
- Auto-boot via `DOMContentLoaded` ou imediato se DOM já pronto

### Resolve (dívidas técnicas da v0.x)
- `hookCandidates` hardcoded → plugins se auto-registram via `OZI.hooks.afterRender.register()`
- Sem namespace `OZI` → `window.OZI` criado com estrutura completa
- `oziConf` só conhecia `zldConf` → `oziConf()` com tema, lang, plugins, classMap
- Falha no meio da cadeia quebrava tudo → `failFast` + subsistemas opcionais com graceful degradation
- `OziFrameworks` separado → `OZI.integrations` unificado + alias retroativo

---

## [1.3.0] — oziCore v0.x (código real anterior)

### Estado
- Carregava scripts via Promise chain (`loadMany`)
- `hookCandidates` hardcoded: OziSelect, OziAudio, OziAutocomplete, OziEditor
- Detecção automática Livewire 3 (`commit`) e 4 (`morph.updated`) — já funcionava bem
- Cache duplo (`loadedScripts` + `loadingScripts`) — prevenção de race conditions
- Exposto como `window.oziCore` (não como `window.OZI`)
- `oziConf()` interno conhecia apenas `zldConf` (loadData)
- Sem suporte a tema, lang, integrations

### Migração
- `window.oziCore` → alias retroativo → `window.OZI`
- `oziCore({ urlBase, urlScript })` → `oziConf({ core: { urlBase } })` + `<script>` tags ou `OZI.loader.load()`
- `hookCandidates` → cada plugin registra `OZI.hooks.afterRender.register('component:X', fn)`
