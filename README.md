# ozi-ui

> **"The dev configures via HTML — OZI-UI executes."**

A **dependency-free** front-end plugin library built for Laravel projects, with native support for Livewire 3 and 4. Born from 14+ years of real-world development needs, ozi-ui eliminates repetitive JavaScript by letting developers declare behavior directly in HTML.

---

## Why ozi-ui?

Started in 2012 as a simple AJAX helper to reduce boilerplate around `$.ajax`. Over the years, as new projects introduced new friction points — form clearing, busy states, group controls, visual selects, toggles — the library grew organically into a full plugin ecosystem.

**Version 2 (2026) dropped jQuery entirely.** Components, modules, behaviors and the core are plain JavaScript with zero third-party dependencies: frameworks live only in `integrations/`, visuals only in `themes/`. A compatibility ramp for v1 (jQuery shims, `zld*` aliases) ships with the `2.x` line and is opt-in — see the migration guide. Upgrading from v1? `composer require ozi-ui/core:^2.0`.

The guiding principle has always been the same:

> *"Simplicidade acima de tudo — se precisar de JS, algo está errado."*
> *(Simplicity above all — if you need to write JS, something is wrong.)*

---

## Features

- Zero third-party dependencies — no jQuery, no runtime deps
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
| `ozi-editor` | Component | Rich text / Markdown editor |
| `ozi-auth` | Component | Authentication UI components |
| `ozi-search` | Component | Search input with live filtering |
| `ozi-audio` | Component | Audio recording and playback |
| `ozi-validate` | Module | Client-side form validation |
| `ozi-actions` | Module | Declarative backend-driven actions |
| `ozi-suggest` | Module | Shared search engine (select + autocomplete) |
| `ozi-password-rules` | Module | Password policy evaluation (DOM-free) |
| `ozi-editor-sanitize` | Module | HTML sanitizer engine used by `ozi-editor` |

> `ozi-copy` and `ozi-paste` were **discontinued in 2.0.0** (measured zero usage). They remain
> installable from the `v1-final` / `v1.0.7` tags.

---

## Installation

### Via Composer (Laravel)

```bash
composer require ozi-ui/core
```

Registers itself via Laravel auto-discovery. Assets are served **straight from the package** by a
fallback route, so `composer require` alone is enough — no `vendor:publish` step to get started.

```bash
# optional: copy assets into public/ so the webserver serves them (production optimization)
php artisan vendor:publish --tag=ozi-ui
```

Requires PHP `^8.2` and Laravel `10|11|12|13`.

### Blade directives (Laravel)

```blade
{{-- all plugins --}}
@oziStyles
@oziScripts

{{-- or pick what the page needs --}}
@oziStyles(['select', 'editor'])
@oziScripts(['select', 'editor', 'livewire'])
```

Besides individual plugin keys, the following **groups** are accepted: `auth`, `forms`,
`livewire`, `shims-v1` and `full` (everything).

**Dependencies are resolved for you.** Since `2.6.0`, `@oziScripts` reads the `deps:` declared in
the `_pluginMap` and completes the list — `@oziScripts(['editor'])` also emits `ozi-validate` and
`ozi-editor-sanitize`, which the editor requires at runtime. Tags are emitted in the canonical
load order (the same one the `ozi-loader` uses at boot), **not** in the order you typed the keys,
so `['editor', 'editor-sanitize']` and `['editor-sanitize', 'editor']` produce identical output.

Run `php artisan ozi:check` to verify the installation: it validates the asset lists against the
`_pluginMap` (the single source of truth) and fails on any drift, including drift in `deps:`.

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

- No JavaScript runtime dependency *(jQuery is only needed by the opt-in v1 compatibility shims)*
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
