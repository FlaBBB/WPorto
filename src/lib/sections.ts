/**
 * The site's sections, in reading order.
 *
 * This is the single source of truth for the header's section links, so the
 * navigation and the page can never offer different sections. It carries no
 * position: the opening's mark is driven by scroll, so nothing needs to know
 * where a section's star would sit.
 */

export type Section = {
  /** The section element's id, which is also the anchor its link targets. */
  id: string;
  /** The visible label, and the accessible link name. */
  label: string;
};

export const SECTIONS: Section[] = [
  { id: "selected-evidence", label: "Work" },
  { id: "writing", label: "Writing" },
  { id: "technical-profile", label: "Profile" },
  { id: "learning-archive", label: "Archive" },
  { id: "contact-path", label: "Contact" },
];
