import gsap from "gsap";
import { skyState } from "./timeline";

/**
 * Animate native disclosures without hiding Source links or stealing clicks.
 * `preserveRead` is the timeline controller's hold-aware placement: it keeps the
 * chosen row where the reader left it without ever leaving its scene, and falls
 * back to physical pixels in the ordinary/reduced document.
 */
export function setupEvidenceLedger(
  preserveRead?: (node: Element, viewportTop: number) => void,
) {
  const ledger = document.querySelector<HTMLOListElement>(".evidence-ledger");
  if (!ledger) return () => {};
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const records = [
    ...ledger.querySelectorAll<HTMLDetailsElement>("details"),
  ].map((details) => ({
    details,
    row: details.parentElement!,
    summary: details.querySelector("summary")!,
    panel: details.querySelector<HTMLElement>(".ledger-panel")!,
    expanded: details.open,
    tween: undefined as gsap.core.Tween | undefined,
  }));
  type Record = (typeof records)[number];
  let timer = 0;
  let hoverOpened: Record | undefined;
  let keyboard = false;
  let pointerX = NaN;
  let pointerY = NaN;
  let pointerType = "mouse";
  // A disclosure toggle that collapses a row above the chosen one would shift
  // the chosen row out from under the reader. While its opening tween runs, hold
  // the chosen summary at the viewport position it had when activated. This is
  // bounded to the tween and is cancelled the moment the reader scrolls again,
  // so ordinary wheel/touch/key scrolling stays completely free.
  let anchorActive = false;
  let anchorTween: gsap.core.Tween | undefined;
  const listeners: (() => void)[] = [];

  function listen(element: EventTarget, name: string, handler: EventListener) {
    element.addEventListener(name, handler);
    listeners.push(() => element.removeEventListener(name, handler));
  }
  function cancelAnchor() {
    anchorActive = false;
    anchorTween?.kill();
    anchorTween = undefined;
  }
  function clearIntent() {
    window.clearTimeout(timer);
  }

  function settle(record: Record) {
    record.tween?.kill();
    record.tween = undefined;
    record.details.open = record.expanded;
    gsap.set(record.panel, { clearProps: "height,opacity,overflow" });
    // A settled panel can move prose inside a held scene without changing the
    // scene's total height (equal collapse and expand), so no ResizeObserver
    // fires and preserveRead may no longer run once its anchor is cancelled.
    // Invalidate the quiet-box cache here, at the panel-change source of truth,
    // so the real line-box mask can never stay stale.
    skyState.layoutVersion += 1;
  }

  function expand(record: Record, expanded: boolean) {
    if (record.expanded === expanded) return;
    record.expanded = expanded;
    const height = record.details.open
      ? record.panel.getBoundingClientRect().height
      : 0;
    record.tween?.kill();
    if (preference.matches) {
      settle(record);
      return;
    }

    // Keep a closing details open until its panel reaches zero. Removing the
    // native group name lets the previous panel shrink while the next grows.
    record.details.open = true;
    gsap.set(record.panel, { height, overflow: "hidden" });
    record.tween = gsap.to(record.panel, {
      height: expanded ? record.panel.scrollHeight : 0,
      opacity: expanded ? 1 : 0,
      duration: 0.38,
      ease: "power2.inOut",
      onComplete: () => settle(record),
    });
  }

  function open(record: Record) {
    const wasOpen = record.expanded;
    // Collapsing the rows above the chosen one shifts the chosen row up out from
    // under the reader. Keep it at the viewport position it had when activated,
    // using the controller's hold-aware mapping so the correction can never drag
    // native progress into the previous scene. In reduced motion the disclosures
    // settle immediately, so the anchor is a single immediate placement with no
    // scrolling tween.
    const anchorTop = record.summary.getBoundingClientRect().top;
    anchorActive = true;
    for (const other of records) if (other !== record) expand(other, false);
    expand(record, true);
    anchorTween?.kill();
    anchorTween = undefined;
    if (preference.matches) {
      preserveRead?.(record.summary, anchorTop);
    } else {
      const state = { t: 0 };
      anchorTween = gsap.to(state, {
        t: 1,
        duration: 0.38,
        ease: "power2.inOut",
        onUpdate: () => {
          if (anchorActive) preserveRead?.(record.summary, anchorTop);
        },
        onComplete: () => {
          if (anchorActive) preserveRead?.(record.summary, anchorTop);
        },
      });
    }
    hoverOpened = wasOpen ? undefined : record;
  }
  function intend(record: Record) {
    clearIntent();
    if (!finePointer.matches || keyboard) return;
    timer = window.setTimeout(() => open(record), 110);
  }

  for (const record of records) {
    // No-JS retains native mutual exclusion; JS owns animated coordination.
    record.details.removeAttribute("name");
    listen(record.row, "pointerenter", (event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== "mouse") return;
      const moved =
        Number.isNaN(pointerX) ||
        Math.abs(pointer.clientX - pointerX) +
          Math.abs(pointer.clientY - pointerY) >
          2;
      if (moved) {
        keyboard = false;
        intend(record);
      }
      pointerX = pointer.clientX;
      pointerY = pointer.clientY;
    });
    listen(record.row, "pointerleave", (event) => {
      clearIntent();
      const pointer = event as PointerEvent;
      if (pointer.pointerType === "mouse") {
        pointerX = pointer.clientX;
        pointerY = pointer.clientY;
      }
    });
    listen(record.row, "pointermove", (event) => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType !== "mouse") return;
      const moved =
        Math.abs(pointer.clientX - pointerX) +
          Math.abs(pointer.clientY - pointerY) >
        2;
      pointerX = pointer.clientX;
      pointerY = pointer.clientY;
      // Layout changes under a stationary pointer must not undo a keyboard
      // choice. Only actual mouse movement returns to hover interaction.
      if (moved && (keyboard || !record.expanded)) {
        keyboard = false;
        intend(record);
      }
    });
    listen(record.row, "pointerdown", (event) => {
      clearIntent();
      pointerType = (event as PointerEvent).pointerType;
      keyboard = false;
    });
    listen(record.summary, "click", (event) => {
      event.preventDefault();
      clearIntent();
      const mouse =
        !keyboard &&
        (event as MouseEvent).detail > 0 &&
        pointerType === "mouse";
      if (mouse && record.expanded && hoverOpened === record) {
        hoverOpened = undefined;
        return;
      }
      hoverOpened = undefined;
      if (record.expanded) expand(record, false);
      else open(record);
      // Explicit activation, unlike hover, must never claim the next click.
      hoverOpened = undefined;
    });
  }

  // The reader taking over cancels any in-flight anchor, so a disclosure can
  // never fight a wheel, touch, scrollbar drag or page key.
  listen(window, "wheel", cancelAnchor);
  listen(window, "touchstart", cancelAnchor);
  listen(window, "touchmove", cancelAnchor);
  listen(window, "pointerdown", cancelAnchor);
  listen(window, "keydown", cancelAnchor);

  listen(ledger, "keydown", () => {
    keyboard = true;
    clearIntent();
    hoverOpened = undefined;
  });
  const changePreference = () => {
    // A live reduced-motion change settles the disclosures immediately and must
    // drop any in-flight anchor with them.
    cancelAnchor();
    if (preference.matches) for (const record of records) settle(record);
  };
  preference.addEventListener("change", changePreference);

  return () => {
    clearIntent();
    anchorTween?.kill();
    for (const record of records) settle(record);
    for (const remove of listeners) remove();
    preference.removeEventListener("change", changePreference);
  };
}
