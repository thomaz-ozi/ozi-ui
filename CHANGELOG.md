# Changelog

All notable changes to `ozi-ui/core`. The package follows [Semantic Versioning](https://semver.org):
any `2.x` release is a drop-in upgrade for `^2.0`. Plugin versions (e.g. `ozi-editor` 4.9) are
listed where they changed.

## [Unreleased]

## [2.10.2] — 2026-11-22

### Fixed
- `ozi-select` 6.6.5: with `data-ozi-select-multiple-group`, the group header now shows the
  `is-group-selected` (all checked) and `is-group-partial` (some checked) states. They were computed
  against a list that had just been cleared, so they never appeared.

### Changed
- `ozi-select` 6.6.5: screen readers now announce arrow-key navigation (`aria-activedescendant` on the
  combobox and the search field, an `id` on each option). The option list is built in a
  `DocumentFragment` and inserted once. Form submission, events and the JS API are unchanged.

## [2.10.1] — 2026-11-22

### Fixed
- Pages in Spanish no longer log `[OZI:lang] use("es"): dicionario nao registrado`: `ozi-lang` 1.0.2
  ships a base `es` dictionary, like pt-BR and en.
- `ozi-editor` 4.10.2: the Markdown source button no longer logs `t("editor.source.md"): chave nao
  encontrada` and is now labelled in the page language (it was always "Markdown source"). The
  translation key is now `editor.sourceMd`.

## [2.10.0] — 2026-11-22

### Added
- **Unknown attribute warning (`OZI-W001`).** A `data-ozi-*` attribute that no plugin reads now logs a
  console warning with the correct name: `data-ozi-select-requierd` → "Did you mean
  `data-ozi-select-required`?". It also catches a typo in the plugin name (`data-ozi-selcet`),
  `data-ozi-editor` without `-html`/`-md`, remote-search names without `zld-`
  (`data-ozi-autocomplete-url`) and attributes removed in 2.0 (`data-ozi-copy`, `data-ozi-paste`).
  New core file `core/ozi-attrs.js` (`OZI.attrs`: `scan`, `isKnown`, `suggest`, `enabled`, `known`).
- **Unknown key warning (`OZI-W002`).** An unknown key in `@oziScripts([...])` or `@oziStyles([...])`
  used to be dropped silently. It now warns, with a suggestion (`'ozi-validate'` → `'validate'`). The
  page never breaks: the other keys load as before.
- `php artisan ozi:check` lists unknown `@oziScripts`/`@oziStyles` keys found in your views, with file
  and line (warning only; the exit code does not change).
- `oziConf({ warnUnknown: true | false })` forces the warnings on or off.

### Changed
- Warnings appear **only in development**: with `@oziScripts` they follow `APP_DEBUG` (the boot tag
  now carries `data-ozi-debug`); standalone (`ozi.js`) they are on for `localhost`, `127.0.0.1`,
  `*.test`, `*.local` and `file://`. With `APP_DEBUG=false`, `OZI-W002` goes only to the Laravel log.
- `ozi.js` 2.1.0 (`OZI.version` is now `2.1.0`), `ozi-conf` 3.2.0, `ozi-assets-boot` 1.1.0.

## [2.9.6] — 2026-11-22

### Security
- The same CSRF issue fixed in `ozi-select` 6.6.4 also existed in three more places, which sent the
  session token to any URL, including another domain or `//host`:
  - `ozi-autocomplete` 4.1.1: remote search (`X-CSRF-TOKEN` header and `_token` in the body) to
    any `data-ozi-autocomplete-zld-url`;
  - `ozi-suggest` 2.0.1: the shared remote searcher (header) to any `url`;
  - `ozi-editor` 4.10.1: image upload (header, together with the file) to any
    `data-ozi-editor-upload-url`.

  All five places in the package that read `<meta name="csrf-token">` now send it only to the same
  origin. Requests to your own application are unchanged.

## [2.9.5] — 2026-11-22

### Security
- `ozi-select` 6.6.4: remote search sent the CSRF token (`X-CSRF-TOKEN` header and `_token` in the
  body) to any `data-ozi-select-zld-url`, including another domain or `//host`, handing the session
  token to third parties. It is now sent only to the same origin, with the same rule as
  `ozi-loaddata` 5.0.2. Searches against your own application are unchanged.

## [2.9.4] — 2026-11-19

Closes the security audit of `ozi-select`, `ozi-loaddata`, `ozi-actions` and `ozi-auth`. Each one
now has an attack page that runs real payloads in CI.

### Security
- `ozi-loaddata` 5.0.2: the CSRF token (`X-CSRF-TOKEN` header and `_token` in the body) was sent to
  any `zldUrl`, including another domain or `//host`, handing the session token to third parties.
  It is now sent only to the same origin.
- `ozi-loaddata` 5.0.2: the server's `json.message` (a Laravel 422 often echoes what the user typed)
  was inserted as HTML in the error alert and could run script. It is now escaped.
- `ozi-loaddata` 5.0.2: the debug error page (`#logErrorLaravelOzi`) was written into a same-origin
  iframe, where a reflected `<img onerror>` ran with access to the page. The iframe is now sandboxed
  and receives the HTML through `srcdoc`.
- `ozi-actions` 2.0.1: toast messages went to `innerHTML`, so a message such as "Client *<name>*
  saved" ran a malicious name (stored XSS). The message is now text; HTML requires `html: true` in
  the payload. `toastr` receives the message escaped.
- `ozi-actions` 2.0.1: the `redirect` action accepted `javascript:` URLs, even disguised with a TAB.
  It now accepts only http(s) or relative URLs and warns in the console otherwise.

### Changed
- **Possible impact:** a backend that sends HTML in a toast on purpose now sees it escaped and must
  add `html: true` to the action payload.

### Fixed
- `ozi-select` 6.6.3: creating an option whose text contained `$&` or `$'` displayed the wrong
  label. No injection was found in the audit.

### Notes
- `ozi-auth`: no issue found. With debug on, the password does not reach browser storage, DOM
  attributes, console logs, event details or the URL, and typed HTML is not rendered.
- The `eval` action is unchanged by design: it runs code from your own server. Never build an
  `eval` action from user data.

## [2.9.3] — 2026-11-19

### Security
- `ozi-editor-sanitize` 1.2.2 fixes three XSS issues in the `ozi-editor` HTML sanitizer, found
  in an audit against known XSS payloads. **Everyone using `ozi-editor` should update.** Clean
  content is sanitized exactly as before.
  - HTML was parsed in the page's own document, so a discarded `<img>`, `<video>` or `<audio>` still
    loaded and its `onerror` ran while the sanitizer worked. Content saved through a direct request
    could run script for whoever opened it in the editor. Parsing now happens in an inert document.
  - The children of a removed wrapper tag (for example `<font>` or an `<a>` with an unsafe link)
    were moved up without being cleaned, so their event attributes survived. They are now cleaned
    before being kept, and SVG/MathML elements are always unwrapped.
  - Link and image URLs were checked with a regular expression that accepted `java<TAB>script:`
    and similar forms. The scheme now comes from the browser's own URL parser.

## [2.9.2] — 2026-11-18

### Security
- `ozi-loaddata` 5.0.1: the CSRF `_token` no longer goes into the URL. In `window` mode and in
  `page` mode with GET it was sent in the query string, where it ends up in browser history,
  server logs and the `Referer` header. It is now sent only in the body of non-GET requests,
  including a `_token` collected from an `@csrf` field inside the collected group.

### Fixed
- `ozi-loaddata` 5.0.1: `zldFormClear` now clears the fields only when the response is ok. Before
  this, a network error or a 422 also cleared them and the user lost what they had typed.
- `ozi-loaddata` 5.0.1: when the destination is replaced (no append/before), a new request to the
  same destination aborts the previous one, so a slow old response can no longer overwrite a newer
  one. The aborted call resolves with `aborted: true` and renders nothing.
- `ozi-loaddata` 5.0.1: calling `oziLoadData()` from JavaScript no longer leaves an empty `<span>`
  in the `<body>` on every call.
- `ozi-loaddata` 5.0.1: when validation blocks a request with `zldFormBusy`, the button's
  `aria-disabled` and `data-zld-busy` now match its visual state again.
- `ozi-loaddata` 5.0.1: files in `page` mode with POST are sent as a real file field (multipart)
  instead of the text `[object File]`. Where files can't be sent (`window`, `page` with GET), a
  console warning says so instead of dropping them silently.

## [2.9.1] — 2026-11-18

### Fixed
- `ozi.js`: `OZI.hooks` now exists before the boot as a queue with the same shape as the real
  hooks, instead of an empty object. Before this, a plugin that ran before the boot (for example
  after a Livewire `wire:navigate`) threw `Cannot read properties of undefined (reading 'register')`
  or silently skipped its re-render hook. Queued registrations are applied when the boot connects
  the real hooks.
- `ozi-editor-sanitize` 1.2.1: newer Chrome versions expand `border:none` into explicit
  `border-image-*` defaults. The `ozi:editor-sanitized` report counted them as lost formatting,
  so the event fired for nothing. Default values from shorthand expansion are no longer reported.
  The sanitized HTML is unchanged.

## [2.9.0] — 2026-11-18

### Added
- `ozi-editor` 4.10.0 / `ozi-editor-sanitize` 1.2.0: `data-ozi-editor-sanitize="email"` keeps
  the inline styles an email body needs: `<div>` blocks, padding, margin, borders, border radius,
  fonts, widths, and layout table attributes. Every value is checked by its format, and `url()`,
  `calc()`, `position`, `z-index` and event attributes are still removed. The default profile is
  unchanged.
- `ozi-editor` 4.10.0: new `ozi:editor-sanitized` event. It fires when content loaded into the
  editor (on init, through `setValue()`, or when leaving source mode) loses something to the
  sanitizer. The `removed` list in the event says what was dropped. Before this, the loss was
  silent until the first keystroke saved the cleaned version. The last report is also available
  as `instance.lastSanitize`.

### Changed
- `ozi-helpers` 1.2.0: SVG icons are cached per URL, and the editor and audio plugins load all
  their icons from one `svg/icons.json` file instead of one request per icon. On a page with two
  editors the icon requests drop from 28 to 1. Single `icon-*.svg` files are still shipped and used
  as a fallback. Set `core.iconBundle: false` to load the single files only.

## [2.8.2] — 2026-11-18

### Fixed
- `ozi-select` 6.6.2 (CSS 1.6.2): completes the 2.8.1 narrow-label fix. With a wider font (for
  example the default font on Linux) the count was still clipped by a few pixels. The minimum
  space now scales with the font, and the gap after the icon shrinks together with the icon.

## [2.8.1] — 2026-11-17

### Fixed
- `ozi-select` 6.6.1 (CSS 1.6.1): in fixed-label mode (`data-ozi-select-multiple-label` with
  `data-ozi-select-multiple-count`), a narrow select with an icon showed only the count; the label
  shrank to nothing. Now the icon gives up its space first, the label keeps at least a couple of
  characters with an ellipsis, and the count never overlaps the clear button. Other modes are
  unchanged.
- `ozi-select` CSS 1.6.1: the dropdown scrollbar stayed white in dark mode. It now follows the
  select's border color, through the new `--ozi-select-scrollbar-color` token (dark only; light
  mode keeps the native scrollbar).

## [2.8.0] — 2026-11-17

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
- Livewire adapter 2.3: `data-ozi-livewire-call="method"` (with optional
  `data-ozi-livewire-args='["first-arg"]'`) calls a component method on every user change, with the
  arguments followed by the value, so no hand-written `ozi:change` listener is needed.
  `data-ozi-livewire-defer` makes `data-ozi-livewire-model` update without a server round-trip
  (`set(prop, value, false)`), useful for the editor, which changes on every keystroke.

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

[Unreleased]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.10.2...HEAD
[2.10.2]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.10.1...v2.10.2
[2.10.1]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.10.0...v2.10.1
[2.10.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.9.6...v2.10.0
[2.9.6]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.9.5...v2.9.6
[2.9.5]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.9.4...v2.9.5
[2.9.4]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.9.3...v2.9.4
[2.9.3]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.9.2...v2.9.3
[2.9.2]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.9.1...v2.9.2
[2.9.1]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.9.0...v2.9.1
[2.9.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.8.2...v2.9.0
[2.8.2]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.8.1...v2.8.2
[2.8.1]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/thomaz-ozi/ozi-ui/compare/v2.7.2...v2.8.0
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
