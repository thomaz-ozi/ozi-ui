# ozi-password-rules.js

**Versão:** 1.0.0  
**Camada:** `modules/`  
**Dependências:** `ozi-core.js` (OZI.conf.plugins.auth — opcional)  
**Expõe:** `OZI.modules.passwordRules`, `window.oziPasswordRules`  
**Consumido por:** `ozi-auth.js` (component)

---

## Descrição

Motor puro de validação de regras de senha.  
Função pura extraída do `oziAuth v2.2.4` — sem DOM, sem estado, sem jQuery.

Segue conformidade **NIST SP 800-63B**:
- Default `passMin: 12` (era 8 hardcoded na v0.x)
- Default `passMax: 64` (era 14 hardcoded na v0.x)

---

## API pública

### `OZI.modules.passwordRules(params)`

Função pura. Recebe dados, retorna resultado com 11 booleans.

```js
var result = OZI.modules.passwordRules({
    user:     'joao.silva',
    mail:     'joao@empresa.com',
    password: 'Senha@2024!Segura',
    confirm:  'Senha@2024!Segura'
});

console.log(result.access);       // true — todos passaram
console.log(result.passLength);   // true
console.log(result.passNoEmailParts); // true — senha não contém 'joao', 'empresa'
```

**Parâmetros:**

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `user` | string | `''` | Username para validar |
| `mail` | string | `''` | Email para validar |
| `password` | string | `''` | Senha a validar |
| `confirm` | string | `''` | Confirmação da senha |
| `userCaracter` | number | `conf.auth.userCaracter` ou `4` | Mínimo de chars do usuário |
| `passMin` | number | `conf.auth.passMin` ou `12` | Mínimo de chars da senha |
| `passMax` | number | `conf.auth.passMax` ou `64` | Máximo de chars da senha |

**Retorno:**

| Chave | Tipo | Regra |
|---|---|---|
| `userValid` | boolean | `user.length >= userCaracter` |
| `mailValid` | boolean | Formato de email válido |
| `passLength` | boolean | `passMin <= password.length <= passMax` |
| `passLowercase` | boolean | Mínimo 1 letra minúscula `[a-z]` |
| `passUppercase` | boolean | Mínimo 1 letra maiúscula `[A-Z]` |
| `passNumber` | boolean | Mínimo 1 dígito `[0-9]` |
| `passSpecial` | boolean | Mínimo 1 caractere especial |
| `passNoSpace` | boolean | Sem espaços |
| `passNoEmailParts` | boolean | Senha não contém partes do email (≥3 chars) |
| `passConfirm` | boolean | `confirm === password` e não vazio |
| `access` | boolean | AND de todas as regras |
| `passMin` | number | Valor usado (meta) |
| `passMax` | number | Valor usado (meta) |
| `userCaracter` | number | Valor usado (meta) |

---

### `OZI.modules.passwordRules.rulesList(params?, result?)`

Retorna definição das regras para renderização de UI.  
Facilita `oziAuth` gerar lista/dropdown de feedback visual.

```js
var result = OZI.modules.passwordRules({
    password: 'Abc123',
    confirm:  'Abc123'
});

var rules = OZI.modules.passwordRules.rulesList({}, result);
// [
//   { key: 'passLength',    label: 'Entre 12 e 64 caracteres',        valid: false },
//   { key: 'passUppercase', label: 'Pelo menos uma letra maiúscula',  valid: true  },
//   { key: 'passLowercase', label: 'Pelo menos uma letra minúscula',  valid: true  },
//   { key: 'passNumber',    label: 'Pelo menos um número',            valid: true  },
//   { key: 'passSpecial',   label: 'Pelo menos um caractere especial', valid: false },
//   { key: 'passNoSpace',   label: 'Sem espaços',                     valid: true  },
//   { key: 'passNoEmailParts', label: 'Senha não pode conter partes...', valid: true },
//   { key: 'passConfirm',   label: 'Senhas coincidem',                valid: true  }
// ]
```

