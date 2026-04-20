// ── KONAMI CODE → FAMICOM MODE ───────────────────────────────
// Sequence: ↑ ↑ ↓ ↓ ← → ← → B A  (Gradius, NES, 1986)
// Persists across same-tab navigation via sessionStorage.
// Activates on landing / projects / about only, but state carries
// if the user navigates to a project sheet and back.

(function () {
    const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
                  'b', 'a'];
    const STORAGE_KEY = 'famicom';
    const SOUND_KEY = 'famicom_sound';
    const CUTE_STASH_KEY = 'famicom_cute_stash';

    let buffer = [];
    let audioCtx = null;
    let soundOn = sessionStorage.getItem(SOUND_KEY) === '1';

    function ensureChrome() {
        if (document.querySelector('.famicom-ribbon')) return;
        const ribbon = document.createElement('div');
        ribbon.className = 'famicom-ribbon';
        ribbon.innerHTML = '<b>♦</b> FAMICOM MODE · ESC TO EXIT';
        document.body.appendChild(ribbon);

        const sound = document.createElement('button');
        sound.type = 'button';
        sound.className = 'famicom-sound';
        sound.setAttribute('aria-label', 'Toggle sound');
        sound.textContent = soundOn ? '♪' : '×';
        sound.addEventListener('click', () => {
            soundOn = !soundOn;
            sessionStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
            sound.textContent = soundOn ? '♪' : '×';
            if (soundOn) playChime();
        });
        document.body.appendChild(sound);
    }

    function removeChrome() {
        document.querySelectorAll('.famicom-ribbon, .famicom-sound, .famicom-flash')
            .forEach(el => el.remove());
    }

    function flash() {
        const f = document.createElement('div');
        f.className = 'famicom-flash';
        document.body.appendChild(f);
        requestAnimationFrame(() => f.classList.add('on'));
        setTimeout(() => f.remove(), 360);
    }

    function playChime() {
        if (!soundOn) return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioCtx;
            const now = ctx.currentTime;
            // three-tone ascending NES "power up" — square wave
            const notes = [
                { f: 523.25, t: 0.00, d: 0.07 }, // C5
                { f: 659.25, t: 0.07, d: 0.07 }, // E5
                { f: 783.99, t: 0.14, d: 0.10 }, // G5
                { f: 1046.5, t: 0.24, d: 0.18 }  // C6
            ];
            notes.forEach(n => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = n.f;
                gain.gain.setValueAtTime(0.0, now + n.t);
                gain.gain.linearRampToValueAtTime(0.15, now + n.t + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + n.t);
                osc.stop(now + n.t + n.d + 0.02);
            });
        } catch (e) {}
    }

    // ── cute.js feature pausing ──────────────────────────────────
    // cute.js reads `data-feat-*` attributes on <body> to gate its
    // dots / hearts / wiggles. Strip them in Famicom mode, restore
    // on exit. Also clean up any live elements it spawned.
    function stashAndStripCute() {
        const body = document.body;
        const stash = {};
        for (const attr of Array.from(body.attributes)) {
            if (attr.name.startsWith('data-feat-')) {
                stash[attr.name] = attr.value;
                body.removeAttribute(attr.name);
            }
        }
        sessionStorage.setItem(CUTE_STASH_KEY, JSON.stringify(stash));
        // wipe already-spawned cute elements
        document.querySelectorAll(
            '.cute-ambient, .cute-heart, .cute-fab, .cute-panel, .cute-status'
        ).forEach(el => { el.style.display = 'none'; });
    }
    function restoreCute() {
        try {
            const stash = JSON.parse(sessionStorage.getItem(CUTE_STASH_KEY) || '{}');
            for (const k in stash) document.body.setAttribute(k, stash[k]);
        } catch (e) {}
        sessionStorage.removeItem(CUTE_STASH_KEY);
        document.querySelectorAll(
            '.cute-ambient, .cute-heart, .cute-fab, .cute-panel, .cute-status'
        ).forEach(el => { el.style.display = ''; });
    }

    function activate(withFx) {
        document.body.classList.add('famicom');
        sessionStorage.setItem(STORAGE_KEY, '1');
        stashAndStripCute();
        ensureChrome();
        if (withFx) {
            flash();
            playChime();
        }
    }

    function deactivate() {
        document.body.classList.remove('famicom');
        sessionStorage.removeItem(STORAGE_KEY);
        restoreCute();
        removeChrome();
    }

    // restore state on load (no flash/chime when returning from a project page)
    if (sessionStorage.getItem(STORAGE_KEY) === '1') {
        if (document.body) activate(false);
        else document.addEventListener('DOMContentLoaded', () => activate(false));
    }

    document.addEventListener('keydown', (e) => {
        // exit
        if (e.key === 'Escape' && document.body.classList.contains('famicom')) {
            deactivate();
            return;
        }
        // ignore when typing in a field
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        buffer.push(key);
        if (buffer.length > CODE.length) buffer.shift();
        if (buffer.length === CODE.length && buffer.every((k, i) => k === CODE[i])) {
            buffer = [];
            if (document.body.classList.contains('famicom')) return;
            activate(true);
        }
    });
})();
