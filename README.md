# ozi-ui

[![Latest Version](https://img.shields.io/packagist/v/ozi-ui/core.svg?label=packagist)](https://packagist.org/packages/ozi-ui/core)
[![Tests](https://github.com/thomaz-ozi/ozi-ui/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/thomaz-ozi/ozi-ui/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/packagist/dt/ozi-ui/core.svg)](https://packagist.org/packages/ozi-ui/core)
[![PHP](https://img.shields.io/packagist/php-v/ozi-ui/core.svg)](https://packagist.org/packages/ozi-ui/core)
[![License](https://img.shields.io/packagist/l/ozi-ui/core.svg)](LICENSE)

**UI components for Laravel and Livewire, configured in HTML.**
Selects, a rich-text editor, form validation, AJAX forms and more, declared with `data-ozi-*`
attributes. No JavaScript to write, no build step, no jQuery, and zero runtime dependencies.

<p align="center">
  <img src="https://raw.githubusercontent.com/thomaz-ozi/ozi-ui/master/.github/art/select.png" alt="ozi-select: single and grouped multiple select with search" width="760">
</p>

## Quick start

```bash
composer require ozi-ui/core
```

```blade
<head>
    @oziStyles(['select'])
    @oziScripts(['select'])
</head>

<div data-ozi-select="country" data-ozi-select-value-placeholder="Pick a country"></div>
<script type="application/json" data-ozi-select-options="country">
    [{"value": "br", "label": "Brazil"}, {"value": "ca", "label": "Canada"}]
</script>
```

That's it. The package registers itself through auto-discovery and serves its own assets through
a fallback route, so there is no `vendor:publish` and no `npm install`.

## With Livewire

Livewire 3 and 4 are supported natively. Wrap the component in `wire:ignore` and bind it with
`data-ozi-livewire-model`:

```blade
@oziScripts(['select', 'editor', 'livewire'])

<div wire:ignore>
    <div data-ozi-select="state"
         data-ozi-select-required="true"
         data-ozi-livewire-model="state"></div>
    <script type="application/json" data-ozi-select-options="state">@json($states)</script>
</div>

<div wire:ignore>
    <textarea data-ozi-editor-html="description"
              data-ozi-livewire-model="description">{{ $description }}</textarea>
</div>
```

Every component emits the same `ozi:change` event (`detail: { component, name, value, source }`),
and the Livewire adapter turns it into a model update. Validation with `ozi-validate` also blocks
`wire:submit` when the form is invalid, without any Livewire-specific code.

## Highlights

### ozi-select

Single, multiple and grouped selects with search, images, remote options and "create new" entries.

### ozi-editor

A rich-text (or Markdown) editor with a configurable toolbar: headings, lists, alignment, links,
colors, tables, images, source mode, undo/redo. Output is sanitized.

```html
<textarea data-ozi-editor-html="notes"
          data-ozi-editor-tools="[bold,italic,underline], heading, [ul,ol], [link,color], table, source"></textarea>
```

<p align="center">
  <img src="https://raw.githubusercontent.com/thomaz-ozi/ozi-ui/master/.github/art/editor.png" alt="ozi-editor with a full toolbar" width="760">
</p>

### ozi-validate

Client-side validation for native fields and ozi components. Put `data-ozi-validate` on the submit
button to block the submission (click or Enter) while the form is invalid.

```html
<form novalidate>
    <input name="email" type="email" data-ozi-required="true">
    <span class="ozi-feedback"></span>

    <button type="submit" data-ozi-validate>Create account</button>
</form>
```

<p align="center">
  <img src="https://raw.githubusercontent.com/thomaz-ozi/ozi-ui/master/.github/art/validate.png" alt="ozi-validate showing valid and invalid fields" width="760">
</p>

### ozi-loaddata

AJAX without JavaScript: collect fields, validate, send, and render the response.

```html
<div id="product-form">
    <input name="name" data-ozi-required="true">
</div>

<button data-zld-url="/products"
        data-zld-catch-group-id="product-form"
        data-zld-destiny-id="result"
        data-zld-form-busy="true">
    Save
</button>
<div id="result"></div>
```

## All plugins

**Components and behaviors you use directly**

| Plugin | What it does |
|---|---|
| `ozi-select` | Select with search, groups, images, remote options, creatable entries |
| `ozi-editor` | Rich-text / Markdown editor with a configurable toolbar |
| `ozi-validate` | Form validation and submit gate |
| `ozi-loaddata` | Declarative AJAX: collect, validate, send, render |
| `ozi-autocomplete` | Autocomplete input with remote data |
| `ozi-check` | Styled checkbox and radio groups |
| `ozi-search` | Live filtering of page content |
| `ozi-auth` | Sign-up / password forms: live rule checklist, confirmation, show/hide |
| `ozi-audio` | Audio recording and playback |
| `ozi-toggle` | Show/hide and state toggles |

**Internal modules** (loaded automatically as dependencies): `ozi-suggest`, `ozi-actions`,
`ozi-password-rules`, `ozi-editor-sanitize`.

## Installation details

**Blade directives.** `@oziStyles` and `@oziScripts` accept plugin keys or groups (`forms`,
`auth`, `livewire`, `full`). With no argument they load everything. Dependencies are resolved for
you: `@oziScripts(['editor'])` also loads the validator and the sanitizer it needs.

**Production.** Optionally publish the assets so your web server serves them directly:

```bash
php artisan vendor:publish --tag=ozi-ui
```

**Health check.** `php artisan ozi:check` verifies the installation and fails if anything is
missing or out of sync.

**Themes.** A theme is data, not code: the same JavaScript serves `default`, `bootstrap5` and
`tailwind`. Link the theme's CSS after `@oziStyles` and pick it with `oziConf()`:

```blade
@oziStyles
<link rel="stylesheet" href="/plugins/ozi-ui/themes/bootstrap5/tokens.css">
<link rel="stylesheet" href="/plugins/ozi-ui/themes/bootstrap5/overrides.css">
<link rel="stylesheet" href="/plugins/ozi-ui/themes/bootstrap5/dark.css">

@oziScripts
<script>oziConf({ theme: 'bootstrap5' });</script>
```

For a custom theme, copy `themes/_template/`.

**Languages.** `en`, `pt-BR` and `es`. The language follows your Laravel locale by default;
`oziConf({ lang: 'es' })` overrides it.

**Without Blade.** `ozi.js` also works on a plain HTML page: include
`<script src="/plugins/ozi-ui/ozi.js"></script>` and it loads the plugins you list in
`oziConf({ plugins: [...] })`.

## Requirements

- PHP 8.2+
- Laravel 10, 11, 12 or 13. Laravel 10 and 11 are past their security support; ozi-ui still works
  on them and is tested on them, but upgrading the framework is recommended.
- Livewire 3 or 4 (optional)

## Tested

Every push runs on GitHub Actions:

- **PHPUnit** (via Orchestra Testbench) on PHP 8.2–8.4 × Laravel 10–13: asset resolution, Blade
  directives, the asset route, and `ozi:check`
- **34 browser acceptance pages** in headless Chrome, one or more per plugin

See [`tests/aceites/README.md`](tests/aceites/README.md) to run them locally.

## Documentation

Full documentation: **[oziui.com/en/docs](https://oziui.com/en/docs/introduction)**
(also in [Português](https://oziui.com/pt-br/docs/introduction) and
[Español](https://oziui.com/es/docs/introduction)).

- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Upgrading from v1](https://oziui.com/en/docs/migration)

## Background

ozi-ui started in 2012 as a small helper to cut `$.ajax` boilerplate and grew, project by project,
into a plugin ecosystem. Version 2 (2026) rewrote everything in plain JavaScript and dropped
jQuery. One principle has not changed: *if you need to write JavaScript, something is wrong.*

## License

MIT. © 2012–2026 [Thomaz Ozi](https://github.com/thomaz-ozi) and [oziui.com](https://oziui.com).
