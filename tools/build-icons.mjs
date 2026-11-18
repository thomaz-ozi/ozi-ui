#!/usr/bin/env node
// Gera components/ozi-{plugin}/svg/icons.json a partir dos icon-*.svg do mesmo diretório.
//
// Por quê: OZI.helpers.icon buscava um arquivo por ícone (o editor com tabela fazia 24
// requisições de SVG). Com o pacote, é 1 requisição por plugin. Os SVGs avulsos continuam no
// pacote: são a fonte deste arquivo e o fallback do helper para nome fora do pacote.
//
// Uso:  node tools/build-icons.mjs [dir plugins/ozi-ui] [--check]   (padrão: public/plugins/ozi-ui)
//   --check  não grava; sai com 1 se algum icons.json estiver desatualizado (CI).
// Sem dependência npm. Saída determinística (chaves ordenadas, sem data).

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args  = process.argv.slice(2);
const check = args.includes('--check');
const root  = resolve(args.find((a) => !a.startsWith('--')) || 'public/plugins/ozi-ui');
const compDir = join(root, 'components');

if (!existsSync(compDir)) {
    console.error(`build-icons: não achei ${compDir}`);
    process.exit(2);
}

let stale = 0;
for (const comp of readdirSync(compDir).sort()) {
    const svgDir = join(compDir, comp, 'svg');
    if (!existsSync(svgDir)) continue;
    const files = readdirSync(svgDir).filter((f) => /^icon-.+\.svg$/.test(f)).sort();
    if (!files.length) continue;

    const icons = {};
    for (const f of files) {
        icons[f.slice(5, -4)] = readFileSync(join(svgDir, f), 'utf8').replace(/^﻿/, '').trim();
    }
    const out = JSON.stringify({
        _: 'Gerado por tools/build-icons.mjs a partir dos icon-*.svg desta pasta. Não editar à mão.',
        icons,
    }, null, 1) + '\n';

    const target = join(svgDir, 'icons.json');
    const atual  = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (atual === out) { console.log(`ok       ${comp}: ${files.length} ícones`); continue; }
    if (check) {
        stale++;
        console.log(`DESATUALIZADO ${comp}: rode node tools/build-icons.mjs`);
    } else {
        writeFileSync(target, out);
        console.log(`gerado   ${comp}: ${files.length} ícones → svg/icons.json`);
    }
}
if (stale) process.exit(1);
