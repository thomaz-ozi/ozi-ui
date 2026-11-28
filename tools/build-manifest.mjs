#!/usr/bin/env node
// Manifesto por plugin ({tipo}/ozi-{nome}/ozi-{nome}.manifest.json) — roadmap pronto-para-ia, N3.
//
// O manifesto é a fonte única dos atributos `data-ozi-*` de um plugin (nome, grupo, tipo, valores,
// padrão, descrição em pt-BR/en/es), dos eventos, das chaves i18n e das dependências. Este script:
//
//   1. valida o formato de cada manifesto;
//   2. gera o registro do plugin no core/ozi-attrs.js (aviso OZI-W001), entre os marcadores
//      `// >>> manifest:{ns}` e `// <<< manifest:{ns}`;
//   3. confere a DERIVA com o código, que é o motivo de o manifesto existir:
//      - todo `data-ozi-{ns}-*` / `dataset.ozi{Ns}*` lido ou escrito em qualquer JS do pacote tem
//        de estar no manifesto (attributes ou internal), e todo atributo do manifesto tem de
//        aparecer em algum JS (senão é atributo morto, ensinado na doc e sem efeito);
//      - eventos `emit('ozi:...')` do JS do plugin = `events` do manifesto;
//      - chaves de lang/{pt-BR,en,es}.js do plugin = `lang` do manifesto, e toda chave é lida
//        (literal 'ns.chave') pelo JS do plugin;
//      - `deps` = deps do plugin no _pluginMap do core/ozi-conf.js.
//
// Prefixo próprio (2.11.4, ozi-loaddata): `"prefix": "data-zld"` troca o `data-ozi-{ns}` dos nomes
// (e o `dataset.zld*`); `"langNamespace": "loadData"` troca o bloco de lang/*.js. Plugin com prefixo
// fora de `data-ozi-` não entra no registro do W001 (o aviso só varre `data-ozi-*`): a deriva é
// conferida igual, o registro não é gerado.
//
// Uso:  node tools/build-manifest.mjs [dir plugins/ozi-ui] [--check]   (padrão: public/plugins/ozi-ui)
//   --check  não grava; sai com 1 se o registro gerado estiver desatualizado ou houver deriva (CI).
// Sem dependência npm. Saída determinística.

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const args  = process.argv.slice(2);
const check = args.includes('--check');
const root  = resolve(args.find((a) => !a.startsWith('--')) || 'public/plugins/ozi-ui');
const ATTRS_FILE = join(root, 'core', 'ozi-attrs.js');

const LANGS = ['pt-BR', 'en', 'es'];
// flag = a presença liga (select, autocomplete); bool = exige "true"/"false" (OZI.helpers.parseBool:
// editor, validate). Os dois convivem na 2.x; na 3.0 tudo vira flag (decisão B25 do desenho da v3).
const TYPES = ['flag', 'bool', 'string', 'int', 'enum', 'url', 'list', 'map'];
const KINDS = ['components', 'modules', 'behaviors'];

if (!existsSync(ATTRS_FILE)) {
    console.error(`build-manifest: não achei ${ATTRS_FILE}`);
    process.exit(2);
}

const read = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const rel  = (f) => relative(root, f).split(sep).join('/');

let problems = 0;
const fail = (msg) => { problems++; console.log(`ERRO     ${msg}`); };

// ─── manifestos ──────────────────────────────────────────────────────────────────────────────

