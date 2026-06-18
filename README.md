# ozi-ui

> **"The dev configures via HTML — OZI-UI executes."**

A jQuery-based front-end plugin library built for Laravel projects, with native support for Livewire 3 and 4. Born from 14+ years of real-world development needs, ozi-ui eliminates repetitive JavaScript by letting developers declare behavior directly in HTML.

---

## Why ozi-ui?

Started in 2012 as a simple AJAX helper to reduce boilerplate around `$.ajax`. Over the years, as new projects introduced new friction points — form clearing, busy states, group controls, visual selects, toggles — the library grew organically into a full plugin ecosystem.

The guiding principle has always been the same:

> *"Simplicidade acima de tudo — se precisar de JS, algo está errado."*
> *(Simplicity above all — if you need to write JS, something is wrong.)*

---

## Features

- Pure IIFE — no build step required
- Load via CDN, direct `<script>` include, or Composer
- Optional Vite / Webpack integration
- Native Laravel Service Provider (auto-discovery)
- Native Livewire 3 & 4 support (`afterRender` hooks, `wire:` compatibility)
- Declarative `data-ozi-*` attributes — zero custom JS for standard tasks
- Multi-theme: `default`, `bootstrap5`, `tailwind`
- Multilingual: `en`, `pt-BR`, `es`
- MIT licensed

---

## Plugins

| Plugin | Category | Description |
|---|---|---|
| `ozi-loaddata` | Module | AJAX data loading with progress and validation |
| `ozi-select` | Component | Custom select with search, images, and async options |
| `ozi-autocomplete` | Component | Autocomplete input with remote data support |
| `ozi-check` | Component | Styled checkbox / radio group controls |
| `ozi-toggle` | Behavior | Toggle visibility and state via `data-ozi-*` |
| `ozi-copy` | Behavior | One-click copy to clipboard |
| `ozi-paste` | Behavior | Controlled paste with format handling |
| `ozi-editor` | Component | Rich text / Markdown editor |
| `ozi-auth` | Component | Authentication UI components |
| `ozi-search` | Component | Search input with live filtering |
| `ozi-audio` | Component | Audio recording and playback |
| `ozi-validate` | Module | Client-side form validation |

---

## Installation

### Via Composer (Laravel)

```bash
composer require ozi-ui/core
```

Publishes assets automatically via Laravel auto-discovery. Requires PHP `^8.2` and Laravel `10|11|12|13`.

### Direct include

```html
<script src="./plugins/ozi-ui/ozi.js"></script>
```

### With configuration (optional, always after the script tag)

```html
<script src="./plugins/ozi-ui/ozi.js"></script>
<script>
    oziConf({
        lang: 'pt-BR',
        theme: 'bootstrap5'
    });
</script>
```

---

## Requirements

- jQuery `3.7+`
- PHP `^8.2`
- Laravel `10 | 11 | 12 | 13`
- Livewire `3 | 4` *(optional)*

---

## Documentation

Full documentation at **[oziui.com/docs](https://oziui.com/pt-br/docs/introduction)**

---

## License

MIT — free to use, modify, and distribute.

© 2012–2026 [oziui.com](https://oziui.com)
