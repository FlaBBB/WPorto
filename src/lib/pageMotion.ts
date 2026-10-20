/**
 * The page motion module: reveals, link nudges, and the Evidence Ledger.
 *
 * The page is one document, so this is built once at load. It is still a module
 * rather than a block in the layout because the reveal, nudge and disclosure work
 * is one coherent concern with its own teardown.
 */

import gsap from "gsap";

declare global {
  interface Window {
    /** Set once the motion module has wired a page, read by the pre-paint hold. */
    __afterHoursMotionReady?: boolean;
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

/** Everything one page's motion is wired to, so teardown can be complete. */
type Page = {
  revealTargets: HTMLElement[];
  ruleTargets: HTMLElement[];
  nudgeTargets: HTMLElement[];
  ledgerRecords: LedgerRecord[];
  /** The reveal/nudge work is running; false while reduced motion is in force. */
  active: boolean;
  revealObserver?: IntersectionObserver;
  // Retained so teardown cancels every delivery, including groups that overlap
  // within the reveal window.
  revealTweens: gsap.core.Tween[];
  focusInHandler?: (event: Event) => void;
  scrollHandler?: () => void;
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
  if (page.scrollFrame) cancelAnimationFrame(page.scrollFrame);
  page.focusInHandler = undefined;
  page.scrollHandler = undefined;
  page.scrollFrame = 0;
  // Stop the grouped reveals before clearing their inline styles.
  for (const tween of page.revealTweens) tween.kill();
  page.revealTweens = [];
  gsap.killTweensOf([...page.revealTargets, ...page.ruleTargets, ...page.nudgeTargets]);
  gsap.set(page.nudgeTargets, { clearProps: "transform" });
  root.classList.remove("motion");
  gsap.set(page.revealTargets, { clearProps: "all" });
  gsap.set(page.ruleTargets, { clearProps: "all" });
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

  current.scrollHandler = () => {
    if (current.scrollFrame) return;
    current.scrollFrame = requestAnimationFrame(() => {
      current.scrollFrame = 0;
      settlePassed();
    });
  };
  window.addEventListener("scroll", current.scrollHandler, { passive: true });
  // A deep link may have scrolled before this module ran, so sweep once.
  requestAnimationFrame(settlePassed);
  window.addEventListener("hashchange", current.scrollHandler);
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
    ".intro-link, .project-link, .text-link, .ledger-source a, #contact-path a, .site-nav a",
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
    active: false,
    revealTweens: [],
    scrollFrame: 0,
    hoverTimer: 0,
  };

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
