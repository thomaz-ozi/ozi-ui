# ozi-conf.js — CHANGELOG

---

## [1.0.0] — 2025 (v1.0.0 release)

### Adicionado
- Namespace `window.OziConf` como contrato interno entre arquivos do core
- Sistema de presets por tema: `default`, `bootstrap5`, `tailwind`, `custom`
- `classMap` completo para cada preset
- Merge profundo com precedência: defaults → preset → dev → classMap override
- `OziConf.get(path)` para leitura segura por caminho de chave
- `OziConf.getPresets()` para debug e documentação
- Suporte a `integrations` como array de adapters
- Opção `failFast` no core para parar na primeira falha
- Seção `plugins` unificada (substitui `modules` + `components` separados)
- Defaults para todos os 7 plugins com UI: loadData, select, autocomplete, editor, audio, auth, search

### Decisões de design
- `plugins` como chave unificada (em vez de `modules` + `components`) — mais simples para o dev
- Arrays no merge são **substituídos**, não concatenados — comportamento previsível
- preset do tema preenche `classMap` automaticamente — dev só declara overrides pontuais
- `window.OziConf` é contrato interno — dev nunca usa diretamente

---

## Versões anteriores

Não existia como arquivo separado.  
Na v0.x a configuração era feita diretamente em `zldConf` dentro do `ozi-loaddata.js`.  
O alias retroativo `window.zldConf` está em `ozi-core.js`.