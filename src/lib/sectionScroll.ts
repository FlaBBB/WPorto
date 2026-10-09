import gsap from "gsap";

/** Complete native gestures at section boundaries; never trap wheel or touch. */
export function setupSectionScroll(onPosition: () => void) {
  const sections = [...document.querySelectorAll<HTMLElement>("main section")];
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let tween: gsap.core.Tween | undefined;
  let timer = 0;
  let eligible = false;
  let direction = 0;
  // A discrete full-page key (Space/PageDown/PageUp) states its direction
  // outright, unlike a wheel/touch gesture whose progress must be measured.
  let discreteDirection = 0;
  let previousY = window.scrollY;
  let touching = false;

  function flight(active: boolean) {
    document.documentElement.dataset.flight = String(active);
    document.documentElement.dataset.flightDirection = String(direction);
    window.dispatchEvent(new CustomEvent("after-hours-flight", { detail: { active, direction } }));
  }

  function cancel() {
    window.clearTimeout(timer);
    if (tween) flight(false);
    tween?.kill();
    tween = undefined;
    eligible = false;
    discreteDirection = 0;
    previousY = window.scrollY;
  }

  function finishGesture() {
    if (!eligible || touching || preference.matches || document.hidden) return;
    eligible = false;
    if (window.getSelection()?.type === "Range") return;

    const y = window.scrollY;
    const viewport = window.innerHeight;
    const boxes = sections.map((section) => {
      const box = section.getBoundingClientRect();
      return { top: box.top + y, bottom: box.bottom + y };
    });
    let target: number | undefined;

    for (let index = 0; index < boxes.length - 1; index += 1) {
      const before = boxes[index];
      const after = boxes[index + 1];
      // A long section has a freely scrollable middle. Its last viewport, not
      // its first, is the landing point when returning from the next section.
      const edge = Math.max(before.top, before.bottom - viewport);
      if (y <= edge + 1 || y >= after.top - 1) continue;
      const crossed = y - edge;
      // A discrete full-page key scroll already means to move a whole viewport,
      // so complete it in the key's direction instead of measuring progress a
      // frame-throttled native scroll may not have reached yet.
      if (discreteDirection !== 0) {
        target = discreteDirection > 0 ? after.top : edge;
      } else {
        target =
          direction > 0
            ? crossed >= viewport * 0.25
              ? after.top
              : edge
            : after.top - y >= viewport * 0.25
              ? edge
              : after.top;
      }
      break;
    }
    if (target === undefined || Math.abs(target - y) < 2) return;

    direction = Math.sign(target - y);
    flight(true);
    const position = { y };
    tween = gsap.to(position, {
      y: target,
      duration: 0.9,
      ease: "power2.inOut",
      onUpdate: () => {
        window.scrollTo({ top: position.y, behavior: "instant" });
        onPosition();
      },
      onComplete: () => {
        tween = undefined;
        flight(false);
      },
    });
  }

  function scroll() {
    const y = window.scrollY;
    if (eligible) {
      if (Math.abs(y - previousY) > 0.5) direction = Math.sign(y - previousY);
      window.clearTimeout(timer);
      timer = window.setTimeout(finishGesture, 180);
    }
    previousY = y;
  }

  function canScrollPage(target: EventTarget | null) {
    if (!(target instanceof Element)) return true;
    for (
      let node: Element | null = target;
      node && node !== document.body;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight + 1
      )
        return false;
    }
    return true;
  }

  function wheel(event: WheelEvent) {
    if (
      !event.isTrusted ||
      !event.deltaY ||
      event.ctrlKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
    )
      return;
    const moved = Math.abs(window.scrollY - previousY) > 0.5;
    cancel();
    eligible = !preference.matches && canScrollPage(event.target);
    // Chrome can scroll before this callback; Firefox can scroll much later.
    // Start the idle wait only after movement, otherwise await the scroll event.
    direction = Math.sign(event.deltaY);
    if (eligible)
      timer = window.setTimeout(
        moved ? finishGesture : cancel,
        moved ? 180 : 1500,
      );
  }
  function touchstart(event: TouchEvent) {
    cancel();
    touching = true;
    eligible = !preference.matches && canScrollPage(event.target);
  }
  function touchend() {
    touching = false;
    if (eligible) timer = window.setTimeout(finishGesture, 180);
  }
  function keydown(event: KeyboardEvent) {
    cancel();
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (
      !["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(event.key)
    )
      return;
    if (
      event.target instanceof Element &&
      event.target.closest(
        'summary, button, input, textarea, select, [contenteditable="true"]',
      )
    )
      return;
    // A discrete full-page key states its direction outright. Shift+Space is the
    // native upward page gesture, matching PageUp; plain Space scrolls down.
    discreteDirection =
      event.key === " "
        ? event.shiftKey
          ? -1
          : 1
        : event.key === "PageDown"
          ? 1
          : event.key === "PageUp"
            ? -1
            : 0;
    eligible = !preference.matches && canScrollPage(event.target);
  }

  window.addEventListener("wheel", wheel, { passive: true });
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("touchstart", touchstart, { passive: true });
  window.addEventListener("touchend", touchend, { passive: true });
  window.addEventListener("touchcancel", touchend, { passive: true });
  window.addEventListener("keydown", keydown);
  window.addEventListener("pointerdown", cancel);
  window.addEventListener("resize", cancel);
  window.addEventListener("hashchange", cancel);
  document.addEventListener("focusin", cancel);
  document.addEventListener("toggle", cancel, true);
  document.addEventListener("visibilitychange", cancel);
  preference.addEventListener("change", cancel);

  return () => {
    cancel();
    window.removeEventListener("wheel", wheel);
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("touchstart", touchstart);
    window.removeEventListener("touchend", touchend);
    window.removeEventListener("touchcancel", touchend);
    window.removeEventListener("keydown", keydown);
    window.removeEventListener("pointerdown", cancel);
    window.removeEventListener("resize", cancel);
    window.removeEventListener("hashchange", cancel);
    document.removeEventListener("focusin", cancel);
    document.removeEventListener("toggle", cancel, true);
    document.removeEventListener("visibilitychange", cancel);
    preference.removeEventListener("change", cancel);
  };
}
