
# oziSelect

### Identificação
- **Nome:** `oziSelect`
- **Versão:** `4.1.2`
- **Data:** `2026-04-09`


### Descrição
`oziSelect` é um plugin de seleção customizada para interfaces web, desenvolvido para substituir selects tradicionais por uma experiência mais rica, visual e flexível. Ele permite trabalhar com seleção simples ou múltipla, exibir itens com imagem, texto ou HTML customizado, organizar opções por grupos e integrar a seleção diretamente com formulários por meio de campos hidden gerados automaticamente.

O plugin também oferece suporte a busca local e busca remota, possibilitando filtrar opções existentes no navegador ou consultar novos resultados no servidor conforme o usuário digita. Sua estrutura foi pensada para manter compatibilidade com formulários HTML, permitir validação de campos obrigatórios, controlar estados como desabilitado e requerido, além de disponibilizar uma API pública para manipulação via JavaScript.

Com isso, o `oziSelect` é indicado para cenários em que um select comum não oferece flexibilidade suficiente, como listas com imagens, múltiplas escolhas com tags visuais, agrupamento de opções, preenchimento dinâmico via AJAX e interfaces que exigem melhor usabilidade e controle programático.


### [1] IDENTIFICAÇÃO

* `data-ozi-select` → define a chave única da instância do componente e vincula o select ao JSON de opções
  correspondente

---

### [2] DADOS JSON - CAMPOS DAS OPÇÕES 

ESTRUTURA DE CADA OPTION

* `value`   → valor interno da opção - "OBRIGATÓRIO"

* `label` →  texto padrão da opção - "OBRIGATÓRIO"

* ` labelHtml` →  HTML exibido na lista

* `valueHtml` →  HTML exibido no preview do item selecionado

* `tagHtml` →  HTML exibido na tag do modo múltiplo

* `image` →  imagem opcional da opção

* `oziGroup` →   grupo visual da opção

* `selected` → true/false  seleção inicial

* `extra` →   dados livres adicionais
#### Exemplo:
```html
<div  data-ozi-select="estados"></div>
<script type="application/json" data-ozi-select-options="estados">
    [
        {
            "value": "AC",
            "label": "Acre"
        },
        {
            "value": "AL",
            "label": "Alagoas"
        },
        {
            "value": "AP",
            "label": "Amapá"
        }
</script>
```


---
### [3] MODO DE SELEÇÃO

* `data-ozi-select-multiple` → ativa o modo de seleção múltipla

* `data-ozi-select-multiple-group` → ativa o modo de seleção múltipla com controle por grupo, permitindo selecionar ou
  remover itens agrupados

---

### [4] PLACEHOLDERS E VISUAL

* `data-ozi-select-value-placeholder` → define o texto exibido no campo quando nenhum item estiver selecionado

* `data-ozi-select-search-placeholder` → define o texto placeholder do campo de pesquisa interno

* `data-ozi-select-list` → define a altura máxima visual da lista de opções

* `data-ozi-select-image-dimension` → define as dimensões das imagens exibidas nas opções, preview e tags, no formato
  largura,altura

---

### [5] SUBMISSÃO DE DADOS

* `data-ozi-select-submit-name` → define o nome base dos inputs hidden gerados para envio no formulário

* `data-ozi-select-submit-fields` → define quais campos do item selecionado serão enviados e permite mapear origem e
  destino no formato `origem:destino`

---

### [6] ESTADO E VALIDAÇÃO

* `data-ozi-select-disabled` → define o componente como desabilitado, bloqueando interação e envio dos campos hidden

* `data-ozi-select-required` → define o componente como obrigatório para validação em formulário

* `data-ozi-select-required-message` → define a mensagem exibida quando a validação obrigatória falhar

---

### [7] BUSCA REMOTA / INTEGRAÇÃO

* `data-ozi-select-zld-url` → define a URL usada para buscar opções remotamente

* `data-ozi-select-zld-method` → define o método da requisição remota: `GET` ou `POST`

* `data-ozi-select-zld-param` → define o nome do parâmetro enviado com o texto digitado na pesquisa

* `data-ozi-select-zld-item-name` → define parâmetros extras enviados na busca remota, podendo usar nomes de campos do
  formulário ou pares fixos no formato `chave:valor`

* `data-ozi-select-zld-min` → define a quantidade mínima de caracteres para disparar a busca remota

* `data-ozi-select-zld-delay` → define o tempo de espera em milissegundos antes de executar a busca remota

* `data-ozi-select-zld-log` → ativa logs de depuração da busca remota no console