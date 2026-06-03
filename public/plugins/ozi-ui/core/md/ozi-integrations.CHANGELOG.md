# ozi-integrations.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- Registry de plugins (`_pluginRegistry`) e adapters (`_adapterRegistry`)
- `registerPlugin(plugin)` — ficha declarativa por plugin
- `registerAdapter(adapter)` — adapter por framework
- Casamento automático: plugin chega → notifica adapters; adapter chega → escaneia plugins
- `rescan(scope?)` — varredura manual ou via hook
- Registro automático de rescan em `OZI.hooks.afterRender` (substitui eventos DOM próprios)
- `helpers.*` compartilhados: `isBlank`, `parseJsonSafe`, `stableStringify`, `escapeAttrValue`, `ensureSingleScript`, `parseIntegrationEntry`
- `parseIntegrationEntry('livewire:3')` → `{ name, version }` — parseia array de integrations
- Execução segura via `_safeCall` — erro num adapter não para os outros
- `window.OziIntegrations` como contrato interno para `ozi-core.js`
- Compat retroativa: `window.OziFrameworks` como alias com warn

### Decisões de design
- Rescan via `OZI.hooks.afterRender` (não mais eventos DOM diretos) — fonte única
- Helpers movidos para `OZI.integrations.helpers.*` — elimina duplicação dos adapters v0.x
- `ozi-autocomplete.livewire.js` (bridge dedicado) absorvido em `ozi-livewire.adapter.js`
- Ordem de carregamento de plugin/adapter não importa — matchmaker casa quando ambos chegam

---

## Versões anteriores

### OziFrameworks v1.0.0 (ozi-frameworks-core.js) — v0.x

- Sistema já existia e estava bem desenhado
- Rescan dependia de `livewire:navigated` e `livewire:initialized` próprios
- Helpers duplicados em `ozi-autocomplete.livewire.js` (`isBlank`, `parseJsonSafe`, `stableStringify`)
- Bridge `ozi-autocomplete.livewire.js` era um adapter dedicado fora do sistema
- Exposto como `window.OziFrameworks` (agora depreciado)
