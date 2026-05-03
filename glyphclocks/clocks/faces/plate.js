// Plate — port of Plate.kt. Static face: textured plate background dim
// beneath, HH/MM at FULL on top, 1-pixel black halo punched out around
// every digit pixel.

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;
const BG_LEVEL = 50;

let bgFrame = null; // 489-int array, lazy-loaded

export async function loadPlateBg(url) {
    if (bgFrame) return bgFrame;
    const u = url ?? new URL("../../anim/plate_bg.json", import.meta.url);
    const r = await fetch(u);
    const j = await r.json();
    bgFrame = new Uint8Array(j.frames[0].p);
    if (bgFrame.length !== LedCoords.COUNT) {
        throw new Error(`plate_bg.json frame size ${bgFrame.length} != ${LedCoords.COUNT}`);
    }
    return bgFrame;
}

function stamp(mask, d, x0, y0) {
    const rows = PixelFallBold.digitRows(d);
    for (let row = 0; row < PixelFallBold.HEIGHT; row++) {
        for (let col = 0; col < PixelFallBold.WIDTH; col++) {
            if (PixelFallBold.isPixelOn(rows, col, row)) {
                const mx = x0 + col, my = y0 + row;
                if (mx >= 0 && mx < LedCoords.GRID && my >= 0 && my < LedCoords.GRID) {
                    mask[my][mx] = true;
                }
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

export const Plate = {
    id: "plate",
    fps: 0,
    frameCount: 1,
    render(time, _frameIdx) {
        const frame = Frame489.blank();
        if (bgFrame) {
            for (let i = 0; i < bgFrame.length; i++) {
                if (bgFrame[i] > 0) frame.pixels[i] = BG_LEVEL;
            }
        }

        const mask = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
        stamp(mask, (time.h / 10) | 0, X_LEFT, Y_HH);
        stamp(mask, time.h % 10, X_RIGHT, Y_HH);
        stamp(mask, (time.m / 10) | 0, X_LEFT, Y_MM);
        stamp(mask, time.m % 10, X_RIGHT, Y_MM);

        // Black halo around digits.
        for (let y = 0; y < LedCoords.GRID; y++) {
            for (let x = 0; x < LedCoords.GRID; x++) {
                if (mask[y][x]) continue;
                if (neighbour(mask, x, y)) frame.set(x, y, Brightness.OFF);
            }
        }
        // Digits at FULL.
        for (let y = 0; y < LedCoords.GRID; y++) {
            for (let x = 0; x < LedCoords.GRID; x++) {
                if (mask[y][x]) frame.set(x, y, Brightness.FULL);
            }
        }
        return frame;
    },
};
