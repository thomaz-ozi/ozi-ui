Claro. Segue a documentação do `oziEditor 1.1.0` no mesmo estilo que você vem usando:

---

# oziEditor

## Identificação

* **Nome:** `oziEditor`
* **Versão:** `1.1.0`
* **Data:** `2026-04-17`

### Estrutura da função

O `oziEditor` é um editor visual leve ativado sobre um `textarea`, com foco em:

* integração simples com formulários
* sincronização natural com backend
* base estável para Livewire
* conjunto controlado de ferramentas
* suporte visual a tema claro/escuro
* personalização rápida com `uiColor`

O `textarea` continua sendo o campo real de envio. O plugin apenas cria uma interface visual sobre ele.

---

## Atributos

### Obrigatório

* `data-ozi-editor="chave"`
  Define a chave do componente.

### Opcionais

* `data-ozi-editor-tools="bold,italic,underline,ul,ol,code,table,clear,left,center,right"`
  Define quais ferramentas estarão disponíveis na toolbar.

* `data-ozi-editor-lang="pt-br"`
  Define o idioma básico da interface.
  Na versão 1.1.0, o idioma é usado apenas para textos simples da UI.

* `data-ozi-editor-uicolor="#9AB8F3"`
  Define a cor principal do editor, usada em foco e botões ativos.

* `data-ozi-editor-placeholder="Digite aqui..."`
  Define o placeholder visual da área editável.

* `data-ozi-editor-height="220px"`
  Define a altura mínima da área de edição.

* `data-ozi-editor-disabled`
  Desabilita o editor.

* `data-ozi-editor-required`
  Marca o editor como obrigatório.

* `data-ozi-editor-required-message="Campo obrigatório."`
  Define a mensagem de validação.

---

## Estrutura base

```html id="d9j9ij"
<textarea
    name="descricao"
    data-ozi-editor="descricao"></textarea>
```

---

## Estrutura completa

```html id="hg5q2n"
<textarea
    name="descricao"
    data-ozi-editor="descricao"
    data-ozi-editor-tools="bold,italic,underline,ul,ol,code,table,clear,left,center,right"
    data-ozi-editor-lang="pt-br"
    data-ozi-editor-uicolor="#9AB8F3"
    data-ozi-editor-placeholder="Digite aqui..."
    data-ozi-editor-height="220px"
    data-ozi-editor-required
    data-ozi-editor-required-message="Descrição é obrigatória."></textarea>
```

---

## Ferramentas da versão 1.1.0

* `bold` → negrito
* `italic` → itálico
* `underline` → sublinhado
* `ul` → lista não ordenada
* `ol` → lista ordenada
* `code` → bloco de código
* `table` → tabela simples
* `clear` → limpar formatação
* `left` → alinhar à esquerda
* `center` → centralizar
* `right` → alinhar à direita

### Exemplo

```html id="9w2a9j"
data-ozi-editor-tools="bold,italic,underline,ul,ol,code,table,clear,left,center,right"
```

---

## O que o plugin faz

1. O plugin encontra o `textarea`
2. Cria a interface visual do editor
3. O usuário edita no modo visual
4. O conteúdo HTML é sanitizado
5. O valor final é sincronizado com o `textarea`
6. O formulário envia normalmente o valor do `textarea`

---

## Integração com backend

O `textarea` continua sendo o valor real enviado ao backend.

### Exemplo de resultado

Se o usuário editar o conteúdo visualmente, o `textarea` pode receber algo assim:

```html id="u3y44w"
<p>Texto normal</p>
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
<pre><code>const x = 10;</code></pre>
```

Ou seja, o backend trabalha com o campo normalmente, sem precisar conhecer a UI interna do editor.

---

## Integração com Livewire

A proposta do `oziEditor` é ser mais estável em cenários com Livewire porque o valor oficial continua no `textarea`.

A recomendação é manter a área visual controlada pelo JS e deixar o `textarea` como origem real do valor.

Isso reduz conflito com re-render e facilita a sincronização do campo.

---

## HTML permitido

Na versão 1.1.0, o editor trabalha com um conjunto controlado de tags:

```html id="3xi7xq"
p, br, strong, em, u, ul, ol, li, pre, code, table, thead, tbody, tr, td, th
```

Isso ajuda a manter a estrutura estável e previsível.

---

## Comportamento de colagem

Ao colar conteúdo no editor:

* HTML externo é sanitizado
* tags fora da lista permitida são removidas
* o conteúdo é normalizado para o conjunto permitido
* texto simples é convertido de forma segura

---

## Validação

Se o editor estiver marcado com:

```html id="fsn7lu"
data-ozi-editor-required
```

o plugin valida se existe conteúdo real no `textarea`.

Se estiver vazio:

* marca a área visual como inválida
* exibe a mensagem configurada em `data-ozi-editor-required-message`

---

## Tema e personalização visual

O `oziEditor` suporta personalização por `uiColor` e também tema claro/escuro via CSS variables.

### Exemplo

```html id="gchhlt"
data-ozi-editor-uicolor="#9AB8F3"
```

Essa cor é usada para:

* foco da área editável
* borda do botão ativo
* destaque visual do editor

---

## Métodos públicos

### Inicializar

```javascript id="ibxb0r"
OziEditor.init()
```

### Obter instância

```javascript id="gy4uv4"
OziEditor.get('descricao')
```

### Obter valor

```javascript id="rw14xh"
OziEditor.value('descricao')
```

### Definir valor

```javascript id="u4jqli"
OziEditor.value('descricao', '<p>Texto inicial</p>')
```

### Destruir

```javascript id="ndq8am"
OziEditor.destroy('descricao')
```

### Recarregar

```javascript id="8dmx4n"
OziEditor.reload('descricao')
```

---

## Uso com conteúdo carregado por fetch

Quando o HTML do editor entrar depois no DOM, use:

```javascript id="wecblq"
oziEditorInitFetched($('#destino'));
```

Isso força a inicialização do `oziEditor` no conteúdo recém-renderizado.

---

## Resultado final

O `oziEditor` é um editor leve, visual e controlado, pensado para:

* funcionar bem com formulários reais
* manter o backend simples
* oferecer ferramentas úteis sem exagero
* evitar a complexidade de editores maiores
* servir como base evolutiva do ecossistema OZI

---

## Resumo da API oficial

* `data-ozi-editor`
* `data-ozi-editor-tools`
* `data-ozi-editor-lang`
* `data-ozi-editor-uicolor`
* `data-ozi-editor-placeholder`
* `data-ozi-editor-height`
* `data-ozi-editor-disabled`
* `data-ozi-editor-required`
* `data-ozi-editor-required-message`

---

Se quiser, no próximo passo eu monto esse mesmo conteúdo em formato de **cabeçalho oficial para colar no topo do arquivo JS**.
