
# oziAutocomplete

### Identificação
- **Nome:** `oziAutocomplete`
- **Versão:** `1.0.0`
- **Data:** `2026-04-18`

---

### Descrição

`oziAutocomplete` é um plugin de campo de texto com sugestões automáticas para interfaces web, desenvolvido para filtrar e selecionar opções a partir da digitação do usuário. Ele transforma um `<input type="text">` em um campo inteligente com dropdown de sugestões, normalizando acentos e variações de escrita durante a filtragem, e sincronizando automaticamente o valor selecionado em um `<input hidden>` para envio ao backend.

O plugin foi projetado para funcionar com opções definidas localmente via `<script type="application/json">`, suportando navegação por teclado, seleção por clique e validação de correspondência exata ao sair do campo. Sua lógica preserva e restaura o estado de seleção inicial, detecta novos elementos no DOM via `MutationObserver` e expõe uma API pública para leitura e controle programático do valor selecionado.

    Com isso, o `oziAutocomplete` é indicado para campos de formulário com listas predefinidas de opções, como estados, cidades, categorias, produtos e qualquer conjunto de dados que se beneficie de filtragem por digitação livre, priorizando compatibilidade com jQuery, integração com o ecossistema `ozi-ui` e boa experiência de uso.

    ---

    ### [1] CAMPO

    * `data-ozi-autocomplete` → **obrigatório** — define o nome/chave do campo; liga o `<input>` ao bloco de opções JSON e determina o `name` do `<input hidden>` gerado automaticamente

    * `data-ozi-autocomplete-hidden-name` → define um nome alternativo para o `<input hidden>` gerado; útil quando o backend espera um nome diferente da chave do campo — padrão: mesmo valor de `data-ozi-autocomplete`

    ---

    ### [2] MENSAGENS

    * `data-ozi-autocomplete-msg-empty` → mensagem exibida no dropdown quando nenhuma opção corresponde ao texto digitado — padrão: `"Nenhum resultado encontrado"`

    * `data-ozi-autocomplete-msg-search` → mensagem exibida no dropdown durante estado de carregamento — padrão: `"Pesquisando..."`

    ---

    ### [3] OPÇÕES

    As opções são definidas em um `<script type="application/json">` separado do `<input>`, identificado pelo mesmo nome/chave via `data-ozi-autocomplete-options`. Cada item deve conter os campos `value` e `label`.

    ```html
    <script type="application/json" data-ozi-autocomplete-options="chave">
    [
    { "value": "1", "label": "Opção Um" },
    { "value": "2", "label": "Opção Dois" }
    ]
</script>
```

---

### [4] API PÚBLICA

```javascript
OziAutocomplete.init(selector)        // inicializa o plugin nos elementos encontrados
OziAutocomplete.get('chave')          // retorna a instância pelo nome/chave
OziAutocomplete.value('chave')        // retorna o value selecionado
OziAutocomplete.value('chave', '2')   // define o value programaticamente
OziAutocomplete.item('chave')         // retorna o objeto { value, label } selecionado
OziAutocomplete.clear('chave')        // limpa a seleção
OziAutocomplete.reload('chave')       // reinicializa a instância
OziAutocomplete.destroy('chave')      // remove a instância e os elementos gerados

oziAutocompleteInitFetched(root)      // reinicializa em conteúdo carregado dinamicamente (ex: via oziLoadData)
```

---

### [5] EVENTO

```javascript
// jQuery
$('[data-ozi-autocomplete="chave"]').on('ozi:change', function (e, item, instance, detail) {
console.log(detail.value); // value selecionado
console.log(detail.item);  // { value, label }
});

// Nativo
document.querySelector('[data-ozi-autocomplete="chave"]')
.addEventListener('ozi:change', function (e) {
console.log(e.detail.value);
console.log(e.detail.item);
});
```

---

### [6] EXEMPLO DE USO

```html
<!-- Mínimo obrigatório -->
<input type="text"
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

<!-- Com todos os atributos -->
<input type="text"
       class="form-control"
       data-ozi-autocomplete="produto"
       data-ozi-autocomplete-hidden-name="produto_id"
       data-ozi-autocomplete-msg-empty="Nenhum produto encontrado"
       data-ozi-autocomplete-msg-search="Buscando produtos..."
       placeholder="Digite um produto...">

<script type="application/json" data-ozi-autocomplete-options="produto">
    [
        { "value": "1", "label": "Notebook Dell" },
        { "value": "2", "label": "Notebook Lenovo" },
        { "value": "3", "label": "Monitor LG" }
    ]
</script>
```