(() => {
    if (window.__oziSelectLivewireInited) return;
    window.__oziSelectLivewireInited = true;

    function hasLivewire() {
        return !!window.Livewire;
    }

    function getComponentId(root) {
        const host = root.closest('[wire\\:id]');
        return host ? host.getAttribute('wire:id') : null;
    }

    function getInstance(root) {
        if (!window.OziSelect || !root) return null;
        return window.OziSelect.get(root);
    }

    function isBlank(value) {
        return value === undefined || value === null || value === '';
    }

    function parseJsonSafe(value, fallback = null) {
        if (value === undefined || value === null || value === '') {
            return fallback;
        }

        if (typeof value !== 'string') {
            return value;
        }

        try {
            return JSON.parse(value);
        } catch (e) {
            return fallback;
        }
    }

    function normalizeValueForInstance(instance, value) {
        if (!instance) return value;

        if (instance.mode === 'single') {
            if (Array.isArray(value)) {
                return value.length ? value[0] : null;
            }
            return isBlank(value) ? null : value;
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (isBlank(value)) {
            return [];
        }

        return [value];
    }

    function stableStringify(value) {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return String(value);
        }
    }

    function setLastSyncedValue(root, value) {
        root.dataset.oziLivewireLastValue = stableStringify(value);
    }

    function getLastSyncedValue(root) {
        return root.dataset.oziLivewireLastValue || '';
    }

    function syncPluginToLivewire(root) {
        if (!hasLivewire() || !root) return;

        const model = String(root.dataset.oziLivewireModel || '').trim();
        if (!model) return;

        const componentId = getComponentId(root);
        if (!componentId) return;

        const component = window.Livewire.find(componentId);
        if (!component) return;

        const instance = getInstance(root);
        if (!instance) return;

        const value = normalizeValueForInstance(instance, instance.getValue());
        const encoded = stableStringify(value);

        if (encoded === getLastSyncedValue(root)) {
            return;
        }

        try {
            component.set(model, value);
            setLastSyncedValue(root, value);
        } catch (e) {
            console.warn('oziSelect Livewire bridge: erro ao sincronizar plugin -> Livewire.', e);
        }
    }

    function syncLivewireToPlugin(root, incomingValue) {
        if (!root || !window.OziSelect) return;

        const instance = getInstance(root);
        if (!instance) return;

        const nextValue = normalizeValueForInstance(instance, incomingValue);
        const currentValue = normalizeValueForInstance(instance, instance.getValue());

        if (stableStringify(currentValue) === stableStringify(nextValue)) {
            setLastSyncedValue(root, nextValue);
            return;
        }

        window.OziSelect.value(root, nextValue);
        setLastSyncedValue(root, nextValue);
    }

    function bindRoot(root) {
        if (!root || root.dataset.oziLivewireBound === '1') return;

        const model = String(root.dataset.oziLivewireModel || '').trim();
        if (!model) return;

        root.dataset.oziLivewireBound = '1';

        const $root = window.jQuery ? window.jQuery(root) : null;

        if ($root) {
            $root.on('ozi:change.oziLivewire', function () {
                syncPluginToLivewire(root);
            });
        } else {
            root.addEventListener('ozi:change', function () {
                syncPluginToLivewire(root);
            });
        }

        const initialValue = parseJsonSafe(root.getAttribute('data-ozi-livewire-value'), null);
        if (initialValue !== null) {
            syncLivewireToPlugin(root, initialValue);
        } else {
            const instance = getInstance(root);
            if (instance) {
                setLastSyncedValue(root, normalizeValueForInstance(instance, instance.getValue()));
            }
        }
    }

    function init(scope = document) {
        if (!scope) return;

        const roots = scope.querySelectorAll('[data-ozi-select][data-ozi-livewire-model]');

        roots.forEach((root) => {
            if (window.OziSelect) {
                window.OziSelect.init(root);
            }
            bindRoot(root);
        });
    }

    function findRoot(detail = {}) {
        if (detail.selector) {
            return document.querySelector(detail.selector);
        }

        if (detail.id) {
            return document.getElementById(detail.id);
        }

        if (detail.key) {
            return document.querySelector('[data-ozi-select="' + detail.key.replace(/"/g, '\\"') + '"]');
        }

        return null;
    }

    document.addEventListener('DOMContentLoaded', () => {
        init(document);
    });

    document.addEventListener('livewire:navigated', () => {
        init(document);
    });

    document.addEventListener('ozi-select:init', (e) => {
        const root = findRoot(e.detail || {});
        if (!root) return;

        if (window.OziSelect) {
            window.OziSelect.init(root);
        }

        bindRoot(root);
    });

    document.addEventListener('ozi-select:reload', (e) => {
        const root = findRoot(e.detail || {});
        if (!root || !window.OziSelect) return;

        window.OziSelect.reload(root);
        bindRoot(root);

        if (e.detail && Object.prototype.hasOwnProperty.call(e.detail, 'value')) {
            syncLivewireToPlugin(root, e.detail.value);
        }
    });

    document.addEventListener('ozi-select:set-value', (e) => {
        const root = findRoot(e.detail || {});
        if (!root) return;

        syncLivewireToPlugin(root, e.detail ? e.detail.value : null);
    });

    document.addEventListener('ozi-select:clear', (e) => {
        const root = findRoot(e.detail || {});
        if (!root || !window.OziSelect) return;

        window.OziSelect.clear(root);
        syncPluginToLivewire(root);
    });

    document.addEventListener('ozi-select:disable', (e) => {
        const root = findRoot(e.detail || {});
        if (!root || !window.OziSelect) return;

        window.OziSelect.disable(root);
    });

    document.addEventListener('ozi-select:enable', (e) => {
        const root = findRoot(e.detail || {});
        if (!root || !window.OziSelect) return;

        window.OziSelect.enable(root);
    });
})();