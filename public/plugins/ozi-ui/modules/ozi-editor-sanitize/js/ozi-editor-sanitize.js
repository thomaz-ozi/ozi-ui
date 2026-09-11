/**
 * ------------------------------------------
 * ozi-editor-sanitize
 * ------------------------------------------
 * Ver: 1.1.0
 * 2026-09-10
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
    function _isSafeUrl(url) {
        url = _trim(url);
        if (!url) return true;
        var m = /^([a-zA-Z][a-zA-Z0-9+.\-]*:)/.exec(url);
        if (!m) return true;
        return !!SAFE_URL_SCHEMES[m[1].toLowerCase()];
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
    // [4] SANITIZADOR
    // ---------------------------------------------

    function _sanitizeHtml(html) {
        if (!html) return '';
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        _cleanNode(tmp);
        return tmp.innerHTML;
    }

    function _cleanNode(node) {
        var children = Array.prototype.slice.call(node.childNodes);

        children.forEach(function (child) {
            if (child.nodeType === 3) return;
            if (child.nodeType !== 1) { node.removeChild(child); return; }

            var tag = child.tagName.toUpperCase();

            if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON'].indexOf(tag) > -1) {
                node.removeChild(child); return;
            }

            if (TAG_REPLACE[tag]) {
                var rep = document.createElement(TAG_REPLACE[tag]);
                while (child.firstChild) rep.appendChild(child.firstChild);
                var align = child.style && child.style.textAlign;
                if (align && ['left','center','right','justify'].indexOf(align) > -1) rep.style.textAlign = align;
                node.replaceChild(rep, child);
                _cleanNode(rep); return;
            }

            if (!ALLOWED_TAGS[tag]) {
                var frag = document.createDocumentFragment();
                while (child.firstChild) frag.appendChild(child.firstChild);
                node.replaceChild(frag, child); return;
            }

            /* <a> com href fora da whitelist de esquemas (ou vazio) vira
               texto simples — mesmo caminho de tag nao permitida acima */
            if (tag === 'A') {
                var hrefCandidate = child.getAttribute('href') || '';
                if (!_trim(hrefCandidate) || !_isSafeUrl(hrefCandidate)) {
                    var fragA = document.createDocumentFragment();
                    while (child.firstChild) fragA.appendChild(child.firstChild);
                    node.replaceChild(fragA, child);
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
                    node.removeChild(child);
                    return;
                }
            }

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

            _cleanNode(child);
        });
    }


    // ---------------------------------------------
    // [5] API PUBLICA + EXPOSICAO
    // ---------------------------------------------

    var api = {
        sanitizeHtml:       _sanitizeHtml,
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
