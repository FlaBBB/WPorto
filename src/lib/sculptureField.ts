/**
 * The opening sculpture's field geometry.
 *
 * Everything here is pure: given a stage size it returns the particle field, its
 * ambient population, and the projection constants that keep the perspective
 * divide positive. Nothing in this module touches the DOM, the animation loop, or
 * the section map's state, so the component that draws the field only has to own
 * the canvas, the clock and the interactions.
 */

import { FLAB_FILL_RULE, FLAB_PATH, FLAB_VIEWBOX } from "./flabMark";
import { GLYPHS, rand } from "./stars";

/** Device-pixel-ratio caps: the field needs sharpness, the sky only presence. */
export const MAX_DPR = 2;
export const AMBIENT_DPR = 1.5;

const DESKTOP_PARTICLES = 900;
const MOBILE_PARTICLES = 420;
const DESKTOP_AMBIENT = 90;
const MOBILE_AMBIENT = 46;

/** Sampling step, in artboard units, when the mark is traced into targets. */
const SAMPLE_GRID = 4.4;

/** Particles whose delay is below this never lag the gather at full assembly. */
export const GATHER_STAGGER = 0.5;

/**
 * Maximum body rotation and radial flattening. These are used both to drive the
 * render and to bound the projection, so they live next to the bound that depends
 * on them.
 */
export const MAX_ROT_Y = 0.3;
export const MAX_ROT_X = 0.18;
export const FLATTEN_MAX = 1.18;

/** The narrow width below which the stage uses its mobile budget and fit. */
const MOBILE_WIDTH = 760;

/**
 * Destination offsets from the stage centre, as fractions of the constellation
 * spread, each with its own depth.
 *
 * The depth is what makes the four stars read as part of the sky rather than as a
 * flat overlay: it gives them a perspective scale, a depth-graded brightness, and
 * a swing as the cloud turns. `x` increases with the destination order, so the
 * four stay in reading order from left to right even at the cloud's largest
 * rotation.
 */
const BEACON_OFFSETS = [
  { x: -0.52, y: -0.28, z: -150 },
  { x: -0.18, y: 0.22, z: 90 },
  { x: 0.18, y: -0.22, z: -60 },
  { x: 0.52, y: 0.28, z: 170 },
];

/** A star in the field: one scattered position, one target on the mark. */
export type Particle = {
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  ty: number;
  tz: number;
  delay: number;
  glyph: number;
  glyphRate: number;
  glyphPhase: number;
  size: number;
  tone: number;
  /**
   * Set on the destination stars, holding the section they lead to. They are
   * ordinary field particles in every other respect — same glyphs, same twinkle,
   * same projection — so they look and move like the sky they belong to.
   */
  destination?: number;
};

/** A star in the ambient population: a fixed origin with its own drift clock. */
export type Ambient = {
  ax: number;
  ay: number;
  amp: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  glyph: number;
  glyphRate: number;
  glyphPhase: number;
  size: number;
  tone: number;
  baseAlpha: number;
  alphaFreq: number;
  alphaPhase: number;
};

/** The drawn field and every constant the render needs to project it. */
export type Field = {
  particles: Particle[];
  ambient: Ambient[];
  spreadZ: number;
  focalLength: number;
  depthBound: number;
  /** The fitted mark's box, which is also the section map's control size. */
  markBox: { width: number; height: number };
  assembledSize: number;
  scatteredSize: number;
  glyphVariety: number;
  depthExtent: number;
};

/**
 * Samples the filled mark into evenly spread points in artboard coordinates. The
 * jitter is seeded by grid cell, so resizing rebuilds the same field instead of
 * reshuffling it.
 */
function sampleTargets(): { x: number; y: number }[] {
  const probe = document.createElement("canvas");
  probe.width = FLAB_VIEWBOX.width;
  probe.height = FLAB_VIEWBOX.height;
  const ctx = probe.getContext("2d");
  if (!ctx) return [];

  const path = new Path2D(FLAB_PATH);
  const columns = Math.ceil(FLAB_VIEWBOX.width / SAMPLE_GRID);

  const points: { x: number; y: number }[] = [];
  let row = 0;
  for (let y = 0; y < FLAB_VIEWBOX.height; y += SAMPLE_GRID) {
    let column = 0;
    for (let x = 0; x < FLAB_VIEWBOX.width; x += SAMPLE_GRID) {
      const cell = row * columns + column;
      const jx = x + (rand(cell, 101) - 0.5) * SAMPLE_GRID;
      const jy = y + (rand(cell, 102) - 0.5) * SAMPLE_GRID;
      if (ctx.isPointInPath(path, jx, jy, FLAB_FILL_RULE)) {
        points.push({ x: jx, y: jy });
      }
      column += 1;
    }
    row += 1;
  }
  return points;
}