const manifests = [];
for (const kind of KINDS) {
    const kindDir = join(root, kind);
    if (!existsSync(kindDir)) continue;
    for (const dir of readdirSync(kindDir).sort()) {
        const file = join(kindDir, dir, `${dir}.manifest.json`);
        if (!existsSync(file)) continue;
        let data;
        try { data = JSON.parse(read(file)); }
        catch (e) { fail(`${rel(file)}: JSON inválido (${e.message})`); continue; }
        manifests.push({ file, dir: join(kindDir, dir), kind, data });
    }
}
// [2.11.9] integrações: integrations/adapters/{nome}.manifest.json ("type": "integration"). O JS
// do plugin vem da lista "js" do manifesto (o adapter não fica numa pasta própria com js/).
const adaptersDir = join(root, 'integrations', 'adapters');
if (existsSync(adaptersDir)) {
    for (const f of readdirSync(adaptersDir).sort()) {
        if (!f.endsWith('.manifest.json')) continue;
        const file = join(adaptersDir, f);
        let data;
        try { data = JSON.parse(read(file)); }
        catch (e) { fail(`${rel(file)}: JSON inválido (${e.message})`); continue; }
        manifests.push({ file, dir: adaptersDir, kind: 'integrations', data });
    }
}

if (!manifests.length) {
    console.log('nenhum manifesto encontrado');
    process.exit(0);
}

// ─── 1. formato ──────────────────────────────────────────────────────────────────────────────

// prefixo dos nomes: `data-ozi-{ns}` por padrão; `"prefix"` no manifesto troca (ozi-loaddata: data-zld)
const prefixOf = (d) => d.prefix || `data-ozi-${d.namespace}`;
// no W001 só entra quem usa o prefixo padrão (o ozi-attrs.js varre `data-ozi-*`)
const inW001 = (d) => prefixOf(d) === `data-ozi-${d.namespace}`;

function validate(m) {
    const d = m.data, where = rel(m.file);
    const ns = d.namespace;
    if (d.manifest !== 1) fail(`${where}: "manifest" deve ser 1`);
    if (!ns || !/^[a-z]+$/.test(ns)) { fail(`${where}: "namespace" ausente ou inválido`); return false; }
    if (d.plugin !== `ozi-${ns}`) fail(`${where}: "plugin" deve ser "ozi-${ns}"`);
    if (m.kind.slice(0, -1) !== d.type) fail(`${where}: "type" deve ser "${m.kind.slice(0, -1)}" (pasta ${m.kind}/)`);
    if (m.kind === 'integrations') {
        if (!Array.isArray(d.js) || !d.js.length) fail(`${where}: integração precisa de "js" (arquivos do plugin, relativos a plugins/ozi-ui)`);
        else for (const j of d.js) if (!existsSync(join(root, j))) fail(`${where}: "js" aponta "${j}", que não existe`);
    }

    const groups = new Set();
    for (const g of d.groups || []) {
        if (!g.id || groups.has(g.id)) fail(`${where}: grupo sem id ou repetido (${g.id})`);
        groups.add(g.id);
        for (const l of LANGS) if (!g.title || !g.title[l]) fail(`${where}: grupo "${g.id}" sem título ${l}`);
    }

    if (d.prefix !== undefined && !/^data-[a-z]+(-[a-z]+)*$/.test(d.prefix)) fail(`${where}: "prefix" inválido (${d.prefix})`);
    if (d.langNamespace !== undefined && !/^[a-zA-Z]+$/.test(d.langNamespace)) fail(`${where}: "langNamespace" inválido`);
    const base = prefixOf(d), seen = new Set();
    for (const a of d.attributes || []) {
        const n = a.name || '';
        // "shared": true = atributo sem o prefixo do plugin que ele documenta (data-ozi-required no
        // validate); fica fora do registro por plugin (o ozi-attrs.js o tem em SHARED_*)
        if (a.shared) {
            if (!/^data-ozi-[a-z]+(-[a-z0-9]+)*$/.test(n) || n.startsWith(base + '-') || n === base) fail(`${where}: "${n}" marcado shared mas tem o prefixo do plugin (ou nome inválido)`);
        } else if (n !== base && !n.startsWith(base + '-')) fail(`${where}: "${n}" fora do namespace ${base}`);
        if (seen.has(n)) fail(`${where}: "${n}" repetido`);
        seen.add(n);
        if (n.includes('{') && !(Array.isArray(a.variants) && a.variants.length)) fail(`${where}: "${n}" é família ({x}) sem "variants"`);
        if (a.variants && !n.includes('{')) fail(`${where}: "${n}": "variants" só em família ({x} no nome)`);
        if (!groups.has(a.group)) fail(`${where}: "${n}" com grupo desconhecido "${a.group}"`);
        if (!TYPES.includes(a.type)) fail(`${where}: "${n}" com tipo "${a.type}" (aceitos: ${TYPES.join(', ')})`);
        if (a.type === 'enum' && !(Array.isArray(a.values) && a.values.length)) fail(`${where}: "${n}" é enum sem "values"`);
        if (a.values && !['enum', 'flag', 'bool'].includes(a.type)) fail(`${where}: "${n}": "values" só em enum/flag`);
        if (a.type === 'enum' && a.default !== undefined && !a.values.includes(a.default)) fail(`${where}: "${n}": default fora de values`);
        if (a.default !== undefined && typeof a.default !== 'string') fail(`${where}: "${n}": default deve ser texto`);
        for (const l of LANGS) if (!a.desc || !String(a.desc[l] || '').trim()) fail(`${where}: "${n}" sem descrição ${l}`);
    }
    for (const n of d.internal || []) {
        if (!n.startsWith(base + '-')) fail(`${where}: interno "${n}" fora do namespace ${base}`);
        if (seen.has(n)) fail(`${where}: "${n}" está em attributes e em internal`);
        seen.add(n);
    }
    return true;
}

