# Contributing to ozi-ui

Thanks for helping. Bug reports, reproductions and pull requests are all welcome, in English or
Portuguese.

## Scope

ozi-ui is a **Laravel / Livewire** library, distributed through Composer. Stability is only
promised where there is a test bench, and every bench is a Laravel app. An npm package, ESM/UMD
builds, SSR and wrappers for other frameworks are **out of scope** on purpose, so please open an
issue before working on anything in that direction.

## Reporting a bug

Open an issue with the **bug report** template. The most useful reports include:

- the versions: `ozi-ui/core`, Laravel, Livewire (if used), PHP, browser
- the theme (`default`, `bootstrap5`, `tailwind`) and whether assets are published or served by the route
- the smallest Blade or HTML snippet that reproduces it
- the output of `php artisan ozi:check`

Security issues: see [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

```bash
git clone https://github.com/thomaz-ozi/ozi-ui.git
cd ozi-ui
composer install

vendor/bin/phpunit               # PHP: assets, Blade directives, asset route, ozi:check
bash tests/aceites/run.sh        # JS: browser acceptance pages (needs PHP and Chrome/Chromium/Edge)
```

On Windows, point the runner at Edge:
`BROWSER="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" bash tests/aceites/run.sh`.

The JavaScript has no build step: files under `public/plugins/ozi-ui/` are what ships.

## Where things live

| Path | What |
|---|---|
| `public/plugins/ozi-ui/core/` | Boot, config (`ozi-conf.js` holds the `_pluginMap`, the single source of truth for plugins), loader, i18n, hooks |
| `public/plugins/ozi-ui/{components,modules,behaviors}/` | The plugins |
| `public/plugins/ozi-ui/integrations/` | The only place that knows about frameworks (Livewire adapter, v1 shims) |
| `public/plugins/ozi-ui/themes/` | Visuals: tokens, overrides, dark mode, classMap |
| `src/` | Laravel side: service provider, `OziAssets` (Blade directives), `ozi:check` |
| `tests/` | PHPUnit tests and `tests/aceites/` (browser acceptance pages) |

## Rules for plugin code

1. **No jQuery outside `integrations/`.** Core, modules, components, behaviors and themes are plain JavaScript.
2. **Never hardcode framework classes.** Use the classMap (`_classMap('invalid', 'ozi-invalid')`) and `--ozi-*` tokens; new visuals become tokens in the theme.
3. **Emit events only through `OZI.helpers.emit(el, name, detail)`**, with `detail` shaped as `{ component, name, value, source }` (`source: 'user'` for interaction, `'api'` for programmatic changes).
4. **Native boot** (`document.readyState` / `DOMContentLoaded`), a singleton guard (`if (window.OziName) return;`) and delegated listeners on `document` for behaviors.
5. **Per-element state in `WeakMap` / `WeakSet`**; `init(root?)` must be idempotent (it runs again after a Livewire morph) and `destroy()` must remove listeners and emit `ozi:destroy`.
6. **Every visible text goes through i18n** with a built-in fallback, and new keys are added to `en`, `pt-BR` and `es`.
7. **Adding or renaming a file?** Update the `_pluginMap` in `ozi-conf.js` **and** `src/OziAssets.php` (including `$scriptDeps`). `php artisan ozi:check` and the test suite fail on drift.

## Pull requests

- One topic per PR, with a short description of the problem and how you checked the fix.
- Add or update a test: a PHPUnit test for the Laravel side, an acceptance page in `tests/aceites/` for plugin behavior.
- Keep changes backward compatible within `2.x`. Anything that breaks the public API waits for a major version.
- CI must be green.

Plugin development also happens in a separate sandbox; accepted changes are mirrored there by the
maintainer, so you only need to work in this repository.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
