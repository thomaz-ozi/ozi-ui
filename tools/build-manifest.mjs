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

if (!manifests.length) {
    console.log('nenhum manifesto encontrado');
    process.exit(0);
}

// ─── 1. formato ──────────────────────────────────────────────────────────────────────────────

function validate(m) {
    const d = m.data, where = rel(m.file);
    const ns = d.namespace;
    if (d.manifest !== 1) fail(`${where}: "manifest" deve ser 1`);
    if (!ns || !/^[a-z]+$/.test(ns)) { fail(`${where}: "namespace" ausente ou inválido`); return false; }
    if (d.plugin !== `ozi-${ns}`) fail(`${where}: "plugin" deve ser "ozi-${ns}"`);
    if (m.kind.slice(0, -1) !== d.type) fail(`${where}: "type" deve ser "${m.kind.slice(0, -1)}" (pasta ${m.kind}/)`);

    const groups = new Set();
    for (const g of d.groups || []) {
        if (!g.id || groups.has(g.id)) fail(`${where}: grupo sem id ou repetido (${g.id})`);
        groups.add(g.id);
        for (const l of LANGS) if (!g.title || !g.title[l]) fail(`${where}: grupo "${g.id}" sem título ${l}`);
    }

    const base = `data-ozi-${ns}`, seen = new Set();
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

// Tira comentários /* */ e // respeitando strings ('', "", ``). Os cabeçalhos e changelogs dos
// plugins citam atributos antigos e novos, e não podem contar como "lido pelo código".
function stripComments(src) {
    let out = '', i = 0, q = null;
    while (i < src.length) {
        const c = src[i], n = src[i + 1];
        if (q) {
            out += c;
            if (c === '\\') { out += n || ''; i += 2; continue; }
            if (c === q) q = null;
            i++; continue;
        }
        if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
        if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; out += ' '; continue; }
        if (c === '/' && n === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
        out += c; i++;
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

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

// Família de nomes: `"name": "data-ozi-editor-tools-{bp}", "variants": ["sm", "md", ...]`. Vira um nome
// por variante no registro, e o código pode montá-los por concatenação ('data-ozi-editor-tools-' + bp):
// a concatenação só é aceita para o prefixo de uma família declarada.
const familyPrefix = (a) => a.name.slice(0, a.name.indexOf('{'));
function expandNames(a) {
    if (!a.name.includes('{')) return [a.name];
    return (a.variants || []).map((v) => a.name.replace(/\{\w+\}/, v));
}

function attrsInCode(ns, families = []) {
    const found = new Map();                     // nome -> [arquivos]
    const add = (name, f) => {
        if (!found.has(name)) found.set(name, new Set());
        found.get(name).add(rel(f));
    };
    const reAttr = new RegExp(`data-ozi-${ns}((?:-[a-z0-9]+)*)(?![a-z0-9])(-)?`, 'g');
    const Ns = ns[0].toUpperCase() + ns.slice(1);
    const reSet = new RegExp(`dataset\\.ozi${Ns}([A-Z][A-Za-z0-9]*)?`, 'g');
    for (const { f, src } of code) {
        for (const m of src.matchAll(reAttr)) {
            if (m[2]) {
                const prefix = `data-ozi-${ns}${m[1]}-`;
                if (families.includes(prefix)) { add(prefix, f); continue; }
                fail(`${rel(f)}: nome montado por concatenação ("${prefix}" + ...): escreva o nome inteiro ou declare a família no manifesto ("${prefix}{x}" com "variants")`);
                continue;
            }
            add(`data-ozi-${ns}${m[1]}`, f);
        }
        for (const m of src.matchAll(reSet)) add(`data-ozi-${ns}${m[1] ? kebab(m[1]) : ''}`, f);
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
    const d = m.data, ns = d.namespace, base = `data-ozi-${ns}`, where = rel(m.file);
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
    if (!reBlock.test(attrsJs)) fail(`core/ozi-attrs.js sem os marcadores // >>> manifest:${ns} ... // <<< manifest:${ns}`);
    else attrsJs = attrsJs.replace(reBlock, block);

    // deriva: atributos
    const families = own.filter((a) => a.name.includes('{'));
    const prefixes = families.map(familyPrefix);
    const declared = new Set([...own.filter((a) => !a.name.includes('{')).map((a) => a.name),
                              ...(d.internal || [])]);
    // compartilhados: o JS do próprio plugin tem de lê-los (literal no código, sem comentários)
    const ownSrcAll = code.filter(({ f }) => f.startsWith(m.dir + sep)).map(({ src }) => src).join('\n');
    // (entradas `"shared": true` em attributes, documentadas no site, e a lista simples `shared: [...]`)
    const sharedNames = [...(d.attributes || []).filter((x) => x.shared).map((x) => x.name), ...(d.shared || [])];
    for (const n of sharedNames) {
        if (!ownSrcAll.includes(n)) fail(`${where}: compartilhado "${n}" declarado e o JS do plugin não o lê`);
    }
    const found = attrsInCode(ns, prefixes);
    const variantNames = new Set(families.flatMap(expandNames));
    for (const [name, files] of found) {
        if (prefixes.includes(name) || variantNames.has(name)) continue;   // família: conferida abaixo
        if (!declared.has(name)) fail(`${where}: o código usa "${name}" (${[...files].join(', ')}) e o manifesto não o declara`);
    }
    for (const name of declared) {
        if (!found.has(name)) fail(`${where}: "${name}" está no manifesto e nenhum JS do pacote o lê (atributo morto?)`);
    }
    for (const a of families) {
        const p = familyPrefix(a);
        if (!found.has(p) && !expandNames(a).every((n) => found.has(n))) {
            fail(`${where}: família "${a.name}": o código não monta "${p}" + ... nem lê cada variante`);
        }
    }

    // deriva: eventos (JS do próprio plugin)
    const ownJs = code.filter(({ f }) => f.startsWith(join(m.dir, 'js') + sep));
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
        const start = src.search(new RegExp(`\\b${ns}\\s*:\\s*\\{`));
        if (start > -1) for (const k of src.slice(start).matchAll(/^\s*(\w+)\s*:\s*['"`]/gm)) keys.add(`${ns}.${k[1]}`);
        for (const k of keys) if (!langDecl.has(k)) fail(`${where}: lang/${l}.js tem "${k}" e o manifesto não`);
        for (const k of langDecl) if (!keys.has(k)) fail(`${where}: "${k}" no manifesto e não em lang/${l}.js`);
    }

    // deriva: chave i18n declarada e nunca lida pelo JS do plugin (chave morta, e o texto da tela
    // vem de outro lugar). Achado no ozi-autocomplete 4.1.1: lang/*.js tinha `autocomplete.empty`, o
    // JS mostrava "No results" fixo em inglês. Procura a chave como literal ('ns.chave' ou "ns.chave").
    const ownSrc = ownJs.map(({ src }) => src).join('\n');
    for (const k of langDecl) {
        if (!ownSrc.includes(`'${k}'`) && !ownSrc.includes(`"${k}"`)) {
            fail(`${where}: chave "${k}" declarada e o JS do plugin nunca a lê (texto fixo no lugar?)`);
        }
    }

    // deriva: deps × _pluginMap
    const pm = conf.match(new RegExp(`'${ns}'\\s*:\\s*\\{\\s*deps\\s*:\\s*\\[([^\\]]*)\\]`));
    if (!pm) fail(`${where}: plugin '${ns}' sem deps no _pluginMap do core/ozi-conf.js`);
    else {
        const deps = [...pm[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]).sort().join(',');
        const mine = [...(d.deps || [])].sort().join(',');
        if (deps !== mine) fail(`${where}: deps [${mine}] ≠ _pluginMap [${deps}]`);
    }

    console.log(`ok       ${d.plugin}: ${author.length} atributos, ${internal.length} internos, ${evDecl.size} eventos, ${langDecl.size} chaves`);
}

// ─── gravação ────────────────────────────────────────────────────────────────────────────────

if (attrsJs !== attrsJsOriginal) {
    if (check) fail('core/ozi-attrs.js desatualizado: rode node tools/build-manifest.mjs');
    else { writeFileSync(ATTRS_FILE, attrsJs); console.log('gerado   core/ozi-attrs.js (registro dos manifestos)'); }
} else {
    console.log('ok       core/ozi-attrs.js em dia');
}

if (problems) {
    console.log(`\n${problems} problema(s).`);
    process.exit(1);
}
