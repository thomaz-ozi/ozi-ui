# ozi-editor.js

**Versão:** 4.9.0 · **Camada:** `components/ozi-editor/`

Editor rich text sobre `<textarea>`, nos tipos **HTML** e **Markdown** (via `ozi-editor-md`).
Toolbar declarativa e responsiva, tabela, imagem com alinhamento, indentação de lista, popovers de
link/cor/imagem.

⚠️ **A chave vai em `data-ozi-editor-html` ou `data-ozi-editor-md`** — `data-ozi-editor` (sem
sufixo) é da v1 e **não** inicializa o componente desde a 3.1.0.

⚠️ **Dependências:** declara `deps:['validate','editor-sanitize']`. Sem o
`ozi-editor-sanitize` o editor **lança erro** na primeira sanitização — sanitização é código de
segurança, então falha visível é proposital. No Laravel, o `@oziScripts` resolve isso sozinho
desde a 2.6.0.

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
