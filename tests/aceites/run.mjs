#!/usr/bin/env node
// Aceites JS headless — roda cada página de tests/aceites/ contra os assets DO PACOTE.
//
// Tempo REAL, via DevTools Protocol: abre a página e consulta #veredito a cada 200 ms até sair
// "PASSOU" ou "FALHOU". Substitui o `--dump-dom --virtual-time-budget`, que adianta o relógio do
// JS mas não acelera I/O assíncrono real (Blob.text() do clipboard, decode de imagem): um
// `await wait(300)` terminava antes da operação e o teste ficava instável conforme a máquina.
//
// Sem dependência npm: Node 22+ (WebSocket e fetch nativos) + Chrome/Chromium/Edge.
// Layout do site temporário = o do ozi-ui-dev-hard (plugins/ozi-ui + teste-v2/), então as páginas
// são cópia fiel das do dev-hard, sem edição.
//
// Uso:  node tests/aceites/run.mjs [pagina.html ...]
// Env:  BROWSER=/caminho/do/navegador   PAGE_TIMEOUT=30 (s por página)   WINDOW=800x600
//
// ⚠️ Aceite headless mede estado (classList, valor, eventos), não pintura: verde aqui não prova
// que o visual está certo. Ver ozi-ui-ai/logs/lessons-learned.md (2026-09-14 e 2026-08-31).

import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, cpSync, readFileSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT      = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES_DIR = join(ROOT, 'tests/aceites');
const TIMEOUT   = Number(process.env.PAGE_TIMEOUT || 30) * 1000;
const GH        = !!process.env.GITHUB_ACTIONS;
const [WIN_W, WIN_H] = (process.env.WINDOW || '800x600').split('x').map(Number);

// Falhas conhecidas e registradas: rodam e aparecem como aviso, mas não derrubam o job.
// Cada entrada precisa de motivo e de onde está registrada. Tire daqui assim que passar.
const KNOWN_FAIL = {
    // vazio: as duas entradas de 2026-09-30 viraram correções (ozi-loader 1.0.2, ozi-editor 4.9.1)
};

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.map': 'application/json',
};

