// Sonar — port of Sonar.kt. One ping per cycle, expanding from centre.
// As it crosses each digit pixel, that pixel echoes at FULL and decays.

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const LOOP_FRAMES = 60;
const RING_SPEED = 0.42;
const MAX_RING_R = 14.0;
const RING_THICKNESS = 1.6;
const ECHO_DECAY_PIXELS = 7.0;

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;

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

export const Sonar = {
    id: "sonar",
    fps: 30,
    frameCount: LOOP_FRAMES,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const mask = digitMask(time);
        const cx = (LedCoords.GRID - 1) / 2, cy = (LedCoords.GRID - 1) / 2;
        const t = ((frameIdx % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
        const ringR = t * RING_SPEED;

        for (let y = 0; y < LedCoords.GRID; y++) {
            for (let x = 0; x < LedCoords.GRID; x++) {
                const dx = x - cx, dy = y - cy;
                const r = Math.hypot(dx, dy);

                if (mask[y][x]) {
                    const since = ringR - r;
                    if (since >= 0 && since <= ECHO_DECAY_PIXELS) {
                        const a = 1 - since / ECHO_DECAY_PIXELS;
                        const b = (Brightness.FULL * a) | 0;
                        if (b > 0) frame.set(x, y, b);
                    }
                    continue;
                }

                if (ringR > MAX_RING_R) continue;
                const distFromRing = Math.abs(r - ringR);
                if (distFromRing > RING_THICKNESS) continue;
                const profile = 1 - distFromRing / RING_THICKNESS;
                let b = 0;
                if (profile > 0.65) b = Brightness.MID;
                else if (profile > 0.30) b = Brightness.FAINT;
                if (b > 0) frame.set(x, y, b);
            }
        }
        return frame;
    },
};