// ─── leitura do código (sem comentários) ─────────────────────────────────────────────────────

// Tira comentários /* */ e // respeitando strings ('', "", ``) e regex literal (/[&<>"']/g). Os
// cabeçalhos e changelogs dos plugins citam atributos antigos e novos, e não podem contar como "lido
// pelo código". [2.11.4] Antes a regex literal não era reconhecida: as aspas de `/[&<>"']/g` (ozi-
// loaddata) abriam uma string falsa e o resto do arquivo sumia da conferência.
// `/` abre regex quando o último token significativo não termina uma expressão (identificador,
// número, `)`, `]`, `}`), ou quando é uma palavra como `return`/`typeof`.
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'throw', 'case', 'do', 'else', 'yield', 'await']);
function stripComments(src) {
    let out = '', i = 0, q = null, last = '', word = '';
    const regexAllowed = () => {
        if (!last) return true;
        if (/[\w$]/.test(last)) return REGEX_AFTER_WORD.has(word);
        return !/[)\]}]/.test(last);
    };
    while (i < src.length) {
        const c = src[i], n = src[i + 1];
        if (q) {
            out += c;
            if (c === '\\') { out += n || ''; i += 2; continue; }
            if (c === q) { q = null; last = c; word = ''; }
            i++; continue;
        }
        if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
        if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; out += ' '; continue; }
        if (c === '/' && n === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
        if (c === '/' && regexAllowed()) {
            // regex literal até a `/` de fechamento (fora de [...]), copiada como está
            let j = i + 1, cls = false;
            while (j < src.length && src[j] !== '\n') {
                const r = src[j];
                if (r === '\\') { j += 2; continue; }
                if (r === '[') cls = true;
                else if (r === ']') cls = false;
                else if (r === '/' && !cls) break;
                j++;
            }
            if (src[j] === '/') {
                j++;
                while (/[a-z]/i.test(src[j] || '')) j++;
                out += src.slice(i, j); i = j; last = ')'; word = '';
                continue;
            }
        }
        out += c; i++;
        if (/\s/.test(c)) continue;
        if (/[\w$]/.test(c)) word = /[\w$]/.test(last) ? word + c : c;
        else word = '';
        last = c;
    }
    return out;
}

function walk(dir, acc = []) {
    for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p, acc);
        else if (f.endsWith('.js') && !f.endsWith('.min.js')) acc.push(p);
    }
    return acc;
}

// todo JS do pacote, menos o próprio registro e os dicionários
const codeFiles = walk(root).filter((f) => f !== ATTRS_FILE && !rel(f).includes('/lang/'));
const code = codeFiles.map((f) => ({ f, src: stripComments(read(f)) }));

