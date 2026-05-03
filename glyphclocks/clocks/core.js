// Glyph matrix core — JS port of the Kotlin core (Frame489, LedCoords,
// Brightness, Hash, PixelFallBold, CrtWide, PixelFont). Stays as close to
// the source as possible so faces can be ported almost line-for-line.

export const Brightness = Object.freeze({
    OFF: 0,
    FAINT: 64,
    MID: 128,
    BRIGHT: 192,
    FULL: 255,
});

// 489-LED diamond layout on a 25x25 lattice. Mirrors LedCoords.kt.
const GRID = 25;
const ROW_LENGTHS = [
    7, 11, 15, 17, 19, 21, 21, 23, 23,
    25, 25, 25, 25, 25, 25, 25,
    23, 23, 21, 21, 19, 17, 15, 11, 7,
];

function buildLed() {
    const rowOffsets = new Int32Array(GRID);
    const rowStartCol = new Int32Array(GRID);
    let off = 0;
    for (let row = 0; row < GRID; row++) {
        rowOffsets[row] = off;
        rowStartCol[row] = (GRID - ROW_LENGTHS[row]) >> 1;
        off += ROW_LENGTHS[row];
    }
    const COUNT = off; // 489

    const latticeToIndex = new Int32Array(GRID * GRID).fill(-1);
    const xAt = new Int32Array(COUNT);
    const yAt = new Int32Array(COUNT);
    for (let row = 0; row < GRID; row++) {
        const len = ROW_LENGTHS[row];
        const sc = rowStartCol[row];
        const ro = rowOffsets[row];
        for (let c = 0; c < len; c++) {
            const x = sc + c;
            const idx = ro + c;
            xAt[idx] = x;
            yAt[idx] = row;
            latticeToIndex[row * GRID + x] = idx;
        }
    }
    return { COUNT, GRID, ROW_LENGTHS, rowOffsets, rowStartCol, latticeToIndex, xAt, yAt };
}

export const LedCoords = (() => {
    const b = buildLed();
    return {
        GRID: b.GRID,
        COUNT: b.COUNT,
        ROW_LENGTHS: b.ROW_LENGTHS,
        ROW_OFFSETS: b.rowOffsets,
        ROW_START_COL: b.rowStartCol,
        indexOf(x, y) {
            if (x < 0 || x >= b.GRID || y < 0 || y >= b.GRID) return -1;
            return b.latticeToIndex[y * b.GRID + x];
        },
        x(i) { return b.xAt[i]; },
        y(i) { return b.yAt[i]; },
    };
})();

export class Frame489 {
    constructor(pixels) {
        this.pixels = pixels ?? new Uint8Array(LedCoords.COUNT);
        if (this.pixels.length !== LedCoords.COUNT) {
            throw new Error(`Frame489 must have ${LedCoords.COUNT} pixels`);
        }
    }
    static blank() { return new Frame489(); }
    set(x, y, b) {
        const i = LedCoords.indexOf(x, y);
        if (i >= 0) this.pixels[i] = Math.max(0, Math.min(255, b | 0));
    }
    get(x, y) {
        const i = LedCoords.indexOf(x, y);
        return i >= 0 ? this.pixels[i] : 0;
    }
    fill(b) {
        const v = Math.max(0, Math.min(255, b | 0));
        this.pixels.fill(v);
    }
    copy() { return new Frame489(new Uint8Array(this.pixels)); }
}

// FNV-1a–style hash, ported from Hash.kt. Same constants so noise looks
// identical to the on-device version.
const M1 = 0x7feb352d | 0;
const M2 = 0x846ca68b | 0;
function imul32(a, b) { return Math.imul(a, b) | 0; }

export const Hash = {
    rng(s1, s2 = 0, s3 = 0) {
        let seed = s1 | 0;
        if (arguments.length >= 2) seed = mix(seed, s2 | 0);
        if (arguments.length >= 3) seed = mix(seed, s3 | 0);
        let h = seed;
        h ^= h >>> 16;
        h = imul32(h, M1);
        h ^= h >>> 15;
        h = imul32(h, M2);
        h ^= h >>> 16;
        return (h & 0x7fffffff) / 0x7fffffff;
    },
    rngInt(...args) {
        const max = args.pop();
        if (max <= 0) return 0;
        return Math.min(max - 1, Math.max(0, Math.floor(this.rng(...args) * max)));
    },
};

function mix(a, b) {
    const k = (0x9e3779b9 | 0);
    let h = a ^ ((b + k + (a << 6) + (a >> 2)) | 0);
    h ^= h >>> 16;
    return h | 0;
}

