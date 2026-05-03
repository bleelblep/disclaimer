// Falling — port of Falling.kt. Tetris as a clock — pieces fall, lock,
// the stack is the time. Repeat-mode loop ~8 s @ 60 fps so the web preview
// continually settles, holds, then collapses and rebuilds.

import { Brightness, Frame489, LedCoords } from "../core.js";

const X_LEFT = 5, X_RIGHT = 13, Y_HH = 2, Y_MM = 14;
const FALL_SPEED = 1;
const PIECE_INTERVAL = 8;
const OUTGOING_FRAMES = 16;
const DIGIT_STAGGER = 10;
const SHADOW_FRAMES = 4;
const REPEAT_LOOP_FRAMES = 60 * 8;

// Piece decompositions — flat [cx0,cy0, cx1,cy1, ...] arrays per piece.
const DIGIT_PIECES = [
    // 0
    [
        [1,8, 2,8, 3,8, 4,8, 5,8],
        [0,1, 1,1, 0,2, 1,2, 0,3, 1,3, 0,4, 1,4, 0,5, 1,5, 0,6, 1,6, 0,7, 1,7],
        [5,1, 6,1, 5,2, 6,2, 5,3, 6,3, 5,4, 6,4, 5,5, 6,5, 5,6, 6,6, 5,7, 6,7],
        [1,0, 2,0, 3,0, 4,0, 5,0],
    ],
    // 1
    [
        [1,8, 2,8, 3,8, 4,8, 5,8],
        [3,2, 4,2, 3,3, 4,3, 3,4, 4,4, 3,5, 4,5, 3,6, 4,6, 3,7, 4,7],
        [3,0, 4,0, 2,1, 3,1, 4,1],
    ],
    // 2
    [
        [0,8, 1,8, 2,8, 3,8, 4,8, 5,8, 6,8],
        [0,7, 1,7],
        [1,6, 2,6],
        [2,5, 3,5],
        [3,4, 4,4],
        [4,3, 5,3],
        [5,2, 6,2],
        [0,1, 1,1, 5,1, 6,1],
        [1,0, 2,0, 3,0, 4,0, 5,0],
    ],
    // 3
    [
        [1,8, 2,8, 3,8, 4,8, 5,8],
        [0,7, 1,7, 5,7, 6,7],
        [5,6, 6,6],
        [4,5, 5,5],
        [2,4, 3,4, 4,4, 5,4],
        [4,3, 5,3],
        [5,2, 6,2],
        [0,1, 1,1, 5,1, 6,1],
        [1,0, 2,0, 3,0, 4,0, 5,0],
    ],
    // 4
    [
        [5,5, 6,5, 5,6, 6,6, 5,7, 6,7, 5,8, 6,8],
        [0,4, 1,4, 2,4, 3,4, 4,4, 5,4, 6,4],
        [5,0, 6,0, 5,1, 6,1, 5,2, 6,2, 5,3, 6,3],
        [0,0, 1,0, 0,1, 1,1, 0,2, 1,2, 0,3, 1,3],
    ],
    // 5
    [
        [1,8, 2,8, 3,8, 4,8, 5,8],
        [0,7, 1,7, 5,7, 6,7],
        [5,4, 6,4, 5,5, 6,5, 5,6, 6,6],
        [0,3, 1,3, 2,3, 3,3, 4,3, 5,3],
        [0,1, 1,1, 0,2, 1,2],
        [0,0, 1,0, 2,0, 3,0, 4,0, 5,0, 6,0],
    ],
    // 6
    [
        [1,8, 2,8, 3,8, 4,8, 5,8],
        [0,5, 1,5, 5,5, 6,5, 0,6, 1,6, 5,6, 6,6, 0,7, 1,7, 5,7, 6,7],
        [0,4, 1,4, 2,4, 3,4, 4,4, 5,4],
        [0,2, 1,2, 0,3, 1,3],
        [1,1, 2,1],
        [2,0, 3,0, 4,0, 5,0],
    ],
    // 7
    [
        [1,6, 2,6, 1,7, 2,7, 1,8, 2,8],
        [2,5, 3,5],
        [2,4, 3,4],
        [3,3, 4,3],
        [4,2, 5,2],
        [5,1, 6,1],
        [0,0, 1,0, 2,0, 3,0, 4,0, 5,0, 6,0],
    ],
    // 8
    [
        [1,8, 2,8, 3,8, 4,8, 5,8],
        [0,5, 1,5, 5,5, 6,5, 0,6, 1,6, 5,6, 6,6, 0,7, 1,7, 5,7, 6,7],
        [1,4, 2,4, 3,4, 4,4, 5,4],
        [0,1, 1,1, 5,1, 6,1, 0,2, 1,2, 5,2, 6,2, 0,3, 1,3, 5,3, 6,3],
        [1,0, 2,0, 3,0, 4,0, 5,0],
    ],
    // 9
    [
        [1,8, 2,8, 3,8, 4,8],
        [4,7, 5,7],
        [5,5, 6,5, 5,6, 6,6],
        [1,4, 2,4, 3,4, 4,4, 5,4, 6,4],
        [0,1, 1,1, 5,1, 6,1, 0,2, 1,2, 5,2, 6,2, 0,3, 1,3, 5,3, 6,3],
        [1,0, 2,0, 3,0, 4,0, 5,0],
    ],
];

