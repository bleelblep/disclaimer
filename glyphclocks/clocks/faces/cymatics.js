// Cymatics — port of Cymatics.kt. |sin(m·π·x) · sin(n·π·y)| Chladni-plate
// pattern; digits emerge through the wave by inversion. Pure frameIdx
// function (no audio input).

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const LOOP_FRAMES = 240;
const M_CENTER = 3.5, M_AMPLITUDE = 1.5;
const N_CENTER = 4.5, N_AMPLITUDE = 1.5;
const N_PERIOD_RATIO = 0.7;

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

function invertB(waveB) {
    if (waveB === Brightness.BRIGHT) return 0;
    if (waveB === Brightness.MID) return Brightness.FAINT;
    if (waveB === Brightness.FAINT) return Brightness.BRIGHT;
    return Brightness.FULL;
}

export const Cymatics = {
    id: "cymatics",
    fps: 30,
    frameCount: LOOP_FRAMES,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const mask = digitMask(time);
        const border = borderMask(mask);

        const t = ((frameIdx % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
        const phase = t / LOOP_FRAMES;
        const m = M_CENTER + M_AMPLITUDE * Math.sin(2 * Math.PI * phase);
        const n = N_CENTER + N_AMPLITUDE * Math.cos(2 * Math.PI * phase * N_PERIOD_RATIO);

        for (let y = 0; y < LedCoords.GRID; y++) {
            for (let x = 0; x < LedCoords.GRID; x++) {
                const nx = (x + 0.5) / LedCoords.GRID;
                const ny = (y + 0.5) / LedCoords.GRID;
                const a = Math.abs(Math.sin(m * Math.PI * nx) * Math.sin(n * Math.PI * ny));

                let waveB = 0;
                if (a > 0.70) waveB = Brightness.BRIGHT;
                else if (a > 0.45) waveB = Brightness.MID;
                else if (a > 0.18) waveB = Brightness.FAINT;

                if (mask[y][x]) {
                    const inv = invertB(waveB);
                    if (inv > 0) frame.set(x, y, inv);
                } else if (border[y][x]) {
                    // halo — leave OFF
                } else if (waveB > 0) {
                    frame.set(x, y, waveB);
                }
            }
        }
        return frame;
    },
};
