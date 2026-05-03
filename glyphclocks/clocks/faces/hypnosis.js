// Hypnosis — port of Hypnosis.kt. Two-arm Archimedean spiral spins, periodically
// morphs into the time, holds, then dissolves back into the spiral.

import { Brightness, Frame489, Hash, LedCoords, PixelFallBold } from "../core.js";

const SPIRAL_FRAMES_1 = 210;
const MORPH_FRAMES = 15;
const NUMBERS_FRAMES = 90;
const SPIRAL_FRAMES_2 = 30;

const SPIRAL_END_1 = SPIRAL_FRAMES_1;
const MORPH_IN_END = SPIRAL_END_1 + MORPH_FRAMES;
const NUMBERS_END = MORPH_IN_END + NUMBERS_FRAMES;
const MORPH_OUT_END = NUMBERS_END + MORPH_FRAMES;
const LOOP_FRAMES = MORPH_OUT_END + SPIRAL_FRAMES_2;

const ARM_COUNT = 2.0;
const PERIOD_R = 2.4;
const SPIN_RATE_PER_FRAME = 0.5 / 30;
const DIGIT_REVEAL_SEED = 7919;

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

function drawSpiral(frame, phase, alpha) {
    const cx = (LedCoords.GRID - 1) / 2;
    const cy = (LedCoords.GRID - 1) / 2;
    const TWO_PI = Math.PI * 2;
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            const dx = x - cx, dy = y - cy;
            const r = Math.hypot(dx, dy);
            const theta = Math.atan2(dy, dx);
            const raw = r / PERIOD_R + ARM_COUNT * theta / TWO_PI - phase;
            const modded = ((raw % 1) + 1) % 1;
            if (modded >= 0.5) continue;
            if (alpha >= 1 || Hash.rng(x, y) < alpha) frame.set(x, y, Brightness.BRIGHT);
        }
    }
}

function drawDigits(frame, time) {
    const mask = digitMask(time);
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            if (mask[y][x]) frame.set(x, y, Brightness.FULL);
        }
    }
}

function drawMorph(frame, time, phase, t, fromSpiralToDigits) {
    const windowStart = fromSpiralToDigits ? SPIRAL_END_1 : NUMBERS_END;
    const progress = Math.max(0, Math.min(MORPH_FRAMES, t - windowStart)) / MORPH_FRAMES;
    const spiralAlpha = fromSpiralToDigits ? 1 - progress : progress;
    const digitAlpha = fromSpiralToDigits ? progress : 1 - progress;

    drawSpiral(frame, phase, spiralAlpha);
    const mask = digitMask(time);
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            if (!mask[y][x]) continue;
            if (Hash.rng(x, y, DIGIT_REVEAL_SEED) < digitAlpha) {
                frame.set(x, y, Brightness.FULL);
            }
        }
    }
}

export const Hypnosis = {
    id: "hypnosis",
    fps: 30,
    frameCount: LOOP_FRAMES,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const t = ((frameIdx % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
        const phase = frameIdx * SPIN_RATE_PER_FRAME;

        if (t < SPIRAL_END_1)        drawSpiral(frame, phase, 1);
        else if (t < MORPH_IN_END)   drawMorph(frame, time, phase, t, true);
        else if (t < NUMBERS_END)    drawDigits(frame, time);
        else if (t < MORPH_OUT_END)  drawMorph(frame, time, phase, t, false);
        else                          drawSpiral(frame, phase, 1);

        return frame;
    },
};
