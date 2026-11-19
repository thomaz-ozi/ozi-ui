/**
 * ------------------------------------------
 * ozi-editor-sanitize
 * ------------------------------------------
 * Ver: 1.2.2
 * 2026-11-19
 *
 * Responsabilidade:
 *   - Motor puro de sanitizacao de HTML para o ozi-editor (whitelist de tags,
 *     validacao de esquema de URL, validacao de forma de valor de cor)
 *   - Funcao pura: recebe HTML/valor, retorna HTML/booleano — sem DOM de UI,
 *     sem estado de instancia (so usa `document` para montar uma div
 *     desanexada de trabalho)
 *
 * O que NAO faz:
 *   - Nao conhece toolbar, popover, contentEditable ou qualquer coisa de UI
 *     do ozi-editor.js — responsabilidade dele
 *   - Nao decide QUANDO sanitizar — so oferece a funcao
 *
 * Origem: extraido de components/ozi-editor/js/ozi-editor.js (Fase 3 da nova
 *   leva de ferramentas, ver ozi-ui-docs/horizonte/roadmap/
 *   ozi-editor-subdivisao.md — "extrair quando a peca tiver razao
 *   independente de mudar": `<img src>` e a primeira tag que abre superficie
 *   de ataque nova de verdade no sanitizador, gatilho da extracao). Migracao
 *   literal — zero mudanca de comportamento no que ja existia; `<img>` e a
 *   unica adicao real desta versao.
 *
 * Dependencias: nenhuma (modulo puro, mesmo perfil de ozi-password-rules)
 * Expoe: OZI.modules.editorSanitize, window.OziEditorSanitize (compat)
 *
 * Changelog:
 *   - v1.2.2: [SEGURANCA] 3 falhas de XSS achadas na auditoria de 2026-11-19
 *       (aceite-editor-sanitize-ataques.html, 40+ cargas nos dois perfis):
 *       (1) parse no documento da pagina: <img>/<video>/<audio>/<details>
 *       descartados ainda carregavam e o onerror/ontoggle rodava DURANTE a
 *       sanitizacao — XSS armazenado ao abrir no editor conteudo gravado por
 *       POST direto. Agora o parse e num documento inerte (_inertDoc).
 *       (2) tag desembrulhada subia os filhos SEM limpar: `<font><img src=x
 *       onerror=…></font>` saia com o onerror intacto. Agora _unwrap limpa o
 *       fragmento antes; SVG/MathML (namespace != XHTML) sempre desembrulha.
 *       (3) _isSafeUrl por regex aceitava `java<TAB>script:` e
 *       `\x01javascript:` como relativos; agora o esquema vem de `new URL()`.
 *       Saida para conteudo legitimo: identica (todos os aceites anteriores
 *       passam sem mudanca). Afeta todas as versoes desde a 1.0.0.
 *   - v1.2.1: [FIX] relatorio `removed` acusava perda falsa em Chrome mais
 *       novo: ao expandir `border:none` ele grava os longhands de
 *       border-image com o valor padrao explicito (none/100%/1/0/stretch),
 *       nao `initial`. `_snapshot` ignora valor igual ao padrao do shorthand
 *       (SHORTHAND_DEFAULTS: border-image, background, text-decoration).
 *       So o relatorio muda; o HTML sanitizado e o mesmo. Pego pelo CI da
 *       tag v2.9.0 (Linux); o Chrome local gravava `initial`.
 *   - v1.2.0: [FEAT] ([OZI-16] do SNDESK) perfil `email`, opt-in:
 *       `sanitizeHtml(html, { profile: 'email' })`. Mantem DIV (no padrao
 *       vira P) e uma whitelist de estilo inline validada por FORMA
 *       (`EMAIL_STYLE`: cor, padding/margin/border/radius por longhand,
 *       fonte, line-height, width/height, display block/inline-block/inline,
 *       vertical-align) + atributos de layout de tabela (width, align,
 *       valign, bgcolor, cellpadding, cellspacing, border,
 *       role=presentation, colspan/rowspan). Continua fora: url(), calc(),
 *       var(), expression(), position/z-index fora de <img>, negativos.
 *       Perfil padrao: saida identica a 1.1.0.
 *       [FEAT] `sanitize(html, opts)` devolve `{ html, removed, renamed,
 *       profile }`: `removed` lista o que se perdeu (element/unwrap/attr/
 *       style, com tag e nome), `renamed` as trocas de tag sem perda. Base
 *       do aviso de perda no carregamento do ozi-editor 4.10.0 — a perda
 *       era silenciosa: so aparecia no banco depois da primeira tecla.
 *   - v1.1.0: [FEAT] whitelist de ESTILO INLINE para `<img>` — alinhamento de
 *       imagem (ozi-editor.js 4.7.0) grava float/margin/display/position/
 *       left/top/max-width direto no style da tag, porque o HTML salvo tem
 *       que renderizar na pagina do host SEM o CSS do plugin. Antes desta
 *       versao o passo "apaga todos os atributos e restaura so o validado"
 *       (`_cleanNode`) matava o `style` inteiro da img, entao o alinhamento
 *       se perdia no round-trip (setValue/sair do source mode/init).
 *       Novo `_imgStyleWhitelist(el)` (uma funcao, um loop de reaplicacao —
 *       o bloco de `savedX` do `_cleanNode` ja tinha 10 variaveis) +
 *       validadores por FORMA, mesmo idioma de `_isSafeColorValue`/
 *       `_isSafeDimension`: `position`/`float`/`display`/`max-width` por
 *       conjunto fechado, `left`/`top` por `_isSafeOffset` (`\d{1,4}` com ate
 *       2 decimais + px|%, `%` <= 100), margens longhand por
 *       `_isSafeMarginValue` (`auto` ou px — `auto` e obrigatorio pro modo
 *       centralizado). Restricoes deliberadas: **`position:fixed`/`sticky`
 *       proibidos** (so static/relative/absolute), **sem negativos** (o
 *       editor faz clamp e nunca emite negativo — logo negativo so pode vir
 *       de fora), **sem `calc()`/`var()`/`vw`/`vh`/`em`** (unidade de
 *       viewport escapa de qualquer container; unidade tipografica depende
 *       do host e quebra o WYSIWYG), **sem `z-index`** (empilhamento por
 *       ordem de DOM; evita `z-index:2147483647` por cima da UI do host).
 *       Regra cruzada: `left`/`top` so sobrevivem junto de um `position`
 *       valido e nao-`static` — offset orfao seria reativado por um
 *       `position` vindo de classe do host, fora do nosso controle.
 *       **Restrito a `tag === 'IMG'`** de proposito (mesmo condicionamento
 *       por tag que `src`/`alt`/`width`/`height` ja usam): `<img>`
 *       posicionada e um retangulo estatico, enquanto `<span>`/`<p>`
 *       posicionado carregaria texto vivo e `<a href>` — overlay de phishing
 *       clicavel. Leitura/escrita via `setProperty`/`getPropertyValue`
 *       (o nome IDL historico de `float` e `cssFloat`).
 *   - v1.0.0: extracao de ozi-editor.js 4.3.0 (ALLOWED_TAGS, TAG_REPLACE,
 *       SAFE_URL_SCHEMES, _isSafeUrl, _isSafeColorValue, _sanitizeHtml,
 *       _cleanNode — corpo identico). `SWATCH_PALETTE` NAO migrou (e dado de
 *       UI da grade de cores do editor, sem acoplamento com a validacao).
 *       Adicao: `IMG` em ALLOWED_TAGS + branch de remocao total (elemento
 *       vazio, sem filhos pra promover em unwrap) quando `src` esta ausente
 *       ou reprovado por `_isSafeUrl` — mesma checagem dupla (`!trim(src) ||
 *       !isSafeUrl(src)`) ja usada pro `<a>` inseguro, necessaria porque
 *       `_isSafeUrl('')` retorna `true` (URL vazia nao tem esquema perigoso,
 *       mas tambem nao e um `src` valido). `alt` preservado como texto
 *       simples, sem validacao de conteudo (atributo sem risco de execucao).
 *       `data:` continua fora de SAFE_URL_SCHEMES — bloqueio de base64
 *       inline e consequencia automatica do reuso de `_isSafeUrl`, sem regra
 *       nova (fora de escopo da Fase 3, por decisao de produto).
 *       [ajuste pos-revisao do usuario] `width`/`height` do `<img>` — nova
 *       `_isSafeDimension()` valida forma (inteiro 1-5 digitos, unitless/px
 *       implicito, sem `%`/CSS livre por decisao de produto), preservados no
 *       mesmo bloco salvar/restaurar de `src`/`alt`.
 */

