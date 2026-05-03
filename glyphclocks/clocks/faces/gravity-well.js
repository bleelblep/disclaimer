// Gravity-Well — port of GravityWell.kt. Particles orbit a well at centre.
// Digit pixels light up when a particle crosses them (long afterglow on
// digits, short FAINT dust off-digit). Pure (frameIdx) function.

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const LOOP_FRAMES = 600;
const PARTICLE_COUNT = 36;
const MIN_R = 2.5;
const MAX_R = 12.5;
const ANGULAR_SCALE = 0.65;
const TRAIL_LENGTH = 4;
const DIGIT_TRAIL_LENGTH = 20;
const TRAIL_STEP = 1.5;
const GOLDEN_RATIO_INV = 0.6180339887;

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;

function frac(v) {
    const f = v - Math.trunc(v);
    return f < 0 ? f + 1 : f;
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

function digitMask(time) {
    const mask = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
    const ds = [(time.h / 10) | 0, time.h % 10, (time.m / 10) | 0, time.m % 10];
    stamp(mask, ds[0], X_LEFT, Y_HH);
    stamp(mask, ds[1], X_RIGHT, Y_HH);
    stamp(mask, ds[2], X_LEFT, Y_MM);
    stamp(mask, ds[3], X_RIGHT, Y_MM);
    return mask;
}

export const GravityWell = {
    id: "gravity-well",
    fps: 30,
    frameCount: LOOP_FRAMES,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const mask = digitMask(time);
        const cx = (LedCoords.GRID - 1) / 2;
        const cy = (LedCoords.GRID - 1) / 2;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const r = MIN_R + (MAX_R - MIN_R) * frac(i * GOLDEN_RATIO_INV);
            const phaseOffset = frac(i * GOLDEN_RATIO_INV * 1.31) * 2 * Math.PI;
            const omega = ANGULAR_SCALE / Math.pow(r, 1.5);

            for (let k = 0; k < DIGIT_TRAIL_LENGTH; k++) {
                const angle = frameIdx * omega + phaseOffset - k * omega * TRAIL_STEP;
                const px = cx + r * Math.cos(angle);
                const py = cy + r * Math.sin(angle);
                const xi = Math.round(px), yi = Math.round(py);
                if (xi < 0 || xi >= LedCoords.GRID) continue;
                if (yi < 0 || yi >= LedCoords.GRID) continue;

                const isDigit = mask[yi][xi];
                let b = 0;
                if (isDigit) {
                    const f = 1 - k / DIGIT_TRAIL_LENGTH;
                    const ramp = Math.sqrt(f);
                    b = (Brightness.FAINT + (Brightness.FULL - Brightness.FAINT) * ramp) | 0;
                } else if (k < TRAIL_LENGTH) {
                    const tf = 1 - k / TRAIL_LENGTH;
                    b = (Brightness.FAINT * tf) | 0;
                }
                if (b > frame.get(xi, yi)) frame.set(xi, yi, b);
            }
        }
        return frame;
    },
};
