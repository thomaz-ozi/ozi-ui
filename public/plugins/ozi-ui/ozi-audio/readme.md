# oziAudio

**Versão:** `1.2.0` — **Atualizado em:** `2026-04-12`

## Descrição

Componente declarativo de áudio para interfaces web. Suporta três modos de operação — player, gravador e completo — todos ativados via atributo HTML sobre um elemento contêiner. Integra reprodução de arquivos de áudio, gravação via microfone, preview do conteúdo gravado e envio automático ao backend via `oziLoadData`.

## Recursos

- **Três modos de operação** — `player`, `recorder` e `full`
- **Player completo** — barra de progresso, volume, mudo e controle de velocidade
- **Gravador de áudio** — acessa o microfone via `MediaRecorder` com timer em tempo real
- **Preview da gravação** — exibe player nativo após gravar para revisão
- **Envio automático** — salva a gravação no backend via `oziLoadData`
- **Pausa automática** — pausa instâncias concorrentes ao iniciar reprodução
- **MutationObserver** — detecta e inicializa elementos inseridos dinamicamente no DOM
- **API pública** — métodos JavaScript para controle programático

---

## Atributos HTML

### [1] Modo de Operação

| Atributo | Valor | Descrição |
|---|---|---|
| `data-ozi-audio` | `player` | Apenas reprodução de áudio |
| `data-ozi-audio` | `recorder` | Apenas gravação via microfone |
| `data-ozi-audio` | `full` | Reprodução + gravação combinados |

### [2] Configuração do Player

| Atributo | Padrão | Descrição |
|---|---|---|
| `data-ozi-audio-url` | — | URL do arquivo de áudio a reproduzir — obrigatório no modo `player` |
| `data-ozi-audio-title` | — | Título exibido no player |
| `data-ozi-audio-volume` | `true` | Exibe controle de volume |
| `data-ozi-audio-speed` | `true` | Exibe controle de velocidade de reprodução |

### [3] Configuração do Gravador

| Atributo | Padrão | Descrição |
|---|---|---|
| `data-ozi-audio-preview` | `true` | Exibe player nativo para ouvir a gravação antes de salvar |
| `data-ozi-audio-save-url` | — | URL do backend para envio da gravação |
| `data-ozi-audio-save-field` | `audio_file` | Nome do campo enviado no `FormData` |

### [4] Velocidades de Reprodução

O botão de velocidade alterna ciclicamente entre os seguintes valores:

`1x` → `1.25x` → `1.5x` → `1.75x` → `2x` → `0.75x` → `1x`

---

## Exemplos

### Modo player

```html
<div
    data-ozi-audio="player"
    data-ozi-audio-url="/storage/audio/podcast.mp3"
    data-ozi-audio-title="Episódio 01">
</div>
```

### Modo player sem volume e sem velocidade

```html
<div
    data-ozi-audio="player"
    data-ozi-audio-url="/storage/audio/intro.mp3"
    data-ozi-audio-volume="false"
    data-ozi-audio-speed="false">
</div>
```

### Modo recorder

```html
<div
    data-ozi-audio="recorder"
    data-ozi-audio-save-url="/api/audio/salvar"
    data-ozi-audio-save-field="gravacao">
</div>
```

### Modo recorder sem preview

```html
<div
    data-ozi-audio="recorder"
    data-ozi-audio-preview="false"
    data-ozi-audio-save-url="/api/audio/salvar">
</div>
```

### Modo full — player + gravador combinados

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

## Eventos

| Evento | Descrição |
|---|---|
| `ozi:audio-play` | Disparado ao iniciar a reprodução |
| `ozi:audio-pause` | Disparado ao pausar a reprodução |
| `ozi:audio-record-start` | Disparado ao iniciar gravação |
| `ozi:audio-recorded` | Disparado quando a gravação é concluída |
| `ozi:audio-record-error` | Disparado em caso de erro na gravação |
| `ozi:audio-saved` | Disparado após envio bem-sucedido ao backend |
| `ozi:audio-save-error` | Disparado em caso de erro no envio |

### Escutando eventos

```javascript
// jQuery
$('#meuAudio').on('ozi:audio-recorded', function (e, payload) {
    console.log(payload.duration);  // duração em segundos
    console.log(payload.mimeType);  // ex: audio/webm
    console.log(payload.size);      // tamanho em bytes
    console.log(payload.file);      // objeto File
});

// DOM nativo
document.querySelector('#meuAudio')
    .addEventListener('ozi:audio-recorded', function (e) {
        console.log(e.detail);
    });
```

---

## API Pública

| Método | Descrição |
|---|---|
| `OziAudio.init(selector)` | Inicializa instâncias — sem argumento inicializa todos `[data-ozi-audio]` |
| `OziAudio.observe()` | Ativa `MutationObserver` para detectar novos elementos no DOM |
| `OziAudio.get(selectorOrId)` | Retorna a instância pelo seletor ou id |
| `OziAudio.destroy(selectorOrId)` | Destrói a instância e limpa o DOM |
| `OziAudio.play(selectorOrId)` | Inicia a reprodução |
| `OziAudio.pause(selectorOrId)` | Pausa a reprodução |
| `OziAudio.record(selectorOrId)` | Inicia a gravação |
| `OziAudio.stopRecord(selectorOrId)` | Para a gravação |
| `OziAudio.save(selectorOrId)` | Envia a gravação ao backend |
| `OziAudio.refresh(selectorOrId)` | Reinicializa instâncias |

### Exemplos de uso da API

```javascript
// Controle via JavaScript
OziAudio.play('#meuPlayer');
OziAudio.pause('#meuPlayer');

// Iniciar e parar gravação programaticamente
OziAudio.record('#meuGravador');
OziAudio.stopRecord('#meuGravador');

// Salvar gravação manualmente
OziAudio.save('#meuGravador');

// Destruir instância
OziAudio.destroy('#meuAudio');
```

---

## Retorno do evento `ozi:audio-recorded`

```javascript
{
    duration: 12.45,       // duração em segundos
    mimeType: 'audio/webm', // tipo MIME da gravação
    size: 48200,           // tamanho em bytes
    file: File             // objeto File pronto para envio
}
```

## Retorno do evento `ozi:audio-saved`

```javascript
{
    response: {
        ok: true,
        status: 200,
        data: { ... }  // resposta do backend
    }
}
```
