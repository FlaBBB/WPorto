/**
 * The opening's section map: which sections exist.
 *
 * The destination list is the single source of truth for both routes into a
 * section — the destination stars and the footer's static fallback list — so the
 * two can never offer different sections. Where each star sits is the field's
 * business, not this module's: the stars are particles of the mark, so the field
 * that builds the mark places them.
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
