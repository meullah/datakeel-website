// Hero Story scene data, ported from prototypes/landing-story/story-engine.js. Pure: no DOM.
// One cloud of POINTS particles; each scene is a set of paths in unit space (roughly -1..1) the points sit on.
// ponytail: the prototype's unused wheel/keel/engine scenes and scroll-driven mode are not ported.

export const POINTS = 2000;
/** Every scene stays inside ±SCENE_EXTENT of its size, so layout can keep it within the content edges. */
export const SCENE_EXTENT = 1.15;
export const SEED = 7;
export const SCENE_NAMES = ['computer', 'data', 'intelligence', 'datakeel', 'pipelines', 'lakehouse', 'governance', 'aiReady', 'logo'] as const;
export const SCENE_LABELS = ['Computation', 'Data', 'AI', 'The keel', 'Pipelines', 'Lakehouse', 'Governance', 'AI-ready', 'DataKeel'];
/** Read from CSS as --tone-<name> ("r g b"). */
export const TONE_NAMES = ['hot', 'orange', 'warm', 'light', 'dim', 'bronze', 'silver', 'gold'] as const;

export type ToneName = (typeof TONE_NAMES)[number];
export type Tone = ToneName | 'logo';
type Pt = [number, number];
export interface Path {
  pts: Pt[];
  tone: Tone;
  weight: number;
  speed: number;
  cum: number[];
  length: number;
}
export interface Slot {
  path: Path;
  u: number;
}
export type Scene = Slot[];

const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smooth = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let v = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- path builders ----------
function path(pts: Pt[], opts: { tone?: Tone; weight?: number; speed?: number } = {}): Path {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    cum.push(total);
  }
  return { pts, tone: 'light', weight: 1, speed: 0, ...opts, cum, length: total || 0.0001 };
}
const circlePts = (r: number, cx = 0, cy = 0, n = 72): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);
const ellipsePts = (rx: number, ry: number, cx = 0, cy = 0, n = 40): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * TAU) * rx, cy + Math.sin((i / n) * TAU) * ry]);
const quadPts = (a: Pt, c: Pt, b: Pt, n = 32): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
function roundRectPts(x0: number, y0: number, x1: number, y1: number, r: number, n = 5): Pt[] {
  const pts: Pt[] = [];
  const corners: [number, number, number][] = [
    [x1 - r, y0 + r, -Math.PI / 2],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, Math.PI / 2],
    [x0 + r, y0 + r, Math.PI],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = start + ((i / n) * Math.PI) / 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  pts.push(pts[0]);
  return pts;
}
const wavePts = (y: number, amplitude: number, frequency: number, from = -1.3, to = 1.3): Pt[] =>
  Array.from({ length: 61 }, (_, i) => {
    const x = from + (i / 60) * (to - from);
    return [x, y + Math.sin(x * frequency) * amplitude + Math.sin(x * frequency * 2.3) * amplitude * 0.4];
  });

