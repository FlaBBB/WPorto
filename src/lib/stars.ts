/**
 * The shared star vocabulary.
 *
 * The opening sculpture's sky and the per-section sparse layers are meant to read
 * as one continuous night, so they draw from the same glyph set, the same seeded
 * randomness, and the same two inks. Keeping those here means the two layers
 * cannot drift apart, and neither has to restate the palette.
 */

/** The glyph set every star is drawn from, in both layers. */
export const GLYPHS = ["+", "·", "•", "✳", "✦", "⋆", "✧", "﹡", "⋅", "✶", "*", "⁕"];

/**
 * The glyphs that read as dense at small sizes. They are drawn at a heavier
 * weight so a star does not dissolve into a single pixel on a dark field.
 */
export const DENSE_GLYPHS = new Set(["•", "✳", "✦", "✧", "﹡", "✶", "⁕"]);

/** Channel triplets for the two star inks, for use in `rgba()`. */
export const STAR_INK = "236, 232, 244";
export const STAR_VIOLET = "167, 139, 250";

/**
 * The same two inks as solid colours, for the layers that paint with CSS instead
 * of a canvas. The plum is the Contact band's ink, so a star drawn on that band
 * keeps its contrast.
 */
export const STAR_INK_HEX = "#ece8f4";
export const STAR_PLUM_HEX = "#1b1430";

/**
 * Tone thresholds above which a star takes the violet accent. The opening field
 * and the ambient sky were tuned separately, so the two values are kept as they
 * were rather than merged into one.
 */
export const FIELD_VIOLET_TONE = 0.84;
export const AMBIENT_VIOLET_TONE = 0.8;

/**
 * Deterministic pseudo-random in [0,1) from an index and salt.
 *
 * Every position, size, period and glyph is seeded this way, so a resize rebuilds
 * the same sky instead of reshuffling it, and no layer needs to persist its own
 * random values across rebuilds.
 */
export function rand(index: number, salt: number) {
  let value = Math.imul(index + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** A star's paint string: violet above the accent threshold, off-white below it. */
export function starColor(tone: number, alpha: number, violetAbove: number) {
  const ink = tone > violetAbove ? STAR_VIOLET : STAR_INK;
  return `rgba(${ink}, ${alpha.toFixed(3)})`;
}
