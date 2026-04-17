(function () {
    'use strict';

    var ABS = /^(?:[a-z]+:)?\/\//i;

    function resolve(base, src) {
        if (ABS.test(src) || src.startsWith('/')) return src;
        return base + src;
    }

    function normalize(items) {
        return items.map(function (item) {
            if (typeof item === 'string') return { src: item, caption: '', alt: '' };
            return {
                src: item.src,
                caption: item.caption || '',
                alt: item.alt || item.caption || ''
            };
        });
    }

    async function hydrate(el) {
        var base = el.getAttribute('data-gallery') || './images/';
        if (base && !base.endsWith('/')) base += '/';
        var manifestUrl = el.getAttribute('data-gallery-manifest') || './gallery.json';

        try {
            var res = await fetch(manifestUrl, { cache: 'no-cache' });
            if (!res.ok) throw new Error('manifest ' + res.status);
            var raw = await res.json();
            var items = normalize(Array.isArray(raw) ? raw : (raw.items || []));
            if (!items.length) {
                el.innerHTML = '<p class="gallery-empty">nothing here yet ~</p>';
                return;
            }
            render(el, items, base);
        } catch (err) {
            el.innerHTML = '<p class="gallery-empty">couldn\'t load gallery ( ˃ ⌑ ˂ )</p>';
            console.warn('gallery:', err);
        }
    }

    function render(el, items, base) {
        var grid = document.createElement('div');
        grid.className = 'gallery-grid';

        items.forEach(function (item, i) {
            var fig = document.createElement('figure');
            fig.className = 'gallery-item';

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gallery-thumb';
            btn.setAttribute('aria-label', 'View image ' + (i + 1) + (item.caption ? ': ' + item.caption : ''));

            var img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = resolve(base, item.src);
            img.alt = item.alt;
            btn.appendChild(img);
            fig.appendChild(btn);

            if (item.caption) {
                var cap = document.createElement('figcaption');
                cap.textContent = item.caption;
                fig.appendChild(cap);
            }

            btn.addEventListener('click', function () { openLightbox(items, i, base); });
            grid.appendChild(fig);
        });

        el.innerHTML = '';
        el.appendChild(grid);
    }

    var lb = null;
    var state = { items: [], index: 0, base: '' };

    function ensureLightbox() {
        if (lb) return lb;
        lb = document.createElement('dialog');
        lb.className = 'gallery-lightbox';
        lb.innerHTML =
            '<button type="button" class="gallery-lb-close" aria-label="Close gallery">✕</button>' +
            '<button type="button" class="gallery-lb-prev" aria-label="Previous image">‹</button>' +
            '<figure class="gallery-lb-figure">' +
                '<img alt="" class="gallery-lb-img">' +
                '<figcaption class="gallery-lb-caption"></figcaption>' +
            '</figure>' +
            '<button type="button" class="gallery-lb-next" aria-label="Next image">›</button>';
        document.body.appendChild(lb);

        lb.addEventListener('click', function (e) {
            if (e.target === lb) lb.close();
        });
        lb.querySelector('.gallery-lb-close').addEventListener('click', function () { lb.close(); });
        lb.querySelector('.gallery-lb-prev').addEventListener('click', function () { go(-1); });
        lb.querySelector('.gallery-lb-next').addEventListener('click', function () { go(1); });
        lb.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        });
        return lb;
    }

    function paint() {
        var item = state.items[state.index];
        var img = lb.querySelector('.gallery-lb-img');
        img.src = resolve(state.base, item.src);
        img.alt = item.alt;
        lb.querySelector('.gallery-lb-caption').textContent = item.caption;
        var multi = state.items.length > 1;
        lb.querySelector('.gallery-lb-prev').hidden = !multi;
        lb.querySelector('.gallery-lb-next').hidden = !multi;
    }

    function go(delta) {
        if (!state.items.length) return;
        state.index = (state.index + delta + state.items.length) % state.items.length;
        paint();
    }

    function openLightbox(items, index, base) {
        ensureLightbox();
        state = { items: items, index: index, base: base };
        paint();
        if (typeof lb.showModal === 'function') lb.showModal();
        else lb.setAttribute('open', '');
    }

    function boot() {
        document.querySelectorAll('[data-gallery]').forEach(hydrate);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