// todo CSS do pacote, sem comentários (para os atributos `"readBy": "css"`)
function walkCss(dir, acc = []) {
    for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walkCss(p, acc);
        else if (f.endsWith('.css') && !f.endsWith('.min.css')) acc.push(p);
    }
    return acc;
}
const cssFiles = walkCss(root).map((f) => ({ f, src: read(f).replace(/\/\*[\s\S]*?\*\//g, ' ') }));

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

// Família de nomes: `"name": "data-ozi-editor-tools-{bp}", "variants": ["sm", "md", ...]`. Vira um nome
// por variante no registro, e o código pode montá-los por concatenação ('data-ozi-editor-tools-' + bp):
// a concatenação só é aceita para o prefixo de uma família declarada.
const familyPrefix = (a) => a.name.slice(0, a.name.indexOf('{'));
function expandNames(a) {
    if (!a.name.includes('{')) return [a.name];
    return (a.variants || []).map((v) => a.name.replace(/\{\w+\}/, v));
}

function attrsInCode(base, families = []) {
    const found = new Map();                     // nome -> [arquivos]
    const add = (name, f) => {
        if (!found.has(name)) found.set(name, new Set());
        found.get(name).add(rel(f));
    };
    const reAttr = new RegExp(`${base}((?:-[a-z0-9]+)*)(?![a-z0-9])(-)?`, 'g');
    // data-ozi-select -> dataset.oziSelect; data-zld -> dataset.zld
    const camel = base.slice(5).replace(/-([a-z])/g, (x, c) => c.toUpperCase());
    const reSet = new RegExp(`dataset\\.${camel}([A-Z][A-Za-z0-9]*)?`, 'g');
    for (const { f, src } of code) {
        for (const m of src.matchAll(reAttr)) {
            if (m[2]) {
                const prefix = `${base}${m[1]}-`;
                // [2.11.9] literal que termina em "-" e NÃO é concatenado (`attrPrefix:
                // 'data-ozi-livewire-'` no registerAdapter) declara o prefixo; não é nome montado
                const after = src.slice(m.index + m[0].length, m.index + m[0].length + 8);
                if (/^['"`]\s*[,;)\]}\n]/.test(after)) continue;
                if (families.includes(prefix)) { add(prefix, f); continue; }
                fail(`${rel(f)}: nome montado por concatenação ("${prefix}" + ...): escreva o nome inteiro ou declare a família no manifesto ("${prefix}{x}" com "variants")`);
                continue;
            }
            add(`${base}${m[1]}`, f);
        }
        for (const m of src.matchAll(reSet)) add(`${base}${m[1] ? kebab(m[1]) : ''}`, f);
    }
    return found;
}

// ─── 2/3. por manifesto: registro + deriva ───────────────────────────────────────────────────

const conf = stripComments(read(join(root, 'core', 'ozi-conf.js')));
let attrsJs = read(ATTRS_FILE);
const attrsJsOriginal = attrsJs;

function wrapList(prefix, items, indent) {
    const lines = [];
    let cur = prefix;
    items.forEach((it, i) => {
        const piece = `'${it}'` + (i < items.length - 1 ? ', ' : '');
        if ((cur + piece).trimEnd().length > 100 && cur.trim() !== prefix.trim()) {
            lines.push(cur.trimEnd());
            cur = indent + piece;
        } else cur += piece;
    });
    lines.push(cur.trimEnd() + ']');
    return lines;
}

for (const m of manifests) {
    if (!validate(m)) continue;
    const d = m.data, ns = d.namespace, base = prefixOf(d), where = rel(m.file);
    const lns = d.langNamespace || ns;
    const suffix = (n) => (n === base ? '' : n.slice(base.length + 1));

    // registro (W001)
    const own      = (d.attributes || []).filter((a) => !a.shared);
    const author   = own.flatMap(expandNames).map(suffix).sort();
    const internal = (d.internal || []).map(suffix).sort();
    const ind = '        ';
    const block = [
        `${ind}// >>> manifest:${ns} — gerado de ${rel(m.file)} por tools/build-manifest.mjs; não editar à mão`,
        `${ind}${ns}: {`,
        ...wrapList(`${ind}    author: [`, author, `${ind}        `).map((l, i, arr) => l + (i === arr.length - 1 ? ',' : '')),
        ...wrapList(`${ind}    internal: [`, internal, `${ind}        `),
        `${ind}},`,
        `${ind}// <<< manifest:${ns}`,
    ].join('\n');
    const reBlock = new RegExp(`^[ \\t]*// >>> manifest:${ns}\\b[^\\n]*\\n[\\s\\S]*?^[ \\t]*// <<< manifest:${ns}[^\\n]*$`, 'm');
    if (!inW001(d)) {
        if (reBlock.test(attrsJs)) fail(`core/ozi-attrs.js tem marcadores de ${ns}, mas o prefixo ${base} fica fora do W001`);
    } else if (!reBlock.test(attrsJs)) fail(`core/ozi-attrs.js sem os marcadores // >>> manifest:${ns} ... // <<< manifest:${ns}`);
    else attrsJs = attrsJs.replace(reBlock, block);

    // deriva: atributos
    const families = own.filter((a) => a.name.includes('{'));
    const prefixes = families.map(familyPrefix);
    const declared = new Set([...own.filter((a) => !a.name.includes('{')).map((a) => a.name),
                              ...(d.internal || [])]);
    // compartilhados: o JS do próprio plugin tem de lê-los (literal no código, sem comentários)
    // JS do próprio plugin: a pasta dele, ou a lista "js" (integrações)
    const ownFiles = Array.isArray(d.js) ? new Set(d.js.map((j) => resolve(root, j))) : null;
    const isOwn    = (f) => (ownFiles ? ownFiles.has(resolve(f)) : f.startsWith(m.dir + sep));
    const ownSrcAll = code.filter(({ f }) => isOwn(f)).map(({ src }) => src).join('\n');
    // (entradas `"shared": true` em attributes, documentadas no site, e a lista simples `shared: [...]`)
    const sharedNames = [...(d.attributes || []).filter((x) => x.shared).map((x) => x.name), ...(d.shared || [])];
    for (const n of sharedNames) {
        if (!ownSrcAll.includes(n)) fail(`${where}: compartilhado "${n}" declarado e o JS do plugin não o lê`);
    }
    const found = attrsInCode(base, prefixes);
    const variantNames = new Set(families.flatMap(expandNames));
    for (const [name, files] of found) {
        if (prefixes.includes(name) || variantNames.has(name)) continue;   // família: conferida abaixo
        if (!declared.has(name)) fail(`${where}: o código usa "${name}" (${[...files].join(', ')}) e o manifesto não o declara`);
    }
    // [2.11.7] `"readBy": "css"`: atributo lido só por seletor CSS (o skin clarity tem
    // `[data-ozi-audio-bg="off"]`). A conferência procura o nome nos .css do pacote, não nos JS.
    const cssOnly = new Set(own.filter((a) => a.readBy === 'css').map((a) => a.name));
    for (const name of cssOnly) {
        const inCss = cssFiles.filter(({ src }) => new RegExp(`\\[${name}(?![a-z0-9-])`).test(src)).map(({ f }) => rel(f));
        if (!inCss.length) fail(`${where}: "${name}" marcado readBy css e nenhum CSS do pacote o usa num seletor`);
    }
    for (const name of declared) {
        if (cssOnly.has(name)) continue;
        if (!found.has(name)) fail(`${where}: "${name}" está no manifesto e nenhum JS do pacote o lê (atributo morto?)`);
    }
    for (const a of families) {
        const p = familyPrefix(a);
        if (!found.has(p) && !expandNames(a).every((n) => found.has(n))) {
            fail(`${where}: família "${a.name}": o código não monta "${p}" + ... nem lê cada variante`);
        }
    }

    // deriva: eventos (JS do próprio plugin)
    const ownJs = ownFiles ? code.filter(({ f }) => isOwn(f)) : code.filter(({ f }) => f.startsWith(join(m.dir, 'js') + sep));
    const emitted = new Set();
    // emit('ozi:x'...), _emit('ozi:x'...) e _emitEvent(el, 'ozi:x'...) (editor: o elemento vem antes)
    for (const { src } of ownJs) for (const e of src.matchAll(/[eE]mit\w*\(\s*(?:[\w.$]+\s*,\s*)?'(ozi:[a-z-]+)'/g)) emitted.add(e[1]);
    const evDecl = new Set((d.events || []).map((e) => e.name));
    for (const e of emitted) if (!evDecl.has(e)) fail(`${where}: o JS emite "${e}" e o manifesto não o declara em events`);
    for (const e of evDecl) if (!emitted.has(e)) fail(`${where}: evento "${e}" no manifesto e o JS não o emite`);

    // deriva: chaves i18n (cada lang/{l}.js do plugin)
    const langDecl = new Set(d.lang || []);
    for (const l of LANGS) {
        const lf = join(m.dir, 'lang', `${l}.js`);
        if (!existsSync(lf)) { if (langDecl.size) fail(`${where}: falta lang/${l}.js`); continue; }
        const src = stripComments(read(lf));
        // cada lang/{l}.js registra um bloco só (`{ns}: { chave: 'texto', ... }`); o texto pode ter
        // `{query}`, então nada de casar até o primeiro `}`: cada linha `chave: '...'` é uma chave
        const keys = new Set();
        const start = src.search(new RegExp(`\\b${lns}\\s*:\\s*\\{`));
        if (start > -1) for (const k of src.slice(start).matchAll(/^\s*(\w+)\s*:\s*['"`]/gm)) keys.add(`${lns}.${k[1]}`);
        for (const k of keys) if (!langDecl.has(k)) fail(`${where}: lang/${l}.js tem "${k}" e o manifesto não`);
        for (const k of langDecl) if (!keys.has(k)) fail(`${where}: "${k}" no manifesto e não em lang/${l}.js`);
    }

    // deriva: chave i18n declarada e nunca lida pelo JS do plugin (chave morta, e o texto da tela
    // vem de outro lugar). Achado no ozi-autocomplete 4.1.1: lang/*.js tinha `autocomplete.empty`, o
    // JS mostrava "No results" fixo em inglês. Procura a chave como literal ('ns.chave' ou "ns.chave").
    // [2.11.7] Uma chave lida só fora do plugin (o skin clarity lê audio.resume/conclude/discard em
    // themes/clarity/js/) também vale: procura em todo JS do pacote e diz onde.
    const ownSrc = ownJs.map(({ src }) => src).join('\n');
    const readsKey = (src, k) => src.includes(`'${k}'`) || src.includes(`"${k}"`);
    for (const k of langDecl) {
        if (readsKey(ownSrc, k)) continue;
        const elsewhere = code.filter(({ src }) => readsKey(src, k)).map(({ f }) => rel(f));
        if (elsewhere.length) console.log(`info     ${d.plugin}: chave "${k}" lida fora do plugin (${elsewhere.join(', ')})`);
        else fail(`${where}: chave "${k}" declarada e nenhum JS do pacote a lê (texto fixo no lugar?)`);
    }

    // deriva: deps × _pluginMap
    const pm = conf.match(new RegExp(`'${ns}'\\s*:\\s*\\{\\s*deps\\s*:\\s*\\[([^\\]]*)\\]`));
    if (!pm) fail(`${where}: plugin '${ns}' sem deps no _pluginMap do core/ozi-conf.js`);
    else {
        const deps = [...pm[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]).sort().join(',');
        const mine = [...(d.deps || [])].sort().join(',');
        if (deps !== mine) fail(`${where}: deps [${mine}] ≠ _pluginMap [${deps}]`);
    }

    console.log(`ok       ${d.plugin}: ${author.length} atributos, ${internal.length} internos, ${evDecl.size} eventos, ${langDecl.size} chaves` +
        (inW001(d) ? '' : ` (prefixo ${base}: fora do registro do W001)`));
}

// ─── gravação ────────────────────────────────────────────────────────────────────────────────

if (attrsJs !== attrsJsOriginal) {
    if (check) fail('core/ozi-attrs.js desatualizado: rode node tools/build-manifest.mjs');
    else { writeFileSync(ATTRS_FILE, attrsJs); console.log('gerado   core/ozi-attrs.js (registro dos manifestos)'); }
} else {
    console.log('ok       core/ozi-attrs.js em dia');
}

// ─── 4. registro em JSON: core/ozi-attrs.json (2.12.0, `ozi:check --lint`) ────────────────────
// O lado PHP precisa da mesma lista que o aviso OZI-W001 do navegador. Em vez de duplicá-la, este
// script grava o registro inteiro: os nomes dos manifestos + as listas escritas à mão no
// ozi-attrs.js (SHARED_*, SPECIAL, GONE_PREFIXES, lidas dele). `--check` reprova se estiver velho.

const JSON_FILE = join(root, 'core', 'ozi-attrs.json');

function jsLiteral(name) {
    const src = stripComments(attrsJs);
    const m = src.match(new RegExp(`var\\s+${name}\\s*=\\s*([\\[{][\\s\\S]*?[\\]}])\\s*;`));
    if (!m) { fail(`core/ozi-attrs.js: não achei "var ${name} = ..." para o ozi-attrs.json`); return null; }
    try { return new Function(`return (${m[1]});`)(); }
    catch (e) { fail(`core/ozi-attrs.js: ${name} não é um literal válido (${e.message})`); return null; }
}

const reg = { known: new Set(), author: new Set(), zldKnown: new Set(), zldAuthor: new Set(), namespaces: [] };
for (const m of manifests) {
    const d = m.data;
    if (!d.namespace) continue;
    const own = (d.attributes || []).filter((a) => !a.shared);
    const names = own.flatMap(expandNames);
    if (inW001(d)) {
        reg.namespaces.push(d.namespace);
        names.forEach((n) => { reg.known.add(n); reg.author.add(n); });
        (d.internal || []).forEach((n) => reg.known.add(n));
    } else if (prefixOf(d) === 'data-zld') {
        names.forEach((n) => { reg.zldKnown.add(n); reg.zldAuthor.add(n); });
        (d.internal || []).forEach((n) => reg.zldKnown.add(n));
    }
}
const sharedAuthor   = jsLiteral('SHARED_AUTHOR')   || [];
const sharedInternal = jsLiteral('SHARED_INTERNAL') || [];
sharedAuthor.forEach((n) => { reg.known.add(n); reg.author.add(n); });
sharedInternal.forEach((n) => reg.known.add(n));

const sorted = (s) => [...s].sort();
const special = jsLiteral('SPECIAL') || {};
const registryJson = JSON.stringify({
    _: 'Gerado por tools/build-manifest.mjs a partir dos manifestos e do core/ozi-attrs.js; não editar à mão. Lido pelo `php artisan ozi:check --lint` (o mesmo registro do aviso OZI-W001 do navegador).',
    known:        sorted(reg.known),
    author:       sorted(reg.author),
    special:      Object.fromEntries(Object.keys(special).sort().map((k) => [k, special[k]])),
    gonePrefixes: jsLiteral('GONE_PREFIXES') || [],
    namespaces:   reg.namespaces.slice().sort(),
    zld:          { known: sorted(reg.zldKnown), author: sorted(reg.zldAuthor) },
}, null, 1) + '\n';

const jsonOld = existsSync(JSON_FILE) ? read(JSON_FILE) : '';
if (jsonOld !== registryJson) {
    if (check) fail('core/ozi-attrs.json desatualizado: rode node tools/build-manifest.mjs');
    else { writeFileSync(JSON_FILE, registryJson); console.log('gerado   core/ozi-attrs.json (registro para o ozi:check --lint)'); }
} else {
    console.log('ok       core/ozi-attrs.json em dia');
}

if (problems) {
    console.log(`\n${problems} problema(s).`);
    process.exit(1);
}
