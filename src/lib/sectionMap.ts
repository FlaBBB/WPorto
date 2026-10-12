/**
 * The opening's section map: which sections exist, and where their stars sit.
 *
 * The destination list is the single source of truth for both routes into a
 * section — the constellation's stars and the footer's static fallback list — so
 * the two can never offer different sections.
 */

export type SectionDestination = {
  /** The section element's id, which is also the star's link target. */
  id: string;
  /** The visible star label, and the accessible link name. */
  label: string;
  /** The heading focus moves to once the section is reached. */
  headingId: string;
};

/**
 * The four section destinations, in reading order. Order matters twice over: the
 * constellation spreads the stars left to right in this order, so the tab order
 * and the visual order stay the same.
 */
export const SECTION_DESTINATIONS: SectionDestination[] = [
  { id: "selected-evidence", label: "Work", headingId: "selected-evidence-heading" },
  { id: "technical-profile", label: "Profile", headingId: "technical-profile-heading" },
  { id: "learning-archive", label: "Archive", headingId: "learning-archive-heading" },
  { id: "contact-path", label: "Contact", headingId: "contact-path-heading" },
];

/** The map is closed, mid-transition, or settled and interactive. */
export type MapPhase = "closed" | "opening" | "open";

/**
 * Destination offsets from the stage centre, as fractions of the constellation
 * spread. `x` increases with the destination order; the shallow zigzag on `y`
 * keeps the figure reading as a constellation rather than a menu row.
 */
const BEACON_OFFSETS = [
  { x: -0.52, y: -0.28 },
  { x: -0.18, y: 0.22 },
  { x: 0.18, y: -0.22 },
  { x: 0.52, y: 0.28 },
];

/**
 * A destination star's position in field coordinates, measured from the stage
 * centre. It is derived from the live stage size, so the constellation keeps its
 * spread from a phone through a wide desktop and the labels stay clear of both
 * the header and the viewport edge.
 */
export function beaconPosition(index: number, width: number, height: number) {
  const offset = BEACON_OFFSETS[index % BEACON_OFFSETS.length];
  const spreadX = Math.min(width * 0.4, 560);
  const spreadY = Math.min(height * 0.26, 220);
  return { x: offset.x * spreadX, y: offset.y * spreadY };
}
