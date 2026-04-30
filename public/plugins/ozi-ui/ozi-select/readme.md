# oziSelect

### Identificação
- **Nome:** `oziSelect`
- **Versão:** `4.3.1`
- **Data:** `2026-04-25`


### Descrição
`oziSelect` é um plugin de seleção customizada para interfaces web, desenvolvido para substituir selects tradicionais por uma experiência mais rica, visual e flexível. Ele permite trabalhar com seleção simples ou múltipla, exibir itens com imagem, texto ou HTML customizado, organizar opções por grupos e integrar a seleção diretamente com formulários por meio de campos hidden gerados automaticamente a partir de qualquer campo presente no JSON de opções.

O plugin também oferece suporte a busca local e busca remota, possibilitando filtrar opções existentes no navegador ou consultar novos resultados no servidor conforme o usuário digita. Sua estrutura foi pensada para manter compatibilidade com formulários HTML, permitir validação de campos obrigatórios, controlar estados como desabilitado e requerido, além de disponibilizar uma API pública para manipulação via JavaScript.

Com isso, o `oziSelect` é indicado para cenários em que um select comum não oferece flexibilidade suficiente, como listas com imagens, múltiplas escolhas com tags visuais, agrupamento de opções, preenchimento dinâmico via AJAX e interfaces que exigem melhor usabilidade e controle programático.


---

### [1] IDENTIFICAÇÃO

* `data-ozi-select` → define a chave única da instância do componente e vincula o select ao JSON de opções correspondente

---

### [2] DADOS JSON — CAMPOS DAS OPÇÕES

Estrutura de cada option. Qualquer campo presente no JSON gera automaticamente um input hidden no submit, com o padrão `{submitName}_{campo}`.

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `value` | sim | valor interno da opção — gera `{name}` |
| `label` | sim | texto ou HTML exibido na lista, no preview e nas tags |
| `subLabel` | não | texto ou HTML secundário exibido abaixo do label na lista e no preview |
| `image` | não | imagem opcional exibida na opção, preview e tag |
| `group` | não | grupo visual da opção |
| `selected` | não | `true/false` — define seleção inicial (campo interno, não gera hidden) |
| `optionHtml` | não | HTML completo da opção — substitui o layout padrão na lista (campo interno, não gera hidden) |
| `optionClass` | não | classe CSS extra aplicada ao elemento da opção (campo interno, não gera hidden) |

Campos adicionais livres (`carro`, `moto`, `sku`, etc.) são aceitos e geram hidden inputs automaticamente.

#### Exemplo:
```html
<div data-ozi-select="produtos"></div>
<script type="application/json" data-ozi-select-options="produtos">
[
    {
        "value": "1",
        "label": "Produto A",
        "subLabel": "Categoria X",
        "image": "/img/produto-a.png",
        "group": "Eletrônicos",
        "sku": "ABC123",
        "price": "99.90"
    },
    {
        "value": "2",
        "label": "Produto B",
        "subLabel": "Categoria Y",
        "group": "Eletrônicos",
        "sku": "DEF456",
        "price": "149.90"
    }
]
</script>
```

---

### [3] MODO DE SELEÇÃO

* `data-ozi-select-multiple` → ativa o modo de seleção múltipla

* `data-ozi-select-multiple-group` → ativa o modo de seleção múltipla com controle por grupo, permitindo selecionar ou remover todos os itens de um grupo de uma vez

---

### [4] PLACEHOLDERS E VISUAL

* `data-ozi-select-as` → mapeia campos do JSON externo para os nomes canônicos do plugin (`value`, `label`, `image`, etc.), permitindo consumir qualquer API sem transformar os dados no back-end

  * Formato: `"canônico=alias, canônico=alias"`
  * Exemplo: `data-ozi-select-as="value=uf, label=estado, group=regiao"`

* `data-ozi-select-value-placeholder` → texto exibido no campo quando nenhum item estiver selecionado

* `data-ozi-select-value-icon` → ícone exibido à esquerda do valor no control, sempre visível (ex: `bi bi-cart`)

* `data-ozi-select-search-placeholder` → texto placeholder do campo de pesquisa interno

* `data-ozi-select-search-icon` → ícone exibido à esquerda do campo de pesquisa (ex: `bi bi-search`)

* `data-ozi-select-list` → altura máxima visual da lista de opções

* `data-ozi-select-image-dimension` → dimensões das imagens nas opções, preview e tags, no formato `largura,altura` (ex: `32px,32px`)



#### Exemplo:
```html
<div
    data-ozi-select="estados"
    data-ozi-select-value-placeholder="Selecione um estado..."
    data-ozi-select-value-icon="bi bi-geo-alt"
    data-ozi-select-search-placeholder="Pesquisar..."
    data-ozi-select-search-icon="bi bi-search">
</div>
```

---

### [5] SUBMISSÃO DE DADOS

* `data-ozi-select-submit-name` → nome base dos inputs hidden gerados para envio. Se não informado, usa a chave do `data-ozi-select`

* `data-ozi-select-submit-fields` → modo legado — mapeia campos específicos do item selecionado no formato `origem:destino`. Ativa o `submitMode: legacy`

---

### [6] ESTADO E VALIDAÇÃO

* `data-ozi-select-disabled` → desabilita o componente, bloqueando interação e envio dos campos hidden

* `data-ozi-select-required` → define o componente como obrigatório para validação em formulário

* `data-ozi-select-required-message` → mensagem exibida quando a validação obrigatória falhar

---

### [7] BUSCA REMOTA / INTEGRAÇÃO ZLD

* `data-ozi-select-zld-url` → URL usada para buscar opções remotamente

* `data-ozi-select-zld-method` → método da requisição remota: `GET` ou `POST` (padrão: `POST`)

* `data-ozi-select-zld-param` → nome do parâmetro enviado com o texto digitado na pesquisa (padrão: `search`)

* `data-ozi-select-zld-item-name` → parâmetros extras enviados na busca remota — aceita nomes de campos do formulário ou pares fixos no formato `chave:valor`

* `data-ozi-select-zld-min` → quantidade mínima de caracteres para disparar a busca remota (padrão: `1`)

* `data-ozi-select-zld-delay` → tempo de espera em milissegundos antes de executar a busca remota (padrão: `300`)

* `data-ozi-select-zld-log` → ativa logs de depuração da busca remota no console

#### Exemplo de busca remota:
```html
<div
    data-ozi-select="clientes"
    data-ozi-select-zld-url="/api/clientes/buscar"
    data-ozi-select-zld-method="POST"
    data-ozi-select-zld-param="q"
    data-ozi-select-zld-min="2"
    data-ozi-select-zld-delay="400">
</div>
```

---

### [8] API PÚBLICA

```js
OziSelect.init(selector?)         // inicializa instâncias
OziSelect.get(selectorOrKey)      // retorna instância
OziSelect.value(key, newValue?)   // getter/setter do valor
OziSelect.items(key)              // retorna array de itens selecionados
OziSelect.clear(key)              // limpa seleção
OziSelect.open(key)               // abre o dropdown
OziSelect.close(key)              // fecha o dropdown
OziSelect.enable(key)             // habilita o componente
OziSelect.disable(key)            // desabilita o componente
OziSelect.required(key, state?)   // getter/setter do estado obrigatório
OziSelect.reload(key)             // reconstrói a instância
OziSelect.destroy(key)            // destrói a instância
```

#### Eventos:
```js
// disparado ao selecionar ou remover um item
$('[data-ozi-select="estados"]').on('ozi:change', function(e, items, instance, detail) {
    console.log(detail.value);  // valor selecionado
    console.log(detail.items);  // array de itens selecionados
});
```