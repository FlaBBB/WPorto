/**
 * The opening's section map: which sections exist, and where each one lives.
 *
 * The destination list is the single source of truth for every route into a
 * section — the destination stars and the footer's static list — so the two can
 * never offer different sections. Each section is its own page, so a destination
 * is a route rather than an anchor. Where each star sits is the field's business,
 * not this module's: the stars are particles of the mark, so the field that
 * builds the mark places them.
 */

export type SectionDestination = {
  /**
   * The route that serves this section. The trailing slash is the form the host
   * serves: a directory build is published as `/work/index.html`, so a request
   * for `/work` is answered with a redirect to `/work/`. Linking to the served
   * form keeps a destination click from costing a redirect.
   */
  href: string;
  /** The visible star label, and the accessible link name. */
  label: string;
};

/**
 * The four section destinations, in reading order. Order matters twice over: the
 * constellation spreads the stars left to right in this order, so the tab order
 * and the visual order stay the same.
 */
export const SECTION_DESTINATIONS: SectionDestination[] = [
  { href: "/work/", label: "Work" },
  { href: "/profile/", label: "Profile" },
  { href: "/archive/", label: "Archive" },
  { href: "/contact/", label: "Contact" },
];

/** The map is closed, mid-transition, or settled and interactive. */
export type MapPhase = "closed" | "opening" | "open";
