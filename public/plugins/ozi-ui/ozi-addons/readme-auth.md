# oziAuth

### Identificação
- **Nome:** `oziAuth`
- **Versão:** `2.2.4`
- **Data:** `2026-04-25`

---

### Descrição
`oziAuth` é um plugin de validação de formulários de autenticação. Concentra as regras de senha, e-mail e confirmação em um motor isolado — `oziAuth()` — e aplica feedback visual em tempo real nos campos, lista de regras e botão de envio, orientando o usuário a seguir a ordem correta de preenchimento.

---

### [1] ATRIBUTOS

| Atributo | Descrição |
|----------|-----------|
| `data-ozi-auth-mail` | Campo de e-mail — valida formato e bloqueia partes do e-mail na senha |
| `data-ozi-auth-pass="iconShow,iconHide"` | Campo de senha — ativa toggle show/hide com os ícones informados |
| `data-ozi-auth-confirm="iconShow,iconHide"` | Campo de confirmação de senha — ativa toggle show/hide |
| `data-ozi-auth-user` | Campo de usuário — valida comprimento mínimo |
| `data-ozi-auth-user-caracter` | Mínimo de caracteres para o campo usuário |
| `data-ozi-auth-submit` | Botão de envio — ativado/desativado conforme validação |
| `data-ozi-auth-list-id="id"` | ID do container onde a lista de regras será renderizada |
| `data-ozi-auth-dropdown` | Ativa dropdown de regras nos campos de senha e confirmação |
| `data-ozi-auth-class="classes"` | Substitui a classe padrão `ozi-auth-btn-toggle` no botão show/hide |
| `data-ozi-auth-check="iconInvalid,iconValid"` | Ícones customizados para os estados de regra — aplicados na lista, dropdown e botão |

#### Exemplo:
```html
<input
    type="email"
    name="email"
    data-ozi-auth-mail
    class="form-control"
    placeholder="E-mail">

<input
    type="password"
    name="senha"
    data-ozi-auth-pass="bi bi-eye-slash,bi bi-eye"
    class="form-control"
    placeholder="Senha">

<input
    type="password"
    name="confirma"
    data-ozi-auth-confirm="bi bi-eye-slash,bi bi-eye"
    class="form-control"
    placeholder="Confirmar senha">

<button
    type="submit"
    data-ozi-auth-submit
    data-ozi-auth-list-id="regrasSenha"
    data-ozi-auth-check="bi bi-circle,bi bi-check2-circle"
    class="btn btn-secondary"
    disabled>
    Salvar
</button>

<div id="regrasSenha"></div>
```

---

### [2] REGRAS DE COMPORTAMENTO — LISTA E DROPDOWN

| Configuração | Comportamento |
|-------------|--------------|
| Só `data-ozi-auth-submit` | Exibe dropdown por padrão |
| Só `data-ozi-auth-list-id` | Exibe lista no container indicado |
| Só `data-ozi-auth-dropdown` | Exibe dropdown |
| `data-ozi-auth-list-id` + `data-ozi-auth-dropdown` | Exibe lista + dropdown simultaneamente |

---

### [3] MOTOR DE VALIDAÇÃO — `oziAuth(data)`

Função pura e isolada. Recebe um objeto com os dados do formulário e retorna o resultado de cada regra.

#### Entrada:
| Campo | Descrição |
|-------|-----------|
| `user` | Nome do usuário |
| `mail` | E-mail de acesso |
| `password` | Senha digitada |
| `confirm` | Confirmação da senha |
| `userCaracter` | Mínimo de caracteres para o usuário (opcional) |

#### Retorno:
```js
{
    userValid: true/false,       // usuário tem o mínimo de caracteres
    mailValid: true/false,       // e-mail válido
    passLength: true/false,      // entre 8 e 14 caracteres
    passLowercase: true/false,   // mínimo 1 letra minúscula
    passUppercase: true/false,   // mínimo 1 letra maiúscula
    passNumber: true/false,      // mínimo 1 número
    passSpecial: true/false,     // mínimo 1 caractere especial
    passNoSpace: true/false,     // sem espaços
    passNoEmailParts: true/false,// senha não contém partes do e-mail
    passConfirm: true/false,     // senha === confirmação
    access: true/false           // resultado final — todas as regras atendidas
}
```

#### Uso isolado:
```js
const result = oziAuth({
    mail: 'user@email.com',
    password: 'Senha@123',
    confirm: 'Senha@123'
});

if (result.access) {
    // libera envio
}
```

---

### [4] VALIDAÇÕES APLICADAS

**Usuário**
- Comprimento mínimo definido por `data-ozi-auth-user-caracter`

**E-mail**
- Formato `nome@dominio.com`

**Senha**
- Entre 8 e 14 caracteres — badge de contagem em tempo real
- Mínimo 1 letra minúscula
- Mínimo 1 letra maiúscula
- Mínimo 1 número
- Mínimo 1 caractere especial
- Sem espaços
- Não pode conter partes do e-mail (prefixo, domínio ou fragmentos)

**Confirmação**
- Deve ser idêntica à senha

**UX — ordem de preenchimento**
- Ao digitar a senha, o campo e-mail é validado automaticamente mesmo sem ter sido tocado — orienta o usuário a preencher na ordem correta: e-mail → senha → confirmação → enviar

---

### [5] BADGE DE CONTAGEM

A regra `passLength` exibe um badge em tempo real junto ao texto da regra:

| Estado | Exibição |
|--------|----------|
| Sem digitação | `0/14` |
| Dentro do limite | `6/14 · faltam 2` |
| Limite atingido | `8/14` |
| Limite excedido | `15/14 · excedido` |

---

### [6] API PÚBLICA

```js
window.oziAuth(data)              // motor de validação isolado
window.oziAuthInit($scope)        // inicializa em um escopo
window.oziAuthInitFetched(root)   // reinicializa após render dinâmico
```

#### Evento manual para conteúdo dinâmico:
```js
$(document).trigger('oziAuth:initFetched', [rootElement]);
```