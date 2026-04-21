
# oziLoadData

### Identificação
- **Nome:** `oziLoadData`
- **Versão:** `3.10.2`
- **Data:** `2026-04-12`

### Descrição
Motor de transporte e integração da biblioteca
Realiza coleta, envio e tratamento de dados em diferentes modos de execução, com suporte a destino visual, integração com API e controle de comportamento.

O oziToggle, oziCopy, oziAudio e oziSelect são plugins mais visuais ou funcionais.
O oziLoadData está virando algo mais profundo:
ele está se tornando o encanamento inteligente entre interface, dados e backend.

diria assim:

ele nasceu plugin
mas está se tornando um core utilitário da Ozi Library

Talvez até, no futuro, vocês olhem para ele não só como “plugin”, mas como:

engine
bridge
transport layer
action/render pipeline


### Recursos
- **envio dinâmico** → suporta envio nos modos `fetch`, `window` e `page`
- **coleta flexível** → coleta dados por grupo, item individual ou JSON
- **resposta visual** → envia retorno para um destino específico no DOM
- **integração com API** → facilita chamadas orientadas a dados
- **limpeza de formulário** → limpa campos após envio quando configurado
- **controle de clique** → evita múltiplas ações durante a requisição
- **suporte a debug** → exibe logs detalhados para análise do fluxo

### [1] Envio
- `data-zld-url` → define o endereço de envio
- `data-zld-mode` → define o modo de envio: `fetch`, `window` ou `page`
- `data-zld-mode-method` → define o método da requisição: `GET` ou `POST`
- `data-zld-mode-page-target` → define o alvo da página: `_self`, `_blank`, `_parent`, `_top` ou `framename`

### [2] Coleta de Dados
- `data-zld-catch-group-id` → coleta os dados dentro do id informado
- `data-zld-catch-item-name` → coleta itens individuais pelo atributo `name`
- `data-zld-file` → faz tratamento de arquivos: `audio-webm`, `imagem`, `PDF` e outros gerados no frontend
- `data-zld-json` → envia dados estruturados em `Array` ou `JSON string` junto com o `FormData`
- `data-zld-checkbox` → define ou auxilia o tratamento de valores de checkbox


### [3] Resposta / Destino
- `data-zld-destiny-id` → define o destino da resposta
- `data-zld-destiny-append` → adiciona a resposta no destino informado
- `data-zld-destiny-Before` → insere a resposta antes do destino informado
- `data-zld-expect-json` → ajusta headers para JSON e facilita integração com Laravel
- `data-zld-api` → define a chamada como modo API, voltada para resposta em dados

### [4] Comportamento / UX
- `data-zld-form-busy` → evita múltiplos cliques durante a requisição
- `data-zld-form-clear` → limpa formulários após o envio, exceto campos `hidden`
- `data-zld-reload-script` → recarrega scripts da classe `ld-reload` em cenários legados

### [5] Debug / Suporte
- `data-zld-log` → ativa logs de depuração no console

### [6] Compatibilidades:
 - Adaptado para `IIFE` → Async/Await, Evita Conflitos, Execução Imediata, Escopo Privado e base preparada para SPA

### Parâmetros
#### `data`
Objeto de configuração da chamada.

#### `attribute`
Atributos auxiliares processados internamente.

### Retorno
Retorna a resposta processada conforme o modo de execução:
```javascript
{
  perm: 1/0,
  isJson: true/false,
  ok: true/false,
  status: 200,
  data: [...]/null,
  html: null,
  error: null
}
```

### Exemplo
#### Configuração mínima em HTML
```html
<button
    data-zld-url: '/rota/exemplo',
    data-zld-destiny-id: 'resultado',
    data-zld-catch-group-id: 'formCadastro',
    type="button"
    class="btn btn-primary">
    Enviar
</button>
```

#### Configuração mínima em JavaScript
```js
const response = oziLoadData({
    zldUrl: '/rota/exemplo',
    zldDestinyId: 'resultado',
    zldCatchGroupId: 'formCadastro',
});
```
`
```


#### Exemplo de uso com Bootstrap 4/5

````javascript
oziConf({
    zldResponseValidClass: 'is-valid',
    zldResponseInvalidClass: 'is-invalid',
    
    zldButtonDisabledClass: 'zld-disabled',
    zldButtonEnabledClass: '',
    
    zldAlertClass: 'alert',
    zldAlertWarningClass: 'alert alert-warning',
    zldAlertDangerClass: 'alert alert-danger',
    zldAlertMetaClass: 'small text-muted',
    
    zldProgressClass: 'progress',
    zldProgressBarClass: 'progress-bar',
    zldProgressLoadingClass: 'progress-bar progress-bar-striped bg-warning',
    zldProgressSuccessClass: 'progress-bar bg-success'
});
````

### Exemplo de uso com Tailwind
````javascript
oziConf({
    zldResponseValidClass: 'border-green-500 ring-1 ring-green-500',
    zldResponseInvalidClass: 'border-red-500 ring-1 ring-red-500',
    
    zldButtonDisabledClass: 'zld-disabled',
    zldButtonEnabledClass: '',
    
    zldAlertClass: 'rounded-lg px-3 py-2 text-sm',
    zldAlertWarningClass: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    zldAlertDangerClass: 'bg-red-100 text-red-800 border border-red-300',
    zldAlertMetaClass: 'mt-1 text-xs opacity-70',
    
    zldProgressClass: 'w-full rounded-full overflow-hidden bg-slate-200',
    zldProgressBarClass: 'h-2 transition-all duration-300',
    zldProgressLoadingClass: 'h-2 bg-yellow-500',
    zldProgressSuccessClass: 'h-2 bg-green-600'
});

````