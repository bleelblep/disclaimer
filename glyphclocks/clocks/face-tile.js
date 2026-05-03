// <face-tile face-id="plate"> — renders a glyphclocks face onto a canvas.
// Tiles start paused on a static preview frame; click toggles animation.
// Pauses automatically when scrolled offscreen.

import { LedCoords } from "./core.js";
import { getFace } from "./registry.js";

// Visual tuning — applied in the canvas, not in the face data.
const LED_RADIUS = 0.42;        // fraction of cell pitch
const HALO_RADIUS = 1.6;        // multiplier for glow halo on bright leds
const COLOR = "255, 255, 255";  // white leds
const DIM = "rgba(255, 255, 255, 0.06)"; // unlit cell
const BG = "#000000";

// Per-face static preview frame index. Used when the tile is paused so the
// thumbnail reads as the face rather than as a blank circle. Falls back to
// half the face's frameCount.
const PREVIEW_FRAME = {
    plate: 0,
    scanline: 60,                  // settled banded digits
    falling: 60 * 8 - 1,           // settled stack
    glitch: 60,                    // post-scramble, glitched
    slots: 199,                    // locked digits
    moire: 522,                    // digits visible (MORPH_IN_END + DIGITS/2)
    sonar: 30,                     // mid-ping
    numbers: 20,                   // mid first-digit transmission
    spirits: 0,                    // idle planchette
    floaty: 0,
    "compass-plate": 0,
    pendulum: 0,
    hypnosis: 105,                 // mid-spiral
    ripple: 30,                    // multiple rings
    "gravity-well": 60,            // particles spread out
    cymatics: 60,                  // wave fully developed
};

class FaceTile extends HTMLElement {
    static get observedAttributes() { return ["face-id"]; }

