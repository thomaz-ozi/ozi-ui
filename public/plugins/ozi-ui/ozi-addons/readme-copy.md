# oziCopy

## Identificação

- **Nome:** `oziCopy`
- **Versão:** `2.0.0`
- **Data:** `2026-04-12`

## Descrição

O que essa versão já garante
* cópia por valor direto
* cópia por referência de conteúdo
* retorno visual de sucesso
* retorno visual de erro
* navigator.clipboard
* fallback com execCommand('copy')

## Atributos

data-ozi-copy-value
data-ozi-copy
data-ozi-copy-content


## Regras


## Fluxo de ação



### Exemplo 1, valor direto
````html
<div   data-ozi-copy-value="ABCDE-12345-FGHIJ">
    Copiar código
</div>

```

### Exemplo 2, trigger + content
````html
<div data-ozi-copy="codigoA">
    Copiar código
</div>

<div data-ozi-copy-content="codigoA">
    ABCDE-12345-FGHIJ
</div>

```


