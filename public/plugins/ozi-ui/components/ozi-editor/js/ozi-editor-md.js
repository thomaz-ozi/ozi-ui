/**
 * ------------------------------------------
 * ozi-editor-md
 * ------------------------------------------
 * Ver: 1.0.2
 * 2026-06-01
 *
 * [1.0.0] Conversor MD↔HTML para ozi-editor.js
 * [1.0.2] FIX-BOOT  _register() nunca executado imediatamente
 *                 Prioridade: OZI.ready → jQuery $(fn) → DOMContentLoaded
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
 *   <u>texto</u>            → <u>  (passthrough — sem equiv. MD nativo)
 *   - item / * item         → <ul><li>
 *   1. item                 → <ol><li>
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
 *   <u>         → <u>texto</u>  (mantém como HTML — sem equiv. MD)
 *   <ul><li>    → - item
 *   <ol><li>    → 1. item (numeração sequencial)
 *   <pre><code> → ```\ncódigo\n```
 *   <code>      → `código`
 *   <table>     → tabela GFM
 *   <p>         → parágrafo (linha em branco separadora)
 *   <br>        → dois espaços + \n
 *   <span>      → texto puro (classe perdida — sem equiv. MD)
 *
 * ── EXTENSÃO FUTURA ───────────────────────────────────────────────────
 *   Links, imagens, strikethrough, task lists → v1.1.0
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

            /* ── parágrafo — acumula linhas consecutivas não vazias ── */
            var paraLines = [];
            while (
                i < lines.length &&
                _trim(lines[i]) !== '' &&
                !/^(#{1,6}\s|```|[-*]\s|\d+\.\s|\|)/.test(lines[i])
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

        /* *itálico* ou _itálico_ */
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/_([^_]+)_/g,   '<em>$1</em>');

        /* restaura <u> */
        text = text.replace(/\x00U(\d+)\x00/g, function (_, idx) {
            return uSlots[parseInt(idx, 10)];
        });

        return text;
    }

    function _parseList(lines, startIndex, type) {
        var items   = [];
        var i       = startIndex;
        var pattern = type === 'ul' ? /^[-*]\s+(.*)/ : /^\d+\.\s+(.*)/;

        while (i < lines.length) {
            var match = lines[i].match(pattern);
            if (!match) break;
            items.push('<li>' + _inlineToHtml(match[1]) + '</li>');
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

    function _listToMd(listNode, type) {
        var items  = [];
        var count  = 1;
        Array.prototype.slice.call(listNode.childNodes).forEach(function (child) {
            if (child.nodeType !== 1) return;
            if (String(child.tagName || '').toUpperCase() !== 'LI') return;
            var text = _trim(_nodeToMd(child));
            items.push(type === 'ol' ? (count++) + '. ' + text : '- ' + text);
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
     *    (todos os plugins carregados, DOM inicializado)
     *
     * 2. jQuery $(function(){}) — mesma fila do ozi-editor.js,
     *    loader garante que editor executa antes de editor-md,
     *    portanto OZI.components.editor existe quando _register roda
     *
     * 3. DOMContentLoaded — fallback para uso manual sem jQuery
     *
     * NUNCA chamar _register() imediatamente — mesmo que OZI ou
     * jQuery já existam, o _boot() do editor pode não ter rodado.
     * ───────────────────────────────────────────── */

    if (window.OZI && typeof window.OZI.ready === 'function') {
        /* OZI.ready — após boot completo do ecossistema */
        window.OZI.ready(function () { _register(); });
    } else if (typeof window.jQuery === 'function') {
        /* jQuery — mesma fila do editor, loader garante ordem */
        window.jQuery(function () { _register(); });
    } else {
        /* fallback puro — uso manual sem jQuery */
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