// ---------- the scenes ----------
function computer() {
  const s = 0.42;
  const paths = [
    path([[-s, -s], [s, -s], [s, s], [-s, s], [-s, -s]], { tone: 'light', weight: 1.2 }),
    path([[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [-0.2, -0.2]], { tone: 'orange', weight: 1 }),
  ];
  for (let i = 0; i < 5; i++) {
    const o = -0.3 + i * 0.15;
    paths.push(
      path([[o, -s], [o, -0.58]], { tone: 'dim', weight: 0.25 }),
      path([[o, s], [o, 0.58]], { tone: 'dim', weight: 0.25 }),
      path([[-s, o], [-0.58, o]], { tone: 'dim', weight: 0.25 }),
      path([[s, o], [0.58, o]], { tone: 'dim', weight: 0.25 }),
    );
  }
  // Signals running along circuit traces.
  const traces: Pt[][] = [
    [[0.58, -0.15], [0.8, -0.15], [0.8, -0.6], [1.15, -0.6]],
    [[0.58, 0.3], [0.95, 0.3], [0.95, 0.75]],
    [[-0.58, 0], [-0.85, 0], [-0.85, 0.55], [-1.15, 0.55]],
    [[-0.15, -0.58], [-0.15, -0.9], [-0.7, -0.9]],
    [[0.15, 0.58], [0.15, 0.95], [0.6, 0.95]],
  ];
  traces.forEach((pts, i) => paths.push(path(pts, { tone: i % 2 ? 'warm' : 'hot', speed: 0.18, weight: 0.8 })));
  return paths;
}

function data() {
  const lake = { x: 0.45, top: -0.12, bottom: 0.42, rx: 0.32, ry: 0.08 };
  const ellipse = (cy: number, n = 48): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => [lake.x + Math.cos((i / n) * TAU) * lake.rx, cy + Math.sin((i / n) * TAU) * lake.ry]);
  const paths = [
    path(ellipse(lake.top), { tone: 'orange', weight: 1 }),
    path(ellipse(lake.bottom), { tone: 'orange', weight: 0.8 }),
    path([[lake.x - lake.rx, lake.top], [lake.x - lake.rx, lake.bottom]], { tone: 'orange', weight: 0.5 }),
    path([[lake.x + lake.rx, lake.top], [lake.x + lake.rx, lake.bottom]], { tone: 'orange', weight: 0.5 }),
  ];
  // Five scattered sources (ERP, CRM, spreadsheets, apps, files) flowing into one place.
  for (let i = 0; i < 5; i++) {
    const y = -0.72 + i * 0.36,
      x = -0.95;
    paths.push(path([[x - 0.06, y - 0.06], [x + 0.06, y - 0.06], [x + 0.06, y + 0.06], [x - 0.06, y + 0.06], [x - 0.06, y - 0.06]], { tone: 'light', weight: 0.3 }));
    paths.push(path(quadPts([x + 0.08, y], [0, y * 0.6 - 0.2], [lake.x, lake.top]), { tone: i % 2 ? 'warm' : 'light', speed: 0.22, weight: 1.3 }));
  }
  return paths;
}

function intelligence() {
  const layers = [4, 6, 6, 3];
  const nodes = layers.map((count, li) =>
    Array.from({ length: count }, (_, ni): Pt => [-0.8 + (li / (layers.length - 1)) * 1.6, -0.75 + ((ni + 0.5) / count) * 1.5]),
  );
  const paths: Path[] = [];
  for (let li = 0; li < nodes.length - 1; li++) {
    nodes[li].forEach((a) => nodes[li + 1].forEach((b) => paths.push(path([a, b], { tone: 'dim', speed: 0.3, weight: 0.2 }))));
  }
  nodes.forEach((layer, li) =>
    layer.forEach(([x, y]) => paths.push(path(circlePts(0.05, x, y, 16), { tone: li === nodes.length - 1 ? 'light' : 'orange', weight: 0.35 }))),
  );
  return paths;
}

// The DataKeel mark, drawn as rows of data. Geometry is measured from Logos/Svgs/Icon - Default.svg.
export function logo() {
  const S = 0.72,
    map = (u: number, v: number): Pt => [-S + u * 2 * S, -S + v * 2 * S];
  const paths: Path[] = [];
  const rows = 22;
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const diagonalU = 0.705 - (0.705 - 0.313) * v; // left edge of the slanted block at this height
    paths.push(path([map(0, v), map(0.273, v)], { tone: 'logo', weight: 0.7 }));
    paths.push(path([map(diagonalU, v), map(1, v)], { tone: 'logo', weight: 0.7 }));
  }
  paths.push(path([map(0, 0), map(0.273, 0), map(0.273, 1), map(0, 1), map(0, 0)], { tone: 'logo', weight: 0.6 }));
  paths.push(path([map(0.705, 0), map(1, 0), map(1, 1), map(0.313, 1), map(0.705, 0)], { tone: 'logo', weight: 0.8 }));
  return paths;
}

