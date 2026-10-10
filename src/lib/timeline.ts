/**
 * One global timeline for the whole page.
 *
 * Progress is the document scroll fraction: scrollY / (scrollHeight - innerHeight),
 * 0 at the Opening and 1 at the Contact bottom. Every scene's stable interval and
 * its short outgoing transition are expressed as fractions of that one timeline,
 * so no scene keeps a private percent reset. The numbers are editable defaults,
 * not literals scattered through the components.
 */
export type Scene = {
  id: string;
  /** Progress where the scene's screen is settled at the top of the viewport. */
  start: number;
  /** Progress where its outgoing transition begins. */
  outStart: number;
  /** Progress where the next scene has fully arrived. */
  outEnd: number;
};

export const TIMELINE: Scene[] = [
  { id: "identity", start: 0.0, outStart: 0.12, outEnd: 0.15 },
  { id: "intro", start: 0.15, outStart: 0.25, outEnd: 0.28 },
  { id: "selected-evidence", start: 0.28, outStart: 0.48, outEnd: 0.51 },
  { id: "technical-profile", start: 0.51, outStart: 0.71, outEnd: 0.74 },
  { id: "learning-archive", start: 0.74, outStart: 0.85, outEnd: 0.88 },
  { id: "contact-path", start: 0.88, outStart: 1.0, outEnd: 1.0 },
];

/** Floor for the scrollable distance, so the holds feel deliberate. */
export const MIN_SCROLL_VIEWPORTS = 5;
/** Shortest transition, in viewports, so a scrub is never a single frame. */
const MIN_TRANSITION_VIEWPORTS = 0.35;
/**
 * Readable initial hold, in viewports, for a scene that fits the viewport. A
 * scene taller than the viewport has no hold: its whole stable interval reads
 * the overflow, so it moves from the first wheel to the last.
 */
const INITIAL_HOLD_VIEWPORTS = 0.25;

export type Layout = {
  heights: number[];
  tops: number[];
  viewport: number;
  /** Total scrollable distance; progress = scrollY / scroll. */
  scroll: number;
};

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Total scrollable distance. It must be large enough that every long scene can
 * be read inside its stable interval, and every transition has a minimum length,
 * so reading is never compressed into the outgoing scrub. A scene taller than
 * the viewport budgets its whole stable interval for the overflow, which reads
 * it at most 1:1; a viewport-sized scene budgets the readable initial hold.
 */
export function computeScroll(heights: number[], viewport: number) {
  let scroll = MIN_SCROLL_VIEWPORTS * viewport;
  TIMELINE.forEach((scene, index) => {
    const overflow = Math.max(0, (heights[index] ?? 0) - viewport);
    const stable = scene.outStart - scene.start;
    const transition = scene.outEnd - scene.outStart;
    const budget =
      overflow > 0 ? overflow : INITIAL_HOLD_VIEWPORTS * viewport;
    if (stable > 0) scroll = Math.max(scroll, budget / stable);
    if (transition > 0)
      scroll = Math.max(scroll, (MIN_TRANSITION_VIEWPORTS * viewport) / transition);
  });
  return scroll;
}

export function measureLayout(heights: number[], viewport: number): Layout {
  const tops: number[] = [];
  let acc = 0;
  for (const height of heights) {
    tops.push(acc);
    acc += height;
  }
  // Round at the source so the journey height is an integer and the declared
  // global denominator equals the real scrollable extent exactly.
  return { heights, tops, viewport, scroll: Math.round(computeScroll(heights, viewport)) };
}

/**
 * The global progress that reproduces a given scene and its read offset in a
 * layout. Used to preserve the reader's pose across a relayout, so a resize or
 * a disclosure expansion never jumps to a different point in the chapter.
 *
 * A scene taller than the viewport maps read offset 0..overflow across its whole
 * stable interval, so a relayout keeps the same physical read offset. A
 * viewport-sized scene never moves, so the supplied stable-interval fraction is
 * preserved for any requested read offset.
 */
