// Load packs data
let allPacks = [];

async function loadPacks() {
    try {
        const response = await fetch('packs.json');
        const data = await response.json();
        allPacks = data.packs;
        renderPacks(allPacks);
    } catch (error) {
        console.error('Failed to load packs:', error);
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('empty-state').querySelector('p').textContent = 'Failed to load packs. Please try again later.';
    }
}

// Render pack cards
function renderPacks(packs) {
    const grid = document.getElementById('pack-grid');
    const emptyState = document.getElementById('empty-state');

    if (packs.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.querySelector('p').textContent = 'No packs match your search';
        return;
    }

    emptyState.style.display = 'none';

    grid.innerHTML = packs.map(pack => `
        <div class="pack-card" data-id="${pack.id}">
            <img src="${pack.previewImage}" alt="${pack.name}" class="pack-preview" loading="lazy" onerror="this.style.display='none'">
            <div class="pack-info">
                <div class="pack-header">
                    <h3 class="pack-name">${escapeHtml(pack.name)}</h3>
                    ${pack.featured ? '<span class="pack-badge">FEATURED</span>' : ''}
                </div>
                <p class="pack-author">by ${escapeHtml(pack.author)}</p>
                <p class="pack-description">${escapeHtml(pack.description)}</p>
                <div class="pack-meta">
                    <span>📦 ${pack.pixlingCount} pixling${pack.pixlingCount !== 1 ? 's' : ''}</span>
                    <span>⬇️ ${formatDownloads(pack.downloads)}</span>
                    <span>v${escapeHtml(pack.version)}</span>
                </div>
                <div class="pack-tags">
                    ${pack.categories.map(cat => `<span class="pack-tag">${escapeHtml(cat)}</span>`).join('')}
                </div>
                <div class="pack-actions">
                    <a href="${pack.downloadUrl}" class="pack-button pack-button-primary" onclick="trackDownload('${pack.id}')">Download</a>
                    ${pack.githubUrl ? `<a href="${pack.githubUrl}" target="_blank" rel="noopener noreferrer" class="pack-button pack-button-secondary">GitHub</a>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format download count
function formatDownloads(count) {
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
}

// Search functionality
document.getElementById('search').addEventListener('input', (e) => {
    filterAndRender();
});

// Sort functionality
document.getElementById('sort').addEventListener('change', (e) => {
    filterAndRender();
});

// Category filter
document.getElementById('category').addEventListener('change', (e) => {
    filterAndRender();
});

// Combined filter and render
function filterAndRender() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const sortBy = document.getElementById('sort').value;
    const category = document.getElementById('category').value;

    // Filter
    let filtered = allPacks.filter(pack => {
        const matchesSearch = pack.name.toLowerCase().includes(searchTerm) ||
                             pack.author.toLowerCase().includes(searchTerm) ||
                             pack.description.toLowerCase().includes(searchTerm) ||
                             pack.categories.some(cat => cat.toLowerCase().includes(searchTerm));
        const matchesCategory = category === 'all' || pack.categories.includes(category);
        return matchesSearch && matchesCategory;
    });

    // Sort
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'newest':
                return new Date(b.createdDate) - new Date(a.createdDate);
            case 'popular':
                return b.downloads - a.downloads;
            case 'name':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    renderPacks(filtered);
}

// Track download (client-side only - simple increment)
function trackDownload(packId) {
    console.log(`Downloaded: ${packId}`);
    // In the future, this could call an API to increment download count
}

// Initialize
loadPacks();

// Add leaves animation (same as other pages)
for (let i = 0; i < 12; i++) {
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.textContent = ['🍃', '🌿', '🍂'][Math.floor(Math.random() * 3)];
    leaf.style.left = Math.random() * 100 + '%';
    leaf.style.animationDuration = (18 + Math.random() * 10) + 's';
    leaf.style.animationDelay = -(Math.random() * 25) + 's';
    document.body.appendChild(leaf);
}
