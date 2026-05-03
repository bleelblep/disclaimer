// Ripple — port of Ripple.kt. Concentric rings expand from the center of
// the diamond. Time digits sit in a "well" with a 1-px black halo; ring
// pixels under digits invert against the ring beneath.

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const RING_INTERVAL = 30;
const RING_DURATION = 90;
const RING_SPEED = 0.135;
const RING_THICKNESS = 1.4;
const FADE_BEGINS = 0.55;

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;

function digitMask(time) {
    const mask = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
    const ds = [(time.h / 10) | 0, time.h % 10, (time.m / 10) | 0, time.m % 10];
    stamp(mask, ds[0], X_LEFT, Y_HH);
    stamp(mask, ds[1], X_RIGHT, Y_HH);
    stamp(mask, ds[2], X_LEFT, Y_MM);
    stamp(mask, ds[3], X_RIGHT, Y_MM);
    return mask;
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

function borderMask(digit) {
    const border = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            if (digit[y][x]) continue;
            let adj = false;
            for (let dy = -1; dy <= 1 && !adj; dy++) {
                for (let dx = -1; dx <= 1 && !adj; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < LedCoords.GRID && ny >= 0 && ny < LedCoords.GRID && digit[ny][nx]) adj = true;
                }
            }
            border[y][x] = adj;
        }
    }
    return border;
}

// Floor division that rounds away from zero for negatives, matching Kotlin's
// `floorDivExclusive` helper in Ripple.kt.
function floorDivExclusive(n, d) {
    return n < 0 ? -Math.floor((-n + d - 1) / d) : Math.floor(n / d);
}

function ringBrightnessAt(x, y, frameIdx, cx, cy) {
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy);
    let best = 0;
    const firstK = floorDivExclusive(frameIdx - RING_DURATION + 1, RING_INTERVAL);
    const lastK = Math.floor(frameIdx / RING_INTERVAL);
    for (let k = firstK; k <= lastK; k++) {
        const age = frameIdx - k * RING_INTERVAL;
        if (age < 0 || age >= RING_DURATION) continue;
        const ringR = age * RING_SPEED;
        const distFromRing = Math.abs(r - ringR);
        if (distFromRing > RING_THICKNESS) continue;
        const profile = 1 - distFromRing / RING_THICKNESS;
        const ageFrac = age / RING_DURATION;
        const ageDecay = ageFrac < FADE_BEGINS ? 1 : (1 - (ageFrac - FADE_BEGINS) / (1 - FADE_BEGINS));
        const intensity = profile * ageDecay;
        if (intensity > best) best = intensity;
    }
    if (best > 0.70) return Brightness.BRIGHT;
    if (best > 0.35) return Brightness.MID;
    if (best > 0.10) return Brightness.FAINT;
    return 0;
}

function inverted(ringB) {
    if (ringB === Brightness.BRIGHT) return 0;
    if (ringB === Brightness.MID)    return Brightness.FAINT;
    if (ringB === Brightness.FAINT)  return Brightness.BRIGHT;
    return Brightness.FULL;
}

export const Ripple = {
    id: "ripple",
    fps: 30,
    frameCount: 60,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const mask = digitMask(time);
        const border = borderMask(mask);
        const cx = (LedCoords.GRID - 1) / 2, cy = (LedCoords.GRID - 1) / 2;

        for (let y = 0; y < LedCoords.GRID; y++) {
            for (let x = 0; x < LedCoords.GRID; x++) {
                const ringB = ringBrightnessAt(x, y, frameIdx, cx, cy);
                if (mask[y][x]) {
                    const inv = inverted(ringB);
                    if (inv > 0) frame.set(x, y, inv);
                } else if (border[y][x]) {
                    // halo — leave OFF
                } else if (ringB > 0) {
                    frame.set(x, y, ringB);
                }
            }
        }
        return frame;
    },
};
