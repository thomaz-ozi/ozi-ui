# oziAutocomplete

### Identificação
- **Nome:** `oziAutocomplete`
- **Versão:** `2.0.1`
- **Data:** `2026-04-25`

---

### Descrição

`oziAutocomplete` é um plugin de campo de texto com sugestões automáticas para interfaces web. Transforma um `<input type="text">` em um campo inteligente com dropdown de sugestões, normalizando acentos e variações de escrita durante a filtragem, e sincronizando automaticamente o valor selecionado em um `<input hidden>` para envio ao backend.

Suporta dois modos de operação: **local** — filtrando opções definidas via JSON estático — e **remoto** — consultando o servidor conforme o usuário digita, com debounce, cancelamento automático de requisições concorrentes e integração nativa com `oziLoadData` via `zldActions`. Os dois modos podem coexistir: enquanto o usuário digita abaixo do mínimo configurado, as opções locais são exibidas; acima do mínimo, o servidor é consultado.

---

### Recursos

- Modo local — filtra opções JSON já carregadas no navegador
- Modo remoto — consulta o servidor com debounce configurável
- Modo combinado — local abaixo do mínimo, remoto acima
- Normalização — ignora acentos e variações de escrita na filtragem
- Hidden automático — gera `<input hidden>` sincronizado para envio
- Cancelamento automático — requisições concorrentes são canceladas via `AbortController`
- MutationObserver — detecta e inicializa novos elementos no DOM
- Evento `ozi:change` — notifica seleção via jQuery e DOM nativo

---

### [1] CAMPO

| Atributo | Obrigatório | Descrição |
|----------|-------------|-----------|
| `data-ozi-autocomplete` | ✔ | Chave do campo — vincula ao JSON e define o `name` do hidden |
| `data-ozi-autocomplete-hidden-name` | — | Nome alternativo para o `<input hidden>` — padrão: mesma chave |

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
<script type="application/json" data-ozi-autocomplete-options="estado">
[
    { "value": "PR", "label": "Paraná" },
    { "value": "SC", "label": "Santa Catarina" },
    { "value": "SP", "label": "São Paulo" }
]
</script>
```

---

### [4] BUSCA REMOTA — `data-ozi-autocomplete-zld-*`

Quando `data-ozi-autocomplete-zld-url` está presente, o plugin consulta o servidor após o usuário digitar o mínimo de caracteres configurado. Abaixo do mínimo, as opções locais são exibidas. A resposta deve ser um array JSON `[{value, label}]` ou `{options: [{value, label}]}`.

| Atributo | Padrão | Descrição |
|----------|--------|-----------|
| `data-ozi-autocomplete-zld-url` | — | URL da busca remota |
| `data-ozi-autocomplete-zld-method` | `POST` | Método da requisição: `GET` ou `POST` |
| `data-ozi-autocomplete-zld-param` | `search` | Nome do parâmetro enviado com o texto digitado |
| `data-ozi-autocomplete-zld-min` | `1` | Mínimo de caracteres para disparar a busca |
| `data-ozi-autocomplete-zld-delay` | `300` | Debounce em milissegundos |
| `data-ozi-autocomplete-zld-log` | `false` | Ativa logs de depuração no console |

---

### [5] EXEMPLOS

#### Mínimo obrigatório
```html
<input
    type="text"
    class="form-control"
    data-ozi-autocomplete="estado"
    placeholder="Digite um estado...">

<script type="application/json" data-ozi-autocomplete-options="estado">
[
    { "value": "PR", "label": "Paraná" },
    { "value": "SC", "label": "Santa Catarina" },
    { "value": "SP", "label": "São Paulo" }
]
</script>
```

#### Completo — local + remoto
```html
<input
    type="text"
    class="form-control"
    data-ozi-autocomplete="produto"
    data-ozi-autocomplete-hidden-name="produto_id"
    data-ozi-autocomplete-msg-empty="Nenhum produto encontrado"
    data-ozi-autocomplete-msg-search="Buscando produtos..."
    data-ozi-autocomplete-zld-url="/api/produtos/buscar"
    data-ozi-autocomplete-zld-method="POST"
    data-ozi-autocomplete-zld-param="q"
    data-ozi-autocomplete-zld-min="2"
    data-ozi-autocomplete-zld-delay="400"
    placeholder="Digite um produto...">

<script type="application/json" data-ozi-autocomplete-options="produto">
[
    { "value": "1", "label": "Notebook Dell" },
    { "value": "2", "label": "Notebook Lenovo" }
]
</script>
```

#### Resposta esperada do backend
```json
[
    { "value": "1", "label": "Notebook Dell" },
    { "value": "2", "label": "Notebook Lenovo" }
]
```
ou
```json
{
    "options": [
        { "value": "1", "label": "Notebook Dell" }
    ]
}
```

---

### [6] API PÚBLICA

| Método | Descrição |
|--------|-----------|
| `OziAutocomplete.init(selector?)` | Inicializa instâncias |
| `OziAutocomplete.get('chave')` | Retorna a instância |
| `OziAutocomplete.value('chave')` | Retorna o `value` selecionado |
| `OziAutocomplete.value('chave', '2')` | Define o `value` programaticamente |
| `OziAutocomplete.item('chave')` | Retorna o objeto `{ value, label }` selecionado |
| `OziAutocomplete.clear('chave')` | Limpa a seleção |
| `OziAutocomplete.reload('chave')` | Reinicializa a instância |
| `OziAutocomplete.destroy('chave')` | Remove a instância e os elementos gerados |

#### Conteúdo dinâmico
```js
oziAutocompleteInitFetched($('#destino'));
// ou
$(document).trigger('oziAutocomplete:initFetched', [$('#destino')]);
```

---

### [7] EVENTO `ozi:change`

Disparado ao selecionar uma opção — por clique, teclado ou `setValue`.

```js
// jQuery
$('[data-ozi-autocomplete="estado"]').on('ozi:change', function (e, item, instance, detail) {
    console.log(detail.value);  // value selecionado
    console.log(detail.item);   // { value, label }
});

// DOM nativo
document.querySelector('[data-ozi-autocomplete="estado"]')
    .addEventListener('ozi:change', function (e) {
        console.log(e.detail.value);
        console.log(e.detail.item);
    });
```