# Criando um tema custom no OZI-UI (v2)

> **Princípio da v2:** tema = **dados** (variáveis CSS + classMap), nunca código.
> O mesmo build JS serve qualquer tema — você só troca CSS e `oziConf({ theme })`.

## Estrutura (copie esta pasta para `themes/meu-tema/`)

```
themes/meu-tema/
├── tokens.css      ← variáveis --ozi-* do seu design (fonte de valores)
├── overrides.css   ← estilos dos componentes OZI no seu visual
├── dark.css        ← remapeamento de tokens no dark (opcional)
└── classmap.js     ← tokens semânticos → classes do seu framework
```

## Como incluir na página

```html
<!-- no <head>, na ordem: framework → tokens → overrides → dark -->
<link rel="stylesheet" href="/plugins/ozi-ui/themes/meu-tema/tokens.css">
<link rel="stylesheet" href="/plugins/ozi-ui/themes/meu-tema/overrides.css">
<link rel="stylesheet" href="/plugins/ozi-ui/themes/meu-tema/dark.css">

<script src="/plugins/ozi-ui/ozi.js"></script>
<script>oziConf({ theme: 'custom', classMap: { /* … */ } });</script>
<!-- (ou) --> <script src="/plugins/ozi-ui/themes/meu-tema/classmap.js"></script>
```

`theme: 'custom'` não carrega nenhum preset embutido — o seu `classMap` vale.
Use `theme: 'default' | 'bootstrap5' | 'tailwind'` para partir de um preset.

## Regras

- **Só tokens, nunca hardcode** em `overrides.css` — assim o `dark.css` funciona sozinho.
- **Herança:** qualquer token que você não declarar herda de `themes/default/tokens.css`.
  Declare só o que diferencia o seu tema (mínimo: `--ozi-color-primary` e `--ozi-color-danger`).
- **classMap:** só é preciso mapear os tokens que os seus componentes usam.
  Referência de tokens e uso por plugin: `ozi-ui-docs/dev/_meta/classMap-tokens.md`.
- **dark.css:** mantenha os dois blocos (`[data-ozi-theme="dark"]` e
  `@media (prefers-color-scheme: dark)`) com os mesmos remapeamentos.

## Referências prontas

- `themes/default/`   — base agnóstica (tokens de fallback + overrides base).
- `themes/bootstrap5/` — integra com BS5 (`.form-control`, `data-bs-theme`).
- `themes/tailwind/`   — look de input Tailwind (`focus:ring`, `darkMode`).
