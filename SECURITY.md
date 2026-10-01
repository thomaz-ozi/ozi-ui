# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 2.x (latest release) | ✅ |
| 1.x | ❌ |

Fixes are released on the latest `2.x` line. Stay on `^2.0` and run `composer update` to receive them.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately by e-mail to **support@oziui.com**, with:

- the affected plugin and version
- a description of the issue and its impact
- steps or a minimal snippet to reproduce it

You will get an acknowledgement within 7 days. Once a fix is ready it is released as a patch
version and credited in the [changelog](CHANGELOG.md), unless you prefer to stay anonymous.

Areas that deserve particular attention: HTML rendered by `ozi-select` / `ozi-autocomplete`
options, the `ozi-editor` sanitizer (`ozi-editor-sanitize`), and the package asset route.
