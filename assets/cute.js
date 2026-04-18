/* bleelblep · cute features · drop-in behavior
 * Add <script defer src="/assets/cute.js"></script> near the end of <body>.
 * Auto-injects the tweaks FAB + panel and an ambient-dots container.
 *
 * Features are gated by body[data-feat-*] so they show up only when toggled on
 * in the panel (persisted to localStorage).
 *
 * Optional hooks you can sprinkle into your HTML:
 *   - <span class="hero-kaomoji">…</span>    ← kaomoji wiggle already hooks this
 *   - <span data-cute-kaomoji>…</span>        ← any other kaomoji you want to wiggle
 *   - <span data-cute-footer-kao>…</span>     ← element whose text the footer cycle replaces
 *   - <b id="statusText">…</b> inside the auto-injected .cute-status strip
 */

(function () {
    "use strict";

    var FEATURES = [
        { group: "micro-motion", key: "kaomoji-wiggle", name: "kaomoji wiggle",
          desc: "hover any kaomoji and it playfully tilts side-to-side ♡", default: true },

        { group: "ambient", key: "ambient", name: "floating bg dots",
          desc: "pastel dots drift gently up the page like dust motes. very quiet.", default: true },
        { group: "ambient", key: "heart-trail", name: "heart cursor trail",
          desc: "tiny hearts pop where you click — once per click, capped, never annoying", default: false },
        { group: "ambient", key: "footer-kao-cycle", name: "rotating footer kaomoji",
          desc: "the footer kaomoji cycles through a set every few seconds", default: false },

        { group: "content", key: "status", name: "\"right now\" status strip",
          desc: "a small pill under the hero like \"right now · tending to pixlings\"", default: true },
        { group: "content", key: "konami", name: "type-to-reveal easter egg",
          desc: "type <span class='k'>bleep</span> anywhere to trigger a tiny burst of hearts", default: true }
    ];

    var STATE_KEY = "bleelblep_feats_v2";
    var state = {};
    try { state = JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch (e) { state = {}; }
    if (!Object.keys(state).length) FEATURES.forEach(function (f) { state[f.key] = !!f.default; });

    function $id(id) { return document.getElementById(id); }

    /* ---------- scaffold: inject ambient container, FAB, panel ---------- */
    function ensureScaffold() {
        if (!document.querySelector(".cute-ambient")) {
            var amb = document.createElement("div");
            amb.className = "cute-ambient"; amb.id = "cuteAmbient";
            amb.setAttribute("aria-hidden", "true");
            document.body.insertBefore(amb, document.body.firstChild);
        }
        if (!$id("cuteFab")) {
            var fab = document.createElement("button");
            fab.type = "button"; fab.id = "cuteFab"; fab.className = "cute-fab";
            fab.innerHTML = '<span class="sp"></span>cute features';
            document.body.appendChild(fab);
        }
        if (!$id("cutePanel")) {
            var p = document.createElement("div");
            p.id = "cutePanel"; p.className = "cute-panel";
            p.innerHTML =
                '<div class="cute-panel-head">' +
                    '<div class="cute-panel-title"><span class="dot"></span>cute features</div>' +
                    '<button class="cute-panel-close" id="cutePanelClose" aria-label="close">✕</button>' +
                '</div>' +
                '<div class="cute-panel-body" id="cutePanelBody"></div>' +
                '<div class="cute-panel-footer">' +
                    '<span>toggle to preview · <span id="cuteOnCount">0</span> on</span>' +
                    '<div style="display:flex;gap:6px">' +
                        '<button id="cuteAllOff">clear</button>' +
                        '<button id="cuteAllOn">all</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(p);
        }
        // auto-inject status strip right after the hero, if not already present
        if (!document.querySelector(".cute-status")) {
            var hero = document.querySelector(".hero .container") || document.querySelector(".hero") || document.querySelector("header .container");
            if (hero) {
                var s = document.createElement("div");
                s.className = "cute-status"; s.setAttribute("aria-live", "polite");
                s.innerHTML = '<span class="blink"></span><span>right now · <b id="statusText">tending to pixlings</b></span>';
                hero.appendChild(s);
            }
        }
    }

    /* ---------- state + rendering ---------- */
    function applyState() {
        FEATURES.forEach(function (f) {
            document.body.setAttribute("data-feat-" + f.key, state[f.key] ? "on" : "off");
        });
        var n = 0; Object.keys(state).forEach(function (k) { if (state[k]) n++; });
        if ($id("cuteOnCount")) $id("cuteOnCount").textContent = n;
        var fab = $id("cuteFab");
        if (fab) fab.innerHTML = '<span class="sp"></span>cute features · ' + n;
        lifecycleAmbient(state.ambient);
        lifecycleStatus(state.status);
        lifecycleFooterKao(state["footer-kao-cycle"]);
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function renderPanel() {
        var body = $id("cutePanelBody"); if (!body) return;
        var groups = {};
        FEATURES.forEach(function (f) { (groups[f.group] = groups[f.group] || []).push(f); });
        var labels = { "micro-motion": "micro-motion", "ambient": "ambient touches", "content": "content & surprises" };
        var html = "";
        Object.keys(groups).forEach(function (g) {
            html += '<div class="cute-panel-sub">' + (labels[g] || g) + '</div>';
            groups[g].forEach(function (f) {
                var on = !!state[f.key];
                html +=
                    '<label class="cute-feat" data-on="' + on + '">' +
                        '<span class="cute-feat-name">' + f.name + '</span>' +
                        '<input type="checkbox" class="cute-toggle" data-key="' + f.key + '" ' + (on ? "checked" : "") + '>' +
                        '<span class="cute-feat-desc">' + f.desc + '</span>' +
                    '</label>';
            });
        });
        body.innerHTML = html;
        body.querySelectorAll(".cute-toggle").forEach(function (cb) {
            cb.addEventListener("change", function () {
                state[cb.dataset.key] = cb.checked;
                cb.closest(".cute-feat").setAttribute("data-on", cb.checked);
                applyState();
            });
        });
    }

    /* ---------- ambient dots ---------- */
    var ambientTimer = null;
    function lifecycleAmbient(on) {
        var wrap = $id("cuteAmbient"); if (!wrap) return;
        if (!on) {
            wrap.innerHTML = "";
            if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = null; }
            return;
        }
        if (ambientTimer) return;
        var colors = ["var(--pastel-pink, #F4B6BA)", "var(--pastel-peach, #F5D199)",
                      "var(--pastel-lavender, #C8B8E8)", "var(--pastel-warm, #F4A8D0)"];
        function spawn() {
            var d = document.createElement("div"); d.className = "dot";
            d.style.left = (Math.random() * 100) + "vw";
            d.style.background = colors[(Math.random() * colors.length) | 0];
            var dur = 14 + Math.random() * 12;
            d.style.animationDuration = dur + "s";
            var sz = (5 + Math.random() * 8).toFixed(1) + "px";
            d.style.width = sz; d.style.height = sz;
            wrap.appendChild(d);
            setTimeout(function () { d.remove(); }, dur * 1000 + 200);
        }
        for (var i = 0; i < 10; i++) setTimeout(spawn, i * 1400);
        ambientTimer = setInterval(spawn, 1600);
    }

    /* ---------- status strip ---------- */
    var STATUSES = [
        "tending to pixlings",
        "drawing tiny sprites",
        "sipping oolong ♡",
        "poking at slab",
        "watching glyph blink",
        "not taking dms"
    ];
    var statusTimer = null, statusIdx = 0;
    function lifecycleStatus(on) {
        var el = $id("statusText"); if (!el) return;
        if (!on) { if (statusTimer) { clearInterval(statusTimer); statusTimer = null; } return; }
        if (statusTimer) return;
        statusIdx = (Math.random() * STATUSES.length) | 0;
        el.textContent = STATUSES[statusIdx];
        statusTimer = setInterval(function () {
            statusIdx = (statusIdx + 1) % STATUSES.length;
            el.style.opacity = 0;
            setTimeout(function () {
                el.textContent = STATUSES[statusIdx];
                el.style.opacity = 1;
            }, 200);
        }, 4200);
    }

    /* ---------- footer kaomoji cycle ---------- */
    var KAOS = ["٩(ˊᗜˋ*)و", "(｡•ᴗ•｡)♡", "⸜(｡˃ ᵕ ˂ )⸝", "( ˃ ⌑ ˂ )", "(｡ŏ﹏ŏ)", "ʕ•ᴥ•ʔ", "(づ｡◕‿‿◕｡)づ"];
    var kaoTimer = null, kaoIdx = 0, kaoOriginal = null;
    function lifecycleFooterKao(on) {
        var el = document.querySelector("[data-cute-footer-kao]") || document.querySelector(".footer-kaomoji");
        if (!el) return;
        if (kaoOriginal === null) kaoOriginal = el.textContent;
        if (!on) {
            if (kaoTimer) { clearInterval(kaoTimer); kaoTimer = null; }
            el.textContent = kaoOriginal;
            return;
        }
        if (kaoTimer) return;
        kaoTimer = setInterval(function () {
            kaoIdx = (kaoIdx + 1) % KAOS.length;
            el.style.opacity = 0;
            setTimeout(function () { el.textContent = KAOS[kaoIdx]; el.style.opacity = 1; }, 180);
        }, 3400);
    }

    /* ---------- heart trail ---------- */
    var lastTrail = 0;
    document.addEventListener("click", function (e) {
        if (state["heart-trail"] !== true) return;
        // ignore clicks inside the panel/fab
        if (e.target.closest(".cute-panel") || e.target.closest(".cute-fab")) return;
        var now = Date.now(); if (now - lastTrail < 120) return; lastTrail = now;
        var h = document.createElement("span");
        h.className = "cute-heart-trail";
        h.textContent = ["♡", "ᥫ᭡", "⸜(｡˃ ᵕ ˂ )⸝", "♡"][Math.random() * 4 | 0];
        h.style.left = e.clientX + "px"; h.style.top = e.clientY + "px";
        document.body.appendChild(h);
        setTimeout(function () { h.remove(); }, 900);
    });

    /* ---------- konami / bleep ---------- */
    var typedBuf = "";
    window.addEventListener("keydown", function (e) {
        if (state.konami !== true) return;
        if (e.key && e.key.length === 1) typedBuf = (typedBuf + e.key.toLowerCase()).slice(-10);
        if (typedBuf.indexOf("bleep") !== -1) { typedBuf = ""; partyBurst(); }
    });
    function partyBurst() {
        for (var i = 0; i < 24; i++) {
            var h = document.createElement("span");
            h.className = "cute-heart-trail";
            h.textContent = ["♡", "✿", "♪", "(｡•ᴗ•｡)"][Math.random() * 4 | 0];
            h.style.left = (window.innerWidth / 2 + (Math.random() - .5) * 200) + "px";
            h.style.top = (window.innerHeight / 2 + (Math.random() - .5) * 120) + "px";
            h.style.fontSize = (12 + Math.random() * 18) + "px";
            h.style.animationDuration = (.7 + Math.random() * .8) + "s";
            document.body.appendChild(h);
            (function (node) { setTimeout(function () { node.remove(); }, 1800); })(h);
        }
    }

    /* ---------- boot ---------- */
    function boot() {
        ensureScaffold();
        var panel = $id("cutePanel");
        $id("cuteFab").addEventListener("click", function () { panel.classList.add("open"); });
        $id("cutePanelClose").addEventListener("click", function () { panel.classList.remove("open"); });
        $id("cuteAllOff").addEventListener("click", function () {
            FEATURES.forEach(function (f) { state[f.key] = false; });
            renderPanel(); applyState();
        });
        $id("cuteAllOn").addEventListener("click", function () {
            FEATURES.forEach(function (f) { state[f.key] = true; });
            renderPanel(); applyState();
        });
        renderPanel();
        applyState();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
