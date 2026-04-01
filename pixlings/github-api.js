/**
 * GitHub API Client for Pixlings Community Hub
 *
 * Fetches real-time metrics from GitHub repositories including:
 * - Download counts from GitHub Releases
 * - Repository stars and watchers
 * - Last updated dates
 *
 * Features:
 * - Multi-layer caching (memory + localStorage)
 * - Rate limiting protection
 * - Batch fetching with throttling
 * - Graceful fallback handling
 */

const GITHUB_API_BASE = 'https://api.github.com';
const CACHE_DURATION_MEMORY = 10 * 60 * 1000; // 10 minutes
const CACHE_DURATION_STORAGE = 60 * 60 * 1000; // 1 hour (set to 60000 for 1 minute while testing)
const CACHE_KEY_PREFIX = 'gh_cache_';
const STORAGE_CACHE_KEY = 'pixlings_github_metrics_cache';

class GitHubMetricsClient {
    constructor() {
        this.memoryCache = new Map();
        this.loadCacheFromStorage();
    }

    /**
     * Load cache from localStorage on initialization
     */
    loadCacheFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_CACHE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                const now = Date.now();

                // Only load cache entries that haven't expired
                Object.entries(parsed).forEach(([key, entry]) => {
                    if (now - entry.timestamp < CACHE_DURATION_STORAGE) {
                        this.memoryCache.set(key, entry);
                    }
                });

                console.log(`Loaded ${this.memoryCache.size} cached metrics from storage`);
            }
        } catch (error) {
            console.warn('Failed to load cache from localStorage:', error);
        }
    }

    /**
     * Save cache to localStorage
     */
    saveCacheToStorage() {
        try {
            const cacheObject = {};
            this.memoryCache.forEach((value, key) => {
                cacheObject[key] = value;
            });
            localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(cacheObject));
        } catch (error) {
            console.warn('Failed to save cache to localStorage:', error);
        }
    }

    /**
     * Get cached data if still valid
     */
    getFromCache(key, maxAge = CACHE_DURATION_MEMORY) {
        const cached = this.memoryCache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > maxAge) {
            this.memoryCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Store data in cache
     */
    setCache(key, data) {
        this.memoryCache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Debounced save to localStorage (every 5 entries)
        if (this.memoryCache.size % 5 === 0) {
            this.saveCacheToStorage();
        }
    }

    /**
     * Get request headers for GitHub API
     */
    getHeaders() {
        return {
            'Accept': 'application/vnd.github.v3+json',
            // Optional: Add personal access token for higher rate limits
            // 'Authorization': 'token YOUR_TOKEN'
        };
    }

    /**
     * Check current rate limit status
     */
    async checkRateLimit() {
        try {
            const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Rate limit check failed: ${response.status}`);
            }

            const data = await response.json();
            return data.rate;
        } catch (error) {
            console.error('Failed to check rate limit:', error);
            return null;
        }
    }

    /**
     * Fetch release metrics for a repository
     * Returns download count, version, and publish date
     */
    async getReleaseMetrics(owner, repo, assetName) {
        const cacheKey = `${CACHE_KEY_PREFIX}${owner}/${repo}/release`;
        const cached = this.getFromCache(cacheKey, CACHE_DURATION_STORAGE);
        if (cached) {
            console.log(`Cache hit: ${owner}/${repo} release`);
            return cached;
        }

        try {
            const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`;
            console.log(`Fetching release: ${url}`);

            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} for ${owner}/${repo}`);
            }

            const release = await response.json();

            // Find the matching asset
            const asset = assetName
                ? release.assets.find(a => a.name === assetName)
                : release.assets[0]; // Use first asset if no name specified

            const metrics = {
                downloads: asset ? asset.download_count : 0,
                version: release.tag_name,
                publishedAt: release.published_at,
                updatedAt: release.published_at
            };

            this.setCache(cacheKey, metrics);
            return metrics;
        } catch (error) {
            console.warn(`Failed to fetch release metrics for ${owner}/${repo}:`, error);
            return null;
        }
    }

    /**
     * Fetch repository metadata (stars, watchers)
     */
    async getRepoMetrics(owner, repo) {
        const cacheKey = `${CACHE_KEY_PREFIX}${owner}/${repo}/repo`;
        const cached = this.getFromCache(cacheKey, CACHE_DURATION_STORAGE);
        if (cached) {
            console.log(`Cache hit: ${owner}/${repo} repo`);
            return cached;
        }

        try {
            const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
            console.log(`Fetching repo: ${url}`);

            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} for ${owner}/${repo}`);
            }

            const repoData = await response.json();

            const metrics = {
                stars: repoData.stargazers_count,
                watchers: repoData.watchers_count,
                updatedAt: repoData.updated_at
            };

            this.setCache(cacheKey, metrics);
            return metrics;
        } catch (error) {
            console.warn(`Failed to fetch repo metrics for ${owner}/${repo}:`, error);
            return null;
        }
    }

    /**
     * Batch fetch metrics for multiple items
     * Implements throttling to avoid hitting rate limits
     */
    async batchFetchMetrics(items, onProgress = null) {
        const results = new Map();
        const delayBetweenRequests = 100; // 100ms between requests

        // Check rate limit before starting
        const rateLimit = await this.checkRateLimit();
        if (rateLimit && rateLimit.remaining < 10) {
            console.warn(`GitHub API rate limit low: ${rateLimit.remaining} remaining. Using cached data only.`);
            return results;
        }

        let processed = 0;
        for (const item of items) {
            if (!item.githubRepo) {
                processed++;
                continue;
            }

            const [owner, repo] = item.githubRepo.split('/');
            if (!owner || !repo) {
                console.warn(`Invalid GitHub repo format: ${item.githubRepo}`);
                processed++;
                continue;
            }

            try {
                // Fetch release metrics
                const releaseMetrics = await this.getReleaseMetrics(
                    owner,
                    repo,
                    item.githubAssetName
                );

                await this.sleep(delayBetweenRequests);

                // Fetch repo metrics
                const repoMetrics = await this.getRepoMetrics(owner, repo);

                // Combine metrics
                results.set(item.id, {
                    ...releaseMetrics,
                    ...repoMetrics
                });

                processed++;

                // Call progress callback if provided
                if (onProgress) {
                    onProgress(processed, items.length);
                }

                await this.sleep(delayBetweenRequests);
            } catch (error) {
                console.error(`Error fetching metrics for ${item.id}:`, error);
                processed++;
            }
        }

        // Save final cache to localStorage
        this.saveCacheToStorage();

        return results;
    }

    /**
     * Sleep helper for throttling
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.memoryCache.clear();
        try {
            localStorage.removeItem(STORAGE_CACHE_KEY);
        } catch (error) {
            console.warn('Failed to clear localStorage cache:', error);
        }
    }
}

// Export for use in community.js
window.GitHubMetricsClient = GitHubMetricsClient;