// A modern sloop in side view: sheer line, canoe hull, deep fin keel with a bulb, rudder, mainsail and jib.
// Unit layout: bow to the right, waterline at y = 0.05, keel reaching y = 0.66.
function shipPaths({ dx = 0, dy = 0, s = 1, keelWeight = 2.6, sea = 'calm' } = {}) {
  const T = ([x, y]: Pt): Pt => [dx + x * s, dy + y * s];
  const P = (pts: Pt[], opts: Parameters<typeof path>[1]) => path(pts.map(T), opts);
  const hull: Pt[] = [...quadPts([0.86, -0.12], [0.6, 0.18], [0.08, 0.18], 24), ...quadPts([0.08, 0.18], [-0.56, 0.18], [-0.76, 0.03], 24).slice(1), [-0.8, -0.05]];
  const paths = [
    P([[-0.8, -0.05], [0.86, -0.12]], { tone: 'light', weight: 0.7 }), // sheer line
    P(hull, { tone: 'warm', weight: 1.4 }), // hull
    P([[0.13, 0.178], [0.03, 0.58], [-0.06, 0.58], [-0.08, 0.18]], { tone: 'hot', weight: keelWeight }), // fin keel
    P(ellipsePts(0.17, 0.038, -0.03, 0.605, 30), { tone: 'hot', weight: keelWeight * 0.4 }), // torpedo bulb
    P([[-0.4, 0.12], [-0.44, 0.36], [-0.36, 0.36], [-0.34, 0.13]], { tone: 'warm', weight: 0.5 }), // rudder
    P([[0.1, -0.09], [0.1, -1.02]], { tone: 'light', weight: 0.8 }), // mast
    P([[0.1, -0.2], [-0.66, -0.17]], { tone: 'light', weight: 0.35 }), // boom
    P(quadPts([0.08, -0.99], [-0.36, -0.52], [-0.64, -0.2], 28), { tone: 'light', weight: 0.9 }), // mainsail leech
    P([[0.13, -0.88], [0.8, -0.14], [0.2, -0.17], [0.13, -0.88]], { tone: 'light', weight: 0.8 }), // jib
  ];
  // The keel is filled with rows of data, like the logo.
  for (let r = 1; r < 8; r++) {
    const v = r / 8,
      y = 0.18 + v * 0.4;
    paths.push(P([[-0.08 + v * 0.02, y], [0.13 - v * 0.1, y]], { tone: 'hot', weight: keelWeight * 0.25 }));
  }
  const rough = sea === 'storm';
  paths.push(P(wavePts(0.05, rough ? 0.045 : 0.018, rough ? 7 : 5, -1.15 / s, 1.15 / s), { tone: 'dim', speed: rough ? 0.09 : 0.03, weight: rough ? 1.6 : 1 }));
  if (rough) paths.push(P(wavePts(0.16, 0.05, 5.5, -1.15 / s, 1.15 / s), { tone: 'dim', speed: -0.07, weight: 1 }));
  return paths;
}

function datakeel() {
  return shipPaths({ s: 0.98, dy: 0.18 });
}

// A small "table" icon: frame plus rows, used for data sources.
function tableIcon(x0: number, y0: number, x1: number, y1: number, tone: Tone, weight = 0.35) {
  const paths = [path(roundRectPts(x0, y0, x1, y1, 0.025, 3), { tone, weight })];
  const rows = 3,
    h = (y1 - y0) / (rows + 1);
  for (let r = 1; r <= rows; r++) paths.push(path([[x0 + 0.03, y0 + r * h], [x1 - 0.03, y0 + r * h]], { tone: 'dim', weight: weight * 0.5 }));
  return paths;
}

