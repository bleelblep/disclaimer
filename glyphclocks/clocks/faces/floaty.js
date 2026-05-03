// Floaty — port of Floaty.kt. Per-cell water sim driven by a synthetic
// gravity vector (slow circular tilt) for the web preview. Volume comes
// from the minute, like the real face.

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;

const SPRING_K = 0.18;
const DIFFUSE_K = 0.32;
const DAMPING = 0.86;

const COUNT = LedCoords.COUNT;
const cells = (() => {
    const list = [];
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            const idx = LedCoords.indexOf(x, y);
            if (idx >= 0) list.push({ x, y, idx });
        }
    }
    return list;
})();

const waterAmount = new Float32Array(COUNT);
const waterVelocity = new Float32Array(COUNT);
const depths = new Float32Array(COUNT);
const depthsSorted = new Float32Array(COUNT);
const targetWater = new Uint8Array(COUNT);
const neighbourAvg = new Float32Array(COUNT);
let lastFrame = -1;
let warmedUp = false;

function stamp(mask, d, x0, y0) {
    const rows = PixelFallBold.digitRows(d);
    for (let row = 0; row < PixelFallBold.HEIGHT; row++) {
        for (let col = 0; col < PixelFallBold.WIDTH; col++) {
            if (PixelFallBold.isPixelOn(rows, col, row)) {
                const mx = x0 + col, my = y0 + row;
                if (mx >= 0 && mx < LedCoords.GRID && my >= 0 && my < LedCoords.GRID) mask[my][mx] = true;
            }
        }
    }
}

function neighbour(mask, x, y) {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < LedCoords.GRID && ny >= 0 && ny < LedCoords.GRID && mask[ny][nx]) return true;
        }
    }
    return false;
}

export const Floaty = {
    id: "floaty",
    fps: 30,
    frameCount: 30 * 60,
    render(time, frameIdx) {
        const frame = Frame489.blank();

        // Synthetic gravity — slow circle so the water sloshes visibly.
        // ~one full rotation every 12 s @ 30 fps = 360 frames.
        const angle = frameIdx * (Math.PI * 2 / 360);
        const mgx = Math.sin(angle);
        const mgy = Math.cos(angle);

        // Minute → volume.
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            depths[i] = (c.x - 12) * mgx + (c.y - 12) * mgy;
        }
        const minuteFrac = time.m / 60;
        const targetVolume = Math.max(0, Math.min(cells.length, (cells.length * minuteFrac) | 0));

        for (let i = 0; i < cells.length; i++) depthsSorted[i] = depths[i];
        // Partial sort would be faster but cells.length=489 isn't worth it.
        const slice = depthsSorted.subarray(0, cells.length);
        Array.prototype.sort.call(slice, (a, b) => a - b);
        let threshold;
        if (targetVolume <= 0) threshold = Number.POSITIVE_INFINITY;
        else if (targetVolume >= cells.length) threshold = Number.NEGATIVE_INFINITY;
        else threshold = slice[cells.length - targetVolume];

        targetWater.fill(0);
        for (let i = 0; i < cells.length; i++) {
            if (depths[i] >= threshold) targetWater[cells[i].idx] = 1;
        }

        if (!warmedUp || frameIdx <= lastFrame) {
            // First frame, or scrubbed backwards — snap to target.
            for (let i = 0; i < COUNT; i++) {
                waterAmount[i] = targetWater[i] ? 1 : 0;
                waterVelocity[i] = 0;
            }
            warmedUp = true;
        }
        lastFrame = frameIdx;

        // Neighbour averages.
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            let sum = 0, count = 0;
            const n1 = LedCoords.indexOf(c.x - 1, c.y); if (n1 >= 0) { sum += waterAmount[n1]; count++; }
            const n2 = LedCoords.indexOf(c.x + 1, c.y); if (n2 >= 0) { sum += waterAmount[n2]; count++; }
            const n3 = LedCoords.indexOf(c.x, c.y - 1); if (n3 >= 0) { sum += waterAmount[n3]; count++; }
            const n4 = LedCoords.indexOf(c.x, c.y + 1); if (n4 >= 0) { sum += waterAmount[n4]; count++; }
            neighbourAvg[c.idx] = count > 0 ? sum / count : waterAmount[c.idx];
        }

        // Step.
        for (let i = 0; i < COUNT; i++) {
            const target = targetWater[i] ? 1 : 0;
            waterVelocity[i] += SPRING_K * (target - waterAmount[i]);
            waterVelocity[i] += DIFFUSE_K * (neighbourAvg[i] - waterAmount[i]);
            waterVelocity[i] *= DAMPING;
            waterAmount[i] = Math.max(0, Math.min(1, waterAmount[i] + waterVelocity[i]));
        }

        // Digit silhouette.
        const mask = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
        stamp(mask, (time.h / 10) | 0, X_LEFT, Y_HH);
        stamp(mask, time.h % 10, X_RIGHT, Y_HH);
        stamp(mask, (time.m / 10) | 0, X_LEFT, Y_MM);
        stamp(mask, time.m % 10, X_RIGHT, Y_MM);

        // Render.
        for (let y = 0; y < LedCoords.GRID; y++) {
            for (let x = 0; x < LedCoords.GRID; x++) {
                const idx = LedCoords.indexOf(x, y);
                if (idx < 0) continue;
                const isDigit = mask[y][x];
                const w = waterAmount[idx];
                if (isDigit) {
                    if (w > 0.5) frame.set(x, y, Brightness.OFF);
                    else frame.set(x, y, Brightness.FULL);
                } else if (w > 0.08) {
                    const b = (Brightness.MID + (Brightness.BRIGHT - Brightness.MID) * w) | 0;
                    frame.set(x, y, b);
                } else if (neighbour(mask, x, y)) {
                    frame.set(x, y, Brightness.OFF);
                }
            }
        }
        return frame;
    },
};