Labels usam `OZI.lang.t()` se disponível, com fallback em português.

---

## Regras de senha — detalhes

### `passNoEmailParts`

Verifica se a senha contém partes do email com 3+ caracteres.

```
mail     = 'joao@empresa.com'
partes   = ['joao', 'empresa'] ('com' < 3 chars é ignorado)
password = 'MinhaEmpresa2024'
→ passNoEmailParts = false  (contém 'empresa')

password = 'Xy!7Qz@2024$'
→ passNoEmailParts = true
```

### `passSpecial` — caracteres aceitos

```
! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \ | , . < > / ? ` ~
```

---

## Configuração global

```js
oziConf({
    plugins: {
        auth: {
            passMin:      12,   // NIST default
            passMax:      64,   // NIST default
            userCaracter: 4     // mínimo de chars do username
        }
    }
});
```

Parâmetros passados diretamente à função têm precedência sobre a conf global.

---

## Uso pelo oziAuth (component)

```js
// dentro de oziAuth ao avaliar o form:
var result = OZI.modules.passwordRules({
    user:         $user.val(),
    mail:         $mail.val(),
    password:     $pass.val(),
    confirm:      $confirm.val(),
    userCaracter: parseInt($form.attr('data-ozi-auth-user-caracter') || '4'),
    passMin:      parseInt($form.attr('data-ozi-auth-pass-min') || '12'),
    passMax:      parseInt($form.attr('data-ozi-auth-pass-max') || '64')
});

// habilita/desabilita submit
$submit.prop('disabled', !result.access);

// atualiza lista de regras
var rules = OZI.modules.passwordRules.rulesList({
    passMin: result.passMin,
    passMax: result.passMax
}, result);

rules.forEach(function (rule) {
    $('[data-rule="' + rule.key + '"]')
        .toggleClass('valid',   !!rule.valid)
        .toggleClass('invalid', !rule.valid);
});
```

---

## Uso independente (sem oziAuth)

```js
// validação em qualquer form customizado
$('#form-senha').on('submit', function (e) {
    var result = OZI.modules.passwordRules({
        mail:     $('#email').val(),
        password: $('#senha').val(),
        confirm:  $('#confirmar').val()
    });

    if (!result.access) {
        e.preventDefault();
        // mostrar feedback...
    }
});
```

---

## Comparação v0.x → v1.0.0

| v0.x (oziAuth v2.2.4) | v1.0.0 |
|---|---|
| `passMin` hardcoded = 8 | Configurável, default NIST = 12 |
| `passMax` hardcoded = 14 | Configurável, default NIST = 64 |
| Motor acoplado ao DOM do oziAuth | Função pura isolada |
| Sem `rulesList()` | `rulesList()` facilita render de UI |
| Sem exposição independente | `OZI.modules.passwordRules` + `window.oziPasswordRules` |

---

## CHANGELOG

### [1.0.0] — 2025

- `OZI.modules.passwordRules(params)` — função pura com 11 booleans de retorno
- `OZI.modules.passwordRules.rulesList(params?, result?)` — definição das regras para UI
- `passMin` e `passMax` parametrizáveis (dívida #12 resolvida)
- Default NIST SP 800-63B: passMin=12, passMax=64
- Lê defaults de `OZI.conf.plugins.auth` — sobrescritível por parâmetro
- Labels via `OZI.lang.t()` com fallback em português
- Meta incluída no retorno: `passMin`, `passMax`, `userCaracter`
- `window.oziPasswordRules` para uso fora do namespace OZI

**Baseado em:** `oziAuth(data)` do `oziAuth v2.2.4` — motor extraído e isolado.  
**Regras preservadas:** todas as 11 (userValid, mailValid, passLength, passLowercase, passUppercase, passNumber, passSpecial, passNoSpace, passNoEmailParts, passConfirm, access).
