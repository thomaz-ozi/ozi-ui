(function ($) {
    'use strict';

    const OziCheck = {
        selectors: {
            enabled: '[data-ozi-check-enabled]',
            all: '[data-ozi-check-all]',
            item: '[data-ozi-check-item]'
        },

        init(scope = document) {
            const $scope = $(scope);

            this.bindEnabled($scope);
            this.bindAll($scope);
            this.bindItem($scope);
            this.syncAllGroups($scope);
        },

        refresh(scope = document) {
            this.syncAllGroups($(scope));
        },

        getGroupElements(group, scope = document) {
            const $scope = $(scope);

            return {
                $enabled: $scope.find(`${this.selectors.enabled}[data-ozi-check-enabled="${group}"]`),
                $all: $scope.find(`${this.selectors.all}[data-ozi-check-all="${group}"]`),
                $items: $scope.find(`${this.selectors.item}[data-ozi-check-item="${group}"]`)
            };
        },

        getGroups(scope = document) {
            const groups = new Set();
            const $scope = $(scope);

            $scope.find(this.selectors.enabled).each(function () {
                const group = String($(this).attr('data-ozi-check-enabled') || '').trim();
                if (group) groups.add(group);
            });

            $scope.find(this.selectors.all).each(function () {
                const group = String($(this).attr('data-ozi-check-all') || '').trim();
                if (group) groups.add(group);
            });

            $scope.find(this.selectors.item).each(function () {
                const group = String($(this).attr('data-ozi-check-item') || '').trim();
                if (group) groups.add(group);
            });

            return Array.from(groups);
        },

        isGroupEnabled(group, scope = document) {
            const { $enabled } = this.getGroupElements(group, scope);

            if (!$enabled.length) {
                return true;
            }

            return $enabled.first().prop('checked') === true;
        },

        setGroupEnabledState(group, enabled, scope = document) {
            const { $all, $items } = this.getGroupElements(group, scope);

            $all.prop('disabled', !enabled);
            $items.prop('disabled', !enabled);

            if (!enabled) {
                $all.prop('checked', false);
                $all.prop('indeterminate', false);
                $items.prop('checked', false);
            } else {
                this.syncGroup(group, scope);
            }
        },

        setAllItems(group, checked, scope = document) {
            const { $items } = this.getGroupElements(group, scope);

            $items.each(function () {
                if (!$(this).prop('disabled')) {
                    $(this).prop('checked', checked);
                }
            });

            this.syncGroup(group, scope);
        },

        syncGroup(group, scope = document) {
            const enabled = this.isGroupEnabled(group, scope);
            const { $all, $items } = this.getGroupElements(group, scope);

            if (!enabled) {
                this.setGroupEnabledState(group, false, scope);
                return;
            }

            $all.prop('disabled', false);
            $items.prop('disabled', false);

            const total = $items.length;
            const checkedCount = $items.filter(':checked').length;

            if (!$all.length) {
                return;
            }

            if (total === 0) {
                $all.prop('checked', false);
                $all.prop('indeterminate', false);
                return;
            }

            if (checkedCount === 0) {
                $all.prop('checked', false);
                $all.prop('indeterminate', false);
                return;
            }

            if (checkedCount === total) {
                $all.prop('checked', true);
                $all.prop('indeterminate', false);
                return;
            }

            $all.prop('checked', false);
            $all.prop('indeterminate', true);
        },

        syncAllGroups(scope = document) {
            const groups = this.getGroups(scope);

            groups.forEach(group => {
                const enabled = this.isGroupEnabled(group, scope);

                if (!enabled) {
                    this.setGroupEnabledState(group, false, scope);
                } else {
                    this.setGroupEnabledState(group, true, scope);
                    this.syncGroup(group, scope);
                }
            });
        },

        bindEnabled(scope = document) {
            const self = this;

            $(document)
                .off('change.oziCheckEnabled', this.selectors.enabled)
                .on('change.oziCheckEnabled', this.selectors.enabled, function () {
                    const group = String($(this).attr('data-ozi-check-enabled') || '').trim();
                    if (!group) return;

                    const enabled = $(this).prop('checked') === true;
                    self.setGroupEnabledState(group, enabled, document);
                });
        },

        bindAll(scope = document) {
            const self = this;

            $(document)
                .off('change.oziCheckAll', this.selectors.all)
                .on('change.oziCheckAll', this.selectors.all, function () {
                    const group = String($(this).attr('data-ozi-check-all') || '').trim();
                    if (!group) return;

                    if (!self.isGroupEnabled(group, document)) {
                        $(this).prop('checked', false);
                        $(this).prop('indeterminate', false);
                        return;
                    }

                    const checked = $(this).prop('checked') === true;
                    self.setAllItems(group, checked, document);
                });
        },

        bindItem(scope = document) {
            const self = this;

            $(document)
                .off('change.oziCheckItem', this.selectors.item)
                .on('change.oziCheckItem', this.selectors.item, function () {
                    const group = String($(this).attr('data-ozi-check-item') || '').trim();
                    if (!group) return;

                    self.syncGroup(group, document);
                });
        }
    };

    function oziCheckInitFetched(root = document) {
        const target = root instanceof jQuery ? root[0] : root;
        OziCheck.refresh(target || document);
    }

    function bindOziCheckFetchSupport() {
        // evento manual
        $(document)
            .off('oziCheck:initFetched')
            .on('oziCheck:initFetched', function (e, root) {
                oziCheckInitFetched(root || document);
            });

        // integração automática com ZLD
        if (
            window.zldConf &&
            window.zldConf.zldHooks &&
            Array.isArray(window.zldConf.zldHooks.afterRender)
        ) {
            const alreadyBound = window.zldConf.zldHooks.afterRender.some(function (fn) {
                return fn && fn.__oziCheckAfterRender === true;
            });

            if (!alreadyBound) {
                const hook = function (root) {
                    oziCheckInitFetched(root || document);
                };

                hook.__oziCheckAfterRender = true;
                window.zldConf.zldHooks.afterRender.push(hook);
            }
        }
    }

    $(document).ready(function () {
        OziCheck.init(document);
        bindOziCheckFetchSupport();
    });

    window.OziCheck = OziCheck;
    window.oziCheckInitFetched = oziCheckInitFetched;

})(jQuery);