export function progressForRead(
  index: number,
  readOffset: number,
  layout: Layout,
  holdFraction = 0,
) {
  const scene = TIMELINE[index] ?? TIMELINE[0];
  const stable = scene.outStart - scene.start;
  const overflow = Math.max(0, (layout.heights[index] ?? 0) - layout.viewport);
  if (layout.scroll <= 0) return scene.start;
  if (overflow > 0) {
    return clamp01(scene.start + clamp01(readOffset / overflow) * stable);
  }
  return clamp01(scene.start + stable * clamp01(holdFraction));
}

/** Where the scene stack is scrolled to, in document pixels, for this progress. */
export function presentationOffset(progress: number, layout: Layout) {
  const p = clamp01(progress);
  const { heights, tops, viewport } = layout;
  for (let index = 0; index < TIMELINE.length; index += 1) {
    const scene = TIMELINE[index];
    const top = tops[index] ?? 0;
    const overflow = Math.max(0, (heights[index] ?? 0) - viewport);
    if (p < scene.outStart) {
      if (overflow <= 0) return top;
      // Stable: the whole interval reads the overflow continuously, so a tall
      // scene moves from its first wheel to the last, with no plateau at either
      // end. The movement is at most 1:1 (slower when the scroll budget floor
      // or a transition window dominates).
      const stable = scene.outStart - scene.start;
      const read = stable > 0 ? clamp01((p - scene.start) / stable) : 0;
      return top + read * overflow;
    }
    if (p < scene.outEnd) {
      const nextTop = tops[index + 1] ?? top + (heights[index] ?? 0);
      const local = (p - scene.outStart) / (scene.outEnd - scene.outStart);
      const eased = local * local * (3 - 2 * local);
      return top + overflow + (nextTop - top - overflow) * eased;
    }
  }
  const last = TIMELINE.length - 1;
  return (tops[last] ?? 0) + Math.max(0, (heights[last] ?? 0) - viewport);
}

/** The Opening's gathered mark disperses across its outgoing transition. */
export function gatherAt(progress: number) {
  const scene = TIMELINE[0];
  if (progress <= scene.outStart) return 1;
  if (progress >= scene.outEnd) return 0;
  const local = (progress - scene.outStart) / (scene.outEnd - scene.outStart);
  return 1 - local * local * (3 - 2 * local);
}

/** The scene whose settled interval contains this progress. */
export function activeSceneIndex(progress: number) {
  let active = 0;
  for (let index = 0; index < TIMELINE.length; index += 1) {
    if (progress >= TIMELINE[index].start) active = index;
  }
  return active;
}

/** Document scroll position where a scene's screen is settled at the top. */
export function sceneScrollPosition(index: number, layout: Layout) {
  return clamp01(TIMELINE[index].start) * layout.scroll;
}

/**
 * Shared with the canvas renderer. The controller owns gather and the signed
 * scroll velocity; the sculpture reads them each frame and integrates its clock.
 */
export const skyState = {
  gather: 1,
  velocity: 0,
  active: 0,
  offset: 0,
  /** Violet-surface visibility, 0..1, so the cloud can switch to plum ink. */
  contact: 0,
  /** Shared accumulated motion time (seconds) and its signed rate. */
  motionClock: 0,
  rate: 1,
  /** Bumped whenever the scene layout changes, to invalidate cached bounds. */
  layoutVersion: 0,
  /**
   * Consumers that must react to a rate change at the moment it is published.
   * Relying on native scroll-listener order would let a consumer commit the old
   * rate; this makes the controller's update the single authoritative boundary.
   */
  rateListeners: new Set<(rate: number) => void>(),
};

/** Publish the shared signed rate and notify subscribers synchronously. */
export function publishRate(next: number) {
  skyState.rate = next;
  for (const listener of skyState.rateListeners) listener(next);
}
