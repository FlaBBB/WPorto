/**
 * The page motion module: reveals, link nudges, the Evidence Ledger, and Contact's
 * scroll-triggered expansion.
 *
 * The page is one document, so this is built once at load. It is still a module
 * rather than a block in the layout because the reveal, nudge, disclosure and band
 * work is one coherent concern with its own teardown.
 */

import gsap from "gsap";

declare global {
  interface Window {
    /** Set once the motion module has wired a page, read by the pre-paint hold. */
    __afterHoursMotionReady?: boolean;
    /**
     * Set once the Work section's preview controller owns the section. The
     * pre-paint hold reserves that section's geometry on the strength of this
     * signal and releases the reservation if it never arrives, so an unavailable
     * Work module leaves the static inline preview standing.
     */
    __workPreviewReady?: boolean;
  }
}

// Foreground tweens follow elapsed time even when a rendering frame is slow.
gsap.ticker.lagSmoothing(0);

const root = document.documentElement;
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * The nudge animates the trailing arrow when a link has one, so the arrow is what
 * must be cleaned up when motion is switched off. Contact links also carry a
 * decorative icon span, so the arrow is named explicitly.
 */
const arrowOf = (element: HTMLElement) =>
  element.querySelector<HTMLElement>(".contact-arrow") ??
  element.querySelector<HTMLElement>('span[aria-hidden="true"]');

/** An Evidence Ledger record and the state its panel is animating toward. */
type LedgerRecord = {
  details: HTMLDetailsElement;
  row: HTMLElement;
  summary: HTMLElement;
  panel: HTMLElement;
  open: boolean;
  tween: gsap.core.Tween | undefined;
};

/** Contact's section supplies the position; its surface owns the real height. */
type ContactFocus = {
  section: HTMLElement;
  surface: HTMLElement;
  tween: gsap.core.Tween | undefined;
  /** Native navigation owns the viewport until it finishes or a wheel takes over. */
  navigating: boolean;
  /** Once yielded, this transition cannot reclaim scroll, even after navigation. */
  anchorTween: boolean;
  /** The visitor's last vertical approach; our own scroll corrections do not count. */
  direction: "up" | "down";
  /** Opening chooses one fixed edge; closing reverses around that same edge. */
  edge: "top" | "bottom";
  /** Last observed position, before resizing can clamp the browser's scroll. */
  scrollY: number;
  /** Subpixel correction survives consecutive transitions at one reading position. */
  remainder: number;
};

/** Everything one page's motion is wired to, so teardown can be complete. */
type Page = {
  revealTargets: HTMLElement[];
  ruleTargets: HTMLElement[];
  nudgeTargets: HTMLElement[];
  ledgerRecords: LedgerRecord[];
  contactFocus?: ContactFocus;
  /** The reveal/nudge work is running; false while reduced motion is in force. */
  active: boolean;
  revealObserver?: IntersectionObserver;
  // Retained so teardown cancels every delivery, including groups that overlap
  // within the reveal window.
  revealTweens: gsap.core.Tween[];
  focusInHandler?: (event: Event) => void;
  scrollHandler?: (event?: Event) => void;
  contactIntentHandler?: (event: Event) => void;
  /** Recomputes Contact's sizing when its desktop layout changes. */
  contactResizeHandler?: () => void;
  scrollFrame: number;
  /** Pending hover-intent delay on an Evidence Ledger row. */
  hoverTimer: number;
};

/**
 * Where a reveal target starts from is a stylesheet concern, not this module's:
 * `data-enter` selects an initial transform in CSS, and the tween below only
 * completes it to the identity. That keeps one source of truth per variant, so the
 * pre-paint state and the tween that follows it cannot drift apart.
 */

/** Seconds a rule is drawn before the content it introduces settles in. */
const RULE_LEAD = 0.1;
/** Default stagger between the targets of one delivery. */
const REVEAL_STAGGER = 0.06;

