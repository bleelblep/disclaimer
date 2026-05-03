// Pendulum — port of PendulumGravity.kt. Single-pendulum mode with a
// synthetic gravity that gently wobbles so the bob keeps swinging.

import { Brightness, Frame489, LedCoords, PixelFallBold } from "../core.js";

const PIVOT_X = 12, PIVOT_Y = 2;
const LENGTH = 13.0;
const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;

const OMEGA_SQ = 0.011;
const DAMPING = 0.99;
const INITIAL_PSI = 0.45;

let psi = INITIAL_PSI;
let psiVel = 0;
let lastFrame = -1;

function stampDigits(frame, time, level) {
    const ds = [(time.h / 10) | 0, time.h % 10, (time.m / 10) | 0, time.m % 10];
    stampBold(frame, ds[0], X_LEFT,  Y_HH, level);
    stampBold(frame, ds[1], X_RIGHT, Y_HH, level);
    stampBold(frame, ds[2], X_LEFT,  Y_MM, level);
    stampBold(frame, ds[3], X_RIGHT, Y_MM, level);
}

function stampBold(frame, d, x0, y0, level) {
    const rows = PixelFallBold.digitRows(d);
    for (let row = 0; row < PixelFallBold.HEIGHT; row++) {
        for (let col = 0; col < PixelFallBold.WIDTH; col++) {
            if (PixelFallBold.isPixelOn(rows, col, row)) frame.set(x0 + col, y0 + row, level);
        }
    }
}

function drawRod(frame, x0, y0, x1, y1, b) {
    const dx = x1 - x0, dy = y1 - y0;
    const steps = (Math.max(Math.abs(dx), Math.abs(dy))) | 0;
    if (steps === 0) return;
    for (let i = 1; i < steps; i++) {
        const tt = i / steps;
        const x = Math.round(x0 + dx * tt);
        const y = Math.round(y0 + dy * tt);
        frame.set(x, y, b);
    }
}

function drawBall(frame, cx, cy) {
    frame.set(cx - 1, cy - 1, Brightness.MID);
    frame.set(cx + 1, cy - 1, Brightness.MID);
    frame.set(cx - 1, cy + 1, Brightness.MID);
    frame.set(cx + 1, cy + 1, Brightness.MID);
    frame.set(cx,     cy - 1, Brightness.BRIGHT);
    frame.set(cx - 1, cy,     Brightness.BRIGHT);
    frame.set(cx + 1, cy,     Brightness.BRIGHT);
    frame.set(cx,     cy + 1, Brightness.BRIGHT);
    frame.set(cx, cy, Brightness.FULL);
}

export const Pendulum = {
    id: "pendulum",
    fps: 30,
    frameCount: 30 * 60,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        stampDigits(frame, time, Brightness.FAINT);

        // Reset state on backwards scrub.
        if (frameIdx <= lastFrame) {
            psi = INITIAL_PSI;
            psiVel = 0;
        }
        lastFrame = frameIdx;

        // Synthetic gravity wobbling slowly — keeps the pendulum animated
        // without the strict damping killing motion in the preview.
        const wobble = Math.sin(frameIdx / 90) * 0.18;
        const gx = Math.sin(wobble);
        const gy = Math.cos(wobble);
        const psiEq = Math.atan2(gx, gy);

        const deviation = psi - psiEq;
        psiVel += -OMEGA_SQ * Math.sin(deviation);
        psiVel *= DAMPING;
        psi += psiVel;

        const bobX = PIVOT_X + LENGTH * Math.sin(psi);
        const bobY = PIVOT_Y + LENGTH * Math.cos(psi);

        drawRod(frame, PIVOT_X, PIVOT_Y, bobX, bobY, Brightness.FAINT);
        frame.set(PIVOT_X, PIVOT_Y, Brightness.BRIGHT);
        drawBall(frame, Math.round(bobX), Math.round(bobY));
        return frame;
    },
};
