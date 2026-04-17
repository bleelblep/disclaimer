#!/usr/bin/env node
// Regenerate gallery.json manifests from each project's ./images subfolder.
// Usage: node scripts/build-galleries.mjs

import { readdirSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const SKIP_DIRS = new Set(['assets', 'scripts', 'node_modules', '.git', '.github']);

function humanize(file) {
    return basename(file, extname(file))
        .replace(/^\d+[-_\s]+/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildFor(projectDir) {
    const imagesDir = join(projectDir, 'images');
    if (!existsSync(imagesDir) || !statSync(imagesDir).isDirectory()) return 0;

    const files = readdirSync(imagesDir)
        .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
        .sort();

    if (!files.length) return 0;

    // Preserve captions from a previous manifest so hand-edits survive regeneration.
    const manifestPath = join(projectDir, 'gallery.json');
    const existing = {};
    if (existsSync(manifestPath)) {
        try {
            const prev = JSON.parse(readFileSync(manifestPath, 'utf8'));
            const prevItems = Array.isArray(prev) ? prev : prev.items || [];
            for (const item of prevItems) {
                const key = typeof item === 'string' ? item : item.src;
                if (key) existing[key] = item;
            }
        } catch {}
    }

    const items = files.map((f) => {
        const prev = existing[f];
        if (prev && typeof prev === 'object') return prev;
        return { src: f, caption: humanize(f) };
    });

    const out = { generated: new Date().toISOString(), items };
    writeFileSync(manifestPath, JSON.stringify(out, null, 2) + '\n');
    return items.length;
}

function main() {
    const projects = readdirSync(ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name) && !d.name.startsWith('.'))
        .map((d) => join(ROOT, d.name));

    let total = 0;
    for (const p of projects) {
        const n = buildFor(p);
        if (n) {
            console.log(`  ${basename(p)}/gallery.json — ${n} image${n === 1 ? '' : 's'}`);
            total++;
        }
    }
    if (total === 0) console.log('  no galleries found.');
}

main();
