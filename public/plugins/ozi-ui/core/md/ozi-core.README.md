# ozi-core.js

**Versão:** 2.0.1 · **Camada:** `core/`

Orquestrador da v1: criava o namespace `window.OZI`, inicializava os subsistemas na ordem correta
e expunha `oziConf()`.

---

## ⚠️ Na v2 o ponto de entrada é o `ozi.js`

O `core/ozi-core.js` **não é carregado** pelo boot da v2 — ele não está no `_pluginMap` nem no
`OziAssets.php`. Quem inicia a biblioteca hoje é o **`ozi.js`** na raiz do pacote, que detecta o
`urlBase` sozinho e carrega os subsistemas na ordem (`ozi-conf` → `ozi-hooks` → `ozi-lang` →
`ozi-helpers` → `ozi-loader` → `ozi-integrations`).

```html
<!-- v2 -->
<script src="./plugins/ozi-ui/ozi.js"></script>
```

Em Laravel, use as diretivas `@oziStyles` / `@oziScripts` — elas emitem o boot completo, na
ordem certa e com o locale do app.

O arquivo continua na distribuição porque a **rampa de compatibilidade v1 é oficial na linha
`2.x`** (shims, aliases `zld*`, jQuery distribuído): projetos que ainda apontam para ele durante
a migração não quebram. A remoção fica para a **3.0.0**, junto com o resto da rampa.

---

## Documentação

A referência completa está em **[oziui.com/docs](https://oziui.com/pt-br/docs/introduction)**;
para migrar da v1, veja o guia de migração v1→v2.

---

> **Por que este arquivo é só um ponteiro.**
> Ele já foi uma cópia da referência completa, e virou uma **terceira fonte de verdade** ao lado
> da documentação oficial e do site — sem nada que forçasse sua atualização a cada release.
> Em 2026-09 a conferência contra o código encontrou 10 dos 12 READMEs distribuídos com a versão
> defasada, exemplos em jQuery (removido na v2) e atributos que o componente não lê mais.
> Um exemplo errado ensina o erro ativamente, o que é pior que exemplo nenhum — daí a troca por
> um ponteiro curto, que não tem como envelhecer sozinho.
