// Scanline — port of Scanline.kt. CRT raster sweeps the time onto the
// matrix with a phosphor afterglow trail. Once-per-minute mode: one sweep
// then digits hold with banding until the loop wraps.

import { Brightness, CrtWide, Frame489, LedCoords } from "../core.js";

const X_LEFT = 6;
const X_RIGHT = X_LEFT + CrtWide.WIDTH + 1; // 13
const Y_HH = 4, Y_MM = 14;

const THICKNESS = 4;
const BEAM_PROFILE = [Brightness.BRIGHT, Brightness.FULL, Brightness.FULL, Brightness.BRIGHT];
const BEAM_GLOW_OFF_DIGIT = Brightness.FAINT;
const AFTERGLOW_DEPTH = 6;
const SCAN_DIVISOR = 2;
const ONCE_LOOP_FRAMES = 30 * 60;
const CONTINUOUS_LOOP_FRAMES = LedCoords.GRID * SCAN_DIVISOR;

function stamp(mask, d, x0, y0) {
    const rows = CrtWide.digitRows(d);
    for (let row = 0; row < CrtWide.HEIGHT; row++) {
        for (let col = 0; col < CrtWide.WIDTH; col++) {
            if (CrtWide.isPixelOn(rows, col, row)) {
                const mx = x0 + col, my = y0 + row;
                if (mx >= 0 && mx < LedCoords.GRID && my >= 0 && my < LedCoords.GRID) {
                    mask[my][mx] = true;
                }
            }
        }
    }
}

function paintBanded(frame, mask) {
    for (let y = 0; y < LedCoords.GRID; y++) {
        const b = (y & 1) === 0 ? Brightness.FULL : Brightness.MID;
        for (let x = 0; x < LedCoords.GRID; x++) {
            if (mask[y][x]) frame.set(x, y, b);
        }
    }
}

export const Scanline = {
    id: "scanline",
    fps: 30,
    onceMode: false,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const once = this.onceMode;
        const loopFrames = once ? ONCE_LOOP_FRAMES : CONTINUOUS_LOOP_FRAMES;
        const t = ((frameIdx % loopFrames) + loopFrames) % loopFrames;

        const mask = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
        stamp(mask, (time.h / 10) | 0, X_LEFT, Y_HH);
        stamp(mask, time.h % 10, X_RIGHT, Y_HH);
        stamp(mask, (time.m / 10) | 0, X_LEFT, Y_MM);
        stamp(mask, time.m % 10, X_RIGHT, Y_MM);

        const scanProgress = (t / SCAN_DIVISOR) | 0;
        const sweepDone = scanProgress >= LedCoords.GRID + AFTERGLOW_DEPTH;

        if (once && sweepDone) {
            paintBanded(frame, mask);
            return frame;
        }

        const scanY = once ? scanProgress : scanProgress % LedCoords.GRID;

        for (let y = 0; y < LedCoords.GRID; y++) {
            const bandTop = scanY;
            const bandBottom = scanY + THICKNESS - 1;
            const rowsBehind = bandTop - 1 - y;

            if (y >= bandTop && y <= bandBottom) {
                const beamB = BEAM_PROFILE[y - bandTop];
                for (let x = 0; x < LedCoords.GRID; x++) {
                    if (mask[y][x]) frame.set(x, y, beamB);
                    else frame.set(x, y, BEAM_GLOW_OFF_DIGIT);
                }
            } else if (rowsBehind >= 0 && rowsBehind < AFTERGLOW_DEPTH) {
                const rowBase = (y & 1) === 0 ? Brightness.FULL : Brightness.MID;
                const decay = 1 - rowsBehind / AFTERGLOW_DEPTH;
                const b = (rowBase * decay) | 0;
                if (b > 0) {
                    for (let x = 0; x < LedCoords.GRID; x++) {
                        if (mask[y][x]) frame.set(x, y, b);
                    }
                }
            } else if (once && rowsBehind >= AFTERGLOW_DEPTH) {
                const b = (y & 1) === 0 ? Brightness.FULL : Brightness.MID;
                for (let x = 0; x < LedCoords.GRID; x++) {
                    if (mask[y][x]) frame.set(x, y, b);
                }
            }
        }
        return frame;
    },
};