/** Contact's compact midpoint enters this viewport band before it expands. */
const CONTACT_FOCUS_START = 0.45;
const CONTACT_FOCUS_END = 0.65;
/** Seconds for a complete expansion or contraction, independent of scroll speed. */
const CONTACT_TRANSITION_SECONDS = 0.4;
/** These events yield viewport control; wheel/scrollend release it for a future tween. */
const CONTACT_SCROLL_INTENTS = ["pointerdown", "click", "keydown", "wheel", "scrollend"] as const;

/**
 * A target's explicit lead time, in seconds.
 *
 * Used to sequence content that has an order of its own — the archive's statement
 * before its supporting notes, the three contact paths one after another.
 */
const delayOf = (element: HTMLElement) => {
  const value = Number(element.dataset.enterDelay);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

let page: Page | undefined;

/**
 * CSS owns the extra space and its desktop/pointer/preference gates. A zero amount
 * means a static band, so mobile needs no separate script-side breakpoint.
 */
function contactExpansion(surface: HTMLElement) {
  const value = Number.parseFloat(
    getComputedStyle(surface).getPropertyValue("--contact-expansion"),
  );
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** A native Contact landing must stay full while its fragment position settles. */
function contactIsTargeted(section: HTMLElement, fragment = location.hash) {
  try {
    const target = document.getElementById(decodeURIComponent(fragment.slice(1)));
    return target !== null && section.contains(target);
  } catch {
    return false;
  }
}

/** Return ownership to the stylesheet's complete, static band. */
function settleContactFocus(focus: ContactFocus) {
  focus.tween?.kill();
  focus.tween = undefined;
  focus.anchorTween = false;
  focus.remainder = 0;
  focus.surface.removeAttribute("data-contact-scroll");
  focus.surface.style.removeProperty("--contact-space");
  root.removeAttribute("data-contact-resizing");
}

/**
 * The whole compact band must be visible, clear of the fixed header, and its
 * midpoint must enter the viewport's 45–65% focus zone. Elapsed time then reaches
 * the target: stopping scroll cannot strand a partial size. A transition finishes
 * before checking the latest position, so recrossing cannot scrub or interrupt it.
 *
 * Both CSS sizing terms grow by twice --contact-space. A downward approach holds
 * the bottom edge and opens upward; an upward approach holds the top edge and
 * opens downward. Closing reverses the opening around the same edge. Project the
 * compact box from that edge for focus checks, so sizing cannot change its own
 * entry boundary. Holding the bottom needs the whole height change added to
 * scroll; holding the top needs no scroll write. Content keeps its natural size.
 * The adjustment adds to the visitor's current scroll rather than replacing it.
 * Native navigation, keyboard and pointer activation take scroll ownership away
 * immediately; a yielded transition finishes sizing without writing scroll again.
 * Once expanded, passing above the focus zone keeps it open toward the footer;
 * scrolling back below the zone starts a contraction.
 *
 * Initial ownership adopts the current position without a close/reopen entrance.
 * Padding changes the real height, leaving text unscaled and the footer against
 * the band's bottom edge at every intermediate pose.
 */
function syncContactFocus(focus: ContactFocus) {
  const expansion = contactExpansion(focus.surface);
  if (!expansion) {
    settleContactFocus(focus);
    return;
  }
  if (focus.tween) return;
  const box = focus.section.getBoundingClientRect();
  const managed = focus.surface.hasAttribute("data-contact-scroll");
  const space = managed
    ? Number.parseFloat(focus.surface.style.getPropertyValue("--contact-space")) || 0
    : expansion;
  const compactHeight = box.height - space * 2;
  const compactTop = focus.edge === "bottom" ? box.bottom - compactHeight : box.top;
  const midpoint = compactTop + compactHeight / 2;
  const viewport = window.innerHeight;
  const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
  const fullyVisible = compactTop >= headerBottom && compactTop + compactHeight <= viewport;
  const inFocus = midpoint >= viewport * CONTACT_FOCUS_START && midpoint <= viewport * CONTACT_FOCUS_END;
  const passedFocus = space > 0 && midpoint < viewport * CONTACT_FOCUS_START;
  const expanded = (fullyVisible && inFocus) || passedFocus;
  const fragmentEntry = focus.navigating && contactIsTargeted(focus.section);
  const target = expanded || fragmentEntry ? expansion : 0;
  if (!managed || fragmentEntry) {
    // A native Contact landing is already full and aligned at its top, rather
    // than an animated approach that needs to choose an expanding edge.
    if (fragmentEntry) focus.edge = "top";
    focus.surface.style.setProperty("--contact-space", `${target}px`);
    focus.surface.setAttribute("data-contact-scroll", "");
    return;
  }
  if (Math.abs(space - target) < 0.01) return;
  if (target > space) {
    const edge = focus.direction === "down" ? "bottom" : "top";
    if (focus.edge !== edge) focus.remainder = 0;
    focus.edge = edge;
  }
  let height = box.height;
  if (focus.scrollY !== window.scrollY) focus.remainder = 0;
  focus.scrollY = window.scrollY;
  focus.anchorTween = !focus.navigating;
  root.setAttribute("data-contact-resizing", "");
  focus.tween = gsap.to(focus.surface, {
    "--contact-space": `${target}px`,
    duration: CONTACT_TRANSITION_SECONDS,
    ease: "power2.out",
    onUpdate: () => {
      if (!contactExpansion(focus.surface)) {
        settleContactFocus(focus);
        return;
      }
      const before = focus.scrollY;
      const next = focus.section.getBoundingClientRect();
      const movement = next.height - height;
      height = next.height;
      // An anchor jump away must stay away: never drag an offscreen visitor
      // back toward Contact, or cancel an in-flight native smooth navigation.
      if (!focus.anchorTween || focus.edge === "top" || next.bottom <= 0 || next.top >= window.innerHeight) {
        focus.scrollY = window.scrollY;
        focus.remainder = 0;
        return;
      }
      // Use the pre-layout position: shrinking the document can already have
      // clamped scrollY, which must not become a second movement on this frame.
      const destination = Math.max(0, Math.min(
        before + movement + focus.remainder,
        root.scrollHeight - window.innerHeight,
      ));
      window.scrollTo({ top: Math.round(destination), behavior: "instant" });
      focus.scrollY = window.scrollY;
      // Scroll positions may round to a CSS pixel. Carry that rounding into the
      // next frame, but not an unreachable offset beyond the document's edges.
      focus.remainder = destination - focus.scrollY;
    },
    onComplete: () => {
      root.removeAttribute("data-contact-resizing");
      focus.tween = undefined;
      focus.anchorTween = false;
      syncContactFocus(focus);
    },
  });
}

function settle(targets: HTMLElement[]) {
  // Cancel any in-flight reveal first: otherwise a running opacity/y tween
  // repaints its earlier pose on the next frame, undoing this settlement.
  gsap.killTweensOf(targets, "opacity,x,y,rotation");
  gsap.set(targets, { opacity: 1, x: 0, y: 0, rotation: 0 });
}

function stopMotion() {
  if (!page) return;
  page.revealObserver?.disconnect();
  page.revealObserver = undefined;
  if (page.focusInHandler)
    document.removeEventListener("focusin", page.focusInHandler);
  if (page.scrollHandler) {
    window.removeEventListener("scroll", page.scrollHandler);
    window.removeEventListener("hashchange", page.scrollHandler);
  }
  if (page.contactResizeHandler) {
    window.removeEventListener("resize", page.contactResizeHandler);
  }
  if (page.contactIntentHandler) {
    for (const event of CONTACT_SCROLL_INTENTS)
      window.removeEventListener(event, page.contactIntentHandler);
  }
  if (page.scrollFrame) cancelAnimationFrame(page.scrollFrame);
  page.focusInHandler = undefined;
  page.scrollHandler = undefined;
  page.contactResizeHandler = undefined;
  page.contactIntentHandler = undefined;
  page.scrollFrame = 0;
  // Stop the grouped reveals before clearing their inline styles.
  for (const tween of page.revealTweens) tween.kill();
  page.revealTweens = [];
  gsap.killTweensOf([...page.revealTargets, ...page.ruleTargets, ...page.nudgeTargets]);
  gsap.set(page.nudgeTargets, { clearProps: "transform" });
  root.classList.remove("motion");
  gsap.set(page.revealTargets, { clearProps: "all" });
  gsap.set(page.ruleTargets, { clearProps: "all" });
  /*
    Contact's band is left complete, exactly as it is with no JavaScript at all.
    Stopping mid-expansion would otherwise strand a partial size. Reduced motion
    replaces the gesture rather than freezing it part-way; restoring motion reads
    the current scroll instead of replaying an entrance.
  */
  if (page.contactFocus) settleContactFocus(page.contactFocus);
  page.active = false;
}

function startMotion() {
  if (!page || page.active) return;
  const current = page;
  current.active = true;
  root.classList.add("motion");
  const { revealTargets, ruleTargets } = current;

  if (revealTargets.length || ruleTargets.length) {
    current.revealObserver = new IntersectionObserver(
      (entries) => {
        // A queued callback can still be delivered after stopMotion ran (e.g. a
        // preference change mid-scroll). Starting a reveal tween then would
        // repaint hidden/offset state the settle just cleared.
        if (!current.active) return;
        const arriving = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement);
        for (const target of arriving) current.revealObserver?.unobserve(target);
        if (!arriving.length) return;

        // A rule is drawn first, and the content it introduces settles in behind
        // it, so a delivered group reads in the order the page is written.
        const rules = arriving.filter((target) => ruleTargets.includes(target));
        const content = arriving.filter((target) => !ruleTargets.includes(target));
        if (rules.length) {
          gsap.killTweensOf(rules, "scaleX");
          current.revealTweens.push(
            gsap.to(rules, {
              scaleX: 1,
              duration: 0.5,
              ease: "power2.out",
              overwrite: "auto",
            }),
          );
        }
        // One tween per target rather than a stagger: an entrance variant and a
        // lead time are per-element, and a single grouped tween cannot carry both.
        content.forEach((target, index) => {
          const lead =
            RULE_LEAD + delayOf(target) + (rules.length ? 0 : index * REVEAL_STAGGER);
          gsap.killTweensOf(target, "opacity,x,y,rotation");
          current.revealTweens.push(
            gsap.to(target, {
              opacity: 1,
              x: 0,
              y: 0,
              rotation: 0,
              duration: 0.6,
              ease: "power2.out",
              delay: lead,
              overwrite: "auto",
            }),
          );
        });
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const target of [...revealTargets, ...ruleTargets]) {
      current.revealObserver.observe(target);
    }
  }

  current.focusInHandler = (event) => {
    const node = event.target;
    if (!(node instanceof Element)) return;
    const target = node.closest<HTMLElement>("[data-reveal]");
    if (target) settle([target]);
  };
  document.addEventListener("focusin", current.focusInHandler);

  // IntersectionObserver computes intersections on rendering frames, so a fast
  // scroll, an instant jump, or a deep-link landing can pass an element without
  // it ever being reported as intersecting. Anything already scrolled past the
  // viewport is settled here, so no target can stay permanently hidden.
  //
  // "Not yet settled" is read from the painted pose rather than from opacity
  // alone, because the entrance variants are not all opacity ones: the Intro's
  // masked name lines start at full opacity and are displaced inside their own
  // clip instead. Reading opacity alone would leave a jump past the Intro with the
  // name sitting at its pre-paint offset. The bounding-box test is the cheap one,
  // so it is asked first and only the few targets above the reading line pay for a
  // computed style read.
  const prePosed = (target: HTMLElement) => {
    const style = getComputedStyle(target);
    if (Number(style.opacity) < 1) return true;
    return style.transform !== "none" && style.transform !== "matrix(1, 0, 0, 1, 0, 0)";
  };

  const settlePassed = () => {
    const passed = revealTargets.filter(
      (target) =>
        target.getBoundingClientRect().bottom <= 0 && prePosed(target),
    );
    if (!passed.length) return;
    for (const target of passed) current.revealObserver?.unobserve(target);
    settle(passed);
  };

  current.scrollHandler = (event) => {
    if (event?.type === "scroll" && current.contactFocus) {
      const focus = current.contactFocus;
      // A visitor's scroll supplies a new reading position and rounding origin;
      // our own writes have already stored the same position before delivery.
      if (focus.scrollY !== window.scrollY) {
        focus.direction = window.scrollY > focus.scrollY ? "down" : "up";
        focus.remainder = 0;
      }
      focus.scrollY = window.scrollY;
    }
    if (event?.type === "hashchange" && current.contactFocus) {
      current.contactFocus.navigating = true;
      current.contactFocus.anchorTween = false;
    }
    if (current.scrollFrame) return;
    current.scrollFrame = requestAnimationFrame(() => {
      current.scrollFrame = 0;
      if (!current.active) return;
      settlePassed();
      if (current.contactFocus) syncContactFocus(current.contactFocus);
    });
  };
  window.addEventListener("scroll", current.scrollHandler, { passive: true });
  window.addEventListener("hashchange", current.scrollHandler);

  // CSS restores static sizing immediately at its layout gates; reevaluate the
  // focus zone on resize and once fonts establish the content's height.
  if (current.contactFocus) {
    const focus = current.contactFocus;
    focus.navigating = Boolean(location.hash);
    current.contactIntentHandler = (event) => {
      focus.navigating = event.type !== "wheel" && event.type !== "scrollend";
      // Click matters even for an unchanged fragment, which has no hashchange.
      // Do not restore this tween's anchoring when a later scrollend arrives.
      if (focus.navigating) focus.anchorTween = false;
      if (event.type !== "click" || event.defaultPrevented) return;
      const mouse = event as MouseEvent;
      if (mouse.button || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;
      const link = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
      if (!link || (link.target && link.target !== "_self")) return;
      if (link.origin !== location.origin || link.pathname !== location.pathname || link.search !== location.search) return;
      if (!contactIsTargeted(focus.section, link.hash)) return;
      // Native anchor navigation clamps its destination to the document's
      // current height. Settle before that default action, not on hashchange.
      settleContactFocus(focus);
      focus.edge = "top";
      focus.surface.style.setProperty("--contact-space", `${contactExpansion(focus.surface)}px`);
      focus.surface.setAttribute("data-contact-scroll", "");
    };
    for (const event of CONTACT_SCROLL_INTENTS)
      window.addEventListener(event, current.contactIntentHandler, { passive: true });
    syncContactFocus(current.contactFocus);
    current.contactResizeHandler = current.scrollHandler;
    window.addEventListener("resize", current.contactResizeHandler);
    document.fonts.ready.then(() => {
      if (current.active) current.scrollHandler?.();
    });
  }
  // A deep link may scroll before or just after this module runs.
  current.scrollHandler();
}

function syncMotionPreference() {
  if (motionQuery.matches) {
    // A reduced-motion change must land every disclosure at its logical state,
    // not only the reveal/nudge tweens.
    if (page) for (const record of page.ledgerRecords) settlePanel(record);
    if (page?.active) stopMotion();
    return;
  }
  startMotion();
}

/**
 * Settle a panel to its logical state: `record.open` is the logical target, and
 * it is written to the native `open` attribute here while the animated inline
 * height/opacity is cleared, so the natural layout takes over.
 */
function settlePanel(record: LedgerRecord) {
  record.tween?.kill();
  record.tween = undefined;
  record.details.open = record.open;
  gsap.set(record.panel, { clearProps: "height,opacity,overflow" });
}

/**
 * The Contact band, if this page has one.
 *
 * Resolve the position reference and the sizing surface explicitly so a page
 * without either stays an ordinary static layout.
 */
function buildContactFocus(): ContactFocus | undefined {
  const section = document.querySelector<HTMLElement>("#contact-path");
  const surface = section?.querySelector<HTMLElement>(".contact-surface");
  if (!section || !surface) return undefined;
  return {
    section,
    surface,
    tween: undefined,
    navigating: false,
    anchorTween: false,
    direction: "down",
    edge: "bottom",
    scrollY: window.scrollY,
    remainder: 0,
  };
}

/**
 * Read the page and wire everything on it.
 *
 * Evidence Ledger: on a fine pointer, hovering anywhere in a record — the summary
 * or its Source links — opens that record without a click, while native
 * details/summary still owns keyboard and touch. Opening and closing are animated
 * (and reverse cleanly), driven by a small local controller that never writes
 * scroll. It enhances the summary's own activation with preventDefault so the
 * panel animates; it does not capture wheel, touch, or key input. The Source
 * paragraph sits outside `details`, so its links stay visible and clickable
 * whether the panel is open or closed. A short hover-intent delay keeps the row
 * stable while the pointer crosses it, and only a genuine mouse click that lands
 * on a row this hover opened is absorbed, so it cannot immediately toggle the row
 * closed again.
 */
function buildPage(): Page {
  const revealTargets = gsap.utils.toArray<HTMLElement>("[data-reveal]");
  // A rule is a drawn line rather than a revealed block: it is its own kind of
  // target because it animates a different property and leads its group.
  const ruleTargets = gsap.utils.toArray<HTMLElement>("[data-rule]");
  const nudgeLinks = gsap.utils.toArray<HTMLElement>(
    ".intro-link, .project-link, .text-link, .ledger-source a, .writing-all, #contact-path a, .site-nav a",
  );
  const nudgeTargets = nudgeLinks.map((element) => arrowOf(element) ?? element);

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const ledgerRecords: LedgerRecord[] = gsap.utils
    .toArray<HTMLDetailsElement>(".evidence-ledger details")
    .map((details) => ({
      details,
      row: details.parentElement as HTMLElement,
      summary: details.querySelector("summary") as HTMLElement,
      panel: details.querySelector(".ledger-panel") as HTMLElement,
      open: details.open,
      tween: undefined,
    }));

  const current: Page = {
    revealTargets,
    ruleTargets,
    nudgeTargets,
    ledgerRecords,
    contactFocus: buildContactFocus(),
    active: false,
    revealTweens: [],
    scrollFrame: 0,
    hoverTimer: 0,
  };

  if (current.contactFocus) {
    finePointer.addEventListener("change", () => {
      if (current.active) current.scrollHandler?.();
    });
  }

  for (const element of nudgeLinks) {
    const arrow = arrowOf(element);
    const nudge = (direction: number) => {
      if (!current.active) return;
      gsap.to(arrow ?? element, {
        x: direction * 4,
        duration: 0.22,
        ease: "power2.out",
        overwrite: "auto",
      });
    };
    element.addEventListener("pointerenter", () => nudge(1));
    element.addEventListener("pointerleave", () => nudge(0));
    element.addEventListener("focus", () => nudge(1));
    element.addEventListener("blur", () => nudge(0));
  }

  const HOVER_INTENT = 110;
  let hoverOpened: LedgerRecord | undefined;
  let lastPointerType = "mouse";
  let keyboard = false;

  function clearIntent() {
    window.clearTimeout(current.hoverTimer);
  }

  function expand(record: LedgerRecord, open: boolean) {
    if (record.open === open) return;
    record.open = open;
    const from = record.details.open
      ? record.panel.getBoundingClientRect().height
      : 0;
    record.tween?.kill();
    if (motionQuery.matches) {
      settlePanel(record);
      return;
    }
    // Keep the details open while its panel shrinks to zero, so a closing row
    // animates instead of snapping.
    record.details.open = true;
    gsap.set(record.panel, { height: from, overflow: "hidden" });
    record.tween = gsap.to(record.panel, {
      height: open ? record.panel.scrollHeight : 0,
      opacity: open ? 1 : 0,
      duration: 0.38,
      ease: "power2.inOut",
      overwrite: "auto",
      onComplete: () => settlePanel(record),
    });
  }

  // Exclusivity for every path — hover, click, keyboard and touch: close the
  // other records, then set this one. Animated here rather than by the native
  // group name (which JS removes), so the closing row also eases shut.
  function exclusive(record: LedgerRecord, open: boolean) {
    for (const other of ledgerRecords) {
      if (other !== record) expand(other, false);
    }
    expand(record, open);
  }

  function openRow(record: LedgerRecord) {
    const wasOpen = record.open;
    exclusive(record, true);
    // Only claim a row this hover actually opened; a row already open by default
    // or keyboard stays a native toggle.
    hoverOpened = wasOpen ? undefined : record;
  }

  for (const record of ledgerRecords) {
    // No-JS keeps native mutual exclusion; JS owns the animated coordination.
    record.details.removeAttribute("name");
    // The whole row is the hover surface, so the pointer can rest on a Source
    // link and still open the record.
    record.row.addEventListener("pointerenter", (event) => {
      if (!finePointer.matches) return;
      if ((event as PointerEvent).pointerType !== "mouse") return;
      keyboard = false;
      clearIntent();
      current.hoverTimer = window.setTimeout(() => openRow(record), HOVER_INTENT);
    });
    record.row.addEventListener("pointerleave", clearIntent);
    record.row.addEventListener("pointerdown", (event) => {
      // A real press ends the hover deliberation: cancel any pending intent so it
      // cannot open a row the press is about to toggle.
      lastPointerType = (event as PointerEvent).pointerType || "mouse";
      clearIntent();
    });
    record.summary.addEventListener("keydown", () => {
      // Keyboard activation is an explicit choice: cancel any pending hover
      // intent and drop the hover claim, so a following click (detail 0) is never
      // treated as hover absorption.
      keyboard = true;
      clearIntent();
      hoverOpened = undefined;
    });
    record.summary.addEventListener("click", (event) => {
      clearIntent();
      // Explicit activation (keyboard Space/Enter, touch/pen tap, or a real mouse
      // click that is not absorbing the hover it just caused) toggles the row
      // through the same exclusive path, so no other row is left open.
      const mouse =
        !keyboard &&
        (event as MouseEvent).detail > 0 &&
        lastPointerType === "mouse";
      // Enhance the summary's own activation so the panel animates; the click is
      // still this row's own summary activation, not a captured gesture.
      event.preventDefault();
      if (mouse && record.open && hoverOpened === record) {
        hoverOpened = undefined;
        return;
      }
      hoverOpened = undefined;
      exclusive(record, !record.open);
    });
  }

  return current;
}

/**
 * Wire the page's motion.
 *
 * Called once, at load. Everything it registers is retained on `page` so the
 * reduced-motion path can tear the animated half down and leave the page readable.
 */
export function initPageMotion() {
  page = buildPage();
  syncMotionPreference();
  window.__afterHoursMotionReady = true;
}

/**
 * Follow a live preference change.
 *
 * Registered at module scope rather than per page: the media query is global, and
 * this is the one page.
 */
motionQuery.addEventListener("change", syncMotionPreference);
