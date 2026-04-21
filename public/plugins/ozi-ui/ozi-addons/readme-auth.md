# oziAuth

## Identificação

- **Nome:** `oziAuth`
- **Versão:** `2.0.0`
- **Data:** `2026-04-14`

### 🔑 Estrutura da função
A função `oziAuth` recebe um objeto com os dados:
- **user** → nome do usuário.
- **mail** → e-mail de acesso.
- **password** → senha digitada.
- **confirm** → confirmação da senha.
- **userCaracter** → mínimo de caracteres para o nome de usuário (opcional).

### Atributos
- `data-ozi-auth-mail` → Autentica o e-mail
- `data-ozi-auth-pass="icon,icon"` → Autentica e campos para colocar dois icons
- `data-ozi-auth-confirm="icon,icon"` → Confirma  e campos para colocar dois icons
- `data-ozi-auth-submit` → Botão de autenticação fica ativo/inativo
- `data-ozi-auth-list-id="ID"` → Gera a lista de check no `id` indicado
- `data-ozi-auth-dropdown"` → indica que você quer tambem o menu(dropdown)

### ⚙️ O que ela valida
1. **Usuário**
    - Verifica se o nome do usuário tem o número mínimo de caracteres.

2. **E-mail**
    - Checa se o e-mail é válido (formato `nome@dominio.com`).
    - Garante que a senha não contenha partes do e-mail (prefixo, sufixo ou domínio).

3. **Senha**
    - Comprimento: entre 8 e 14 caracteres.
    - Pelo menos uma letra minúscula.
    - Pelo menos uma letra maiúscula.
    - Pelo menos um número.
    - Pelo menos um caractere especial.
    - Não pode conter espaços ou tabulações.
    - Não pode começar com letra maiúscula.

4. **Confirmação**
    - Verifica se o campo `confirm` é igual ao campo `password`.

### 📦 O que ela retorna
Um objeto com os resultados de cada regra, por exemplo:
```javascript
{
  userValid: true/false,
  mailValid: true/false,
  passLength: true/false,
  passLowercase: true/false,
  passUppercase: true/false,
  passNumber: true/false,
  passSpecial: true/false,
  passNoSpace: true/false,
  passNoEmailParts: true/false,
  passConfirm: true/false,
  access: true/false // resultado final
}
```

### 🚀 Resultado final
- Se todas as regras forem atendidas, `access = true` → o usuário está autenticado.
- Se alguma regra falhar, `access = false` → bloqueia o acesso e mostra feedback.

---

Ou seja, a função **oziAuth** é um **motor de autenticação**: ela concentra todas as regras de senha, e-mail e confirmação, e devolve um objeto claro para o front-end aplicar feedback visual e decidir se libera o botão de salvar.

Quer que eu monte um **fluxo visual (diagrama)** mostrando como os dados entram no `oziAuth`, passam pelas validações e resultam no `access` final? Isso pode ajudar a documentar no seu site **oziui.com**.


Regras de comportamento
1. Se tiver só data-ozi-auth-submit

Mostra dropdown por padrão.

2. Se tiver data-ozi-auth-list-id

Usa a lista naquele container.

3. Se tiver data-ozi-auth-dropdown

Usa dropdown.

4. Se tiver os dois

Usa lista + dropdown.