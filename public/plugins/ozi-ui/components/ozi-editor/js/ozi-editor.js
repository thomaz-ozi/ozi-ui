/**
 * ------------------------------------------
 * ozi-editor
 * ------------------------------------------
 * Ver: 4.9.0
 * 2026-09-21
 *
 * Editor WYSIWYG (contenteditable) com toolbar declarativa, modos html/md,
 * dropdowns de heading/classes, source view, sanitizacao e validacao.
 * Instance-based (registry por key). Conversores MD via ozi-editor-md.js.
 * Sanitizador via modules/ozi-editor-sanitize.js (ver Fase 3, deps do ozi-conf).
 *
 * Dependencias: ozi.js (OZI.helpers, OZI.lang, OZI.hooks, OZI.modules.validate),
 *   OZI.modules.editorSanitize (window.OziEditorSanitize) — zero jQuery (contrato
 *   de camadas v2 §2). O motor (Selection/Range/execCommand/contentEditable)
 *   sempre foi nativo; a migracao trocou o encanamento de DOM/eventos.
 * Expoe: OZI.components.editor, window.OziEditor (compat)
 * Eventos: ozi:init, ozi:change, ozi:destroy (CustomEvent nativos, contrato v2)
 *
 * Changelog:
 *   - v4.9.0: [FEAT] `indent`/`outdent` — sublista por botao e por Tab/Shift+Tab.
 *       Ate aqui NAO havia como criar sublista: a tecla Tab nao era tratada
 *       (o foco saia do campo, comportamento padrao do browser), nao existia
 *       ferramenta de indentacao no TOOL_META, e o conversor MD nao sabia
 *       representar nivel. As tres camadas precisavam andar juntas — um
 *       botao sozinho produziria um <ul> aninhado que o `htmlToMd`
 *       descartaria em silencio.
 *       **Por que nao `execCommand('indent')` puro** (os dois medidos em
 *       probe antes de decidir): (1) dentro de lista, o Chromium produz
 *       markup INVALIDO — `<ul><li>um</li><ul><li>dois</li></ul></ul>`, com
 *       o `<ul>` aninhado como IRMAO do `<li>` em vez de filho dele. O
 *       `_listToMd` itera filhos diretos e ignora o que nao e `<li>`, entao
 *       o item indentado **sumia** na conversao pra MD (medido: vira
 *       `"- um"`, o "dois" desaparece) — mesma familia do bug do <thead> da
 *       4.8.0; (2) FORA de lista, `indent` vira
 *       `<blockquote style="margin-left:40px">` — e o sanitizador apaga o
 *       style, deixando uma CITACAO de verdade: a semantica do texto mudava
 *       sem o usuario pedir.
 *       **A solucao mantem o undo nativo:** `execCommand` primeiro (que
 *       entra na pilha) e `_normalizeNestedLists` logo depois, movendo o
 *       `<ul>`/`<ol>` solto pra dentro do `<li>` anterior. Medido em probe:
 *       um UNICO Ctrl+Z desfaz os dois e volta ao estado original — a
 *       normalizacao nao quebra a pilha, ao contrario do que a licao da
 *       4.8.0 (tabela via Range) fazia temer. Sem isso seria preciso pilha
 *       de undo propria, que e cara.
 *       **Decisoes de produto (via AskUserQuestion, antes de codar):**
 *       Tab so indenta DENTRO de lista — fora dela o Tab segue levando o
 *       foco pro proximo campo, senao quem navega por teclado ficaria preso
 *       no editor; e os botoes aparecem DESABILITADOS fora de lista (mesmo
 *       tratamento visual de ferramenta inativa), em vez de deixar virar
 *       citacao.
 *       `ozi-editor-md` 2.4.0 acompanha: `_listToMd` emite 2 espacos por
 *       nivel e `_parseList` reconhece a indentacao — sem os dois, a
 *       sublista nao sobrevive ao round-trip.
 *   - v4.8.0: [FEAT] Criacao e edicao de tabela. Ate aqui `table` era uma
 *       acao direta no dispatcher generico (`_runTool`), no mesmo nivel de
 *       `hr`: 5 linhas de `execCommand('insertHTML')` com uma tabela 2x2
 *       FIXA, sem UI, sem cabecalho e sem edicao depois de inserida. Era a
 *       unica ferramenta estrutural do editor que nunca ganhou interface —
 *       as Fases 1/2/3 cobriram strike/quote/hr/undo/redo, link/color/
 *       highlight/paste e image, e a tabela ficou para tras. O desenho ja
 *       existia: o mockup do designer (ozi-ui-designer/OZI-UI/demo/
 *       ozi-editor.html) traz o CSS do seletor em dois blocos comentados
 *       desde 2026-08-27, nunca implementados.
 *       `table` passa a ser popover, pelo MESMO caminho de link/color/
 *       highlight/image (`_buildPopoverButton`) — entra na linha de guarda
 *       do `_runTool` e no seletor delegado de abertura, e o `case 'table'`
 *       do switch sai. Um unico popover com DOIS paineis, alternados pelo
 *       `onOpen` conforme o caret: fora de tabela mostra o painel de
 *       INSERCAO (grade 10x8 com highlight de hover/teclado, label vivo
 *       "N x M celulas", checkbox de cabecalho, campos colunas/linhas e
 *       botao Inserir); com o caret dentro de um TD/TH mostra o painel de
 *       EDICAO (linha acima/abaixo, coluna antes/depois, remover linha/
 *       coluna/tabela). Reaproveita o precedente do popover de imagem, que
 *       ja reabria sobre um elemento existente — zero UI nova na toolbar.
 *       O painel de edicao e lista de TEXTO (padrao heading/classes), nao
 *       botoes com icone: evitou 7 SVGs novos para acoes que so fazem
 *       sentido lidas.
 *       `_insertTable(cols, rows, withHeader)` substitui a versao fixa.
 *       `rows` e o TOTAL de linhas visiveis (o que o usuario conta na
 *       grade): com cabecalho, 1 vai pro `<thead>` e o resto pro `<tbody>`
 *       — `rows:1` + cabecalho gera tabela so com `<thead>` (HTML e GFM
 *       validos) em vez de um `<tbody>` vazio.
 *       [FIX] de carona, no modo md: GFM EXIGE linha de cabecalho, e o
 *       `_tableToMd` tem o fallback "sem <thead> promove a primeira linha"
 *       (correto pra HTML vindo de fora). Como o `_insertTable` nunca
 *       gerava `<thead>`, a primeira linha que o usuario digitou virava
 *       cabecalho no round-trip, em silencio. Agora o checkbox nasce ligado
 *       e no modo md fica forcado ligado + desabilitado — o dado nao muda
 *       mais de papel sozinho.
 *       Celulas da grade sao `<span>` num container `[role=grid]` com
 *       `tabindex=0`, nao 80 botoes: 80 elementos focaveis destruiriam o
 *       tab-order do popover, e o highlight ja e delegado por `mousemove`
 *       no container. Nenhum elemento do popover leva `.ozi-editor-btn` nem
 *       `data-ozi-editor-tool` (mesmo cuidado dos botoes de alinhamento de
 *       imagem na 4.7.0) — os dois fariam o dispatcher generico de
 *       mousedown trata-los como ferramenta.
 *       Sem `colspan`/`rowspan` de proposito: o `_cleanNode` do sanitizador
 *       apaga os dois (restaura so class/href/src/alt/width/height), entao
 *       mesclar celula exigiria abrir o modulo de sanitizacao — feature
 *       propria, fora do escopo desta. Modulo `ozi-editor-sanitize`
 *       INTOCADO nesta versao (TABLE/THEAD/TBODY/TR/TD/TH ja estavam na
 *       ALLOWED_TAGS desde a Fase 3).
 *   - v4.7.1: [FIX] Popover/dropdown cortado pela moldura do editor. Ate aqui
 *       todo popover era `position:absolute` ancorado no wrap do proprio
 *       botao — vivia DENTRO da caixa do editor e obedecia a qualquer
 *       `overflow` de ancestral. Dois cortes reais, ambos medidos:
 *       (1) `.ozi-editor-wrap{overflow:hidden}` (o clip do border-radius) —
 *       o popover de imagem tem ~260px e um editor com o `min-height`
 *       padrao tem ~257px: estourava ~50px e o `Aplicar`/`Remover` ficava
 *       NAO-CLICAVEL (elementFromPoint no centro do botao devolvia <html>),
 *       que foi o sintoma reportado pelo usuario; (2)
 *       `.ozi-editor-toolbar-scroll-track{overflow-x:auto}` (modo Scroll da
 *       toolbar, 4.6.0) — a track tem ~44px, entao o corte era de ~236px e
 *       abrir o popover ainda dava scroll VERTICAL na barra de ferramentas
 *       (scrollHeight 298 x clientHeight 34). Os paineis de `{}` ja tinham
 *       sido tirados da track pelo mesmo motivo (ver _buildScrollToolbarInto);
 *       os popovers tinham ficado de fora daquele cuidado.
 *       `overflow:visible` no wrap so resolveria (1) — e ainda perderia o
 *       clip do radius. A correcao tira o popover do fluxo clipado:
 *       `position:fixed` + coordenadas calculadas contra o rect do TRIGGER
 *       (`_positionFloating`, secao [11c]), aplicadas no ponto unico que ja
 *       abria/fechava tudo (`_setPopoverOpen`) — entao vale para os popovers
 *       de link/color/highlight/image E para os dropdowns de heading/classes
 *       de uma vez. O DOM NAO muda: o popover continua filho do seu
 *       `.ozi-editor-popover-wrap`, preservando `_popoverIdFromElement`/
 *       `_closeOutsidePopovers` (delegacao por `closest`) e o `destroy()`.
 *       Com as coordenadas na mao vem o que o absolute nunca cobriu: VIRA
 *       PRA CIMA quando nao cabe embaixo (editor no rodape da tela), clamp
 *       lateral, e `max-height` + scroll proprio quando nao cabe dos dois
 *       lados. `_repositionOpenPopovers` religa o popover ao trigger em
 *       `scroll`/`resize` — o `scroll` precisa de CAPTURE (o evento nao
 *       borbulha: sem isso, rolar o proprio `.ozi-editor-content` deixaria o
 *       popover parado na tela), por isso `_on` ganhou o 4o parametro
 *       `opts`, devolvido ao `removeEventListener` no `destroy()` (capture
 *       faz parte da identidade do listener). Trigger inteiro fora da
 *       viewport fecha o popover em vez de deixa-lo orfao sobre outra parte
 *       da pagina. **Nota pra quem for testar:** `offsetParent` e sempre
 *       `null` em elemento `fixed` — use `style.display !== 'none'`
 *       (o `_isShown` do arquivo) pra saber se um popover esta aberto.
 *       Ressalva conhecida (custo de qualquer UI flutuante, Bootstrap/Popper
 *       inclusive): ancestral com `transform`/`filter`/`contain` vira
 *       containing block do `fixed` e desloca as coordenadas — nao ocorre
 *       nos temas do plugin.
 *   - v4.7.0: [FEAT] Alinhamento de imagem — linha "Alinhamento" nova dentro
 *       do popover de imagem (ao lado de Largura/Altura), com 4 modos:
 *       `left`/`right` (float, texto corre ao lado), `center` (bloco
 *       centrado) e `free` (posicao livre por ARRASTO, por cima do texto).
 *       Antes desta versao o alinhamento era impossivel por CSS, nao por
 *       falta de botao: `.ozi-editor-content img` fixava `display:block`,
 *       e os tools `left/center/right` da toolbar so aplicam `text-align`
 *       no paragrafo — nunca tiveram efeito sobre a imagem.
 *       **Estado gravado como INLINE STYLE na propria `<img>`** (nao classe):
 *       o HTML salvo e renderizado na pagina do host, que pode nao ter o CSS
 *       do plugin. Mesmo precedente do alinhamento de texto (`style.textAlign`
 *       ja preservado pelo sanitizador). Os modos de alinhamento levam junto
 *       `max-width:100%` inline (a regra do CSS do editor nao viaja pro
 *       host), mas imagem SEM alinhamento continua saindo sem `style` nenhum
 *       — a v4.7.0 nao muda a saida de quem nao pediu alinhamento.
 *       `_applyImageUrl` ganha 5o parametro `align`; novos `_getImageAlign`/
 *       `_applyImageAlign` (string canonica por modo, sem residuo do modo
 *       anterior). Clique num botao de alinhamento com imagem selecionada
 *       aplica na hora (precedente dos swatches de cor); sem imagem, fica
 *       pendente no proprio popover ate o Aplicar.
 *       **Arrasto (modo `free`):** reaproveita o handler de `mousedown` que
 *       ja abria o popover ao clicar numa `<img>`; imagem NAO-livre mantem o
 *       comportamento anterior byte a byte (abre no mousedown — o aceite da
 *       Fase 3 depende disso), imagem livre arma `_imgDrag` e so decide no
 *       mouseup: sem movimento (< 4px) = clique, abre o popover; com
 *       movimento = arrasto, nao abre. `mousemove`/`mouseup` sao registrados
 *       UMA VEZ no `document` via `_on` (rastreado pelo `destroy()`) e
 *       gateados por `this._imgDrag` — registrar por gesto vazaria listener,
 *       ja que nao existe `_off` no arquivo. Escrita de `style` SINCRONA,
 *       sem requestAnimationFrame (rAF nao dispara de forma confiavel sob
 *       `--virtual-time-budget`, ver lessons-learned — com rAF a feature
 *       ficaria intestavel). Guardas: limiar de 4px, `e.buttons === 0`
 *       aborta (drag grudado por Alt+Tab/menu de contexto/soltar fora da
 *       janela), compensacao de `scrollTop`, `content.contains(img)` no
 *       mouseup (setValue/source mode podem trocar o DOM no meio) e CLAMP
 *       obrigatorio nos 4 limites (`overflow-x:hidden` do content corta sem
 *       dar scroll — imagem arrastada pra fora ficaria inalcancavel).
 *       `_syncToTextarea()`/`emitChange()` so no mouseup, nunca por move.
 *       Coordenadas: `left` em % (o host renderiza noutra largura) e `top`
 *       em px (altura e dirigida pelo conteudo, % vertical derivaria).
 *       **Modo md:** a linha de alinhamento NAO e construida (mesma regra da
 *       secao de upload: controle funcionalmente morto nao deveria estar no
 *       DOM) — `htmlToMd` serializa `![alt](src)` e descarta style, e
 *       `left/center/right` de texto ja sao BLOCKED_IN_MD.
 *       Sanitizador: `ozi-editor-sanitize` 1.1.0 ganha a whitelist de estilo
 *       inline de `<img>` (sem isso o alinhamento se perde no round-trip).
 *       4 SVGs novos (`icon-img-left/right/center/free`) — os `icon-left/
 *       center/right` existentes sao de alinhamento de TEXTO e ja estao em
 *       uso pelos tools da toolbar. Botao dentro de popover nao e alcancado
 *       pelo laco de `_loadIcons` (que varre `[data-ozi-editor-tool]`), entao
 *       ganham passada manual (mesmo padrao do chrome estrutural).
 *       [FIX] As 9 chaves `editor.image*` (Fase 3) nunca entraram na tabela
 *       `fb` de `_t` — sem dicionario carregado o popover mostrava
 *       literalmente `editor.imageUrl`/`editor.imageAlt`. Mesma classe de bug
 *       da v4.1.1. Corrigidas junto com as 5 chaves novas de alinhamento.
 *   - v4.6.0: [FEAT] Toolbar responsiva — modo Scroll (retomado da secao 3c
 *       do roadmap, adiado em 2026-08-31): `data-ozi-editor-tools-scroll` /
 *       `-scroll-{sm,md,lg,xl,xxl}` — a toolbar vira UMA linha com overflow-x
 *       nativo + 2 setas fixas (sempre visiveis, `disabled` nativo no fim de
 *       curso). Combinavel com os breakpoints existentes: cada nivel (base +
 *       sm/md/lg/xl/xxl) escolhe independentemente entre modo wrap (atual) e
 *       scroll; conflito no mesmo nivel (`-md` + `-scroll-md` juntos) resolve
 *       com scroll vencendo (opt-in explicito). `;` no valor e FLATTENED —
 *       vira uma unica linha/track, nao multiplos scrollers empilhados.
 *       `_appendToolItemsInto` extraido de `_buildToolbarButtonsInto` (puro
 *       refactor, reusado pelo builder novo `_buildScrollToolbarInto`). Setas
 *       nao tem guard proprio de `isDisabled` no handler (`_setDisabled()` ja
 *       marca TODO `.ozi-editor-btn` como `disabled=true`, inclusive setas e
 *       collapse-toggle — uniforme com o resto da toolbar). 1 SVG novo
 *       `icon-chevron-left.svg`
 *       (botao `--scroll-next` reusa o mesmo arquivo via `rotate(180deg)`,
 *       mesmo padrao do chevron do colapso).
 *   - v4.5.0: [FEAT] Toolbar responsiva — modo Colapso (ver
 *       ozi-ui-docs/horizonte/roadmap/ozi-editor-toolbar-responsiva.md):
 *       atributos `data-ozi-editor-tools-{sm,md,lg,xl,xxl}` (string de layout
 *       COMPLETA e independente por breakpoint, min-width estilo Bootstrap —
 *       `-sm` vale da largura sm pra cima). Sintaxe nova `{-,...}`/`{+,...}`
 *       dentro de qualquer string de tools (base ou breakpoint): grupo
 *       colapsavel atras de um chevron (▼ fechado / ▲ aberto) que abre uma
 *       2a linha INLINE (nao popover flutuante), primeiro token = estado
 *       padrao (`-` fechado/`+` aberto, sem marcador = fechado). Parser:
 *       `_splitTopLevel` local virou `_splitToolsToken` (soma profundidade
 *       de `[]` E `{}` num unico contador — nao da pra chamar o
 *       `h.splitTopLevel` do core duas vezes); `_parseCollapseItem` novo,
 *       recursivo (aceita `[grupo]`/`,`/`;` dentro do `{}`). Arquitetura de
 *       DOM: cada breakpoint declarado vira uma SUBARVORE independente
 *       (`.ozi-editor-toolbar-variant`, `data-ozi-editor-toolbar-bp`/`-until`),
 *       nao uma lista plana com marcador por botao — evita quebrar
 *       `:first-child`/`:last-child` dos grupos e permite o mesmo tool estar
 *       solto num breakpoint e dentro do `{}` em outro sem reparenting;
 *       CSS (`display:contents`/`none` por media query) decide qual mostrar,
 *       zero JS no resize. Instancia sem nenhum atributo `-sm/-md/...` gera
 *       DOM identico a antes desta versao (zero regressao). [FIX] Pre-
 *       requisito antes da feature: `_registerPopover`/`_popoverEntry`/
 *       `data-ozi-editor-popover-wrap` trocam a chave de "nome bruto do
 *       tool" pra um ID UNICO por instancia de popover (`heading-3`,
 *       `link-7`) — com a toolbar responsiva o mesmo tool (heading/classes/
 *       link/color/highlight/image) pode aparecer em mais de uma variante
 *       de breakpoint simultaneamente no DOM, e a chave por nome bruto fazia
 *       o popover errado abrir silenciosamente (por vezes escondido numa
 *       variante inativa — nem aparecia na tela); bug latente, nunca
 *       acontecia antes por nao existir duplicata. Campos singulares por
 *       instancia (`self._linkInput`, `self._imageUrlInput`, etc.,
 *       `self.headingDropdown`/`classDropdown`) removidos — cada handler
 *       agora resolve os campos a partir do popover/elemento efetivamente
 *       clicado (`_popoverIdFromElement`/`_toolFromPopoverId`/
 *       `_visibleToolTrigger`). Zero mudanca de comportamento com 1
 *       instancia de cada tool (cenario de hoje) — validado sem regressao
 *       nos aceites existentes antes de introduzir a feature nova.
 *   - v4.4.0: [FEAT] Fase 3 da nova leva de ferramentas (ver
 *       ozi-ui-docs/horizonte/roadmap/ozi-editor-nova-leva-ferramentas.md):
 *       sanitizador HTML extraido para modules/ozi-editor-sanitize.js (modulo
 *       puro, mesmo perfil de ozi-password-rules — ver
 *       ozi-ui-docs/horizonte/roadmap/ozi-editor-subdivisao.md). `_sanitizeHtml`/
 *       `_isSafeUrl` viram wrappers finos que delegam a `window.OziEditorSanitize`
 *       e falham alto (throw) se o modulo nao carregou — nenhum call-site interno
 *       mudou. `editor` passa a depender de `editor-sanitize` no `_pluginMap`
 *       (ozi-conf 3.0.1). `_isSafeColorValue` local removida (orfa apos a
 *       extracao, so tinha uso dentro do `_cleanNode` que migrou). Ferramenta
 *       `image` nova: popover com URL + upload real de arquivo
 *       (`data-ozi-editor-upload-url`, contrato `{status:'ok',url}`/
 *       `{status:'error',message}`, sem base64 inline). Sanitizador ganha `IMG`
 *       em ALLOWED_TAGS + remocao total do no quando `src` ausente/inseguro
 *       (elemento vazio, sem filhos pra "unwrap"); `alt` preservado sem
 *       validacao de conteudo. `_showClipboardWarning` generalizado para
 *       `_showWarning` (mesmo widget visual, reusado por erro de clipboard e
 *       de imagem/upload). MD: `image` ganha conversor real
 *       (`![alt](url)`) em ozi-editor-md.js 2.3.0. Tema `full` (html e md)
 *       ganha `image` no grupo `[link,unlink]`. Aceites dedicados:
 *       aceite-editor-sanitize.html (modulo isolado) + aceite-editor-fase3.html.
 *       [ajuste pos-revisao do usuario, mesma v4.4.0 — validado ao vivo antes
 *       do fechamento da fase] Popover `image` ganha campos `Largura`/`Altura`
 *       (px, atributos HTML nativos `width`/`height`, unitless — vazio deixa
 *       "auto", a regra CSS `height:auto` ja existente cobre). `_applyImageUrl`
 *       ganha params `width`/`height`; `onOpen` pre-popula os 4 campos
 *       (URL/Alt/Largura/Altura) ao reabrir sobre imagem existente. Sanitizador
 *       ganha `isSafeDimension()` (inteiro 1-5 digitos, sem `%`/unidade CSS).
 *       Clicar diretamente numa `<img>` do content agora abre o popover de
 *       edicao automaticamente (novo `_openPopover`, versao nao-toggle de
 *       `_togglePopover` — reclicar numa 2a imagem com o popover ja aberto
 *       ATUALIZA o conteudo pra ela em vez de fechar); `stopPropagation()`
 *       no handler evita que o "clique fora" do document feche o popover no
 *       mesmo evento (a `<img>` clicada nao esta dentro do wrap do trigger
 *       da toolbar).
 *   - v4.3.0: [FEAT] Fase 2 da nova leva de ferramentas (ver
 *       ozi-ui-docs/horizonte/roadmap/ozi-editor-nova-leva-ferramentas.md):
 *       Passo 0 — mecanica de popover (wrap+trigger+outside-click+aria-expanded,
 *       mutuamente exclusivo entre popovers abertos) extraida dos dropdowns de
 *       heading/classes para `_registerPopover`/`_togglePopover`/
 *       `_buildPopoverButton` (conteudo de heading/classes NAO mudou, so a
 *       camada de abrir/fechar/registro). 6 ferramentas novas:
 *       `unlink` (execCmd generico, mesmo caminho de strike/undo/redo);
 *       `link` (popover com campo de URL — `_isSafeUrl()` bloqueia esquemas
 *       fora de http/https/mailto/tel/relativo, em particular `javascript:`);
 *       `color`/`highlight` (popover com grade de swatches fixos —
 *       `document.execCommand('styleWithCSS', false, true)` antes de
 *       foreColor/hiliteColor, forcando `<span style>` em vez do `<font color>`
 *       legado que o Chromium produz sem isso — verificado empiricamente no
 *       Edge headless antes de implementar); `paste`/`pasteFmt` (acao imediata
 *       via Clipboard API — `navigator.clipboard.readText()`/`.read()` no
 *       proprio gesto de clique, plain-text ou HTML sanitizado; falha de
 *       permissao/API ausente e fail-open silencioso, so loga via `_dbg`).
 *       Sanitizador: `ALLOWED_TAGS` ganha `A`; `<a>` com `href` fora da
 *       whitelist de esquemas vira texto simples (unwrap, mesmo caminho de tag
 *       nao permitida); `style.color`/`backgroundColor` so sao preservados se
 *       baterem com a paleta fixa (`SWATCH_PALETTE`, comparados em hex E em
 *       rgb() normalizado, ja que e assim que o browser serializa o inline
 *       style) — defesa em profundidade, o sanitizador nao confia na UI (vale
 *       tambem para `setValue()`/paste nativo). Tema `full` (html) ganha
 *       `[link,unlink]`, `[color,highlight]`, `[paste,pasteFmt]`; tema `full`
 *       (md) ganha `link`/`unlink` (color/highlight seguem BLOCKED_IN_MD, sem
 *       sintaxe nativa). MD: `link` ganha conversor real em ozi-editor-md.js
 *       2.2.0 (`[texto](url)`). Aceite dedicado: aceite-editor-fase2.html.
 *       Fora de escopo desta fase (roadmap): skin `clarity` do editor, `image`
 *       e subdivisao do sanitizador (Fase 3).
 *   - v4.2.0: [FEAT] Fase 1 da nova leva de ferramentas (ver
 *       ozi-ui-docs/horizonte/roadmap — plano de 3 fases simples/media/pesada):
 *       6 ferramentas simples + contador. `strike` (execCmd generico
 *       strikeThrough), `justify` (via _applyTextAlign, mesmo padrao de
 *       left/center/right — sanitizador ja tinha 'justify' na lista de aligns
 *       permitidos, so nunca tinha tool pra usar), `quote` (_toggleQuote,
 *       mesmo padrao do _toggleHeading: troca p<->blockquote), `hr`
 *       (_insertHr, mesmo padrao do _insertTable), `undo`/`redo` (execCmd
 *       generico, tipo acao sem estado). Sanitizador: ALLOWED_TAGS ganha
 *       BLOCKQUOTE/HR/S; STRIKE (legado do execCommand em alguns navegadores)
 *       normalizado pra S via TAG_REPLACE, mesmo tratamento que B/I ja tinham.
 *       Contador de palavras/caracteres opt-in via `data-ozi-editor-counter`
 *       (greenfield, sem tocar execCommand/sanitizer). MD: strike/quote/hr
 *       ganham conversor real em ozi-editor-md.js 2.1.0 (~~/> /---, sintaxe
 *       nativa do Markdown); color/highlight (fase 2) ficam BLOCKED_IN_MD de
 *       proposito. Tema `full` (html e md) atualizado com as 6 ferramentas
 *       novas; demais temas (minimal/standard/blog/code) inalterados.
 *       6 icones SVG novos (strike/justify/quote/hr/undo/redo), extraidos
 *       do mockup Claude Design aprovado (ozi-ui-designer/OZI-UI/demo/
 *       ozi-editor.html) — mesmo padrao MDI ja usado nos icones existentes.
 *       Aceite dedicado: aceite-editor-fase1.html (zero falhas, regressao
 *       dos aceites pre-existentes tambem zero falhas).
 *       [ACHADO, nao corrigido — pre-existente, nao e regressao desta fase]
 *       getValue() logo apos um execCommand reflete o HTML BRUTO do
 *       contenteditable (ex.: <b>/<strike> em vez de <strong>/<s>) ate o
 *       proximo _sanitizeHtml (paste/setValue) — mesmo comportamento que
 *       bold/italic ja tinham antes desta fase; strike so herdou o padrao
 *       existente, nao introduziu uma inconsistencia nova.
 *   - v4.1.1: [FIX-I18N] 8 chaves de lang faltando nos dicionarios externos
 *       (editor.heading, editor.h1..h6, editor.classes, editor.clear, editor.unknown,
 *       editor.incompatible) — caiam no fallback interno em ingles hardcoded; pt-BR/es
 *       mostravam texto errado nesses botoes. Adicionadas em pt-BR/en/es. Removida a
 *       chave morta `editor.clearFormat` (nunca lida pelo codigo — o codigo le
 *       `editor.clear`). Achado original registrado no changelog da v4.1.0 (2026-08-20),
 *       corrigido agora. NAO corrigido: `editor.source.md` — o resolvedor de chaves do
 *       ozi-lang.js (`_resolve`, caminho pontilhado) exige que `editor.source` seja
 *       objeto para ter filho `.md`, mas `editor.source` e string (usada sozinha em
 *       modo html) — colisao estrutural, so resolve com mudanca de chave no codigo
 *       (ex.: `editor.sourceMd`), fora do escopo desta correcao de dicionario.
 *       Sem mudanca de logica/API.
 *   - v4.1.0: [DEBUG] Flag local `data-ozi-editor-log` (convenção `data-ozi-{plugin}-log`,
 *       espelha o zldLog do ozi-loaddata): método _dbg loga init()/destroy() deste widget
 *       com prefixo [OZI:editor#<uid>]; destroy() com console.trace p/ apontar quem chamou.
 *       Zero custo/ruído quando ausente/false; por instância. Atributo novo → MINOR (staged 2.3.0).
 *   - v4.0.0: [V2-F2] Migracao para JS puro (docs/ozi-ui-v2-contratos.md, dev-hard):
 *       - Zero jQuery. Build de UI via createElement; delegacao de eventos nativa
 *         em cada wrap (addEventListener + e.target.closest), rastreada por
 *         instancia para o destroy(). ':visible' -> checagem de style.display.
 *       - `.closest(sel, context)` 2-arg do jQuery -> Element.closest() nativo +
 *         guard content.contains() + normalizacao de text-node (nodeType 3).
 *       - Estado de init por-elemento migrado de $.data() para WeakMap (por type).
 *       - Fim do dual-dispatch: emitChange() emite SOMENTE CustomEvent via
 *         OZI.helpers.emit(). Payload passa a aderir ao contrato:
 *         { component:'ozi-editor', name:key, value, type, source }. Sem shim —
 *         nenhum consumidor jQuery-posicional de ozi:change do editor no Central RH
 *         (verificado: unico listener generico e nativo e filtra o editor fora).
 *       - Adicionados ozi:init (pos-init da instancia) e ozi:destroy (no destroy()).
 *         source: 'user' na interacao, 'api' em setValue/destroy.
 *       - Adapter ozi-validate: declara nativeElement:true e recebe Element nativo
 *         (padrao do ozi-select F2#4). registerConverters/init(md) deferido via
 *         flag _booted (sem a fila $(fn)); ozi-editor-md.js migrado em separado.
 *
 *   Historico anterior (jQuery):
 *   - v3.1.1 FIX-MD-BOOT; v3.1.0 FEAT-7 (data-ozi-editor-html/md); v2.5.x timing;
 *     v2.4 type html|md; v2.3 themes; v2.1 headings/classes/tools; v2.0.2 fixes.
 */