/** Sparse stars that ring the mark and drift on their own clock. */
function buildAmbient(width: number, height: number): Ambient[] {
  const count = width < MOBILE_WIDTH ? MOBILE_AMBIENT : DESKTOP_AMBIENT;
  const reach = Math.min(width, height) * 0.72;
  // On very large stages a slight optical increase keeps the brighter subset
  // visible without inflating the soft dots into noise. Ordinary desktop and
  // mobile stages stay at 1.
  const ambientScale = Math.min(1.7, Math.max(1, Math.min(width, height) / 1440));
  const next: Ambient[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = rand(index, 21) * Math.PI * 2;
    // Bias the population outward so most stars sit around the silhouette rather
    // than inside it, keeping the mark legible while the sky reads as a
    // surrounding field.
    const radius = 0.4 + rand(index, 22) * 0.6;
    // A modest subset carries visibly brighter, larger stars so the sky has real
    // presence; the rest stay soft and small.
    const bright = rand(index, 36) > 0.68;
    next.push({
      ax: width / 2 + Math.cos(angle) * radius * reach,
      ay: height / 2 + Math.sin(angle) * radius * reach * 0.92,
      amp: 6 + rand(index, 23) * 16,
      freqX: 0.05 + rand(index, 24) * 0.13,
      freqY: 0.05 + rand(index, 25) * 0.13,
      phaseX: rand(index, 26) * Math.PI * 2,
      phaseY: rand(index, 27) * Math.PI * 2,
      glyph: Math.floor(rand(index, 28) * GLYPHS.length),
      glyphRate: 0.12 + rand(index, 29) * 0.4,
      glyphPhase: rand(index, 30) * 12,
      size: bright
        ? (9 + rand(index, 31) * 6) * ambientScale
        : 4.5 + rand(index, 31) * 4.5,
      tone: rand(index, 32),
      baseAlpha: bright
        ? 0.42 + rand(index, 33) * 0.28
        : 0.14 + rand(index, 33) * 0.16,
      alphaFreq: 0.08 + rand(index, 34) * 0.22,
      alphaPhase: rand(index, 35) * Math.PI * 2,
    });
  }
  return next;
}

/**
 * Builds the field for a stage of this size. Returns `undefined` when the mark
 * could not be sampled at all, which the caller treats as a canvas that cannot
 * draw rather than leaving a blank stage behind.
 */
