// Glitch — port of Glitch.kt. Bit flips + slice offsets + frame tear; once
// per minute the digits scramble and rebuild from noise.

import { Brightness, Frame489, Hash, LedCoords, PixelFallBold, PixelFont } from "../core.js";

const INTENSITY = 1.0;
const BIT_FLIP_CHANCE = 0.06;
const SLICE_DIVISOR = 8;
const SLICE_CHANCE = 0.04;
const TEAR_DIVISOR = 60;
const TEAR_CHANCE = 0.30;
const SCRAMBLE_FRAMES = 30;
const LOOP_FRAMES = 30 * 60;

const DIGIT_X_THIN = [1, 7, 13, 19];
const Y_BASE_THIN = 9;
const X_LEFT_BOLD = 5, X_RIGHT_BOLD = 13, Y_HH_BOLD = 2, Y_MM_BOLD = 14;

function stampThin(mask, d, x0, y0) {
    const rows = PixelFont.digitRows(d);
    for (let row = 0; row < PixelFont.HEIGHT; row++) {
        for (let col = 0; col < PixelFont.WIDTH; col++) {
            if (PixelFont.isPixelOn(rows, col, row)) {
                const mx = x0 + col, my = y0 + row;
                if (mx >= 0 && mx < LedCoords.GRID && my >= 0 && my < LedCoords.GRID) mask[my][mx] = true;
            }
        }
    }
}

function stampBold(mask, d, x0, y0) {
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

function renderScramble(frame, mask, t) {
    const progress = t / SCRAMBLE_FRAMES;
    for (let y = 0; y < LedCoords.GRID; y++) {
        for (let x = 0; x < LedCoords.GRID; x++) {
            if (!mask[y][x]) continue;
            if (Hash.rng(x, y) < progress) frame.set(x, y, Brightness.FULL);
            else if (Hash.rng(x, y, t) < 0.5) frame.set(x, y, Brightness.MID);
        }
    }
}

function renderGlitched(frame, mask, t, bold, flicker) {
    const yRanges = bold
        ? [[Y_HH_BOLD, Y_HH_BOLD + PixelFallBold.HEIGHT - 1], [Y_MM_BOLD, Y_MM_BOLD + PixelFallBold.HEIGHT - 1]]
        : [[Y_BASE_THIN, Y_BASE_THIN + PixelFont.HEIGHT - 1]];

    const sliceSeed = (t / SLICE_DIVISOR) | 0;
    const rowOffsets = new Int32Array(LedCoords.GRID);
    for (const [a, b] of yRanges) {
        for (let y = a; y <= b; y++) {
            if (Hash.rng(y, sliceSeed) < SLICE_CHANCE * INTENSITY) {
                rowOffsets[y] = Hash.rngInt(y, sliceSeed, 5) - 2;
            }
        }
    }

    const tearSeed = (t / TEAR_DIVISOR) | 0;
    const tearActive = Hash.rng(tearSeed) < TEAR_CHANCE * INTENSITY;
    const tearOffset = tearActive ? Hash.rngInt(tearSeed, 5) - 2 : 0;
    const tearY = (LedCoords.GRID / 2) | 0;

    for (const [a, b] of yRanges) {
        for (let y = a; y <= b; y++) {
            const totalOffset = rowOffsets[y] + (y >= tearY ? tearOffset : 0);
            for (let x = 0; x < LedCoords.GRID; x++) {
                const srcX = x - totalOffset;
                if (srcX < 0 || srcX >= LedCoords.GRID) continue;
                if (!mask[y][srcX]) continue;
                const flippedOff = flicker && Hash.rng(x, y, t) < BIT_FLIP_CHANCE * INTENSITY;
                if (!flippedOff) frame.set(x, y, Brightness.FULL);
            }
        }
    }
}

export const Glitch = {
    id: "glitch",
    fps: 30,
    frameCount: LOOP_FRAMES,
    boldLayout: false,
    flickerEnabled: true,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const t = ((frameIdx % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;

        const mask = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
        const ds = [(time.h / 10) | 0, time.h % 10, (time.m / 10) | 0, time.m % 10];

        if (this.boldLayout) {
            stampBold(mask, ds[0], X_LEFT_BOLD,  Y_HH_BOLD);
            stampBold(mask, ds[1], X_RIGHT_BOLD, Y_HH_BOLD);
            stampBold(mask, ds[2], X_LEFT_BOLD,  Y_MM_BOLD);
            stampBold(mask, ds[3], X_RIGHT_BOLD, Y_MM_BOLD);
        } else {
            for (let i = 0; i < 4; i++) stampThin(mask, ds[i], DIGIT_X_THIN[i], Y_BASE_THIN);
        }

        if (t < SCRAMBLE_FRAMES) renderScramble(frame, mask, t);
        else                      renderGlitched(frame, mask, t, this.boldLayout, this.flickerEnabled);

        return frame;
    },
};
