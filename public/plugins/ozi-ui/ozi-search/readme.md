
# oziSearch

### Identificação
- **Nome:** `oziSearch`
- **Versão:** `1.5.0`
- **Data:** `2026-04-07`



### Descrição
`oziSearch` é um plugin de busca e filtragem em tempo real para interfaces web, desenvolvido para localizar, destacar e organizar elementos no DOM a partir da digitação do usuário. Ele permite pesquisar itens por seletor configurável, ocultar ou exibir resultados dinamicamente, destacar termos encontrados e atualizar automaticamente grupos e menus relacionados conforme o resultado da busca.

O plugin foi projetado para funcionar de forma flexível em estruturas simples ou hierárquicas, oferecendo suporte a pesquisa por múltiplas palavras, controle de quantidade mínima de caracteres, modo somente highlight sem filtragem visual e integração com blocos de menu colapsáveis. Sua lógica preserva o estado original dos elementos, restaurando visibilidade, conteúdo e estrutura quando a busca é limpa ou não atende aos critérios mínimos.

Com isso, o `oziSearch` é indicado para campos de pesquisa em listas, menus laterais, catálogos, painéis administrativos e interfaces com grande volume de elementos visuais, priorizando estabilidade, compatibilidade com jQuery e boa experiência de uso.


### [1] ALVO DA BUSCA

* `data-ozi-search` → define os elementos que serão pesquisados e filtrados com base no texto digitado

* `data-ozi-search-group` → define grupos ou blocos relacionados aos itens pesquisados, permitindo ocultar ou exibir o grupo conforme existam itens visíveis dentro dele

* `data-ozi-search-menu` → define a estrutura de menu relacionada à busca, permitindo controlar blocos de menu e classes de colapso no formato `seletor,classeCollapse`

---

### [2] COMPORTAMENTO DA BUSCA

* `data-ozi-search-min` → define a quantidade mínima de caracteres para que a busca comece a ser aplicada

* `data-ozi-search-words` → ativa a busca por múltiplos termos separados por espaço, tratando cada palavra individualmente

* `data-ozi-search-multi` → mantém compatibilidade com a configuração antiga de múltiplos termos, funcionando como alias de `data-ozi-search-words`

* `data-ozi-search-no-filter` → mantém os itens visíveis sem ocultação, aplicando apenas destaque visual nos termos encontrados

---

### [3] DESTAQUE / HIGHLIGHT

* `data-ozi-search-highlight` → ativa ou configura o destaque visual dos termos encontrados durante a busca

    * quando definido como `true`, `1` ou vazio → usa a classe padrão `bg-dark text-white`
    * quando definido como `false` ou `0` → desativa o highlight
    * quando recebe um texto → usa esse valor como classe CSS personalizada para o destaque

---

### [4] RESOLUÇÃO DE SELETORES

* `data-ozi-search` → aceita seletor CSS direto ou nome simples, que também pode ser resolvido como classe automaticamente

* `data-ozi-search-group` → aceita seletor CSS ou nome simples para localizar os grupos relacionados

* `data-ozi-search-menu` → aceita um seletor de menu e, opcionalmente, a classe responsável pelo colapso visual da estrutura

---

### [5] ESTRUTURA DO MENU

* `data-ozi-search-menu` → pode ser configurado apenas com o seletor do menu ou com seletor e classe de colapso

#### exemplos:
* `data-ozi-search-menu="menu-item"` → usa `menu-item` como seletor e `hidden` como classe de colapso padrão
* `data-ozi-search-menu=".menu-item,hidden"` → usa `.menu-item` como seletor e `hidden` como classe de colapso
* `data-ozi-search-menu="#menuLateral,collapse"` → usa `#menuLateral` como seletor e `collapse` como classe de colapso

---

### [6] RESUMO PRÁTICO

* `data-ozi-search` → define onde a busca será aplicada
* `data-ozi-search-group` → controla grupos de itens relacionados
* `data-ozi-search-menu` → controla menus hierárquicos e blocos colapsáveis
* `data-ozi-search-min` → define mínimo de caracteres para busca
* `data-ozi-search-words` → ativa busca por várias palavras
* `data-ozi-search-multi` → compatibilidade com configuração antiga
* `data-ozi-search-no-filter` → destaca sem ocultar
* `data-ozi-search-highlight` → ativa ou personaliza o highlight


