# oziAutocomplete

### Identificação
- **Nome:** `oziAutocomplete`
- **Versão:** `2.0.0`
- **Data:** `2026-04-25`

---

### Descrição

`oziAutocomplete` é um plugin de campo de texto com sugestões automáticas para interfaces web. Transforma um `<input type="text">` em um campo inteligente com dropdown de sugestões, normalizando acentos e variações de escrita durante a filtragem, e sincronizando automaticamente o valor selecionado em um `<input hidden>` para envio ao backend.

Suporta dois modos de operação: **local** — filtrando opções definidas via JSON estático — e **remoto** — consultando o servidor conforme o usuário digita, com debounce, cancelamento automático de requisições concorrentes e integração nativa com `oziLoadData` via `zldActions`. Os dois modos podem coexistir: enquanto o usuário digita abaixo do mínimo configurado, as opções locais são exibidas; acima do mínimo, o servidor é consultado.

---

### [1] CAMPO

| Atributo | Descrição |
|----------|-----------|
| `data-ozi-autocomplete` | **Obrigatório** — chave do campo, vincula ao JSON de opções e define o `name` do hidden gerado |
| `data-ozi-autocomplete-hidden-name` | Nome alternativo para o `<input hidden>` — padrão: mesmo valor de `data-ozi-autocomplete` |

---

### [2] MENSAGENS

| Atributo | Padrão | Descrição |
|----------|--------|-----------|
| `data-ozi-autocomplete-msg-empty` | `Nenhum resultado encontrado` | Exibida quando nenhuma opção corresponde |
| `data-ozi-autocomplete-msg-search` | `Pesquisando...` | Exibida durante carregamento remoto |

---

### [3] OPÇÕES LOCAIS

As opções locais são definidas em um `<script type="application/json">` identificado pela mesma chave via `data-ozi-autocomplete-options`. Cada item deve conter `value` e `label`.

```html