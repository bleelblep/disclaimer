// Moiré — port of Moire.kt. Two grating sines slide past each other; their
// product gives interference pattern. Periodically the time fades in
// through the pattern.

import { Brightness, Frame489, Hash, LedCoords, PixelFallBold } from "../core.js";

const MOIRE_FRAMES = 450;
const MORPH_FRAMES = 15;
const DIGITS_FRAMES = 60;

const MOIRE_END = MOIRE_FRAMES;
const MORPH_IN_END = MOIRE_END + MORPH_FRAMES;
const DIGITS_END = MORPH_IN_END + DIGITS_FRAMES;
const LOOP_FRAMES = DIGITS_END + MORPH_FRAMES;

const ANGLE1 = 0.0;
const PERIOD1 = 2.8;
const PERIOD2 = 3.2;
const ROT_RATE_PER_FRAME = 0.0034;
const REVEAL_SEED = 8429;
const BORDER_SEED = 1607;

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
                if (mx >= 0 && mx < LedCoords.GRID && my >= 0 && my < LedCoords.GRID) mask[my][mx] = true;
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

function drawMoire(frame, angle2) {
    const cosA1 = Math.cos(ANGLE1), sinA1 = Math.sin(ANGLE1);
    const cosA2 = Math.cos(angle2), sinA2 = Math.sin(angle2);
    const TWO_PI = Math.PI * 2;
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            const u1 = x * cosA1 + y * sinA1;
            const u2 = x * cosA2 + y * sinA2;
            const s1 = Math.sin(TWO_PI * u1 / PERIOD1);
            const s2 = Math.sin(TWO_PI * u2 / PERIOD2);
            const product = s1 * s2;
            let b = 0;
            if (product > 0.55) b = Brightness.BRIGHT;
            else if (product > 0.10) b = Brightness.MID;
            else if (product > -0.30) b = Brightness.FAINT;
            if (b > 0) frame.set(x, y, b);
        }
    }
}

function drawDigitsAndBorder(frame, time, alpha) {
    const mask = digitMask(time);
    const border = borderMask(mask);
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            if (!border[y][x]) continue;
            if (alpha >= 1 || Hash.rng(x, y, BORDER_SEED) < alpha) frame.set(x, y, 0);
        }
    }
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            if (!mask[y][x]) continue;
            if (alpha >= 1 || Hash.rng(x, y, REVEAL_SEED) < alpha) frame.set(x, y, Brightness.FULL);
        }
    }
}

export const Moire = {
    id: "moire",
    fps: 30,
    frameCount: LOOP_FRAMES,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const t = ((frameIdx % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
        const angle2 = (frameIdx * ROT_RATE_PER_FRAME) % (Math.PI * 2);
        drawMoire(frame, angle2);

        let digitAlpha = 0;
        if (t < MOIRE_END) digitAlpha = 0;
        else if (t < MORPH_IN_END) digitAlpha = (t - MOIRE_END) / MORPH_FRAMES;
        else if (t < DIGITS_END) digitAlpha = 1;
        else digitAlpha = 1 - (t - DIGITS_END) / MORPH_FRAMES;

        if (digitAlpha > 0) drawDigitsAndBorder(frame, time, digitAlpha);
        return frame;
    },
};
