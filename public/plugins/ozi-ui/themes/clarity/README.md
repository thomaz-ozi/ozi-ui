# Skin `clarity` — ozi-audio (v2)

Skin visual + comportamento para o **ozi-audio**: card escuro (dark-first),
**play azul**, progresso/volume **roxo**, **Gravar vermelho** / **Concluir verde**,
e transporte de gravação estilo mensageiro (Pausar/Continuar, lixeira, Concluir
num clique). Cobre os três modos: `player`, `recorder`, `full`.

> **Requer** `ozi-audio.js >= 4.3.0` (API `recordPause`/`recordResume`).

---

## Como incluir

```html
<!-- no <head>: tokens → overrides → dark -->
<link rel="stylesheet" href="/plugins/ozi-ui/themes/clarity/tokens.css">
<link rel="stylesheet" href="/plugins/ozi-ui/themes/clarity/overrides.css">
<link rel="stylesheet" href="/plugins/ozi-ui/themes/clarity/dark.css">

<!-- comportamento do recorder/full -->
<script src="/plugins/ozi-ui/themes/clarity/js/ozi-audio-clarity.js"></script>
```

O `ozi-audio-clarity.js` decora `recorder`/`full` automaticamente (auto-scan no
boot + hook `afterRender`). Se precisar disparar manualmente após render:
`OziAudioClarity.scan(document)`.

### Marcador de opt-in — **obrigatório**

O CSS do clarity é escopado em `[data-ozi-skin~="clarity"]` no `<html>`:

```html
<html data-ozi-skin="clarity">
```

Isso é o que faz o skin **vencer** o CSS do componente (o `ozi.js` injeta o
CSS base em runtime, sempre depois dos `<link>` do tema — sem o marcador a base
venceria no cascade). O `ozi-audio-clarity.js` **seta o atributo sozinho no
boot**; pô-lo no HTML evita flash e permite alternar `default`↔`clarity` sem
mexer nos `<link>`.

---

## Modos

| Modo | Aparência |
|---|---|
| `player` | card + play azul, timeline, volume, pill `1x` |
| `recorder` | ocioso = só o mic; ao gravar expande a barra (Pausar · timer · badge · medidor · lixeira · Concluir). Ao concluir, `data-ozi-audio-saved` escolhe o layout salvo. |
| `full` | player + gravador no mesmo card (Gravar/Concluir com rótulo; tonalidade muda com o estado) |

### `data-ozi-audio-saved` (recorder) — `player` \| `combo`
Aparência pós-conclusão. `player` (padrão): gravador ocioso + player do take ao
lado. `combo`: player do take + Gravar num card só.

```html
<div data-ozi-audio="recorder" data-ozi-audio-save-url="/api/audio/save"
     data-ozi-audio-saved="combo"></div>
```

---

## Customização por instância

**Tirar o fundo do card:**
```html
<div data-ozi-audio="player" data-ozi-audio-bg="off"></div>   <!-- ou "none" -->
```

**Cores/geometria por instância** — use o `style` padrão com as variáveis CSS:
```html
<div data-ozi-audio="full"
     style="--ozi-audio-play-bg:#e91e63; --ozi-audio-accent:#7c3aed;
            --ozi-audio-record-bg:#ff5722; --ozi-audio-save-bg:#009688;"></div>
```

| Token | Controla |
|---|---|
| `--ozi-audio-play-bg` | botão play / Pausar (azul) |
| `--ozi-audio-accent` | progresso · volume · medidor (roxo) |
| `--ozi-audio-record-bg` | botão Gravar (vermelho) |
| `--ozi-audio-save-bg` | botão Concluir (verde) |
| `--ozi-audio-color` | trilho (fundo do progresso/volume) |
| `--ozi-audio-radius` · `--ozi-audio-width-max` | geometria |

Para o tema inteiro (não por instância), sobrescreva os mesmos tokens em
`:root[data-ozi-skin~="clarity"]`.

---

## Arquivos

```
themes/clarity/
├── tokens.css      ← paleta/geometria (claro)
├── overrides.css   ← estrutura (play círculo, transporte, customização)
├── dark.css        ← card escuro
├── classmap.js     ← classes neutras ozi-* (skin, não framework)
└── js/
    └── ozi-audio-clarity.js  ← comportamento (OziAudioClarity)
```
