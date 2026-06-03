# ozi-editor.js

**Versão:** 1.0.0  
**Camada:** `components/ozi-editor/`  
**Dependências:** `ozi-core.js` (OZI.helpers, OZI.lang, OZI.hooks), `ozi-validate.js`  
**Expõe:** `OZI.components.editor`, `window.OziEditor` (compat)  
**Eventos:** `ozi:change`

---

## Descrição

Editor WYSIWYG sobre `<textarea>`. Toolbar configurável via string declarativa.  
Suporta modo source (edição de HTML bruto) e sanitização de HTML colado.  
Baseado em `oziEditor v1.5.1`.

---

## Atributos HTML

### [1] Identificação
| Atributo | Tipo | Descrição |
|---|---|---|
| `data-ozi-editor` | string | Chave única — **obrigatório** (no `<textarea>`) |

### [2] Layout
| Atributo | Default | Descrição |
|---|---|---|
| `data-ozi-editor-tools` | `'bold,italic,underline; [ul,ol]; codeblock,source'` | Ferramentas da toolbar |
| `data-ozi-editor-height` | `'200px'` | Altura mínima da área de edição |
| `data-ozi-editor-placeholder` | `'Digite aqui...'` | Placeholder |
| `data-ozi-editor-uicolor` | `'var(--ozi-color-primary)'` | Cor de destaque da toolbar |

### [3] Estado
| Atributo | Tipo | Descrição |
|---|---|---|
| `data-ozi-editor-disabled` | boolean | Desabilitado |
| `data-ozi-editor-required` | boolean | Campo obrigatório |
| `data-ozi-editor-required-message` | string | Mensagem de validação |

---

## Sintaxe da toolbar

```
"bold,italic,underline; [ul,ol]; codeblock,source"
```

| Separador | Significado |
|---|---|
| `,` | Ferramentas na mesma linha |
| `;` | Nova linha na toolbar |
| `[x,y]` | Grupo visual (borda ao redor) |

**Ferramentas disponíveis:**

| Tool | Descrição |
|---|---|
| `bold` | Negrito |
| `italic` | Itálico |
| `underline` | Sublinhado |
| `ul` | Lista com marcadores |
| `ol` | Lista numerada |
| `codeblock` | Bloco de código (`<pre><code>`) |
| `source` | Toggle modo HTML bruto |
| `table` | Insere tabela 2×2 |
| `clear` | Remove formatação |
| `left` | Alinhar esquerda |
| `center` | Centralizar |
| `right` | Alinhar direita |

---

## HTML permitido

Allowlist de tags na sanitização — tudo fora é removido ou convertido:

| Tags permitidas | Tags convertidas | Tags removidas |
|---|---|---|
| `p, br, strong, em, u` | `div → p` | `script, style, iframe` |
| `ul, ol, li` | `b → strong` | `form, input, button` |
| `pre, code` | `i → em` | qualquer tag desconhecida |
| `table, tbody, thead, tr, td, th` | | |

Atributos: todos removidos exceto `style.textAlign` (left/center/right/justify).

---

## API pública

### Estática — `OZI.components.editor`

```js
OZI.components.editor.init(root?)
OZI.components.editor.get(key)
OZI.components.editor.getAll()
OZI.components.editor.destroy(key)
OZI.components.editor.reload(key)
OZI.components.editor.value(key)          // getter — retorna HTML sanitizado
OZI.components.editor.value(key, html)    // setter
OZI.components.editor.disable(key)
OZI.components.editor.enable(key)
```

### Por instância

```js
var inst = OZI.components.editor.get('descricao');
inst.getValue()          // HTML atual sanitizado
inst.setValue('<p>...</p>')  // define conteúdo
inst.isValid()           // boolean (verifica texto real, não só tags)
inst.validate(focus?)    // valida e aplica estado visual
inst.setState('valid' | 'invalid' | 'reset')
inst.emitChange()        // dispara ozi:change manualmente
```

---

## Eventos

| Evento | Payload | Quando |
|---|---|---|
| `ozi:change` | `{ value }` | Conteúdo alterado (input, paste, tool) |

```js
$('[data-ozi-editor="descricao"]').on('ozi:change', function (e, payload) {
    console.log('html:', payload.value);
});
```

---

## Exemplos

### Básico

```html
<textarea data-ozi-editor="descricao" name="descricao"></textarea>
```

### Toolbar customizada

```html
<textarea
    data-ozi-editor="conteudo"
    data-ozi-editor-tools="bold,italic; [ul,ol]; table,clear"
    data-ozi-editor-height="300px"
    data-ozi-editor-uicolor="var(--bs-primary)">
</textarea>
```

### Obrigatório

```html
<textarea
    data-ozi-editor="bio"
    data-ozi-editor-required="true"
    data-ozi-editor-required-message="Descrição é obrigatória">
</textarea>
<div class="invalid-feedback"></div>
```

---

## Modo source

O botão `source` alterna entre WYSIWYG e edição de HTML bruto.  
Ao sair do modo source, o HTML é sanitizado antes de renderizar no contenteditable.

---

## Validação

`isValid()` verifica se há texto real — não apenas tags vazias:

```js
// '<p><br></p>' → inválido (sem texto)
// '<p>Olá</p>' → válido
```

---

## Ícones

Carregados via `OZI.helpers.icon()` do diretório `components/ozi-editor/svg/`.  
Fallback: label do `_t()` caso o SVG não carregue.

---

## Comparação v0.x → v1.0.0

| v0.x | v1.0.0 |
|---|---|
| Sistema de ícones próprio (~80 linhas) | `OZI.helpers.icon()` |
| `LANGS` hardcoded (pt-br/en) | `OZI.lang.t('editor.*')` |
| Path de ícones hardcoded | `OZI.conf.core.urlBase` |
| `splitTopLevel` próprio | `OZI.helpers.splitTopLevel()` |
| MutationObserver próprio | `OZI.hooks.afterRender.register` |
| Sem adapter de validação | `OZI.modules.validate.registerAdapter` |
| `window.OziEditor` | `OZI.components.editor` + alias compat |
