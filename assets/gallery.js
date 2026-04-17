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
            renderCarousel(el, items, base);
        } catch (err) {
            el.innerHTML = '<p class="gallery-empty">couldn\'t load gallery ( ˃ ⌑ ˂ )</p>';
            console.warn('gallery:', err);
        }
    }

    function renderCarousel(el, items, base) {
        var root = document.createElement('div');
        root.className = 'gallery-carousel';
        root.innerHTML =
            '<div class="carousel-rail" role="region" aria-roledescription="carousel" aria-label="image gallery">' +
                '<div class="carousel-track" tabindex="0"></div>' +
            '</div>' +
            '<div class="carousel-controls">' +
                '<button type="button" class="carousel-btn carousel-prev" aria-label="Previous image">‹</button>' +
                '<div class="carousel-dots" role="tablist" aria-label="Gallery pagination"></div>' +
                '<button type="button" class="carousel-btn carousel-next" aria-label="Next image">›</button>' +
            '</div>';

        var track = root.querySelector('.carousel-track');
        var dotsEl = root.querySelector('.carousel-dots');

        items.forEach(function (item, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'carousel-item';
            btn.dataset.index = String(i);
            btn.setAttribute('aria-label', 'Image ' + (i + 1) + ' of ' + items.length + (item.caption ? ': ' + item.caption : ''));

            var img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = resolve(base, item.src);
            img.alt = item.alt;
            btn.appendChild(img);

            if (item.caption) {
                var cap = document.createElement('span');
                cap.className = 'carousel-caption';
                cap.textContent = item.caption;
                btn.appendChild(cap);
            }
            track.appendChild(btn);

            var dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'carousel-dot';
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', 'Go to image ' + (i + 1));
            dot.dataset.index = String(i);
            dotsEl.appendChild(dot);
        });

        el.innerHTML = '';
        el.appendChild(root);

        var itemEls = Array.prototype.slice.call(track.querySelectorAll('.carousel-item'));
        var dotEls = Array.prototype.slice.call(dotsEl.querySelectorAll('.carousel-dot'));
        var prev = root.querySelector('.carousel-prev');
        var next = root.querySelector('.carousel-next');

        var activeIndex = 0;
        var rafPending = false;

        function setActive(i) {
            if (i === activeIndex) return;
            activeIndex = i;
            itemEls.forEach(function (e, j) { e.classList.toggle('is-active', j === i); });
            dotEls.forEach(function (e, j) {
                e.classList.toggle('is-active', j === i);
                e.setAttribute('aria-selected', j === i ? 'true' : 'false');
            });
            prev.disabled = i === 0;
            next.disabled = i === items.length - 1;
        }

        function scrollToIndex(i, smooth) {
            var target = itemEls[i];
            if (!target) return;
            target.scrollIntoView({ behavior: smooth === false ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
        }

        function updateActive() {
            rafPending = false;
            var rect = track.getBoundingClientRect();
            var centerX = rect.left + rect.width / 2;
            var bestI = 0, bestDist = Infinity;
            for (var j = 0; j < itemEls.length; j++) {
                var r = itemEls[j].getBoundingClientRect();
                var c = r.left + r.width / 2;
                var d = Math.abs(c - centerX);
                if (d < bestDist) { bestDist = d; bestI = j; }
            }
            setActive(bestI);
        }

        track.addEventListener('scroll', function () {
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(updateActive);
            }
        }, { passive: true });

        itemEls.forEach(function (btn, i) {
            btn.addEventListener('click', function () {
                if (i === activeIndex) {
                    openLightbox(items, i, base);
                } else {
                    scrollToIndex(i);
                }
            });
        });

        dotEls.forEach(function (dot, i) {
            dot.addEventListener('click', function () { scrollToIndex(i); });
        });

        prev.addEventListener('click', function () { scrollToIndex(Math.max(0, activeIndex - 1)); });
        next.addEventListener('click', function () { scrollToIndex(Math.min(items.length - 1, activeIndex + 1)); });

        root.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); scrollToIndex(Math.max(0, activeIndex - 1)); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); scrollToIndex(Math.min(items.length - 1, activeIndex + 1)); }
            else if (e.key === 'Home') { e.preventDefault(); scrollToIndex(0); }
            else if (e.key === 'End') { e.preventDefault(); scrollToIndex(items.length - 1); }
        });

        // Initial state — no scroll needed since padding centers the first item by default.
        setActive(0);
        requestAnimationFrame(updateActive);
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
