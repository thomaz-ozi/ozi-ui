# Aceites JS (headless)

Páginas HTML autossuficientes, uma por plugin ou recurso. Cada uma carrega só o `ozi.js`,
exercita o plugin (DOM, eventos `ozi:*`, API, adapters) e escreve o resultado em `#veredito`.

```bash
node tests/aceites/run.mjs                        # todas
node tests/aceites/run.mjs aceite-select.html     # uma
BROWSER="/caminho/do/navegador" node tests/aceites/run.mjs
```

Requer Node 22+ (sem nenhuma dependência npm) e Chrome, Chromium ou Edge (detectados sozinhos).
O CI roda todas a cada push.

**Como funciona:** o runner monta um site temporário com o layout do `ozi-ui-dev-hard`
(`plugins/ozi-ui` do pacote + `teste-v2/`), abre cada página num contexto isolado do navegador
e lê o `#veredito` **em tempo real** via DevTools Protocol, até sair "PASSOU" ou "FALHOU".
Tempo real é proposital: o `--virtual-time-budget` usado antes adiantava o relógio do JS, mas
não acelerava I/O assíncrono de verdade (clipboard, imagem). Um `await wait(300)` terminava antes
da operação e os aceites do editor ficavam instáveis conforme a máquina.

Janela fixa em 800×600 e DPR 1, rede externa bloqueada, uma segunda tentativa só para falha não
conhecida (passar na segunda vira aviso de "instável") e a lista `KNOWN_FAIL` no topo do
`run.mjs`, para falhas registradas que rodam sem derrubar o job.

**Origem:** as páginas são cópia fiel de `ozi-ui-dev-hard/public/teste-v2/`, que é onde elas
nascem e são mantidas. Ao criar ou alterar um aceite lá, copie para cá junto com o espelho dos assets.

**Limite:** um aceite headless mede estado (`classList`, valores, eventos), não pintura. Verde
aqui não prova que o visual está certo; mudança visual continua precisando de teste ao vivo.