(function (window, document) {
    'use strict';

    // ---------------------------------------------
    // [1] GUARD — singleton
    // ---------------------------------------------

    if (window.OziEditorSanitize) return;


    // ---------------------------------------------
    // [2] WHITELIST DE TAGS
    // ---------------------------------------------

    var ALLOWED_TAGS = {
        'P': true, 'BR': true, 'STRONG': true, 'EM': true, 'U': true, 'S': true,
        'UL': true, 'OL': true, 'LI': true, 'A': true, 'IMG': true,
        'PRE': true, 'CODE': true, 'SPAN': true, 'BLOCKQUOTE': true, 'HR': true,
        'TABLE': true, 'TBODY': true, 'THEAD': true, 'TR': true, 'TD': true, 'TH': true,
        'H1': true, 'H2': true, 'H3': true, 'H4': true, 'H5': true, 'H6': true
    };

    /* STRIKE (execCommand legado) normalizado pro semantico moderno S, mesmo
       tratamento que DIV/B/I ja recebem */
    var TAG_REPLACE = { 'DIV': 'P', 'B': 'STRONG', 'I': 'EM', 'STRIKE': 'S' };


    // ---------------------------------------------
    // [3] SEGURANCA — URL de link/imagem e valor de cor
    // (usado tanto pelos popovers do ozi-editor.js quanto pelo sanitizador
    // aqui dentro — defesa em profundidade, o sanitizador nao confia na UI)
    // ---------------------------------------------

    var SAFE_URL_SCHEMES = { 'http:': true, 'https:': true, 'mailto:': true, 'tel:': true };

    function _trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }

    /* bloqueia esquemas perigosos (javascript:, data:, vbscript:...); URL sem
       esquema explicito (relativo, "#anchor", "www.foo.com") e permitida.
       ATENCAO: URL vazia retorna true (nao tem esquema perigoso) — quem
       tambem exige um src/href nao-vazio precisa checar isso separado, ver
       o branch de IMG em _cleanNode. */
    /* [1.2.2, SEGURANCA] o esquema vem do PARSER DE URL do navegador, nao de
       regex. O navegador descarta TAB/quebra de linha em qualquer ponto e
       caracteres de controle nas pontas: `java<TAB>script:x` e `\x01javascript:x`
       passavam na regex como "relativo" e executavam no clique (auditoria de
       2026-11-19, cargas U1-U4/U9). Relativo resolve contra uma base https fixa,
       entao continua aceito; URL que o parser recusa e recusada aqui tambem. */
    var _URL_BASE = 'https://ozi-ui.invalid/';

    function _isSafeUrl(url) {
        var raw = String(url == null ? '' : url);
        /* mesma limpeza que o parser faz, para o teste de "vazio" bater com ele */
        var clean = raw.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
        if (!clean) return true;
        var proto;
        try {
            proto = new URL(clean, _URL_BASE).protocol;
        } catch (e) {
            /* sem URL nativo (muito antigo) cai na regex sobre o texto ja limpo */
            var m = /^([a-zA-Z][a-zA-Z0-9+.\-]*:)/.exec(clean);
            if (typeof URL === 'function') return false;
            proto = m ? m[1] : 'https:';
        }
        return !!SAFE_URL_SCHEMES[String(proto).toLowerCase()];
    }

    /* valida a FORMA do valor de cor (hex #rgb/#rrggbb ou rgb(r,g,b) com
       0-255), nao uma lista fechada — a grade fixa e o seletor "customizar"
       (input type=color, sempre #rrggbb) usam o mesmo caminho. execCommand
       com styleWithCSS serializa como rgb(), entao o sanitizador precisa
       reconhecer as duas formas. Bloqueia por construcao qualquer coisa fora
       desse formato (url(), expression(), palavras-chave com
       parenteses/ponto-e-virgula) — nao e whitelist de membros, e validacao
       de sintaxe. */
    function _isSafeColorValue(value) {
        if (!value) return false;
        var v = String(value).trim();
        if (/^#[0-9a-f]{3}$/i.test(v)) return true;
        if (/^#[0-9a-f]{6}$/i.test(v)) return true;
        var m = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(v);
        if (!m) return false;
        return [m[1], m[2], m[3]].every(function (n) { return Number(n) <= 255; });
    }

    /* valida width/height do <img> — inteiro positivo em px, 1 a 5 digitos
       (ate 99999), mesmo espirito de "validar por formato" do color: nao e
       whitelist de valores, e forma. Atributo HTML width/height e sempre
       unitless (px implicito), nao aceita "%"/"em"/CSS livre por decisao de
       produto (Fase 3, ajuste pos-revisao). */
    function _isSafeDimension(value) {
        return /^\d{1,5}$/.test(String(value == null ? '' : value));
    }


    // ---------------------------------------------
    // [3b] ESTILO INLINE DE <img> — alinhamento
    // (v1.1.0 — ver changelog no cabecalho pro porque de cada restricao)
    // ---------------------------------------------

    /* conjuntos fechados: sao poucos valores conhecidos, entao nao ha razao
       pra regex. `fixed`/`sticky` ficam de fora de proposito — os dois
       escapam do container e conseguem cobrir a UI do host. */
    var IMG_POSITION = { 'static': true, 'relative': true, 'absolute': true };
    var IMG_FLOAT    = { 'left': true, 'right': true, 'none': true };
    var IMG_DISPLAY  = { 'block': true, 'inline': true, 'inline-block': true };
    var IMG_MAX_W    = { '100%': true, 'none': true };

    var IMG_MARGIN_SIDES = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'];

    /* offset de posicionamento (left/top): inteiro de ate 4 digitos com ate 2
       decimais + px ou %. SEM sinal negativo — o editor faz clamp e nunca
       emite negativo, entao negativo so pode ter vindo de fora. Por
       construcao isso ja exclui calc(), var(), vw/vh (viewport escapa do
       container) e em/rem (dependem da tipografia do host). */
    function _isSafeOffset(value) {
        var v = _trim(value).toLowerCase();
        if (!/^\d{1,4}(\.\d{1,2})?(px|%)$/.test(v)) return false;
        if (v.charAt(v.length - 1) === '%') return parseFloat(v) <= 100;
        return true;
    }

    /* margem: `auto` (obrigatorio pro modo centralizado) ou comprimento em px */
    function _isSafeMarginValue(value) {
        return /^(auto|\d{1,4}(\.\d{1,2})?px)$/.test(_trim(value).toLowerCase());
    }

    /* le o style inline de uma <img> e devolve so o que passou na validacao,
       como um mapa {propriedade: valor} pronto pra reaplicacao. Devolver mapa
       (em vez de N variaveis savedX) e o que mantem o _cleanNode legivel — o
       bloco de restauracao la ja carregava 10 variaveis. */
    function _imgStyleWhitelist(el) {
        var st  = el && el.style;
        var out = {};
        if (!st) return out;

        var position = _trim(st.getPropertyValue('position')).toLowerCase();
        var float_   = _trim(st.getPropertyValue('float')).toLowerCase();
        var display  = _trim(st.getPropertyValue('display')).toLowerCase();
        var maxWidth = _trim(st.getPropertyValue('max-width')).toLowerCase();

        if (IMG_POSITION[position]) out['position']  = position;
        if (IMG_FLOAT[float_])      out['float']     = float_;
        if (IMG_DISPLAY[display])   out['display']   = display;
        if (IMG_MAX_W[maxWidth])    out['max-width'] = maxWidth;

        /* regra cruzada: offset so vale acompanhado de um position proprio e
           nao-static. Um left/top orfao seria reativado por um `position`
           herdado de classe do host — deslocamento fora do nosso controle. */
        if (out['position'] && out['position'] !== 'static') {
            ['left', 'top'].forEach(function (prop) {
                var v = _trim(st.getPropertyValue(prop)).toLowerCase();
                if (_isSafeOffset(v)) out[prop] = v;
            });
        }

        /* longhands, nao o shorthand `margin` — o browser ja expandiu o
           shorthand no momento em que o style foi parseado */
        IMG_MARGIN_SIDES.forEach(function (prop) {
            var v = _trim(st.getPropertyValue(prop)).toLowerCase();
            if (_isSafeMarginValue(v)) out[prop] = v;
        });

        return out;
    }


    // ---------------------------------------------
    // [3c] PERFIL "email" (v1.2.0, [OZI-16])
    // E-mail precisa de estilo INLINE (cliente de e-mail ignora <style> e
    // classe). O perfil mantem DIV e uma whitelist de propriedades CSS, cada
    // uma validada por FORMA (mesmo idioma de _isSafeColorValue): nada de
    // url(), expression(), var(), calc(), position, z-index — por construcao,
    // ja que so passa o que casa com o formato de cada propriedade.
    // ---------------------------------------------

    var PROFILES = { 'default': true, 'email': true };

    function _isSafeLength(value) {
        var v = _trim(value).toLowerCase();
        return v === '0' || /^\d{1,4}(\.\d{1,2})?(px|pt|em|rem|%)$/.test(v);
    }
    function _lenOrAuto(v) { return v === 'auto' || _isSafeLength(v); }
    /* `currentcolor`/`medium` sao o que o browser grava ao expandir
       `border:none` — aceitar evita relatar perda que o autor nao escreveu */
    function _colorOrTransparent(v) { return v === 'transparent' || v === 'currentcolor' || _isSafeColorValue(v); }
    function _borderWidth(v) { return v === 'thin' || v === 'medium' || v === 'thick' || _isSafeLength(v); }
    function _oneOf(list) {
        var set = {};
        list.split(' ').forEach(function (k) { set[k] = true; });
        return function (v) { return set[v] === true; };
    }
    function _isSafeFontFamily(v) { return /^[a-z0-9 ,"'\-]{1,200}$/i.test(v); }
    function _isSafeLineHeight(v) { return v === 'normal' || /^\d{1,2}(\.\d{1,3})?$/.test(v) || _isSafeLength(v); }

    var BORDER_STYLE = _oneOf('none hidden solid dashed dotted double');

    /* propriedade -> validador. Sempre LONGHAND: o browser ja expandiu o
       shorthand (`padding:10px 18px`, `border:1px solid #ccc`) ao parsear, e
       recombina na serializacao. `text-decoration` e lido pelo longhand
       `-line` e regravado como shorthand (EMAIL_WRITE_AS). */
    var EMAIL_STYLE = {
        'color':            _colorOrTransparent,
        'background-color': _colorOrTransparent,
        'font-size':        _isSafeLength,
        'font-weight':      _oneOf('normal bold bolder lighter 100 200 300 400 500 600 700 800 900'),
        'font-style':       _oneOf('normal italic'),
        'font-family':      _isSafeFontFamily,
        'line-height':      _isSafeLineHeight,
        'text-align':       _oneOf('left center right justify'),
        'text-decoration-line': _oneOf('none underline overline line-through'),
        'text-transform':   _oneOf('none uppercase lowercase capitalize'),
        'vertical-align':   _oneOf('top middle bottom baseline'),
        'display':          _oneOf('block inline-block inline'),
        'width':            _lenOrAuto,
        'min-width':        _isSafeLength,
        'max-width':        function (v) { return v === 'none' || _isSafeLength(v); },
        'height':           _lenOrAuto,
        'border-collapse':  _oneOf('collapse separate')
    };
    ['top', 'right', 'bottom', 'left'].forEach(function (s) {
        EMAIL_STYLE['padding-' + s]        = _isSafeLength;
        EMAIL_STYLE['margin-' + s]         = _lenOrAuto;
        EMAIL_STYLE['border-' + s + '-width'] = _borderWidth;
        EMAIL_STYLE['border-' + s + '-style'] = BORDER_STYLE;
        EMAIL_STYLE['border-' + s + '-color'] = _colorOrTransparent;
    });
    ['top-left', 'top-right', 'bottom-right', 'bottom-left'].forEach(function (c) {
        EMAIL_STYLE['border-' + c + '-radius'] = _isSafeLength;
    });

    var EMAIL_WRITE_AS = { 'text-decoration-line': 'text-decoration' };

    /* atributos de layout de tabela (e-mail ainda usa muito). Valor validado
       por forma; bgcolor pelo mesmo validador de cor. */
    var EMAIL_TABLE_TAGS = { 'TABLE': true, 'THEAD': true, 'TBODY': true, 'TR': true, 'TD': true, 'TH': true };
    var EMAIL_TABLE_ATTRS = {
        'width':       function (v) { return /^\d{1,4}%?$/.test(v); },
        'height':      function (v) { return /^\d{1,4}%?$/.test(v); },
        'align':       _oneOf('left center right'),
        'valign':      _oneOf('top middle bottom baseline'),
        'bgcolor':     _isSafeColorValue,
        'cellpadding': function (v) { return /^\d{1,2}$/.test(v); },
        'cellspacing': function (v) { return /^\d{1,2}$/.test(v); },
        'border':      function (v) { return /^\d{1,2}$/.test(v); },
        'role':        _oneOf('presentation'),
        'colspan':     function (v) { return /^\d{1,3}$/.test(v); },
        'rowspan':     function (v) { return /^\d{1,3}$/.test(v); }
    };

    function _emailStyleWhitelist(el) {
        var st  = el && el.style;
        var out = {};
        if (!st) return out;
        Object.keys(EMAIL_STYLE).forEach(function (prop) {
            var v = _trim(st.getPropertyValue(prop)).toLowerCase();
            /* font-family preserva caixa (nome de fonte) */
            if (prop === 'font-family') v = _trim(st.getPropertyValue(prop));
            if (v && EMAIL_STYLE[prop](v)) out[EMAIL_WRITE_AS[prop] || prop] = v;
        });
        return out;
    }

    function _emailTableAttrs(el) {
        var out = {};
        Object.keys(EMAIL_TABLE_ATTRS).forEach(function (name) {
            var v = el.getAttribute(name);
            if (v === null) return;
            v = _trim(v);
            if (EMAIL_TABLE_ATTRS[name](name === 'bgcolor' ? v : v.toLowerCase())) out[name] = v;
        });
        return out;
    }


    // ---------------------------------------------
    // [4] SANITIZADOR
    // ---------------------------------------------

    /* ctx = { profile, removed[], renamed[] } — `removed` e o relatorio do
       que se PERDEU (elemento, atributo, propriedade de estilo); `renamed`
       so troca de tag sem perda (B->STRONG, DIV->P). Quem decide o que fazer
       com o relatorio e o chamador (ozi-editor 4.10.0: evento
       ozi:editor-sanitized). */
    function _makeCtx(opts) {
        var p = opts && opts.profile;
        return { profile: PROFILES[p] ? p : 'default', removed: [], renamed: [] };
    }

    /* [1.2.2, SEGURANCA] documento INERTE para o parse. Antes era
       `document.createElement('div').innerHTML = html` no documento da pagina:
       la, um <img>/<video>/<audio> comeca a carregar mesmo fora da tela, e o
       que era descartado (src inseguro, tag desembrulhada) saia com o
       `onerror` ainda nele — o handler rodava. Era XSS armazenado: conteudo
       gravado no banco por POST direto executava em quem abria o registro no
       editor (auditoria de 2026-11-19, cargas A1-A8). Um documento criado por
       createHTMLDocument nao tem contexto de navegacao: nao carrega recurso
       nem roda handler. Mesmo principio do DOMPurify. */
    function _inertDoc() {
        return (document.implementation && typeof document.implementation.createHTMLDocument === 'function')
            ? document.implementation.createHTMLDocument('')
            : document;
    }

    function _sanitize(html, opts) {
        var ctx = _makeCtx(opts);
        if (!html) return { html: '', removed: [], renamed: [], profile: ctx.profile };
        var tmp = _inertDoc().createElement('div');
        tmp.innerHTML = html;
        _cleanNode(tmp, ctx);
        return { html: tmp.innerHTML, removed: ctx.removed, renamed: ctx.renamed, profile: ctx.profile };
    }

    /* [1.2.2, SEGURANCA] desembrulhar = trocar o elemento pelos filhos, e os
       filhos sao LIMPOS antes de subir. Antes subiam sem passar pela limpeza (o
       laco do pai ja tinha a lista de filhos dele): `<font><img onerror></font>`,
       `<svg><image onerror></svg>` e `<a href="javascript:"><img onerror></a>`
       entregavam o onerror intacto (cargas A8, A12, T3). */
    function _unwrap(node, child, ctx) {
        var frag = child.ownerDocument.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        _cleanNode(frag, ctx);
        node.replaceChild(frag, child);
    }

    var XHTML_NS = 'http://www.w3.org/1999/xhtml';

    function _sanitizeHtml(html, opts) {
        return _sanitize(html, opts).html;
    }

    function _note(ctx, type, tag, name) {
        ctx.removed.push(name ? { type: type, tag: tag, name: name } : { type: type, tag: tag });
    }

    /* foto do estado antes da limpeza: atributos (menos style) e cada
       propriedade de estilo (longhand). `initial` e preenchimento de
       shorthand (`background:#fff` gera background-image:initial etc.), nao
       algo que o autor escreveu — fica de fora pra nao virar falsa perda. */
    /* [1.2.1] valor padrao que o browser grava ao expandir um shorthand.
       O Chrome local grava `initial`; o do CI (mais novo) grava o valor
       explicito — `border:none` virou border-image-source:none,
       -slice:100%, -width:1, -outset:0, -repeat:stretch, e o relatorio
       acusava perda que o autor nao escreveu. Igual ao padrao = sem efeito
       visual = nao e perda. Cobre os shorthands que um corpo de e-mail usa
       (border, background, text-decoration). */
    var SHORTHAND_DEFAULTS = {
        'border-image-source': 'none', 'border-image-slice': '100%', 'border-image-width': '1',
        'border-image-outset': '0', 'border-image-repeat': 'stretch',
        'background-image': 'none', 'background-position-x': '0%', 'background-position-y': '0%',
        'background-size': 'auto', 'background-repeat': 'repeat', 'background-attachment': 'scroll',
        'background-origin': 'padding-box', 'background-clip': 'border-box',
        'text-decoration-style': 'solid', 'text-decoration-color': 'currentcolor',
        'text-decoration-thickness': 'auto'
    };

    function _snapshot(el) {
        var attrs = {}, styles = {};
        Array.prototype.slice.call(el.attributes).forEach(function (a) {
            if (a.name !== 'style') attrs[a.name] = a.value;
        });
        var st = el.style;
        if (st) {
            for (var i = 0; i < st.length; i++) {
                var prop = st[i];
                var val  = st.getPropertyValue(prop);
                if (!val || val === 'initial') continue;
                if (SHORTHAND_DEFAULTS[prop] === _trim(val).toLowerCase()) continue;
                styles[prop] = val;
            }
        }
        return { attrs: attrs, styles: styles };
    }

    function _diffSnapshot(ctx, tag, before, el) {
        Object.keys(before.attrs).forEach(function (name) {
            if (el.getAttribute(name) !== before.attrs[name]) _note(ctx, 'attr', tag, name);
        });
        Object.keys(before.styles).forEach(function (prop) {
            if (!el.style || el.style.getPropertyValue(prop) !== before.styles[prop]) _note(ctx, 'style', tag, prop);
        });
    }

    function _cleanNode(node, ctx) {
        ctx = ctx || _makeCtx();
        var isEmail  = ctx.profile === 'email';
        var children = Array.prototype.slice.call(node.childNodes);

        children.forEach(function (child) {
            if (child.nodeType === 3) return;
            if (child.nodeType !== 1) { node.removeChild(child); return; }

            var tag = child.tagName.toUpperCase();

            if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON'].indexOf(tag) > -1) {
                _note(ctx, 'element', tag);
                node.removeChild(child); return;
            }

            /* [1.2.2] elemento SVG/MathML nunca e mantido, mesmo com nome de tag
               permitida (`<svg><a>` tem tagName "a"): troca de namespace e a
               origem classica de mXSS. Desembrulha (com limpeza dos filhos). */
            if (child.namespaceURI && child.namespaceURI !== XHTML_NS) {
                _note(ctx, 'unwrap', tag);
                _unwrap(node, child, ctx); return;
            }

            /* perfil email: DIV fica DIV (cai no caminho normal abaixo) */
            var replaceTo = (isEmail && tag === 'DIV') ? null : TAG_REPLACE[tag];
            if (replaceTo) {
                var beforeRep = _snapshot(child);
                var rep = child.ownerDocument.createElement(replaceTo);
                while (child.firstChild) rep.appendChild(child.firstChild);
                var align = child.style && child.style.textAlign;
                if (align && ['left','center','right','justify'].indexOf(align) > -1) rep.style.textAlign = align;
                node.replaceChild(rep, child);
                ctx.renamed.push({ from: tag, to: replaceTo });
                _diffSnapshot(ctx, tag, beforeRep, rep);
                _cleanNode(rep, ctx); return;
            }

            if (!ALLOWED_TAGS[tag] && !(isEmail && tag === 'DIV')) {
                _note(ctx, 'unwrap', tag);
                _unwrap(node, child, ctx); return;
            }

            /* <a> com href fora da whitelist de esquemas (ou vazio) vira
               texto simples — mesmo caminho de tag nao permitida acima */
            if (tag === 'A') {
                var hrefCandidate = child.getAttribute('href') || '';
                if (!_trim(hrefCandidate) || !_isSafeUrl(hrefCandidate)) {
                    _note(ctx, 'unwrap', tag, 'href');
                    _unwrap(node, child, ctx);
                    return;
                }
            }

            /* <img> e elemento vazio — sem filhos pra promover, "unwrap" nao
               se aplica. src ausente ou reprovado por _isSafeUrl = remove o
               no inteiro (nao vira texto simples, nao sobra nada). Checagem
               de "ausente" e separada de _isSafeUrl porque URL vazia retorna
               true de _isSafeUrl (ausencia de esquema perigoso != src valido). */
            if (tag === 'IMG') {
                var srcCandidate = child.getAttribute('src') || '';
                if (!_trim(srcCandidate) || !_isSafeUrl(srcCandidate)) {
                    _note(ctx, 'element', tag, 'src');
                    node.removeChild(child);
                    return;
                }
            }

            var before      = _snapshot(child);
            var savedEmail  = isEmail ? _emailStyleWhitelist(child) : null;
            var savedTblAt  = (isEmail && EMAIL_TABLE_TAGS[tag]) ? _emailTableAttrs(child) : null;
            var savedAlign  = child.style && child.style.textAlign;
            var savedClass  = child.getAttribute('class') || '';
            var savedHref   = (tag === 'A')   ? child.getAttribute('href') : null;
            var savedSrc    = (tag === 'IMG') ? child.getAttribute('src')  : null;
            var savedAlt    = (tag === 'IMG') ? child.getAttribute('alt')  : null;
            var rawWidth    = (tag === 'IMG') ? child.getAttribute('width')  : null;
            var rawHeight   = (tag === 'IMG') ? child.getAttribute('height') : null;
            var savedWidth  = _isSafeDimension(rawWidth)  ? rawWidth  : null;
            var savedHeight = _isSafeDimension(rawHeight) ? rawHeight : null;
            var rawColor    = child.style && child.style.color;
            var rawBg       = child.style && child.style.backgroundColor;
            var savedColor  = _isSafeColorValue(rawColor) ? rawColor : null;
            var savedBg     = _isSafeColorValue(rawBg)    ? rawBg    : null;
            /* estilo de alinhamento — so <img>, ver [3b] */
            var savedImgSt  = (tag === 'IMG') ? _imgStyleWhitelist(child) : null;

            Array.prototype.slice.call(child.attributes).forEach(function (attr) {
                child.removeAttribute(attr.name);
            });

            if (savedAlign && ['left','center','right','justify'].indexOf(savedAlign) > -1) {
                child.style.textAlign = savedAlign;
            }
            if (savedClass)        child.setAttribute('class', savedClass);
            if (savedHref)         child.setAttribute('href', savedHref);
            if (savedSrc)          child.setAttribute('src', savedSrc);
            if (savedAlt !== null) child.setAttribute('alt', savedAlt);
            if (savedWidth)        child.setAttribute('width', savedWidth);
            if (savedHeight)       child.setAttribute('height', savedHeight);
            if (savedColor)        child.style.color = savedColor;
            if (savedBg)           child.style.backgroundColor = savedBg;

            if (savedImgSt) {
                Object.keys(savedImgSt).forEach(function (prop) {
                    child.style.setProperty(prop, savedImgSt[prop]);
                });
            }
            if (savedEmail) {
                Object.keys(savedEmail).forEach(function (prop) {
                    child.style.setProperty(prop, savedEmail[prop]);
                });
            }
            if (savedTblAt) {
                Object.keys(savedTblAt).forEach(function (name) {
                    child.setAttribute(name, savedTblAt[name]);
                });
            }

            _diffSnapshot(ctx, tag, before, child);
            _cleanNode(child, ctx);
        });
    }


    // ---------------------------------------------
    // [5] API PUBLICA + EXPOSICAO
    // ---------------------------------------------

    var api = {
        sanitizeHtml:       _sanitizeHtml,
        sanitize:           _sanitize,
        PROFILES:           Object.keys(PROFILES),
        isSafeLength:       _isSafeLength,
        isSafeUrl:          _isSafeUrl,
        isSafeColorValue:   _isSafeColorValue,
        isSafeDimension:    _isSafeDimension,
        isSafeOffset:       _isSafeOffset,
        isSafeMarginValue:  _isSafeMarginValue,
        imgStyleWhitelist:  _imgStyleWhitelist,
        ALLOWED_TAGS:       ALLOWED_TAGS
    };

    // compat — alias direto, sempre disponivel de forma sincrona (o
    // ozi-editor.js consome por aqui, nao espera DOMReady/OZI.modules)
    window.OziEditorSanitize = api;

    // namespace OZI — registrado assim que possivel, mesmo padrao de
    // ozi-password-rules (nao critico pro consumo interno do editor, que usa
    // o alias direto acima)
    if (typeof document !== 'undefined') {
        var _ready = function () {
            if (window.OZI && window.OZI.modules) {
                window.OZI.modules.editorSanitize = api;
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _ready);
        } else {
            _ready();
        }
    }

})(window, document);
