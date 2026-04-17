(function () {
    'use strict';

    var KEY = 'theme';
    var html = document.documentElement;
    var mql = window.matchMedia('(prefers-color-scheme: dark)');

    function stored() {
        try {
            var v = localStorage.getItem(KEY);
            return (v === 'light' || v === 'dark') ? v : null;
        } catch (e) { return null; }
    }

    function resolved() {
        return stored() || (mql.matches ? 'dark' : 'light');
    }

    function apply(theme, persist) {
        html.setAttribute('data-theme', theme);
        if (persist) {
            try { localStorage.setItem(KEY, theme); } catch (e) {}
        }
        refresh();
    }

    function refresh() {
        var mode = html.getAttribute('data-theme') || resolved();
        document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            var next = mode === 'dark' ? 'light' : 'dark';
            btn.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
            btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
            btn.title = 'Switch to ' + next + ' theme';
            var icon = btn.querySelector('[data-theme-icon]');
            if (icon) icon.textContent = mode === 'dark' ? '☀' : '☾';
        });
    }

    function toggle() {
        var current = html.getAttribute('data-theme') || resolved();
        apply(current === 'dark' ? 'light' : 'dark', true);
    }

    function wire() {
        document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
            if (btn.dataset.themeWired) return;
            btn.dataset.themeWired = '1';
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                toggle();
            });
        });
        refresh();
    }

    // When no explicit choice is stored, follow the system preference live.
    if (mql.addEventListener) {
        mql.addEventListener('change', function (e) {
            if (!stored()) html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            refresh();
        });
    }

    // Sync across tabs.
    window.addEventListener('storage', function (e) {
        if (e.key !== KEY) return;
        var v = e.newValue;
        html.setAttribute('data-theme', (v === 'light' || v === 'dark') ? v : (mql.matches ? 'dark' : 'light'));
        refresh();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }

    window.bleelblepTheme = { toggle: toggle, apply: apply, resolved: resolved };
})();
