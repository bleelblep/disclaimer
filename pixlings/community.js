/**
 * Community Packs JavaScript
 * Handles pack display, filtering, sorting, and GitHub API integration
 */

// Global state
let allItems = [];
let githubMetrics = new Map();
let githubClient = null;

// View tracking localStorage key
const VIEW_TRACKER_KEY = 'pixlings_viewed_items';

// Initialize GitHub API client
function initializeGitHubClient() {
    githubClient = new GitHubMetricsClient();
    console.log('GitHub API client initialized');
}

// View tracking utilities
class ViewTracker {
    static recordView(itemId) {
        try {
            const viewed = this.getViewedItems();
            if (!viewed.includes(itemId)) {
                viewed.push(itemId);
                localStorage.setItem(VIEW_TRACKER_KEY, JSON.stringify(viewed));
            }
        } catch (e) {
            console.warn('Failed to record view:', e);
        }
    }

    static getViewedItems() {
        try {
            const data = localStorage.getItem(VIEW_TRACKER_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    static hasViewed(itemId) {
        return this.getViewedItems().includes(itemId);
    }

    static isNew(itemId, createdDate) {
        const hasViewed = this.hasViewed(itemId);
        const daysSinceCreated = (Date.now() - new Date(createdDate).getTime()) / (24 * 60 * 60 * 1000);
        const isRecent = daysSinceCreated < 7;
        return !hasViewed && isRecent;
    }
}

// Load items from packs.json
async function loadItems() {
    try {
        // Try to fetch packs.json - works for both local and GitHub Pages
        const response = await fetch('packs.json');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Handle both old and new schema formats
        allItems = data.items || data.packs || [];

        console.log(`Loaded ${allItems.length} items from packs.json`);

        // Render immediately with static data
        filterAndRender();

        // Fetch fresh GitHub metrics in background
        fetchGitHubMetrics();

    } catch (error) {
        console.error('Failed to load items:', error);
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('empty-state').querySelector('p').textContent = 'Failed to load items. Please try again later.';
    }
}

// Fetch GitHub metrics for all items with GitHub repos
async function fetchGitHubMetrics() {
    if (!githubClient) {
        console.warn('GitHub client not initialized');
        return;
    }

    try {
        // Check rate limit first
        const rateLimit = await githubClient.checkRateLimit();
        if (rateLimit) {
            console.log(`GitHub API rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);

            if (rateLimit.remaining < 10) {
                console.warn('GitHub API rate limit low, using cached/static data');
                return;
            }
        }

        // Filter items with GitHub repos
        const itemsWithGithub = allItems.filter(item => item.githubRepo);

        if (itemsWithGithub.length === 0) {
            console.log('No items with GitHub repos to fetch metrics for');
            return;
        }

        console.log(`Fetching GitHub metrics for ${itemsWithGithub.length} items...`);

        // Fetch metrics with progress tracking
        githubMetrics = await githubClient.batchFetchMetrics(
            itemsWithGithub,
            (processed, total) => {
                console.log(`Fetching metrics: ${processed}/${total}`);
            }
        );

        console.log(`Fetched metrics for ${githubMetrics.size} items`);

        // Re-render with fresh GitHub data
        filterAndRender();

    } catch (error) {
        console.warn('Failed to fetch GitHub metrics:', error);
    }
}

// Render items
function renderItems(items) {
    const grid = document.getElementById('pack-grid');
    const emptyState = document.getElementById('empty-state');

    if (items.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.querySelector('p').textContent = 'No items match your search';
        return;
    }

    emptyState.style.display = 'none';

    grid.innerHTML = items.map(item => renderItemCard(item)).join('');
}

// Render individual item card
function renderItemCard(item) {
    const metrics = githubMetrics.get(item.id);
    const downloads = metrics?.downloads || item.downloadsStatic || item.downloads || 0;
    const lastUpdated = getLastUpdated(item, metrics);
    const trending = shouldShowTrendingBadge(item);
    const isNew = ViewTracker.isNew(item.id, item.createdDate);

    // Ensure item has a type
    const itemType = item.type || 'pack';
    const pixlingCount = item.pixlingCount || 1;

    return `
        <div class="pack-card" data-type="${itemType}" data-id="${item.id}">
            <div class="pack-preview-container">
                <img src="${item.previewImage}" alt="${escapeHtml(item.name)}"
                     class="pack-preview" loading="lazy"
                     onerror="this.style.display='none'">

                ${renderOverlayBadges(item, trending, isNew)}

                <div class="card-type">
                    ${renderTypeBadge(itemType, pixlingCount)}
                </div>
            </div>

            <div class="pack-info">
                <div class="pack-header">
                    <h3 class="pack-name">${escapeHtml(item.name)}</h3>
                </div>

                <p class="pack-author">by ${escapeHtml(item.author || 'Unknown')}</p>

                ${item.rating && item.rating > 0 ? renderRating(item.rating, item.ratingCount || 0) : ''}

                <p class="pack-description">${escapeHtml(item.description)}</p>

                ${renderMetrics(itemType, pixlingCount, downloads, lastUpdated)}

                <div class="pack-tags">
                    ${(item.tags || item.categories || []).slice(0, 4).map(tag =>
                        `<span class="pack-tag">${escapeHtml(tag)}</span>`
                    ).join('')}
                </div>

                <div class="pack-actions">
                    <a href="${item.downloadUrl}"
                       class="pack-button pack-button-primary"
                       onclick="trackDownload('${item.id}')">
                        Download
                    </a>
                    ${item.githubUrl ? `
                        <a href="${item.githubUrl}" target="_blank"
                           rel="noopener noreferrer"
                           class="pack-button pack-button-secondary">
                            GitHub
                        </a>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Render overlay badges (featured, trending, new)
function renderOverlayBadges(item, trending, isNew) {
    const badges = [];

    if (item.featured) {
        badges.push('<span class="badge-featured">⭐ FEATURED</span>');
    }

    if (trending) {
        badges.push('<span class="badge-trending">🔥 TRENDING</span>');
    }

    if (isNew) {
        badges.push('<span class="badge-new">✨ NEW</span>');
    }

    if (badges.length === 0) return '';

    return `
        <div class="card-badges">
            ${badges.join('')}
        </div>
    `;
}

// Render type badge
function renderTypeBadge(type, pixlingCount) {
    if (type === 'pack') {
        return `<span class="type-badge type-pack">📦 Pack (${pixlingCount})</span>`;
    } else {
        return `<span class="type-badge type-pixling">✨ Pixling</span>`;
    }
}

// Render rating display
function renderRating(rating, ratingCount) {
    const stars = renderStars(rating);
    return `
        <div class="pack-rating">
            <span class="rating-stars">${stars}</span>
            <span class="rating-text">${rating.toFixed(1)}</span>
            <span class="rating-count">(${ratingCount} ${ratingCount === 1 ? 'review' : 'reviews'})</span>
        </div>
    `;
}

// Render star rating
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating % 1) >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return '⭐'.repeat(fullStars) +
           (hasHalfStar ? '⭐' : '') +
           '☆'.repeat(emptyStars);
}

// Render metrics grid
function renderMetrics(itemType, pixlingCount, downloads, lastUpdated) {
    return `
        <div class="pack-metrics">
            <div class="metric">
                <span class="metric-icon">${itemType === 'pack' ? '📦' : '✨'}</span>
                <span class="metric-value">${pixlingCount}</span>
                <span class="metric-label">${pixlingCount === 1 ? 'pixling' : 'pixlings'}</span>
            </div>
            <div class="metric">
                <span class="metric-icon">⬇️</span>
                <span class="metric-value">${formatDownloads(downloads)}</span>
                <span class="metric-label">downloads</span>
            </div>
            <div class="metric">
                <span class="metric-icon">🕒</span>
                <span class="metric-value">${formatRelativeTime(lastUpdated)}</span>
                <span class="metric-label">updated</span>
            </div>
        </div>
    `;
}

// Get last updated date (GitHub API > manual field > created date)
function getLastUpdated(item, metrics) {
    const candidates = [
        metrics?.updatedAt,
        item.lastUpdated,
        item.createdDate
    ];
    for (const val of candidates) {
        if (val) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d;
        }
    }
    return null;
}

// Check if item should show trending badge
function shouldShowTrendingBadge(item) {
    // Manual trending flag
    if (item.trending) return true;

    // Or: high trending score (auto-calculated)
    const score = calculateTrendingScore(item, githubMetrics.get(item.id));
    return score > 10;
}

// Calculate trending score
function calculateTrendingScore(item, githubMetrics) {
    // Manual override
    if (item.trending) return 1000;

    const downloads = githubMetrics?.downloads || item.downloadsStatic || item.downloads || 0;
    const daysSincePublished = (Date.now() - new Date(item.createdDate).getTime()) / (24 * 60 * 60 * 1000);

    if (daysSincePublished <= 0) return 0;

    const downloadsPerDay = downloads / daysSincePublished;
    const recencyBoost = Math.max(0, 30 - daysSincePublished) / 30; // Higher for items < 30 days old

    return downloadsPerDay * (1 + recencyBoost);
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

// Format relative time
function formatRelativeTime(date) {
    if (!date || isNaN(date.getTime())) return 'unknown';
    const now = Date.now();
    const diff = now - date.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Filter and render items
function filterAndRender() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const typeFilter = document.getElementById('type-filter').value;
    const sortBy = document.getElementById('sort').value;
    const category = document.getElementById('category').value;
    const difficulty = document.getElementById('difficulty-filter').value;

    // Filter
    let filtered = allItems.filter(item => {
        // Search filter
        const matchesSearch =
            item.name.toLowerCase().includes(searchTerm) ||
            (item.author || '').toLowerCase().includes(searchTerm) ||
            item.description.toLowerCase().includes(searchTerm) ||
            (item.categories || []).some(cat => cat.toLowerCase().includes(searchTerm)) ||
            (item.tags || []).some(tag => tag.toLowerCase().includes(searchTerm)) ||
            (item.type || 'pack').toLowerCase().includes(searchTerm);

        // Type filter
        const matchesType = typeFilter === 'all' || (item.type || 'pack') === typeFilter;

        // Category filter
        const matchesCategory = category === 'all' ||
            (item.categories || []).includes(category) ||
            (item.tags || []).includes(category);

        // Difficulty filter
        const matchesDifficulty = difficulty === 'all' ||
            (item.difficulty || 'beginner') === difficulty;

        return matchesSearch && matchesType && matchesCategory && matchesDifficulty;
    });

    // Sort
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'newest':
                return new Date(b.createdDate) - new Date(a.createdDate);

            case 'popular': {
                const aMetrics = githubMetrics.get(a.id);
                const bMetrics = githubMetrics.get(b.id);
                const aDownloads = aMetrics?.downloads || a.downloadsStatic || a.downloads || 0;
                const bDownloads = bMetrics?.downloads || b.downloadsStatic || b.downloads || 0;
                return bDownloads - aDownloads;
            }

            case 'trending': {
                const aScore = calculateTrendingScore(a, githubMetrics.get(a.id));
                const bScore = calculateTrendingScore(b, githubMetrics.get(b.id));
                return bScore - aScore;
            }

            case 'rating': {
                const aRating = a.rating || 0;
                const bRating = b.rating || 0;
                if (bRating !== aRating) {
                    return bRating - aRating;
                }
                // Secondary sort by rating count
                return (b.ratingCount || 0) - (a.ratingCount || 0);
            }

            case 'updated': {
                const aUpdated = getLastUpdated(a, githubMetrics.get(a.id));
                const bUpdated = getLastUpdated(b, githubMetrics.get(b.id));
                return (bUpdated?.getTime() ?? 0) - (aUpdated?.getTime() ?? 0);
            }

            case 'name':
                return a.name.localeCompare(b.name);

            default:
                return 0;
        }
    });

    renderItems(filtered);
}

// Track download (with view tracking)
function trackDownload(itemId) {
    console.log(`Downloaded: ${itemId}`);
    ViewTracker.recordView(itemId);
}

// Refresh metrics button
async function refreshMetrics() {
    const button = document.getElementById('refresh-metrics');
    button.classList.add('refreshing');
    button.textContent = '⏳ Refreshing...';

    // Clear cache
    if (githubClient) {
        githubClient.clearCache();
    }

    // Re-fetch metrics
    await fetchGitHubMetrics();

    button.classList.remove('refreshing');
    button.textContent = '🔄 Refresh Metrics';
}

// Event listeners
document.getElementById('search').addEventListener('input', filterAndRender);
document.getElementById('type-filter').addEventListener('change', filterAndRender);
document.getElementById('sort').addEventListener('change', filterAndRender);
document.getElementById('category').addEventListener('change', filterAndRender);
document.getElementById('difficulty-filter').addEventListener('change', filterAndRender);
document.getElementById('refresh-metrics').addEventListener('click', refreshMetrics);

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeGitHubClient();
    loadItems();
});

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
