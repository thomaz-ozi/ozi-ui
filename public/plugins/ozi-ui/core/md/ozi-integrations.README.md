# ozi-integrations.js

**Versão:** 1.0.1 · **Camada:** `core/`

Registry entre plugins OZI e adapters de framework — cuida da comunicação bidirecional
plugin ↔ framework (model binding, set-options, eventos DOM). O re-init pós-render é papel do
`ozi-hooks.js`, não deste.

---

## Documentação

A referência completa — atributos `data-ozi-*`, eventos, API pública e exemplos — está em:

**[oziui.com/docs](https://oziui.com/pt-br/docs/introduction)**

O changelog de cada versão acompanha a documentação do plugin no site.

---

> **Por que este arquivo é só um ponteiro.**
> Ele já foi uma cópia da referência completa, e virou uma **terceira fonte de verdade** ao lado
> da documentação oficial e do site — sem nada que forçasse sua atualização a cada release.
> Em 2026-09 a conferência contra o código encontrou 10 dos 12 READMEs distribuídos com a versão
> defasada, exemplos em jQuery (removido na v2) e atributos que o componente não lê mais.
> Um exemplo errado ensina o erro ativamente, o que é pior que exemplo nenhum — daí a troca por
> um ponteiro curto, que não tem como envelhecer sozinho.
