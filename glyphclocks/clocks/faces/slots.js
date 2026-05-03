// Slots — port of Slots.kt. Four digit reels spin and decelerate L-to-R
// onto HH:MM with an easeOutBack settle. Plus a dim machine frame and
// bobbing colon. Background loaded from slots_clock.json.

import { Brightness, Frame489, LedCoords, PixelFont } from "../core.js";

const REEL_X = [1, 7, 13, 19];
const SEPARATOR_X = [6, 18];
const COLON_X = 12;
const Y_START = 9;
const DIGIT_STRIP_HEIGHT = 10 * PixelFont.HEIGHT; // 70

const SPIN_SPEED = 3;
const SPIN_FRAMES = 60;
const STAGGER_FRAMES = 14;
const SETTLE_FRAMES = 22;
const LAST_LOCK_FRAME = SPIN_FRAMES + 3 * STAGGER_FRAMES + SETTLE_FRAMES;
const LOOP_FRAMES = 200;

let bgFrame = null;

export async function loadSlotsBg(url) {
    if (bgFrame) return bgFrame;
    const u = url ?? new URL("../../anim/slots_clock.json", import.meta.url);
    const r = await fetch(u);
    const j = await r.json();
    bgFrame = new Uint8Array(j.frames[0].p);
    if (bgFrame.length !== LedCoords.COUNT) {
        throw new Error(`slots_clock.json frame size ${bgFrame.length} != ${LedCoords.COUNT}`);
    }
    return bgFrame;
}

function pow3(x) { return x * x * x; }
function pow2(x) { return x * x; }

function scrollPosAt(t, reelIdx, targetDigit) {
    const stopStart = SPIN_FRAMES + reelIdx * STAGGER_FRAMES;
    const stopEnd = stopStart + SETTLE_FRAMES;
    if (t < stopStart) {
        return ((t * SPIN_SPEED) % DIGIT_STRIP_HEIGHT + DIGIT_STRIP_HEIGHT) % DIGIT_STRIP_HEIGHT;
    } else if (t < stopEnd) {
        const spinEndPos = ((stopStart * SPIN_SPEED) % DIGIT_STRIP_HEIGHT + DIGIT_STRIP_HEIGHT) % DIGIT_STRIP_HEIGHT;
        const targetPos = targetDigit * PixelFont.HEIGHT;
        const need = ((targetPos - spinEndPos) + DIGIT_STRIP_HEIGHT) % DIGIT_STRIP_HEIGHT;
        const f = (t - stopStart) / SETTLE_FRAMES;
        const c1 = 1.70158, c3 = c1 + 1;
        const eased = 1 + c3 * pow3(f - 1) + c1 * pow2(f - 1);
        return ((spinEndPos + ((eased * need) | 0)) % DIGIT_STRIP_HEIGHT + DIGIT_STRIP_HEIGHT) % DIGIT_STRIP_HEIGHT;
    }
    return targetDigit * PixelFont.HEIGHT;
}

function brightnessAt(t, reelIdx) {
    const stopEnd = SPIN_FRAMES + reelIdx * STAGGER_FRAMES + SETTLE_FRAMES;
    return t >= stopEnd ? Brightness.FULL : Brightness.BRIGHT;
}

function drawReel(frame, reelX, scrollPos, brightness) {
    for (let row = 0; row < PixelFont.HEIGHT; row++) {
        const stripRow = ((scrollPos + row) % DIGIT_STRIP_HEIGHT + DIGIT_STRIP_HEIGHT) % DIGIT_STRIP_HEIGHT;
        const digit = (stripRow / PixelFont.HEIGHT) | 0;
        const digitRow = stripRow % PixelFont.HEIGHT;
        const bits = PixelFont.digitRows(digit);
        for (let col = 0; col < PixelFont.WIDTH; col++) {
            if (PixelFont.isPixelOn(bits, col, digitRow)) frame.set(reelX + col, Y_START + row, brightness);
        }
    }
}

function drawMachineFrame(frame) {
    const topY = Y_START - 1;
    const bottomY = Y_START + PixelFont.HEIGHT;
    for (let x = 1; x <= 23; x++) {
        frame.set(x, topY, Brightness.FAINT);
        frame.set(x, bottomY, Brightness.FAINT);
    }
    for (const sep of SEPARATOR_X) {
        frame.set(sep, topY, Brightness.MID);
        frame.set(sep, bottomY, Brightness.MID);
    }
}

export const Slots = {
    id: "slots",
    fps: 30,
    frameCount: LOOP_FRAMES,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const t = ((frameIdx % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;

        if (bgFrame) {
            for (let i = 0; i < bgFrame.length; i++) frame.pixels[i] = bgFrame[i];
        }
        drawMachineFrame(frame);

        const ds = [(time.h / 10) | 0, time.h % 10, (time.m / 10) | 0, time.m % 10];
        for (let i = 0; i < 4; i++) {
            const scrollPos = scrollPosAt(t, i, ds[i]);
            const bright = brightnessAt(t, i);
            drawReel(frame, REEL_X[i], scrollPos, bright);
        }

        const anySpinning = t < LAST_LOCK_FRAME;
        const bob = anySpinning ? Math.round(Math.sin(t * 0.30)) : 0;
        frame.set(COLON_X, Y_START + 1 + bob, Brightness.MID);
        frame.set(COLON_X, Y_START + 5 + bob, Brightness.MID);

        return frame;
    },
};
