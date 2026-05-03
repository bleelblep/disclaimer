// Compass-Plate — port of CompassPlate.kt. The digits rotate to stay world-
// upright. The web preview drives gravity from a slow synthetic rotation so
// the picker shows the rotation behaviour clearly.

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;
const RIM_RADIUS = 11.0;

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

export const CompassPlate = {
    id: "compass-plate",
    fps: 5,
    frameCount: 1,
    render(time, frameIdx) {
        const frame = Frame489.blank();

        // Synthetic gravity — full rotation every 12 s @ 5 fps = 60 frames.
        // Pretends the phone is being slowly rolled.
        const phoneAngle = (frameIdx / 60) * Math.PI * 2;
        const gx = Math.sin(phoneAngle);
        const gy = Math.cos(phoneAngle);

        const theta = Math.atan2(-gx, gy);
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const mask = Array.from({ length: LedCoords.GRID }, () => new Array(LedCoords.GRID).fill(false));
        stamp(mask, (time.h / 10) | 0, X_LEFT,  Y_HH);
        stamp(mask, time.h % 10,       X_RIGHT, Y_HH);
        stamp(mask, (time.m / 10) | 0, X_LEFT,  Y_MM);
        stamp(mask, time.m % 10,       X_RIGHT, Y_MM);

        const cx = (LedCoords.GRID - 1) / 2;
        for (let y = 0; y < LedCoords.GRID; y++) {
            for (let x = 0; x < LedCoords.GRID; x++) {
                const ox = x - cx, oy = y - cx;
                const sx = ox * cosT + oy * sinT;
                const sy = -ox * sinT + oy * cosT;
                const sxi = Math.round(sx + cx);
                const syi = Math.round(sy + cx);
                if (sxi >= 0 && sxi < LedCoords.GRID && syi >= 0 && syi < LedCoords.GRID) {
                    if (mask[syi][sxi]) frame.set(x, y, Brightness.FULL);
                }
            }
        }

        // World-up tick — points opposite gravity.
        const tickX = Math.round(cx + RIM_RADIUS * -gx);
        const tickY = Math.round(cx + RIM_RADIUS * -gy);
        if (frame.get(tickX, tickY) === 0) frame.set(tickX, tickY, Brightness.FAINT);

        return frame;
    },
};