function pipelines() {
  const paths: Path[] = [];
  const merge: Pt = [-0.42, 0],
    pipeEnd = 0.74,
    transformX = 0.12;
  for (let i = 0; i < 6; i++) {
    const y = -0.65 + i * 0.26;
    paths.push(...tableIcon(-1.02, y - 0.08, -0.74, y + 0.08, 'light'));
    paths.push(path(quadPts([-0.74, y], [-0.58, y], merge), { tone: i % 2 ? 'warm' : 'light', speed: 0.35, weight: 0.5 }));
  }
  paths.push(path([[merge[0], -0.08], [pipeEnd, -0.08]], { tone: 'dim', weight: 0.6 }));
  paths.push(path([[merge[0], 0.08], [pipeEnd, 0.08]], { tone: 'dim', weight: 0.6 }));
  // Messy before Transform, clean parallel lanes after it.
  [-0.045, 0, 0.045].forEach((lane, i) => {
    const messy = Array.from({ length: 25 }, (_, k): Pt => {
      const x = merge[0] + (k / 24) * (transformX - merge[0]);
      return [x, lane + Math.sin(x * 26 + i * 2) * 0.03];
    });
    paths.push(path(messy, { tone: i === 1 ? 'warm' : 'light', speed: 0.4, weight: 0.7 }));
    paths.push(path([[transformX, lane * 0.7], [pipeEnd, lane * 0.7]], { tone: 'hot', speed: 0.4, weight: 0.8 }));
  });
  const stations: [number, Tone][] = [[-0.2, 'light'], [transformX, 'orange'], [0.48, 'light']];
  stations.forEach(([x, tone]) => paths.push(path(circlePts(0.06, x, 0, 24), { tone, weight: 0.35 })));
  // The lakehouse they land in.
  paths.push(path(ellipsePts(0.12, 0.035, 0.92, -0.12), { tone: 'orange', weight: 0.4 }));
  paths.push(path(ellipsePts(0.12, 0.035, 0.92, 0.14), { tone: 'orange', weight: 0.3 }));
  paths.push(path([[0.8, -0.12], [0.8, 0.14]], { tone: 'orange', weight: 0.15 }), path([[1.04, -0.12], [1.04, 0.14]], { tone: 'orange', weight: 0.15 }));
  return paths;
}

// Three stacked layers: raw bronze at the bottom, cleaned silver, business-ready gold on top.
function lakehouse(random: () => number) {
  const paths: Path[] = [];
  const layer = (y: number, tone: Tone) => {
    const top = ellipsePts(0.62, 0.13, 0, y - 0.1, 60),
      // slice(0, -1): the closing 2π point would pass the filter and draw a chord back across the bottom.
      bottom = ellipsePts(0.62, 0.13, 0, y + 0.1, 60).slice(0, -1).filter(([, py]) => py >= y + 0.1);
    paths.push(
      path(top, { tone, weight: 1.1 }),
      path(bottom, { tone, weight: 0.6 }),
      path([[-0.62, y - 0.1], [-0.62, y + 0.1]], { tone, weight: 0.12 }),
      path([[0.62, y - 0.1], [0.62, y + 0.1]], { tone, weight: 0.12 }),
    );
  };
  layer(0.5, 'bronze');
  layer(0.05, 'silver');
  layer(-0.4, 'gold');
  // Bronze: raw, scattered.
  for (let i = 0; i < 90; i++) {
    const a = random() * TAU,
      r = Math.sqrt(random());
    const x = Math.cos(a) * r * 0.55,
      y = 0.4 + Math.sin(a) * r * 0.1;
    paths.push(path([[x, y], [x + 0.012, y + 0.008]], { tone: 'bronze', weight: 0.6 }));
  }
  // Silver: cleaned rows moving in order.
  [0, 1, 2].forEach((i) => paths.push(path(ellipsePts(0.44 - i * 0.1, 0.07 - i * 0.015, 0, 0.05), { tone: 'silver', speed: i % 2 ? 0.05 : -0.05, weight: 0.5 })));
  // Gold: a tidy grid of tables.
  for (let row = 0; row < 2; row++)
    for (let col = -3; col <= 3; col++) {
      const x = col * 0.13 - 0.05,
        y = -0.54 + row * 0.08;
      if (Math.abs(col) === 3 && row === 0) continue;
      paths.push(path(roundRectPts(x, y, x + 0.1, y + 0.05, 0.012, 2), { tone: 'gold', weight: 0.5 }));
    }
  // Data rising through the layers.
  [-0.75, 0.75].forEach((x) => {
    paths.push(path([[x, 0.6], [x, -0.55]], { tone: 'warm', speed: -0.3, weight: 0.5 }));
    paths.push(path([[x - 0.04, -0.48], [x, -0.56], [x + 0.04, -0.48]], { tone: 'warm', weight: 0.12 }));
  });
  return paths;
}