// 5x7 PixelFont (decimal time digits). Bit MSB = leftmost column.
export const PixelFont = (() => {
    const WIDTH = 5, HEIGHT = 7;
    const digits = [
        [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
        [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
        [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
        [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
        [0b10010, 0b10010, 0b10010, 0b11111, 0b00010, 0b00010, 0b00010],
        [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
        [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
        [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
        [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
        [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
    ];
    return {
        WIDTH, HEIGHT,
        digitRows(d) { return digits[d]; },
        isPixelOn(rows, col, row) {
            if (row < 0 || row >= rows.length) return false;
            if (col < 0 || col >= WIDTH) return false;
            return ((rows[row] >> (WIDTH - 1 - col)) & 1) === 1;
        },
        drawDigit(frame, d, x, y, b) {
            const r = digits[d];
            for (let row = 0; row < HEIGHT; row++) {
                for (let col = 0; col < WIDTH; col++) {
                    if (((r[row] >> (WIDTH - 1 - col)) & 1) === 1) {
                        frame.set(x + col, y + row, b);
                    }
                }
            }
        },
    };
})();

// 7x9 PixelFallBold — used by Plate, Falling, Hypnosis, Ripple.
export const PixelFallBold = (() => {
    const WIDTH = 7, HEIGHT = 9;
    const digits = [
        [0b0111110, 0b1100011, 0b1100011, 0b1100011, 0b1100011, 0b1100011, 0b1100011, 0b1100011, 0b0111110],
        [0b0001100, 0b0011100, 0b0001100, 0b0001100, 0b0001100, 0b0001100, 0b0001100, 0b0001100, 0b0111110],
        [0b0111110, 0b1100011, 0b0000011, 0b0000110, 0b0001100, 0b0011000, 0b0110000, 0b1100000, 0b1111111],
        [0b0111110, 0b1100011, 0b0000011, 0b0000110, 0b0011110, 0b0000110, 0b0000011, 0b1100011, 0b0111110],
        [0b1100011, 0b1100011, 0b1100011, 0b1100011, 0b1111111, 0b0000011, 0b0000011, 0b0000011, 0b0000011],
        [0b1111111, 0b1100000, 0b1100000, 0b1111110, 0b0000011, 0b0000011, 0b0000011, 0b1100011, 0b0111110],
        [0b0011110, 0b0110000, 0b1100000, 0b1100000, 0b1111110, 0b1100011, 0b1100011, 0b1100011, 0b0111110],
        [0b1111111, 0b0000011, 0b0000110, 0b0001100, 0b0011000, 0b0011000, 0b0110000, 0b0110000, 0b0110000],
        [0b0111110, 0b1100011, 0b1100011, 0b1100011, 0b0111110, 0b1100011, 0b1100011, 0b1100011, 0b0111110],
        [0b0111110, 0b1100011, 0b1100011, 0b1100011, 0b0111111, 0b0000011, 0b0000011, 0b0000110, 0b0111100],
    ];
    return {
        WIDTH, HEIGHT,
        digitRows(d) { return digits[d]; },
        isPixelOn(rows, col, row) {
            if (row < 0 || row >= rows.length) return false;
            if (col < 0 || col >= WIDTH) return false;
            return ((rows[row] >> (WIDTH - 1 - col)) & 1) === 1;
        },
    };
})();

// 6x7 CrtWide — used by Scanline.
export const CrtWide = (() => {
    const WIDTH = 6, HEIGHT = 7;
    const digits = [
        [0b011110, 0b110011, 0b110011, 0b110011, 0b110011, 0b110011, 0b011110],
        [0b001100, 0b011100, 0b001100, 0b001100, 0b001100, 0b001100, 0b011110],
        [0b011110, 0b110011, 0b000011, 0b001110, 0b011000, 0b110000, 0b111111],
        [0b111111, 0b000011, 0b000110, 0b011110, 0b000110, 0b110011, 0b011110],
        [0b110011, 0b110011, 0b110011, 0b110011, 0b111111, 0b000011, 0b000011],
        [0b111111, 0b110000, 0b110000, 0b111110, 0b000011, 0b110011, 0b011110],
        [0b001110, 0b011000, 0b110000, 0b111110, 0b110011, 0b110011, 0b011110],
        [0b111111, 0b000011, 0b000110, 0b001100, 0b011000, 0b011000, 0b011000],
        [0b011110, 0b110011, 0b110011, 0b011110, 0b110011, 0b110011, 0b011110],
        [0b011110, 0b110011, 0b110011, 0b011111, 0b000011, 0b000110, 0b011100],
    ];
    return {
        WIDTH, HEIGHT,
        digitRows(d) { return digits[d]; },
        isPixelOn(rows, col, row) {
            if (row < 0 || row >= rows.length) return false;
            if (col < 0 || col >= WIDTH) return false;
            return ((rows[row] >> (WIDTH - 1 - col)) & 1) === 1;
        },
    };
})();
