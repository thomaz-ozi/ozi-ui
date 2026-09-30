# Aceites JS (headless)

Páginas HTML autossuficientes, uma por plugin ou recurso. Cada uma carrega só o `ozi.js`,
exercita o plugin (DOM, eventos `ozi:*`, API, adapters) e escreve o resultado em `#veredito`.

```bash
bash tests/aceites/run.sh                         # todas
bash tests/aceites/run.sh aceite-select.html      # uma
BROWSER="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" bash tests/aceites/run.sh   # Windows
```

Requer PHP (servidor embutido) e Chrome, Chromium ou Edge. O CI roda todas a cada push.

**Origem:** as páginas são cópia fiel de `ozi-ui-dev-hard/public/teste-v2/`, que é onde elas
nascem e são mantidas. Ao criar ou alterar um aceite lá, copie para cá junto com o espelho dos assets.

**Limite:** um aceite headless mede estado (`classList`, valores, eventos), não pintura. Verde
aqui não prova que o visual está certo; mudança visual continua precisando de teste ao vivo.
