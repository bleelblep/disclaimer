/* ============================================================
   Pixlings Community — community.js
   Loads packs.json, renders pack cards, handles search/sort,
   submission form, and background GitHub metrics fetching.
   ============================================================ */

'use strict';

// --------------- State ---------------
let allPacks = [];
let githubMetrics = new Map(); // id → { downloads, updatedAt }
let githubClient = null;

// --------------- Init ---------------
window.addEventListener('DOMContentLoaded', init);

async function init() {
    githubClient = new GitHubMetricsClient();
    attachEventListeners();
    spawnLeaves();
    showSkeletons(6);
    await loadPacks();
    fetchMetricsBackground(); // non-blocking
}

function retryLoad() {
    hideErrorState();
    showSkeletons(6);
    loadPacks().then(() => fetchMetricsBackground());
}

// --------------- Data Loading ---------------
async function loadPacks() {
    try {
        const res = await fetch('packs.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        // Support both .items (v2) and .packs (legacy) schema
        allPacks = json.items || json.packs || [];
        renderGrid();
    } catch (err) {
        console.error('Failed to load packs.json:', err);
        showErrorState('Could not reach the packs registry. Check your connection and try again.');
    }
}

async function fetchMetricsBackground() {
    if (!githubClient) return;
    try {
        const result = await githubClient.batchFetchMetrics(allPacks);
        // batchFetchMetrics returns { metrics, rateLimited }
        const metrics = result && result.metrics ? result.metrics : result;
        const rateLimited = result && result.rateLimited;

        if (metrics) {
            metrics.forEach((data, id) => {
                githubMetrics.set(id, data);
            });
        }
        if (rateLimited) showApiNotice();
        renderGrid(); // refresh cards with live download counts
    } catch (err) {
        console.warn('Background metrics fetch failed:', err);
    }
}

// --------------- Rendering ---------------
function renderGrid() {
    const query = document.getElementById('search').value.trim().toLowerCase();
    const sortBy = document.getElementById('sort').value;

    let packs = filterPacks(allPacks, query);
    packs = sortPacks(packs, sortBy);

    if (packs.length === 0) {
        document.getElementById('pack-grid').innerHTML = '';
        showEmptyState(query
            ? `No packs match "${escapeHtml(query)}" — try a shorter term.`
            : 'No packs in the registry yet. Be the first to submit one!');
        return;
    }

    hideEmptyState();
    document.getElementById('pack-grid').innerHTML = packs.map(renderCard).join('');
}

function renderCard(pack) {
    const name    = escapeHtml(pack.name    || 'Unnamed Pack');
    const author  = escapeHtml(pack.author  || 'Unknown');
    const desc    = escapeHtml(pack.description || '');
    const type    = escapeHtml((pack.type || 'pack').toLowerCase());
    const count   = parseInt(pack.pixlingCount, 10) || 0;
    const dlUrl   = escapeHtml(pack.downloadUrl || '#');
    const ghUrl   = pack.githubUrl ? escapeHtml(pack.githubUrl) : '';
    const date    = pack.createdDate || pack.lastUpdated || '';
    const tags    = (pack.tags || pack.categories || []).slice(0, 4);

    const previewSrc  = escapeHtml(getPreviewSrc(pack));
    const dlCount     = formatDownloads(getDownloadCount(pack));
    const relDate     = formatRelativeDate(date);
    const countLabel  = count > 0 ? `📦 ${count} pixling${count !== 1 ? 's' : ''}` : type;

    const featuredBadge = pack.featured
        ? `<span class="badge badge-featured">Featured</span>`
        : '';

    const ghButton = ghUrl
        ? `<a href="${ghUrl}" class="pack-button pack-button-secondary" target="_blank" rel="noopener">GitHub</a>`
        : '';

    const tagsHtml = tags.length
        ? `<div class="pack-tags">${tags.map(t => `<span class="pack-tag">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

    // Use a safe inline onerror — name is already HTML-escaped, double-escaped for JS string
    const nameForJs = (pack.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const idForJs   = (pack.id   || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    return `
<div class="pack-card" data-id="${escapeHtml(pack.id || '')}">
  <div class="pack-preview-wrap">
    <img src="${previewSrc}" alt="${name}" class="pack-preview" loading="lazy"
         onerror="this.onerror=null;this.src=generatePlaceholderDataUrl('${nameForJs}','${idForJs}')">
    <div class="card-badges">${featuredBadge}</div>
    <span class="type-badge type-${type}">${escapeHtml(countLabel)}</span>
  </div>
  <div class="pack-info">
    <h3 class="pack-name">${name}</h3>
    <p class="pack-author">by ${author}</p>
    <p class="pack-desc">${desc}</p>
    <div class="pack-footer">
      <span class="pack-downloads">⬇ ${dlCount}</span>
      <span class="pack-date">${relDate}</span>
    </div>
    ${tagsHtml}
    <div class="pack-actions">
      <a href="${dlUrl}" class="pack-button pack-button-primary" download>Download</a>
      ${ghButton}
    </div>
  </div>
</div>`;
}

// --------------- Skeleton / States ---------------
function showSkeletons(n) {
    const skeleton = `
<div class="pack-card pack-card--skeleton" aria-hidden="true">
  <div class="pack-preview-wrap">
    <div class="skeleton skeleton--image"></div>
  </div>
  <div class="pack-info">
    <div class="skeleton skeleton--title" style="margin-top:4px"></div>
    <div class="skeleton skeleton--text skeleton--short"></div>
    <div class="skeleton skeleton--text" style="margin-top:8px"></div>
    <div class="skeleton skeleton--text"></div>
    <div class="skeleton skeleton--text skeleton--short"></div>
  </div>
</div>`;
    document.getElementById('pack-grid').innerHTML = skeleton.repeat(n);
    hideEmptyState();
    hideErrorState();
}

function showEmptyState(message) {
    const el = document.getElementById('empty-state');
    document.getElementById('empty-detail').textContent = message;
    el.hidden = false;
}
function hideEmptyState() {
    document.getElementById('empty-state').hidden = true;
}

function showErrorState(message) {
    document.getElementById('pack-grid').innerHTML = '';
    const el = document.getElementById('error-state');
    document.getElementById('error-detail').textContent = message;
    el.hidden = false;
    hideEmptyState();
}
function hideErrorState() {
    document.getElementById('error-state').hidden = true;
}

function showApiNotice() {
    document.getElementById('api-notice').hidden = false;
}

// --------------- Filter & Sort ---------------
function filterPacks(packs, query) {
    if (!query) return packs;
    return packs.filter(p => {
        const haystack = [
            p.name, p.author, p.description,
            ...(p.tags || []), ...(p.categories || [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });
}

function sortPacks(packs, by) {
    const sorted = [...packs];
    if (by === 'popular') {
        sorted.sort((a, b) => getDownloadCount(b) - getDownloadCount(a));
    } else if (by === 'name') {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
        // newest (default)
        sorted.sort((a, b) => {
            const da = new Date(b.createdDate || b.lastUpdated || 0);
            const db = new Date(a.createdDate || a.lastUpdated || 0);
            return da - db;
        });
    }
    return sorted;
}

// --------------- Image Helpers ---------------
function getPreviewSrc(pack) {
    // Prefer absolute URL → relative path → generated placeholder
    if (pack.previewImageUrl) return pack.previewImageUrl;
    if (pack.previewImage && pack.previewImage.startsWith('http')) return pack.previewImage;
    if (pack.previewImage) return pack.previewImage;
    return generatePlaceholderDataUrl(pack.name || '', pack.id || '');
}

function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return h >>> 0;
}

function generatePlaceholderDataUrl(name, id) {
    try {
        const seed = hashString(name + id);
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        const h1 = (seed % 360 + 360) % 360;
        const h2 = (h1 + 137) % 360; // golden angle offset — always visually distinct
        const grad = ctx.createLinearGradient(0, 0, 400, 200);
        grad.addColorStop(0, `hsl(${h1}, 35%, 55%)`);
        grad.addColorStop(1, `hsl(${h2}, 30%, 45%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 400, 200);
        const initials = name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 56px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials || '?', 200, 100);
        return canvas.toDataURL('image/png');
    } catch (e) {
        return ''; // canvas blocked — browser shows broken-img fallback
    }
}

// --------------- Metrics Helpers ---------------
function getDownloadCount(pack) {
    const live = githubMetrics.get(pack.id);
    if (live && typeof live.downloads === 'number') return live.downloads;
    return pack.downloadsStatic || pack.downloads || 0;
}

function formatDownloads(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
}

function formatRelativeDate(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days < 1)   return 'today';
    if (days < 7)   return `${days}d ago`;
    if (days < 30)  return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

// --------------- Submission Form ---------------
function attachEventListeners() {
    document.getElementById('search').addEventListener('input', renderGrid);
    document.getElementById('sort').addEventListener('change', renderGrid);
    document.getElementById('submit-form').addEventListener('submit', openSubmitIssue);
}

function validateSubmitForm() {
    const name     = document.getElementById('f-name').value.trim();
    const author   = document.getElementById('f-author').value.trim();
    const desc     = document.getElementById('f-desc').value.trim();
    const download = document.getElementById('f-download').value.trim();

    if (!name)     return { valid: false, message: 'Pack name is required.' };
    if (!author)   return { valid: false, message: 'GitHub username is required.' };
    if (!desc)     return { valid: false, message: 'Description is required.' };
    if (!download) return { valid: false, message: 'Download URL is required.' };

    try { new URL(download); } catch {
        return { valid: false, message: 'Download URL must be a valid URL (https://…).' };
    }

    const preview = document.getElementById('f-preview').value.trim();
    if (preview) {
        try { new URL(preview); } catch {
            return { valid: false, message: 'Preview image URL must be a valid URL (https://…).' };
        }
    }

    return { valid: true, message: '' };
}

function getFormData() {
    return {
        name:     document.getElementById('f-name').value.trim(),
        author:   document.getElementById('f-author').value.trim(),
        desc:     document.getElementById('f-desc').value.trim(),
        download: document.getElementById('f-download').value.trim(),
        preview:  document.getElementById('f-preview').value.trim() || 'none',
        count:    document.getElementById('f-count').value.trim() || '1',
    };
}

function buildIssueBody(data) {
    return [
        '## Pack Submission',
        '',
        `**Pack Name:** ${data.name}`,
        `**Author (GitHub):** @${data.author}`,
        `**Description:** ${data.desc}`,
        `**Download URL:** ${data.download}`,
        `**Preview Image:** ${data.preview}`,
        `**Pixling Count:** ${data.count}`,
        '',
        '---',
        '*Submitted via the Pixlings community page*',
    ].join('\n');
}

function showValidationMsg(message) {
    const el = document.getElementById('submit-validation');
    el.textContent = message;
    el.hidden = false;
}

function openSubmitIssue(e) {
    e.preventDefault();
    document.getElementById('submit-validation').hidden = true;

    const result = validateSubmitForm();
    if (!result.valid) {
        showValidationMsg(result.message);
        return;
    }

    const data  = getFormData();
    const title = encodeURIComponent(`New Pack: ${data.name}`);
    const body  = encodeURIComponent(buildIssueBody(data));
    const url   = `https://github.com/bleelblep/pixlings-docs/issues/new?title=${title}&labels=pack-submission&body=${body}`;
    window.open(url, '_blank', 'noopener');
}

// --------------- Leaf Animation ---------------
function spawnLeaves() {
    const emojis = ['🍃', '🌿', '🍂', '✨'];
    const count  = 8;
    for (let i = 0; i < count; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'leaf';
        leaf.textContent = emojis[i % emojis.length];
        leaf.style.left = `${Math.random() * 100}vw`;
        leaf.style.animationDuration = `${18 + Math.random() * 10}s`;
        leaf.style.animationDelay    = `${-Math.random() * 20}s`;
        document.body.appendChild(leaf);
    }
}

// --------------- Utility ---------------
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
}