export function buildField(
  width: number,
  height: number,
  beaconCount = 0,
): Field | undefined {
  const targets = sampleTargets();
  if (!targets.length || !width || !height) return undefined;

  const count = width < MOBILE_WIDTH ? MOBILE_PARTICLES : DESKTOP_PARTICLES;
  const centreX = width / 2;
  const centreY = height / 2;

  // Modest assembled scale: ~44% of the viewport width on desktop, wider on
  // phones so the letterform's counters stay legible. The fitted mark is also
  // capped by width (20rem mobile / 40rem desktop, matching the static SVG
  // fallback) and by 52% of the viewport height, so the fixed-size glyphs never
  // fragment the letterform and the pre-paint SVG matches the canvas.
  const markRatio = width < MOBILE_WIDTH ? 0.66 : 0.44;
  const markCap = (width < MOBILE_WIDTH ? 20 : 40) * 16;
  const fit = Math.min(
    (width * markRatio) / FLAB_VIEWBOX.width,
    (height * 0.52) / FLAB_VIEWBOX.height,
    markCap / FLAB_VIEWBOX.width,
  );
  const markW = FLAB_VIEWBOX.width * fit;
  const markH = FLAB_VIEWBOX.height * fit;
  const markLeft = centreX - markW / 2;
  const markTop = centreY - markH / 2;
  const markRadius = Math.hypot(markW, markH) / 2;

  // The cloud is far wider than the mark in every direction, so no part of the
  // assembled silhouette can remain legible while scattered.
  const spreadX = Math.max(width * 0.95, markRadius * 2.9);
  const spreadY = Math.max(height * 0.95, markRadius * 2.7);
  const spreadZ = Math.max(300, markRadius * 2);

  // Rotation mixes x and y into z, so spreadZ alone does not bound the depth. For
  // the render's maximum angles, |z2| <= maxY*sin(MAX_ROT_X) +
  // maxX*sin(MAX_ROT_Y) + spreadZ; keeping the focal length above that bound
  // keeps every denominator (focalLength + z2) strictly positive — including very
  // wide, short viewports where x dwarfs z.
  const maxX = spreadX;
  const maxY = spreadY * FLATTEN_MAX;
  const depthBound = maxY * Math.sin(MAX_ROT_X) + maxX * Math.sin(MAX_ROT_Y) + spreadZ;
  const focalLength = Math.max(900, depthBound * 1.08);

  const assembledSize = Math.min(Math.max(11 * fit, 2.4), 11);
  const scatteredSize = Math.min(Math.max(20 * fit, 6), 15);

  const particles: Particle[] = [];
  let deepest = 0;
  for (let index = 0; index < count; index += 1) {
    const target = targets[Math.floor((index / count) * targets.length)];

    // A natural 3D cloud: mass falls off from the centre, so the sky keeps a
    // populated middle instead of a hollow ring, and the depth term breaks up any
    // flat disc silhouette.
    const angle = rand(index, 1) * Math.PI * 2;
    const radius = Math.pow(rand(index, 2), 0.58);
    const flatten = 0.82 + rand(index, 11) * 0.36;
    const sz = (rand(index, 3) - 0.5) * 2 * spreadZ;
    deepest = Math.max(deepest, Math.abs(sz));

    particles.push({
      sx: Math.cos(angle) * spreadX * radius,
      sy: Math.sin(angle) * spreadY * radius * flatten,
      sz,
      tx: markLeft + target.x * fit - centreX,
      ty: markTop + target.y * fit - centreY,
      // A shallow body of depth so the mark is a sculpture, not a decal.
      tz: (rand(index, 4) - 0.5) * 44,
      delay: rand(index, 5) * GATHER_STAGGER,
      glyph: Math.floor(rand(index, 6) * GLYPHS.length),
      glyphRate: 0.3 + rand(index, 7) * 0.85,
      glyphPhase: rand(index, 8) * 12,
      size: 0.7 + rand(index, 9) * 0.75,
      tone: rand(index, 10),
    });
  }

  // The destination stars are appended to the field rather than drawn separately,
  // so they are rendered by the same loop and cannot drift apart from the sky.
  const beaconSpreadX = Math.min(width * 0.4, 560);
  const beaconSpreadY = Math.min(height * 0.26, 220);
  for (let destination = 0; destination < beaconCount; destination += 1) {
    const offset = BEACON_OFFSETS[destination % BEACON_OFFSETS.length];
    // Their assembled target is a real point of the mark, so they fly out of the
    // letterform as it breaks apart and back into it as it reforms.
    const target = targets[Math.floor(((destination + 0.5) / beaconCount) * targets.length)];
    particles.push({
      sx: offset.x * beaconSpreadX,
      sy: offset.y * beaconSpreadY,
      sz: offset.z,
      tx: markLeft + target.x * fit - centreX,
      ty: markTop + target.y * fit - centreY,
      tz: offset.z * 0.4,
      // No stagger: the destinations travel with the cloud, not behind it.
      delay: 0,
      glyph: Math.floor(rand(destination, 41) * GLYPHS.length),
      glyphRate: 0.3 + rand(destination, 42) * 0.85,
      glyphPhase: rand(destination, 43) * 12,
      // Above the field's average so a destination is findable without standing
      // apart from the sky it is part of.
      size: 1.3 + rand(destination, 44) * 0.25,
      tone: rand(destination, 45) * 0.5,
      destination,
    });
  }

  return {
    particles,
    ambient: buildAmbient(width, height),
    spreadZ,
    focalLength,
    depthBound,
    markBox: { width: markW, height: markH },
    assembledSize,
    scatteredSize,
    glyphVariety: new Set(particles.map((particle) => particle.glyph)).size,
    depthExtent: deepest,
  };
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

/**
 * Projects one point through the field's body rotation.
 *
 * `focalLength` clears the proven depth bound, so the denominator is always
 * positive; an undefined result here would mean the bound is wrong, so the caller
 * skips the particle rather than drawing inverted geometry. The scale cap is an
 * aesthetic limit on the rare near-camera star, not a safety mechanism.
 */
export function project(
  x: number,
  y: number,
  z: number,
  rotY: number,
  rotX: number,
  focalLength: number,
  cx: number,
  cy: number,
) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y1 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;

  const denominator = focalLength + z2;
  if (denominator <= 1) return undefined;
  const scale = Math.min(2.2, focalLength / denominator);
  return { x: cx + x1 * scale, y: cy + y1 * scale, scale, depth: z2 };
}
