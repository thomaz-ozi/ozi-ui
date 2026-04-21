# oziCheck

## Identificação

* **Nome:** `oziCheck`
* **Versão:** `1.0.0`
* **Data:** `2026-04-16`

### Estrutura da função

O plugin `OziCheck` trabalha com grupos de checkboxes e usa três atributos principais:

* **enabled** → controla se o grupo está ativo
* **all** → marca ou desmarca todos os itens do grupo
* **item** → representa os itens individuais do grupo

O grupo é identificado pelo valor do atributo, por exemplo: `grupo1`. O plugin também expõe métodos públicos como `init`, `refresh`, `setGroupEnabledState`, `setAllItems` e `syncGroup`.

### Atributos

* `data-ozi-check-enabled="grupo"` → checkbox que ativa ou desativa o grupo
* `data-ozi-check-all="grupo"` → checkbox que marca ou desmarca todos os itens
* `data-ozi-check-item="grupo"` → checkboxes individuais do grupo

### Exemplo HTML

```html
<input type="checkbox" data-ozi-check-enabled="grupo1"> Ativar grupo
<input type="checkbox" data-ozi-check-all="grupo1"> Marcar todos

<input type="checkbox" name="marcas[]" value="ford" data-ozi-check-item="grupo1"> Ford
<input type="checkbox" name="marcas[]" value="honda" data-ozi-check-item="grupo1"> Honda
<input type="checkbox" name="marcas[]" value="toyota" data-ozi-check-item="grupo1"> Toyota
```

### O que ele faz

1. **Grupo ativo ou inativo**

    * Se `data-ozi-check-enabled` estiver desligado:

        * `data-ozi-check-all` fica desabilitado
        * `data-ozi-check-item` ficam desabilitados
        * todos os itens são desmarcados
    * Se `data-ozi-check-enabled` estiver ligado:

        * `data-ozi-check-all` fica habilitado
        * `data-ozi-check-item` ficam habilitados

2. **Marcar todos**

    * Ao marcar `data-ozi-check-all`, todos os `data-ozi-check-item` do grupo são marcados
    * Ao desmarcar `data-ozi-check-all`, todos os `data-ozi-check-item` do grupo são desmarcados

3. **Sincronização dos itens**

    * Se todos os itens estiverem marcados, `data-ozi-check-all` fica marcado
    * Se nenhum item estiver marcado, `data-ozi-check-all` fica desmarcado
    * Se apenas parte dos itens estiver marcada, `data-ozi-check-all` fica com `indeterminate = true`

### Inicialização automática

O plugin inicia automaticamente no carregamento normal da página com:

```javascript
$(document).ready(function () {
    OziCheck.init(document);
});
```

Ou seja, em páginas carregadas normalmente, não precisa chamar nada manualmente.

### Métodos públicos

```javascript
OziCheck.init(scope)
OziCheck.refresh(scope)
OziCheck.setGroupEnabledState(group, enabled, scope)
OziCheck.setAllItems(group, checked, scope)
OziCheck.syncGroup(group, scope)
```

### Exemplos de uso manual

#### Recarregar todos os grupos

```javascript
OziCheck.refresh(document);
```

#### Recarregar apenas uma área

```javascript
OziCheck.refresh($('#destino')[0]);
```

#### Habilitar um grupo

```javascript
OziCheck.setGroupEnabledState('grupo1', true, document);
```

#### Desabilitar um grupo

```javascript
OziCheck.setGroupEnabledState('grupo1', false, document);
```

#### Marcar todos

```javascript
OziCheck.setAllItems('grupo1', true, document);
```

#### Desmarcar todos

```javascript
OziCheck.setAllItems('grupo1', false, document);
```

#### Sincronizar manualmente um grupo

```javascript
OziCheck.syncGroup('grupo1', document);
```

### Uso com fetch ou ZLD

Na versão ajustada para conteúdo carregado por fetch, o ideal é reprocessar o trecho novo depois que ele entrar no DOM.

#### Uso manual após inserir HTML

```javascript
$('#destino').html(html);
window.oziCheckInitFetched($('#destino'));
```

#### Uso por evento

```javascript
$('#destino').html(html);
$(document).trigger('oziCheck:initFetched', [$('#destino')]);
```

#### Fluxo com ZLD

1. o ZLD renderiza o HTML no destino
2. o `afterRender` é executado
3. `oziCheckInitFetched(root)` roda no conteúdo novo
4. os grupos entram com estado correto de `disabled`, `checked` e `indeterminate`

### Resultado final

* O grupo fica consistente visual e funcionalmente
* O checkbox “todos” sempre reflete o estado real dos itens
* O plugin pode ser usado tanto em carregamento normal quanto em conteúdo dinâmico via fetch/ZLD

---