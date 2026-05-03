// Numbers — port of NumbersClock.kt. Russian shortwave-station carrier
// drifts; once a minute the station "transmits" HHMM at centre. The web
// preview uses a synthetic clarity (always clean) since no gravity sensor.

import { Brightness, Frame489, LedCoords, PixelFont } from "../core.js";

const DIGITS = 4;
const SLOT_FRAMES = 39;
const TX_FRAMES = SLOT_FRAMES * DIGITS;
// Web preview: tight loop so HHMM is almost always visible. The Kotlin face
// runs a 60-second cycle with one 5.2-second transmission, but for a small
// preview tile that's mostly empty carrier — here we use a brief carrier-
// only beat between transmissions so the digits read continuously.
const CARRIER_GAP = 30; // 1 s of pure carrier between transmissions
const CYCLE_FRAMES = TX_FRAMES + CARRIER_GAP;
const CARRIER_PEAK = 180;
const DIGIT_PEAK = 220;

// Pseudo-RNG seeded by ms — used for static. Mulberry32 keeps it deterministic.
function mulberry32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function paintAA(frame, x, y, b) {
    if (b <= 0) return;
    if (x < 0 || x >= LedCoords.GRID || y < 0 || y >= LedCoords.GRID) return;
    const cur = frame.get(x, y);
    frame.set(x, y, Math.min(255, cur + b));
}

function renderCarrier(frame, nowMs, dim) {
    const baseY = 12;
    const amp = 6;
    const omega = Math.PI * 2;
    const phaseT = (nowMs % 4000) / 4000;
    for (let x = 0; x < 25; x++) {
        const u = x / 24;
        const y = baseY + amp * Math.sin(omega * (u - phaseT));
        const yi = Math.floor(y);
        const yf = y - yi;
        const peak = CARRIER_PEAK * dim;
        paintAA(frame, x, yi, ((1 - yf) * peak) | 0);
        paintAA(frame, x, yi + 1, (yf * peak) | 0);
    }
}

function renderStatic(frame, nowMs, clarity, dim) {
    const noiseAmt = 1 - clarity;
    if (noiseAmt < 0.01) return;
    const rng = mulberry32(((nowMs / 80) | 0));
    const count = (noiseAmt * 70) | 0;
    for (let i = 0; i < count; i++) {
        const x = (rng() * 25) | 0;
        const y = (rng() * 25) | 0;
        const b = ((((rng() * 120) | 0) + 60) * dim) | 0;
        paintAA(frame, x, y, b);
    }
}

function stampCentreDigit(frame, d, brightness) {
    const rows = PixelFont.digitRows(d);
    const x0 = 10, y0 = 9;
    for (let row = 0; row < PixelFont.HEIGHT; row++) {
        for (let col = 0; col < PixelFont.WIDTH; col++) {
            if (PixelFont.isPixelOn(rows, col, row)) frame.set(x0 + col, y0 + row, brightness);
        }
    }
}

function sequenceFor(time) {
    return [(time.h / 10) | 0, time.h % 10, (time.m / 10) | 0, time.m % 10];
}

export const Numbers = {
    id: "numbers",
    fps: 30,
    frameCount: CYCLE_FRAMES,
    // Synthetic clarity for the web preview. A little static keeps the
    // shortwave-station character without obscuring the digits.
    clarity: 0.85,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const phase = ((frameIdx % CYCLE_FRAMES) + CYCLE_FRAMES) % CYCLE_FRAMES;
        const inTx = phase < TX_FRAMES;
        const digitIdx = inTx ? Math.min(DIGITS - 1, (phase / SLOT_FRAMES) | 0) : -1;
        const withinSlotT = inTx ? ((phase - digitIdx * SLOT_FRAMES) / SLOT_FRAMES) : 0;

        // Map frameIdx to a synthetic ms-clock so the carrier scrolls smoothly.
        const nowMs = (frameIdx * 1000 / 30) | 0;
        const dim = inTx ? 0.35 : 1.0;
        renderCarrier(frame, nowMs, dim);
        renderStatic(frame, nowMs, this.clarity, dim);

        if (inTx && digitIdx >= 0) {
            let env;
            if (withinSlotT < 0.10) env = withinSlotT / 0.10;
            else if (withinSlotT > 0.85) env = Math.max(0, (1 - withinSlotT) / 0.15);
            else env = 1;
            const b = Math.max(0, Math.min(255, (env * DIGIT_PEAK) | 0));
            if (b > 0) stampCentreDigit(frame, sequenceFor(time)[digitIdx], b);
        }
        return frame;
    },
};
