import gsap from "gsap";

/** Animate native disclosures without hiding Source links or stealing clicks. */
export function setupEvidenceLedger() {
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
  const listeners: (() => void)[] = [];

  function listen(element: EventTarget, name: string, handler: EventListener) {
    element.addEventListener(name, handler);
    listeners.push(() => element.removeEventListener(name, handler));
  }
  function clearIntent() {
    window.clearTimeout(timer);
  }

  function settle(record: Record) {
    record.tween?.kill();
    record.tween = undefined;
    record.details.open = record.expanded;
    gsap.set(record.panel, { clearProps: "height,opacity,overflow" });
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
    for (const other of records) if (other !== record) expand(other, false);
    expand(record, true);
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

  listen(ledger, "keydown", () => {
    keyboard = true;
    clearIntent();
    hoverOpened = undefined;
  });
  const changePreference = () => {
    if (preference.matches) for (const record of records) settle(record);
  };
  preference.addEventListener("change", changePreference);

  return () => {
    clearIntent();
    for (const record of records) settle(record);
    for (const remove of listeners) remove();
    preference.removeEventListener("change", changePreference);
  };
}
