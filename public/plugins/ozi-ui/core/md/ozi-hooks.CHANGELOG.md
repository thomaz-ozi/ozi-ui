# ozi-hooks.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- Canal `OZI.hooks.afterRender` com `register`, `unregister`, `run`, `getRegistered`
- Canal `OZI.hooks.beforeRender` com mesma API (para cleanup pré-render)
- Fábrica `createHookChannel` — ambos os canais têm estrutura idêntica
- Deduplicação automática por ID
- Execução segura — erro em um hook não para os outros
- Ordem FIFO garantida por ordem de inserção
- Fontes nativas: `dom`, `livewire3`, `livewire4`, `compat-zld`
- `registerSource(name, connectFn)` — extensível para Inertia, HTMX, Alpine
- Auto-detect de versão do Livewire — tenta L3 e L4 de forma independente
- Compat retroativa: propaga para `zldConf.zldHooks.afterRender` (v0.x)
- `window.OziHooks` como contrato interno para `ozi-core.js`

### Decisões de design
- Dois canais independentes (`afterRender` / `beforeRender`) em vez de um canal com fases
- Fontes são registradas primeiro, conectadas no boot — permite registrar fontes antes do Livewire carregar
- `run(root, ctx)` com `root` opcional — `null` equivale a `document` inteiro
- Erros capturados por try/catch em cada hook individualmente

---

## Versões anteriores

Não existia como arquivo separado na v0.x.  
Na v0.x havia 8 mecanismos diferentes de auto-registro espalhados pelos plugins.  
Este arquivo unifica todos em um único canal.