    constructor() {
        super();
        const root = this.attachShadow({ mode: "open" });
        root.innerHTML = `
            <style>
                :host { display: block; aspect-ratio: 1 / 1; position: relative; cursor: pointer; }
                canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; border-radius: 50%; }
                .frame {
                    position: absolute; inset: 0; border-radius: 50%;
                    box-shadow: inset 0 0 0 1.5px rgba(58,26,8,0.55);
                    pointer-events: none;
                    transition: box-shadow 0.2s;
                }
                :host(.playing) .frame { box-shadow: inset 0 0 0 1.5px rgba(200, 55, 45, 0.85); }
                .play {
                    position: absolute; inset: 0;
                    display: grid; place-items: center;
                    pointer-events: none;
                    transition: opacity 0.2s;
                }
                .play svg {
                    width: 28%; height: 28%;
                    fill: rgba(255, 255, 255, 0.75);
                    filter: drop-shadow(0 0 6px rgba(0,0,0,0.6));
                    transition: transform 0.15s;
                }
                :host(:hover) .play svg { transform: scale(1.1); fill: rgba(255, 255, 255, 0.95); }
                :host(.playing) .play { opacity: 0; }
            </style>
            <canvas></canvas>
            <div class="frame"></div>
            <div class="play" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
        `;
        this.canvas = root.querySelector("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.face = null;
        this.faceId = null;
        this._raf = 0;
        this._t0 = performance.now();
        this._lastFrameIdx = -1;
        this._visible = false;
        this._playing = false;
        this._dpr = Math.min(2, window.devicePixelRatio || 1);
        this._dims = { w: 0, h: 0 };
    }

    connectedCallback() {
        this._io = new IntersectionObserver((entries) => {
            this._visible = entries[0].isIntersecting;
            if (this._visible && this._playing) this._tick();
            else cancelAnimationFrame(this._raf);
        }, { rootMargin: "100px" });
        this._io.observe(this);

        this._ro = new ResizeObserver(() => this._resize());
        this._ro.observe(this);
        this._resize();

        this.addEventListener("click", this._onClick);
        this.setAttribute("role", "button");
        this.setAttribute("tabindex", "0");
        this.setAttribute("aria-pressed", "false");
        this.addEventListener("keydown", this._onKey);

        this._loadFace();
    }

    disconnectedCallback() {
        cancelAnimationFrame(this._raf);
        this._io?.disconnect();
        this._ro?.disconnect();
        this.removeEventListener("click", this._onClick);
        this.removeEventListener("keydown", this._onKey);
    }

    attributeChangedCallback(name, _old, value) {
        if (name === "face-id" && value !== this.faceId) {
            this.faceId = value;
            this.face = null;
            this._t0 = performance.now();
            this._lastFrameIdx = -1;
            this._loadFace();
        }
    }

    _onClick = () => {
        if (!this.face) return;
        this._setPlaying(!this._playing);
    };

    _onKey = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this._onClick();
        }
    };

    _setPlaying(p) {
        if (p === this._playing) return;
        this._playing = p;
        this.classList.toggle("playing", p);
        this.setAttribute("aria-pressed", p ? "true" : "false");
        if (p) {
            // Reset the time origin so each play-through starts from frame 0.
            this._t0 = performance.now();
            this._lastFrameIdx = -1;
            this._tick();
        } else {
            cancelAnimationFrame(this._raf);
            this._renderPreview();
        }
    }

    async _loadFace() {
        const id = this.getAttribute("face-id");
        if (!id) return;
        try {
            const face = await getFace(id);
            if (this.getAttribute("face-id") !== id) return; // changed mid-load
            this.face = face;
            this._renderPreview();
        } catch (e) {
            // Unknown / not-yet-ported face. Render the empty diamond so the
            // tile reads as a placeholder rather than an error.
            this.face = null;
            this._paint(new Uint8Array(LedCoords.COUNT));
        }
    }

    _resize() {
        const r = this.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width));
        const h = Math.max(1, Math.round(r.height));
        if (w === this._dims.w && h === this._dims.h) return;
        this._dims = { w, h };
        this.canvas.width = w * this._dpr;
        this.canvas.height = h * this._dpr;
        if (this.face) {
            if (this._playing) this._render();
            else this._renderPreview();
        }
    }

    _tick = () => {
        if (!this._visible || !this._playing || !this.face) return;
        this._render();
        const fps = this.face.fps || 0;
        if (fps > 0) this._raf = requestAnimationFrame(this._tick);
    };

    _render() {
        const face = this.face;
        if (!face) return;

        // Mock time — fixed at 14:25 like canonicalTime.
        const time = { h: 14, m: 25 };
        const elapsed = performance.now() - this._t0;
        const fps = face.fps || 0;
        const frameIdx = fps > 0
            ? Math.floor(elapsed * fps / 1000)
            : (face.frameCount ? face.frameCount - 1 : 0);
        if (frameIdx === this._lastFrameIdx && fps > 0) return;
        this._lastFrameIdx = frameIdx;

        let frame;
        try {
            frame = face.render(time, frameIdx);
        } catch (e) {
            console.error("[face-tile] render", face.id, e);
            return;
        }
        this._paint(frame.pixels);
    }

    _renderPreview() {
        const face = this.face;
        if (!face) return;
        const id = this.getAttribute("face-id");
        const idx = PREVIEW_FRAME[id] ?? face.previewFrameIdx ?? Math.max(0, ((face.frameCount || 1) - 1) >> 1);
        let frame;
        try {
            frame = face.render({ h: 14, m: 25 }, idx);
        } catch (e) {
            console.error("[face-tile] preview", id, e);
            return;
        }
        this._paint(frame.pixels);
    }

    _paint(pixels) {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);

        const pad = W * 0.06;
        const pitchX = (W - pad * 2) / LedCoords.GRID;
        const pitchY = (H - pad * 2) / LedCoords.GRID;
        const pitch = Math.min(pitchX, pitchY);
        const ox = (W - pitch * LedCoords.GRID) / 2;
        const oy = (H - pitch * LedCoords.GRID) / 2;
        const r = pitch * LED_RADIUS;

        // Halos for bright leds (additive).
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < pixels.length; i++) {
            const b = pixels[i];
            if (b < 128) continue;
            const x = LedCoords.x(i), y = LedCoords.y(i);
            const cx = ox + (x + 0.5) * pitch;
            const cy = oy + (y + 0.5) * pitch;
            const a = (b / 255) * 0.5;
            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * HALO_RADIUS * 2);
            grd.addColorStop(0, `rgba(${COLOR}, ${a})`);
            grd.addColorStop(1, `rgba(${COLOR}, 0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(cx, cy, r * HALO_RADIUS * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        for (let i = 0; i < pixels.length; i++) {
            const x = LedCoords.x(i), y = LedCoords.y(i);
            const cx = ox + (x + 0.5) * pitch;
            const cy = oy + (y + 0.5) * pitch;
            const b = pixels[i];
            ctx.fillStyle = (b === 0) ? DIM : `rgba(${COLOR}, ${b / 255})`;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

customElements.define("face-tile", FaceTile);
