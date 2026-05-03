// Face registry. Lazily imports each face module on first use so we only pay
// the parse cost for faces actually visible in the viewport.

const loaders = {
    plate:    () => import("./faces/plate.js").then(m => m.Plate),
    scanline: () => import("./faces/scanline.js").then(m => m.Scanline),
    hypnosis: () => import("./faces/hypnosis.js").then(m => m.Hypnosis),
    ripple:   () => import("./faces/ripple.js").then(m => m.Ripple),
    falling:  () => import("./faces/falling.js").then(m => m.Falling),
    glitch:   () => import("./faces/glitch.js").then(m => m.Glitch),
    slots:    () => import("./faces/slots.js").then(m => m.Slots),
    moire:    () => import("./faces/moire.js").then(m => m.Moire),
    sonar:    () => import("./faces/sonar.js").then(m => m.Sonar),
    numbers:  () => import("./faces/numbers.js").then(m => m.Numbers),
    spirits:  () => import("./faces/spirits.js").then(m => m.Spirits),
    floaty:   () => import("./faces/floaty.js").then(m => m.Floaty),
    "compass-plate": () => import("./faces/compass-plate.js").then(m => m.CompassPlate),
    pendulum:        () => import("./faces/pendulum.js").then(m => m.Pendulum),
    "gravity-well":  () => import("./faces/gravity-well.js").then(m => m.GravityWell),
    cymatics:        () => import("./faces/cymatics.js").then(m => m.Cymatics),
};

// Async hooks each face can opt into (e.g. plate's bg fetch).
const initHooks = {
    plate: async () => {
        const { loadPlateBg } = await import("./faces/plate.js");
        await loadPlateBg();
    },
    slots: async () => {
        const { loadSlotsBg } = await import("./faces/slots.js");
        await loadSlotsBg();
    },
    spirits: async () => {
        const { loadPlanchette } = await import("./faces/spirits.js");
        await loadPlanchette();
    },
};

const cache = {};

export async function getFace(id) {
    if (cache[id]) return cache[id];
    const loader = loaders[id];
    if (!loader) throw new Error(`unknown face: ${id}`);
    const face = await loader();
    if (initHooks[id]) await initHooks[id]();
    cache[id] = face;
    return face;
}

export function knownFaces() { return Object.keys(loaders); }
