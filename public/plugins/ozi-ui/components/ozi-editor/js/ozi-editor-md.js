/**
 * ------------------------------------------
 * ozi-editor-md
 * ------------------------------------------
 * Ver: 2.4.0
 *
 * Changelog:
 *   - v2.4.0: [FEAT] LISTA ANINHADA nos dois sentidos (acompanha
 *       ozi-editor 4.9.0, que ganhou indent/outdent).
 *       `_listToMd` recebe `depth` e emite 2 espacos por nivel; antes ele
 *       ignorava qualquer <ul>/<ol> dentro do <li> — a sublista vinha
 *       concatenada NA MESMA LINHA do item pai, achatando o nivel.
 *       `_parseList` recebe `baseIndent` e reconhece o recuo: linha mais
 *       recuada abre sublista (recursao) DENTRO do ultimo <li>, linha menos
 *       recuada encerra o nivel. Antes o padrao era ancorado em `^[-*]` e
 *       uma linha recuada nao casava: a lista terminava ali e o resto virava
 *       paragrafo solto. Tolera recuo de 2, 3 ou 4 espacos (e TAB) pra
 *       aceitar Markdown escrito a mao, e encerra o nivel quando o TIPO muda
 *       (`-` vira `1.`) em vez de misturar os dois numa lista so.
 * 2026-08-28
 *
 * [2.3.0] Fase 3 da nova leva de ferramentas do ozi-editor: conversor real
 *         pra `image` — `![alt](url)` ↔ `<img src="url" alt="alt">`, mesmo
 *         padrao do conversor de `link` (checado ANTES dele — a regex de
 *         link casaria a parte `[alt](url)` e sobraria um `!` solto na
 *         frente se a ordem fosse invertida). `alt` passa por `_escapeHtml`
 *         (robustez de parsing); `url` cru, valida esquema fica pro
 *         `_sanitizeHtml` do ozi-editor.js.
 * [2.2.0] Fase 2 da nova leva de ferramentas do ozi-editor: conversor real
 *         pra `link` — `[texto](url)` ↔ `<a href="url">texto</a>` (unica
 *         ferramenta da fase com sintaxe MD nativa; `unlink`/`paste`/
 *         `pasteFmt` nao produzem marcacao persistente, `color`/`highlight`
 *         seguem BLOCKED_IN_MD — sem sintaxe nativa, decisao da Fase 1
 *         mantida). O HTML gerado por `_inlineToHtml` ainda passa por
 *         `_sanitizeHtml` no ozi-editor.js (`_convertIn`), que valida o
 *         esquema do `href` — a conversao aqui nao duplica essa checagem.
 * [2.1.0] Fase 1 da nova leva de ferramentas do ozi-editor (~13 ferramentas
 *         planejadas, ver ozi-ui-docs/horizonte/roadmap): conversores pra
 *         `strike` (~~texto~~ ↔ <s>), `quote` (> linha ↔ <blockquote>) e
 *         `hr` (--- ↔ <hr>) — os 3 subconjuntos que ja tem sintaxe MD nativa
 *         entre as ferramentas simples desta fase. `color`/`highlight` (fase
 *         2) ficam de fora de proposito (sem sintaxe MD nativa, BLOCKED_IN_MD
 *         no ozi-editor.js). `link`/`image` (fase 2/3) continuam previstos
 *         mas nao entraram aqui.
 * [2.0.0] [V2-F2] Zero jQuery (contrato de camadas v2 §2). Removido o branch
 *                 de boot `window.jQuery($fn)`; os conversores (mdToHtml/htmlToMd)
 *                 ja eram vanilla puro. Boot: OZI.ready (primario) → readyState/
 *                 DOMContentLoaded (fallback). ozi-editor.js e migrado em separado.
 * [1.0.0] Conversor MD↔HTML para ozi-editor.js
 * [1.0.2] FIX-BOOT  _register() nunca executado imediatamente
 *                 Prioridade: OZI.ready → DOMContentLoaded
 *                 Resolve timing: md.js executava antes do _boot() do editor
 *
 * [1.0.1] Boot simplificado — ozi-loader garante ordem (editor-md deps: ['editor'])
 *         setTimeout(0) removido: com deps corretas o editor já está em OZI quando
 *         este arquivo executa. Fallback DOMContentLoaded mantido para uso manual.
 *
 * Dependência: ozi-editor.js (deve estar carregado antes via deps no ozi-conf)
 *
 * Registra via: OZI.components.editor.registerConverters({ mdToHtml, htmlToMd })
 * Após registro, o editor reinicializa automaticamente instâncias md existentes.
 *
 * ── SUBSET SUPORTADO ──────────────────────────────────────────────────
 *
 * Markdown → HTML  (mdToHtml)
 *   # … ######              → <h1> … <h6>
 *   **texto**               → <strong>
 *   *texto* ou _texto_      → <em>
 *   ~~texto~~               → <s>
 *   <u>texto</u>            → <u>  (passthrough — sem equiv. MD nativo)
 *   - item / * item         → <ul><li>
 *   1. item                 → <ol><li>
 *   > linha                 → <blockquote>
 *   ---  (ou ***, ___)      → <hr>
 *   [texto](url)            → <a href="url">
 *   ![alt](url)             → <img src="url" alt="alt">
 *   ```código```            → <pre><code>
 *   `código`                → <code>
 *   | col | col |           → <table> GFM
 *   linha em branco         → separador de <p>
 *   \n dentro do parágrafo  → <br>
 *
 * HTML → Markdown  (htmlToMd)
 *   <h1>…<h6>   → # … ######
 *   <strong>    → **texto**
 *   <em>        → *texto*
 *   <s>/<strike> → ~~texto~~
 *   <u>         → <u>texto</u>  (mantém como HTML — sem equiv. MD)
 *   <ul><li>    → - item
 *   <ol><li>    → 1. item (numeração sequencial)
 *   <blockquote> → > linha
 *   <hr>        → ---
 *   <a href>    → [texto](url)
 *   <img>       → ![alt](url)
 *   <pre><code> → ```\ncódigo\n```
 *   <code>      → `código`
 *   <table>     → tabela GFM
 *   <p>         → parágrafo (linha em branco separadora)
 *   <br>        → dois espaços + \n
 *   <span>      → texto puro (classe perdida — sem equiv. MD)
 *
 * ── FORA DE ESCOPO ────────────────────────────────────────────────────
 *   Cor/realce seguem BLOCKED_IN_MD de propósito — sem sintaxe nativa.
 */

