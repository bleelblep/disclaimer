// Spirits — adaptation of SpiritsClock.kt for the web preview. The Kotlin
// version is a stateful particle/phase-machine driven by wall-clock millis;
// here we drive everything off frameIdx so the preview loops cleanly. The
// summoning fires every CYCLE_FRAMES instead of once a minute.

import { Frame489, Hash, LedCoords, PixelFallBold } from "../core.js";

const MATRIX = 25;
const CX = 12, CY = 12;

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;

// Web cycle — ~10 s @ 30 fps, with phase durations roughly matching the
// Kotlin ms values converted to frames.
const SUMMONING_F = 39;   // 1.3 s
const REVEAL_F    = 27;   // 0.9 s
const HOLD_F      = 60;   // 2.0 s
const FADING_F    = 27;   // 0.9 s
const ACTIVE_F    = SUMMONING_F + REVEAL_F + HOLD_F + FADING_F;
const IDLE_F      = 147;  // 4.9 s
const CYCLE_F     = IDLE_F + ACTIVE_F;

// Mist particle pool — stateless, each particle's trajectory is a pure
// function of (particleIdx, frameIdx) so the visual loops cleanly.
const MIST_COUNT = 18;
const MIST_LIFE = 135; // ~4.5s @ 30fps

function plotAA(frame, x, y, brightness) {
    if (brightness <= 0) return;
    const xi = x < 0 ? Math.floor(x) : (x | 0);
    const yi = y < 0 ? Math.floor(y) : (y | 0);
    const fx = x - xi, fy = y - yi;
    addPx(frame, xi,     yi,     (brightness * (1 - fx) * (1 - fy)) | 0);
    addPx(frame, xi + 1, yi,     (brightness * fx       * (1 - fy)) | 0);
    addPx(frame, xi,     yi + 1, (brightness * (1 - fx) * fy)       | 0);
    addPx(frame, xi + 1, yi + 1, (brightness * fx       * fy)       | 0);
}

function addPx(frame, x, y, delta) {
    if (delta <= 0) return;
    if (x < 0 || x >= MATRIX || y < 0 || y >= MATRIX) return;
    frame.set(x, y, Math.min(255, frame.get(x, y) + delta));
}

function smoothstep(t) {
    const u = Math.max(0, Math.min(1, t));
    return u * u * (3 - 2 * u);
}

function idlePulse(frameIdx) {
    const phase = (frameIdx % 105) / 105 * Math.PI * 2; // ~3.5s breath
    return 0.78 + 0.22 * ((Math.sin(phase) + 1) * 0.5);
}

function renderMist(frame, frameIdx, intensity) {
    if (intensity <= 0) return;
    for (let i = 0; i < MIST_COUNT; i++) {
        // Stagger spawn so the pool covers the whole cycle smoothly.
        const spawn = ((i * 17) % MIST_LIFE);
        const phase = ((frameIdx + spawn) % MIST_LIFE);
        const ageFrac = phase / MIST_LIFE;

        // Direction (left→right or right→left) depends on Hash on i.
        const fromLeft = Hash.rng(i, 1) > 0.5;
        const sx = fromLeft ? -1 : MATRIX + 1;
        const ex = fromLeft ? MATRIX + 1 : -1;
        const yStart = Hash.rng(i, 2) * MATRIX;
        const yDrift = (Hash.rng(i, 3) - 0.5) * MIST_LIFE * 0.04;

        const x = sx + (ex - sx) * ageFrac;
        const y = yStart + yDrift * ageFrac;

        const env = Math.sin(ageFrac * Math.PI);
        const baseBright = 60 + (130 - 60) * intensity;
        const b = (baseBright * env) | 0;
        plotAA(frame, x, y, b);
    }
}

function drawBigDigit(frame, d, x0, y0, brightness) {
    if (brightness <= 0) return;
    const rows = PixelFallBold.digitRows(d);
    for (let row = 0; row < PixelFallBold.HEIGHT; row++) {
        for (let col = 0; col < PixelFallBold.WIDTH; col++) {
            if (PixelFallBold.isPixelOn(rows, col, row)) {
                const px = x0 + col, py = y0 + row;
                if (px >= 0 && px < MATRIX && py >= 0 && py < MATRIX) {
                    frame.set(px, py, Math.max(frame.get(px, py), brightness));
                }
            }
        }
    }
}

function drawScrambleDigits(frame, frameIdx, brightnessFactor) {
    if (brightnessFactor <= 0) return;
    // Reseed every ~80ms ≈ every 2-3 frames @ 30fps.
    const seed = (frameIdx / 3) | 0;
    const h0 = (Hash.rng(seed, 1) * 10) | 0;
    const h1 = (Hash.rng(seed, 2) * 10) | 0;
    const m0 = (Hash.rng(seed, 3) * 10) | 0;
    const m1 = (Hash.rng(seed, 4) * 10) | 0;
    const b = Math.max(0, Math.min(255, (255 * brightnessFactor) | 0));
    drawBigDigit(frame, h0, X_LEFT,  Y_HH, b);
    drawBigDigit(frame, h1, X_RIGHT, Y_HH, b);
    drawBigDigit(frame, m0, X_LEFT,  Y_MM, b);
    drawBigDigit(frame, m1, X_RIGHT, Y_MM, b);
}