function findBrowser() {
    if (process.env.BROWSER) return process.env.BROWSER;
    for (const c of ['google-chrome', 'chromium', 'chromium-browser']) {
        try { return execSync(`command -v ${c}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
    }
    for (const c of ['C:/Program Files/Google/Chrome/Application/chrome.exe',
                     'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) {
        if (existsSync(c)) return c;
    }
    console.error('Nenhum Chrome/Chromium/Edge encontrado. Defina BROWSER=/caminho/do/navegador.');
    process.exit(2);
}

// ── site temporário + servidor estático ─────────────────────────────────────
const site = mkdtempSync(join(tmpdir(), 'ozi-aceites-'));
cpSync(join(ROOT, 'public/plugins/ozi-ui'), join(site, 'plugins/ozi-ui'), { recursive: true });
cpSync(PAGES_DIR, join(site, 'teste-v2'), { recursive: true, filter: (p) => statSync(p).isDirectory() || p.endsWith('.html') });

const server = createServer((req, res) => {
    const path = join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(site) || !existsSync(path) || !statSync(path).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(readFileSync(path));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/teste-v2/`;

// ── navegador + DevTools Protocol ───────────────────────────────────────────
const profile = join(site, '.profile');
const browser = spawn(findBrowser(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    // janela fixa (= padrão do Chrome headless, onde as páginas foram validadas): sem ela a janela
    // varia por SO/DPI e muda quais @media valem
    `--window-size=${WIN_W},${WIN_H}`, '--force-device-scale-factor=1',
    // rede externa bloqueada (hermético): algumas páginas usam URLs de imagem reais como fixture
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((ok, fail) => {
    let buf = '';
    const t = setTimeout(() => fail(new Error('navegador não abriu o DevTools em 30 s')), 30000);
    browser.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) { clearTimeout(t); ok(m[1]); }
    });
    browser.on('exit', (code) => fail(new Error(`navegador saiu (código ${code})`)));
});

const ws = new WebSocket(wsUrl);
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('falha no WebSocket do DevTools')); });
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
        const { ok, fail } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    }
};
const cdp = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const id = ++seq;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(() => {
    const v = document.getElementById('veredito');
    return JSON.stringify({
        verdict: v ? v.textContent.trim() : '',
        fails: [...document.querySelectorAll('li.fail')].map((li) => li.textContent.trim().replace(/\\s+/g, ' ')),
    });
})()`;

// Uma página num contexto isolado (como uma aba anônima: nada de storage compartilhado).
async function runPage(page) {
    const { browserContextId } = await cdp('Target.createBrowserContext');
    try {
        const { targetId } = await cdp('Target.createTarget', { url: 'about:blank', browserContextId, width: WIN_W, height: WIN_H });
        const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
        await cdp('Page.navigate', { url: base + page }, sessionId);

        const deadline = Date.now() + TIMEOUT;
        let last = { verdict: '', fails: [] };
        while (Date.now() < deadline) {
            await sleep(200);
            try {
                const r = await cdp('Runtime.evaluate', { expression: PROBE, returnByValue: true }, sessionId);
                last = JSON.parse(r.result.value);
            } catch { /* página ainda navegando */ }
            if (/PASSOU|FALHOU/.test(last.verdict)) return last;
        }
        return { verdict: last.verdict ? `${last.verdict} (timeout ${TIMEOUT / 1000}s)` : 'sem veredito (timeout)', fails: last.fails };
    } finally {
        await cdp('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
    }
}

// ── execução ────────────────────────────────────────────────────────────────
const pages = process.argv.slice(2).length
    ? process.argv.slice(2)
    : readdirSync(PAGES_DIR).filter((f) => f.endsWith('.html')).sort();

let passed = 0, failed = 0, known = 0, flaky = 0;

for (const page of pages) {
    const isKnown = page in KNOWN_FAIL;
    let r = await runPage(page);
    let firstVerdict = null;

    // uma nova tentativa para falha não conhecida: separa instável de quebrado
    if (!isKnown && !r.verdict.includes('PASSOU')) {
        firstVerdict = r.verdict;
        r = await runPage(page);
    }

    if (r.verdict.includes('PASSOU')) {
        passed++;
        console.log(`✔ ${page} — ${r.verdict}`);
        if (firstVerdict) {
            flaky++;
            console.log(`  ↳ instável: falhou na 1ª tentativa (${firstVerdict}) e passou na 2ª`);
            if (GH) console.log(`::warning title=aceite ${page} (instável)::falhou na 1ª tentativa e passou na 2ª: ${firstVerdict}`);
        }
        if (isKnown) {
            console.log('  ↳ está em KNOWN_FAIL mas passou: tire da lista');
            if (GH) console.log(`::warning title=aceite ${page}::passou, mas está em KNOWN_FAIL; tire da lista`);
        }
    } else if (isKnown) {
        known++;
        console.log(`⚠ ${page} — ${r.verdict} (falha conhecida: ${KNOWN_FAIL[page]})`);
        if (GH) console.log(`::warning title=aceite ${page} (falha conhecida)::${r.verdict}`);
    } else {
        failed++;
        console.log(`✘ ${page} — ${r.verdict}`);
        r.fails.forEach((f) => console.log(`    · ${f}`));
        if (GH) console.log(`::error title=aceite ${page}::${r.verdict} ${r.fails.join(' · ').slice(0, 400)}`);
    }
}

console.log(`\nAceites: ${passed} passaram (${flaky} na 2ª tentativa), ${failed} falharam, ${known} falha(s) conhecida(s).`);
if (GH) console.log(`::notice title=aceites::${passed} passaram (${flaky} na 2ª tentativa), ${failed} falharam, ${known} conhecida(s)`);

ws.close();
browser.kill();
server.close();
await sleep(300);
try { rmSync(site, { recursive: true, force: true }); } catch {}
process.exit(failed ? 1 : 0);