function drawOutgoing(frame, digit, x0, y0, t) {
    const pieces = DIGIT_PIECES[digit];
    const dy = t * FALL_SPEED;
    for (const piece of pieces) {
        for (let k = 0; k < piece.length; k += 2) {
            const cx = piece[k], cy = piece[k + 1];
            const my = y0 + cy + dy;
            if (my < LedCoords.GRID) frame.set(x0 + cx, my, Brightness.FULL);
        }
    }
}

function drawDigit(frame, digit, x0, y0, t) {
    if (t < 0) return;
    const pieces = DIGIT_PIECES[digit];
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const spawnFrame = i * PIECE_INTERVAL;
        const sinceSpawn = t - spawnFrame;
        if (sinceSpawn < 0) continue;

        let pieceMaxCy = 0, pieceMinCx = Infinity, pieceMaxCx = -Infinity;
        for (let k = 0; k < piece.length; k += 2) {
            const cx = piece[k], cy = piece[k + 1];
            if (cy > pieceMaxCy) pieceMaxCy = cy;
            if (cx < pieceMinCx) pieceMinCx = cx;
            if (cx > pieceMaxCx) pieceMaxCx = cx;
        }
        const fallDistance = y0 + pieceMaxCy + 1;
        const descended = Math.min(sinceSpawn * FALL_SPEED, fallDistance);
        const dy = descended - fallDistance;

        for (let k = 0; k < piece.length; k += 2) {
            const cx = piece[k], cy = piece[k + 1];
            const my = y0 + cy + dy;
            if (my >= 0) frame.set(x0 + cx, my, Brightness.FULL);
        }

        const framesSinceLock = sinceSpawn - fallDistance;
        if (framesSinceLock >= 0 && framesSinceLock < SHADOW_FRAMES) {
            const shadowY = y0 + pieceMaxCy + 1;
            const shadowB = ((Brightness.FAINT * (SHADOW_FRAMES - framesSinceLock)) / SHADOW_FRAMES) | 0;
            for (let cx = pieceMinCx; cx <= pieceMaxCx; cx++) {
                if (frame.get(x0 + cx, shadowY) === 0) frame.set(x0 + cx, shadowY, shadowB);
            }
        }
    }
}

export const Falling = {
    id: "falling",
    fps: 60,
    frameCount: REPEAT_LOOP_FRAMES,
    render(time, frameIdx) {
        const frame = Frame489.blank();
        const loop = REPEAT_LOOP_FRAMES;
        const t = ((frameIdx % loop) + loop) % loop;

        // Repeat-mode "outgoing" — same digits, falling off the bottom.
        if (t >= 1 && t <= OUTGOING_FRAMES) {
            drawOutgoing(frame, (time.h / 10) | 0, X_LEFT,  Y_HH, t);
            drawOutgoing(frame, time.h % 10,       X_RIGHT, Y_HH, t);
            drawOutgoing(frame, (time.m / 10) | 0, X_LEFT,  Y_MM, t);
            drawOutgoing(frame, time.m % 10,       X_RIGHT, Y_MM, t);
        }

        const incomingT = t - OUTGOING_FRAMES;
        drawDigit(frame, (time.h / 10) | 0, X_LEFT,  Y_HH, incomingT - 0 * DIGIT_STAGGER);
        drawDigit(frame, time.h % 10,       X_RIGHT, Y_HH, incomingT - 1 * DIGIT_STAGGER);
        drawDigit(frame, (time.m / 10) | 0, X_LEFT,  Y_MM, incomingT - 2 * DIGIT_STAGGER);
        drawDigit(frame, time.m % 10,       X_RIGHT, Y_MM, incomingT - 3 * DIGIT_STAGGER);

        return frame;
    },
};