function governance() {
  const paths = shipPaths({ s: 0.78, dy: 0.26, sea: 'storm' });
  for (let i = 0; i < 16; i++) {
    const x = -0.85 + (i * 2) / 15; // slanted rain kept inside ±1.15 (SCENE_EXTENT)
    paths.push(path([[x, -1.2], [x - 0.3, 1.05]], { tone: 'dim', speed: 0.8, weight: 0.1 }));
  }
  // A protective shield with a check mark, above the ship.
  const shield: Pt[] = [
    [0.55, -0.98],
    [0.75, -0.92],
    [0.75, -0.78],
    ...quadPts([0.75, -0.78], [0.74, -0.6], [0.55, -0.52], 12).slice(1),
    ...quadPts([0.55, -0.52], [0.36, -0.6], [0.35, -0.78], 12).slice(1),
    [0.35, -0.92],
    [0.55, -0.98],
  ];
  paths.push(path(shield, { tone: 'warm', weight: 0.8 }), path([[0.46, -0.76], [0.53, -0.69], [0.65, -0.84]], { tone: 'hot', weight: 0.5 }));
  return paths;
}

// Gold data feeding three outcomes, drawn so they explain themselves: a dashboard, a forecast, an AI chat.
function aiReady() {
  const paths: Path[] = [];
  // Gold data store: a database cylinder.
  paths.push(path(ellipsePts(0.3, 0.07, 0, 0.42, 48), { tone: 'gold', weight: 1 }));
  paths.push(path(ellipsePts(0.3, 0.07, 0, 0.66, 48).slice(0, -1).filter(([, y]) => y >= 0.66), { tone: 'gold', weight: 0.6 }));
  paths.push(path(ellipsePts(0.3, 0.07, 0, 0.54, 48).slice(0, -1).filter(([, y]) => y >= 0.54), { tone: 'gold', weight: 0.4 }));
  paths.push(path([[-0.3, 0.42], [-0.3, 0.66]], { tone: 'gold', weight: 0.2 }), path([[0.3, 0.42], [0.3, 0.66]], { tone: 'gold', weight: 0.2 }));
  const panels: Pt[] = [[-0.66, -0.12], [0, -0.45], [0.66, -0.12]];
  panels.forEach(([cx, cy], i) => {
    const x0 = cx - 0.28,
      x1 = cx + 0.28,
      y0 = cy - 0.2,
      y1 = cy + 0.2;
    paths.push(path(roundRectPts(x0, y0, x1, y1, 0.04), { tone: 'light', weight: 0.7 }));
    paths.push(path([[x0 + 0.03, y0 + 0.06], [x1 - 0.03, y0 + 0.06]], { tone: 'dim', weight: 0.15 })); // title bar
    paths.push(path([[-0.2 + i * 0.2, 0.36], [cx, y1]], { tone: 'warm', speed: -0.35, weight: 0.45 }));
    if (i === 0) {
      // Dashboard: KPI tiles and a bar chart.
      [0, 1].forEach((k) =>
        paths.push(path(roundRectPts(x0 + 0.04 + k * 0.25, y0 + 0.09, x0 + 0.24 + k * 0.25, y0 + 0.16, 0.015, 2), { tone: k ? 'warm' : 'orange', weight: 0.25 })),
      );
      [0.35, 0.6, 0.45, 0.8, 0.65, 1].forEach((h, k) => {
        const x = x0 + 0.07 + k * 0.08;
        paths.push(path([[x, y1 - 0.03], [x, y1 - 0.03 - h * 0.16]], { tone: k === 5 ? 'hot' : 'orange', weight: 0.6 }));
      });
    } else if (i === 1) {
      // Forecast: history as a solid line, the future as a dashed line inside a widening band.
      const f = (k: number): Pt => [x0 + 0.04 + k * 0.024, cy + 0.08 - k * 0.006 + Math.sin(k * 1.3) * 0.035];
      paths.push(path(Array.from({ length: 13 }, (_, k) => f(k)), { tone: 'light', weight: 0.7 }));
      for (let k = 12; k < 20; k += 2) paths.push(path([f(k), f(k + 1)], { tone: 'hot', weight: 0.15 }));
      paths.push(path([f(12), [f(20)[0], f(20)[1] - 0.06]], { tone: 'dim', weight: 0.12 }), path([f(12), [f(20)[0], f(20)[1] + 0.06]], { tone: 'dim', weight: 0.12 }));
    } else {
      // AI assistant: a question, an answer, and a typing indicator.
      paths.push(path(roundRectPts(x0 + 0.04, y0 + 0.1, x0 + 0.32, y0 + 0.18, 0.03, 3), { tone: 'dim', weight: 0.35 }));
      paths.push(path(roundRectPts(x1 - 0.36, y0 + 0.21, x1 - 0.04, y0 + 0.33, 0.03, 3), { tone: 'warm', weight: 0.4 }));
      [0.25, 0.28].forEach((y) => paths.push(path([[x1 - 0.32, y0 + y], [x1 - 0.1, y0 + y]], { tone: 'warm', weight: 0.15 })));
      [0, 1, 2].forEach((k) => paths.push(path(circlePts(0.012, x0 + 0.08 + k * 0.04, y1 - 0.05, 8), { tone: 'light', weight: 0.08 })));
    }
  });
  return paths;
}