(function (window, document) {
    'use strict';

    // ─────────────────────────────────────────────
    // [0] GUARD — singleton
    // ─────────────────────────────────────────────

    if (window.OziEditor) return;

    /* ─────────────────────────────────────────────
     * [1] REGISTRY E CONTADOR
     * ───────────────────────────────────────────── */

    var _instances = {};
    var _counter   = 0;

    /* estado de init por-elemento (substitui $.data), por type */
    var _initState = new WeakMap();
    function _isInited(el, type)      { var s = _initState.get(el); return !!(s && s[type]); }
    function _setInited(el, type, on) { var s = _initState.get(el); if (!s) { s = {}; _initState.set(el, s); } s[type] = !!on; }

    var _booted       = false;
    var _pendingMdInit = false;

    /* ─────────────────────────────────────────────
     * [2] HELPERS INTERNOS
     * ───────────────────────────────────────────── */

    function _h() { return (window.OZI && window.OZI.helpers) || {}; }

    function _trim(s) { return String(s || '').replace(/^\s+|\s+$/g, ''); }

    function _t(key) {
        var lang = window.OZI && window.OZI.lang;
        if (lang && lang.t) { var v = lang.t(key); if (v && v !== key) return v; }
        var fb = {
            'editor.bold':           'Bold',
            'editor.italic':         'Italic',
            'editor.underline':      'Underline',
            'editor.strike':         'Strikethrough',
            'editor.ul':             'List',
            'editor.ol':             'Numbered list',
            'editor.indent':         'Indent (Tab)',
            'editor.outdent':        'Outdent (Shift+Tab)',
            'editor.codeblock':      'Code',
            'editor.source':         'HTML source',
            'editor.source.md':      'Markdown source',
            'editor.table':          'Table',
            'editor.clear':          'Clear format',
            'editor.alignLeft':      'Align left',
            'editor.alignCenter':    'Center',
            'editor.alignRight':     'Align right',
            'editor.justify':        'Justify',
            'editor.quote':          'Quote',
            'editor.hr':             'Horizontal line',
            'editor.undo':           'Undo',
            'editor.redo':           'Redo',
            'editor.link':           'Link',
            'editor.unlink':         'Remove link',
            'editor.linkUrl':        'URL',
            'editor.color':          'Text color',
            'editor.highlight':      'Highlight color',
            'editor.paste':          'Paste',
            'editor.pasteFmt':       'Paste with formatting',
            /* as 9 chaves de imagem abaixo existem desde a Fase 3 (v4.4.0) mas
               nunca tinham entrado aqui — sem dicionario carregado o popover
               mostrava a propria chave. Corrigido na v4.7.0. */
            'editor.image':          'Image',
            'editor.imageUrl':       'URL',
            'editor.imageAlt':       'Alt text',
            'editor.imageWidth':     'Width',
            'editor.imageHeight':    'Height',
            'editor.imageUpload':    'Upload',
            'editor.imageUploading': 'Uploading…',
            'editor.imageUploadFailed': 'Could not upload the image.',
            'editor.imageInvalidUrl':   'Invalid image URL.',
            'editor.imageAlign':       'Alignment',
            'editor.imageAlignLeft':   'Left (text wraps)',
            'editor.imageAlignRight':  'Right (text wraps)',
            'editor.imageAlignCenter': 'Centered',
            'editor.imageAlignFree':   'Free position (drag)',
            /* tabela (v4.8.0) — a lição das 9 chaves de imagem acima: chave
               que não entra AQUI aparece literal quando não há dicionário */
            'editor.tableCols':      'Columns',
            'editor.tableRows':      'Rows',
            'editor.tableHeader':    'Header row',
            'editor.tableInsert':    'Insert',
            'editor.tableSize':      'cells',
            'editor.tableGrid':      'Table size',
            'editor.tableEdit':      'Edit table',
            'editor.tableRowAbove':  'Insert row above',
            'editor.tableRowBelow':  'Insert row below',
            'editor.tableColBefore': 'Insert column before',
            'editor.tableColAfter':  'Insert column after',
            'editor.tableRowRemove': 'Delete row',
            'editor.tableColRemove': 'Delete column',
            'editor.tableRemove':    'Delete table',
            'editor.apply':          'Apply',
            'editor.remove':         'Remove',
            'editor.none':           'None',
            'editor.customize':      'Customize',
            'editor.clipboardBlocked': 'Could not read the clipboard. Check the browser permission (address bar / site settings).',
            'editor.words':          'words',
            'editor.chars':          'characters',
            'editor.h1':             'Heading 1',
            'editor.h2':             'Heading 2',
            'editor.h3':             'Heading 3',
            'editor.h4':             'Heading 4',
            'editor.h5':             'Heading 5',
            'editor.h6':             'Heading 6',
            'editor.heading':        'Heading',
            'editor.classes':        'Styles',
            'editor.placeholder':    'Type here...',
            'editor.incompatible':   'Not available in this mode',
            'editor.unknown':        'Unknown tool',
            'editor.moreTools':      'More tools',
            'editor.fewerTools':     'Fewer tools',
            'editor.scrollPrev':     'Scroll back',
            'editor.scrollNext':     'Scroll forward',
            'common.required':       'Required field'
        };
        return fb[key] || key;
    }

    function _classMap(key, fallback) {
        var conf = window.OZI && window.OZI.conf;
        return (conf && conf.classMap && conf.classMap[key]) || fallback || '';
    }

    /* classList.add/remove aceitando string com multiplas classes (ex.: tailwind) */
    function _classListOp(el, classString, method) {
        if (!el || !classString) return;
        String(classString).trim().split(/\s+/).forEach(function (c) { if (c) el.classList[method](c); });
    }

    /* equivalente a $('<tag class>').attr({...}) */
    function _el(tag, className, attrs) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (attrs) Object.keys(attrs).forEach(function (k) {
            if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
        });
        return e;
    }

    /* jQuery :visible dos dropdowns — controlados por style.display inline */
    function _isShown(el) { return !!el && el.style.display !== 'none'; }

    function _emitEvent(el, name, detail) {
        var h = _h();
        if (h && typeof h.emit === 'function') { h.emit(el, name, detail); return; }
        if (typeof CustomEvent === 'function') el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
    }

    function _parseBool(el, attr, fallback) {
        var h = _h();
        if (h.parseBool) return h.parseBool(el, attr, fallback);
        var raw = el ? el.getAttribute(attr) : null;
        if (raw === undefined || raw === null) return !!fallback;
        var val = String(raw).trim().toLowerCase();
        if (val === 'true'  || val === '1' || val === 'yes' || val === 'on')  return true;
        if (val === 'false' || val === '0' || val === 'no'  || val === 'off') return false;
        return !!fallback;
    }

    /* soma profundidade de [ ] E { } num unico contador — nao da pra
       reaproveitar h.splitTopLevel do core aqui (so rastreia um par de
       delimitadores por chamada; uma virgula dentro de {...} precisa ficar
       protegida mesmo sem nenhum [ aberto). Local ao parser de toolbar,
       nao delega ao helper generico do core. */
    function _splitToolsToken(raw, sep) {
        var results = [], depth = 0, current = '';
        for (var i = 0; i < raw.length; i++) {
            var ch = raw[i];
            if (ch === '[' || ch === '{') depth++;
            if (ch === ']' || ch === '}') depth--;
            if (ch === sep && depth === 0) {
                if (current.trim()) results.push(current.trim());
                current = '';
            } else { current += ch; }
        }
        if (current.trim()) results.push(current.trim());
        return results;
    }

    /* ─────────────────────────────────────────────
     * [3] DEFAULT_TOOLS — padrao do autor por type
     * ───────────────────────────────────────────── */

    var DEFAULT_TOOLS_HTML = '[bold,italic,underline], [ul,ol], [left,center,right]; [heading,classes], table, clear, codeblock, source';
    var DEFAULT_TOOLS_MD   = '[bold,italic], [ul,ol]; heading; codeblock, table; source';

    /* [v4.8.0 FIX] `justify` entrou aqui — tinha ficado de fora desde a Fase 1
       (v4.2.0), que o adicionou ao TOOL_META sem lembrar desta lista. Os
       irmaos left/center/right ja estavam bloqueados pelo mesmo motivo: sao
       alinhamento de PARAGRAFO, e o `htmlToMd` serializa <p> como texto puro,
       descartando o `text-align`. Sem o bloqueio, o botao aparecia habilitado
       no type md, aplicava o estilo no contenteditable e a conversao jogava
       fora — no-op silencioso, exatamente o que esta lista existe pra evitar. */
    var BLOCKED_IN_MD = { left: true, center: true, right: true, justify: true, clear: true, color: true, highlight: true };

    /* toolbar responsiva — min-width estilo Bootstrap (mesma tabela numerica,
       consistente com a direcao de breakpoint ja fechada com o usuario).
       Valores tambem documentados em --ozi-editor-bp-* no CSS (so como fonte
       citavel — @media nao aceita var() na condicao, os literais no CSS sao
       a fonte real, mantidos em sincronia manualmente). Ordem ascendente:
       usada tal qual pra computar "proximo breakpoint declarado". */
    var TOOLBAR_BREAKPOINTS = [
        { name: 'sm',  px: 576 },
        { name: 'md',  px: 768 },
        { name: 'lg',  px: 992 },
        { name: 'xl',  px: 1200 },
        { name: 'xxl', px: 1400 }
    ];

    var BUILT_IN_THEMES_HTML = {
        minimal:  '[bold,italic,underline]; source',
        standard: '[bold,italic,underline]; heading; [ul,ol]; codeblock,clear; source',
        full:     '[bold,italic,underline,strike], [ul,ol], [left,center,right,justify]; [heading,classes], [quote,hr], table, clear, [undo,redo], codeblock, source; [link,unlink,image], [color,highlight], [paste,pasteFmt]',
        blog:     '[bold,italic,underline]; heading; [ul,ol]; table,clear; classes,source',
        code:     '[bold,italic,underline]; codeblock,source'
    };

    var BUILT_IN_THEMES_MD = {
        minimal:  '[bold,italic]; source',
        standard: '[bold,italic], [ul,ol]; heading; codeblock; source',
        /* [v4.9.0] reorganizado a pedido do autor. Eram 5 linhas de toolbar
           (`;` = nova linha) pra 14 ferramentas — muita altura de barra pra
           pouca ferramenta por faixa. Agora sao 2 linhas agrupadas por
           familia, e o tema ganha 4 tokens que ja funcionavam no md mas
           estavam de fora do `full`: `undo`/`redo` e `paste`/`pasteFmt`.
           Nada foi removido. Como isto e tema BUILT-IN, quem usa
           `data-ozi-editor-theme="full"` num editor md ve a barra mudar —
           aditivo (so ganha botao), mas e mudanca visivel. */
        full:     '[undo,redo],[bold,italic,strike],[paste,pasteFmt],[ol,ul],[link,unlink];heading,table,image,[quote,hr],codeblock,source'
    };

    function _resolveTheme(name, devThemes, builtIn) {
        if (!name) return null;
        name = _trim(String(name));
        if (devThemes && devThemes[name]) return String(devThemes[name]);
        if (builtIn && builtIn[name])     return String(builtIn[name]);
        return null;
    }

    /* CONTRATO DE CONVERSORES — preenchido por ozi-editor-md.js */
    var _converters = { mdToHtml: null, htmlToMd: null };

    var SELECTOR = '[data-ozi-editor-html], [data-ozi-editor-md]';

    /* ─────────────────────────────────────────────
     * [4] METADADOS DAS FERRAMENTAS
     * ───────────────────────────────────────────── */

    var TOOL_META = {
        bold:      { labelKey: 'editor.bold',        icon: 'bold',      execCmd: 'bold' },
        italic:    { labelKey: 'editor.italic',       icon: 'italic',    execCmd: 'italic' },
        underline: { labelKey: 'editor.underline',    icon: 'underline', execCmd: 'underline' },
        strike:    { labelKey: 'editor.strike',       icon: 'strike',    execCmd: 'strikeThrough' },
        ul:        { labelKey: 'editor.ul',           icon: 'ul',        execCmd: 'insertUnorderedList' },
        ol:        { labelKey: 'editor.ol',           icon: 'ol',        execCmd: 'insertOrderedList' },
        indent:    { labelKey: 'editor.indent',       icon: 'indent',    execCmd: null },
        outdent:   { labelKey: 'editor.outdent',      icon: 'outdent',   execCmd: null },
        codeblock: { labelKey: 'editor.codeblock',    icon: 'codeblock', execCmd: null },
        source:    { labelKey: 'editor.source',       icon: 'source',    execCmd: null },
        table:     { labelKey: 'editor.table',        icon: 'table',     execCmd: null },
        clear:     { labelKey: 'editor.clear',        icon: 'clear',     execCmd: null },
        left:      { labelKey: 'editor.alignLeft',    icon: 'left',      execCmd: null },
        center:    { labelKey: 'editor.alignCenter',  icon: 'center',    execCmd: null },
        right:     { labelKey: 'editor.alignRight',   icon: 'right',     execCmd: null },
        justify:   { labelKey: 'editor.justify',      icon: 'justify',   execCmd: null },
        quote:     { labelKey: 'editor.quote',        icon: 'quote',     execCmd: null },
        hr:        { labelKey: 'editor.hr',           icon: 'hr',        execCmd: null },
        undo:      { labelKey: 'editor.undo',         icon: 'undo',      execCmd: 'undo' },
        redo:      { labelKey: 'editor.redo',         icon: 'redo',      execCmd: 'redo' },
        link:      { labelKey: 'editor.link',         icon: 'link',      execCmd: null },
        unlink:    { labelKey: 'editor.unlink',       icon: 'unlink',    execCmd: 'unlink' },
        color:     { labelKey: 'editor.color',        icon: 'color',     execCmd: null },
        highlight: { labelKey: 'editor.highlight',    icon: 'highlight', execCmd: null },
        image:     { labelKey: 'editor.image',        icon: 'image',     execCmd: null },
        paste:     { labelKey: 'editor.paste',        icon: 'paste',     execCmd: null },
        pasteFmt:  { labelKey: 'editor.pasteFmt',     icon: 'pastefmt',  execCmd: null },
        h1:        { labelKey: 'editor.h1',           icon: 'h1',        execCmd: null },
        h2:        { labelKey: 'editor.h2',           icon: 'h2',        execCmd: null },
        h3:        { labelKey: 'editor.h3',           icon: 'h3',        execCmd: null },
        h4:        { labelKey: 'editor.h4',           icon: 'h4',        execCmd: null },
        h5:        { labelKey: 'editor.h5',           icon: 'h5',        execCmd: null },
        h6:        { labelKey: 'editor.h6',           icon: 'h6',        execCmd: null },
        heading:   { labelKey: 'editor.heading',      icon: 'heading',   execCmd: null },
        classes:   { labelKey: 'editor.classes',      icon: 'classes',   execCmd: null }
    };

    /* ─────────────────────────────────────────────
     * [5] PARSER DE LAYOUT DA TOOLBAR
     * ───────────────────────────────────────────── */

    function _parseToolsLayout(raw) {
        if (!raw) return [];
        return _splitToolsToken(raw, ';').map(function (row) {
            return { type: 'row', items: _parseToolsRow(row.trim()) };
        });
    }

    function _parseToolsRow(raw) {
        return _splitToolsToken(raw, ',').map(function (item) {
            item = item.trim();
            if (item.charAt(0) === '[' && item.charAt(item.length - 1) === ']') {
                var tools = item.slice(1, -1).split(',').map(function (t) { return t.trim(); }).filter(Boolean);
                return { type: 'group', tools: tools };
            }
            if (item.charAt(0) === '{' && item.charAt(item.length - 1) === '}') {
                return _parseCollapseItem(item.slice(1, -1));
            }
            return { type: 'tool', tool: item };
        });
    }

    /* grupo colapsavel { -,tool1,[grupo],tool2 } / { +,... } — primeiro
       token e o estado padrao (- fechado, + aberto; sem marcador = fechado,
       default mais seguro), o resto e uma sub-estrutura de layout completa e
       RECURSIVA (aceita [grupo]/,/; como qualquer string de toolbar normal).
       {} dentro de [grupo] nao e suportado (grupo continua parser plano) —
       cai no fallback de "tool desconhecido" (botao "?" desabilitado),
       comportamento seguro e consistente com qualquer token nao reconhecido
       hoje. {} aninhado dentro de outro {} nao quebra tecnicamente (a
       recursao permite), mas nao e um caso testado/suportado nesta rodada. */
    function _parseCollapseItem(inner) {
        var m = /^\s*([+-])\s*[,;]?\s*([\s\S]*)$/.exec(inner);
        var defaultOpen = m ? (m[1] === '+') : false;
        var rest        = m ? m[2] : inner;
        return { type: 'collapse', defaultOpen: defaultOpen, layout: _parseToolsLayout(rest) };
    }

    /* ─────────────────────────────────────────────
     * [6] PARSER DE CLASSES CUSTOMIZADAS
     * ───────────────────────────────────────────── */

    function _parseClassDefs(raw) {
        if (!raw) return [];
        return String(raw).split(',').map(function (part) {
            part = part.trim();
            if (!part) return null;
            var idx = part.indexOf(':');
            if (idx > -1) return { cls: part.slice(0, idx).trim(), label: part.slice(idx + 1).trim() };
            return { cls: part, label: part };
        }).filter(Boolean);
    }

    /* ─────────────────────────────────────────────
     * [7] SANITIZACAO DE HTML — delegado a ozi-editor-sanitize.js (Fase 3,
     * extracao do sanitizador como modulo isolado testavel; ver
     * ozi-ui-docs/horizonte/roadmap/ozi-editor-subdivisao.md). Wrappers finos
     * mantem os mesmos nomes/chamadas internas de antes da extracao — nenhum
     * call-site precisou mudar. Falha ALTO (throw) se o modulo nao carregou:
     * sanitizacao e codigo de seguranca, preferivel quebrar visivel a rodar
     * sem sanitizar.
     * ───────────────────────────────────────────── */

    function _sanitizerModule() {
        var mod = window.OziEditorSanitize;
        if (!mod) {
            throw new Error('[OZI:editor] ozi-editor-sanitize.js nao carregado. ' +
                'Declare deps:["editor-sanitize"] no ozi-conf ou carregue o script antes do ozi-editor.js.');
        }
        return mod;
    }

    function _sanitizeHtml(html) { return _sanitizerModule().sanitizeHtml(html); }
    function _isSafeUrl(url)     { return _sanitizerModule().isSafeUrl(url); }

    /* ─────────────────────────────────────────────
     * [7b] SEGURANCA — paleta de cor (grade de swatches, UI)
     * (validacao de FORMA de cor tambem foi pro modulo do sanitizador —
     * _isSafeColorValue nao tem mais uso aqui, so dentro dele)
     * ───────────────────────────────────────────── */

    /* paleta fixa — grade 10x6 (60 cores): 10 matizes x 6 tons (claro->escuro),
       a pedido do usuario (revisao pos-Fase 2, referencia visual trazida por
       ele). Escala nos mesmos moldes dos tokens --ozi-color-gray-* ja usados
       no projeto (Tailwind-like: 100/200/400/600/800/900). Ordem do array e
       "linha a linha" (10 matizes por linha, 6 linhas) de proposito — o CSS
       grid de 10 colunas preenche nessa ordem, formando 1 coluna por matiz
       (mais clara em cima, mais escura embaixo), igual a referencia. */
    var SWATCH_PALETTE = [
        // tom 100 (mais claro)
        { hex: '#f3f4f6', labelKey: 'gray-100' },   { hex: '#fee2e2', labelKey: 'red-100' },
        { hex: '#ffedd5', labelKey: 'orange-100' }, { hex: '#fef3c7', labelKey: 'amber-100' },
        { hex: '#dcfce7', labelKey: 'green-100' },  { hex: '#ccfbf1', labelKey: 'teal-100' },
        { hex: '#dbeafe', labelKey: 'blue-100' },   { hex: '#e0e7ff', labelKey: 'indigo-100' },
        { hex: '#f3e8ff', labelKey: 'purple-100' }, { hex: '#fce7f3', labelKey: 'pink-100' },
        // tom 200
        { hex: '#e5e7eb', labelKey: 'gray-200' },   { hex: '#fecaca', labelKey: 'red-200' },
        { hex: '#fed7aa', labelKey: 'orange-200' }, { hex: '#fde68a', labelKey: 'amber-200' },
        { hex: '#bbf7d0', labelKey: 'green-200' },  { hex: '#99f6e4', labelKey: 'teal-200' },
        { hex: '#bfdbfe', labelKey: 'blue-200' },   { hex: '#c7d2fe', labelKey: 'indigo-200' },
        { hex: '#e9d5ff', labelKey: 'purple-200' }, { hex: '#fbcfe8', labelKey: 'pink-200' },
        // tom 400
        { hex: '#9ca3af', labelKey: 'gray-400' },   { hex: '#f87171', labelKey: 'red-400' },
        { hex: '#fb923c', labelKey: 'orange-400' }, { hex: '#fbbf24', labelKey: 'amber-400' },
        { hex: '#4ade80', labelKey: 'green-400' },  { hex: '#2dd4bf', labelKey: 'teal-400' },
        { hex: '#60a5fa', labelKey: 'blue-400' },   { hex: '#818cf8', labelKey: 'indigo-400' },
        { hex: '#c084fc', labelKey: 'purple-400' }, { hex: '#f472b6', labelKey: 'pink-400' },
        // tom 600
        { hex: '#4b5563', labelKey: 'gray-600' },   { hex: '#dc2626', labelKey: 'red-600' },
        { hex: '#ea580c', labelKey: 'orange-600' }, { hex: '#d97706', labelKey: 'amber-600' },
        { hex: '#16a34a', labelKey: 'green-600' },  { hex: '#0d9488', labelKey: 'teal-600' },
        { hex: '#2563eb', labelKey: 'blue-600' },   { hex: '#4f46e5', labelKey: 'indigo-600' },
        { hex: '#9333ea', labelKey: 'purple-600' }, { hex: '#db2777', labelKey: 'pink-600' },
        // tom 800
        { hex: '#1f2937', labelKey: 'gray-800' },   { hex: '#991b1b', labelKey: 'red-800' },
        { hex: '#9a3412', labelKey: 'orange-800' }, { hex: '#92400e', labelKey: 'amber-800' },
        { hex: '#166534', labelKey: 'green-800' },  { hex: '#115e59', labelKey: 'teal-800' },
        { hex: '#1e40af', labelKey: 'blue-800' },   { hex: '#3730a3', labelKey: 'indigo-800' },
        { hex: '#6b21a8', labelKey: 'purple-800' }, { hex: '#9d174d', labelKey: 'pink-800' },
        // tom 900 (mais escuro)
        { hex: '#111827', labelKey: 'gray-900' },   { hex: '#7f1d1d', labelKey: 'red-900' },
        { hex: '#7c2d12', labelKey: 'orange-900' }, { hex: '#78350f', labelKey: 'amber-900' },
        { hex: '#14532d', labelKey: 'green-900' },  { hex: '#134e4a', labelKey: 'teal-900' },
        { hex: '#1e3a8a', labelKey: 'blue-900' },   { hex: '#312e81', labelKey: 'indigo-900' },
        { hex: '#581c87', labelKey: 'purple-900' }, { hex: '#831843', labelKey: 'pink-900' }
    ];

    /* ─────────────────────────────────────────────
     * [7c] ALINHAMENTO DE IMAGEM — modos e estilo
     * canonico (v4.7.0)
     * ───────────────────────────────────────────── */

    /* O estado do alinhamento mora no INLINE STYLE da propria <img>, nao numa
       classe: o HTML salvo e renderizado na pagina do host, que pode nao ter o
       CSS do plugin (mesmo motivo pelo qual o alinhamento de TEXTO ja vive em
       style.textAlign). Cada modo emite a string COMPLETA e canonica — trocar
       de modo reescreve tudo, nunca deixa residuo do modo anterior.

       `max-width:100%` acompanha os modos de alinhamento (a regra
       `.ozi-editor-content img` do CSS do editor nao viaja pro host, entao
       imagem com `width` fixo estoura container estreito la fora) — mas
       `none` e VAZIO de proposito: imagem sem alinhamento declarado tem que
       sair do editor byte a byte como saia antes da v4.7.0. Injetar style em
       imagem que ninguem pediu pra alinhar mudaria a saida de todo mundo, e
       o estouro no host e um problema pre-existente, de escopo proprio.

       `free` nao tem left/top aqui — a posicao inicial e calculada na hora
       (a partir de onde a imagem ja esta no fluxo) e depois pelo arrasto. */
    var IMAGE_ALIGN_STYLES = {
        none:   {},
        left:   { 'float': 'left',  'margin-top': '0', 'margin-right': '10px', 'margin-bottom': '10px', 'margin-left': '0',    'max-width': '100%' },
        right:  { 'float': 'right', 'margin-top': '0', 'margin-right': '0',    'margin-bottom': '10px', 'margin-left': '10px', 'max-width': '100%' },
        center: { 'display': 'block', 'margin-top': '0', 'margin-right': 'auto', 'margin-bottom': '10px', 'margin-left': 'auto', 'max-width': '100%' },
        free:   { 'position': 'absolute', 'max-width': '100%' }
    };

    /* ordem dos botoes na linha "Alinhamento" do popover */
    var IMAGE_ALIGN_MODES = [
        { mode: 'left',   icon: 'img-left',   labelKey: 'editor.imageAlignLeft'   },
        { mode: 'center', icon: 'img-center', labelKey: 'editor.imageAlignCenter' },
        { mode: 'right',  icon: 'img-right',  labelKey: 'editor.imageAlignRight'  },
        { mode: 'free',   icon: 'img-free',   labelKey: 'editor.imageAlignFree'   }
    ];

    /* propriedades que QUALQUER modo pode ter escrito — a lista de limpeza
       antes de aplicar o modo novo. Mantida junto dos modos de proposito:
       adicionar propriedade num modo sem adicionar aqui deixaria residuo. */
    var IMAGE_ALIGN_PROPS = [
        'float', 'display', 'position', 'left', 'top', 'max-width',
        'margin-top', 'margin-right', 'margin-bottom', 'margin-left'
    ];

    /* ─────────────────────────────────────────────
     * [7d] TABELA — grade do seletor e acoes de edicao  (v4.8.0)
     * ───────────────────────────────────────────── */

    /* a grade cobre o caso comum; os campos numericos sao o escape pra
       qualquer tamanho (decisao de 2026-09-14). Descartada a grade que
       cresce ao chegar na borda: o popover e `fixed` e posicionado contra o
       trigger desde a 4.7.1, entao mudar de tamanho durante o movimento
       obrigaria a reposicionar no meio do gesto. */
    var TABLE_GRID_COLS = 10;
    var TABLE_GRID_ROWS = 8;

    /* teto dos campos numericos. Nao e limite do HTML (uma tabela maior e
       valida) — e limite de UX: 50x50 ja sao 2500 celulas, e o que passa
       disso quase sempre e erro de digitacao. */
    var TABLE_MAX = 50;

    /* acoes do painel de edicao. Lista de TEXTO (mesmo padrao dos dropdowns
       de heading/classes) em vez de botoes com icone: seriam 7 SVGs novos
       pra acoes que so fazem sentido lidas. `danger` separa visualmente as
       3 destrutivas. */
    var TABLE_ACTIONS = [
        { action: 'rowAbove',  labelKey: 'editor.tableRowAbove'  },
        { action: 'rowBelow',  labelKey: 'editor.tableRowBelow'  },
        { action: 'colBefore', labelKey: 'editor.tableColBefore' },
        { action: 'colAfter',  labelKey: 'editor.tableColAfter'  },
        { action: 'rowRemove', labelKey: 'editor.tableRowRemove', danger: true },
        { action: 'colRemove', labelKey: 'editor.tableColRemove', danger: true },
        { action: 'remove',    labelKey: 'editor.tableRemove',    danger: true }
    ];

    /* inteiro em [1, TABLE_MAX]; qualquer lixo cai no fallback. Os campos ja
       sao <input type=number min=1 max=50>, mas o valor chega aqui como
       STRING do DOM e o usuario pode digitar o que quiser dentro dele — o
       `max` do input nao impede a digitacao, so marca :invalid. */
    function _tableSize(value, fallback) {
        var n = parseInt(value, 10);
        if (!isFinite(n) || n < 1) return fallback;
        return Math.min(n, TABLE_MAX);
    }

    /* ─────────────────────────────────────────────
     * [8] CONSTRUCTOR
     * ───────────────────────────────────────────── */

    function OziEditor(element) {
        this.textarea = element;

        /* [FEAT-7] detecta type pelo atributo presente */
        var keyHtml = this.textarea.getAttribute('data-ozi-editor-html');
        var keyMd   = this.textarea.getAttribute('data-ozi-editor-md');

        if (keyHtml !== null) {
            this.editorType = 'html';
            this.key        = _trim(String(keyHtml));
        } else if (keyMd !== null) {
            this.editorType = 'md';
            this.key        = _trim(String(keyMd));
        } else {
            throw new Error(
                '[OZI:editor] Atributo obrigatório ausente.\n' +
                'Use data-ozi-editor-html="key" ou data-ozi-editor-md="key"'
            );
        }

        if (!this.key) {
            throw new Error('[OZI:editor] Chave obrigatória.\nExemplo: data-ozi-editor-html="descricao"');
        }

        this.uid = 'ozi-editor-' + (++_counter);

        var pluginConf = window.OZI && window.OZI.conf &&
            window.OZI.conf.components && window.OZI.conf.components.editor;

        var _devThemesByType = pluginConf && pluginConf.themes;
        var _devThemes       = _devThemesByType && _devThemesByType[this.editorType];
        var _builtIn         = this.editorType === 'md' ? BUILT_IN_THEMES_MD : BUILT_IN_THEMES_HTML;

        var _themeName   = this.textarea.getAttribute('data-ozi-editor-theme');
        var _themeStr    = _resolveTheme(_themeName, _devThemes, _builtIn);
        var _defTheme    = pluginConf && pluginConf.defaultTheme;
        var _defThemeStr = _resolveTheme(_defTheme, _devThemes, _builtIn);
        var _defaultTools = this.editorType === 'md' ? DEFAULT_TOOLS_MD : DEFAULT_TOOLS_HTML;

        this.toolsRaw =
            _themeStr                                          ||  /* 1. theme no elemento */
            this.textarea.getAttribute('data-ozi-editor-tools') ||  /* 2. tools direto */
            _defThemeStr                                       ||  /* 3. defaultTheme do conf */
            (pluginConf && pluginConf.defaultTools)            ||  /* 4. defaultTools (compat) */
            _defaultTools;                                          /* 5. fallback por type */

        this.height      = this.textarea.getAttribute('data-ozi-editor-height') || '200px';
        this.placeholder = this.textarea.getAttribute('data-ozi-editor-placeholder') || _t('editor.placeholder');
        /* image: upload real so existe se o host declarar o endpoint — sem
           isso a secao de upload do popover nem e construida (ver
           _buildImageButton) */
        this.uploadUrl   = this.textarea.getAttribute('data-ozi-editor-upload-url') || null;
        /* [v4.8.0 FIX] o fallback `#3b82f6` nao e enfeite: este valor e
           escrito INLINE no wrap (_buildUI), e estilo inline vence a regra do
           CSS — que ja declarava `var(--ozi-color-primary, #3b82f6)` com
           fallback justamente pra isso. Sem repeti-lo aqui, um host que nao
           linkou `themes/<tema>/tokens.css` deixava `--ozi-color-primary`
           indefinida, `--ozi-editor-uicolor` computava pra guaranteed-invalid
           e TODA regra que dependia dela sumia em silencio (o anel de foco do
           content, a borda do botao de alinhamento ativo). Passou despercebido
           enquanto so afetava detalhe de contorno; a grade do seletor de
           tabela usa essa cor como FUNDO e o botao Inserir a usa com texto
           branco — sem ela, o retangulo aceso nao acende e o botao fica branco
           no branco. Medido num probe headless antes de corrigir. */
        this.uicolor     = this.textarea.getAttribute('data-ozi-editor-uicolor')
            || (pluginConf && pluginConf.uicolor)
            || 'var(--ozi-color-primary, #3b82f6)';

        this.isDisabled      = _parseBool(this.textarea, 'data-ozi-editor-disabled', false);
        this.isRequired      = _parseBool(this.textarea, 'data-ozi-editor-required', false);
        // debug local por instância (convenção `data-ozi-{plugin}-log`, espelha o zldLog do ozi-loaddata)
        this.debug           = _parseBool(this.textarea, 'data-ozi-editor-log', false);
        this.requiredMessage = this.textarea.getAttribute('data-ozi-editor-required-message') || _t('common.required');

        this.classDefs   = _parseClassDefs(this.textarea.getAttribute('data-ozi-editor-class') || '');
        this.showCounter = _parseBool(this.textarea, 'data-ozi-editor-counter', false);

        /* toolbar responsiva — data-ozi-editor-tools-{sm,md,lg,xl,xxl}, cada
           uma uma string de layout COMPLETA e independente (nao um delta da
           base), min-width estilo Bootstrap: -sm vale da largura sm pra
           cima. So le atributo direto (nao passa pela prioridade de
           tema/conf do toolsRaw acima — breakpoint e sempre por atributo). */
        var _elRef = this.textarea;
        /* modo Scroll (retomado 2026-08-31) — data-ozi-editor-tools-scroll[-{bp}]
           e combinavel com os breakpoints normais: cada nivel escolhe wrap ou
           scroll independentemente. Filtro e OR (um nivel pode existir SO via
           -scroll-{bp}, sem o -{bp} wrap correspondente); conflito no mesmo
           nivel (os dois declarados) resolve com scroll vencendo (opt-in
           explicito > fallback implicito) — nao precisa validar/travar. */
        this.toolsScrollBase = _elRef.getAttribute('data-ozi-editor-tools-scroll') || null;
        this.toolsBreakpoints = TOOLBAR_BREAKPOINTS
            .map(function (bp) {
                var wrapRaw   = _elRef.getAttribute('data-ozi-editor-tools-' + bp.name);
                var scrollRaw = _elRef.getAttribute('data-ozi-editor-tools-scroll-' + bp.name);
                if (!wrapRaw && !scrollRaw) return null;
                return scrollRaw
                    ? { bp: bp.name, raw: scrollRaw, mode: 'scroll' }
                    : { bp: bp.name, raw: wrapRaw,   mode: 'wrap' };
            })
            .filter(Boolean);

        this.isSourceMode = false;
        this._savedRange  = null;
        this._listeners   = [];
        this._popovers    = [];
        /* seq. incremental de id de popover — cada tool com popover
           (heading/classes/link/color/highlight/image) pode aparecer em mais
           de uma variante de breakpoint simultaneamente no DOM (toolbar
           responsiva); id unico evita que _registerPopover/_popoverEntry
           colidam por nome bruto do tool (armadilha corrigida antes de
           introduzir a feature que a tornaria realista, ver
           _buildPopoverButton/_buildHeadingButton/_buildClassesButton) */
        this._popoverSeq  = 0;
        this._collapseSeq = 0;
        this._scrollTracks = [];   /* { track, prevBtn, nextBtn } por track em modo Scroll */

        this.wrap             = null;
        this.toolbar          = null;
        this.content          = null;
        this.source           = null;
        this.feedback         = null;
        this.counter          = null;
    }

    /* rastreia listeners para remocao no destroy */
    /* `opts` (v4.7.1) so e usado pelo reposicionamento de popover flutuante,
       que precisa de CAPTURE: o evento `scroll` nao borbulha, entao um
       listener normal no window nao enxerga o scroll do proprio
       `.ozi-editor-content` nem o de qualquer container do host. O mesmo
       valor e devolvido ao removeEventListener no destroy (capture faz parte
       da identidade do listener — sem isso ele nao seria removido). */
    OziEditor.prototype._on = function (target, type, handler, opts) {
        target.addEventListener(type, handler, opts);
        this._listeners.push({ target: target, type: type, handler: handler, opts: opts });
    };

    /* ─────────────────────────────────────────────
     * [9] LIFECYCLE
     * ───────────────────────────────────────────── */

    // Log de debug local (só quando `data-ozi-editor-log` está ligado neste widget).
    // `trace:true` usa console.trace p/ capturar QUEM chamou (ex.: destroy vindo do host).
    OziEditor.prototype._dbg = function (msg, data, trace) {
        if (!this.debug) return;
        var prefix = '[OZI:editor#' + this.uid + ']';
        var fn = trace ? console.trace : console.log;
        if (data !== undefined) fn.call(console, prefix, msg, data);
        else                    fn.call(console, prefix, msg);
    };

    OziEditor.prototype.init = function () {
        if (_isInited(this.textarea, this.editorType)) return;
        _setInited(this.textarea, this.editorType, true);

        this._dbg('init() key=' + this.key + ' type=' + this.editorType);
        this._buildUI();
        this._loadIcons();
        this._syncFromTextarea();
        this._bindEvents();
        this._updateToolbarState();
        this._updateCounter();

        /* modo Scroll: so registra listener de scroll/resize se a instancia
           realmente usa o modo (zero overhead nas demais) */
        if (this._scrollTracks && this._scrollTracks.length) {
            this._bindScrollTrackEvents();
            this._updateScrollArrows();
        }

        if (this.isDisabled) this._setDisabled(true);

        _instances[this.key] = this;

        _emitEvent(this.textarea, 'ozi:init', {
            component: 'ozi-editor', name: this.key,
            value: this.textarea.value, type: this.editorType, source: 'api'
        });
    };

    OziEditor.prototype.destroy = function () {
        this._dbg('destroy() chamado — trace de quem chamou:', undefined, true);
        (this._listeners || []).forEach(function (l) { l.target.removeEventListener(l.type, l.handler, l.opts); });
        this._listeners = [];
        if (this.wrap && this.wrap.parentNode) this.wrap.parentNode.removeChild(this.wrap);
        this.textarea.style.display = '';
        _setInited(this.textarea, this.editorType, false);
        delete _instances[this.key];
        _emitEvent(this.textarea, 'ozi:destroy', {
            component: 'ozi-editor', name: this.key,
            value: null, type: this.editorType, source: 'api'
        });
    };

    OziEditor.prototype.reload = function () {
        var el = this.textarea;
        this.destroy();
        var fresh = new OziEditor(el);
        fresh.init();
        return fresh;
    };

    /* ─────────────────────────────────────────────
     * [10] BUILD UI
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildUI = function () {
        var self = this;

        self.wrap = _el('div', 'ozi-editor-wrap', { 'data-ozi-editor-type': self.editorType });
        self.wrap.style.setProperty('--ozi-editor-uicolor', self.uicolor);

        self.toolbar = _el('div', 'ozi-editor-toolbar');
        self._buildToolbarButtons();

        self.content = _el('div', 'ozi-editor-content', {
            contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true',
            'data-placeholder': self.placeholder
        });
        self.content.style.minHeight = self.height;

        var sourcePlaceholder = self.editorType === 'md' ? _t('editor.source.md') : _t('editor.source');
        self.source = _el('textarea', 'ozi-editor-source', { placeholder: sourcePlaceholder });
        self.source.style.minHeight = self.height;
        self.source.style.display = 'none';

        var feedbackClass = _classMap('feedback', 'ozi-feedback');
        self.feedback = _el('div', feedbackClass + ' ozi-editor-feedback');
        self.feedback.style.display = 'none';

        self.wrap.appendChild(self.toolbar);
        self.wrap.appendChild(self.content);
        self.wrap.appendChild(self.source);

        if (self.showCounter) {
            var footer = _el('div', 'ozi-editor-footer');
            self.counter = _el('span', 'ozi-editor-counter');
            footer.appendChild(self.counter);
            self.wrap.appendChild(footer);
        }

        self.wrap.appendChild(self.feedback);

        self.textarea.style.display = 'none';
        self.textarea.insertAdjacentElement('afterend', self.wrap);
    };

    /* ─────────────────────────────────────────────
     * [11] TOOLBAR BUTTONS
     * ───────────────────────────────────────────── */

    /* sem breakpoints declarados no elemento (e sem modo Scroll na base):
       caminho identico a antes da feature de toolbar responsiva —
       self.toolbar recebe as linhas direto, nenhum wrapper novo, DOM
       byte-a-byte igual ao de hoje (criterio de aceite explicito de zero
       regressao nas instancias existentes). Com breakpoints OU modo Scroll:
       cada variante (base + cada -sm/-md/... declarado) vira uma subarvore
       DOM independente e completa (nao uma lista plana com marcador por
       botao — ver ozi-editor-toolbar-responsiva.md, decisao tomada em
       2026-08-31): evita quebrar :first-child/:last-child dos grupos
       (usados pro arredondamento de borda) e permite o mesmo tool estar
       solto num breakpoint e dentro de {} em outro sem reparenting. CSS
       decide qual variante mostrar por largura — zero JS no resize (o modo
       Scroll reage so ao PROPRIO scroll da track / resize da janela pra
       habilitar/desabilitar seta, nunca reconstroi DOM). */
    OziEditor.prototype._buildToolbarButtons = function () {
        var self = this;
        var variants = self._resolveToolsVariants();
        self.toolsVariants = variants;

        if (variants.length === 1 && variants[0].mode !== 'scroll') {
            self._buildToolbarButtonsInto(self.toolbar, variants[0].layout);
            return;
        }

        variants.forEach(function (v, i) {
            var attrs = {};
            if (v.bp) attrs['data-ozi-editor-toolbar-bp'] = v.bp;
            var next = variants[i + 1];
            if (next) attrs['data-ozi-editor-toolbar-bp-until'] = next.bp;
            var container = _el('div', 'ozi-editor-toolbar-variant', attrs);
            if (v.mode === 'scroll') self._buildScrollToolbarInto(container, v.layout);
            else                     self._buildToolbarButtonsInto(container, v.layout);
            self.toolbar.appendChild(container);
        });
    };

    /* base (bp:null) + cada -sm/-md/-lg/-xl/-xxl realmente declarado no
       elemento, ja em ordem ascendente (TOOLBAR_BREAKPOINTS e ascendente e a
       base sempre entra primeiro). Cada string e parseada isoladamente —
       nenhuma "reducao"/delta entre variantes. Base usa toolsScrollBase
       quando presente (modo Scroll vence sobre o toolsRaw/wrap de sempre). */
    OziEditor.prototype._resolveToolsVariants = function () {
        var self = this;
        var baseMode = self.toolsScrollBase ? 'scroll' : 'wrap';
        var variants = [{ bp: null, raw: self.toolsScrollBase || self.toolsRaw, mode: baseMode }];
        (self.toolsBreakpoints || []).forEach(function (v) { variants.push(v); });
        variants.forEach(function (v) { v.layout = _parseToolsLayout(v.raw); });
        return variants;
    };

    /* corpo comum de group/tool/collapse — extraido pra ser reusado tanto
       pelo modo wrap (uma linha .ozi-editor-toolbar-row por vez) quanto pelo
       modo Scroll (todos os items numa unica track, ver
       _buildScrollToolbarInto). `panels` e a lista de paineis de {} que o
       CHAMADOR decide onde anexar (irmao da row no modo wrap; irmao de toda
       a .ozi-editor-toolbar-scroll no modo scroll — nunca dentro da area
       com overflow-x, senao ficaria cortado). */
    OziEditor.prototype._appendToolItemsInto = function (rowTarget, items, panels) {
        var self = this;
        items.forEach(function (item) {
            if (item.type === 'group') {
                var groupEl = _el('div', 'ozi-editor-toolbar-group');
                item.tools.forEach(function (tool) {
                    var btn = self._buildToolButton(tool);
                    if (btn) groupEl.appendChild(btn);
                });
                if (groupEl.children.length) rowTarget.appendChild(groupEl);
            } else if (item.type === 'tool') {
                var btn = self._buildToolButton(item.tool);
                if (btn) rowTarget.appendChild(btn);
            } else if (item.type === 'collapse') {
                var id = 'c' + (++self._collapseSeq);
                var trigger = self._buildCollapseTrigger(id, item.defaultOpen);
                if (trigger) {
                    rowTarget.appendChild(trigger);
                    panels.push(self._buildCollapsePanel(id, item));
                }
            }
        });
    };

    OziEditor.prototype._buildToolbarButtonsInto = function (target, layout) {
        var self = this;

        layout.forEach(function (row) {
            var rowEl = _el('div', 'ozi-editor-toolbar-row');
            var panels = [];   /* paineis de {} desta linha — inseridos DEPOIS da rowEl, como irmaos */

            self._appendToolItemsInto(rowEl, row.items, panels);

            if (rowEl.children.length) {
                target.appendChild(rowEl);
                panels.forEach(function (p) { target.appendChild(p); });
            }
        });
    };

    /* ─────────────────────────────────────────────
     * [11a] TOOLBAR — MODO SCROLL (retomado 2026-08-31, secao 3c do roadmap)
     * Toolbar vira UMA linha com overflow-x nativo + 2 setas fixas que fazem
     * scrollBy() na track. `;` no valor do atributo -scroll[-{bp}] e
     * FLATTENED aqui (todas as rows viram uma lista unica de items, ordem
     * preservada) — decisao confirmada com o usuario: "unica linha", nao
     * multiplos scrollers empilhados. Paineis de {} (caso de borda aceito,
     * nao bloqueado) vao pro `target` EXTERNO — fora da track, senao
     * ficariam cortados dentro do scroller horizontal.
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildScrollToolbarInto = function (target, layout) {
        var self = this;
        var flatItems = [];
        layout.forEach(function (row) { flatItems = flatItems.concat(row.items); });

        var track  = _el('div', 'ozi-editor-toolbar-scroll-track');
        var panels = [];
        self._appendToolItemsInto(track, flatItems, panels);
        if (!track.children.length) return;   /* nada pra rolar, nao gera UI vazia */

        var prevBtn = self._buildScrollArrow('prev');
        var nextBtn = self._buildScrollArrow('next');
        var wrap = _el('div', 'ozi-editor-toolbar-scroll');
        wrap.appendChild(prevBtn);
        wrap.appendChild(track);
        wrap.appendChild(nextBtn);

        target.appendChild(wrap);
        panels.forEach(function (p) { target.appendChild(p); });

        self._scrollTracks.push({ track: track, prevBtn: prevBtn, nextBtn: nextBtn });
    };

    OziEditor.prototype._buildScrollArrow = function (dir) {
        var label = _t(dir === 'prev' ? 'editor.scrollPrev' : 'editor.scrollNext');
        var btn = _el('button', 'ozi-editor-btn ozi-editor-btn--scroll-' + dir, {
            type: 'button', 'data-ozi-editor-scroll-dir': dir, title: label, 'aria-label': label
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon ozi-editor-scroll-arrow-icon', { 'aria-hidden': 'true' }));
        return btn;
    };

    /* habilita/desabilita as setas conforme a posicao real de scroll de cada
       track — chamada 1x no init (apos o wrap ja estar no DOM real) e depois
       reage a 'scroll' da propria track e 'resize' da janela (debounced),
       nunca reconstroi DOM. */
    OziEditor.prototype._updateScrollArrows = function () {
        (this._scrollTracks || []).forEach(function (entry) {
            var track = entry.track;
            var max = track.scrollWidth - track.clientWidth;
            entry.prevBtn.disabled = track.scrollLeft <= 0;
            entry.nextBtn.disabled = max <= 0 || track.scrollLeft >= max - 1;
        });
    };

    OziEditor.prototype._bindScrollTrackEvents = function () {
        var self = this;
        self._scrollTracks.forEach(function (entry) {
            self._on(entry.track, 'scroll', function () { self._updateScrollArrows(); });
        });
        self._on(window, 'resize', function () {
            clearTimeout(self._scrollResizeTimer);
            self._scrollResizeTimer = setTimeout(function () { self._updateScrollArrows(); }, 150);
        });
    };

    OziEditor.prototype._buildToolButton = function (tool) {
        var self = this;

        if (!TOOL_META[tool]) {
            return self._buildIncompatibleButton(tool, _t('editor.unknown') + ': ' + tool);
        }
        if (self.editorType === 'md' && BLOCKED_IN_MD[tool]) {
            return self._buildIncompatibleButton(tool, _t('editor.incompatible') + ': ' + tool);
        }

        var meta  = TOOL_META[tool];
        var label = _t(meta.labelKey);
        if (tool === 'source' && self.editorType === 'md') label = _t('editor.source.md');

        if (tool === 'heading')   return self._buildHeadingButton(label);
        if (tool === 'classes')   return self._buildClassesButton(label);
        if (tool === 'link')      return self._buildLinkButton(label);
        if (tool === 'color')     return self._buildColorButton('color', label);
        if (tool === 'highlight') return self._buildColorButton('highlight', label);
        if (tool === 'image')     return self._buildImageButton(label);
        if (tool === 'table')     return self._buildTableButton(label);

        var btn = _el('button', 'ozi-editor-btn', {
            type: 'button', 'data-ozi-editor-tool': tool, title: label, 'aria-label': label
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' }));
        return btn;
    };

    OziEditor.prototype._buildIncompatibleButton = function (tool, titleMsg) {
        var btn = _el('button', 'ozi-editor-btn ozi-editor-btn--incompatible', {
            type: 'button', 'data-ozi-editor-tool-blocked': tool,
            title: titleMsg, 'aria-label': titleMsg, 'aria-disabled': 'true'
        });
        btn.disabled = true;
        var span = _el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' });
        span.textContent = '?';
        btn.appendChild(span);
        return btn;
    };

    /* ─────────────────────────────────────────────
     * [11b] GRUPO COLAPSAVEL { -/+ , ... } — toolbar responsiva (2026-08-31).
     * Chrome estrutural, NAO uma ferramenta do TOOL_META: deliberadamente
     * sem data-ozi-editor-tool (nao deve cair no dispatcher generico
     * _runTool, ver seletor em _bindEvents). Trigger+painel ligados por
     * data-ozi-editor-collapse-id (nao por adjacencia de DOM — cobre o caso
     * de duas {} na mesma linha sem ambiguidade). Painel e IRMAO da row (nao
     * filho) — 2a linha inline empurrando o conteudo, NAO popover flutuante
     * (sem position:absolute, ao contrario de link/color/image).
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildCollapseTrigger = function (id, defaultOpen) {
        var label = _t(defaultOpen ? 'editor.fewerTools' : 'editor.moreTools');
        var btn = _el('button', 'ozi-editor-btn ozi-editor-btn--collapse-toggle' + (defaultOpen ? ' is-open' : ''), {
            type: 'button', 'data-ozi-editor-collapse-id': id,
            title: label, 'aria-label': label, 'aria-expanded': defaultOpen ? 'true' : 'false'
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon ozi-editor-collapse-chevron', { 'aria-hidden': 'true' }));
        return btn;
    };

    OziEditor.prototype._buildCollapsePanel = function (id, collapseNode) {
        var panel = _el('div', 'ozi-editor-toolbar-collapse', {
            'data-ozi-editor-collapse-panel': '', 'data-ozi-editor-collapse-id': id
        });
        panel.style.display = collapseNode.defaultOpen ? '' : 'none';
        this._buildToolbarButtonsInto(panel, collapseNode.layout);
        return panel;
    };

    /* ─────────────────────────────────────────────
     * [11b] POPOVER GENERICO — mecanica compartilhada
     * (abrir/fechar, fechar ao clicar fora, fechar os
     * outros ao abrir um, aria-expanded). Extraida do
     * padrao que heading/classes ja usavam (Fase 2,
     * passo 0 do roadmap) — o CONTEUDO de cada popover
     * continua especifico (lista de itens vs. formulario).
     *
     * `name` e um ID UNICO por instancia de popover (ex. 'heading-3',
     * 'link-7'), nao o nome bruto do tool — desde a toolbar responsiva
     * (2026-08-31) o mesmo tool pode aparecer em mais de uma variante de
     * breakpoint simultaneamente no DOM (heading no base E dentro do {} do
     * -sm, por exemplo); chave por nome bruto faria _popoverEntry sempre
     * devolver a ULTIMA instancia registrada, abrindo o popover errado (as
     * vezes escondido dentro de uma variante de breakpoint inativa — nem
     * aparece na tela). Ver _buildPopoverButton/_buildHeadingButton/
     * _buildClassesButton (geram o id) e _popoverIdFromElement/
     * _toolFromPopoverId (resolvem id/tool a partir do elemento clicado).
     * ───────────────────────────────────────────── */

    OziEditor.prototype._registerPopover = function (name, popoverEl, triggerSelector, onOpen) {
        this._popovers.push({ name: name, el: popoverEl, triggerSelector: triggerSelector, onOpen: onOpen || null });
    };

    OziEditor.prototype._popoverEntry = function (name) {
        var found = null;
        (this._popovers || []).forEach(function (p) { if (p.name === name) found = p; });
        return found;
    };

    /* resolve o id unico do popover a partir de QUALQUER elemento dentro do
       seu wrap (o proprio trigger, um item de dentro do popover, etc.) —
       usado por todo handler delegado que precisa saber "de qual instancia
       de popover veio este clique" sem depender de campo singular na
       instancia do editor. */
    OziEditor.prototype._popoverIdFromElement = function (el) {
        var wrap = this._closestIn(el, '[data-ozi-editor-popover-wrap]');
        return wrap ? wrap.getAttribute('data-ozi-editor-popover-wrap') : null;
    };

    /* nome semantico do tool ('color'/'highlight'/'heading'/...) a partir de
       um id unico ('color-5') — convencao id = tool + '-' + sequencial;
       nenhum tool do TOOL_META tem hifen no nome, entao o 1o segmento e
       sempre o tool. Usado onde o comportamento depende do TOOL (ex.:
       foreColor vs hiliteColor), nao da instancia especifica. */
    OziEditor.prototype._toolFromPopoverId = function (id) {
        return id ? id.split('-')[0] : null;
    };

    /* acha o trigger VISIVEL de um tool (offsetParent null = dentro de
       ancestral display:none, caso das variantes de breakpoint inativas) —
       usado só onde nao ha elemento clicado pra derivar o id (ex.: clique
       numa <img> do content, que nao e um clique no trigger da toolbar). */
    OziEditor.prototype._visibleToolTrigger = function (tool) {
        var candidates = this.wrap.querySelectorAll('.ozi-editor-btn[data-ozi-editor-tool="' + tool + '"]');
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i].offsetParent !== null) return candidates[i];
        }
        return candidates[0] || null;
    };

    /* ─────────────────────────────────────────────
     * [11c] POSICIONAMENTO FLUTUANTE  (v4.7.1)
     *
     * Ate a 4.7.0 todo popover/dropdown era `position:absolute` ancorado no
     * proprio wrap do botao — ou seja, vivia DENTRO da caixa do editor e
     * obedecia a qualquer `overflow` de ancestral. Isso cortava a ferramenta
     * em dois lugares reais, medidos:
     *
     *   1. `.ozi-editor-wrap { overflow:hidden }` (o radius da moldura) — o
     *      popover de imagem tem ~260px e um editor com o `min-height`
     *      padrao tem ~257px: estourava ~50px e o `Aplicar`/`Remover` ficava
     *      NAO-CLICAVEL (elementFromPoint no centro do botao devolvia <html>).
     *   2. `.ozi-editor-toolbar-scroll-track { overflow-x:auto }` (modo Scroll
     *      da toolbar responsiva, 4.6.0) — a track tem ~44px de altura, entao
     *      o popover estourava ~236px E ainda dava scroll VERTICAL na barra
     *      de ferramentas (scrollHeight 298 x clientHeight 34).
     *
     * `overflow:visible` no wrap so resolveria (1). A correcao e tirar o
     * popover do fluxo clipado: ele passa a `position:fixed` (viewport) e
     * recebe coordenadas calculadas contra o rect do TRIGGER. O DOM nao muda
     * — o popover continua sendo filho do seu `.ozi-editor-popover-wrap`, o
     * que preserva toda a delegacao por `closest()`
     * (`_popoverIdFromElement`/`_closeOutsidePopovers`) e o `destroy()`.
     *
     * De brinde, ter as coordenadas na mao resolve o que o absolute nunca
     * cobriu: VIRAR PRA CIMA quando nao cabe embaixo (editor no rodape da
     * tela) e clamp lateral. Quando nao cabe dos dois lados, o lado mais
     * folgado ganha `max-height` + scroll proprio (ver o CSS) em vez de
     * vazar pra fora da tela.
     *
     * Ressalva conhecida: um ancestral com `transform`/`filter`/`perspective`/
     * `contain` vira containing block do `fixed` e as coordenadas de viewport
     * ficariam deslocadas. E o mesmo custo que qualquer UI flutuante paga
     * (Bootstrap/Popper incluidos) e nao ocorre nos temas do plugin.
     * ───────────────────────────────────────────── */

    var FLOAT_GAP  = 4;    /* px entre o trigger e o popover */
    var FLOAT_EDGE = 8;    /* px de respiro minimo ate a borda da viewport */
    var FLOAT_MIN  = 96;   /* px — altura util minima antes de desistir do lado */

    OziEditor.prototype._positionFloating = function (el, trigger) {
        if (!el || !trigger) return;

        /* a medicao precisa do elemento sem limite do posicionamento
           anterior, senao o max-height de uma abertura passada encolheria a
           altura natural e o lado escolhido agora sairia errado */
        el.style.maxHeight = '';

        var r  = trigger.getBoundingClientRect();
        var vw = document.documentElement.clientWidth;
        var vh = document.documentElement.clientHeight;
        var w  = el.offsetWidth;
        var h  = el.offsetHeight;

        var left = r.left;
        if (left + w > vw - FLOAT_EDGE) left = vw - FLOAT_EDGE - w;
        if (left < FLOAT_EDGE)          left = FLOAT_EDGE;

        var below = vh - r.bottom - FLOAT_GAP - FLOAT_EDGE;   /* espaco abaixo do trigger */
        var above = r.top - FLOAT_GAP - FLOAT_EDGE;           /* espaco acima do trigger   */
        var top;

        /* preferencia por abrir pra baixo (o comportamento historico); so
           vira pra cima quando NAO cabe embaixo e cabe melhor em cima */
        if (h <= below || below >= above) {
            top = r.bottom + FLOAT_GAP;
            if (h > below) el.style.maxHeight = Math.max(below, FLOAT_MIN) + 'px';
        } else {
            top = r.top - FLOAT_GAP - Math.min(h, above);
            if (h > above) {
                el.style.maxHeight = Math.max(above, FLOAT_MIN) + 'px';
                top = r.top - FLOAT_GAP - Math.max(above, FLOAT_MIN);
            }
        }
        if (top < FLOAT_EDGE) top = FLOAT_EDGE;

        el.style.left = Math.round(left) + 'px';
        el.style.top  = Math.round(top)  + 'px';
    };

    /* reposiciona o que estiver aberto — ligado a scroll (em CAPTURE, o
       evento nao borbulha) e resize. Um popover `fixed` nao acompanha o
       trigger sozinho: sem isso ele ficaria parado na tela enquanto a pagina
       rola por baixo. Se o trigger saiu inteiro da viewport nao ha o que
       ancorar, entao fecha (o popover flutuando sozinho sobre outra parte da
       pagina seria pior que fechar). */
    OziEditor.prototype._repositionOpenPopovers = function () {
        var self = this;
        (self._popovers || []).forEach(function (p) {
            if (!_isShown(p.el)) return;
            var trig = self.wrap.querySelector(p.triggerSelector);
            if (!trig) return;
            var r  = trig.getBoundingClientRect();
            var vh = document.documentElement.clientHeight;
            var vw = document.documentElement.clientWidth;
            if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
                self._setPopoverOpen(p, false);
                return;
            }
            self._positionFloating(p.el, trig);
        });
    };

    OziEditor.prototype._setPopoverOpen = function (entry, open) {
        if (!entry) return;
        var trig = this.wrap.querySelector(entry.triggerSelector);

        if (open) {
            /* medir exige estar renderizado, mas mostrar ANTES de posicionar
               deixaria um frame na coordenada antiga — `visibility` esconde
               sem tirar do layout, que e exatamente o que a medicao precisa */
            entry.el.style.visibility = 'hidden';
            entry.el.style.display    = '';
            this._positionFloating(entry.el, trig);
            entry.el.style.visibility = '';
        } else {
            entry.el.style.display = 'none';
        }

        if (trig) trig.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    OziEditor.prototype._togglePopover = function (name, forceClose) {
        var self  = this;
        if (!name) return;
        var entry = self._popoverEntry(name);
        if (!entry) return;

        var wasOpen = _isShown(entry.el);

        (self._popovers || []).forEach(function (p) {
            if (p.name !== name && _isShown(p.el)) self._setPopoverOpen(p, false);
        });

        if (forceClose || wasOpen) { self._setPopoverOpen(entry, false); return; }

        if (entry.onOpen) entry.onOpen(entry.el);
        self._setPopoverOpen(entry, true);
    };

    /* abre o popover incondicionalmente (nao alterna) — usado pelo clique
       direto numa imagem do content (Fase 3, ajuste pos-revisao): clicar
       numa 2a imagem enquanto o popover ja esta aberto precisa ATUALIZAR o
       conteudo pra ela, nao fechar. _togglePopover fecharia nesse caso
       (wasOpen=true); esta variante nao olha o estado atual. */
    OziEditor.prototype._openPopover = function (name) {
        var self  = this;
        if (!name) return;
        var entry = self._popoverEntry(name);
        if (!entry) return;

        (self._popovers || []).forEach(function (p) {
            if (p.name !== name && _isShown(p.el)) self._setPopoverOpen(p, false);
        });

        if (entry.onOpen) entry.onOpen(entry.el);
        self._setPopoverOpen(entry, true);
    };

    /* fecha qualquer popover aberto cujo wrap nao contenha o alvo do clique —
       cada wrap (heading/classes/link/color/highlight/image) carrega
       data-ozi-editor-popover-wrap="<id>" pra permitir este loop generico */
    OziEditor.prototype._closeOutsidePopovers = function (target) {
        var self = this;
        (self._popovers || []).forEach(function (p) {
            if (!_isShown(p.el)) return;
            var wrapSel = '[data-ozi-editor-popover-wrap="' + p.name + '"]';
            if (!(target.closest && target.closest(wrapSel))) self._setPopoverOpen(p, false);
        });
    };

    /* fecha todos, sem alvo de referencia (v4.7.0 — usado ao iniciar o
       arrasto de uma imagem livre: o popover flutua logo abaixo da toolbar,
       em cima da area onde o arrasto acontece) */
    OziEditor.prototype._closeAllPopovers = function () {
        var self = this;
        (self._popovers || []).forEach(function (p) {
            if (_isShown(p.el)) self._setPopoverOpen(p, false);
        });
    };

    /* esqueleto wrap+botao+popover reutilizado por link/color/highlight/
       image — heading/classes mantem construcao propria (lista de itens,
       nao form), mas seguem a MESMA convencao de id unico. */
    OziEditor.prototype._buildPopoverButton = function (tool, label, buildContentFn, onOpen) {
        var self = this;
        var id = tool + '-' + (++self._popoverSeq);

        var wrap = _el('div', 'ozi-editor-popover-wrap', { 'data-ozi-editor-popover-wrap': id });
        var btn  = _el('button', 'ozi-editor-btn', {
            type: 'button', 'data-ozi-editor-tool': tool, 'data-ozi-editor-popover-id': id,
            title: label, 'aria-label': label, 'aria-haspopup': 'true', 'aria-expanded': 'false'
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' }));

        var popover = _el('div', 'ozi-editor-popover', { role: 'dialog' });
        popover.style.display = 'none';
        buildContentFn(popover);

        self._registerPopover(id, popover, '[data-ozi-editor-popover-id="' + id + '"]', onOpen);

        wrap.appendChild(btn); wrap.appendChild(popover);
        return wrap;
    };

    /* ─────────────────────────────────────────────
     * [12] DROPDOWN DE HEADINGS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildHeadingButton = function (label) {
        var self = this;
        var id = 'heading-' + (++self._popoverSeq);

        var wrap = _el('div', 'ozi-editor-heading-wrap', { 'data-ozi-editor-popover-wrap': id });
        var btn  = _el('button', 'ozi-editor-btn ozi-editor-btn--heading', {
            type: 'button', 'data-ozi-editor-tool': 'heading', 'data-ozi-editor-popover-id': id,
            title: label, 'aria-label': label, 'aria-haspopup': 'true', 'aria-expanded': 'false'
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' }));

        var dropdown = _el('div', 'ozi-editor-heading-dropdown', { role: 'menu' });
        dropdown.style.display = 'none';

        ['h1','h2','h3','h4','h5','h6'].forEach(function (level) {
            var item  = _el('button', 'ozi-editor-heading-item', { type: 'button', 'data-ozi-heading': level, role: 'menuitem' });
            var check = _el('span', 'ozi-editor-heading-check', { 'aria-hidden': 'true' });
            check.innerHTML = '&#10003;';
            var tagEl = _el('span', 'ozi-editor-heading-tag');   tagEl.textContent = level.toUpperCase();
            var lblEl = _el('span', 'ozi-editor-heading-label'); lblEl.textContent = _t('editor.' + level);
            item.appendChild(check); item.appendChild(tagEl); item.appendChild(lblEl);
            dropdown.appendChild(item);
        });

        self._registerPopover(id, dropdown, '[data-ozi-editor-popover-id="' + id + '"]', function (dropdownEl) {
            self._updateHeadingDropdownChecks(dropdownEl);
        });
        wrap.appendChild(btn); wrap.appendChild(dropdown);
        return wrap;
    };

    OziEditor.prototype._updateHeadingDropdownChecks = function (dropdown) {
        var self = this;
        if (!dropdown) return;

        var block      = self._getClosestBlockElement();
        var currentTag = block ? String(block.tagName || '').toLowerCase() : '';

        Array.prototype.forEach.call(dropdown.querySelectorAll('[data-ozi-heading]'), function (it) {
            it.classList.toggle('ozi-editor-heading-item--active', it.getAttribute('data-ozi-heading') === currentTag);
        });
    };

    /* ─────────────────────────────────────────────
     * [13] DROPDOWN DE CLASSES CUSTOMIZADAS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildClassesButton = function (label) {
        var self = this;
        if (!self.classDefs || !self.classDefs.length) return null;
        var id = 'classes-' + (++self._popoverSeq);

        var wrap = _el('div', 'ozi-editor-classes-wrap', { 'data-ozi-editor-popover-wrap': id });
        var btn  = _el('button', 'ozi-editor-btn ozi-editor-btn--classes', {
            type: 'button', 'data-ozi-editor-tool': 'classes', 'data-ozi-editor-popover-id': id,
            title: label, 'aria-label': label, 'aria-haspopup': 'true', 'aria-expanded': 'false'
        });
        btn.appendChild(_el('span', 'ozi-editor-btn-icon', { 'aria-hidden': 'true' }));

        var dropdown = _el('div', 'ozi-editor-classes-dropdown', { role: 'menu' });
        dropdown.style.display = 'none';

        self.classDefs.forEach(function (def) {
            var item = _el('button', 'ozi-editor-classes-item', { type: 'button', 'data-ozi-class': def.cls, role: 'menuitem' });
            item.appendChild(_el('span', 'ozi-editor-classes-check', { 'aria-hidden': 'true' }));
            var lblEl = _el('span', 'ozi-editor-classes-label'); lblEl.textContent = def.label;
            item.appendChild(lblEl);
            dropdown.appendChild(item);
        });

        self._registerPopover(id, dropdown, '[data-ozi-editor-popover-id="' + id + '"]', function (dropdownEl) {
            self._updateClassDropdownChecks(dropdownEl);
        });
        wrap.appendChild(btn); wrap.appendChild(dropdown);
        return wrap;
    };

    OziEditor.prototype._updateClassDropdownChecks = function (dropdown) {
        var self = this;
        if (!dropdown) return;

        var activeClasses = self._getActiveClasses();

        Array.prototype.forEach.call(dropdown.querySelectorAll('[data-ozi-class]'), function (it) {
            it.classList.toggle('ozi-editor-classes-item--active', activeClasses.indexOf(it.getAttribute('data-ozi-class')) > -1);
        });
    };

    OziEditor.prototype._getActiveClasses = function () {
        var self   = this;
        var active = [];
        var allCls = self.classDefs.map(function (d) { return d.cls; });

        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return active;

        var node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;

        while (node && node !== self.content) {
            String(node.className || '').split(/\s+/).forEach(function (c) {
                c = c.trim();
                if (c && allCls.indexOf(c) > -1 && active.indexOf(c) === -1) active.push(c);
            });
            node = node.parentNode;
        }

        return active;
    };

    OziEditor.prototype._applyClass = function (cls) {
        var self = this;
        var sel  = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        var range = sel.getRangeAt(0);

        if (range.collapsed) {
            var block = self._getClosestBlockElement();
            if (!block) return;
            self._toggleClassOnElement(block, cls);
            self._saveSelection();
            self._syncToTextarea();
            self.emitChange();
            return;
        }

        var blocks = self._getBlocksInRange(range);

        if (blocks.length > 1) {
            blocks.forEach(function (b) { self._toggleClassOnElement(b, cls); });
            self._syncToTextarea();
            self.emitChange();
            return;
        }

        var ancestor = range.commonAncestorContainer;
        if (ancestor.nodeType === 3) ancestor = ancestor.parentNode;
        var existingSpan = (ancestor && ancestor.closest) ? ancestor.closest('span.' + cls) : null;

        if (existingSpan && self.content.contains(existingSpan)) {
            var parent = existingSpan.parentNode;
            while (existingSpan.firstChild) parent.insertBefore(existingSpan.firstChild, existingSpan);
            parent.removeChild(existingSpan);
            if (parent) parent.normalize();
        } else {
            try {
                var span = document.createElement('span');
                span.className = cls;
                range.surroundContents(span);
            } catch (e) {
                var frag   = range.extractContents();
                var spanFb = document.createElement('span');
                spanFb.className = cls;
                spanFb.appendChild(frag);
                range.insertNode(spanFb);
            }
        }

        self._saveSelection();
        self._syncToTextarea();
        self.emitChange();
    };

    OziEditor.prototype._toggleClassOnElement = function (el, cls) {
        var classes = String(el.className || '').split(/\s+/).filter(Boolean);
        var idx = classes.indexOf(cls);
        if (idx > -1) { classes.splice(idx, 1); } else { classes.push(cls); }
        el.className = classes.join(' ').trim();
    };

    OziEditor.prototype._getBlocksInRange = function (range) {
        var self    = this;
        var results = [];
        var BLOCK   = ['P','H1','H2','H3','H4','H5','H6','LI','TD','TH','PRE','BLOCKQUOTE'];

        Array.prototype.forEach.call(self.content.querySelectorAll(BLOCK.join(',').toLowerCase()), function (node) {
            var nodeRange = document.createRange();
            nodeRange.selectNode(node);
            if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 1 &&
                range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > -1) {
                results.push(node);
            }
        });

        return results;
    };

    /* ─────────────────────────────────────────────
     * [13b] POPOVER DE LINK
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildLinkButton = function (label) {
        var self = this;

        return self._buildPopoverButton('link', label, function (popover) {
            var field = _el('div', 'ozi-editor-popover-field');
            var lbl   = _el('span', 'ozi-editor-popover-label'); lbl.textContent = _t('editor.linkUrl');
            var input = _el('input', 'ozi-editor-popover-input', {
                type: 'text', placeholder: 'https://…', 'data-ozi-editor-link-input': 'true'
            });
            field.appendChild(lbl); field.appendChild(input);

            var actions = _el('div', 'ozi-editor-popover-actions');
            var apply   = _el('button', 'ozi-editor-popover-apply', { type: 'button', 'data-ozi-editor-link-apply': 'true' });
            apply.textContent = _t('editor.apply');
            var remove  = _el('button', 'ozi-editor-popover-remove', { type: 'button', 'data-ozi-editor-link-remove': 'true' });
            remove.textContent = _t('editor.remove');
            actions.appendChild(apply); actions.appendChild(remove);

            popover.appendChild(field);
            popover.appendChild(actions);
        }, function (popoverEl) {
            /* le os campos do PROPRIO popover que esta abrindo (nao um
               campo singular na instancia) — necessario desde que a
               toolbar responsiva permite mais de um popover "link" no DOM */
            var input     = popoverEl.querySelector('[data-ozi-editor-link-input]');
            var removeBtn = popoverEl.querySelector('[data-ozi-editor-link-remove]');
            var existing  = self._getClosestSelectionNode(['A']);
            input.value = existing ? (existing.getAttribute('href') || '') : '';
            removeBtn.disabled = !existing;
            setTimeout(function () { input.focus(); }, 0);
        });
    };

    OziEditor.prototype._applyLink = function (url) {
        url = _trim(url);
        if (!_isSafeUrl(url)) return;
        this.content.focus();
        if (!url) document.execCommand('unlink', false, null);
        else      document.execCommand('createLink', false, url);
        this._saveSelection();
        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    OziEditor.prototype._removeLink = function () {
        this.content.focus();
        /* execCommand('unlink') com selecao colapsada (cursor dentro do link,
           sem texto selecionado) nao remove o link em boa parte dos browsers —
           seleciona o <a> inteiro antes de chamar, mesmo se o usuario so tinha
           o cursor nele (verificado empiricamente: sem isso o comando e um no-op) */
        var existing = this._getClosestSelectionNode(['A']);
        if (existing) {
            var range = document.createRange();
            range.selectNodeContents(existing);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        document.execCommand('unlink', false, null);
        this._saveSelection();
        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    /* ─────────────────────────────────────────────
     * [13c] POPOVER DE IMAGEM — Fase 3. Reaproveita a mesma mecanica generica
     * de popover do link (_buildPopoverButton/_registerPopover/_togglePopover,
     * zero mudanca nelas). Duas formas de inserir: URL (mesmo padrao do link)
     * ou upload real de arquivo (so aparece se o host declarar
     * data-ozi-editor-upload-url). Diferente do link: <img> e elemento vazio,
     * o caret nunca fica "dentro" dele — _getClosestSelectionNode(['A']) nao
     * serve, precisa de deteccao propria via Range (_getSelectedImage). E
     * diferente do _applyLink tambem: mostra erro visivel em URL invalida em
     * vez de rejeitar em silencio.
     * ───────────────────────────────────────────── */

    /* <img> nao tem filhos, entao o caret nunca "entra" nele — quando o
       usuario clica numa imagem dentro do contenteditable, o browser produz
       uma selecao de ELEMENTO (startContainer = pai, offsets cercando o no,
       ex.: startOffset=2, endOffset=3), nao uma selecao de texto dentro dele.
       Detecta esse padrao especifico em vez de tentar reusar
       _getClosestSelectionNode. */
    OziEditor.prototype._getSelectedImage = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        var range = sel.getRangeAt(0);
        if (range.startContainer !== range.endContainer) return null;
        if (range.endOffset - range.startOffset !== 1) return null;
        var node = range.startContainer.childNodes[range.startOffset];
        if (node && node.nodeType === 1 && node.tagName === 'IMG' && this.content.contains(node)) {
            return node;
        }
        return null;
    };

    OziEditor.prototype._buildImageButton = function (label) {
        var self = this;

        return self._buildPopoverButton('image', label, function (popover) {
            var urlField = _el('div', 'ozi-editor-popover-field');
            var urlLbl   = _el('span', 'ozi-editor-popover-label'); urlLbl.textContent = _t('editor.imageUrl');
            var urlInput = _el('input', 'ozi-editor-popover-input', {
                type: 'text', placeholder: 'https://…', 'data-ozi-editor-image-url-input': 'true'
            });
            urlField.appendChild(urlLbl); urlField.appendChild(urlInput);

            var altField = _el('div', 'ozi-editor-popover-field');
            var altLbl   = _el('span', 'ozi-editor-popover-label'); altLbl.textContent = _t('editor.imageAlt');
            var altInput = _el('input', 'ozi-editor-popover-input', {
                type: 'text', 'data-ozi-editor-image-alt-input': 'true'
            });
            altField.appendChild(altLbl); altField.appendChild(altInput);

            /* largura/altura em px — atributos HTML nativos width/height
               (unitless), nao style. So altura preenchida = largura fica
               automatica (a regra CSS .ozi-editor-content img{height:auto}
               ja cobre isso), e vice-versa. */
            var dimRow      = _el('div', 'ozi-editor-popover-row');
            var widthField  = _el('div', 'ozi-editor-popover-field');
            var widthLbl    = _el('span', 'ozi-editor-popover-label'); widthLbl.textContent = _t('editor.imageWidth');
            var widthInput  = _el('input', 'ozi-editor-popover-input', {
                type: 'number', min: '1', placeholder: 'auto', 'data-ozi-editor-image-width-input': 'true'
            });
            widthField.appendChild(widthLbl); widthField.appendChild(widthInput);

            var heightField = _el('div', 'ozi-editor-popover-field');
            var heightLbl   = _el('span', 'ozi-editor-popover-label'); heightLbl.textContent = _t('editor.imageHeight');
            var heightInput = _el('input', 'ozi-editor-popover-input', {
                type: 'number', min: '1', placeholder: 'auto', 'data-ozi-editor-image-height-input': 'true'
            });
            heightField.appendChild(heightLbl); heightField.appendChild(heightInput);

            dimRow.appendChild(widthField); dimRow.appendChild(heightField);

            /* linha "Alinhamento" (v4.7.0) — SO no modo html. No md a linha
               nem e construida (mesma regra da secao de upload logo abaixo:
               controle funcionalmente morto nao deveria estar no DOM): o
               htmlToMd serializa `![alt](src)` e descarta qualquer style, e
               left/center/right de TEXTO ja sao BLOCKED_IN_MD.
               Os botoes nao levam a classe `.ozi-editor-btn` nem o atributo
               `data-ozi-editor-tool` de proposito — os dois fariam o
               dispatcher generico de mousedown chama-los como ferramenta. */
            var alignField = null;
            if (self.editorType !== 'md') {
                alignField = _el('div', 'ozi-editor-popover-field');
                var alignLbl = _el('span', 'ozi-editor-popover-label');
                alignLbl.textContent = _t('editor.imageAlign');
                var alignRow = _el('div', 'ozi-editor-popover-align');

                IMAGE_ALIGN_MODES.forEach(function (item) {
                    var lbl = _t(item.labelKey);
                    var btn = _el('button', 'ozi-editor-popover-align-btn', {
                        type: 'button',
                        'data-ozi-editor-image-align': item.mode,
                        'data-ozi-editor-image-align-icon': item.icon,
                        title: lbl, 'aria-label': lbl, 'aria-pressed': 'false'
                    });
                    btn.appendChild(_el('span', 'ozi-editor-popover-align-icon', { 'aria-hidden': 'true' }));
                    alignRow.appendChild(btn);
                });

                alignField.appendChild(alignLbl);
                alignField.appendChild(alignRow);
            }

            var actions = _el('div', 'ozi-editor-popover-actions');
            var apply   = _el('button', 'ozi-editor-popover-apply', { type: 'button', 'data-ozi-editor-image-apply': 'true' });
            apply.textContent = _t('editor.apply');
            var remove  = _el('button', 'ozi-editor-popover-remove', { type: 'button', 'data-ozi-editor-image-remove': 'true' });
            remove.textContent = _t('editor.remove');
            actions.appendChild(apply); actions.appendChild(remove);

            popover.appendChild(urlField);
            popover.appendChild(altField);
            popover.appendChild(dimRow);
            if (alignField) popover.appendChild(alignField);
            popover.appendChild(actions);

            /* secao de upload SO existe no DOM se o host declarou o endpoint —
               nao e so escondida via CSS, um <input type=file> funcionalmente
               morto nao deveria nem estar la */
            if (self.uploadUrl) {
                var uploadWrap = _el('div', 'ozi-editor-popover-upload');
                var uploadLbl  = _el('span', 'ozi-editor-popover-label'); uploadLbl.textContent = _t('editor.imageUpload');
                var fileInput  = _el('input', null, {
                    type: 'file', accept: 'image/*', 'data-ozi-editor-image-file-input': 'true'
                });
                var fileName   = _el('span', 'ozi-editor-popover-file', { 'data-ozi-editor-image-filename': 'true' });

                uploadWrap.appendChild(uploadLbl);
                uploadWrap.appendChild(fileInput);
                uploadWrap.appendChild(fileName);
                popover.appendChild(uploadWrap);
            }
        }, function (popoverEl) {
            /* le/preenche os campos do PROPRIO popover que esta abrindo (nao
               campos singulares na instancia) — necessario desde que a
               toolbar responsiva permite mais de um popover "image" no DOM */
            var urlInput    = popoverEl.querySelector('[data-ozi-editor-image-url-input]');
            var altInput    = popoverEl.querySelector('[data-ozi-editor-image-alt-input]');
            var widthInput  = popoverEl.querySelector('[data-ozi-editor-image-width-input]');
            var heightInput = popoverEl.querySelector('[data-ozi-editor-image-height-input]');
            var removeBtn   = popoverEl.querySelector('[data-ozi-editor-image-remove]');
            var fileInput   = popoverEl.querySelector('[data-ozi-editor-image-file-input]');
            var fileNameEl  = popoverEl.querySelector('[data-ozi-editor-image-filename]');

            var existing = self._getSelectedImage();
            urlInput.value    = existing ? (existing.getAttribute('src') || '') : '';
            altInput.value    = existing ? (existing.getAttribute('alt') || '') : '';
            widthInput.value  = existing ? (existing.getAttribute('width')  || '') : '';
            heightInput.value = existing ? (existing.getAttribute('height') || '') : '';
            removeBtn.disabled = !existing;
            if (fileInput)  fileInput.value = '';
            if (fileNameEl) fileNameEl.textContent = '';

            /* alinhamento (v4.7.0): com imagem selecionada, reflete o modo
               dela; sem imagem, zera o pendente — o popover e reaproveitado
               entre aberturas, entao herdar o modo da imagem anterior faria
               a proxima insercao nascer alinhada sem o usuario pedir */
            self._syncAlignButtons(popoverEl, existing ? self._getImageAlign(existing) : 'none');

            setTimeout(function () { urlInput.focus(); }, 0);
        });
    };

    /* width/height: string vinda dos inputs number — vazio = "auto" (remove
       o atributo, deixa o browser/CSS calcular). Validacao de forma (inteiro
       positivo) e responsabilidade do <input type=number min=1>; o
       sanitizador valida de novo por formato na proxima sanitizacao (defesa
       em profundidade, mesmo padrao de cor/URL). */
    OziEditor.prototype._applyImageUrl = function (url, alt, width, height, align) {
        url = _trim(url);
        alt = alt || '';
        width  = _trim(width || '');
        height = _trim(height || '');
        if (!url || !_isSafeUrl(url)) {
            this._showWarning(_t('editor.imageInvalidUrl'));
            return;
        }
        this.content.focus();

        var existing = this._getSelectedImage();
        var img = existing || document.createElement('img');
        img.setAttribute('src', url);
        if (alt)    img.setAttribute('alt', alt);       else img.removeAttribute('alt');
        if (width)  img.setAttribute('width', width);   else img.removeAttribute('width');
        if (height) img.setAttribute('height', height); else img.removeAttribute('height');

        if (existing) {
            if (align) this._applyImageAlign(existing, align);
        } else {
            /* imagem nova: o modo `free` precisa MEDIR a posicao no fluxo, e
               isso so existe depois de inserida. Marca com um atributo
               temporario (a insercao nao passa pelo sanitizador, entao ele
               sobrevive), insere, mede, aplica e apaga a marca. Os outros
               modos sao puro style e cabem antes da serializacao. */
            if (align && align !== 'free') this._applyImageAlign(img, align);
            if (align === 'free') img.setAttribute('data-ozi-img-tmp', '1');
            this._insertHtmlAtCursor(img.outerHTML);
            if (align === 'free') {
                var inserted = this.content.querySelector('[data-ozi-img-tmp]');
                if (inserted) {
                    inserted.removeAttribute('data-ozi-img-tmp');
                    this._applyImageAlign(inserted, 'free');
                }
            }
        }

        this._saveSelection();
        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    OziEditor.prototype._removeImage = function () {
        this.content.focus();
        var existing = this._getSelectedImage();
        if (!existing || !existing.parentNode) return;
        existing.parentNode.removeChild(existing);
        this._saveSelection();
        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    /* ─────────────────────────────────────────────
     * [13c-2] ALINHAMENTO DE IMAGEM — v4.7.0
     * Estado no inline style da propria <img> (ver [7c] pro porque).
     * NAO usar atributo `data-*` como fonte da verdade: o sanitizador
     * apaga todos os atributos e restaura so a whitelist, entao o modo
     * tem que ser DERIVAVEL do style que sobrevive ao round-trip.
     * ───────────────────────────────────────────── */

    function _styleProp(el, prop) {
        return (el && el.style) ? _trim(el.style.getPropertyValue(prop)).toLowerCase() : '';
    }

    /* deriva o modo a partir do style — a ordem importa: `free` (absolute)
       vence, porque uma imagem posicionada pode ter margens sobrando de um
       modo anterior num HTML vindo de fora */
    OziEditor.prototype._getImageAlign = function (img) {
        if (!img) return 'none';
        if (_styleProp(img, 'position') === 'absolute') return 'free';

        var float_ = _styleProp(img, 'float');
        if (float_ === 'left')  return 'left';
        if (float_ === 'right') return 'right';

        if (_styleProp(img, 'display') === 'block' &&
            _styleProp(img, 'margin-left')  === 'auto' &&
            _styleProp(img, 'margin-right') === 'auto') return 'center';

        return 'none';
    };

    /* posicao atual da imagem no fluxo, na mesma origem que `left`/`top` de um
       elemento absoluto usam (padding box do containing block). offsetLeft/
       offsetTop sao medidos a partir do padding edge do offsetParent, que e o
       `.ozi-editor-content` (position:relative desde o CSS 2.7.0) — as duas
       medidas batem, entao entrar no modo livre nao move a imagem um pixel. */
    OziEditor.prototype._imageFlowOffset = function (img) {
        var content = this.content;
        if (!content || !content.contains(img)) return { left: 0, top: 0 };
        var boxW = content.clientWidth || 1;
        return {
            left: _round2((img.offsetLeft / boxW) * 100),
            top:  _round2(img.offsetTop)
        };
    };

    function _round2(n) { return Math.round(n * 100) / 100; }

    /* escreve a string canonica do modo. Limpa TODAS as propriedades que
       qualquer modo possa ter escrito antes de aplicar a nova — trocar de
       modo nao pode deixar residuo (ex.: float sobrando ao virar centro). */
    OziEditor.prototype._applyImageAlign = function (img, mode) {
        if (!img) return;
        mode = IMAGE_ALIGN_STYLES[mode] ? mode : 'none';

        /* mede ANTES de mexer no style: depois de virar absolute a imagem sai
           do fluxo e offsetLeft/offsetTop ja refletem a posicao nova */
        var geo = (mode === 'free') ? this._imageFlowOffset(img) : null;

        IMAGE_ALIGN_PROPS.forEach(function (prop) { img.style.removeProperty(prop); });

        var decl = IMAGE_ALIGN_STYLES[mode];
        Object.keys(decl).forEach(function (prop) { img.style.setProperty(prop, decl[prop]); });

        if (mode === 'free' && geo) {
            img.style.setProperty('left', geo.left + '%');
            img.style.setProperty('top',  geo.top  + 'px');
            this._clampFreeImage(img);
        }

        /* sem nenhuma declaracao sobrando, o atributo inteiro sai — senao a
           imagem carregaria um `style=""` vazio pra sempre (e o HTML salvo
           de quem nunca alinhou nada deixaria de ser identico ao de antes
           desta versao) */
        if (img.getAttribute('style') === '') img.removeAttribute('style');
    };

    /* clamp e obrigatorio, nao acabamento: `.ozi-editor-content` tem
       overflow-x:hidden (corta sem oferecer scroll) e o wrap tem
       overflow:hidden — imagem empurrada pra fora ficaria inalcancavel, so
       recuperavel pelo modo source. Efeito colateral util: como o editor
       nunca emite negativo, qualquer negativo que o sanitizador veja veio de
       fora e pode ser rejeitado sem custo funcional. */
    OziEditor.prototype._clampFreeImage = function (img) {
        var content = this.content;
        if (!content || !img) return;

        var boxW = content.clientWidth || 1;
        var boxH = Math.max(content.clientHeight, content.scrollHeight) || 1;
        var imgW = img.offsetWidth  || 0;
        var imgH = img.offsetHeight || 0;

        var maxLeftPct = Math.max(0, ((boxW - imgW) / boxW) * 100);
        var maxTopPx   = Math.max(0, boxH - imgH);

        var left = parseFloat(img.style.getPropertyValue('left')) || 0;
        var top  = parseFloat(img.style.getPropertyValue('top'))  || 0;

        img.style.setProperty('left', _round2(Math.min(Math.max(0, left), maxLeftPct)) + '%');
        img.style.setProperty('top',  _round2(Math.min(Math.max(0, top),  maxTopPx))  + 'px');
    };

    /* espelha o modo nos botoes do popover E guarda o pendente no proprio
       elemento do popover (nao num campo da instancia — a toolbar responsiva
       permite mais de um popover "image" vivo no DOM ao mesmo tempo) */
    OziEditor.prototype._syncAlignButtons = function (popoverEl, mode) {
        if (!popoverEl) return;
        var btns = popoverEl.querySelectorAll('[data-ozi-editor-image-align]');
        if (!btns.length) return;   /* modo md: a linha nem foi construida */

        mode = IMAGE_ALIGN_STYLES[mode] ? mode : 'none';
        popoverEl.setAttribute('data-ozi-editor-image-align-pending', mode);

        Array.prototype.forEach.call(btns, function (btn) {
            var on = btn.getAttribute('data-ozi-editor-image-align') === mode;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    };

    OziEditor.prototype._pendingAlign = function (popoverEl) {
        return (popoverEl && popoverEl.getAttribute('data-ozi-editor-image-align-pending')) || 'none';
    };

    /* ─────────────────────────────────────────────
     * [13c-3] ARRASTO DA IMAGEM LIVRE — v4.7.0
     * mousemove/mouseup vivem no document e sao registrados UMA VEZ no
     * _bindEvents (via _on, rastreado pelo destroy) — gateados por
     * this._imgDrag. Nao existe _off no arquivo: ligar por gesto
     * acumularia entradas no _listeners pra sempre.
     * Sem requestAnimationFrame de proposito — rAF nao dispara de forma
     * confiavel sob --virtual-time-budget (lessons-learned 2026-08-31), e
     * isso deixaria o arrasto sem cobertura de aceite nenhuma.
     * ───────────────────────────────────────────── */

    var IMG_DRAG_THRESHOLD = 4;   /* px — separa clique de arrasto */

    OziEditor.prototype._startImageDrag = function (img, e) {
        this._imgDrag = {
            img:            img,
            startX:         e.clientX,
            startY:         e.clientY,
            startScrollTop: this.content.scrollTop,
            baseLeftPct:    parseFloat(img.style.getPropertyValue('left')) || 0,
            baseTopPx:      parseFloat(img.style.getPropertyValue('top'))  || 0,
            moved:          false
        };
    };

    OziEditor.prototype._moveImageDrag = function (e) {
        var d = this._imgDrag;
        if (!d) return;

        /* botao ja solto (Alt+Tab, menu de contexto, mouseup fora da janela):
           o mouseup nunca chegou e a imagem passaria a seguir o cursor */
        if (e.buttons === 0) { this._imgDrag = null; return; }

        var dx = e.clientX - d.startX;
        /* rolar o content durante o arrasto descolaria a imagem do cursor */
        var dy = (e.clientY - d.startY) + (this.content.scrollTop - d.startScrollTop);

        if (!d.moved && Math.max(Math.abs(dx), Math.abs(dy)) < IMG_DRAG_THRESHOLD) return;
        d.moved = true;

        var boxW = this.content.clientWidth || 1;
        d.img.style.setProperty('left', _round2(d.baseLeftPct + (dx / boxW) * 100) + '%');
        d.img.style.setProperty('top',  _round2(d.baseTopPx + dy) + 'px');
        this._clampFreeImage(d.img);
    };

    OziEditor.prototype._endImageDrag = function () {
        var d = this._imgDrag;
        if (!d) return;
        this._imgDrag = null;

        /* setValue()/_exitSourceMode() podem ter trocado o innerHTML no meio
           do gesto — o no que estavamos movendo virou orfao */
        if (!this.content.contains(d.img)) return false;

        if (!d.moved) return true;   /* foi clique: quem chamou abre o popover */

        this._syncToTextarea();
        this.emitChange();
        return false;
    };

    OziEditor.prototype._setUploadBusy = function (busy, fileName, popover) {
        if (!popover) return;
        var fileInput  = popover.querySelector('[data-ozi-editor-image-file-input]');
        var fileNameEl = popover.querySelector('[data-ozi-editor-image-filename]');
        if (fileInput) fileInput.disabled = busy;
        if (fileNameEl) fileNameEl.textContent = busy ? _t('editor.imageUploading') : (fileName || '');
    };

    /* estilo .then/.catch/.finally (nao async/await) — consistente com o
       resto do arquivo, ES5. Mesmo padrao de fetch com FormData ja usado por
       ozi-loaddata/ozi-select: sem Content-Type manual (o browser monta o
       boundary multipart sozinho), X-CSRF-TOKEN so se o meta tag existir.
       Sucesso exige response.ok E json.status==='ok' E json.url presente —
       um servidor mal configurado que devolve status:'ok' junto de um HTTP
       500 nao deve ser tratado como sucesso. Erro sempre visivel via
       _showWarning, nunca fail-open silencioso (mesma licao da Fase 2).
       `popover` (o elemento .ozi-editor-popover de onde veio o upload) e
       passado pelo handler de 'change' do input de arquivo — necessario pra
       ler alt/width/height e mostrar o estado "enviando" no popover CERTO,
       ja que a toolbar responsiva permite mais de um popover "image". */
    OziEditor.prototype._uploadImage = function (file, popover) {
        var self = this;
        if (!self.uploadUrl || !file || !popover) return;

        self._setUploadBusy(true, file.name, popover);

        var formData = new FormData();
        formData.append('file', file);

        var headers = { 'X-Requested-With': 'XMLHttpRequest' };
        var csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) headers['X-CSRF-TOKEN'] = csrfMeta.getAttribute('content');

        fetch(self.uploadUrl, { method: 'POST', headers: headers, body: formData })
            .then(function (response) {
                var ct = String(response.headers.get('content-type') || '').toLowerCase();
                if (ct.indexOf('application/json') === -1) {
                    throw new Error(_t('editor.imageUploadFailed'));
                }
                return response.json().then(function (json) {
                    if (response.ok && json && json.status === 'ok' && json.url) return json.url;
                    throw new Error((json && json.status === 'error' && json.message) || _t('editor.imageUploadFailed'));
                });
            })
            .then(function (url) {
                var altInput    = popover.querySelector('[data-ozi-editor-image-alt-input]');
                var widthInput  = popover.querySelector('[data-ozi-editor-image-width-input]');
                var heightInput = popover.querySelector('[data-ozi-editor-image-height-input]');
                self._applyImageUrl(url,
                    altInput    ? altInput.value    : '',
                    widthInput  ? widthInput.value  : '',
                    heightInput ? heightInput.value : '',
                    self._pendingAlign(popover));
                self._togglePopover(self._popoverIdFromElement(popover), true);
            })
            .catch(function (err) {
                self._showWarning((err && err.message) || _t('editor.imageUploadFailed'));
            })
            .finally(function () {
                self._setUploadBusy(false, null, popover);
            });
    };

    /* ─────────────────────────────────────────────
     * [13c] POPOVER DE COR (color/highlight — grade
     * de swatches fixos, compartilhado pelos dois)
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildColorButton = function (tool, label) {
        var self = this;

        return self._buildPopoverButton(tool, label, function (popover) {
            popover.classList.add('ozi-editor-popover--color');

            var grid = _el('div', 'ozi-editor-swatch-grid');
            SWATCH_PALETTE.forEach(function (sw) {
                var swatch = _el('button', 'ozi-editor-swatch', {
                    type: 'button', 'data-ozi-editor-swatch': sw.hex,
                    title: sw.labelKey, 'aria-label': sw.labelKey
                });
                swatch.style.background = sw.hex;
                grid.appendChild(swatch);
            });
            popover.appendChild(grid);

            /* customizar — input nativo type=color, sempre #rrggbb (sem
               digitacao livre, sem superficie de injecao nova); aplica no
               'change' (usuario fechou o seletor nativo do SO/navegador) */
            var customRow = _el('label', 'ozi-editor-swatch-custom');
            var customInput = _el('input', null, {
                type: 'color', 'data-ozi-editor-swatch-custom': tool, value: '#000000'
            });
            var customLabel = _el('span', 'ozi-editor-swatch-custom-label');
            customLabel.textContent = _t('editor.customize');
            customRow.appendChild(customInput);
            customRow.appendChild(customLabel);
            popover.appendChild(customRow);

            var none = _el('button', 'ozi-editor-swatch-none', {
                type: 'button', 'data-ozi-editor-swatch-none': tool
            });
            none.textContent = _t('editor.none');
            popover.appendChild(none);
        });
    };

    OziEditor.prototype._applySwatchColor = function (tool, value) {
        this.content.focus();
        /* sem isso o Chromium produz <font color> (fora do ALLOWED_TAGS) em
           vez de <span style>, verificado empiricamente antes de implementar */
        document.execCommand('styleWithCSS', false, true);

        if (tool === 'color') {
            document.execCommand('foreColor', false, value);
        } else if (tool === 'highlight') {
            var supported = false;
            try { supported = document.queryCommandSupported('hiliteColor'); } catch (e) {}
            document.execCommand(supported ? 'hiliteColor' : 'backColor', false, value);
        }

        this._saveSelection();
        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    /* ─────────────────────────────────────────────
     * [13e] POPOVER DE TABELA — v4.8.0
     *
     * Um popover, DOIS paineis: o `onOpen` mostra o de INSERCAO quando o
     * caret esta fora de tabela e o de EDICAO quando esta dentro de um
     * TD/TH. E o mesmo precedente do popover de imagem (que ja reabria
     * sobre uma imagem existente), e por isso a edicao nao custou botao
     * novo na toolbar.
     *
     * Nenhum elemento daqui leva `.ozi-editor-btn` nem
     * `data-ozi-editor-tool`: os dois fariam o dispatcher generico de
     * mousedown (primeiro handler do _bindEvents) trata-los como
     * ferramenta. Mesmo cuidado dos botoes de alinhamento de imagem
     * (v4.7.0), que aprenderam isso por tentativa.
     * ───────────────────────────────────────────── */

    OziEditor.prototype._buildTableButton = function (label) {
        var self = this;

        return self._buildPopoverButton('table', label, function (popover) {
            popover.classList.add('ozi-editor-popover--table');

            /* ── painel de INSERCAO ── */
            var insert = _el('div', 'ozi-editor-table-panel', { 'data-ozi-editor-table-panel': 'insert' });

            /* celulas sao <span> num container [role=grid] com tabindex=0, nao
               80 botoes: 80 elementos focaveis destruiriam o tab-order do
               popover (o caminho de teclado util sao os campos numericos), e o
               highlight ja e delegado por mousemove no proprio container. */
            var grid = _el('div', 'ozi-editor-table-grid', {
                role: 'grid', tabindex: '0',
                'aria-label': _t('editor.tableGrid'),
                'data-ozi-editor-table-grid': 'true'
            });
            grid.style.gridTemplateColumns = 'repeat(' + TABLE_GRID_COLS + ', 16px)';

            for (var r = 1; r <= TABLE_GRID_ROWS; r++) {
                for (var c = 1; c <= TABLE_GRID_COLS; c++) {
                    grid.appendChild(_el('span', 'ozi-editor-table-cell', {
                        'data-ozi-editor-table-col': c,
                        'data-ozi-editor-table-row': r
                    }));
                }
            }

            var label_ = _el('div', 'ozi-editor-table-label', {
                'data-ozi-editor-table-size-label': 'true', 'aria-live': 'polite'
            });

            /* cabecalho: ligado por padrao. No modo md fica ligado E
               desabilitado — GFM exige linha de cabecalho, e sem <thead> o
               _tableToMd promove a primeira linha do corpo (fallback correto
               pra HTML vindo de fora, mas aqui vira perda silenciosa). Um
               checkbox que o usuario pode desligar sem efeito seria pior que
               nao ter checkbox. */
            var headerField = _el('label', 'ozi-editor-table-header-field');
            var headerCb    = _el('input', null, {
                type: 'checkbox', 'data-ozi-editor-table-header': 'true'
            });
            headerCb.checked = true;
            if (self.editorType === 'md') headerCb.disabled = true;
            var headerTxt = _el('span', null);
            headerTxt.textContent = _t('editor.tableHeader');
            headerField.appendChild(headerCb);
            headerField.appendChild(headerTxt);

            var fields   = _el('div', 'ozi-editor-table-fields');
            var colField = _el('div', 'ozi-editor-table-field');
            var colLbl   = _el('span', 'ozi-editor-table-field-label');
            colLbl.textContent = _t('editor.tableCols');
            var colInput = _el('input', 'ozi-editor-table-input', {
                type: 'number', min: '1', max: String(TABLE_MAX),
                'data-ozi-editor-table-cols': 'true', 'aria-label': _t('editor.tableCols')
            });
            colInput.value = '2';
            colField.appendChild(colLbl); colField.appendChild(colInput);

            var rowField = _el('div', 'ozi-editor-table-field');
            var rowLbl   = _el('span', 'ozi-editor-table-field-label');
            rowLbl.textContent = _t('editor.tableRows');
            var rowInput = _el('input', 'ozi-editor-table-input', {
                type: 'number', min: '1', max: String(TABLE_MAX),
                'data-ozi-editor-table-rows': 'true', 'aria-label': _t('editor.tableRows')
            });
            rowInput.value = '2';
            rowField.appendChild(rowLbl); rowField.appendChild(rowInput);

            var insertBtn = _el('button', 'ozi-editor-table-insert', {
                type: 'button', 'data-ozi-editor-table-apply': 'true'
            });
            insertBtn.textContent = _t('editor.tableInsert');

            fields.appendChild(colField);
            fields.appendChild(rowField);
            fields.appendChild(insertBtn);

            insert.appendChild(grid);
            insert.appendChild(label_);
            insert.appendChild(headerField);
            insert.appendChild(fields);

            /* ── painel de EDICAO ── */
            var edit = _el('div', 'ozi-editor-table-panel', { 'data-ozi-editor-table-panel': 'edit' });
            edit.style.display = 'none';

            var editLbl = _el('span', 'ozi-editor-popover-label');
            editLbl.textContent = _t('editor.tableEdit');
            edit.appendChild(editLbl);

            TABLE_ACTIONS.forEach(function (item) {
                var it = _el('button',
                    'ozi-editor-table-action' + (item.danger ? ' ozi-editor-table-action--danger' : ''),
                    { type: 'button', 'data-ozi-editor-table-action': item.action });
                it.textContent = _t(item.labelKey);
                edit.appendChild(it);
            });

            popover.appendChild(insert);
            popover.appendChild(edit);

        }, function (popoverEl) {
            /* le/preenche o PROPRIO popover que esta abrindo — a toolbar
               responsiva permite mais de um popover "table" no DOM ao mesmo
               tempo (um por variante de breakpoint) */
            var inEdit = !!self._getSelectedTableCell();
            self._setTablePanel(popoverEl, inEdit ? 'edit' : 'insert');

            if (inEdit) return;

            /* o popover e reaproveitado entre aberturas: sem este reset, a
               proxima insercao herdaria o tamanho da anterior sem o usuario
               pedir (mesmo motivo do reset de alinhamento no popover de
               imagem, v4.7.0) */
            var colInput = popoverEl.querySelector('[data-ozi-editor-table-cols]');
            var rowInput = popoverEl.querySelector('[data-ozi-editor-table-rows]');
            var headerCb = popoverEl.querySelector('[data-ozi-editor-table-header]');
            if (colInput) colInput.value = '2';
            if (rowInput) rowInput.value = '2';
            if (headerCb && !headerCb.disabled) headerCb.checked = true;

            self._syncTableGrid(popoverEl, 2, 2);
        });
    };

    /* alterna insercao <-> edicao dentro do mesmo popover */
    OziEditor.prototype._setTablePanel = function (popoverEl, which) {
        Array.prototype.forEach.call(
            popoverEl.querySelectorAll('[data-ozi-editor-table-panel]'),
            function (p) {
                p.style.display = (p.getAttribute('data-ozi-editor-table-panel') === which) ? '' : 'none';
            }
        );
    };

    /* pinta o retangulo 1..cols x 1..rows e atualiza o label vivo. Fonte
       unica pro hover do mouse, pras setas do teclado e pros campos
       numericos — os tres so calculam o par (cols, rows) e chamam aqui. */
    OziEditor.prototype._syncTableGrid = function (popoverEl, cols, rows) {
        var grid = popoverEl.querySelector('[data-ozi-editor-table-grid]');
        if (grid) {
            Array.prototype.forEach.call(grid.querySelectorAll('.ozi-editor-table-cell'), function (cell) {
                var c  = parseInt(cell.getAttribute('data-ozi-editor-table-col'), 10);
                var r  = parseInt(cell.getAttribute('data-ozi-editor-table-row'), 10);
                var on = (c <= cols && r <= rows);
                cell.classList.toggle('is-on', on);
            });
        }

        var label = popoverEl.querySelector('[data-ozi-editor-table-size-label]');
        if (label) label.textContent = cols + ' × ' + rows + ' ' + _t('editor.tableSize');
    };

    /* par (cols, rows) que os campos numericos estao pedindo agora — o que o
       botao Inserir usa, e o estado pro qual a grade volta quando o mouse
       sai dela */
    OziEditor.prototype._tableFieldValues = function (popoverEl) {
        var colInput = popoverEl.querySelector('[data-ozi-editor-table-cols]');
        var rowInput = popoverEl.querySelector('[data-ozi-editor-table-rows]');
        return {
            cols: _tableSize(colInput && colInput.value, 2),
            rows: _tableSize(rowInput && rowInput.value, 2)
        };
    };

    /* true = o host pediu cabecalho. No modo md o checkbox esta desabilitado
       e marcado; ler `.checked` cobre os dois casos sem ramo especial. */
    OziEditor.prototype._tableWantsHeader = function (popoverEl) {
        var cb = popoverEl.querySelector('[data-ozi-editor-table-header]');
        return cb ? !!cb.checked : true;
    };

    /* insere a partir do popover: escreve o tamanho escolhido de volta nos
       campos (clique na grade tem que refleti-los) e fecha. Ponto unico dos
       tres caminhos de insercao — clique na celula, Enter na grade e botao
       Inserir. */
    OziEditor.prototype._applyTableFromPopover = function (popoverEl, cols, rows) {
        var values = this._tableFieldValues(popoverEl);
        cols = _tableSize(cols, values.cols);
        rows = _tableSize(rows, values.rows);

        var colInput = popoverEl.querySelector('[data-ozi-editor-table-cols]');
        var rowInput = popoverEl.querySelector('[data-ozi-editor-table-rows]');
        if (colInput) colInput.value = String(cols);
        if (rowInput) rowInput.value = String(rows);

        this._restoreSelection();
        this._insertTable(cols, rows, this._tableWantsHeader(popoverEl));
        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    /* ─────────────────────────────────────────────
     * [13e-2] EDICAO DE TABELA — v4.8.0
     *
     * A API nativa de HTMLTableElement (insertRow/deleteRow/insertCell/
     * deleteCell) faz quase tudo. O que sobra e manter a contagem de
     * celulas consistente entre <thead> e <tbody> ao mexer em COLUNA: as
     * duas secoes tem que andar juntas, senao a tabela fica com linhas de
     * larguras diferentes (e o _tableToMd, que casa celula com cabecalho
     * por indice, passa a descartar dado).
     * ───────────────────────────────────────────── */

    OziEditor.prototype._getSelectedTableCell = function () {
        return this._getClosestSelectionNode(['TD', 'TH']);
    };

    /* indice da celula na PROPRIA linha (nao no <table>) — e o indice de
       coluna, porque sem colspan/rowspan toda linha tem a mesma largura */
    OziEditor.prototype._cellColumnIndex = function (cell) {
        var row = cell.parentNode;
        return Array.prototype.indexOf.call(row.cells, cell);
    };

    /* celula nova respeitando a secao: linha de <thead> leva <th>, corpo
       leva <td>. insertCell() cria <td> sempre, entao thead precisa do
       caminho manual. O <br> nao e enfeite: celula totalmente vazia nao
       recebe caret em nenhum navegador. */
    OziEditor.prototype._insertCellInto = function (row, index) {
        var isHead = !!(row.parentNode && row.parentNode.tagName === 'THEAD');
        var cell;
        if (isHead) {
            cell = document.createElement('th');
            row.insertBefore(cell, row.cells[index] || null);
        } else {
            cell = row.insertCell(index);
        }
        cell.appendChild(document.createElement('br'));
        return cell;
    };

    OziEditor.prototype._tableAction = function (action) {
        var cell = this._getSelectedTableCell();
        if (!cell) return false;

        var row   = cell.parentNode;
        var table = this._closestIn(cell, 'table');
        if (!row || !table) return false;

        var colIndex = this._cellColumnIndex(cell);
        var self     = this;

        /* linha nova sempre no <tbody>, mesmo partindo de uma celula do
           <thead>: uma 2a linha de cabecalho nao tem representacao em GFM e
           quase nunca e o que se quer. Partindo do thead, "acima" nao tem
           destino valido — cai na primeira posicao do corpo. */
        function addRow(below) {
            var body = table.tBodies[0];
            if (!body) {
                body = document.createElement('tbody');
                table.appendChild(body);
            }

            var width = row.cells.length;
            /* veio do <thead>: "acima" nao tem destino valido no corpo, entao
               as duas direcoes caem na primeira posicao dele */
            var at = (row.parentNode === body)
                ? Array.prototype.indexOf.call(body.rows, row) + (below ? 1 : 0)
                : 0;

            var newRow = body.insertRow(at);
            for (var i = 0; i < width; i++) self._insertCellInto(newRow, i);
            return true;
        }

        /* coluna mexe em TODAS as linhas da tabela (thead + tbody), senao as
           secoes ficam com larguras diferentes */
        function addCol(after) {
            var at = colIndex + (after ? 1 : 0);
            Array.prototype.forEach.call(table.rows, function (r) {
                self._insertCellInto(r, Math.min(at, r.cells.length));
            });
            return true;
        }

        switch (action) {
            case 'rowAbove': return addRow(false);
            case 'rowBelow': return addRow(true);
            case 'colBefore': return addCol(false);
            case 'colAfter':  return addCol(true);

            /* remover a ultima linha do corpo (ou a unica que existe)
               deixaria uma tabela sem conteudo — remove a tabela inteira,
               que e o que o usuario quer dizer com isso */
            case 'rowRemove':
                if (table.rows.length <= 1) { table.parentNode.removeChild(table); return true; }
                row.parentNode.removeChild(row);
                return true;

            case 'colRemove':
                if (row.cells.length <= 1) { table.parentNode.removeChild(table); return true; }
                Array.prototype.forEach.call(table.rows, function (r) {
                    if (r.cells[colIndex]) r.deleteCell(colIndex);
                });
                return true;

            case 'remove':
                table.parentNode.removeChild(table);
                return true;
        }
        return false;
    };

    /* ─────────────────────────────────────────────
     * [13d] PASTE / PASTEFMT — acao imediata via
     * Clipboard API (nao e flag pro proximo Ctrl+V)
     * ───────────────────────────────────────────── */

    /* aviso visivel de erro (substitui o fail-open silencioso — achado do
       usuario na Fase 2: falha de permissao de clipboard passava
       despercebida, editor so continuava mostrando o que ja tinha, parecendo
       que "so cola o texto interno"). Elemento lazy, inserido entre toolbar
       e content. Generalizado na Fase 3 pra tambem cobrir erro de URL de
       imagem invalida e falha de upload — mesmo widget, mais de uma causa. */
    OziEditor.prototype._showWarning = function (msg) {
        var self = this;
        if (!self._warningEl) {
            self._warningEl = _el('div', 'ozi-editor-clipboard-warning');
            self._warningEl.style.display = 'none';
            self.wrap.insertBefore(self._warningEl, self.content);
        }
        self._warningEl.textContent = msg;
        self._warningEl.style.display = '';
        clearTimeout(self._warningTimer);
        self._warningTimer = setTimeout(function () {
            self._warningEl.style.display = 'none';
        }, 5000);
    };

    OziEditor.prototype._pasteFromClipboard = function (allowHtml) {
        var self = this;
        self.content.focus();

        if (!(window.navigator && navigator.clipboard &&
              (navigator.clipboard.readText || navigator.clipboard.read))) {
            self._dbg('Clipboard API indisponivel — paste/pasteFmt ignorado');
            self._showWarning(_t('editor.clipboardBlocked'));
            return;
        }

        var afterInsert = function () {
            self._saveSelection();
            self._syncToTextarea();
            self._updateToolbarState();
            self.emitChange();
        };

        var insertPlain = function (text) {
            if (!text) return;
            document.execCommand('insertText', false, text);
            afterInsert();
        };

        var onClipboardError = function (err) {
            self._dbg('clipboard falhou', err);
            self._showWarning(_t('editor.clipboardBlocked'));
        };

        var doRead = function () {
            if (!allowHtml || !navigator.clipboard.read) {
                navigator.clipboard.readText().then(insertPlain, onClipboardError);
                return;
            }

            navigator.clipboard.read().then(function (items) {
                var htmlItem = null;
                items.forEach(function (item) {
                    if (!htmlItem && item.types.indexOf('text/html') > -1) htmlItem = item;
                });
                if (!htmlItem) return navigator.clipboard.readText().then(insertPlain, onClipboardError);

                return htmlItem.getType('text/html').then(function (blob) { return blob.text(); }).then(function (html) {
                    document.execCommand('insertHTML', false, _sanitizeHtml(html));
                    afterInsert();
                });
            }).catch(onClipboardError);
        };

        /* checagem de permissao ANTES de tentar ler — 'clipboard-read' nao e
           reconhecido pelo Permissions API em todo browser (ex.: Firefox),
           entao query() pode lancar sincrono OU nao existir; nesses casos
           cai direto pro doRead(), que e quem realmente dispara o prompt
           nativo do navegador na 1a vez (ou falha, capturado acima) */
        var permQuery = null;
        try {
            permQuery = (navigator.permissions && navigator.permissions.query)
                ? navigator.permissions.query({ name: 'clipboard-read' })
                : null;
        } catch (e) { permQuery = null; }

        if (permQuery && typeof permQuery.then === 'function') {
            permQuery.then(function (status) {
                if (status.state === 'denied') { self._showWarning(_t('editor.clipboardBlocked')); return; }
                doRead();
            }, doRead);
        } else {
            doRead();
        }
    };

    /* ─────────────────────────────────────────────
     * [14] CARREGAMENTO DE ICONES SVG
     * ───────────────────────────────────────────── */

    OziEditor.prototype._loadIcons = function () {
        var self = this;
        var h    = _h();

        var _textFallback = function (iconEl, tool) {
            if (/^h[1-6]$/.test(tool))    { iconEl.innerHTML = '<strong>' + tool.toUpperCase() + '</strong>'; }
            else if (tool === 'heading')  { iconEl.innerHTML = 'H'; }
            else if (tool === 'classes')  { iconEl.innerHTML = '&#127991;'; }
            else                          { iconEl.textContent = tool; }
        };

        Array.prototype.forEach.call(self.toolbar.querySelectorAll('[data-ozi-editor-tool]'), function (btn) {
            var tool = btn.getAttribute('data-ozi-editor-tool');
            var meta = TOOL_META[tool];
            if (!meta) return;

            var iconEl = btn.querySelector('.ozi-editor-btn-icon');
            if (!iconEl) return;

            if (!h.icon) { _textFallback(iconEl, tool); return; }

            h.icon(iconEl, meta.icon, { plugin: 'editor', fallback: meta.labelKey.split('.').pop() });
        });

        /* chevron do grupo colapsavel (toolbar responsiva) — chrome
           estrutural sem data-ozi-editor-tool (nao e um TOOL_META), o laco
           acima nao alcanca; um unico icon-chevron-down.svg serve ▼/▲ via
           rotate(180deg) em CSS (.is-open), nao precisa de 2o arquivo */
        Array.prototype.forEach.call(self.toolbar.querySelectorAll('.ozi-editor-collapse-chevron'), function (iconEl) {
            if (!h.icon) { iconEl.innerHTML = '&#9660;'; return; }
            h.icon(iconEl, 'chevron-down', { plugin: 'editor', fallback: 'moreTools' });
        });

        /* setas do modo Scroll — mesmo chrome estrutural, tambem nao alcancado
           pelo laco de [data-ozi-editor-tool] acima. 1 unico icon-chevron-
           left.svg serve prev/next via rotate(180deg) em CSS, mesmo padrao
           do chevron do colapso. */
        Array.prototype.forEach.call(self.toolbar.querySelectorAll('.ozi-editor-scroll-arrow-icon'), function (iconEl) {
            var isPrev = !!iconEl.closest('.ozi-editor-btn--scroll-prev');
            if (!h.icon) { iconEl.innerHTML = isPrev ? '&#9664;' : '&#9654;'; return; }
            h.icon(iconEl, 'chevron-left', { plugin: 'editor', fallback: isPrev ? 'scrollPrev' : 'scrollNext' });
        });

        /* botoes de alinhamento de imagem (v4.7.0) — vivem DENTRO do popover
           e nao carregam data-ozi-editor-tool de proposito (o dispatcher
           generico os executaria como ferramenta), entao o laco principal
           tambem nao alcanca. Icone proprio por modo: os icon-left/center/
           right existentes sao de alinhamento de TEXTO e ja estao em uso. */
        Array.prototype.forEach.call(self.toolbar.querySelectorAll('[data-ozi-editor-image-align-icon]'), function (btn) {
            var iconEl = btn.querySelector('.ozi-editor-popover-align-icon');
            var name   = btn.getAttribute('data-ozi-editor-image-align-icon');
            if (!iconEl) return;
            if (!h.icon) { iconEl.textContent = btn.getAttribute('data-ozi-editor-image-align'); return; }
            h.icon(iconEl, name, { plugin: 'editor', fallback: btn.getAttribute('data-ozi-editor-image-align') });
        });
    };

    /* ─────────────────────────────────────────────
     * [15] CONVERSORES — hooks para ozi-editor-md.js
     * ───────────────────────────────────────────── */

    OziEditor.prototype._convertIn = function (raw) {
        if (this.editorType === 'md' && _converters.mdToHtml) return _converters.mdToHtml(raw);
        return raw;
    };

    OziEditor.prototype._convertOut = function (html) {
        if (this.editorType === 'md' && _converters.htmlToMd) return _converters.htmlToMd(html);
        return html;
    };

    /* ─────────────────────────────────────────────
     * [16] SINCRONIZACAO TEXTAREA <-> CONTENT
     * ───────────────────────────────────────────── */

    OziEditor.prototype._syncFromTextarea = function () {
        var raw  = this.textarea.value || '';
        var html = this._convertIn(raw);
        this.content.innerHTML = _sanitizeHtml(html);
    };

    OziEditor.prototype._syncToTextarea = function () {
        if (this.isSourceMode) { this.textarea.value = this.source.value; return; }
        this.textarea.value = this._convertOut(this.content.innerHTML);
    };

    /* ─────────────────────────────────────────────
     * [17] HELPERS DE SELECAO E PARAGRAFO
     * ───────────────────────────────────────────── */

    OziEditor.prototype._saveSelection = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        var range = sel.getRangeAt(0);
        if (!this.content.contains(range.commonAncestorContainer)) return;
        this._savedRange = range.cloneRange();
    };

    OziEditor.prototype._restoreSelection = function () {
        if (!this._savedRange) return;
        var sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(this._savedRange);
    };

    OziEditor.prototype._getClosestSelectionNode = function (tagNames) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        var node = sel.anchorNode;
        if (!node) return null;
        if (node.nodeType === 3) node = node.parentNode;
        tagNames = tagNames.map(function (t) { return t.toUpperCase(); });
        while (node && node !== this.content) {
            if (tagNames.indexOf(String(node.tagName || '').toUpperCase()) !== -1) return node;
            node = node.parentNode;
        }
        return null;
    };

    OziEditor.prototype._getClosestBlockElement = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        var node = sel.anchorNode;
        if (!node) return null;
        if (node.nodeType === 3) node = node.parentNode;
        var blockTags = ['P','H1','H2','H3','H4','H5','H6','DIV','LI','TD','TH','PRE','BLOCKQUOTE'];
        while (node && node !== this.content) {
            if (blockTags.indexOf(String(node.tagName || '').toUpperCase()) !== -1) return node;
            node = node.parentNode;
        }
        return null;
    };

    OziEditor.prototype._getRootInlineNodes = function () {
        var result    = [];
        var root      = this.content;
        if (!root) return result;
        var blockTags = ['P','H1','H2','H3','H4','H5','H6','DIV','UL','OL','LI','PRE','TABLE','TBODY','THEAD','TR','TD','TH','BLOCKQUOTE'];
        Array.prototype.slice.call(root.childNodes || []).forEach(function (node) {
            if (node.nodeType === 3) {
                if (String(node.nodeValue || '').trim() !== '') result.push(node);
                return;
            }
            if (node.nodeType !== 1) return;
            if (blockTags.indexOf(String(node.tagName || '').toUpperCase()) !== -1) return;
            result.push(node);
        });
        return result;
    };

    OziEditor.prototype._wrapRootInlineContentInParagraph = function () {
        var root = this.content;
        if (!root) return null;
        var inlineNodes = this._getRootInlineNodes();
        if (!inlineNodes.length) return null;
        var p = document.createElement('p');
        inlineNodes.forEach(function (node) { p.appendChild(node); });
        root.insertBefore(p, root.firstChild);
        return p;
    };

    OziEditor.prototype._insertHtmlAtCursor = function (html) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) { this.content.insertAdjacentHTML('beforeend', html); return; }
        var range = sel.getRangeAt(0);
        range.deleteContents();
        var temp = document.createElement('div');
        temp.innerHTML = html;
        var frag = document.createDocumentFragment();
        var lastNode = null, node;
        while ((node = temp.firstChild)) { lastNode = frag.appendChild(node); }
        range.insertNode(frag);
        if (lastNode) {
            range = range.cloneRange();
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    };

    OziEditor.prototype._ensureBlockForAlignment = function () {
        var block = this._getClosestBlockElement();
        if (block) return block;
        block = this._wrapRootInlineContentInParagraph();
        if (block) return block;
        this._insertHtmlAtCursor('<p><br></p>');
        return this._getClosestBlockElement();
    };

    /* ─────────────────────────────────────────────
     * [18] EXECUCAO DE FERRAMENTAS
     * ───────────────────────────────────────────── */

    OziEditor.prototype._runTool = function (tool) {
        var meta = TOOL_META[tool];
        if (!meta) return;
        if (tool === 'classes') return;
        if (tool === 'heading') return;
        /* abertura de popover ja tratada por handler dedicado em _bindEvents —
           aqui e so o no-op do dispatch generico (mesmo padrao de heading/classes) */
        if (tool === 'link' || tool === 'color' || tool === 'highlight' ||
            tool === 'image' || tool === 'table') return;

        this.content.focus();

        if (meta.execCmd) {
            document.execCommand(meta.execCmd, false, null);
            this._saveSelection();
            this._syncToTextarea();
            this._updateToolbarState();
            this.emitChange();
            return;
        }

        switch (tool) {
            case 'codeblock': this._toggleCodeBlock();        break;
            case 'source':    this._toggleSourceMode();       break;
            /* [v4.8.0] `table` saiu daqui: virou popover (ver [13e]) e ja
               retorna na guarda no topo deste metodo, junto de link/color/
               highlight/image */
            case 'clear':     this._clearFormat();            break;
            case 'left':      this._applyTextAlign('left');    break;
            case 'center':    this._applyTextAlign('center');  break;
            case 'right':     this._applyTextAlign('right');   break;
            case 'justify':   this._applyTextAlign('justify'); break;
            case 'quote':     this._toggleQuote();             break;
            case 'hr':        this._insertHr();                break;
            /* [v4.9.0] fora de lista nao fazem nada (o botao ja aparece
               desabilitado por _updateToolbarState) — `return` pula a cauda
               sincrona, que emitiria ozi:change sem nada ter mudado */
            case 'indent':    if (!this._applyListIndent(true))  return; break;
            case 'outdent':   if (!this._applyListIndent(false)) return; break;
            /* assincronas — cuidam do proprio sync/emit ao resolver, por
               isso `return` em vez de `break` (pulam a cauda sincrona abaixo) */
            case 'paste':     this._pasteFromClipboard(false); return;
            case 'pasteFmt':  this._pasteFromClipboard(true);  return;
            case 'h1': case 'h2': case 'h3':
            case 'h4': case 'h5': case 'h6':
                this._toggleHeading(tool); break;
        }

        this._syncToTextarea();
        this._updateToolbarState();
        this.emitChange();
    };

    /* ─────────────────────────────────────────────
     * [19] HEADING / CODEBLOCK / TABLE / CLEAR / ALIGN
     * ───────────────────────────────────────────── */

    OziEditor.prototype._toggleHeading = function (level) {
        var block = this._getClosestBlockElement();
        if (!block) {
            block = this._wrapRootInlineContentInParagraph();
            if (!block) { this._insertHtmlAtCursor('<p><br></p>'); block = this._getClosestBlockElement(); }
        }
        if (!block) return;

        var currentTag = String(block.tagName || '').toLowerCase();
        var targetTag  = currentTag === level ? 'p' : level;
        var newBlock   = document.createElement(targetTag);

        if (block.className)                      newBlock.className = block.className;
        if (block.style && block.style.textAlign) newBlock.style.textAlign = block.style.textAlign;

        while (block.firstChild) newBlock.appendChild(block.firstChild);
        block.parentNode.replaceChild(newBlock, block);

        var sel = window.getSelection();
        if (sel) {
            var range = document.createRange();
            range.selectNodeContents(newBlock);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        this._saveSelection();
    };

    /* mesmo padrao do _toggleHeading (troca a tag do bloco), so que entre
       p<->blockquote em vez de p<->hX */
    OziEditor.prototype._toggleQuote = function () {
        var block = this._getClosestBlockElement();
        if (!block) {
            block = this._wrapRootInlineContentInParagraph();
            if (!block) { this._insertHtmlAtCursor('<p><br></p>'); block = this._getClosestBlockElement(); }
        }
        if (!block) return;

        var currentTag = String(block.tagName || '').toLowerCase();
        var targetTag  = currentTag === 'blockquote' ? 'p' : 'blockquote';
        var newBlock   = document.createElement(targetTag);

        if (block.className)                      newBlock.className = block.className;
        if (block.style && block.style.textAlign) newBlock.style.textAlign = block.style.textAlign;

        while (block.firstChild) newBlock.appendChild(block.firstChild);
        block.parentNode.replaceChild(newBlock, block);

        var sel = window.getSelection();
        if (sel) {
            var range = document.createRange();
            range.selectNodeContents(newBlock);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        this._saveSelection();
    };

    OziEditor.prototype._insertHr = function () {
        document.execCommand('insertHTML', false, '<hr><p><br></p>');
    };

    OziEditor.prototype._toggleCodeBlock = function () {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        var node  = sel.getRangeAt(0).commonAncestorContainer;
        var start = node.nodeType === 3 ? node.parentElement : node;
        var pre   = (start && start.closest) ? start.closest('pre') : null;

        if (pre && this.content.contains(pre)) {
            var parent = pre.parentNode;
            while (pre.firstChild) parent.insertBefore(pre.firstChild, pre);
            parent.removeChild(pre);
        } else {
            var range = sel.getRangeAt(0);
            var preEl = document.createElement('pre');
            var code  = document.createElement('code');
            try { code.appendChild(range.extractContents()); }
            catch (e) { code.textContent = sel.toString(); }
            preEl.appendChild(code);
            range.insertNode(preEl);
        }
    };

    /* [v4.8.0] `rows` e o TOTAL de linhas visiveis — o que o usuario conta na
       grade do seletor. Com cabecalho, 1 delas vai pro <thead> e o resto pro
       <tbody>; `rows:1` + cabecalho gera tabela so com <thead> (HTML e GFM
       validos) em vez de um <tbody> vazio.

       O <p><br></p> final NAO e enfeite: e o escape que impede o caret de
       ficar preso no fim da tabela (a versao 2x2 fixa ja o emitia, e a razao
       nunca tinha sido escrita).

       Assinatura defensiva com defaults: `_runTool` nao chama mais este
       metodo (table virou popover), mas a chamada sem argumentos — de um
       teste antigo ou de codigo do host — continua produzindo a 2x2 de
       sempre em vez de NaN celulas. */
    OziEditor.prototype._insertTable = function (cols, rows, withHeader) {
        cols = _tableSize(cols, 2);
        rows = _tableSize(rows, 2);

        /* modo md: cabecalho obrigatorio. GFM exige a linha de cabecalho, e
           sem <thead> o _tableToMd promove a primeira linha do corpo — o
           dado do usuario mudaria de papel no round-trip, em silencio. O
           checkbox da UI ja nasce ligado e desabilitado aqui; esta linha
           cobre a chamada programatica. */
        if (this.editorType === 'md') withHeader = true;

        var cellsRow = function (tag) {
            var out = '<tr>';
            for (var c = 0; c < cols; c++) out += '<' + tag + '><br></' + tag + '>';
            return out + '</tr>';
        };

        var bodyRows = withHeader ? rows - 1 : rows;
        var html     = '<table>';

        if (withHeader) html += '<thead>' + cellsRow('th') + '</thead>';

        if (bodyRows > 0) {
            html += '<tbody>';
            for (var r = 0; r < bodyRows; r++) html += cellsRow('td');
            html += '</tbody>';
        }

        html += '</table><p><br></p>';

        this.content.focus();

        /* `execCommand('insertHTML')` e nao `_insertHtmlAtCursor`: so o
           primeiro entra no undo stack NATIVO do contenteditable, e a
           ferramenta `undo` da toolbar e exatamente `execCommand('undo')`.
           Manipular Range direto inseriria a tabela fora da pilha e o Ctrl+Z
           seguinte desfaria a edicao ANTERIOR, deixando a tabela na tela —
           era isso que a versao 2x2 fixa fazia certo sem dizer por que.
           O fallback cobre o navegador que nao suporte o comando (mesmo
           padrao do insertParagraph no keydown do Enter). */
        try {
            if (!document.execCommand('insertHTML', false, html)) {
                this._insertHtmlAtCursor(html);
            }
        } catch (err) {
            this._insertHtmlAtCursor(html);
        }

        this._saveSelection();
    };

    /* ─────────────────────────────────────────────
     * [19b] INDENTACAO DE LISTA — v4.9.0
     * ───────────────────────────────────────────── */

    /* true = o caret esta dentro de um item de lista. E a UNICA condicao em
       que indent/outdent agem: fora de lista o `indent` nativo vira
       <blockquote style="margin-left:40px"> e, como o sanitizador apaga o
       style, o texto viraria uma CITACAO de verdade (medido em probe). */
    OziEditor.prototype._inListItem = function () {
        return !!this._getClosestSelectionNode(['LI']);
    };

    /* O `indent` do Chromium produz markup INVALIDO dentro de lista:
           <ul><li>um</li><ul><li>dois</li></ul></ul>
       com o <ul> aninhado como IRMAO do <li>, nao filho dele. Alem de
       invalido, isso APAGA o item na conversao pra MD (o _listToMd itera
       filhos diretos e ignora o que nao e <li>).
       Esta funcao move cada lista solta pra dentro do <li> imediatamente
       anterior — a forma valida, que sobrevive ao round-trip. Roda logo
       depois do execCommand: medido que o undo nativo continua desfazendo
       os dois passos de uma vez (ver changelog da 4.9.0). */
    OziEditor.prototype._normalizeNestedLists = function () {
        var soltas = this.content.querySelectorAll('ul > ul, ul > ol, ol > ul, ol > ol');
        Array.prototype.forEach.call(soltas, function (lista) {
            var anterior = lista.previousElementSibling;

            /* sem <li> antes (lista aninhada logo na 1a posicao) nao ha onde
               encaixar sem inventar conteudo — cria um <li> vazio pra
               segurar o nivel, que e o que o browser renderiza de todo jeito */
            if (!anterior || anterior.tagName !== 'LI') {
                anterior = document.createElement('li');
                lista.parentNode.insertBefore(anterior, lista);
            }
            anterior.appendChild(lista);
        });
    };

    /* `indent` true / `outdent` false. Devolve se algo foi aplicado — o
       chamador so sincroniza/emite quando houve mudanca de verdade. */
    OziEditor.prototype._applyListIndent = function (isIndent) {
        if (!this._inListItem()) return false;

        this.content.focus();
        try {
            document.execCommand(isIndent ? 'indent' : 'outdent', false, null);
        } catch (err) {
            return false;
        }

        /* so o indent cria lista solta; o outdent devolve markup valido
           (medido) — mas normalizar nos dois e barato e cobre o caso de a
           arvore ja estar torta de um paste ou de um setValue do host */
        this._normalizeNestedLists();
        this._saveSelection();
        return true;
    };

    OziEditor.prototype._clearFormat = function () {
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
        var sel = window.getSelection();
        if (sel && sel.rangeCount) {
            var node = sel.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === 3) node = node.parentNode;
            if (node && node.removeAttribute) node.removeAttribute('style');
        }
    };

    OziEditor.prototype._applyTextAlign = function (align) {
        this._restoreSelection();
        var block = this._ensureBlockForAlignment();
        if (!block) return;
        block.style.textAlign = align;
        this._saveSelection();
    };

    /* ─────────────────────────────────────────────
     * [20] MODO SOURCE
     * ───────────────────────────────────────────── */

    OziEditor.prototype._toggleSourceMode = function () {
        this.isSourceMode ? this._exitSourceMode() : this._enterSourceMode();
    };

    OziEditor.prototype._enterSourceMode = function () {
        this._syncToTextarea();
        this.source.value = this.textarea.value;
        this.source.style.display = 'block';
        this.content.style.display = 'none';
        this._setToolActive('source', true);
        this.isSourceMode = true;
    };

    OziEditor.prototype._exitSourceMode = function () {
        var raw  = this.source.value;
        var html = this._convertIn(raw);
        this.content.innerHTML = _sanitizeHtml(html);
        this.content.style.display = '';
        this.source.style.display = 'none';
        this._setToolActive('source', false);
        this.isSourceMode = false;
        this._syncToTextarea();
    };

    /* ─────────────────────────────────────────────
     * [21] ESTADO DA TOOLBAR
     * ───────────────────────────────────────────── */

    OziEditor.prototype._setToolActive = function (tool, active) {
        Array.prototype.forEach.call(this.toolbar.querySelectorAll('[data-ozi-editor-tool="' + tool + '"]'), function (b) {
            b.classList.toggle('ozi-editor-btn--active', !!active);
        });
    };

    OziEditor.prototype._updateToolbarState = function () {
        var self = this;

        ['bold', 'italic', 'underline'].forEach(function (cmd) {
            var active = false;
            try { active = document.queryCommandState(cmd); } catch (e) {}
            self._setToolActive(cmd, active);
        });

        /* strike: nome do tool difere do nome do comando nativo (strikeThrough) */
        var strikeActive = false;
        try { strikeActive = document.queryCommandState('strikeThrough'); } catch (e) {}
        self._setToolActive('strike', strikeActive);

        var inCode = false;
        var sel = window.getSelection();
        if (sel && sel.rangeCount) {
            var node  = sel.getRangeAt(0).commonAncestorContainer;
            var start = node.nodeType === 3 ? node.parentElement : node;
            var pc    = (start && start.closest) ? start.closest('pre, code') : null;
            inCode = !!(pc && self.content.contains(pc));
        }
        self._setToolActive('codeblock', inCode);

        ['left', 'center', 'right'].forEach(function (align) {
            var active = false;
            try { active = document.queryCommandState('justify' + align.charAt(0).toUpperCase() + align.slice(1)); } catch (e) {}
            self._setToolActive(align, active);
        });

        /* justifyFull e o nome nativo do "justificado completo" (diferente do
           padrao 'justify'+Cap dos 3 acima) */
        var justifyActive = false;
        try { justifyActive = document.queryCommandState('justifyFull'); } catch (e) {}
        self._setToolActive('justify', justifyActive);

        /* [v4.9.0] indent/outdent só se aplicam dentro de lista — fora dela
           o botão fica DESABILITADO em vez de virar citação (o `indent`
           nativo produz <blockquote> num parágrafo). `disabled` real, não só
           classe: assim o botão também para de receber o clique.
           Guardado por self.isDisabled pra não reabilitar botão de um editor
           inteiro desabilitado (_setDisabled marca todos). */
        var emLista = self._inListItem();
        ['indent', 'outdent'].forEach(function (tool) {
            Array.prototype.forEach.call(
                self.toolbar.querySelectorAll('.ozi-editor-btn[data-ozi-editor-tool="' + tool + '"]'),
                function (b) { b.disabled = self.isDisabled ? true : !emLista; }
            );
        });

        var block      = self._getClosestBlockElement();
        var currentTag = block ? String(block.tagName || '').toLowerCase() : '';
        Array.prototype.forEach.call(self.toolbar.querySelectorAll('.ozi-editor-btn--heading'), function (b) {
            b.classList.toggle('ozi-editor-btn--active', /^h[1-6]$/.test(currentTag));
        });
        self._setToolActive('quote', currentTag === 'blockquote');

        /* varre TODOS os popovers de heading/classes abertos (nao so "o
           ultimo" — a toolbar responsiva pode ter mais de uma instancia
           simultanea no DOM, uma por variante de breakpoint); id sempre
           comeca com "heading-"/"classes-" (ver _buildHeadingButton/
           _buildClassesButton) */
        (self._popovers || []).forEach(function (p) {
            if (!_isShown(p.el)) return;
            if (/^heading-/.test(p.name)) self._updateHeadingDropdownChecks(p.el);
            else if (/^classes-/.test(p.name)) self._updateClassDropdownChecks(p.el);
        });
    };

    /* ─────────────────────────────────────────────
     * [22] EVENTOS — delegacao nativa por wrap (rastreada p/ destroy)
     * ───────────────────────────────────────────── */

    OziEditor.prototype._closestIn = function (target, selector) {
        var found = target && target.closest ? target.closest(selector) : null;
        return (found && this.wrap.contains(found)) ? found : null;
    };

    OziEditor.prototype._bindEvents = function () {
        var self = this;

        /* botao de ferramenta (exclui classes, incompativel, o chevron de
           colapso e as setas de scroll — chrome estrutural da toolbar
           responsiva, nao ferramenta do TOOL_META) */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn:not(.ozi-editor-btn--classes):not(.ozi-editor-btn--incompatible):not(.ozi-editor-btn--collapse-toggle):not(.ozi-editor-btn--scroll-prev):not(.ozi-editor-btn--scroll-next)');
            if (!btn) return;
            e.preventDefault();
            if (!self.isDisabled) {
                self._restoreSelection();
                self._runTool(btn.getAttribute('data-ozi-editor-tool'));
            }
        });

        /* setas de scroll horizontal (modo Scroll) — chrome estrutural, sem
           data-ozi-editor-tool (excluido acima). Track e sempre irma direta
           da seta dentro do mesmo .ozi-editor-toolbar-scroll, nao precisa de
           id de correlacao como o colapso. Sem checagem propria de
           self.isDisabled aqui (diferente do dispatcher generico de tool,
           que executa execCommand no conteudo) — _setDisabled() ja marca
           TODO .ozi-editor-btn (inclusive estas setas e o collapse-toggle)
           como disabled=true quando o editor esta desabilitado, entao o
           guard de btn.disabled abaixo ja cobre o caso, uniforme com o
           resto da toolbar. */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn--scroll-prev, .ozi-editor-btn--scroll-next');
            if (!btn || btn.disabled) return;
            e.preventDefault();
            var track = btn.parentNode.querySelector('.ozi-editor-toolbar-scroll-track');
            if (!track) return;
            var dir = btn.getAttribute('data-ozi-editor-scroll-dir') === 'prev' ? -1 : 1;
            /* sem behavior:'smooth' de proposito — mesmo precedente do modo
               Colapso ("display puro, sem animacao, acabamento fica pra
               depois"); smooth-scroll tambem nao avanca em Chromium headless
               sob virtual-time-budget (achado empirico rodando o aceite),
               instantaneo e testavel deterministicamente. */
            track.scrollBy({ left: dir * Math.max(track.clientWidth * 0.8, 40) });
        });

        /* botao heading — abre/fecha dropdown. _togglePopover ja fecha
           qualquer outro popover aberto sozinho (inclusive um classes de
           outra variante de breakpoint) — nao precisa mais de force-close
           manual do dropdown irmao. */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn--heading');
            if (!btn) return;
            e.preventDefault();
            if (!self.isDisabled) self._togglePopover(btn.getAttribute('data-ozi-editor-popover-id'));
        });

        /* item de heading */
        self._on(self.wrap, 'mousedown', function (e) {
            var it = self._closestIn(e.target, '.ozi-editor-heading-item');
            if (!it) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var level = it.getAttribute('data-ozi-heading');
            self._togglePopover(self._popoverIdFromElement(it), true);
            self._restoreSelection();
            self._toggleHeading(level);
            self._syncToTextarea();
            self._updateToolbarState();
            self.emitChange();
        });

        /* botao classes — abre/fecha dropdown */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn--classes');
            if (!btn) return;
            e.preventDefault();
            if (!self.isDisabled) self._togglePopover(btn.getAttribute('data-ozi-editor-popover-id'));
        });

        /* item de classe */
        self._on(self.wrap, 'mousedown', function (e) {
            var it = self._closestIn(e.target, '.ozi-editor-classes-item');
            if (!it) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var cls = it.getAttribute('data-ozi-class');
            self._togglePopover(self._popoverIdFromElement(it), true);
            self._restoreSelection();
            self._applyClass(cls);
            self._updateToolbarState();
        });

        /* botoes de popover (link/color/highlight/image/table) — abrem seu
           proprio popover. `table` entrou na v4.8.0: ate a 4.7.1 era acao
           direta do dispatcher generico (inseria uma 2x2 fixa). */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target,
                '.ozi-editor-btn[data-ozi-editor-tool="link"], ' +
                '.ozi-editor-btn[data-ozi-editor-tool="color"], ' +
                '.ozi-editor-btn[data-ozi-editor-tool="highlight"], ' +
                '.ozi-editor-btn[data-ozi-editor-tool="image"], ' +
                '.ozi-editor-btn[data-ozi-editor-tool="table"]');
            if (!btn) return;
            e.preventDefault();
            if (!self.isDisabled) self._togglePopover(btn.getAttribute('data-ozi-editor-popover-id'));
        });

        /* popover flutuante (v4.7.1) — `position:fixed` nao acompanha o
           trigger sozinho. CAPTURE no `scroll` porque o evento nao borbulha:
           sem capture, rolar o proprio `.ozi-editor-content` (ou qualquer
           container do host) deixaria o popover parado na tela. Gateado por
           "tem popover aberto?" dentro do _repositionOpenPopovers, entao o
           custo e um `forEach` vazio enquanto nada esta aberto. Registrado
           pelo `_on` = removido pelo `destroy()`. */
        var onReposition = function () { self._repositionOpenPopovers(); };
        self._on(window, 'scroll', onReposition, true);
        self._on(window, 'resize', onReposition);

        /* chevron de colapso (toolbar responsiva) — abre/fecha a 2a linha
           inline irma da row (data-ozi-editor-collapse-id liga trigger e
           painel, nao adjacencia de DOM — cobre 2 {} na mesma linha).
           display puro, sem animacao de altura (acabamento fica pra depois,
           a pedido do usuario). */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '.ozi-editor-btn--collapse-toggle');
            if (!btn) return;
            e.preventDefault();
            var id = btn.getAttribute('data-ozi-editor-collapse-id');
            var panel = self.wrap.querySelector('[data-ozi-editor-collapse-panel][data-ozi-editor-collapse-id="' + id + '"]');
            if (!panel) return;
            var open = panel.style.display === 'none';
            panel.style.display = open ? '' : 'none';
            btn.classList.toggle('is-open', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            var label = _t(open ? 'editor.fewerTools' : 'editor.moreTools');
            btn.title = label; btn.setAttribute('aria-label', label);
        });

        /* clicar numa <img> do content abre o popover de edicao dela direto
           (Fase 3, ajuste pos-revisao do usuario) — sem isso seria preciso
           clicar na imagem E DEPOIS no botao "image" da toolbar. Seleciona
           o no da imagem manualmente (Range.selectNode) antes de abrir, pra
           _getSelectedImage() no onOpen encontrar a mesma imagem clicada.
           stopPropagation() evita que o listener de "clique fora" (ligado no
           document, mais abaixo) feche este popover no mesmo evento —
           clicar dentro do content nao esta dentro do wrap do popover
           "image" (que so contem botao+popover, nao o content inteiro).
           Nao ha um botao "clicado" pra derivar o id (o clique foi no
           content, nao na toolbar) — com a toolbar responsiva pode haver
           mais de um trigger "image" no DOM (uma por variante de
           breakpoint); usa o trigger VISIVEL no momento (_visibleToolTrigger,
           ver secao [11b]/popover generico). */
        function openImagePopoverFor(img) {
            var range = document.createRange();
            range.selectNode(img);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            self._saveSelection();
            var trigger = self._visibleToolTrigger('image');
            if (trigger) self._openPopover(trigger.getAttribute('data-ozi-editor-popover-id'));
        }

        self._on(self.wrap, 'mousedown', function (e) {
            if (self.isDisabled) return;
            var img = self._closestIn(e.target, '.ozi-editor-content img');
            if (!img) return;
            e.preventDefault();
            e.stopPropagation();

            /* [v4.7.0] imagem em modo livre e ARRASTAVEL: o popover so abre no
               mouseup, e so se o gesto tiver sido um clique (< 4px). Imagem
               normal mantem o comportamento anterior byte a byte — abrir no
               mousedown — porque o aceite da Fase 3 dispara so `mousedown` e
               exige o popover aberto; adiar pra todo mundo regrediria ele. */
            if (e.button === 0 && !self.isSourceMode && self._getImageAlign(img) === 'free') {
                self._startImageDrag(img, e);
                /* o popover fica `position:absolute` logo abaixo da toolbar e
                   cobriria justamente a area onde o arrasto acontece */
                self._closeAllPopovers();
                return;
            }

            openImagePopoverFor(img);
        });

        /* arrasto da imagem livre — registrados UMA VEZ (ver [13c-3]) */
        self._on(document, 'mousemove', function (e) {
            if (!self._imgDrag) return;
            self._moveImageDrag(e);
        });

        self._on(document, 'mouseup', function () {
            if (!self._imgDrag) return;
            var img = self._imgDrag.img;
            if (self._endImageDrag() && self.content.contains(img)) {
                openImagePopoverFor(img);   /* foi clique, nao arrasto */
            }
        });

        /* linha "Alinhamento" do popover de imagem — com imagem selecionada
           aplica na hora (precedente dos swatches de cor); sem imagem, guarda
           o pendente e o Aplicar usa na insercao */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '[data-ozi-editor-image-align]');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            if (self.isDisabled) return;

            var popover = btn.closest('.ozi-editor-popover');
            var mode    = btn.getAttribute('data-ozi-editor-image-align');
            self._syncAlignButtons(popover, mode);

            /* o onOpen do popover foca o campo de URL, e focar um <input>
               move a selecao do documento pra dentro dele — sem restaurar,
               _getSelectedImage() nunca acharia a imagem. Mesmo motivo pelo
               qual os handlers de aplicar/remover ja fazem isso. */
            self._restoreSelection();

            var img = self._getSelectedImage();
            if (!img) return;

            self._applyImageAlign(img, mode);
            self._syncToTextarea();
            self.emitChange();
        });

        /* popover de link — aplicar (le o input a partir do popover do
           proprio botao clicado, nao de um campo singular na instancia —
           necessario desde que a toolbar responsiva permite mais de um
           popover "link" simultaneo no DOM) */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '[data-ozi-editor-link-apply]');
            if (!btn) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var input = btn.closest('.ozi-editor-popover').querySelector('[data-ozi-editor-link-input]');
            self._restoreSelection();
            self._applyLink(input.value);
            self._togglePopover(self._popoverIdFromElement(btn), true);
        });

        /* popover de link — remover */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '[data-ozi-editor-link-remove]');
            if (!btn || btn.disabled) return;
            e.preventDefault();
            if (self.isDisabled) return;
            self._restoreSelection();
            self._removeLink();
            self._togglePopover(self._popoverIdFromElement(btn), true);
        });

        /* popover de link — Enter no campo de URL aplica */
        self._on(self.wrap, 'keydown', function (e) {
            var input = self._closestIn(e.target, '[data-ozi-editor-link-input]');
            if (!input) return;
            if (e.key !== 'Enter') return;
            e.preventDefault();
            self._restoreSelection();
            self._applyLink(input.value);
            self._togglePopover(self._popoverIdFromElement(input), true);
        });

        /* popover de imagem — aplicar por URL (campos lidos a partir do
           popover do botao clicado, mesmo motivo do link acima) */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '[data-ozi-editor-image-apply]');
            if (!btn) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var popover = btn.closest('.ozi-editor-popover');
            self._restoreSelection();
            self._applyImageUrl(
                popover.querySelector('[data-ozi-editor-image-url-input]').value,
                popover.querySelector('[data-ozi-editor-image-alt-input]').value,
                popover.querySelector('[data-ozi-editor-image-width-input]').value,
                popover.querySelector('[data-ozi-editor-image-height-input]').value,
                self._pendingAlign(popover));
            self._togglePopover(self._popoverIdFromElement(btn), true);
        });

        /* popover de imagem — remover */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '[data-ozi-editor-image-remove]');
            if (!btn || btn.disabled) return;
            e.preventDefault();
            if (self.isDisabled) return;
            self._restoreSelection();
            self._removeImage();
            self._togglePopover(self._popoverIdFromElement(btn), true);
        });

        /* popover de imagem — Enter no campo de URL aplica */
        self._on(self.wrap, 'keydown', function (e) {
            var input = self._closestIn(e.target, '[data-ozi-editor-image-url-input]');
            if (!input) return;
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var popover = input.closest('.ozi-editor-popover');
            self._restoreSelection();
            self._applyImageUrl(
                input.value,
                popover.querySelector('[data-ozi-editor-image-alt-input]').value,
                popover.querySelector('[data-ozi-editor-image-width-input]').value,
                popover.querySelector('[data-ozi-editor-image-height-input]').value,
                self._pendingAlign(popover));
            self._togglePopover(self._popoverIdFromElement(input), true);
        });

        /* popover de imagem — selecionar arquivo dispara upload automatico
           (mesmo espirito de acao imediata ja usado em paste/pasteFmt na
           Fase 2 — selecionar o arquivo ja e o gesto de intencao). Passa o
           popover do proprio input (nao um campo singular na instancia) —
           _uploadImage le alt/width/height e mostra o estado "enviando"
           dentro DESSE popover especifico. */
        self._on(self.wrap, 'change', function (e) {
            var input = self._closestIn(e.target, '[data-ozi-editor-image-file-input]');
            if (!input || !input.files || !input.files[0]) return;
            if (self.isDisabled) return;
            var file = input.files[0];
            input.value = '';
            self._restoreSelection();
            self._uploadImage(file, input.closest('.ozi-editor-popover'));
        });

        /* ── popover de tabela (v4.8.0) ────────────────────────────────── */

        /* grade — hover pinta o retangulo. `mousemove` no CONTAINER (nao
           `mouseenter` em 80 celulas): um listener delegado no lugar de 80,
           e o alvo sai do e.target. Sem preventDefault aqui — mover o mouse
           nao e gesto de intencao, e um preventDefault no mousemove atrapalha
           a selecao do documento. */
        self._on(self.wrap, 'mousemove', function (e) {
            var cell = self._closestIn(e.target, '.ozi-editor-table-cell');
            if (!cell) return;
            var popover = cell.closest('.ozi-editor-popover');
            if (!popover) return;
            self._syncTableGrid(popover,
                parseInt(cell.getAttribute('data-ozi-editor-table-col'), 10),
                parseInt(cell.getAttribute('data-ozi-editor-table-row'), 10));
        });

        /* mouse saiu da grade — volta pro que os campos numericos pedem, nao
           pro ultimo hover: o retangulo aceso tem que continuar dizendo a
           verdade sobre o que o botao Inserir vai fazer.

           CAPTURE porque `mouseleave` nao borbulha (mesmo motivo do `scroll`
           do _repositionOpenPopovers, v4.7.1) — mas aqui o alvo tem que ser
           a GRADE em si, testada por identidade e nao por `closest`: sair de
           uma celula pra vizinha tambem dispara mouseleave NA CELULA, e um
           `closest` acharia o grid ancestral e resetaria o highlight a cada
           movimento dentro da propria grade. */
        self._on(self.wrap, 'mouseleave', function (e) {
            var grid = e.target;
            if (!grid || !grid.getAttribute) return;
            if (grid.getAttribute('data-ozi-editor-table-grid') !== 'true') return;
            if (!self.wrap.contains(grid)) return;
            var popover = grid.closest('.ozi-editor-popover');
            if (!popover) return;
            var v = self._tableFieldValues(popover);
            self._syncTableGrid(popover, v.cols, v.rows);
        }, true);

        /* grade — clique numa celula insere direto naquele tamanho */
        self._on(self.wrap, 'mousedown', function (e) {
            var cell = self._closestIn(e.target, '.ozi-editor-table-cell');
            if (!cell) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var popover = cell.closest('.ozi-editor-popover');
            self._applyTableFromPopover(popover,
                parseInt(cell.getAttribute('data-ozi-editor-table-col'), 10),
                parseInt(cell.getAttribute('data-ozi-editor-table-row'), 10));
            self._togglePopover(self._popoverIdFromElement(cell), true);
        });

        /* grade — navegacao por teclado. O container e o unico elemento
           focavel da grade (tabindex=0), entao as setas movem o retangulo em
           vez de rolar a pagina e o Enter insere. Sem isso a grade seria
           exclusiva de mouse — os campos numericos continuam sendo o caminho
           alternativo, mas a grade e o que tem foco visivel. */
        self._on(self.wrap, 'keydown', function (e) {
            var grid = self._closestIn(e.target, '[data-ozi-editor-table-grid]');
            if (!grid) return;

            var popover = grid.closest('.ozi-editor-popover');
            if (!popover) return;
            var v = self._tableFieldValues(popover);
            var cols = v.cols, rows = v.rows;

            if (e.key === 'ArrowRight')      cols = Math.min(cols + 1, TABLE_GRID_COLS);
            else if (e.key === 'ArrowLeft')  cols = Math.max(cols - 1, 1);
            else if (e.key === 'ArrowDown')  rows = Math.min(rows + 1, TABLE_GRID_ROWS);
            else if (e.key === 'ArrowUp')    rows = Math.max(rows - 1, 1);
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (self.isDisabled) return;
                self._applyTableFromPopover(popover, cols, rows);
                self._togglePopover(self._popoverIdFromElement(grid), true);
                return;
            } else return;

            e.preventDefault();
            var colInput = popover.querySelector('[data-ozi-editor-table-cols]');
            var rowInput = popover.querySelector('[data-ozi-editor-table-rows]');
            if (colInput) colInput.value = String(cols);
            if (rowInput) rowInput.value = String(rows);
            self._syncTableGrid(popover, cols, rows);
        });

        /* campos numericos — digitar reflete na grade na hora (o retangulo e
           o feedback de "o que vai ser inserido", nao so um enfeite do hover) */
        self._on(self.wrap, 'input', function (e) {
            var input = self._closestIn(e.target,
                '[data-ozi-editor-table-cols], [data-ozi-editor-table-rows]');
            if (!input) return;
            var popover = input.closest('.ozi-editor-popover');
            if (!popover) return;
            var v = self._tableFieldValues(popover);
            self._syncTableGrid(popover, v.cols, v.rows);
        });

        /* botao Inserir */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '[data-ozi-editor-table-apply]');
            if (!btn) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var popover = btn.closest('.ozi-editor-popover');
            var v = self._tableFieldValues(popover);
            self._applyTableFromPopover(popover, v.cols, v.rows);
            self._togglePopover(self._popoverIdFromElement(btn), true);
        });

        /* Enter nos campos numericos insere (mesmo precedente do campo de URL
           do link/imagem) */
        self._on(self.wrap, 'keydown', function (e) {
            var input = self._closestIn(e.target,
                '[data-ozi-editor-table-cols], [data-ozi-editor-table-rows]');
            if (!input || e.key !== 'Enter') return;
            e.preventDefault();
            if (self.isDisabled) return;
            var popover = input.closest('.ozi-editor-popover');
            var v = self._tableFieldValues(popover);
            self._applyTableFromPopover(popover, v.cols, v.rows);
            self._togglePopover(self._popoverIdFromElement(input), true);
        });

        /* painel de edicao — acoes sobre a tabela do caret */
        self._on(self.wrap, 'mousedown', function (e) {
            var btn = self._closestIn(e.target, '[data-ozi-editor-table-action]');
            if (!btn) return;
            e.preventDefault();
            if (self.isDisabled) return;

            /* o popover roubou o foco do contenteditable ao abrir; sem
               restaurar, _getSelectedTableCell() nao acha celula nenhuma —
               mesmo motivo dos handlers de aplicar/remover do link e da
               imagem */
            self._restoreSelection();

            if (self._tableAction(btn.getAttribute('data-ozi-editor-table-action'))) {
                self._syncToTextarea();
                self._updateToolbarState();
                self.emitChange();
            }
            self._togglePopover(self._popoverIdFromElement(btn), true);
        });

        /* popover de cor/realce — clique num swatch aplica. `data-ozi-editor-
           popover-wrap` agora carrega o ID UNICO do popover (nao mais o
           nome bruto do tool, ver secao [11b]) — o nome semantico
           ('color'/'highlight', que _applySwatchColor precisa pra saber
           foreColor vs hiliteColor) e derivado do id via
           _toolFromPopoverId; fechar o popover certo usa o id direto. */
        self._on(self.wrap, 'mousedown', function (e) {
            var sw = self._closestIn(e.target, '[data-ozi-editor-swatch]');
            if (!sw) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var id = self._popoverIdFromElement(sw);
            if (!id) return;
            self._restoreSelection();
            self._applySwatchColor(self._toolFromPopoverId(id), sw.getAttribute('data-ozi-editor-swatch'));
            self._togglePopover(id, true);
        });

        /* popover de cor/realce — "nenhuma" remove a cor. `data-ozi-editor-
           swatch-none` continua guardando o nome SEMANTICO do tool (setado
           direto em _buildColorButton, nao afetado pelo refactor de id) —
           so o fechamento do popover precisa do id, resolvido pelo elemento
           clicado. */
        self._on(self.wrap, 'mousedown', function (e) {
            var none = self._closestIn(e.target, '[data-ozi-editor-swatch-none]');
            if (!none) return;
            e.preventDefault();
            if (self.isDisabled) return;
            var tool = none.getAttribute('data-ozi-editor-swatch-none');
            self._restoreSelection();
            self._applySwatchColor(tool, 'inherit');
            self._togglePopover(self._popoverIdFromElement(none), true);
        });

        /* popover de cor/realce — "customizar" (input nativo type=color),
           aplica no 'change' (usuario fechou o seletor do SO/navegador) */
        self._on(self.wrap, 'change', function (e) {
            var input = self._closestIn(e.target, '[data-ozi-editor-swatch-custom]');
            if (!input) return;
            if (self.isDisabled) return;
            var tool = input.getAttribute('data-ozi-editor-swatch-custom');
            self._restoreSelection();
            self._applySwatchColor(tool, input.value);
            self._togglePopover(self._popoverIdFromElement(input), true);
        });

        /* clique fora — fecha qualquer popover aberto (heading/classes/link/color/highlight) */
        self._on(document, 'mousedown', function (e) {
            self._closeOutsidePopovers(e.target);
        });

        /* selecao no content */
        var onContentSel = function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            self._saveSelection();
            self._updateToolbarState();
        };
        self._on(self.wrap, 'keyup', onContentSel);
        self._on(self.wrap, 'mouseup', onContentSel);

        /* focus (delegado via focusin, que borbulha) */
        self._on(self.wrap, 'focusin', function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            self._saveSelection();
        });

        /* input — content ou source */
        self._on(self.wrap, 'input', function (e) {
            if (self._closestIn(e.target, '.ozi-editor-content')) {
                self._saveSelection();
                self._syncToTextarea();
                self.emitChange();
            } else if (self._closestIn(e.target, '.ozi-editor-source')) {
                self._syncToTextarea();
                self.emitChange();
            }
        });

        /* [v4.9.0] Tab / Shift+Tab — indenta SO dentro de item de lista.
           Fora de lista o evento passa direto e o Tab segue levando o foco
           pro proximo campo: capturar sempre prenderia quem navega por
           teclado dentro do editor, sem saida (decisao do usuario). Por isso
           o preventDefault fica DEPOIS do guard de lista, nao antes. */
        self._on(self.wrap, 'keydown', function (e) {
            if (e.key !== 'Tab') return;
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            if (self.isDisabled || self.isSourceMode) return;
            if (!self._inListItem()) return;   /* deixa o foco sair */

            e.preventDefault();
            if (self._applyListIndent(!e.shiftKey)) {
                self._syncToTextarea();
                self._updateToolbarState();
                self.emitChange();
            }
        });

        /* Enter no content — insere paragrafo fora de code/list/table */
        self._on(self.wrap, 'keydown', function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            if (self.isDisabled || self.isSourceMode) return;
            if (e.key === 'Enter' && !e.shiftKey) {
                var inCode  = self._getClosestSelectionNode(['PRE', 'CODE']);
                var inList  = self._getClosestSelectionNode(['UL', 'OL', 'LI']);
                var inTable = self._getClosestSelectionNode(['TD', 'TH']);
                if (!inCode && !inList && !inTable) {
                    e.preventDefault();
                    try { document.execCommand('insertParagraph', false, null); }
                    catch (err) { self._insertHtmlAtCursor('<p><br></p>'); }
                    setTimeout(function () {
                        self._saveSelection();
                        self._syncToTextarea();
                        self._updateToolbarState();
                    }, 0);
                }
            }
        });

        /* paste — sanitiza */
        self._on(self.wrap, 'paste', function (e) {
            if (!self._closestIn(e.target, '.ozi-editor-content')) return;
            e.preventDefault();
            var clip = e.clipboardData || window.clipboardData;
            var html = clip ? clip.getData('text/html') : '';
            var text = clip ? clip.getData('text/plain') : '';
            if (html)      { document.execCommand('insertHTML', false, _sanitizeHtml(html)); }
            else if (text) { document.execCommand('insertText', false, text); }
            self._saveSelection();
            self._syncToTextarea();
            self.emitChange();
        });

        /* submit do form — garante sync final */
        var form = self.textarea.closest('form');
        if (form) self._on(form, 'submit', function () { self._syncToTextarea(); });
    };

    /* ─────────────────────────────────────────────
     * [23] VALIDACAO
     * ───────────────────────────────────────────── */

    OziEditor.prototype.isValid = function () {
        if (!this.isRequired) return true;
        var tmp = document.createElement('div');
        tmp.innerHTML = this.textarea.value || '';
        return (tmp.textContent || '').trim().length > 0;
    };

    OziEditor.prototype._markInvalid = function () {
        _classListOp(this.wrap, _classMap('invalid', 'ozi-invalid'), 'add');
        this.feedback.textContent = this.requiredMessage;
        this.feedback.style.display = 'block';
    };

    OziEditor.prototype._clearInvalid = function () {
        _classListOp(this.wrap, _classMap('invalid', 'ozi-invalid'), 'remove');
        _classListOp(this.wrap, _classMap('valid',   'ozi-valid'),   'remove');
        this.feedback.style.display = 'none';
    };

    OziEditor.prototype.validate = function (focusOnError) {
        var valid = this.isValid();
        if (!valid) {
            this._markInvalid();
            if (focusOnError) this.content.focus();
        } else {
            this._clearInvalid();
            if (this.isRequired) _classListOp(this.wrap, _classMap('valid', 'ozi-valid'), 'add');
        }
        return valid;
    };

    OziEditor.prototype.setState = function (state) {
        this._clearInvalid();
        if (state === 'invalid') this._markInvalid();
        if (state === 'valid')   _classListOp(this.wrap, _classMap('valid', 'ozi-valid'), 'add');
    };

    /* ─────────────────────────────────────────────
     * [24] DISABLED
     * ───────────────────────────────────────────── */

    OziEditor.prototype._setDisabled = function (state) {
        this.isDisabled = !!state;
        this.content.setAttribute('contenteditable', state ? 'false' : 'true');
        Array.prototype.forEach.call(this.toolbar.querySelectorAll('.ozi-editor-btn'), function (b) { b.disabled = !!state; });
        this.wrap.classList.toggle('ozi-editor--disabled', !!state);
    };

    /* ─────────────────────────────────────────────
     * [25] I/O PUBLICO
     * ───────────────────────────────────────────── */

    OziEditor.prototype.getValue = function () {
        this._syncToTextarea();
        return this.textarea.value || '';
    };

    OziEditor.prototype.setValue = function (v) {
        var html      = this._convertIn(v || '');
        var sanitized = _sanitizeHtml(html);
        this.content.innerHTML = sanitized;
        this.textarea.value = v || '';
        if (this.isSourceMode) this.source.value = v || '';
        this.emitChange('api');
    };

    /* opt-in via data-ozi-editor-counter="true" — conta a partir do texto
       renderado (content.textContent), nao do HTML/markdown bruto */
    OziEditor.prototype._updateCounter = function () {
        if (!this.showCounter || !this.counter) return;
        var text  = this.content.textContent || '';
        var chars = text.length;
        var words = _trim(text) ? _trim(text).split(/\s+/).length : 0;
        this.counter.textContent = words + ' ' + _t('editor.words') + ' · ' + chars + ' ' + _t('editor.chars');
    };

    OziEditor.prototype.emitChange = function (source) {
        this._updateCounter();
        _emitEvent(this.textarea, 'ozi:change', {
            component: 'ozi-editor',
            name:      this.key,
            value:     this.textarea.value,
            type:      this.editorType,
            source:    source || 'user'
        });
    };

    /* ─────────────────────────────────────────────
     * [26] API ESTATICA — OZI.components.editor
     * ───────────────────────────────────────────── */

    function _resolve(selectorOrKey) {
        if (!selectorOrKey) return null;

        if (typeof selectorOrKey === 'string' && _instances[selectorOrKey]) return _instances[selectorOrKey];

        var el = (selectorOrKey && selectorOrKey.jquery) ? selectorOrKey[0] : selectorOrKey;
        if (!el || el.nodeType !== 1) return null;

        var key = el.getAttribute('data-ozi-editor-html') || el.getAttribute('data-ozi-editor-md');
        return key ? (_instances[_trim(String(key))] || null) : null;
    }

    var editorAPI = {

        init: function (root, type) {
            var targets;
            if (root) {
                var rootEl = (root && root.jquery) ? root[0] : root;
                if (!rootEl || !rootEl.querySelectorAll) return;
                targets = Array.prototype.slice.call(rootEl.querySelectorAll(SELECTOR));
                if (rootEl.matches && rootEl.matches(SELECTOR) && targets.indexOf(rootEl) === -1) targets.push(rootEl);
            } else {
                targets = Array.prototype.slice.call((document.body || document).querySelectorAll(SELECTOR));
            }

            targets.forEach(function (el) {
                var elType = el.getAttribute('data-ozi-editor-md') !== null ? 'md' : 'html';

                if (_isInited(el, elType)) return;
                if (type && elType !== type) return;
                if (elType === 'md' && !_converters.mdToHtml) return;

                try {
                    var inst = new OziEditor(el);
                    inst.init();
                } catch (e) {
                    console.warn('[OZI:editor] init erro:', e.message);
                }
            });
        },

        get:     function (k) { return _resolve(k); },
        getAll:  function ()  { return Object.keys(_instances).map(function (k) { return _instances[k]; }); },
        destroy: function (k) { var i = _resolve(k); if (i) i.destroy(); },
        reload:  function (k) { var i = _resolve(k); return i ? i.reload() : null; },

        value: function (k, v) {
            var i = _resolve(k);
            if (!i) return undefined;
            if (v === undefined) return i.getValue();
            i.setValue(v);
        },

        disable: function (k) { var i = _resolve(k); if (i) i._setDisabled(true); },
        enable:  function (k) { var i = _resolve(k); if (i) i._setDisabled(false); },

        registerConverters: function (converters) {
            if (typeof converters.mdToHtml === 'function') _converters.mdToHtml = converters.mdToHtml;
            if (typeof converters.htmlToMd === 'function') _converters.htmlToMd = converters.htmlToMd;
            /* garante init(md) APOS o _boot() (sem a fila $(fn) do jQuery) */
            if (_booted) editorAPI.init(null, 'md');
            else _pendingMdInit = true;
        },

        DEFAULT_TOOLS_HTML:   DEFAULT_TOOLS_HTML,
        DEFAULT_TOOLS_MD:     DEFAULT_TOOLS_MD,
        BUILT_IN_THEMES_HTML: BUILT_IN_THEMES_HTML,
        BUILT_IN_THEMES_MD:   BUILT_IN_THEMES_MD,
        BLOCKED_IN_MD:        BLOCKED_IN_MD
    };

    /* ─────────────────────────────────────────────
     * [27] BOOT
     * ───────────────────────────────────────────── */

    function _registerAdapter() {
        var validate = window.OZI && window.OZI.modules && window.OZI.modules.validate;
        if (!validate || typeof validate.registerAdapter !== 'function') return;

        validate.registerAdapter({
            name:         'ozi-editor',
            nativeElement: true,
            match:    function (el) { return !!(el && el.matches && el.matches(SELECTOR)); },
            isValid:  function (el) { var i = _resolve(el); return i ? i.isValid()  : true; },
            getValue: function (el) { var i = _resolve(el); return i ? i.getValue() : ''; },
            setState: function (el, state) { var i = _resolve(el); if (i) i.setState(state); }
        });
    }

    function _boot() {
        editorAPI.init(null, 'html');
        _registerAdapter();

        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.editor = editorAPI;
        }

        if (OZI && OZI.hooks && OZI.hooks.afterRender &&
            typeof OZI.hooks.afterRender.register === 'function') {
            OZI.hooks.afterRender.register('component:editor', function (root) {
                editorAPI.init(root);
            });
        }

        _booted = true;
        if (_pendingMdInit) editorAPI.init(null, 'md');
    }

    /* namespace legado — compatibilidade */
    window.OziEditor = {
        init:    function (root) { editorAPI.init(root); },
        get:     editorAPI.get,
        value:   editorAPI.value,
        destroy: editorAPI.destroy,
        reload:  editorAPI.reload
    };

    /* expõe a API sincronamente — ozi-editor-md.js encontra OZI.components.editor
     * imediatamente, independente de quando OZI.ready dispara. */
    (function () {
        var OZI = window.OZI;
        if (OZI) {
            if (!OZI.components) OZI.components = {};
            OZI.components.editor = editorAPI;
        }
    }());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }

})(window, document);
