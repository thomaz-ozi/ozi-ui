# oziToggle

## Identificação

- **Nome:** `oziToggle`
- **Versão:** `2.3.0`
- **Data:** `2026-04-12`

## Descrição

`oziToggle` é um plugin jQuery responsável por alternar a visibilidade de conteúdos pertencentes ao mesmo grupo, a
partir de um único elemento de acionamento.

Na versão atual, o comportamento é baseado em inversão simples de estado: ao acionar o trigger, o conteúdo visível é
ocultado e o conteúdo oculto é exibido.

## Atributos

- `data-ozi-toggle-trigger`     → Define o elemento acionador do grupo. Quando clicado, executa a alternância dos
  conteúdos vinculados ao mesmo identificador.
- `data-ozi-toggle-content`     → Define um conteúdo participante do grupo. Todo elemento com o mesmo identificador
  passa a responder ao trigger correspondente.
- `data-ozi-toggle-show`        → Define o elemento visual que representa o estado de exibir ou abrir a alternância.
  Normalmente aparece quando o próximo clique irá mostrar o conteúdo oculto.
- `data-ozi-toggle-hide`        → Define o elemento visual que representa o estado de ocultar ou fechar a alternância. Normalmente aparece quando o próximo clique irá esconder o conteúdo visível.
- `data-ozi-toggle-icon`        → Define um elemento visual opcional, geralmente um ícone, que pode receber efeito de transição próprio durante a troca entre os estados do toggle.
- `data-ozi-toggle-options`     → Define configurações locais de comportamento para um conteúdo específico, sem afetar os demais elementos do mesmo grupo. É usado para customizações pontuais, como tempo de animação.

## Regras

- Cada grupo deve possuir um único trigger
- Cada grupo deve possuir dois conteúdos
- Os indicadores visuais de mostrar e ocultar acompanham a alternância do grupo
- O clique no trigger executa a inversão entre os conteúdos vinculados ao mesmo identificador

## Fluxo de ação

Ao clicar no trigger:

1. o conteúdo atualmente visível é ocultado
2. o conteúdo atualmente oculto é exibido
3. os indicadores visuais são alternados

````html
<div data-ozi-collapse-trigger="idConexao">
    <span data-ozi-collapse-open>+ Abrir</span>
    <span data-ozi-collapse-close style="display:none;">- Fechar</span>
</div>

<div data-ozi-collapse-content="idConexao" style="display:block;">
    ConteúdoA
</div>

<div data-ozi-collapse-content="idConexao" style="display:none;">
    ConteúdoB
</div>

```