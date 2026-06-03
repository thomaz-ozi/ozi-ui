/**
 * ------------------------------------------
 * ozi-plugins
 * ------------------------------------------
 * Ver: 1.0.0
 * 2026-05-27
 *
 *
 * Fichas declarativas de todos os plugins OZI-UI.
 * Registradas em OZI.integrations via registerPlugin().
 *
 * Pode ser dividido em arquivos individuais (ozi-select.plugin.js, etc.)
 * ou carregado como arquivo único — ambos funcionam.
 *
 * Ordem: cada ficha registra após OZI.ready().
 */

(function (window) {
    'use strict';

    function _register() {
        var integrations = window.OZI && window.OZI.integrations;
        if (!integrations || !integrations.registerPlugin) return;

        var components = window.OZI.components;
        var behaviors  = window.OZI.behaviors;

        // ─────────────────────────────────────────────
        // ozi-select
        // ─────────────────────────────────────────────
        if (components && components.select) {
            integrations.registerPlugin({
                name:         'select',
                selector:     '[data-ozi-select]',
                keyAttribute: 'data-ozi-select',
                changeEvent:  'ozi:change',

                getInstance: function (root) {
                    return components.select.get(root);
                },
                getValue: function (instance) {
                    return instance ? instance.getValue() : null;
                },
                setValue: function (root, value) {
                    components.select.value(root, value);
                },
                setOptions: function (root, options) {
                    components.select.setOptions(root, options);
                },
                destroy: function (instance) {
                    if (instance) instance.destroy();
                },
                reinit: function (root) {
                    components.select.init(root);
                }
            });
        }

        // ─────────────────────────────────────────────
        // ozi-autocomplete
        // ─────────────────────────────────────────────
        if (components && components.autocomplete) {
            integrations.registerPlugin({
                name:         'autocomplete',
                selector:     '[data-ozi-autocomplete]',
                keyAttribute: 'data-ozi-autocomplete',
                changeEvent:  'ozi:change',

                getInstance: function (root) {
                    return components.autocomplete.get(root);
                },
                getValue: function (instance) {
                    return instance ? instance.getValue() : null;
                },
                setValue: function (root, value) {
                    components.autocomplete.value(root, value);
                },
                setOptions: function (root, options) {
                    components.autocomplete.setOptions(root, options);
                },
                destroy: function (instance) {
                    if (instance) instance.destroy();
                },
                reinit: function (root) {
                    components.autocomplete.init(root);
                }
            });
        }

        // ─────────────────────────────────────────────
        // ozi-editor
        // ─────────────────────────────────────────────
        if (components && components.editor) {
            integrations.registerPlugin({
                name:         'editor',
                selector:     '[data-ozi-editor]',
                keyAttribute: 'data-ozi-editor',
                changeEvent:  'ozi:change',

                getInstance: function (root) {
                    return components.editor.get(root);
                },
                getValue: function (instance) {
                    return instance ? instance.getValue() : '';
                },
                setValue: function (root, value) {
                    components.editor.value(root, value);
                },
                destroy: function (instance) {
                    if (instance) instance.destroy();
                },
                reinit: function (root) {
                    components.editor.init(root);
                }
            });
        }

        // ─────────────────────────────────────────────
        // ozi-audio
        // ─────────────────────────────────────────────
        if (components && components.audio) {
            integrations.registerPlugin({
                name:         'audio',
                selector:     '[data-ozi-audio]',
                keyAttribute: 'id',             // audio usa id como key
                changeEvent:  'ozi:audio-saved',

                getInstance: function (root) {
                    return components.audio.get(root);
                },
                getValue: function (instance) {
                    return instance ? instance.recordedFile : null;
                },
                setValue: function () { /* audio não tem setValue */ },
                destroy: function (instance) {
                    if (instance) instance.destroy();
                },
                reinit: function (root) {
                    components.audio.init(root);
                }
            });
        }

        // ─────────────────────────────────────────────
        // ozi-search
        // ─────────────────────────────────────────────
        if (components && components.search) {
            integrations.registerPlugin({
                name:         'search',
                selector:     '[data-ozi-search]',
                keyAttribute: 'id',
                changeEvent:  'ozi:search-filtered',

                getInstance: function (root) {
                    return root; // funcional — sem instância
                },
                getValue: function (root) {
                    return root ? root.value : '';
                },
                setValue: function (root, value) {
                    components.search.trigger(root, value);
                },
                destroy: function () { /* behavior — sem destroy */ },
                reinit: function (root) {
                    components.search.init(root);
                }
            });
        }

        // ─────────────────────────────────────────────
        // ozi-check
        // ─────────────────────────────────────────────
        if (components && components.check) {
            integrations.registerPlugin({
                name:         'check',
                selector:     '[data-ozi-check-item]',
                keyAttribute: 'data-ozi-check-item',
                changeEvent:  'ozi:check-change',

                getInstance: function () {
                    return components.check; // singleton
                },
                getValue: function (instance, root) {
                    if (!root) return null;
                    var group = root.getAttribute('data-ozi-check-item');
                    return components.check.getGroupElements(group)
                        .$items.filter(':checked').map(function () {
                            return this.value;
                        }).get();
                },
                setValue: function () { /* via setAllItems */ },
                destroy: function () { /* singleton — sem destroy */ },
                reinit: function () {
                    components.check.refresh();
                }
            });
        }

        // ─────────────────────────────────────────────
        // ozi-copy (behavior)
        // ─────────────────────────────────────────────
        if (behaviors && behaviors.copy) {
            integrations.registerPlugin({
                name:         'copy',
                selector:     '[data-ozi-copy-value], [data-ozi-copy]',
                keyAttribute: 'data-ozi-copy',
                changeEvent:  'ozi:copied',

                getInstance: function () { return behaviors.copy; },
                getValue:    function () { return null; },
                setValue:    function () {},
                destroy:     function () {},
                reinit:      function () {}
            });
        }

        // ─────────────────────────────────────────────
        // ozi-toggle (behavior)
        // ─────────────────────────────────────────────
        if (behaviors && behaviors.toggle) {
            integrations.registerPlugin({
                name:         'toggle',
                selector:     '[data-ozi-toggle-trigger]',
                keyAttribute: 'data-ozi-toggle-trigger',
                changeEvent:  'ozi:toggle-change',

                getInstance: function () { return behaviors.toggle; },
                getValue:    function (inst, root) {
                    if (!root) return false;
                    var id = root.getAttribute('data-ozi-toggle-trigger');
                    return behaviors.toggle && id
                        ? document.querySelector('[data-ozi-toggle-content="' + id + '"]') &&
                          document.querySelector('[data-ozi-toggle-content="' + id + '"]').style.display !== 'none'
                        : false;
                },
                setValue: function (root, value) {
                    var id = root && root.getAttribute('data-ozi-toggle-trigger');
                    if (!id) return;
                    value ? behaviors.toggle.open(id) : behaviors.toggle.close(id);
                },
                destroy: function () {},
                reinit:  function () { behaviors.toggle.syncAll(); }
            });
        }
    }

    // registra após OZI.ready
    if (window.OZI && window.OZI.isReady) {
        _register();
    } else if (window.OZI && window.OZI.ready) {
        window.OZI.ready(function () { _register(); });
    } else {
        document.addEventListener('DOMContentLoaded', _register);
    }

})(window);
