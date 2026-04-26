# oziAudio

### Identificação
- **Nome:** `oziAudio`
- **Versão:** `2.6.6`
- **Data:** `2026-04-25`

---

### Descrição
`oziAudio` é um componente declarativo de áudio para interfaces web. Suporta três modos de operação — player, gravador e completo — todos ativados via atributo HTML sobre um elemento contêiner. Integra reprodução de arquivos de áudio, gravação via microfone, preview do conteúdo gravado e envio automático ao backend via `oziLoadData`.

O plugin foi construído com visual próprio e independente de frameworks CSS. Toda a aparência é controlada por variáveis CSS `--ozi-audio-*` no `:root`, o que permite ao desenvolvedor customizar completamente cores, tamanhos, bordas e espaçamentos sem tocar no código do plugin — basta sobrescrever os tokens no seu próprio CSS. Os ícones são arquivos SVG externos carregados sob demanda com cache automático, e o caminho base pode ser trocado via `OziAudio.setIconBase()`, permitindo que cada projeto use seus próprios ícones sem modificar o plugin.

---

### Recursos

- Três modos de operação — `player`, `recorder` e `full`
- Player completo — barra de progresso, volume, mudo e controle de velocidade
- Gravador de áudio — acessa o microfone via `MediaRecorder` com timer em tempo real
- Preview da gravação — exibe player nativo após gravar para revisão
- Envio automático — salva a gravação no backend via `oziLoadData`
- Pausa automática — pausa instâncias concorrentes ao iniciar reprodução
- MutationObserver — detecta e inicializa elementos inseridos dinamicamente no DOM
- Ícones SVG externos com cache — carregados sob demanda, substituíveis por projeto
- Aparência totalmente customizável via tokens CSS `--ozi-audio-*`
- API pública — métodos JavaScript para controle programático

---

### [1] MODO DE OPERAÇÃO

| Atributo | Valor | Descrição |
|----------|-------|-----------|
| `data-ozi-audio` | `player` | Apenas reprodução de áudio |
| `data-ozi-audio` | `recorder` | Apenas gravação via microfone |
| `data-ozi-audio` | `full` | Reprodução + gravação combinados |

---

### [2] CONFIGURAÇÃO DO PLAYER

| Atributo | Padrão | Descrição |
|----------|--------|-----------|
| `data-ozi-audio-url` | — | URL do arquivo de áudio — obrigatório no modo `player` |
| `data-ozi-audio-title` | — | Título exibido no player |
| `data-ozi-audio-volume` | `true` | Exibe controle de volume |
| `data-ozi-audio-speed` | `true` | Exibe controle de velocidade de reprodução |

#### Velocidades de reprodução
O botão alterna ciclicamente: `1x` → `1.25x` → `1.5x` → `1.75x` → `2x` → `0.75x` → `1x`

---

### [3] CONFIGURAÇÃO DO GRAVADOR

| Atributo | Padrão | Descrição |
|----------|--------|-----------|
| `data-ozi-audio-preview` | `true` | Exibe player nativo para ouvir antes de salvar |
| `data-ozi-audio-save-url` | — | URL do backend para envio da gravação |
| `data-ozi-audio-save-field` | `audio_file` | Nome do campo enviado no `FormData` |

---

### [4] EXEMPLOS

#### Modo player
```html
<div
    data-ozi-audio="player"
    data-ozi-audio-url="/storage/audio/podcast.mp3"
    data-ozi-audio-title="Episódio 01">
</div>
```

#### Modo player sem volume e sem velocidade
```html
<div
    data-ozi-audio="player"
    data-ozi-audio-url="/storage/audio/intro.mp3"
    data-ozi-audio-volume="false"
    data-ozi-audio-speed="false">
</div>
```

#### Modo recorder
```html
<div
    data-ozi-audio="recorder"
    data-ozi-audio-save-url="/api/audio/salvar"
    data-ozi-audio-save-field="gravacao">
</div>
```

#### Modo recorder sem preview
```html
<div
    data-ozi-audio="recorder"
    data-ozi-audio-preview="false"
    data-ozi-audio-save-url="/api/audio/salvar">
</div>
```

#### Modo full — player + gravador combinados
```html
<div
    data-ozi-audio="full"
    data-ozi-audio-url="/storage/audio/base.mp3"
    data-ozi-audio-title="Gravação"
    data-ozi-audio-save-url="/api/audio/salvar"
    data-ozi-audio-save-field="audio_file">
</div>
```

---

### [5] APARÊNCIA E CUSTOMIZAÇÃO

O plugin não depende de Bootstrap, Tailwind ou qualquer framework CSS. Todo o visual é controlado por tokens CSS declarados no `:root`. Para customizar, basta sobrescrever as variáveis no seu próprio CSS — sem tocar no plugin.

#### Tokens disponíveis

```css
:root {
    /* Cores principais */
    --ozi-audio-color: #b8b8b9;               /* cor base dos controles */
    --ozi-audio-color-secondary: #ff7f50;     /* cor de destaque — progresso, volume ativo */
    --ozi-audio-text: #808080;                /* cor do texto e títulos */
    --ozi-audio-text-secondary: #dfdfdf;      /* cor do texto dos botões */

    /* Container */
    --ozi-audio-bg: rgba(255, 255, 255, 0.77);
    --ozi-audio-shadow: rgba(117, 108, 108, 0.22);
    --ozi-audio-border: rgba(255, 255, 255, 0.22);
    --ozi-audio-radius: 15px;
    --ozi-audio-padding: 8px 10px;
    --ozi-audio-width-min: 250px;
    --ozi-audio-width-max: 350px;

    /* Barra de progresso e volume */
    --ozi-audio-timeline-height: 15px;
    --ozi-audio-volume-height: 7px;

    /* Botão record */
    --ozi-audio-record-bg: #dc3545;
    --ozi-audio-record-bg-hover: #bb2d3b;
    --ozi-audio-record-text: #ffffff;

    /* Botão save */
    --ozi-audio-save-bg: #198754;
    --ozi-audio-save-bg-hover: #157347;
    --ozi-audio-save-text: #ffffff;

    /* Tamanho dos ícones SVG */
    --ozi-audio-icon-play-size: 20px;
    --ozi-audio-icon-volume-size: 18px;
    --ozi-audio-icon-record-size: 16px;
    --ozi-audio-icon-save-size: 14px;
}
```

#### Exemplo — tema escuro
```css
.meu-player {
    --ozi-audio-bg: rgba(30, 30, 30, 0.95);
    --ozi-audio-border: rgba(255, 255, 255, 0.08);
    --ozi-audio-color: #555;
    --ozi-audio-color-secondary: #7c3aed;
    --ozi-audio-text: #ccc;
}
```

---

### [6] ÍCONES SVG

Os ícones são arquivos SVG externos carregados sob demanda com cache automático. O caminho base padrão é: