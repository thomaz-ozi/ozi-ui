# ozi-ui — Instalação, Atualização e Remoção

> Versão atual: `v0.10.0-alpha` | Pacote: `ozi-ui/core`

---

## Requisitos

- PHP `^8.2`
- Laravel `^10.0 | ^11.0 | ^12.0`
- jQuery (carregado antes dos plugins)

---

## Instalação

**1. Instalar via Composer:**

```bash
composer require ozi-ui/core
```

**2. Publicar os assets:**

```bash
php artisan vendor:publish --tag=ozi-ui
```

**3. Verificar a instalação:**

```bash
php artisan ozi:check
```

**4. Adicionar no layout Blade:**

```blade
{{-- CSS --}}
@oziStyles

{{-- JS --}}
@oziScripts
```

---

## Atualização

### Atualizar para a versão mais recente

```bash
composer update ozi-ui/core
```

```bash
php artisan vendor:publish --tag=ozi-ui --force
```

### Atualizar para uma versão específica

```bash
composer require ozi-ui/core:v0.10.0-alpha
```

```bash
php artisan vendor:publish --tag=ozi-ui --force
```

### Atualizar apenas um plugin específico

```bash
php artisan vendor:publish --tag=ozi-ui-select --force
```

#### Tags disponíveis por plugin

| Tag | O que publica |
|---|---|
| `ozi-ui` | todos os assets |
| `ozi-ui-loaddata` | oziLoadData |
| `ozi-ui-select` | oziSelect |
| `ozi-ui-autocomplete` | oziAutocomplete |
| `ozi-ui-search` | oziSearch |
| `ozi-ui-editor` | oziEditor |
| `ozi-ui-audio` | oziAudio |
| `ozi-ui-addons` | oziAddons + oziAuth + oziCheck + oziCopy + oziToggle |
| `ozi-ui-config` | `config/ozi-ui.php` |

---

## Verificação

```bash
php artisan ozi:check
```

Saída esperada quando tudo está correto:

```
ozi-ui — Verificação do ecossistema

  ✔ oziCore             v0.10.0-alpha   OK
  ✔ oziLoadData         v3.9.4          OK
  ✔ oziSelect           v4.3.1          OK
  ✔ oziAutocomplete     v1.0.0          OK
  ✔ oziSearch           v1.5            OK
  ✔ oziEditor           v1.4.1          OK
  ✔ oziAudio            v1.2.0          OK
  ✔ oziToggle           v2.3.0          OK
  ✔ oziCopy             v2.0.0          OK
  ✔ oziCheck            v1.0.0          OK
  ✔ oziAuth             v2.0.0          OK
  ✔ oziAddons           v1.0.0          OK

  ✔ config/ozi-ui.php   OK

  ✔ Tudo certo! ozi-ui está instalado e configurado corretamente.
```

Se algum item aparecer como `Não publicado`, rode:

```bash
php artisan vendor:publish --tag=ozi-ui --force
```

---

## Remoção

**1. Remover o pacote:**

```bash
composer remove ozi-ui/core
```

**2. Remover os assets publicados:**

```bash
rm -rf public/plugins/ozi-ui
```

**3. Remover o config:**

```bash
rm config/ozi-ui.php
```

---

## Git — fluxo de atualização de versão (para mantenedores)

```bash
# 1. commit das alterações
git add .
git commit -m "feat: descrição da alteração"
git push

# 2. remove a tag antiga no remoto (se existir)
git push origin --delete v0.10.0-alpha

# 3. remove a tag antiga local
git tag -d v0.10.0-alpha

# 4. recria a tag local
git tag v0.10.0-alpha

# 5. envia a tag
git push origin v0.10.0-alpha
```

> **Atenção:** use sempre `git push origin {tag}` para enviar a tag — não use `--tags` junto com o branch para evitar conflitos de nome.