(function (window) {
    'use strict';

    /* ─────────────────────────────────────────────
     * UTILITÁRIOS
     * ───────────────────────────────────────────── */

    function _trim(s) { return String(s || '').replace(/^\s+|\s+$/g, ''); }

    function _escapeHtml(s) {
        return String(s)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;');
    }

    /* ─────────────────────────────────────────────
     * MD → HTML
     * ───────────────────────────────────────────── */

    function mdToHtml(md) {
        if (!md) return '';

        var lines  = String(md).split('\n');
        var output = [];
        var i      = 0;

        while (i < lines.length) {
            var line = lines[i];

            /* ── bloco de código (fenced) ── */
            if (/^```/.test(line)) {
                var lang = _trim(line.slice(3));
                var code = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i])) {
                    code.push(_escapeHtml(lines[i]));
                    i++;
                }
                output.push(
                    '<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' +
                    code.join('\n') +
                    '</code></pre>'
                );
                i++;
                continue;
            }

            /* ── tabela GFM ── */
            if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s\-:|]+\|/.test(lines[i + 1])) {
                var tableResult = _parseTable(lines, i);
                output.push(tableResult.html);
                i = tableResult.nextIndex;
                continue;
            }

            /* ── linha horizontal (thematic break) — checada antes da lista
               não ordenada pra nao colidir com "- item" (exige 3+ marcadores
               sem texto na linha) ── */
            if (/^ {0,3}([-*_])( *\1){2,}\s*$/.test(line)) {
                output.push('<hr>');
                i++;
                continue;
            }

            /* ── citação (blockquote) — acumula linhas consecutivas com '>' ── */
            if (/^>\s?/.test(line)) {
                var quoteLines = [];
                while (i < lines.length && /^>\s?/.test(lines[i])) {
                    quoteLines.push(lines[i].replace(/^>\s?/, ''));
                    i++;
                }
                output.push('<blockquote>' + quoteLines.map(_inlineToHtml).join('<br>') + '</blockquote>');
                continue;
            }

            /* ── lista não ordenada ── */
            if (/^[-*]\s+/.test(line)) {
                var ulResult = _parseList(lines, i, 'ul');
                output.push(ulResult.html);
                i = ulResult.nextIndex;
                continue;
            }

            /* ── lista ordenada ── */
            if (/^\d+\.\s+/.test(line)) {
                var olResult = _parseList(lines, i, 'ol');
                output.push(olResult.html);
                i = olResult.nextIndex;
                continue;
            }

            /* ── headings ── */
            var headingMatch = line.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                var level = headingMatch[1].length;
                output.push('<h' + level + '>' + _inlineToHtml(headingMatch[2]) + '</h' + level + '>');
                i++;
                continue;
            }

            /* ── linha em branco ── */
            if (_trim(line) === '') { i++; continue; }

            /* ── parágrafo — acumula linhas consecutivas não vazias ──
               (para tambem antes de '>'/hr sem linha em branco no meio,
               senao o paragrafo engoliria a citacao/linha horizontal) */
            var paraLines = [];
            while (
                i < lines.length &&
                _trim(lines[i]) !== '' &&
                !/^(#{1,6}\s|```|[-*]\s|\d+\.\s|\||>)/.test(lines[i]) &&
                !/^ {0,3}([-*_])( *\1){2,}\s*$/.test(lines[i])
                ) {
                paraLines.push(lines[i]);
                i++;
            }
            if (paraLines.length) {
                output.push('<p>' + paraLines.map(_inlineToHtml).join('<br>') + '</p>');
            }
        }

        return output.join('\n');
    }

    /* converte inline markdown dentro de uma linha */
    function _inlineToHtml(text) {
        if (!text) return '';

        /* preserva <u>…</u> antes de processar outros marcadores */
        var uSlots = [];
        text = text.replace(/<u>([\s\S]*?)<\/u>/gi, function (_, content) {
            var idx = uSlots.length;
            uSlots.push('<u>' + content + '</u>');
            return '\x00U' + idx + '\x00';
        });

        /* `código` inline */
        text = text.replace(/`([^`]+)`/g, function (_, c) {
            return '<code>' + _escapeHtml(c) + '</code>';
        });

        /* **negrito** */
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        /* ~~riscado~~ — checado antes de *itálico* (delimitador '~' nao colide) */
        text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');

        /* ![alt](url) — CHECADO ANTES de [texto](url): a regex de link casaria
           a parte [alt](url) e deixaria um "!" solto na frente, produzindo
           !<a href="url">alt</a> em vez de uma imagem. alt passa por
           _escapeHtml (robustez de parsing, evita truncar no 1o "); url cru,
           mesmo padrao ja usado no link — valida esquema fica pro
           _sanitizeHtml do ozi-editor.js (_convertIn), que tambem descarta
           qualquer atributo injetado via quebra de aspas (apaga tudo e
           restaura so o que foi validado). */
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, url) {
            return '<img src="' + url + '" alt="' + _escapeHtml(alt) + '">';
        });

        /* [texto](url) — validacao de esquema fica pro _sanitizeHtml do
           ozi-editor.js (_convertIn ja passa o resultado por la) */
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        /* *itálico* ou _itálico_ */
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/_([^_]+)_/g,   '<em>$1</em>');

        /* restaura <u> */
        text = text.replace(/\x00U(\d+)\x00/g, function (_, idx) {
            return uSlots[parseInt(idx, 10)];
        });

        return text;
    }

    /* [v2.4.0] reconhece SUBLISTA por recuo. Antes o padrão era ancorado em
       `^[-*]` e uma linha recuada (`  - filho`) simplesmente não casava: a
       lista terminava ali e o resto virava parágrafo solto.

       `baseIndent` é o recuo do nível atual. Uma linha mais recuada abre uma
       sublista (recursão) que entra DENTRO do último <li> — a forma válida,
       e a única que o `_listToMd` consegue devolver para Markdown. Uma linha
       menos recuada encerra este nível e devolve o controle a quem chamou.

       O recuo é medido em espaços, e cada nível do `_listToMd` emite 2 — mas
       aqui qualquer recuo maior que o da base abre nível, para tolerar
       Markdown escrito à mão com 3 ou 4 espaços (e TAB, normalizado antes). */
    function _parseList(lines, startIndex, type, baseIndent) {
        baseIndent = baseIndent || 0;

        var items = [];
        var i     = startIndex;

        var reUl  = /^(\s*)[-*]\s+(.*)/;
        var reOl  = /^(\s*)\d+\.\s+(.*)/;

        while (i < lines.length) {
            var raw   = String(lines[i]).replace(/\t/g, '  ');
            var mUl   = raw.match(reUl);
            var mOl   = raw.match(reOl);
            var match = mUl || mOl;
            if (!match) break;

            var indent = match[1].length;

            /* recuo menor que a base: o item pertence a um nível acima —
               encerra este e deixa o chamador seguir */
            if (indent < baseIndent) break;

            if (indent > baseIndent) {
                /* sublista: consome o bloco inteiro recursivamente e pendura
                   no último <li>. Sem item anterior (Markdown malformado
                   começando recuado) cria um <li> vazio para não perder o
                   conteúdo. */
                var sub = _parseList(lines, i, mOl ? 'ol' : 'ul', indent);
                if (!items.length) items.push('<li></li>');
                items[items.length - 1] =
                    items[items.length - 1].replace(/<\/li>$/, '') + sub.html + '</li>';
                i = sub.nextIndex;
                continue;
            }

            /* mudou o TIPO no mesmo nível (- vira 1.) — encerra para o
               chamador abrir a lista certa, em vez de misturar os dois */
            if ((type === 'ul' && !mUl) || (type === 'ol' && !mOl)) break;

            items.push('<li>' + _inlineToHtml(match[2]) + '</li>');
            i++;
        }

        var tag = type === 'ul' ? 'ul' : 'ol';
        return {
            html:      '<' + tag + '>' + items.join('') + '</' + tag + '>',
            nextIndex: i
        };
    }

    function _parseTable(lines, startIndex) {
        var i       = startIndex;
        var headers = _parseTableRow(lines[i]);
        i++; /* cabeçalho */
        i++; /* separador |---|---| */

        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) {
            rows.push(_parseTableRow(lines[i]));
            i++;
        }

        var html = '<table><thead><tr>';
        headers.forEach(function (h) { html += '<th>' + _inlineToHtml(h) + '</th>'; });
        html += '</tr></thead>';

        if (rows.length) {
            html += '<tbody>';
            rows.forEach(function (row) {
                html += '<tr>';
                row.forEach(function (cell) { html += '<td>' + _inlineToHtml(cell) + '</td>'; });
                html += '</tr>';
            });
            html += '</tbody>';
        }

        html += '</table>';
        return { html: html, nextIndex: i };
    }

    function _parseTableRow(line) {
        return line.replace(/^\||\|$/g, '').split('|').map(function (cell) {
            return _trim(cell);
        });
    }

    /* ─────────────────────────────────────────────
     * HTML → MD
     * ───────────────────────────────────────────── */

    function htmlToMd(html) {
        if (!html) return '';
        var tmp = window.document.createElement('div');
        tmp.innerHTML = html;
        return _cleanMd(_nodeToMd(tmp));
    }

    function _nodeToMd(node) {
        if (node.nodeType === 3) return node.nodeValue || '';
        if (node.nodeType !== 1) return '';

        var tag      = String(node.tagName || '').toUpperCase();
        var children = Array.prototype.slice.call(node.childNodes);
        var inner    = children.map(_nodeToMd).join('');

        switch (tag) {

            case 'DIV':
            case 'BODY':
                return inner;

            case 'P':
                return _trim(inner) ? '\n\n' + _trim(inner) + '\n\n' : '';

            case 'BR':
                return '  \n';

            case 'H1': return '\n\n# '      + _trim(inner) + '\n\n';
            case 'H2': return '\n\n## '     + _trim(inner) + '\n\n';
            case 'H3': return '\n\n### '    + _trim(inner) + '\n\n';
            case 'H4': return '\n\n#### '   + _trim(inner) + '\n\n';
            case 'H5': return '\n\n##### '  + _trim(inner) + '\n\n';
            case 'H6': return '\n\n###### ' + _trim(inner) + '\n\n';

            case 'STRONG':
            case 'B':
                return '**' + _trim(inner) + '**';

            case 'EM':
            case 'I':
                return '*' + _trim(inner) + '*';

            /* <u> sem equivalente MD — mantém como HTML literal */
            case 'U':
                return '<u>' + inner + '</u>';

            case 'S':
            case 'STRIKE':
                return '~~' + _trim(inner) + '~~';

            case 'BLOCKQUOTE': {
                var quoteMd = _trim(inner).split('\n').map(function (l) {
                    return '> ' + _trim(l);
                }).join('\n');
                return '\n\n' + quoteMd + '\n\n';
            }

            case 'HR':
                return '\n\n---\n\n';

            case 'A':
                return '[' + _trim(inner) + '](' + (node.getAttribute('href') || '') + ')';

            case 'IMG':
                return '![' + (node.getAttribute('alt') || '') + '](' + (node.getAttribute('src') || '') + ')';

            case 'CODE':
                /* se pai é PRE, o PRE cuida do bloco */
                if (node.parentNode &&
                    String(node.parentNode.tagName || '').toUpperCase() === 'PRE') {
                    return inner;
                }
                return '`' + inner + '`';

            case 'PRE': {
                var codeNode = node.querySelector ? node.querySelector('code') : null;
                var codeText = codeNode
                    ? (codeNode.textContent || codeNode.innerText || '')
                    : inner;
                var lang     = '';
                if (codeNode && codeNode.className) {
                    var langMatch = codeNode.className.match(/language-(\S+)/);
                    if (langMatch) lang = langMatch[1];
                }
                return '\n\n```' + lang + '\n' + codeText + '\n```\n\n';
            }

            case 'UL':
                return '\n\n' + _listToMd(node, 'ul') + '\n\n';

            case 'OL':
                return '\n\n' + _listToMd(node, 'ol') + '\n\n';

            case 'LI': {
                var parentTag = node.parentNode
                    ? String(node.parentNode.tagName || '').toUpperCase()
                    : '';
                /* prefixo tratado pelo _listToMd — aqui só retorna o conteúdo */
                return _trim(inner);
            }

            case 'TABLE':
                return '\n\n' + _tableToMd(node) + '\n\n';

            /* células tratadas por _tableToMd */
            case 'THEAD':
            case 'TBODY':
            case 'TR':
            case 'TD':
            case 'TH':
                return inner;

            /* span — extrai texto, descarta classe */
            case 'SPAN':
                return inner;

            default:
                return inner;
        }
    }

    /* [v2.4.0] `depth` = nível de aninhamento (0 = raiz), usado pro recuo de
       2 espaços por nível — a convenção que o `_parseList` lê de volta.
       Antes desta versão a função ignorava qualquer <ul>/<ol> dentro do
       <li>: o `_nodeToMd(child)` devolvia a sublista já convertida e ela era
       concatenada NA MESMA LINHA do item pai, achatando o nível. Agora a
       sublista é separada do texto do item e emitida como linhas próprias,
       recuadas. */
    function _listToMd(listNode, type, depth) {
        depth = depth || 0;

        var items  = [];
        var count  = 1;
        var recuo  = new Array(depth + 1).join('  ');   /* 2 espaços por nível */

        Array.prototype.slice.call(listNode.childNodes).forEach(function (child) {
            if (child.nodeType !== 1) return;
            if (String(child.tagName || '').toUpperCase() !== 'LI') return;

            /* separa o texto do item das sublistas que ele contém: sem isso
               as duas partes saem grudadas numa linha só */
            var subListas = [];
            var proprio   = '';

            Array.prototype.slice.call(child.childNodes).forEach(function (n) {
                var tag = n.nodeType === 1 ? String(n.tagName || '').toUpperCase() : '';
                if (tag === 'UL' || tag === 'OL') {
                    subListas.push(_listToMd(n, tag === 'OL' ? 'ol' : 'ul', depth + 1));
                } else {
                    proprio += _nodeToMd(n);
                }
            });

            var prefixo = type === 'ol' ? (count++) + '. ' : '- ';
            items.push(recuo + prefixo + _trim(proprio));
            subListas.forEach(function (sub) { if (sub) items.push(sub); });
        });

        return items.join('\n');
    }

    function _tableToMd(tableNode) {
        var headers = [];
        var rows    = [];

        var thead = tableNode.querySelector ? tableNode.querySelector('thead') : null;
        if (thead) {
            headers = Array.prototype.slice.call(thead.querySelectorAll('th, td'))
                .map(function (c) { return _trim(_nodeToMd(c)); });
        }

        var tbody   = tableNode.querySelector ? tableNode.querySelector('tbody') : null;
        var trNodes = tbody
            ? Array.prototype.slice.call(tbody.querySelectorAll('tr'))
            : Array.prototype.slice.call(tableNode.querySelectorAll('tr')).slice(headers.length ? 1 : 0);

        trNodes.forEach(function (tr) {
            rows.push(
                Array.prototype.slice.call(tr.querySelectorAll('td, th'))
                    .map(function (c) { return _trim(_nodeToMd(c)); })
            );
        });

        /* sem cabeçalho → usa primeira linha */
        if (!headers.length && rows.length) headers = rows.shift();
        if (!headers.length) return '';

        var sep = headers.map(function () { return '---'; });
        var md  = '| ' + headers.join(' | ') + ' |\n';
        md     += '| ' + sep.join(' | ')     + ' |\n';
        rows.forEach(function (row) {
            var cells = headers.map(function (_, idx) {
                return row[idx] !== undefined ? row[idx] : '';
            });
            md += '| ' + cells.join(' | ') + ' |\n';
        });

        return _trim(md);
    }

    /* remove linhas em branco excessivas e trailing spaces */
    function _cleanMd(md) {
        return md
            .replace(/\n{3,}/g,  '\n\n')
            .replace(/[ \t]+$/gm, '')
            .replace(/^\n+|\n+$/, '');
    }

    /* ─────────────────────────────────────────────
     * REGISTRO
     * ───────────────────────────────────────────── */

    function _register() {
        var api = window.OZI &&
            window.OZI.components &&
            window.OZI.components.editor;

        if (!api || typeof api.registerConverters !== 'function') {
            console.warn(
                '[OZI:editor-md] OZI.components.editor.registerConverters não encontrado.\n' +
                'Certifique-se de carregar ozi-editor.js antes de ozi-editor-md.js\n' +
                'ou declare deps: ["editor"] no ozi-conf.'
            );
            return;
        }

        api.registerConverters({
            mdToHtml: mdToHtml,
            htmlToMd: htmlToMd
        });
    }

    /* ─────────────────────────────────────────────
     * BOOT
     *
     * Problema: ozi-editor-md.js pode executar com jQuery já
     * disponível mas antes do ozi-editor.js completar o _boot().
     * Executar _register() imediatamente faz o registerConverters
     * chamar init(null,'md') antes do DOM ter os elementos —
     * nenhum editor md é encontrado e o type="md" fica órfão.
     *
     * Solução em ordem de prioridade:
     *
     * 1. OZI.ready() — garante execução após boot completo do OZI-UI
     *    (todos os plugins carregados, DOM inicializado). Caminho normal
     *    no ecossistema; o _boot() do ozi-editor.js já rodou aqui.
     *
     * 2. readyState / DOMContentLoaded — fallback para uso manual/isolado.
     *
     * NUNCA chamar _register() imediatamente sem OZI.ready — o _boot() do
     * editor pode não ter rodado, e registerConverters chamaria init(md)
     * antes de os elementos existirem no DOM.
     * ───────────────────────────────────────────── */

    if (window.OZI && typeof window.OZI.ready === 'function') {
        /* OZI.ready — após boot completo do ecossistema */
        window.OZI.ready(function () { _register(); });
    } else if (window.document.readyState !== 'loading') {
        /* DOM já pronto — uso manual após o load */
        _register();
    } else {
        /* fallback puro — uso manual sem OZI */
        window.document.addEventListener('DOMContentLoaded', _register);
    }

    /* ─────────────────────────────────────────────
     * NAMESPACE PÚBLICO — para uso/debug direto
     *
     * window.OziEditorMd.mdToHtml(md)   → string HTML
     * window.OziEditorMd.htmlToMd(html) → string Markdown
     * ───────────────────────────────────────────── */

    window.OziEditorMd = {
        mdToHtml: mdToHtml,
        htmlToMd: htmlToMd
    };

})(window);