/**
 * The tone of an image, as the page needs to know it.
 *
 * Writeups are illustrated with whatever the tool produced: a light decompiler
 * window, a dark terminal, a screenshot of a web app. The page cannot assume
 * either, so each figure's frame is chosen from the image itself. This is the
 * decision on its own, separated from the canvas work that feeds it, so the
 * boundary is testable without a browser.
 */

/** Mean perceived luminance above which an image counts as light. */
export const LIGHT_THRESHOLD = 0.55;

/**
 * Classify sampled pixels.
 *
 * Luminance is weighted per channel rather than averaged: a saturated violet
 * screenshot reads much darker than the mean of its channels suggests, and
 * averaging would call it light and then frame it as if it were white.
 */
export function toneOf(pixels: ArrayLike<number>): "light" | "dark" {
  let total = 0;
  let count = 0;
  for (let index = 0; index + 2 < pixels.length; index += 4) {
    total +=
      0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
    count += 1;
  }
  if (!count) return "dark";
  return total / count / 255 > LIGHT_THRESHOLD ? "light" : "dark";
}
