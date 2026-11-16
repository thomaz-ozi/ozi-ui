# Changelog

All notable changes to `ozi-ui/core`. The package follows [Semantic Versioning](https://semver.org):
any `2.x` release is a drop-in upgrade for `^2.0`. Plugin versions (e.g. `ozi-editor` 4.9) are
listed where they changed.

## [Unreleased]

### Added
- Follow the app's own theme: `oziConf({ themeMode: 'app' })` or `<html data-ozi-theme-mode="app">`.
  The new `core/ozi-theme.js` reads the app's theme and sets `data-ozi-theme="light|dark"` on
  `<html>`, which every ozi-ui stylesheet already understands. It checks Bootstrap's
  `data-bs-theme`, then Tailwind's `dark` class, then the brightness of the page background, so
  apps with their own dark mode (e.g. `body.dark-mode`) need no extra code. It re-checks when the
  app switches themes. Exposed as `OZI.theme` (`setMode()`, `mode()`, `current()`, `refresh()`).
- `themeMode: 'light' | 'dark'` now work. The option was declared but had no effect.
- `ozi-select` CSS 1.5: built-in dark colors, like the other components. Before, the select only
  turned dark when a theme `dark.css` was linked, so its list stayed white in dark apps.
- `ozi-select` 6.6: checkboxes in multiple mode. `data-ozi-select-check` draws a checkbox on each
  option. `data-ozi-select-check="all"` starts with every option checked (options without
  `selected`; `selected: false` stays unchecked), turns the clear button into "Select all" and,
  with `data-ozi-select-multiple-count`, shows "All" instead of the number. New translation keys
  `select.selectAll`, `select.allCount`, `select.allSelected`.

### Fixed
- `@oziScripts` with Livewire `wire:navigate`: on a page reached from a page without ozi-ui, the
  inline boot script ran before the core files had loaded. `OZI.hooks` was left empty (errors
  `Cannot read properties of undefined (reading 'register')`), `OZI.conf` stayed null, translations
  were not loaded and `oziConf()` calls in the Blade view were dropped. The boot now lives in
  `core/ozi-assets-boot.js` and `core/ozi-assets-ready.js`, which load in order with the other
  scripts; `oziConf()` calls made before the boot are queued and applied.
- `ozi-select` 6.6: when two elements on a page share the same `data-ozi-select` key, the second
  one is not initialized. This used to happen silently; it now logs a console warning.
- `ozi-select` 6.5.2: an open select did not close when another select was clicked, or when
  clicking inside a container that stops event propagation (e.g. a modal with `wire:click.stop`).
- `ozi-validate` CSS: the dark icons were used whenever the OS was dark, even with
  `data-ozi-theme="light"`; there was also no `data-ozi-theme="dark"` rule.
- `ozi-check` CSS: the dark-mode rule was invalid CSS and browsers ignored it.

### Unchanged by default
- With no configuration, `themeMode` stays `'auto'` and ozi-ui follows the OS as before. The only
  visible difference is the select, which now goes dark with the OS like the editor and
  autocomplete already did.

## [2.7.2] — 2026-11-15

### Fixed
- `ozi-select` 6.5.1: `data-ozi-required` now makes a select required. Only
  `data-ozi-select-required` worked, so a select marked the way the `ozi-validate` docs show was
  submitted empty with no error. A required select is now also seen by the `ozi-validate` submit
  gate, which emitted `ozi:validate-ready` while the select itself blocked the submission.
- `ozi-select` 6.5.1: in multiple mode the dropdown closed after every click on an option.
- `ozi-validate` 2.2.2: the submit gate now moves focus into the first invalid component instead of
  its non-focusable root element.
- `ozi-editor` 4.9.2: a popover limited by the viewport height no longer runs past the bottom of the
  screen when the page does not load the ozi reset stylesheet. The image alignment buttons show
  their icons again (`ozi-editor.css` 2.8.1).

## [2.7.1] — 2026-11-01

### Fixed
- `LICENSE` was an empty file in every release up to 2.7.0. It now contains the MIT license text
  that `composer.json` and the README already declared.
- README: lists the plugin keys, shows how to load and style `ozi-validate`, adds a required-select
  example and gives the full path of the theme template. Gaps found by installing the package on a
  clean Laravel app using only the README.

## [2.7.0] — 2026-10-01

### Added
- `ozi-select` 6.5: fixed label and counter for multiple selects.
  `data-ozi-select-multiple-label="Seller"` always shows that text on the button instead of
  chips, and `data-ozi-select-multiple-count` adds the number of selected items. New translation
  key `select.selectedCount` (en, pt-BR, es).

### Fixed
- `ozi-validate` 2.2.1: a required component without `name`/`id` (e.g.
  `<div data-ozi-select="team" data-ozi-required="true">`) was silently skipped, so the form was
  submitted with it empty. It is now validated and reported by its key (`team`).
- `ozi-loader` 1.0.2: theme stylesheets (`themes/<theme>/*.css`) lost the cascade to plugin CSS
  injected later in standalone mode. Plugin CSS is now inserted before the first theme stylesheet.
- `ozi-editor` 4.9.1: popovers did not open when the toolbar was scrolled out of view (long
  documents); scrolling inside a popover no longer repositions or closes it.

### Changed
- Bundled Markdown files follow one naming pattern (`ozi-<name>.CHANGELOG.md` /
  `ozi-<name>.README.md`); `core/md/coi-conf.README.md` is now `ozi-conf.README.md`.

## [2.6.2] — 2026-10-01

### Fixed
- `@oziScripts` now emits the translation files when assets are served from the package (no
  `vendor:publish`). Since 2.1.0, apps installed with `composer require` alone got no dictionaries
  and every plugin text fell back to its built-in default.

### Added
- Test suite in the repository: PHPUnit via Orchestra Testbench (PHP 8.2–8.4 × Laravel 10–13) and
  34 browser acceptance pages in headless Chrome, both on GitHub Actions.
- README with examples and screenshots, `CONTRIBUTING.md`, `SECURITY.md`, issue templates.

## [2.6.1] — 2026-09-30

No code changes.
- Smaller dist: `.gitattributes` keeps CI and IDE files out of `vendor/`.
- Author metadata in `composer.json`.
- Continuous integration on PHP 8.2–8.4 × Laravel 10–13.

## [2.6.0] — 2026-09-23

### Added
- `@oziScripts` resolves plugin dependencies: `@oziScripts(['editor'])` also loads the validator
  and the sanitizer the editor needs. Tags are emitted in canonical load order.
- `php artisan ozi:check` detects drift in plugin dependencies.

### Fixed
- `php artisan route:cache` no longer runs out of memory because of the asset route.
- Livewire adapter for `ozi-editor` binds `data-ozi-livewire-model` on `data-ozi-editor-html` /
  `-md` textareas.

### Changed
- The order of emitted `<script>` tags is now the canonical load order, not the order the keys
  were typed. No key is removed.

## [2.5.0] — 2026-09-21

### Added
- `ozi-editor` 4.8: table tool with an insert grid and row/column editing.
- `ozi-editor` 4.9: list indentation (`indent` / `outdent`, Tab / Shift+Tab), also in Markdown.

### Fixed
- Editor focus ring and active-state colors when no theme tokens are linked.
- `justify` disabled in Markdown mode; heading icons (`h1`–`h6`) no longer 404.

## [2.4.0] — 2026-09-11

### Added
- `ozi-editor` 4.2–4.7: strike, justify, quote, horizontal rule, undo/redo, word count, links,
  text color and highlight, paste as plain text, images (URL and upload), image alignment and
  free positioning, responsive toolbar (collapse and scroll modes).
- `ozi-select` 6.4: per-option action buttons (`ozi:option-action`), opt-in `labelHtml`.
- New internal module `ozi-editor-sanitize`, required by the editor.

### Security
- `ozi-select` 6.3.1: option `label` / `subLabel` are rendered as text, not HTML.

## [2.3.1] — 2026-08-24

### Added
- `ozi-select` 6.3: creatable mode (add an option from the search text, `ozi:select-create`).
- `ozi-validate` 2.2: submit gate (`data-ozi-validate` on the submit button), which also blocks
  Livewire's `wire:submit` while the form is invalid.

## [2.3.0] — 2026-08-24

### Added
- `ozi-audio` 4.3: pause / resume recording and the `clarity` skin.

Note: 2.3.0 shipped without the select and validate changes announced for it; they are in 2.3.1.

## [2.2.0] — 2026-08-20

### Added
- `ozi-audio` 4.2: three-step recorder with review before saving.
- Per-instance debug flag `data-ozi-{plugin}-log` (audio, select, autocomplete, editor).
- `ozi-select` 6.2: action footer inside the dropdown (`ozi:select-footer`, Livewire call support).

## [2.1.2] — 2026-08-19

### Fixed
- `ozi:check` understands assets served from the package route and stops reporting false
  "not published" errors.

## [2.1.1] — 2026-08-19

### Fixed
- `ozi-audio`: missing translations and a stable time display; flat skin with the ozi accent color.

## [2.1.0] — 2026-08-19

### Added
- Fallback route that serves assets straight from the package: `composer require` is enough,
  `vendor:publish` becomes a production optimization.
- Config is merged from the package, no publish needed.
- `php artisan ozi:check` is registered.

## [2.0.0] — 2026-08-02

Version 2: every plugin rewritten in plain JavaScript, no jQuery, zero runtime dependencies.
A v1 compatibility ramp (jQuery shims, `zld*` aliases) is included and opt-in. `ozi-copy` and
`ozi-paste` were discontinued. See the [migration guide](https://oziui.com/en/docs/migration).

[Unreleased]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.7.2...HEAD
[2.7.2]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.7.1...v2.7.2
[2.7.1]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.6.2...v2.7.0
[2.6.2]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.6.1...v2.6.2
[2.6.1]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.3...v2.3.1
[2.3.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.2.0...v2.3
[2.2.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.1.2...v2.2.0
[2.1.2]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/thomaz-ozi/ozi-ui/releases/tag/v2.0.0