const BUILDERS: Record<(typeof SCENE_NAMES)[number], (random: () => number) => Path[]> = {
  computer, data, intelligence, datakeel, pipelines, lakehouse, governance, aiReady, logo,
};

// ---------- sampling ----------
function prepare(paths: Path[], random: () => number): Scene {
  const share = paths.map((p) => p.length * p.weight),
    sum = share.reduce((a, b) => a + b, 0);
  const slots: Slot[] = [];
  paths.forEach((p, i) => {
    const count = Math.max(1, Math.round((share[i] / sum) * POINTS));
    for (let k = 0; k < count; k++) slots.push({ path: p, u: (k + random() * 0.6) / count });
  });
  // Shuffle so points travel to random places in the next scene (a swarm, not a slide).
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  for (let k = 0; slots.length < POINTS; k++) slots.push(slots[k]); // pad by repeating slots in turn
  slots.length = POINTS;
  return slots;
}

function pointOn(p: Path, u: number): Pt {
  const target = u * p.length,
    cum = p.cum;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const span = cum[i] - cum[i - 1] || 1,
    t = (target - cum[i - 1]) / span;
  const a = p.pts[i - 1],
    b = p.pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Where a slot sits at `time` seconds (paths with speed flow along themselves). */
export function position(slot: Slot, time: number): Pt {
  const p = slot.path;
  return pointOn(p, (((slot.u + p.speed * time) % 1) + 1) % 1);
}

/** Logo gradient position, 0 = warm (bottom-left) to 1 = hot (top-right), as in the SVG. */
export function logoT(slot: Slot) {
  const [x, y] = pointOn(slot.path, slot.u);
  return clamp((x - y) / 2.88 + 0.5, 0, 1);
}

/** Every scene in SCENE_NAMES order, the logo scene used for docking, and per-point morph stagger. Same seed, same story. */
export function createStory(seed = SEED) {
  const random = seeded(seed);
  const scenes = SCENE_NAMES.map((name) => prepare(BUILDERS[name](random), random));
  const dockLogo = prepare(logo(), random);
  const stagger = Array.from({ length: POINTS }, random);
  return { scenes, dockLogo, stagger };
}

/** Autoplay timing: each scene holds for `perScene` seconds, morphing into the next over its last 40%. */
export function timeline(seconds: number, perScene: number, count: number) {
  const at = (seconds / perScene) % count;
  const from = Math.floor(at) % count,
    to = (from + 1) % count;
  const mix = smooth((at - Math.floor(at) - 0.6) / 0.4);
  return { from, to, mix, nearest: mix > 0.5 ? to : from };
}