function drawTimeAnswer(frame, time, brightnessFactor) {
    if (brightnessFactor <= 0) return;
    const b = Math.max(0, Math.min(255, (255 * brightnessFactor) | 0));
    drawBigDigit(frame, (time.h / 10) | 0, X_LEFT,  Y_HH, b);
    drawBigDigit(frame, time.h % 10,       X_RIGHT, Y_HH, b);
    drawBigDigit(frame, (time.m / 10) | 0, X_LEFT,  Y_MM, b);
    drawBigDigit(frame, time.m % 10,       X_RIGHT, Y_MM, b);
}

// Planchette pixels — built from the 489-int diamond exported by the Glyph
// Matrix Editor (anim/planchette.json). Each entry is [lx, ly, brightness]
// in matrix-local coords relative to (CX, CY).
let PLANCHETTE = [];

const ROW_LENGTHS = [
    7, 11, 15, 17, 19, 21, 21, 23, 23,
    25, 25, 25, 25, 25, 25, 25,
    23, 23, 21, 21, 19, 17, 15, 11, 7,
];

export async function loadPlanchette(url) {
    if (PLANCHETTE.length > 0) return PLANCHETTE;
    const u = url ?? new URL("../../anim/planchette.json", import.meta.url);
    const r = await fetch(u);
    const j = await r.json();
    const diamond = j.frames[0].p;
    if (diamond.length !== 489) {
        throw new Error(`planchette.json frame size ${diamond.length} != 489`);
    }
    const out = [];
    let idx = 0;
    for (let row = 0; row < 25; row++) {
        const len = ROW_LENGTHS[row];
        const startCol = (25 - len) >> 1;
        for (let c = 0; c < len; c++) {
            const b = diamond[idx++];
            if (b === 0) continue;
            const lx = (startCol + c) - CX;
            const ly = row - CY;
            out.push([lx, ly, b]);
        }
    }
    PLANCHETTE = out;
    return PLANCHETTE;
}

function drawPlanchette(frame, ox, oy, opacity) {
    if (opacity <= 0) return;
    for (const entry of PLANCHETTE) {
        const px = CX + ox + entry[0];
        const py = CY + oy + entry[1];
        plotAA(frame, px, py, (entry[2] * opacity) | 0);
    }
}

function mistIntensityFor(phase, withinPhase) {
    if (phase === 0) return 0.5;                                 // IDLE
    if (phase === 1) return 0.5 + 0.5 * withinPhase;             // SUMMONING
    if (phase === 2) return 1.0;                                 // REVEAL
    if (phase === 3) return 0.7;                                 // HOLD
    if (phase === 4) return 0.7 * (1 - withinPhase);             // FADING
    return 0;
}

export const Spirits = {
    id: "spirits",
    fps: 30,
    frameCount: CYCLE_F,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const t = ((frameIdx % CYCLE_F) + CYCLE_F) % CYCLE_F;

        // Phase machine.
        let phase = 0, withinPhase = 0;
        if (t < IDLE_F) {
            phase = 0; withinPhase = t / IDLE_F;
        } else {
            const u = t - IDLE_F;
            if (u < SUMMONING_F) { phase = 1; withinPhase = u / SUMMONING_F; }
            else if (u < SUMMONING_F + REVEAL_F) { phase = 2; withinPhase = (u - SUMMONING_F) / REVEAL_F; }
            else if (u < SUMMONING_F + REVEAL_F + HOLD_F) { phase = 3; withinPhase = (u - SUMMONING_F - REVEAL_F) / HOLD_F; }
            else { phase = 4; withinPhase = (u - SUMMONING_F - REVEAL_F - HOLD_F) / FADING_F; }
        }

        renderMist(frame, frameIdx, mistIntensityFor(phase, withinPhase));

        switch (phase) {
            case 0: { // IDLE
                drawPlanchette(frame, 0, 0, idlePulse(frameIdx));
                break;
            }
            case 1: { // SUMMONING — wobble + dissolve to scramble
                const wx = Math.sin(frameIdx / 3) * 0.7 * withinPhase;
                const wy = Math.cos(frameIdx / 3.5) * 0.7 * withinPhase;
                const opacity = (0.85 + 0.15 * Math.sin(frameIdx / 4.5)) * (1 - withinPhase);
                drawPlanchette(frame, wx, wy, opacity);
                drawScrambleDigits(frame, frameIdx, withinPhase);
                break;
            }
            case 2: { // REVEAL — scramble locks into answer
                if (withinPhase < 0.5) {
                    drawScrambleDigits(frame, frameIdx, 1);
                } else {
                    const u = (withinPhase - 0.5) * 2;
                    const eased = smoothstep(u);
                    drawScrambleDigits(frame, frameIdx, 1 - eased);
                    drawTimeAnswer(frame, time, eased);
                }
                break;
            }
            case 3: { // HOLD
                drawTimeAnswer(frame, time, 1);
                break;
            }
            case 4: { // FADING
                drawTimeAnswer(frame, time, 1 - withinPhase);
                break;
            }
        }

        return frame;
    },
};
